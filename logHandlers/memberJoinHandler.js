const { getLogConfig } = require('../utils/cacheHelpers');
const WelcomeSettings = require('../models/welcome/WelcomeSettings');
const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { WelcomeCardGenerator } = require('../UI/WelcomeCardGenerator');
const data = require('../UI/banners/welcomecards');
const InviteSettings = require('../models/inviteTracker/inviteSettings');
const Invite = require('../models/inviteTracker/invites');
const VerificationConfig = require('../models/gateVerification/verificationConfig');
const logHandlersIcons = require('../UI/icons/loghandlers');
const cacheManager = require('../utils/cacheManager');
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} = require('discord.js');

function getOrdinalSuffix(number) {
    if ([11, 12, 13].includes(number % 100)) return 'th';
    const lastDigit = number % 10;
    return ['st', 'nd', 'rd'][lastDigit - 1] || 'th';
}

function getRandomImage(images) {
    return images[Math.floor(Math.random() * images.length)];
}

function truncateUsername(username, maxLength = 15) {
    return username.length > maxLength ? `${username.slice(0, maxLength)}...` : username;
}

async function handleVerification(member, verificationConfig) {
    try {
        if (!verificationConfig || !verificationConfig.verificationEnabled) return;
        
        const unverifiedRole = member.guild.roles.cache.get(verificationConfig.unverifiedRoleId);
        if (unverifiedRole) {
            await member.roles.add(unverifiedRole).catch(err => {
                console.error('[MemberJoinHandler] Error assigning unverified role:', err);
            });
        } else {
            console.warn('[MemberJoinHandler] Unverified role not found.');
        }
    } catch (error) {
        console.error('[MemberJoinHandler] Error in verification handler:', error);
    }
}

async function getInviteSettings(guildId) {
    
    const cached = cacheManager.get('inviteSettings', guildId);
    if (cached !== null) {
        return cached;
    }

    try {
        const settings = await InviteSettings.findOne({ guildId });
        
        
        const result = settings ? {
            inviteLogChannelId: settings.inviteLogChannelId,
            status: settings.status
        } : false;
        
        cacheManager.set('inviteSettings', guildId, result);
        return result;
    } catch (error) {
        console.error(`[InviteTracker] Error loading settings for ${guildId}:`, error);
        
        cacheManager.set('inviteSettings', guildId, false);
        return false;
    }
}

function invalidateInviteSettings(guildId) {
    cacheManager.delete('inviteSettings', guildId);
}

async function handleInviteTracking(client, member) {
    try {
        const guild = member.guild;
        
        
        const settings = await getInviteSettings(guild.id);
        if (!settings || !settings.status) return;
        
        const newInvites = await guild.invites.fetch();
        const storedInvites = client.invites.get(guild.id) || new Map();
        
        
        let usedInvite = null;
        for (const invite of newInvites.values()) {
            const stored = storedInvites.get(invite.code);
            if (stored && invite.uses > stored.uses) {
                usedInvite = invite;
                break;
            } else if (!stored && invite.uses > 0) {
                
                usedInvite = invite;
                break;
            }
        }
        
        const inviterId = usedInvite?.inviter?.id || null;
        const inviteCode = usedInvite?.code || null;
        const inviteURL = usedInvite ? `https://discord.gg/${usedInvite.code}` : null;
        
        
        client.invites.set(guild.id, new Map(newInvites.map(inv => [
            inv.code, 
            { 
                inviterId: inv.inviter?.id || "Unknown", 
                uses: inv.uses,
                maxUses: inv.maxUses,
                expiresAt: inv.expiresAt,
                temporary: inv.temporary
            }
        ])));
        
        
        if (inviterId && usedInvite) {
            await Invite.create({
                guildId: guild.id,
                inviterId,
                inviteCode: usedInvite.code,
                uses: usedInvite.uses
            });
        }
        
        
        if (settings.inviteLogChannelId) {
            const channel = guild.channels.cache.get(settings.inviteLogChannelId);
            if (channel && channel.isTextBased()) {
                try {
                    
                    let inviter = null;
                    let inviterTag = "Unknown";
                    if (inviterId) {
                        try {
                            inviter = await guild.members.fetch(inviterId);
                            inviterTag = inviter.user.tag;
                        } catch (err) {
                            
                        }
                    }
                    
                    
                    let totalInvites = 0;
                    let invitesThisMonth = 0;
                    if (inviterId) {
                        const inviteData = await Invite.find({ guildId: guild.id, inviterId });
                        totalInvites = inviteData.length;
                        
                        
                        const startOfMonth = new Date();
                        startOfMonth.setDate(1);
                        startOfMonth.setHours(0, 0, 0, 0);
                        invitesThisMonth = inviteData.filter(inv => 
                            new Date(inv.createdAt || inv._id.getTimestamp()) >= startOfMonth
                        ).length;
                    }
                    
                    const lang = loadLanguage(guild.id);
                    const s = lang.serverlogs || {};
                    const inviteDetails = [];
                    if (usedInvite && inviteCode) {
                        inviteDetails.push(`**Code:** \`${inviteCode}\``);
                        inviteDetails.push(`**URL:** [discord.gg/${inviteCode}](${inviteURL})`);
                        inviteDetails.push(`**Uses:** ${usedInvite.uses}${usedInvite.maxUses ? `/${usedInvite.maxUses}` : ' (∞)'}`);
                        if (usedInvite.expiresAt) {
                            const expiresAt = new Date(usedInvite.expiresAt);
                            inviteDetails.push(`**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`);
                        } else {
                            inviteDetails.push(`**Expires:** Never`);
                        }
                        inviteDetails.push(`**Type:** ${usedInvite.temporary ? `${getEmoji('warning')} Temporary` : `${getEmoji('tick')} Permanent`}`);
                        if (usedInvite.channel) {
                            const inviteChannel = guild.channels.cache.get(usedInvite.channel.id);
                            inviteDetails.push(`**Channel:** ${inviteChannel ? inviteChannel.toString() : usedInvite.channel.name || 'Unknown'}`);
                        }
                    }

                    const inviteFields = [
                        { name: `${getEmoji('user')} Member`, value: `${member.user.tag}\n${member.user.id}`, inline: true },
                        { name: `${getEmoji('ticket')} Inviter`, value: inviterId ? `${inviter ? inviter.user.tag : 'Unknown User'}\n<@${inviterId}>` : 'Unknown / Vanity / Widget', inline: true },
                        { name: `${getEmoji('analytics')} Invite Stats`, value: inviterId ? `**Total:** ${totalInvites}\n**This Month:** ${invitesThisMonth}` : 'N/A', inline: true }
                    ];

                    if (usedInvite && inviteCode) {
                        inviteFields.push({ name: `${getEmoji('link')} Invite Details`, value: inviteDetails.join('\n'), inline: false });
                    } else {
                        inviteFields.push({ name: `${getEmoji('warning')} Invite Source`, value: 'Could not determine invite source.\n• Vanity URL\n• Widget\n• Discovery\n• Direct join', inline: false });
                    }

                    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
                    const inviteCard = buildCard({
                        title: `${getEmoji('chat')} ${s.inviteLogTitle || 'New Member Joined via Invite'}`,
                        description: (s.inviteLogDesc || '{member} joined the server').replace('{member}', member.toString()),
                        fields: inviteFields,
                        _footer: `Account created ${accountAge} day${accountAge !== 1 ? 's' : ''} ago • Invite Tracker`,
                        tone: 'success'
                    });

                    await channel.send({ components: [inviteCard], flags: MessageFlags.IsComponentsV2 });
                } catch (error) {
                    console.error('[InviteTracker] Error sending invite log:', error);
                    
                    try {
                        const inviter = inviterId ? `<@${inviterId}>` : "Unknown";
                        await channel.send(`${getEmoji('chat')} **Invite Log:** ${member} joined using an invite from ${inviter}.`);
                    } catch (fallbackError) {
                        
                    }
                }
            }
        }
        
        return { usedInvite, inviterId, inviteCode, inviteURL };
    } catch (error) {
        console.error("[InviteTracker] Error tracking invite:", error);
        return { usedInvite: null, inviterId: null, inviteCode: null, inviteURL: null };
    }
}

async function handleMemberJoinLog(client, member) {
    try {
        const { user, guild } = member;
        const guildId = guild.id;
        
        const { getLogConfig } = require('../utils/cacheHelpers');
        const logConfig = await getLogConfig(guildId, 'memberJoin');
        if (!logConfig?.channelId) return;
        
        const logChannel = client.channels.cache.get(logConfig.channelId)
            || await client.channels.fetch(logConfig.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = loadLanguage(guildId);
        const s = lang?.serverlogs || {};

        const accountAgeDays = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24));
        const isSuspicious = accountAgeDays < 3;
        const userAvatar = user.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.staffIcon;

        const card = buildCard({
            title: `${getEmoji('sparkles')} ${s.memberJoinedTitle || 'Member Joined'}`,
            accentColor: ACCENT.success,
            thumbnailURL: userAvatar,
            sections: [
                `> **${s.memberJoinedDesc || 'New Member Registered'}**\n\n• **${s.memberLabel || 'Member'}:** <@${user.id}> (${user.tag || user.username})\n• **${s.userIdLabel || 'User ID'}:** \`${user.id}\`\n• **${s.accountTypeLabel || 'Account Type'}:** \`${user.bot ? (s.botAccount || 'Bot') : (s.userAccount || 'User')}\`\n• **${s.totalMembersLabel || 'Total Members'}:** \`${guild.memberCount.toLocaleString()}\``,
                `### ${getEmoji('settings')} ${s.accountDetailsHeader || 'Account & Join Details'}\n• **${s.accountCreatedLabel || 'Account Created'}:** <t:${Math.floor(user.createdTimestamp / 1000)}:F> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)\n• **${s.accountStatusLabel || 'Account Status'}:** ${isSuspicious ? `${getEmoji('warning')} **${s.newAccountAlert || 'New Account (< 3 days)'}**` : `\`${s.normalAccount || 'Normal'}\``}\n• **${s.joinedServerLabel || 'Joined Server'}:** <t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:F> (<t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:R>)`
            ],
            footer: (s.footers?.memberLogs || 'Member Logs • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        await logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[MemberJoinHandler] Error sending log:', err);
        });
    } catch (error) {
        console.error('[MemberJoinHandler] Error in member join log handler:', error);
    }
}

function truncateUsername(name, maxLength = 15) {
    return name.length > maxLength ? name.slice(0, maxLength - 3) + '...' : name;
}

function getOrdinalSuffix(number) {
    const j = number % 10;
    const k = number % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

function getRandomImage(images) {
    return images[Math.floor(Math.random() * images.length)];
}

function replacePlaceholders(text, data) {
    if (!text) return '';
    return text
        .replace(/\{member\}/g, data.member)
        .replace(/\{username\}/g, data.username)
        .replace(/\{userid\}/g, data.userid)
        .replace(/\{membercount\}/g, data.membercount)
        .replace(/\{suffix\}/g, data.suffix)
        .replace(/\{servername\}/g, data.servername)
        .replace(/\{joindate\}/g, data.joindate)
        .replace(/\{accountcreated\}/g, data.accountcreated);
}

function getFieldValue(fieldType, data) {
    switch (fieldType) {
        case 'username': return data.username;
        case 'userid': return data.userid;
        case 'joindate': return data.joindate;
        case 'accountcreated': return data.accountcreated;
        case 'membercount': return `${data.membercount}${data.suffix}`;
        case 'servername': return data.servername;
        case 'none': return 'N/A';
        default: return 'N/A';
    }
}

function getThumbnailURL(type, member) {
    switch (type) {
        case 'userimage': return member.user.displayAvatarURL({ format: 'png', dynamic: true, size: 256 });
        case 'serverimage': return member.guild.iconURL({ format: 'png', dynamic: true, size: 256 });
        case 'none': return null;
        default: return member.guild.iconURL({ format: 'png', dynamic: true, size: 256 });
    }
}

function createWelcomeDMEmbed(member, dmConfig = {}) {
    const user = member.user;
    const username = truncateUsername(user.username, 15);
    const serverIcon = member.guild.iconURL({ format: 'png', dynamic: true, size: 256 });

    
    const placeholderData = {
        username: username,
        servername: member.guild.name
    };

    
    const defaultConfig = {
        title: 'Welcome to the Server!',
        description: 'Welcome {username}! Thanks for joining {servername}!',
        color: '#00e5ff',
        footer: { text: 'Enjoy your stay!', iconURL: '' },
        thumbnail: { type: 'userimage' },
        image: { useWcard: false, customURL: '' }
    };

    
    const config = {
        title: dmConfig.title || defaultConfig.title,
        description: dmConfig.description || defaultConfig.description,
        color: dmConfig.color || defaultConfig.color,
        footer: { ...defaultConfig.footer, ...dmConfig.footer },
        thumbnail: dmConfig.thumbnail || defaultConfig.thumbnail,
        image: { ...defaultConfig.image, ...dmConfig.image }
    };

    return buildCard({
        title: replacePlaceholders(config.title, placeholderData) || undefined,
        description: replacePlaceholders(config.description, placeholderData) || undefined,
        bannerURL: (!config.image.useWcard && config.image.customURL) ? config.image.customURL : undefined,
        _footer: replacePlaceholders(config.footer.text, placeholderData) || undefined,
        accentColor: config.color ? parseInt(String(config.color).replace('#', ''), 16) : undefined
    });
}

async function handleWelcomeChannel(member, welcomeSettings) {
    try {
        if (!welcomeSettings?.channelStatus || !welcomeSettings.welcomeChannelId) return;

        const welcomeChannel = member.guild.channels.cache.get(welcomeSettings.welcomeChannelId);
        if (!welcomeChannel) return;

        const user = member.user;
        const memberCount = member.guild.memberCount;
        const suffix = getOrdinalSuffix(memberCount);
        const username = truncateUsername(user.username, 15);
        const joinDate = member.joinedAt.toDateString();
        const creationDate = user.createdAt.toDateString();
        const serverIcon = member.guild.iconURL({ format: 'png', dynamic: true, size: 256 });

        
        const placeholderData = {
            member: member.toString(),
            username: username,
            userid: user.id,
            membercount: memberCount,
            suffix: suffix,
            servername: member.guild.name,
            joindate: joinDate,
            accountcreated: creationDate
        };

        
        const embedConfig = welcomeSettings.channelEmbed || {};
        const defaultConfig = {
            title: 'Welcome!',
            description: '{member}, You are the **{membercount}{suffix}** member of our server!',
            color: '#00e5ff',
            author: { name: '', iconURL: '', url: '' },
            footer: { text: "We're glad to have you here!", iconURL: '' },
            thumbnail: { type: 'serverimage' },
            image: { useWcard: true, customURL: '' },
            fields: [
                { name: 'Username', value: 'username', inline: true },
                { name: 'Join Date', value: 'joindate', inline: true },
                { name: 'Account Created', value: 'accountcreated', inline: true }
            ]
        };

        
        const config = {
            title: embedConfig.title || defaultConfig.title,
            description: embedConfig.description || defaultConfig.description,
            color: embedConfig.color || defaultConfig.color,
            author: { ...defaultConfig.author, ...embedConfig.author },
            footer: { ...defaultConfig.footer, ...embedConfig.footer },
            thumbnail: embedConfig.thumbnail || defaultConfig.thumbnail,
            image: { ...defaultConfig.image, ...embedConfig.image },
            fields: embedConfig.fields || defaultConfig.fields
        };

        const welcomeFields = [];
        config.fields.forEach(field => {
            if (field.value !== 'none' && field.name) {
                const fieldValue = getFieldValue(field.value, placeholderData);
                welcomeFields.push({
                    name: field.name,
                    value: fieldValue,
                    inline: field.inline !== undefined ? field.inline : true
                });
            }
        });

        let attachment = null;
        let bannerURL = (!config.image.useWcard && config.image.customURL) ? config.image.customURL : undefined;

        if (config.image.useWcard) {
            try {
                const cardGen = new WelcomeCardGenerator();
                const cardBuffer = await cardGen.generate({
                    username,
                    serverName: member.guild.name,
                    memberCount,
                    avatarURL: user.displayAvatarURL({ format: 'png', size: 256 }),
                    isLeave: false
                });
                attachment = new AttachmentBuilder(cardBuffer, { name: 'welcome.png' });
            } catch (customCardError) {
                console.error('[MemberJoinHandler] Error generating welcome card, falling back to custom image:', customCardError);
                if (config.image.customURL) {
                    bannerURL = config.image.customURL;
                }
            }
        }

        const welcomeCard = buildCard({
            title: replacePlaceholders(config.title, placeholderData) || undefined,
            description: replacePlaceholders(config.description, placeholderData) || undefined,
            fields: welcomeFields.length > 0 ? welcomeFields : undefined,
            bannerURL,
            _footer: replacePlaceholders(config.footer?.text, placeholderData) || undefined,
            accentColor: config.color ? parseInt(String(config.color).replace('#', ''), 16) : undefined
        });

        
        await welcomeChannel.send({ content: `Hey ${member}!` }).catch(() => {});

        const messageOptions = {
            components: [welcomeCard],
            flags: MessageFlags.IsComponentsV2
        };
        if (attachment) messageOptions.files = [attachment];

        await welcomeChannel.send(messageOptions).catch(err => {
            console.error('[MemberJoinHandler] Error sending welcome channel message:', err);
        });

    } catch (error) {
        console.error('[MemberJoinHandler] Error in welcome channel handler:', error);
    }
}

async function handleWelcomeDM(member, welcomeSettings) {
    try {
        if (!welcomeSettings?.dmStatus) return;
        
        const dmEmbed = createWelcomeDMEmbed(member, welcomeSettings.dmEmbed);
        await member.user.send({ components: [dmEmbed], flags: MessageFlags.IsComponentsV2 }).catch(err => {
            
            console.warn(`[MemberJoinHandler] Failed to send DM to ${member.user.tag}:`, err.message);
        });
    } catch (error) {
        console.error('[MemberJoinHandler] Error in welcome DM handler:', error);
    }
}


const memberJoinHandler = async function memberJoinHandler(client) {
    client.on('guildMemberAdd', async (member) => {
        try {
            const guildId = member.guild.id;
            
            
            const { getWelcomeSettings, getVerificationConfig } = require('../utils/cacheHelpers');
            
            
            const [
                welcomeSettings, 
                verificationConfig
            ] = await Promise.all([
                getWelcomeSettings(guildId),
                getVerificationConfig(guildId)
            ]);

 
            await Promise.allSettled([
            
                handleVerification(member, verificationConfig),
                
             
                handleInviteTracking(client, member),
                
             
                handleMemberJoinLog(client, member),
                
                
                handleWelcomeChannel(member, welcomeSettings),
                
                
                handleWelcomeDM(member, welcomeSettings)
            ]);
            
        } catch (error) {
            console.error('[MemberJoinHandler] Error in member join handler:', error);
        }
    });
};


memberJoinHandler.getInviteSettings = getInviteSettings;
memberJoinHandler.invalidateInviteSettings = invalidateInviteSettings;

module.exports = memberJoinHandler;