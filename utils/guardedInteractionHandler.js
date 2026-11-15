'use strict';

const { MessageFlags } = require('discord.js');

function interactionIdentity(interaction) {
    let type = 'interaction';
    if (interaction?.isAutocomplete?.()) type = 'autocomplete';
    else if (interaction?.isModalSubmit?.()) type = 'modal';
    else if (interaction?.isButton?.()) type = 'button';
    else if (interaction?.isStringSelectMenu?.()) type = 'string-select';
    else if (interaction?.isUserSelectMenu?.()) type = 'user-select';
    else if (interaction?.isRoleSelectMenu?.()) type = 'role-select';
    else if (interaction?.isChannelSelectMenu?.()) type = 'channel-select';
    else if (interaction?.isMentionableSelectMenu?.()) type = 'mentionable-select';
    else if (interaction?.isChatInputCommand?.() || interaction?.isCommand?.()) type = 'command';
    const id = interaction?.customId || interaction?.commandName || 'unknown';
    return `[Interaction] ${type} ${id} ${interaction?.guildId || interaction?.guild?.id || 'DM'} ${interaction?.user?.id || 'unknown-user'}`;
}

async function replyAfterFailure(interaction) {
    if (interaction?.isAutocomplete?.()) {
        if (!interaction.responded) await interaction.respond([]).catch(() => {});
        return;
    }
    if (!interaction?.isRepliable?.()) return;
    const payload = { content: 'Something went wrong while processing this interaction. Please try again.', flags: MessageFlags.Ephemeral };
    try {
        if (!interaction.deferred && !interaction.replied) await interaction.reply(payload);
        else if (interaction.deferred && !interaction.replied && interaction.isModalSubmit?.()) await interaction.editReply(payload);
        else await interaction.followUp(payload);
    } catch (replyError) {
        if (![10062, 10008, 40060].includes(replyError?.code)) console.error('[Interaction] Could not send failure response:', replyError?.message || replyError);
    }
}

async function guardedInteractionHandler(interaction, label, handler, onError) {
    try {
        return await handler();
    } catch (error) {
        console.error(`${interactionIdentity(interaction)} (${label})`, error);
        if (typeof onError === 'function') {
            await onError(error);
            return undefined;
        }
        await replyAfterFailure(interaction);
        return undefined;
    }
}

module.exports = { guardedInteractionHandler, interactionIdentity, replyAfterFailure };
