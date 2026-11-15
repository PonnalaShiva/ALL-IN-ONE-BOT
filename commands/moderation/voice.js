


'use strict';

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    PermissionsBitField
} = require('discord.js');
const checkPermissions = require('../../utils/checkPermissions');
const { canModerateMember } = require('../../utils/moderationPermissionPolicy');
const {
    getRequiredVoicePermission,
    hasVoiceActionPermission
} = require('../../utils/voicePermissionPolicy');
const { 
    buildCard, 
    cards, 
    sendV2, 
    deferReply, 
    ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    moderation: {
        ...rawLang.moderation,
        voice: createInterpolatableProxy(rawLang.moderation?.voice),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice-mod')
        .setDescription('Voice channel moderation commands')
        .setDefaultMemberPermissions(null)

        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('Disconnect user from voice')
                .addUserOption(opt => opt.setName('user').setDescription('User to disconnect').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for disconnect')))

        .addSubcommand(sub =>
            sub.setName('move')
                .setDescription('Move user to another voice channel')
                .addUserOption(opt => opt.setName('user').setDescription('User to move').setRequired(true))
                .addChannelOption(opt => opt.setName('channel').setDescription('Target voice channel').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for move')))

        .addSubcommand(sub =>
            sub.setName('mute')
                .setDescription('Server mute user in voice')
                .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for mute')))

        .addSubcommand(sub =>
            sub.setName('unmute')
                .setDescription('Unmute user in voice')
                .addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('deafen')
                .setDescription('Server deafen user')
                .addUserOption(opt => opt.setName('user').setDescription('User to deafen').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for deafen')))

        .addSubcommand(sub =>
            sub.setName('undeafen')
                .setDescription('Undeafen user')
                .addUserOption(opt => opt.setName('user').setDescription('User to undeafen').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('mass-disconnect')
                .setDescription('Disconnect all users from a voice channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason')))

        .addSubcommand(sub =>
            sub.setName('mass-move')
                .setDescription('Move all users from one channel to another')
                .addChannelOption(opt => opt.setName('from').setDescription('Source channel').setRequired(true))
                .addChannelOption(opt => opt.setName('to').setDescription('Target channel').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('mass-mute')
                .setDescription('Mute all users in a voice channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason')))

        .addSubcommand(sub =>
            sub.setName('mass-unmute')
                .setDescription('Unmute all users in a voice channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('mass-deafen')
                .setDescription('Deafen all users in a voice channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('mass-undeafen')
                .setDescription('Undeafen all users in a voice channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all users in voice channels'))

        .addSubcommand(sub =>
            sub.setName('channel-info')
                .setDescription('Get info about a voice channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('user-info')
                .setDescription('Get user voice state')
                .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('hide')
                .setDescription('Hide voice channel from user')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true))
                .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('unhide')
                .setDescription('Unhide voice channel for user')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true))
                .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('lock')
                .setDescription('Lock voice channel (no one can join)')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('unlock')
                .setDescription('Unlock voice channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('limit')
                .setDescription('Set user limit for voice channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel').setRequired(true))
                .addIntegerOption(opt => opt.setName('limit').setDescription('User limit (0 = unlimited)').setMinValue(0).setMaxValue(99).setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('empty')
                .setDescription('List empty voice channels'))

        .addSubcommand(sub =>
            sub.setName('stage-speaker')
                .setDescription('Make user speaker in stage channel')
                .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('stage-audience')
                .setDescription('Move user to audience in stage')
                .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))

        .addSubcommand(sub =>
            sub.setName('pull')
                .setDescription('Pull yourself into a user\'s voice channel')
                .addUserOption(opt => opt.setName('user').setDescription('User to pull to').setRequired(true))),

    async execute(interaction) {
        await deferReply(interaction);
        if (!await checkPermissions(interaction, 'moderator')) return;

        const subcommand = interaction.options.getSubcommand();

        if (!hasVoiceActionPermission(subcommand, interaction.member?.permissions)) {
            const requiredPermission = getRequiredVoicePermission(subcommand);
            return this.sendError(
                interaction,
                `You need the ${new PermissionsBitField(requiredPermission).toArray().join(', ')} permission for this action.`
            );
        }

        try {
            switch (subcommand) {
                case 'kick':
                    return await this.handleKick(interaction);
                case 'move':
                    return await this.handleMove(interaction);
                case 'mute':
                    return await this.handleMute(interaction);
                case 'unmute':
                    return await this.handleUnmute(interaction);
                case 'deafen':
                    return await this.handleDeafen(interaction);
                case 'undeafen':
                    return await this.handleUndeafen(interaction);
                case 'mass-disconnect':
                    return await this.handleMassDisconnect(interaction);
                case 'mass-move':
                    return await this.handleMassMove(interaction);
                case 'mass-mute':
                    return await this.handleMassMute(interaction);
                case 'mass-unmute':
                    return await this.handleMassUnmute(interaction);
                case 'mass-deafen':
                    return await this.handleMassDeafen(interaction);
                case 'mass-undeafen':
                    return await this.handleMassUndeafen(interaction);
                case 'list':
                    return await this.handleList(interaction);
                case 'channel-info':
                    return await this.handleChannelInfo(interaction);
                case 'user-info':
                    return await this.handleUserInfo(interaction);
                case 'hide':
                    return await this.handleHide(interaction);
                case 'unhide':
                    return await this.handleUnhide(interaction);
                case 'lock':
                    return await this.handleLock(interaction);
                case 'unlock':
                    return await this.handleUnlock(interaction);
                case 'limit':
                    return await this.handleLimit(interaction);
                case 'empty':
                    return await this.handleEmpty(interaction);
                case 'stage-speaker':
                    return await this.handleStageSpeaker(interaction);
                case 'stage-audience':
                    return await this.handleStageAudience(interaction);
                case 'pull':
                    return await this.handlePull(interaction);
            }
        } catch (error) {
            console.error('[Voice Mod Error]', error);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }
    },

    canModerateTarget(interaction, member) {
        return Boolean(
            member?.manageable &&
            canModerateMember(interaction.member, member, interaction.guild)
        );
    },

    denyTargetHierarchy(interaction) {
        return this.sendError(
            interaction,
            lang.moderation.voice.hierarchyError || 'You or the bot cannot manage a member with an equal or higher role.'
        );
    },

    async handleKick(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || lang.moderation.voice.noReason;

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!this.canModerateTarget(interaction, member)) return this.denyTargetHierarchy(interaction);

        if (!member.voice.channel) {
            return this.sendError(interaction, lang.moderation.voice.userNotInVoice);
        }

        const channelName = member.voice.channel.name;
        try {
            await member.voice.disconnect();
        } catch (err) {
            console.error('Failed to disconnect user:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.disconnectedTitle,
            body: lang.moderation.voice.disconnectedCard({
                user: user.tag,
                channel: channelName,
                reason,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleMove(interaction) {
        const user = interaction.options.getUser('user');
        const channel = interaction.options.getChannel('channel');
        const reason = interaction.options.getString('reason') || lang.moderation.voice.noReason;

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!this.canModerateTarget(interaction, member)) return this.denyTargetHierarchy(interaction);

        if (!member.voice.channel) {
            return this.sendError(interaction, lang.moderation.voice.userNotInVoice);
        }

        const oldChannel = member.voice.channel;
        try {
            await member.voice.setChannel(channel);
        } catch (err) {
            console.error('Failed to move user:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.movedTitle,
            body: lang.moderation.voice.movedCard({
                user: user.tag,
                from: oldChannel.name,
                to: channel.name,
                reason,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleMute(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || lang.moderation.voice.noReason;

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!this.canModerateTarget(interaction, member)) return this.denyTargetHierarchy(interaction);

        if (!member.voice.channel) {
            return this.sendError(interaction, lang.moderation.voice.userNotInVoice);
        }

        try {
            await member.voice.setMute(true);
        } catch (err) {
            console.error('Failed to mute user:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.mutedTitle,
            body: lang.moderation.voice.mutedCard({
                user: user.tag,
                channel: member.voice.channel.name,
                reason,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleUnmute(interaction) {
        const user = interaction.options.getUser('user');

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!this.canModerateTarget(interaction, member)) return this.denyTargetHierarchy(interaction);

        if (!member.voice.channel) {
            return this.sendError(interaction, lang.moderation.voice.userNotInVoice);
        }

        try {
            await member.voice.setMute(false);
        } catch (err) {
            console.error('Failed to unmute user:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.unmutedTitle,
            body: lang.moderation.voice.unmutedCard({
                user: user.tag,
                channel: member.voice.channel.name,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleDeafen(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || lang.moderation.voice.noReason;

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!this.canModerateTarget(interaction, member)) return this.denyTargetHierarchy(interaction);

        if (!member.voice.channel) {
            return this.sendError(interaction, lang.moderation.voice.userNotInVoice);
        }

        try {
            await member.voice.setDeaf(true);
        } catch (err) {
            console.error('Failed to deafen user:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.deafenedTitle,
            body: lang.moderation.voice.deafenedCard({
                user: user.tag,
                channel: member.voice.channel.name,
                reason,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleUndeafen(interaction) {
        const user = interaction.options.getUser('user');

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!this.canModerateTarget(interaction, member)) return this.denyTargetHierarchy(interaction);

        if (!member.voice.channel) {
            return this.sendError(interaction, lang.moderation.voice.userNotInVoice);
        }

        try {
            await member.voice.setDeaf(false);
        } catch (err) {
            console.error('Failed to undeafen user:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.undeafenedTitle,
            body: lang.moderation.voice.undeafenedCard({
                user: user.tag,
                channel: member.voice.channel.name,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleMassDisconnect(interaction) {
        const channel = interaction.options.getChannel('channel');
        const reason = interaction.options.getString('reason') || 'Mass disconnect';

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        const members = channel.members;
        if (members.size === 0) {
            return this.sendError(interaction, lang.moderation.voice.channelEmpty);
        }

        let count = 0;
        let failed = 0;
        let processed = 0;

        for (const [, member] of members) {
            if (!this.canModerateTarget(interaction, member)) {
                failed++;
                processed++;
                continue;
            }
            try {
                await member.voice.disconnect();
                count++;
            } catch (err) {
                console.error(`Failed to disconnect ${member.user.tag}:`, err);
                failed++;
            }
            processed++;

            if (processed % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.massDisconnectedTitle,
            body: lang.moderation.voice.massDisconnectedCard({
                channel: channel.name,
                count: String(count),
                reason,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleMassMove(interaction) {
        const fromChannel = interaction.options.getChannel('from');
        const toChannel = interaction.options.getChannel('to');

        if (!fromChannel.isVoiceBased() || !toChannel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        const members = fromChannel.members;
        if (members.size === 0) {
            return this.sendError(interaction, lang.moderation.voice.channelEmpty);
        }

        let count = 0;
        let failed = 0;
        let processed = 0;

        for (const [, member] of members) {
            if (!this.canModerateTarget(interaction, member)) {
                failed++;
                processed++;
                continue;
            }
            try {
                await member.voice.setChannel(toChannel);
                count++;
            } catch (err) {
                console.error(`Failed to move ${member.user.tag}:`, err);
                failed++;
            }
            processed++;

            if (processed % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.massMovedTitle,
            body: lang.moderation.voice.massMovedCard({
                from: fromChannel.name,
                to: toChannel.name,
                count: String(count),
                reason: 'Mass move',
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleMassMute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const reason = interaction.options.getString('reason') || 'Mass mute';

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        const members = channel.members;
        if (members.size === 0) {
            return this.sendError(interaction, lang.moderation.voice.channelEmpty);
        }

        let count = 0;
        let failed = 0;
        let processed = 0;
        const total = members.size;

        for (const [, member] of members) {
            if (!this.canModerateTarget(interaction, member)) {
                failed++;
                processed++;
                continue;
            }
            try {
                await member.voice.setMute(true);
                count++;
            } catch (err) {
                console.error(`Failed to mute ${member.user.tag}:`, err);
                failed++;
            }
            processed++;

            if (processed % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.massMutedTitle,
            body: lang.moderation.voice.massMutedCard({
                channel: channel.name,
                total: String(total),
                count: String(count),
                failed: String(failed),
                reason
            })
        });

        return sendV2(interaction, card);
    },

    async handleMassUnmute(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        const members = channel.members;
        if (members.size === 0) {
            return this.sendError(interaction, lang.moderation.voice.channelEmpty);
        }

        let count = 0;
        let failed = 0;
        let processed = 0;

        for (const [, member] of members) {
            if (!this.canModerateTarget(interaction, member)) {
                failed++;
                processed++;
                continue;
            }
            try {
                await member.voice.setMute(false);
                count++;
            } catch (err) {
                console.error(`Failed to unmute ${member.user.tag}:`, err);
                failed++;
            }
            processed++;

            if (processed % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.massUnmutedTitle,
            body: lang.moderation.voice.massUnmutedCard({
                channel: channel.name,
                count: String(count),
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleMassDeafen(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        const members = channel.members;
        if (members.size === 0) {
            return this.sendError(interaction, lang.moderation.voice.channelEmpty);
        }

        let count = 0;
        let failed = 0;
        let processed = 0;

        for (const [, member] of members) {
            if (!this.canModerateTarget(interaction, member)) {
                failed++;
                processed++;
                continue;
            }
            try {
                await member.voice.setDeaf(true);
                count++;
            } catch (err) {
                console.error(`Failed to deafen ${member.user.tag}:`, err);
                failed++;
            }
            processed++;

            if (processed % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.massDeafenedTitle,
            body: lang.moderation.voice.massDeafenedCard({
                channel: channel.name,
                count: String(count),
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleMassUndeafen(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        const members = channel.members;
        if (members.size === 0) {
            return this.sendError(interaction, lang.moderation.voice.channelEmpty);
        }

        let count = 0;
        let failed = 0;
        let processed = 0;

        for (const [, member] of members) {
            if (!this.canModerateTarget(interaction, member)) {
                failed++;
                processed++;
                continue;
            }
            try {
                await member.voice.setDeaf(false);
                count++;
            } catch (err) {
                console.error(`Failed to undeafen ${member.user.tag}:`, err);
                failed++;
            }
            processed++;

            if (processed % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.massUndeafenedTitle,
            body: lang.moderation.voice.massUndeafenedCard({
                channel: channel.name,
                count: String(count),
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleList(interaction) {
        const voiceChannels = interaction.guild.channels.cache.filter(c => c.isVoiceBased());
        let totalUsers = 0;
        const channelBlocks = [];

        for (const [, channel] of voiceChannels) {
            if (channel.members.size > 0) {
                const userList = channel.members.map(m => `• ${m.user.tag}`).join('\n');
                channelBlocks.push(`**${channel.name}** (${channel.members.size})\n${userList}`);
                totalUsers += channel.members.size;
            }
        }

        const body = totalUsers === 0
            ? lang.moderation.voice.listNoUsers
            : [
                `*${lang.moderation.voice.listSubtitle}*`,
                channelBlocks.join('\n\n'),
                lang.moderation.voice.listTotal({ count: totalUsers })
            ].join('\n\n');

        const card = buildCard({
            accent: ACCENT.info,
            title: lang.moderation.voice.listTitle,
            body
        });

        return sendV2(interaction, card);
    },

    async handleChannelInfo(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        const userLines = [];
        if (channel.members.size > 0) {
            userLines.push('\n**Connected Users:**');
            for (const [, m] of channel.members) {
                const status = [];
                if (m.voice.serverMute) status.push('Server Muted');
                if (m.voice.serverDeaf) status.push('Server Deafened');
                if (m.voice.selfMute) status.push('Self-Muted');
                if (m.voice.selfDeaf) status.push('Self-Deafened');
                if (m.voice.streaming) status.push('Streaming');
                if (m.voice.selfVideo) status.push('Video');

                userLines.push(`• ${m.user.tag}${status.length > 0 ? ` (${status.join(', ')})` : ''}`);
            }
        }

        const body = [
            `**Channel:** ${channel.name}`,
            `**Type:** ${channel.type === 2 ? 'Voice' : channel.type === 13 ? 'Stage' : 'Unknown'}`,
            `**Users:** ${channel.members.size}/${channel.userLimit || '∞'}`,
            `**Bitrate:** ${channel.bitrate ? `${channel.bitrate / 1000}kbps` : 'N/A'}`,
            `**Region:** ${channel.rtcRegion || 'Automatic'}`,
            `**ID:** \`${channel.id}\``,
            ...userLines
        ].join('\n');

        const card = buildCard({
            accent: ACCENT.info,
            title: channel.name,
            body
        });

        return sendV2(interaction, card);
    },

    async handleUserInfo(interaction) {
        const user = interaction.options.getUser('user');

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!member.voice.channel) {
            return this.sendError(interaction, lang.moderation.voice.userNotInVoice);
        }

        const voice = member.voice;
        const states = [];
        if (voice.serverMute) states.push('Server Muted');
        if (voice.serverDeaf) states.push('Server Deafened');
        if (voice.selfMute) states.push('Self Muted');
        if (voice.selfDeaf) states.push('Self Deafened');
        if (voice.streaming) states.push('Streaming');
        if (voice.selfVideo) states.push('Video On');

        const body = [
            `**User:** ${user.tag}`,
            `**Channel:** ${voice.channel.name}`,
            `**Status:** ${states.length > 0 ? states.join(', ') : 'Active'}`,
            `**Session ID:** \`${voice.sessionId || 'Unknown'}\``
        ].join('\n');

        const card = buildCard({
            accent: ACCENT.info,
            title: lang.moderation.voice.userInfoTitle,
            body,
            thumbnail: user.displayAvatarURL({ dynamic: true })
        });

        return sendV2(interaction, card);
    },

    async handleHide(interaction) {
        const channel = interaction.options.getChannel('channel');
        const user = interaction.options.getUser('user');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return this.sendError(interaction, lang.moderation.voice.manageChannelsRequired);
        }

        try {
            await channel.permissionOverwrites.create(user.id, {
                ViewChannel: false
            });
        } catch (err) {
            console.error('Failed to hide channel:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.hideTitle,
            body: lang.moderation.voice.hideCard({
                channel: channel.name,
                user: user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleUnhide(interaction) {
        const channel = interaction.options.getChannel('channel');
        const user = interaction.options.getUser('user');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return this.sendError(interaction, lang.moderation.voice.manageChannelsRequired);
        }

        try {
            await channel.permissionOverwrites.delete(user.id);
        } catch (err) {
            console.error('Failed to unhide channel:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.unhideTitle,
            body: lang.moderation.voice.unhideCard({
                channel: channel.name,
                user: user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleLock(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return this.sendError(interaction, lang.moderation.voice.manageChannelsRequired);
        }

        try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                Connect: false
            });
        } catch (err) {
            console.error('Failed to lock channel:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.lockTitle,
            body: lang.moderation.voice.lockCard({
                channel: channel.name,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleUnlock(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return this.sendError(interaction, lang.moderation.voice.manageChannelsRequired);
        }

        try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                Connect: null
            });
        } catch (err) {
            console.error('Failed to unlock channel:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.unlockTitle,
            body: lang.moderation.voice.unlockCard({
                channel: channel.name,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleLimit(interaction) {
        const channel = interaction.options.getChannel('channel');
        const limit = interaction.options.getInteger('limit');

        if (!channel.isVoiceBased()) {
            return this.sendError(interaction, lang.moderation.voice.targetMustBeVoice);
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return this.sendError(interaction, lang.moderation.voice.manageChannelsRequired);
        }

        try {
            await channel.setUserLimit(limit);
        } catch (err) {
            console.error('Failed to set user limit:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.info,
            title: lang.moderation.voice.limitTitle,
            body: lang.moderation.voice.limitCard({
                channel: channel.name,
                limit: limit === 0 ? 'Unlimited' : `${limit} users`,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    async handleEmpty(interaction) {
        const voiceChannels = interaction.guild.channels.cache.filter(c => c.isVoiceBased() && c.members.size === 0);
        const lines = [
            `**Count:** ${voiceChannels.size}`
        ];

        if (voiceChannels.size > 0) {
            lines.push('', voiceChannels.map(c => `• ${c.name}`).join('\n'));
        } else {
            lines.push('', lang.moderation.voice.emptyNoChannels);
        }

        const card = buildCard({
            accent: ACCENT.secondary || 0x95a5a6,
            title: lang.moderation.voice.emptyTitle,
            body: lines.join('\n')
        });

        return sendV2(interaction, card);
    },

    async handleStageSpeaker(interaction) {
        const user = interaction.options.getUser('user');

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!this.canModerateTarget(interaction, member)) return this.denyTargetHierarchy(interaction);

        if (!member.voice.channel || member.voice.channel.type !== 13) {
            return this.sendError(interaction, lang.moderation.voice.notInStage);
        }

        try {
            await member.voice.setSuppressed(false);
        } catch (err) {
            console.error('Failed to promote speaker:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.stageSpeakerTitle,
            body: lang.moderation.voice.stageSpeakerCard({
                user: user.tag,
                channel: member.voice.channel.name
            })
        });

        return sendV2(interaction, card);
    },

    async handleStageAudience(interaction) {
        const user = interaction.options.getUser('user');

        const member = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!this.canModerateTarget(interaction, member)) return this.denyTargetHierarchy(interaction);

        if (!member.voice.channel || member.voice.channel.type !== 13) {
            return this.sendError(interaction, lang.moderation.voice.notInStage);
        }

        try {
            await member.voice.setSuppressed(true);
        } catch (err) {
            console.error('Failed to move to audience:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.danger,
            title: lang.moderation.voice.stageAudienceTitle,
            body: lang.moderation.voice.stageAudienceCard({
                user: user.tag,
                channel: member.voice.channel.name
            })
        });

        return sendV2(interaction, card);
    },

    async handlePull(interaction) {
        const user = interaction.options.getUser('user');
        const moderator = interaction.member;

        const targetMember = interaction.guild.members.cache.get(user.id) || await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!targetMember) {
            return this.sendError(interaction, lang.moderation.voice.userNotFound);
        }

        if (!targetMember.voice.channel) {
            return this.sendError(interaction, lang.moderation.voice.userNotInVoice);
        }

        try {
            await moderator.voice.setChannel(targetMember.voice.channel, 'VC Mod: Pulled to user channel');
        } catch (err) {
            console.error('Failed to move moderator:', err);
            return this.sendError(interaction, lang.moderation.voice.operationFailed || 'The operation failed. Please try again.');
        }

        const card = buildCard({
            accent: ACCENT.success,
            title: lang.moderation.voice.pullTitle,
            body: lang.moderation.voice.pullCard({
                user: user.tag,
                channel: targetMember.voice.channel.name,
                moderator: interaction.user.tag
            })
        });

        return sendV2(interaction, card);
    },

    sendError(interaction, message) {
        const errorCard = cards.error(
            lang.moderation.voice.errorTitle,
            message
        );
        return sendV2(interaction, errorCard);
    }
};
