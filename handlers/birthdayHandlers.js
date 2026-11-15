'use strict';


const { 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    AttachmentBuilder,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    MediaGalleryBuilder
} = require('discord.js');

const birthdayController = require('../models/birthday/Controller');
const cron = require('node-cron');
const { BirthdayCardGenerator } = require('../UI/birthdayCardGenerator');
const { getBirthdaySettings } = require('../utils/cacheHelpers');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const defaultLang = require('../languages/default');
const moment = require('moment');
const { registerInteractionHandler } = require('../utils/interactionRouter');

function getLang(guildId) {
    try {
        const loadLanguage = require('../events/loadLanguage');
        const lang = loadLanguage(guildId);
        return lang.birthday || defaultLang.birthday;
    } catch {
        return defaultLang.birthday;
    }
}

class BirthdayHandlers {
    constructor(client) {
        this.client = client;
        this.cronJobs = [];
        this.unregisterInteractionRoute = null;
        this.setupEventHandlers();
        this.setupCronJobs();
    }

    setupEventHandlers() {
        this.unregisterInteractionRoute = registerInteractionHandler(this.client, {
            name: 'birthday-panels',
            prefixes: ['birthday_'],
            types: ['button', 'stringSelect'],
            handler: async (interaction) => {
            if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

            try {
                if (interaction.customId === 'birthday_celebrate') {
                    await this.handleCelebrationButton(interaction);
                } else if (interaction.customId.startsWith('birthday_settings_')) {
                    await this.handleSettingsMenu(interaction);
                } else if (interaction.customId.startsWith('birthday_setting_')) {
                    await this.handleSettingToggle(interaction);
                }
            } catch (error) {
                console.error('[BirthdayHandlers] Interaction error:', error);
                const lang = getLang(interaction.guild?.id);
                try {
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply({
                            content: `${getEmoji('cross')} ${lang.error?.unexpected}`
                        }).catch(() => {});
                    } else {
                        await interaction.reply({
                            content: `${getEmoji('cross')} ${lang.error?.unexpected}`,
                            flags: MessageFlags.Ephemeral
                        }).catch(() => {});
                    }
                } catch (_) {}
            }
            }
        });
    }

    setupCronJobs() {
        
        const dailyJob = cron.schedule('0 9 * * *', async () => {
            await this.dailyBirthdayCheck();
        });
        this.cronJobs.push(dailyJob);

        
        const weeklyJob = cron.schedule('0 18 * * 0', async () => {
            await this.weeklyBirthdayReminder();
        });
        this.cronJobs.push(weeklyJob);

        
        const monthlyJob = cron.schedule('0 0 1 * *', async () => {
            await this.monthlyStatsUpdate();
        });
        this.cronJobs.push(monthlyJob);
    }

    async handleCelebrationButton(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (_) {}

        const lang = getLang(interaction.guild?.id);
        const h = lang.handler || {};

        const celebrationContainer = new ContainerBuilder()
            .setAccentColor(0xFF69B4)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`# ${getEmoji('sparkles')} ${h.celebrationTitle}\n${h.celebrationThankYou} ${getEmoji('gift')}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`**${getEmoji('star')} ${h.celebrationActionsHeader}**\n• ${h.celebrationActionWish}\n• ${h.celebrationActionUpcoming}\n• ${h.celebrationActionStats}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`*${getEmoji('sparkles')} ${(h.celebrationJoinedFooter).replace('{time}', new Date().toLocaleString())}*`)
            );

        await interaction.editReply({ 
            components: [celebrationContainer],
            flags: MessageFlags.IsComponentsV2 
        });
    }

    async handleSettingsMenu(interaction) {
        const ownerId = interaction.customId.slice('birthday_settings_'.length);
        if (ownerId !== interaction.user.id) {
            return interaction.reply({
                content: 'This birthday settings panel belongs to another user.',
                flags: MessageFlags.Ephemeral
            });
        }
        try {
            await interaction.deferUpdate();
        } catch (_) {}

        const lang = getLang(interaction.guild?.id);
        const h = lang.handler || {};
        const settingType = interaction.values[0];

        let buttons = [];
        let title = '';
        let description = '';

        switch (settingType) {
            case 'privacy':
                title = `${getEmoji('lock')} ${h.privacyTitle}`;
                description = h.privacyDesc;
                buttons = [
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_privacy_public_${ownerId}`)
                        .setLabel(h.btnPublic)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(getButtonEmoji('world') || '🌍'),
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_privacy_private_${ownerId}`)
                        .setLabel(h.btnPrivate)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(getButtonEmoji('lock') || '🔒')
                ];
                break;

            case 'mentions':
                title = `${getEmoji('sparkles')} ${h.mentionsTitle}`;
                description = h.mentionsDesc;
                buttons = [
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_mentions_enable_${ownerId}`)
                        .setLabel(h.btnEnableMentions)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(getButtonEmoji('tick') || '✅'),
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_mentions_disable_${ownerId}`)
                        .setLabel(h.btnDisableMentions)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(getButtonEmoji('cross') || '❌')
                ];
                break;

            case 'dms':
                title = `${getEmoji('chat')} ${h.dmsTitle}`;
                description = h.dmsDesc;
                buttons = [
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_dms_enable_${ownerId}`)
                        .setLabel(h.btnEnableDMs)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(getButtonEmoji('tick') || '✅'),
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_dms_disable_${ownerId}`)
                        .setLabel(h.btnDisableDMs)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(getButtonEmoji('cross') || '❌')
                ];
                break;

            case 'celebration':
                title = `${getEmoji('sparkles')} ${h.celebrationStyleTitle}`;
                description = h.celebrationStyleDesc;
                buttons = [
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_celebration_simple_${ownerId}`)
                        .setLabel(h.btnStyleSimple)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(getButtonEmoji('gift') || '🎁'),
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_celebration_party_${ownerId}`)
                        .setLabel(h.btnStyleParty)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(getButtonEmoji('sparkles') || '✨'),
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_celebration_quiet_${ownerId}`)
                        .setLabel(h.btnStyleQuiet)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(getButtonEmoji('lock') || '🔒'),
                    new ButtonBuilder()
                        .setCustomId(`birthday_setting_celebration_none_${ownerId}`)
                        .setLabel(h.btnStyleNone)
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(getButtonEmoji('cross') || '❌')
                ];
                break;
        }

        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        const settingsContainer = new ContainerBuilder()
            .setAccentColor(0x4A90E2)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`# ${title}\n${description}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`*${(h.clickToUpdateSetting).replace('{time}', new Date().toLocaleString())}*`)
            );

        rows.forEach(r => settingsContainer.addActionRowComponents(r));

        await interaction.editReply({ 
            components: [settingsContainer],
            flags: MessageFlags.IsComponentsV2 
        });
    }

    async handleSettingToggle(interaction) {
        const settingParts = interaction.customId.split('_');
        const ownerId = settingParts[4];
        if (!ownerId || ownerId !== interaction.user.id) {
            return interaction.reply({
                content: 'This birthday settings control belongs to another user.',
                flags: MessageFlags.Ephemeral
            });
        }
        try {
            await interaction.deferUpdate();
        } catch (_) {}

        const lang = getLang(interaction.guild?.id);
        const h = lang.handler || {};

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const settingType = settingParts[2];
        const settingValue = settingParts[3];

        let updateObject = {};

        switch (settingType) {
            case 'privacy':
                updateObject = {
                    'settings.allowPublicView': settingValue === 'public'
                };
                break;
            case 'mentions':
                updateObject = {
                    'settings.allowMentions': settingValue === 'enable'
                };
                break;
            case 'dms':
                updateObject = {
                    'settings.allowDMs': settingValue === 'enable'
                };
                break;
            case 'celebration':
                updateObject = {
                    'settings.celebrationStyle': settingValue
                };
                break;
        }

        const result = await birthdayController.updateSettings(userId, guildId, updateObject);

        let message = '';
        let color = 0x00FF00;

        if (result.success) {
            switch (settingType) {
                case 'privacy':
                    message = settingValue === 'public'
                        ? `${h.privacySetPublic} ${getEmoji('world')}`
                        : `${h.privacySetPrivate} ${getEmoji('lock')}`;
                    break;
                case 'mentions':
                    message = settingValue === 'enable'
                        ? `${h.mentionsSetEnabled} ${getEmoji('tick')}`
                        : `${h.mentionsSetDisabled} ${getEmoji('cross')}`;
                    break;
                case 'dms':
                    message = settingValue === 'enable'
                        ? `${h.dmsSetEnabled} ${getEmoji('tick')}`
                        : `${h.dmsSetDisabled} ${getEmoji('cross')}`;
                    break;
                case 'celebration':
                    const styles = { 
                        simple: `${getEmoji('gift')} ${h.styleSimpleLabel}`, 
                        party: `${getEmoji('sparkles')} ${h.stylePartyLabel}`, 
                        quiet: `${getEmoji('lock')} ${h.styleQuietLabel}`, 
                        none: `${getEmoji('cross')} ${h.styleNoneLabel}` 
                    };
                    message = (h.celebrationStyleSet).replace('{style}', styles[settingValue]);
                    break;
            }
        } else {
            message = `${getEmoji('cross')} ${(h.settingUpdateError).replace('{error}', result.error)}`;
            color = 0xFF0000;
        }

        const updateContainer = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`# ${getEmoji('tick')} ${h.settingUpdatedTitle}\n${message}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`*${(h.settingUpdateFooter).replace('{time}', new Date().toLocaleString())}*`)
            );

        await interaction.editReply({ 
            components: [updateContainer],
            flags: MessageFlags.IsComponentsV2 
        });
    }

    async dailyBirthdayCheck() {
        console.log('[BirthdayHandlers] Running daily birthday check...');
        
        for (const [guildId, guild] of this.client.guilds.cache) {
            try {
                const result = await birthdayController.getTodaysBirthdays(guildId);
                
                if (result.success && result.count > 0) {
                    await this.announceBirthdays(guild, result.birthdays);
                }
            } catch (error) {
                console.error(`[BirthdayHandlers] Error checking birthdays for guild ${guildId}:`, error);
            }
        }
    }

    async announceBirthdays(guild, birthdays) {
        birthdays = birthdays.filter(birthday => birthday.settings?.allowPublicView !== false);
        if (birthdays.length === 0) return;
        const guildSettings = await getBirthdaySettings(guild.id);
    
        if (!guildSettings) {
            return;
        }
    
        if (guildSettings.settings && guildSettings.settings.enableDailyAnnouncements === false) {
            return;
        }
    
        let announcementChannel = null;
    
        if (guildSettings.settings?.announcementChannelId) {
            const ch = guild.channels.cache.get(guildSettings.settings.announcementChannelId);
            if (ch && ch.isTextBased() && ch.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
                announcementChannel = ch;
            }
        }
    
        if (!announcementChannel) {
            const channels = guild.channels.cache
                .filter(channel =>
                    channel.isTextBased() &&
                    (channel.name.includes('birthday') ||
                    channel.name.includes('celebration') ||
                    channel.name.includes('general'))
                );
    
            announcementChannel = channels.find(ch => ch.name.includes('birthday')) ||
                                  channels.find(ch => ch.name.includes('celebration')) ||
                                  channels.find(ch => ch.name.includes('general')) ||
                                  guild.systemChannel;
        }
    
        if (!announcementChannel) {
            return;
        }
    
        const lang = getLang(guild.id);
        const h = lang.handler || {};
        const cardGenerator = new BirthdayCardGenerator();
    
        for (const birthday of birthdays) {
            try {
                const user = await guild.members.fetch(birthday.userId);
                const age = birthday.age;
    
                const cardBuffer = await cardGenerator.generateBirthdayCard({
                    username: user.displayName || user.user.username,
                    age: age,
                    theme: birthday.settings?.celebrationStyle === 'party' ? 'celebration' : 
                           birthday.settings?.celebrationStyle === 'quiet' ? 'elegant' : 'fun',
                    avatarURL: user.user.displayAvatarURL({ format: 'png', size: 256 }),
                    customMessage: guildSettings.settings?.customMessage || 
                        `${guild.name} wishes you the happiest of birthdays! May your special day be filled with joy, laughter, and all your favorite things!`,
                    requesterName: guild.name,
                    zodiacSign: birthday.zodiacSign || null
                });
    
                const ageText = age 
                    ? (h.turningAge).replace('{age}', age)
                    : (h.birthdayToday);

                let birthdayContainer = new ContainerBuilder()
                    .setAccentColor(0xFF1493)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent(`**${getEmoji('gift')} ${h.happyBirthdayTitle}**`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent([
                                `**${getEmoji('gift')} ${user.displayName}**`,
                                `**${getEmoji('sparkles')} ${ageText}**`,
                                `**${getEmoji('world')} ${h.serverLabel}** ${guild.name}`,
                                birthday.settings?.allowMentions && guildSettings.settings?.mentionRole ? 
                                    `**${getEmoji('sparkles')} ${(h.mentionCelebratingUser).replace('{role}', guildSettings.settings.mentionRole).replace('{user}', user.id)} ${getEmoji('sparkles')}**` : 
                                    birthday.settings?.allowMentions ? `**${getEmoji('sparkles')} <@${user.id}> ${getEmoji('sparkles')}**` : ''
                            ].filter(Boolean).join('\n'))
                    );
    
                if (cardBuffer) {
                    const ageDetails = age ? (h.cardAgeYearsOld).replace('{age}', age) : (h.cardSpecialDay);
                    birthdayContainer
                        .addSeparatorComponents(
                            new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addMediaGalleryComponents(
                            new MediaGalleryBuilder()
                                .addItems(
                                    mediaItem => mediaItem
                                        .setURL('attachment://birthday-card.png')
                                        .setDescription((h.cardDescription).replace('{user}', user.displayName).replace('{ageDetails}', ageDetails))
                                )
                        );
                }
    
                birthdayContainer
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent(`*${(h.celebratingIn).replace('{guild}', guild.name).replace('{time}', new Date().toLocaleString())}*`)
                    );
    
                const celebrateBtn = new ButtonBuilder()
                    .setCustomId('birthday_celebrate')
                    .setLabel(h.btnCelebrate)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(getButtonEmoji('sparkles') || '✨');
    
                const celebrationButtons = new ActionRowBuilder()
                    .addComponents(
                        celebrateBtn,
                        new ButtonBuilder()
                            .setLabel(h.btnViewProfile)
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://discord.com/users/${user.id}`)
                    );
    
                
                birthdayContainer.addActionRowComponents(celebrationButtons);
    
                const messageOptions = {
                    components: [birthdayContainer],
                    flags: MessageFlags.IsComponentsV2
                };
    
                if (cardBuffer) {
                    const attachment = new AttachmentBuilder(cardBuffer, { 
                        name: 'birthday-card.png' 
                    });
                    messageOptions.files = [attachment];
                }
    
                await announcementChannel.send(messageOptions);
                await birthdayController.celebrateBirthday(birthday.userId, guild.id);
    
                if (birthdays.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
    
            } catch (error) {
                console.error(`[BirthdayHandlers] Error processing birthday for user ${birthday.userId}:`, error);
                
                try {
                    const user = await guild.members.fetch(birthday.userId);
                    const fallbackContainer = new ContainerBuilder()
                        .setAccentColor(0xFF1493)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`# ${getEmoji('sparkles')} ${h.fallbackHappyBirthday}\n${(h.fallbackCelebrating).replace('{user}', user?.displayName || h.someoneSpecial)} ${getEmoji('gift')}`)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(`*${(h.fallbackFooter).replace('{time}', new Date().toLocaleString())}*`)
                        );
    
                    await announcementChannel.send({ 
                        components: [fallbackContainer],
                        flags: MessageFlags.IsComponentsV2 
                    });
                    await birthdayController.celebrateBirthday(birthday.userId, guild.id);
                } catch (fallbackError) {
                    console.error(`[BirthdayHandlers] Fallback birthday announcement failed:`, fallbackError);
                }
            }
        }
    }

    async weeklyBirthdayReminder() {
        console.log('[BirthdayHandlers] Running weekly birthday reminder...');
        
        for (const [guildId, guild] of this.client.guilds.cache) {
            try {
                const guildSettings = await getBirthdaySettings(guildId);
                if (!guildSettings || !guildSettings.settings?.enableWeeklyReminders) {
                    continue;
                }

                const result = await birthdayController.getUpcomingBirthdays(guildId, 7);
                
                if (result.success && result.count > 0) {
                    await this.sendWeeklyReminder(guild, result.birthdays);
                }
            } catch (error) {
                console.error(`[BirthdayHandlers] Error sending weekly reminder for guild ${guildId}:`, error);
            }
        }
    }

    async sendWeeklyReminder(guild, birthdays) {
        birthdays = birthdays.filter(birthday => birthday.settings?.allowPublicView !== false);
        if (birthdays.length === 0) return;
        const channels = guild.channels.cache
            .filter(channel => 
                channel.isTextBased() && 
                (channel.name.includes('birthday') || 
                 channel.name.includes('general'))
            );
        
        let reminderChannel = channels.find(ch => ch.name.includes('birthday')) ||
                             channels.find(ch => ch.name.includes('general')) ||
                             guild.systemChannel;

        if (!reminderChannel) return;

        const lang = getLang(guild.id);
        const h = lang.handler || {};
        const plural = birthdays.length > 1 ? (h.dayPlural) : '';

        const reminderContainer = new ContainerBuilder()
            .setAccentColor(0xFFD700)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`# ${getEmoji('calendar')} ${h.weeklyReminderTitle}\n${(h.birthdaysComingUp).replace('{count}', birthdays.length).replace('{plural}', plural)}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            );

        let birthdayList = '';
        for (const birthday of birthdays.slice(0, 5)) {
            try {
                const user = await guild.members.fetch(birthday.userId);
                const daysUntil = Math.ceil(moment(birthday.adjustedBirthday).diff(moment(), 'days', true));
                const dayText = daysUntil !== 1 ? (h.dayPlural) : (h.daySingular);
                
                birthdayList += `**${getEmoji('gift')} ${user.displayName}**\n${getEmoji('calendar')} ${moment(birthday.adjustedBirthday).format('dddd, MMMM Do')} (${daysUntil} ${dayText})\n\n`;
            } catch (error) {
                console.error(`Error fetching user ${birthday.userId}:`, error);
            }
        }

        if (birthdayList) {
            reminderContainer.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(birthdayList.trim())
            );
        }

        if (birthdays.length > 5) {
            reminderContainer.addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`**${getEmoji('list')} ${h.moreBirthdaysHeader}**\n${(h.moreBirthdaysNotice).replace('{count}', birthdays.length - 5)}`)
            );
        }

        reminderContainer.addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`*${(h.weeklyReminderFooter).replace('{time}', new Date().toLocaleString())}*`)
        );

        try {
            await reminderChannel.send({ 
                components: [reminderContainer],
                flags: MessageFlags.IsComponentsV2 
            });
        } catch (error) {
            console.error(`[BirthdayHandlers] Error sending weekly reminder in guild ${guild.id}:`, error);
        }
    }

    async monthlyStatsUpdate() {
        console.log('[BirthdayHandlers] Running monthly stats update...');
        
        for (const [guildId, guild] of this.client.guilds.cache) {
            try {
                const guildSettings = await getBirthdaySettings(guildId);
                if (!guildSettings || !guildSettings.settings?.enableMonthlyStats) {
                    continue;
                }

                const result = await birthdayController.getGuildStats(guildId);
                
                if (result.success) {
                    await this.sendMonthlyStats(guild, result.stats);
                }
            } catch (error) {
                console.error(`[BirthdayHandlers] Error updating monthly stats for guild ${guildId}:`, error);
            }
        }
    }

    async sendMonthlyStats(guild, stats) {
        const channels = guild.channels.cache
            .filter(channel => 
                channel.isTextBased() && 
                (channel.name.includes('birthday') || 
                 channel.name.includes('stats'))
            );
        
        let statsChannel = channels.find(ch => ch.name.includes('birthday')) ||
                          channels.find(ch => ch.name.includes('stats'));

        if (!statsChannel) return;

        const lang = getLang(guild.id);
        const h = lang.handler || {};
        const currentMonth = moment().format('MMMM YYYY');
        
        const statsContainer = new ContainerBuilder()
            .setAccentColor(0x9370DB)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`# ${getEmoji('analytics')} ${(h.monthlyStatsTitle).replace('{month}', currentMonth)}\n${h.monthlyStatsSummary}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent([
                                `**${getEmoji('gift')} ${h.totalBirthdaysLabel}** ${stats.totalBirthdays || 0}`,
                                `**${getEmoji('sparkles')} ${h.wishesSentLabel}** ${stats.totalWishes || 0}`,
                                `**${getEmoji('rocket')} ${h.celebrationsLabel}** ${stats.totalCelebrations || 0}`,
                                `**${getEmoji('calendar')} ${h.thisMonthLabel}** ${stats.birthdaysThisMonth || 0}`
                            ].join('\n'))
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setURL(guild.iconURL({ dynamic: true }) || this.client.user.displayAvatarURL())
                            .setDescription((lang.birthday?.stats?.title).replace('{guild}', guild.name))
                    )
            );

        if (stats.mostCommonZodiac) {
            const zodiacEmojis = { aries: getEmoji('star'), taurus: getEmoji('star'), gemini: getEmoji('star'), cancer: getEmoji('star'), leo: getEmoji('star'), virgo: getEmoji('star'), libra: getEmoji('star'), scorpio: getEmoji('star'), sagittarius: getEmoji('star'), capricorn: getEmoji('star'), aquarius: getEmoji('star'), pisces: getEmoji('star') };
            
            statsContainer.addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(`**${getEmoji('star')} ${h.mostCommonZodiacLabel}** ${zodiacEmojis[stats.mostCommonZodiac] || ''} ${stats.mostCommonZodiac.charAt(0).toUpperCase() + stats.mostCommonZodiac.slice(1)}`)
            );
        }

        statsContainer.addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`*${(h.monthlyStatsFooter).replace('{time}', new Date().toLocaleString())}*`)
        );

        try {
            await statsChannel.send({ 
                components: [statsContainer],
                flags: MessageFlags.IsComponentsV2 
            });
        } catch (error) {
            console.error(`[BirthdayHandlers] Error sending monthly stats in guild ${guild.id}:`, error);
        }
    }

    stop() {
        this.unregisterInteractionRoute?.();
        this.unregisterInteractionRoute = null;
        for (const job of this.cronJobs) {
            if (job && typeof job.stop === 'function') {
                job.stop();
            }
        }
    }
}

module.exports = BirthdayHandlers;
