'use strict';

const { MessageFlags } = require('discord.js');
const { performance } = require('node:perf_hooks');
const { recordInteractionDuration } = require('./runtimeMetrics');
const { categories } = require('../config.js');
const { isCommandCategoryEnabled } = require('./commandAvailability');
const { guardedInteractionHandler } = require('./guardedInteractionHandler');

const COMPONENT_METHODS = Object.freeze({
    button: 'isButton',
    stringSelect: 'isStringSelectMenu',
    channelSelect: 'isChannelSelectMenu',
    roleSelect: 'isRoleSelectMenu',
    userSelect: 'isUserSelectMenu',
    mentionableSelect: 'isMentionableSelectMenu',
    modal: 'isModalSubmit'
});

const COMPONENT_ROUTES = Object.freeze([
    { prefixes: ['help_'], command: 'help', types: ['button', 'stringSelect'] },
    { prefixes: ['bot_'], command: 'bot', types: ['button', 'stringSelect'] },
    { prefixes: ['server_'], command: 'server', types: ['button', 'stringSelect'] },
    { prefixes: ['user_'], command: 'user', types: ['button', 'stringSelect', 'modal'] },
    { prefixes: ['analytics_'], command: 'analytics', types: ['button', 'stringSelect'] },
    { prefixes: ['setup-applications_'], command: 'setup-applications', types: ['button', 'stringSelect', 'channelSelect', 'modal'] },
    { prefixes: ['setup-autoresponders_'], command: 'setup-autoresponders', types: ['button', 'stringSelect', 'channelSelect', 'modal'] },
    { prefixes: ['setup-customcommands_'], command: 'setup-customcommands', types: ['button', 'stringSelect', 'modal'] },
    { prefixes: ['setup-birthday_'], command: 'setup-birthday', types: ['button', 'stringSelect', 'channelSelect', 'roleSelect', 'modal'] },
    { prefixes: ['manage-level_'], command: 'manage-level', types: ['button', 'stringSelect', 'userSelect', 'modal'] },
    { prefixes: ['level_'], command: 'level', types: ['button', 'stringSelect', 'modal'] },
    { prefixes: ['setup-hentai_'], command: 'setup-hentai', types: ['button'] },
    { prefixes: ['math-quiz_'], command: 'math-quiz', types: ['button', 'modal'] },
    { prefixes: ['afk_'], command: 'afk', types: ['button', 'stringSelect', 'modal'] },
    { prefixes: ['giveaway_'], command: 'setup-giveaway', fallback: '../handlers/giveawayHandler', types: ['button', 'modal'] },
    { prefixes: ['report_', 'add_note_', 'resolve_modal_', 'confirm_dismiss_', 'cancel_dismiss_', 'confirm_timeout_', 'cancel_timeout_', 'confirm_ban_', 'cancel_ban_'], command: 'report', fallback: '../handlers/reportHandler', types: ['button', 'modal'] },
    { prefixes: ['modmail_', 'reply_modmail_', 'anon_reply_', 'priority_modmail_', 'close_modmail_', 'user_close_', 'reply_modal_', 'anon_modal_', 'note_modal_', 'close_modal_', 'priority_select_', 'add_modmail_note_'], command: 'setup-modmail', fallback: '../handlers/modMailHandler', types: ['button', 'stringSelect', 'modal'] },
    { prefixes: ['worldclock_'], commands: ['world-clock', 'worldclock'], types: ['button', 'stringSelect'] },
    { prefixes: ['text_'], command: 'text', types: ['button', 'stringSelect'] },
    { prefixes: ['emojis_'], command: 'emojis', types: ['button', 'stringSelect'] },
    { prefixes: ['time_'], command: 'time', types: ['button', 'stringSelect'] },
    { prefixes: ['pwd_'], command: 'password', types: ['button', 'stringSelect'] },
    { prefixes: ['qr_'], command: 'qrgenerator', types: ['button', 'stringSelect', 'modal'] }
]);

const registeredRoutesByClient = new WeakMap();
const interactionObserversByClient = new WeakMap();

function matchesType(interaction, types) {
    return types.some(type => {
        const method = COMPONENT_METHODS[type];
        return method && typeof interaction[method] === 'function' && interaction[method]();
    });
}

function resolveComponentRoute(customId, interactionKind) {
    if (typeof customId !== 'string' || !interactionKind) return null;
    return COMPONENT_ROUTES.find(route => route.types.includes(interactionKind) && route.prefixes.some(prefix => customId.startsWith(prefix))) || null;
}

async function acknowledgeUnavailable(interaction) {
    if (interaction.deferred || interaction.replied) return;
    try {
        await interaction.reply({
            content: 'This interaction is unavailable. Please run the command again.',
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        if (error.code !== 10062 && !error.message?.includes('already been acknowledged')) {
            console.error('[InteractionRouter] Could not acknowledge an unavailable component interaction:', error.message);
        }
    }
}

async function acknowledgeUnroutedModal(interaction) {
    if (!interaction?.isModalSubmit?.() || interaction.deferred || interaction.replied) return false;
    await acknowledgeUnavailable(interaction);
    return true;
}

async function acknowledgeRouteFailure(interaction) {
    const content = 'This interaction could not be completed. Please try again.';
    if (!interaction.deferred && !interaction.replied) {
        return acknowledgeUnavailable(interaction);
    }
    if (interaction.deferred && interaction.ephemeral) {
        return interaction.editReply({ content }).catch(() => {});
    }
    return interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function runWithinAcknowledgementWindow(interaction, task, timeoutMessage, budgetMs = 1500) {
    if (typeof task !== 'function' || !Number.isFinite(budgetMs) || budgetMs <= 0) {
        throw new TypeError('A task and positive acknowledgement budget are required.');
    }

    let timeoutId;
    const timeoutResult = new Promise(resolve => {
        timeoutId = setTimeout(() => resolve({ completed: false }), budgetMs);
    });
    try {
        const result = await Promise.race([
            Promise.resolve().then(task).then(value => ({ completed: true, value })),
            timeoutResult
        ]);
        if (!result.completed && !interaction.deferred && !interaction.replied) {
            await interaction.reply({ content: timeoutMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return result;
    } finally {
        clearTimeout(timeoutId);
    }
}

function registerInteractionHandler(client, { name, prefixes, types, excludeCustomIds = [], handler }) {
    if (!client || (typeof client !== 'object' && typeof client !== 'function')) {
        throw new TypeError('An initialized Discord client is required to register an interaction route.');
    }
    if (!name || !Array.isArray(prefixes) || !prefixes.length || prefixes.some(prefix => typeof prefix !== 'string' || !prefix) ||
        !Array.isArray(types) || !types.length || typeof handler !== 'function') {
        throw new TypeError('Interaction route requires a name, prefixes, types, and handler.');
    }
    const invalidType = types.find(type => !COMPONENT_METHODS[type]);
    if (invalidType) throw new TypeError('Unsupported interaction type "' + invalidType + '" for route "' + name + '".');

    let routes = registeredRoutesByClient.get(client);
    if (!routes) {
        routes = [];
        registeredRoutesByClient.set(client, routes);
    }
    if (routes.some(route => route.name === name)) {
        throw new Error('Interaction route "' + name + '" is already registered for this client.');
    }
    for (const prefix of prefixes) {
        const duplicate = routes.find(route => route.types.some(type => types.includes(type)) && route.prefixes.includes(prefix));
        if (duplicate) throw new Error('Interaction prefix "' + prefix + '" is already owned by route "' + duplicate.name + '".');
    }

    if (!Array.isArray(excludeCustomIds) || excludeCustomIds.some(customId => typeof customId !== 'string' || !customId)) {
        throw new TypeError('excludeCustomIds must contain only non-empty strings for route "' + name + '".');
    }
    const route = { name, prefixes: [...prefixes], types: [...types], excludeCustomIds: new Set(excludeCustomIds), handler };
    routes.push(route);
    routes.sort((a, b) => Math.max(...b.prefixes.map(x => x.length)) - Math.max(...a.prefixes.map(x => x.length)));

    return () => {
        const current = registeredRoutesByClient.get(client);
        if (!current) return;
        const index = current.indexOf(route);
        if (index !== -1) current.splice(index, 1);
        if (!current.length) registeredRoutesByClient.delete(client);
    };
}

function registerInteractionObserver(client, name, handler) {
    if (!client || typeof name !== 'string' || !name || typeof handler !== 'function') {
        throw new TypeError('Interaction observer requires an initialized client, a name, and a handler.');
    }
    let observers = interactionObserversByClient.get(client);
    if (!observers) {
        observers = new Map();
        interactionObserversByClient.set(client, observers);
    }
    if (observers.has(name)) throw new Error('Interaction observer "' + name + '" is already registered for this client.');
    observers.set(name, handler);
    return () => {
        const current = interactionObserversByClient.get(client);
        current?.delete(name);
        if (current && !current.size) interactionObserversByClient.delete(client);
    };
}

function dispatchInteractionObservers(interaction, client) {
    const observers = interactionObserversByClient.get(client);
    if (!observers) return;
    for (const [name, observer] of observers) {
        Promise.resolve()
            .then(() => observer(interaction))
            .catch(error => console.error('[InteractionRouter] Observer "' + name + '" failed:', error));
    }
}

async function dispatchRegisteredRoute(interaction, client, interactionKind) {
    const routes = registeredRoutesByClient.get(client) || [];
    const route = routes.find(candidate =>
        candidate.types.includes(interactionKind) &&
        !candidate.excludeCustomIds.has(interaction.customId) &&
        candidate.prefixes.some(prefix => interaction.customId?.startsWith(prefix))
    );
    if (!route) return false;

    const startedAt = performance.now();
    let failed = false;
    try {
        await guardedInteractionHandler(interaction, route.name, () => route.handler(interaction), error => { throw error; });
        if (!interaction.deferred && !interaction.replied) await acknowledgeUnavailable(interaction);
    } catch (error) {
        failed = true;
        console.error('[InteractionRouter] Route "' + route.name + '" failed:', error);
        await acknowledgeRouteFailure(interaction);
    } finally {
        recordInteractionDuration(route.name, `component_${interactionKind}`, performance.now() - startedAt, failed);
    }
    return true;
}

async function dispatchComponentRoute(interaction, client) {
    const kind = Object.entries(COMPONENT_METHODS).find(([, method]) =>
        typeof interaction[method] === 'function' && interaction[method]()
    )?.[0];
    if (!kind) return false;

    const route = resolveComponentRoute(interaction.customId, kind);
    if (!route) return dispatchRegisteredRoute(interaction, client, kind);

    const commands = route.commands || [route.command];
    const command = commands.map(name => client.commands?.get(name)).find(Boolean);
    if (command?.handleComponent) {
        const feature = command.data?.name || route.command || route.commands?.join(',') || 'command';
        if (!isCommandCategoryEnabled(command, categories)) {
            await acknowledgeUnavailable(interaction);
            return true;
        }
        const startedAt = performance.now();
        let failed = false;
        try {
            await guardedInteractionHandler(interaction, feature, () => command.handleComponent(interaction), error => { throw error; });
            if (!interaction.deferred && !interaction.replied) await acknowledgeUnavailable(interaction);
        } catch (error) {
            failed = true;
            console.error('[InteractionRouter] Command route "' + (command.data?.name || route.command || route.commands?.join(',')) + '" failed:', error);
            await acknowledgeRouteFailure(interaction);
        } finally {
            recordInteractionDuration(feature, `component_${kind}`, performance.now() - startedAt, failed);
        }
        return true;
    }

    if (route.fallback) {
        const fallback = require(route.fallback);
        if (typeof fallback.handleComponent === 'function') {
            const startedAt = performance.now();
            let failed = false;
            try {
                await guardedInteractionHandler(interaction, route.fallback, () => fallback.handleComponent(interaction), error => { throw error; });
                if (!interaction.deferred && !interaction.replied) await acknowledgeUnavailable(interaction);
            } catch (error) {
                failed = true;
                console.error('[InteractionRouter] Fallback route "' + route.fallback + '" failed:', error);
                await acknowledgeRouteFailure(interaction);
            } finally {
                recordInteractionDuration(route.fallback, `component_${kind}`, performance.now() - startedAt, failed);
            }
            return true;
        }
    }

    await acknowledgeUnavailable(interaction);
    return true;
}

module.exports = {
    COMPONENT_ROUTES,
    resolveComponentRoute,
    dispatchComponentRoute,
    dispatchRegisteredRoute,
    registerInteractionHandler,
    registerInteractionObserver,
    dispatchInteractionObservers,
    runWithinAcknowledgementWindow,
    acknowledgeUnavailable,
    acknowledgeUnroutedModal,
    acknowledgeRouteFailure,
    matchesType
};
