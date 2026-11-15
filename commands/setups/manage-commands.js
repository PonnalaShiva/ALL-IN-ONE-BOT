


'use strict';

const { SlashCommandBuilder } = require('discord.js');
const DisabledCommand = require('../../models/commands/DisabledCommands');
const checkPermissions = require('../../utils/checkPermissions');
const config = require('../../config.js');
const { invalidateDisabledCommands } = require('../../utils/cacheHelpers');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        managecommands: createInterpolatableProxy(rawLang.setups?.managecommands),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-commands')
        .setDescription('Enable, disable, or view command statuses')
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable a command')
                .addStringOption(opt =>
                    opt.setName('command')
                        .setDescription('Name of the command')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('subcommand')
                        .setDescription('Optional subcommand name')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View disabled commands in this server')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.managecommands.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'toggle') {
            const commandName = interaction.options.getString('command');
            const subcommandName = interaction.options.getString('subcommand');
            const guildId = interaction.guild.id;
            const fullCmdName = `${commandName}${subcommandName ? ` ${subcommandName}` : ''}`;

            const existing = await DisabledCommand.findOne({ guildId, commandName, subcommandName });
            if (existing) {
                await existing.deleteOne();
                invalidateDisabledCommands(guildId);

                const card = cards.success(
                    lang.setups.managecommands.title,
                    lang.setups.managecommands.enabled({ command: fullCmdName })
                );
                return sendV2(interaction, card);
            } else {
                await DisabledCommand.create({ guildId, commandName, subcommandName });
                invalidateDisabledCommands(guildId);

                const card = cards.warning(
                    lang.setups.managecommands.title,
                    lang.setups.managecommands.disabled({ command: fullCmdName })
                );
                return sendV2(interaction, card);
            }
        }

        if (subcommand === 'view') {
            const disabled = await DisabledCommand.find({ guildId: interaction.guild.id });

            const formatted = disabled.map(cmd =>
                `• \`/${cmd.commandName}${cmd.subcommandName ? ` ${cmd.subcommandName}` : ''}\``
            );

            const card = buildCard({ accent: ACCENT.info })
                .addText(`**${lang.setups.managecommands.title}**`)
                .addSeparator();

            if (formatted.length === 0) {
                card.addText(`**${lang.setups.managecommands.disabledTitle}:** ${lang.setups.managecommands.noDisabled}`);
            } else {
                card.addText(`**${lang.setups.managecommands.disabledTitle}:**\n${formatted.join('\n')}`);
            }

            const excessKeys = Object.keys(config.excessCommands || {});
            const loadedExcess = excessKeys.filter(k => config.excessCommands[k]);
            const unloadedExcess = excessKeys.filter(k => !config.excessCommands[k]);

            const categoryKeys = Object.keys(config.categories || {});
            const loadedCats = categoryKeys.filter(k => config.categories[k]);
            const unloadedCats = categoryKeys.filter(k => !config.categories[k]);

            card.addSeparator()
                .addText(
                    `**${lang.setups.managecommands.excessFoldersTitle}:**\n` +
                    `• ${lang.setups.managecommands.loadedLabel}: ${loadedExcess.join(', ') || lang.setups.managecommands.none}\n` +
                    `• ${lang.setups.managecommands.unloadedLabel}: ${unloadedExcess.join(', ') || lang.setups.managecommands.none}\n\n` +
                    `**${lang.setups.managecommands.categoriesTitle}:**\n` +
                    `• ${lang.setups.managecommands.loadedLabel}: ${loadedCats.join(', ') || lang.setups.managecommands.none}\n` +
                    `• ${lang.setups.managecommands.unloadedLabel}: ${unloadedCats.join(', ') || lang.setups.managecommands.none}`
                );

            return sendV2(interaction, card);
        }
    }
};