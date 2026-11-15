


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GeminiApiKey = require('../../models/ai/GeminiApiKey');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const checkPermissions = require('../../utils/checkPermissions');
const aiManager = require('../../utils/AIManager');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        ai: createInterpolatableProxy(rawLang.setups?.ai),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ai')
        .setDescription('Manage API keys for AI-powered detection')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a new API key')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('API key')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Friendly name for this key')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove an API key')
                .addStringOption(option =>
                    option.setName('key-id')
                        .setDescription('Key ID to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all API keys'))
        .addSubcommand(subcommand =>
            subcommand.setName('enable')
                .setDescription('Enable an API key')
                .addStringOption(option =>
                    option.setName('key-id')
                        .setDescription('Key ID to enable')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('disable')
                .setDescription('Disable an API key')
                .addStringOption(option =>
                    option.setName('key-id')
                        .setDescription('Key ID to disable')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('test')
                .setDescription('Test an API key')
                .addStringOption(option =>
                    option.setName('key-id')
                        .setDescription('Key ID to test (optional - tests all if empty)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('stats')
                .setDescription('View API key usage statistics'))
        .addSubcommand(subcommand =>
            subcommand.setName('unblock')
                .setDescription('Manually unblock an API key')
                .addStringOption(option =>
                    option.setName('key-id')
                        .setDescription('Key ID to unblock')
                        .setRequired(true))),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.ai.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        if (!interaction.guildId) {
            return sendV2(interaction, cards.error(lang.setups.ai.title, lang.setups.ai.serverOnly));
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'add':
                    return await this.handleAdd(interaction);
                case 'remove':
                    return await this.handleRemove(interaction);
                case 'list':
                    return await this.handleList(interaction);
                case 'enable':
                    return await this.handleEnable(interaction);
                case 'disable':
                    return await this.handleDisable(interaction);
                case 'test':
                    return await this.handleTest(interaction);
                case 'stats':
                    return await this.handleStats(interaction);
                case 'unblock':
                    return await this.handleUnblock(interaction);
            }
        } catch (error) {
            console.error('[Setup-AI] Error managing API keys:', error);
            return sendV2(interaction, cards.error(lang.setups.ai.title, lang.setups.ai.error));
        }
    },

    async handleAdd(interaction) {
        const serverId = interaction.guildId;
        const apiKey = interaction.options.getString('key').trim();
        const name = interaction.options.getString('name').trim();

        const existingKey = await GeminiApiKey.findOne({ apiKey, serverId });
        if (existingKey) {
            return sendV2(interaction, cards.error(lang.setups.ai.title, lang.setups.ai.alreadyExists));
        }

        const keyId = `GEMINI_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const testResult = await this.testApiKey(apiKey);

        if (!testResult.success) {
            return sendV2(interaction, cards.error(
                lang.setups.ai.title,
                lang.setups.ai.testFailed({ error: testResult.error })
            ));
        }

        const newKey = new GeminiApiKey({
            keyId,
            apiKey,
            serverId,
            name,
            addedBy: interaction.user.id,
            avgResponseTime: testResult.responseTime || 0
        });

        await newKey.save();
        await aiManager.updateServerKeyCache(serverId).catch(() => {});

        const card = buildCard({ accent: ACCENT.success })
            .addText(`**${lang.setups.ai.keyAddedTitle}**`)
            .addSeparator()
            .addText(lang.setups.ai.keyAddedSuccess)
            .addSeparator()
            .addText(
                `• **${lang.setups.ai.keyIdLabel}:** \`${keyId}\`\n` +
                `• **${lang.setups.ai.nameLabel}:** ${name}\n` +
                `• **${lang.setups.ai.statusLabel}:** ${lang.setups.ai.statusActive}\n` +
                `• **${lang.setups.ai.testResultLabel}:** ${lang.setups.ai.testSuccess({ time: testResult.responseTime })}`
            );

        return sendV2(interaction, card);
    },

    async handleRemove(interaction) {
        const serverId = interaction.guildId;
        const keyId = interaction.options.getString('key-id');
        const deleted = await GeminiApiKey.deleteOne({ keyId, serverId });

        if (deleted.deletedCount === 0) {
            return sendV2(interaction, cards.error(lang.setups.ai.title, lang.setups.ai.notFound));
        }

        await aiManager.updateServerKeyCache(serverId).catch(() => {});

        return sendV2(interaction, cards.success(
            lang.setups.ai.title,
            lang.setups.ai.removed({ keyId })
        ));
    },

    async handleList(interaction) {
        const serverId = interaction.guildId;
        const keys = await GeminiApiKey.find({ serverId }).sort({ addedAt: -1 });

        if (keys.length === 0) {
            return sendV2(interaction, cards.info(lang.setups.ai.title, lang.setups.ai.noKeys));
        }

        const activeCount = keys.filter(k => k.isActive && !k.isBlocked).length;
        const lines = keys.slice(0, 10).map(key => {
            const status = key.isBlocked ? lang.setups.ai.statusBlocked : key.isActive ? lang.setups.ai.statusActive : lang.setups.ai.statusDisabled;
            const successRate = key.totalRequests > 0
                ? `${Math.round((key.successfulRequests / key.totalRequests) * 100)}%`
                : 'N/A';
            return `• **${key.name}** (\`${key.keyId}\`)\n  Status: ${status} | Requests: ${key.totalRequests} | Rate: ${successRate}`;
        }).join('\n');

        const card = buildCard({ accent: ACCENT.info })
            .addText(`**${lang.setups.ai.keysListTitle}**`)
            .addSeparator()
            .addText(lang.setups.ai.keysListDesc({ total: keys.length, active: activeCount }))
            .addSeparator()
            .addText(lines);

        return sendV2(interaction, card);
    },

    async handleEnable(interaction) {
        const serverId = interaction.guildId;
        const keyId = interaction.options.getString('key-id');
        const key = await GeminiApiKey.findOne({ keyId, serverId });
        if (!key) {
            return sendV2(interaction, cards.error(lang.setups.ai.title, lang.setups.ai.notFound));
        }

        key.isActive = true;
        key.lastModifiedAt = new Date();
        await key.save();
        await aiManager.updateServerKeyCache(serverId).catch(() => {});

        return sendV2(interaction, cards.success(
            lang.setups.ai.title,
            lang.setups.ai.enabled({ name: key.name })
        ));
    },

    async handleDisable(interaction) {
        const serverId = interaction.guildId;
        const keyId = interaction.options.getString('key-id');
        const key = await GeminiApiKey.findOne({ keyId, serverId });
        if (!key) {
            return sendV2(interaction, cards.error(lang.setups.ai.title, lang.setups.ai.notFound));
        }

        key.isActive = false;
        key.lastModifiedAt = new Date();
        await key.save();
        await aiManager.updateServerKeyCache(serverId).catch(() => {});

        return sendV2(interaction, cards.warning(
            lang.setups.ai.title,
            lang.setups.ai.disabled({ name: key.name })
        ));
    },

    async handleTest(interaction) {
        const serverId = interaction.guildId;
        const keyId = interaction.options.getString('key-id');

        let keysToTest;
        if (keyId) {
            const key = await GeminiApiKey.findOne({ keyId, serverId });
            if (!key) {
                return sendV2(interaction, cards.error(lang.setups.ai.title, lang.setups.ai.notFound));
            }
            keysToTest = [key];
        } else {
            keysToTest = await GeminiApiKey.find({ serverId, isActive: true, isBlocked: false });
            if (keysToTest.length === 0) {
                return sendV2(interaction, cards.info(lang.setups.ai.title, lang.setups.ai.noActiveKeysToTest));
            }
        }

        const lines = [];
        for (const key of keysToTest.slice(0, 5)) {
            const result = await this.testApiKey(key.apiKey);
            const status = result.success ? 'Success' : 'Failed';
            const details = result.success
                ? `Response time: ${result.responseTime}ms`
                : `Error: ${result.error}`;

            lines.push(`• **${key.name}** (\`${key.keyId}\`): ${status}\n  ${details}`);

            if (result.success) {
                key.lastUsedAt = new Date();
                key.avgResponseTime = Math.round((key.avgResponseTime + result.responseTime) / 2);
            } else {
                key.lastErrorAt = new Date();
                key.lastErrorMessage = result.error;
            }
            await key.save();
        }

        await aiManager.updateServerKeyCache(serverId).catch(() => {});

        const card = buildCard({ accent: ACCENT.warning })
            .addText(`**${lang.setups.ai.testResultsTitle}**`)
            .addSeparator()
            .addText(lines.join('\n'));

        return sendV2(interaction, card);
    },

    async handleStats(interaction) {
        const serverId = interaction.guildId;
        const keys = await GeminiApiKey.find({ serverId });

        if (keys.length === 0) {
            return sendV2(interaction, cards.info(lang.setups.ai.title, lang.setups.ai.noKeys));
        }

        const totalRequests = keys.reduce((sum, key) => sum + key.totalRequests, 0);
        const totalSuccessful = keys.reduce((sum, key) => sum + key.successfulRequests, 0);
        const activeKeys = keys.filter(k => k.isActive && !k.isBlocked).length;
        const blockedKeys = keys.filter(k => k.isBlocked).length;

        const successRate = totalRequests > 0
            ? Math.round((totalSuccessful / totalRequests) * 100)
            : 0;

        const card = buildCard({ accent: ACCENT.info })
            .addText(`**${lang.setups.ai.statsTitle}**`)
            .addSeparator()
            .addText(
                `• **${lang.setups.ai.totalKeysLabel}:** ${keys.length}\n` +
                `• **${lang.setups.ai.activeKeysLabel}:** ${activeKeys}\n` +
                `• **${lang.setups.ai.blockedKeysLabel}:** ${blockedKeys}\n` +
                `• **${lang.setups.ai.totalRequestsLabel}:** ${totalRequests.toLocaleString()}\n` +
                `• **${lang.setups.ai.successfulRequestsLabel}:** ${totalSuccessful.toLocaleString()}\n` +
                `• **${lang.setups.ai.successRateLabel}:** ${successRate}%`
            );

        return sendV2(interaction, card);
    },

    async handleUnblock(interaction) {
        const serverId = interaction.guildId;
        const keyId = interaction.options.getString('key-id');
        const key = await GeminiApiKey.findOne({ keyId, serverId });
        if (!key) {
            return sendV2(interaction, cards.error(lang.setups.ai.title, lang.setups.ai.notFound));
        }

        key.isBlocked = false;
        key.blockedUntil = null;
        key.blockedReason = null;
        key.lastModifiedAt = new Date();
        await key.save();
        await aiManager.updateServerKeyCache(serverId).catch(() => {});

        return sendV2(interaction, cards.success(
            lang.setups.ai.title,
            lang.setups.ai.unblocked({ name: key.name })
        ));
    },

    async testApiKey(apiKey) {
        try {
            const startTime = Date.now();
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

            const result = await Promise.race([
                model.generateContent("Test message: respond with 'OK'"),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 10000)
                )
            ]);

            const responseTime = Date.now() - startTime;
            const response = await result.response;

            return {
                success: true,
                responseTime,
                response: response.text()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};
