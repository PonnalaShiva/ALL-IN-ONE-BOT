const { getLogConfig } = require('../utils/cacheHelpers');
const LeaveSettings = require('../models/leave/LeaveSettings');
const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const logHandlersIcons = require('../UI/icons/loghandlers');
const { WelcomeCardGenerator } = require('../UI/WelcomeCardGenerator');

function replacePlaceholders(text, member, guild, memberCount) {
    if (!text) return text;

    const joinDate = member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>` : 'Unknown';
    const leaveDate = `<t:${Math.floor(Date.now() / 1000)}:F>`;
    const accountCreated = member.user?.createdAt ? `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:F>` : 'Unknown';

    let timeInGuild = 'Unknown';
    if (member.joinedAt) {
        const timeInMs = Date.now() - member.joinedAt.getTime();
        const days = Math.floor(timeInMs / (1000 * 60 * 60 * 24));
        timeInGuild = `${days} days`;
    }

    return text
        .replace(/{member}/g, `<@${member.id}>`)
        .replace(/{username}/g, member.user?.username || 'Unknown')
        .replace(/{servername}/g, guild.name)
        .replace(/{membercount}/g, memberCount.toString())
        .replace(/{joindate}/g, joinDate)
        .replace(/{leavedate}/g, leaveDate)
        .replace(/{accountcreated}/g, accountCreated)
        .replace(/{timeinguild}/g, timeInGuild);
}

function truncateUsername(username, maxLength = 15) {
    if (!username) return '';
    return username.length > maxLength ? username.slice(0, maxLength - 3) + '...' : username;
}

async function createLeaveChannelEmbed(member, leaveSettings) {
    const guild = member.guild;
    const memberCount = guild.memberCount;
    const config = leaveSettings.channelEmbed || {};
    const user = member.user;
    const username = truncateUsername(user?.username || 'Unknown', 15);
    const serverName = guild.name;
    const avatarURL = member.user?.displayAvatarURL({ dynamic: true, size: 256 });

    const cardTitle = config.title ? replacePlaceholders(config.title, member, guild, memberCount) : undefined;
    const cardDesc = config.description ? replacePlaceholders(config.description, member, guild, memberCount) : `${user?.username || 'Member'} has left the server.`;
    const footerText = config.footer?.text ? replacePlaceholders(config.footer.text, member, guild, memberCount) : undefined;

    let attachment = null;
    let bannerURL = (!config.image?.useWcard && config.image?.customURL) ? config.image.customURL : undefined;

    if (config.image?.useWcard) {
        try {
            const cardGen = new WelcomeCardGenerator();
            const cardBuffer = await cardGen.generate({
                username,
                serverName,
                memberCount,
                avatarURL,
                isLeave: true
            });
            attachment = new AttachmentBuilder(cardBuffer, { name: 'leave.png' });
        } catch (customCardError) {
            console.error('[MemberLeaveHandler] Error generating leave card:', customCardError);
            if (config.image?.customURL) {
                bannerURL = config.image.customURL;
            }
        }
    }

    const card = buildCard({
        title: cardTitle,
        description: cardDesc,
        bannerURL,
        footer: footerText,
        accentColor: config.color ? parseInt(String(config.color).replace('#', ''), 16) : undefined
    });

    return { card, attachment };
}

function createLeaveDMEmbed(member, leaveSettings) {
    const guild = member.guild;
    const memberCount = guild.memberCount;
    const config = leaveSettings.dmEmbed || {};

    const cardTitle = config.title ? replacePlaceholders(config.title, member, guild, memberCount) : undefined;
    const cardDesc = config.description ? replacePlaceholders(config.description, member, guild, memberCount) : `Goodbye from ${guild.name}!`;
    const footerText = config.footer?.text ? replacePlaceholders(config.footer.text, member, guild, memberCount) : undefined;

    return buildCard({
        title: cardTitle,
        description: cardDesc,
        bannerURL: config.image?.customURL || undefined,
        footer: footerText,
        accentColor: config.color ? parseInt(String(config.color).replace('#', ''), 16) : undefined
    });
}

module.exports = async function memberLeaveHandler(client) {
    client.on('guildMemberRemove', async (member) => {
        if (!member?.guild) return;
        const guildId = member.guild.id;

        
        const config = await getLogConfig(guildId, 'memberLeave');
        if (config?.channelId) {
            const logChannel = client.channels.cache.get(config.channelId)
                || await client.channels.fetch(config.channelId).catch(() => null);
            if (logChannel) {
                const lang = loadLanguage(guildId);
                const s = lang?.serverlogs || {};

                
                let timeInGuild = s.unknown || 'Unknown';
                if (member.joinedAt) {
                    const timeInMs = Date.now() - member.joinedAt.getTime();
                    const days = Math.floor(timeInMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    timeInGuild = `${days} days, ${hours} hours`;
                }

                
                const rolesList = member.roles?.cache
                    ? (typeof member.roles.cache.filter === 'function'
                        ? member.roles.cache.filter(r => r.id !== guildId).map(r => `<@&${r.id}>`)
                        : Array.from(member.roles.cache.values()).filter(r => r.id !== guildId).map(r => `<@&${r.id}>`))
                    : [];
                const rolesText = rolesList.length > 0
                    ? (rolesList.length > 10 ? `${rolesList.slice(0, 10).join(', ')} (+${rolesList.length - 10} more)` : rolesList.join(', '))
                    : `*${s.none || 'None'}*`;

                const userAvatar = member.user?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.leaveIcon;

                const card = buildCard({
                    title: `${getEmoji('user')} ${s.memberLeftTitle || 'Member Left'}`,
                    accentColor: ACCENT.danger,
                    thumbnailURL: userAvatar,
                    sections: [
                        `> **${s.memberLeftDesc || 'Member Departed'}**\n\n• **${s.memberLabel || 'Member'}:** ${member.user ? `<@${member.id}> (${member.user.tag || member.user.username})` : `\`${member.id}\``}\n• **${s.userIdLabel || 'User ID'}:** \`${member.id}\`\n• **${s.remainingMembersLabel || 'Remaining Members'}:** \`${member.guild?.memberCount?.toLocaleString() || (s.unknown || 'Unknown')}\``,
                        `### ${getEmoji('settings')} ${s.membershipHeader || 'Membership & Role History'}\n• **${s.joinedServerLabel || 'Joined Server'}:** ${member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : `\`${s.unknown || 'Unknown'}\``}\n• **${s.timeInServerLabel || 'Time in Server'}:** \`${timeInGuild}\`\n• **${s.rolesHeldLabel || 'Roles Held'}:**\n${rolesText}\n\n• **${s.deletedLabel || 'Departed At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
                    ],
                    footer: (s.footers?.memberLogs || 'Member Logs • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
                });

                try {
                    await logChannel.send({
                        components: [card],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(err => {
                        console.error('[MemberLeaveHandler] Error sending log:', err);
                    });
                } catch (error) {
                    console.warn(`[ERROR] Failed to send log message:`, error.message);
                }
            }
        }

        
        try {
            const leaveSettings = await LeaveSettings.findOne({ serverId: guildId });

            if (!leaveSettings) return; 

            
            if (leaveSettings.channelStatus && leaveSettings.leaveChannelId) {
                const channel = member.guild.channels.cache.get(leaveSettings.leaveChannelId);
                if (channel) {
                    try {
                        const { card, attachment } = await createLeaveChannelEmbed(member, leaveSettings);
                        const sendOpts = { components: [card], flags: MessageFlags.IsComponentsV2 };
                        if (attachment) sendOpts.files = [attachment];
                        await channel.send(sendOpts);
                    } catch (error) {
                        console.warn(`[ERROR] Failed to send leave message to channel:`, error.message);
                    }
                }
            }

            
            if (leaveSettings.dmStatus) {
                try {
                    const dmCard = createLeaveDMEmbed(member, leaveSettings);
                    await member.user.send({ components: [dmCard], flags: MessageFlags.IsComponentsV2 });
                } catch (error) {
                    console.warn(`[ERROR] Failed to send leave DM to ${member.user?.tag}:`, error.message);
                }
            }

        } catch (error) {
            console.error('[ERROR] Error in leave system:', error);
        }
    });
};
