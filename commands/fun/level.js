


const {
    SlashCommandBuilder,
    AttachmentBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const levelingController = require('../../models/leveling/levelingController');
const { createDashboardModalId, parseDashboardModalId, resolveDashboardMessage } = require('../../utils/dashboardModalSession');
const { RankCardGenerator } = require('../../UI/rankCardGenerator');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const {
    buildCard,
    cards,
    btn,
    linkBtn,
    closeBtn,
    createSessionManager,
    replyUnauthorized,
    replyEphemeral,
    deferUpdate,
    closeAndAutoDelete,
    ACCENT,
    formatCommandLink,
    cacheCommandIds,
} = require('../../UI');


const SESSION_TTL = 10 * 60 * 1000; 
const sessionManager = createSessionManager({
    ttl: SESSION_TTL,
    onExpire: () => buildExpiredCard(),
});

async function resolveUser(guild, input) {
    if (!input) return null;
    const mentionMatch = input.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        const userId = mentionMatch[1];
        return await guild.members.fetch(userId).then(m => m.user).catch(() => null);
    }
    if (/^\d+$/.test(input)) {
        return await guild.members.fetch(input).then(m => m.user).catch(() => null);
    }
    const username = input.toLowerCase();
    const foundMember = guild.members.cache.find(m => m.user.username.toLowerCase() === username || m.displayName?.toLowerCase() === username);
    if (foundMember) return foundMember.user;
    
    const fetched = await guild.members.fetch({ query: input, limit: 1 }).catch(() => null);
    if (fetched && fetched.first()) return fetched.first().user;
    
    return null;
}


async function editResponse(interaction, payload) {
    const isSlash = Boolean(interaction.isChatInputCommand?.() || interaction.isButton?.() || interaction.isStringSelectMenu?.() || interaction.isModalSubmit?.());
    if (isSlash) {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        } else {
            return await interaction.reply(payload);
        }
    } else {
        if (interaction.responseMessage) {
            return await interaction.responseMessage.edit(payload);
        } else {
            const msg = await interaction.reply(payload);
            interaction.responseMessage = msg;
            return msg;
        }
    }
}


function buildExpiredCard() {
    return buildCard(
        `${getEmoji('warning')} ${lang.fun.level.sessionExpiredTitle}`,
        [
            lang.fun.level.session.expired.replace('{command}', formatCommandLink('level'))
        ],
        [],
        null,
        0xFF8C00
    );
}

function tabsRow(active) {
    const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
    return new ActionRowBuilder().addComponents(
        btn(lang.fun.level.nav.rank, 'level_tab_rank', 'crown', s('rank')),
        btn(lang.fun.level.nav.leaderboard, 'level_tab_leaderboard', 'analytics', s('leaderboard')),
        btn(lang.fun.level.nav.rewards, 'level_tab_rewards', 'gift', s('rewards')),
        btn(lang.fun.level.nav.achievements, 'level_tab_achievements', 'medal', s('achievements')),
        btn(lang.fun.level.nav.system, 'level_tab_system', 'info', s('system'))
    );
}


async function renderRankState(client, guild, state) {
    const targetUser = await client.users.fetch(state.targetUserId).catch(() => null);
    if (!targetUser) {
        return {
            components: [buildCard(
                `${getEmoji('cross')} ${lang.fun.level.panel.userErrorTitle}`,
                [lang.fun.level.error.fetchUser],
                [new ActionRowBuilder().addComponents(btn(lang.fun.level.nav.back, 'level_rank_back_select', 'back', ButtonStyle.Secondary))],
                null,
                0xFF0000
            )]
        };
    }

    const userData = await levelingController.getUserRank(targetUser.id, guild.id);
    if (!userData) {
        return {
            components: [buildCard(
                `${getEmoji('cross')} ${lang.fun.level.panel.noDataTitle}`,
                [
                    `${getEmoji('user')} **User:** ${targetUser.username}`,
                    `${getEmoji('analytics')} **Status:** ${lang.fun.level.content.noDataFound}`,
                    `${getEmoji('sparkles')} **Get Started:** ${lang.fun.level.content.getStarted}`
                ],
                [
                    tabsRow('rank'),
                    new ActionRowBuilder().addComponents(
                        btn(lang.fun.level.nav.selectAnotherMember, 'level_rank_select_member', 'groupusers', ButtonStyle.Secondary),
                        btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
                    )
                ],
                targetUser.displayAvatarURL({ dynamic: true, size: 128 }),
                0xFF4757
            )]
        };
    }

    const currentLevelXP = levelingController.calculateXPForLevel(userData.level);
    const nextLevelXP = levelingController.calculateXPForLevel(userData.level + 1);
    const currentXP = userData.totalXp - currentLevelXP;
    const requiredXP = nextLevelXP - currentLevelXP;
    const progressPercent = Math.round((Math.max(0, currentXP) / Math.max(1, requiredXP)) * 100);
    const xpToNext = Math.max(0, requiredXP - currentXP);

    const cardGenerator = new RankCardGenerator();
    const cardBuffer = await cardGenerator.generateRankCard({
        username: targetUser.username,
        discriminator: targetUser.discriminator || '0000',
        avatarURL: targetUser.displayAvatarURL({ extension: 'png', size: 512, forceStatic: false }),
        level: userData.level,
        currentXP: Math.max(0, currentXP),
        requiredXP: Math.max(1, requiredXP),
        totalXP: userData.totalXp,
        rank: userData.rank,
        theme: state.theme,
        customBackground: userData.rankCard?.background || null,
        badge: userData.rankCard?.badge || null,
        width: 1200,
        height: 400
    });

    const attachment = new AttachmentBuilder(cardBuffer, {
        name: `${targetUser.username}-rank-${state.theme}.png`,
        description: `Professional rank card for ${targetUser.username}`
    });

    const themeColors = { 'default': 0x3B82F6, 'dark': 0xFF6B35, 'neon': 0x00FFFF, 'minimal': 0x64748B, 'gaming': 0xE94560 };

    const sections = [];
    if (state.detailed) {
        sections.push(
            `### **${lang.fun.level.content.levelingSummary}**\n• **Level**: ${userData.level}\n• **Global Rank**: #${userData.rank}\n• **Total XP**: ${userData.totalXp.toLocaleString()} XP\n• **Progress**: ${progressPercent}% to next level\n• **Theme**: ${state.theme.charAt(0).toUpperCase() + state.theme.slice(1)}`,
            `### **${lang.fun.level.content.detailedMetrics}**\n• **Weekly XP**: ${(userData.weeklyXp || 0).toLocaleString()} XP\n• **Messages**: ${(userData.messageCount || 0).toLocaleString()}\n• **Daily Streak**: ${userData.streaks?.daily || 0} days\n• **Last Active**: ${userData.lastMessageAt ? new Date(userData.lastMessageAt).toLocaleDateString() : 'Unknown'}\n• **Level Progress**: ${Math.max(0, currentXP).toLocaleString()} / ${requiredXP.toLocaleString()} XP\n• **XP to Next**: ${xpToNext.toLocaleString()} XP`
        );
    } else {
        sections.push(
            `### **${lang.fun.level.content.levelingSummary}**\n• **Level**: ${userData.level}\n• **Global Rank**: #${userData.rank}\n• **Total XP**: ${userData.totalXp.toLocaleString()} XP\n• **XP to Next Level**: ${xpToNext.toLocaleString()} XP\n• **Weekly XP**: ${(userData.weeklyXp || 0).toLocaleString()} XP`
        );
    }

    let rows = [];
    if (state.selectingMember) {
        rows = [
            tabsRow('rank'),
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('level_rank_user_select')
                    .setPlaceholder(lang.fun.level.select.selectUserPlaceholder || lang.fun.level.selectUserPlaceholder)
            ),
            new ActionRowBuilder().addComponents(
                btn(lang.fun.level.nav.back, 'level_rank_back_select', 'back', ButtonStyle.Secondary)
            )
        ];
    } else {
        rows = [
            tabsRow('rank'),
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('level_rank_select_theme')
                    .setPlaceholder(lang.fun.level.select.selectThemePlaceholder || lang.fun.level.selectThemePlaceholder)
                    .addOptions([
                        { label: lang.fun.level.select.themeDefault, value: 'default', emoji: getButtonEmoji('sparkles') || '✨', default: state.theme === 'default' },
                        { label: lang.fun.level.select.themeDark, value: 'dark', emoji: getButtonEmoji('settings') || '⚙️', default: state.theme === 'dark' },
                        { label: lang.fun.level.select.themeNeon, value: 'neon', emoji: getButtonEmoji('rocket') || '🚀', default: state.theme === 'neon' },
                        { label: lang.fun.level.select.themeMinimal, value: 'minimal', emoji: getButtonEmoji('document') || '📝', default: state.theme === 'minimal' },
                        { label: lang.fun.level.select.themeGaming, value: 'gaming', emoji: getButtonEmoji('games') || '🎮', default: state.theme === 'gaming' }
                    ])
            ),
            new ActionRowBuilder().addComponents(
                btn(state.detailed ? lang.fun.level.nav.simpleStats : lang.fun.level.nav.detailedStats, 'level_rank_toggle_detail', 'analytics', ButtonStyle.Primary),
                btn(lang.fun.level.nav.selectMember, 'level_rank_select_member', 'groupusers', ButtonStyle.Secondary),
                btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
            )
        ];
    }

    const card = buildCard(
        `${getEmoji('crown')} ${targetUser.username.toUpperCase()}'S RANK CARD`,
        sections,
        rows,
        targetUser.displayAvatarURL({ dynamic: true, size: 128 }),
        themeColors[state.theme] || 0x3B82F6
    );

    if (cardBuffer) {
        card.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        card.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(mediaItem => mediaItem
                .setURL(`attachment://${targetUser.username}-rank-${state.theme}.png`)
                .setDescription(`${targetUser.username}'s Professional Rank Card - ${state.theme.toUpperCase()} Theme`)
            )
        );
    }

    return {
        components: [card],
        files: [attachment]
    };
}

async function renderLeaderboardState(client, guild, state) {
    const limit = 10;
    const leaderboardData = await levelingController.getLeaderboard(guild.id, state.leaderboardType, state.leaderboardPage, limit);

    const typeInfo = {
        'xp': { title: 'Total XP Rankings', emoji: getEmoji('crown'), field: 'totalXp' },
        'weekly': { title: 'Weekly XP Rankings', emoji: getEmoji('calendar'), field: 'weeklyXp' },
        'voice_time': { title: 'Voice Time Rankings', emoji: getEmoji('voice'), field: 'voiceStats.totalMinutes' },
        'voice_xp': { title: 'Voice XP Rankings', emoji: getEmoji('volume'), field: 'voiceStats.voiceXp' },
        'messages': { title: 'Message Rankings', emoji: getEmoji('chat'), field: 'messageCount' },
        'streak': { title: 'Daily Streak Rankings', emoji: getEmoji('fire'), field: 'streaks.daily' }
    };

    const currentType = typeInfo[state.leaderboardType];
    const title = `${currentType.emoji} ${currentType.title}`;

    if (!leaderboardData || leaderboardData.length === 0) {
        return {
            components: [buildCard(
                title,
                [
                    `**Leaderboard Type:** ${state.leaderboardType.toUpperCase()}`,
                    `**Page:** ${state.leaderboardPage}`,
                    `**Status:** ${lang.fun.level.content.noLeaderboardData}`
                ],
                [
                    tabsRow('leaderboard'),
                    new ActionRowBuilder().addComponents(
                        btn(lang.fun.level.nav.prevPage, 'level_leaderboard_prev', 'back', ButtonStyle.Secondary, state.leaderboardPage <= 1),
                        btn(lang.fun.level.nav.firstPage, 'level_leaderboard_first', 'home', ButtonStyle.Secondary, state.leaderboardPage <= 1),
                        btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
                    )
                ],
                guild.iconURL({ dynamic: true, size: 128 }),
                0xFF4757
            )]
        };
    }

    const startRank = (state.leaderboardPage - 1) * limit + 1;
    let leaderboardText = '';
    for (let i = 0; i < leaderboardData.length; i++) {
        const user = leaderboardData[i];
        const rank = startRank + i;
        const rankEmoji = rank === 1 ? getEmoji('crown') : rank === 2 ? getEmoji('medal') : rank === 3 ? getEmoji('star') : getEmoji('tag');

        let value;
        switch (state.leaderboardType) {
            case 'xp': value = `${user.totalXp.toLocaleString()} XP (Level ${user.level})`; break;
            case 'weekly': value = `${user.weeklyXp.toLocaleString()} XP`; break;
            case 'voice_time':
                const hours = Math.floor(user.voiceStats.totalMinutes / 60);
                const minutes = user.voiceStats.totalMinutes % 60;
                value = `${hours}h ${minutes}m`;
                break;
            case 'voice_xp': value = `${user.voiceStats.voiceXp.toLocaleString()} Voice XP`; break;
            case 'messages': value = `${user.messageCount.toLocaleString()} messages`; break;
            case 'streak': value = `${user.streaks.daily} day streak`; break;
        }

        leaderboardText += `${rankEmoji} **#${rank}** <@${user.userId}>\n    ${value}\n\n`;
    }

    const nextPageData = await levelingController.getLeaderboard(guild.id, state.leaderboardType, state.leaderboardPage + 1, limit);
    const hasNextPage = nextPageData && nextPageData.length > 0;

    const sections = [
        `**Server:** ${guild.name}\n**Category:** ${currentType.title}\n**Page:** ${state.leaderboardPage}`,
        leaderboardText
    ];

    const rows = [
        tabsRow('leaderboard'),
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('level_leaderboard_select_type')
                .setPlaceholder(lang.fun.level.select.selectTypePlaceholder || lang.fun.level.selectTypePlaceholder)
                .addOptions([
                    { label: lang.fun.level.select.typeXp, value: 'xp', emoji: getButtonEmoji('crown') || '👑', default: state.leaderboardType === 'xp' },
                    { label: lang.fun.level.select.typeWeekly, value: 'weekly', emoji: getButtonEmoji('calendar') || '📅', default: state.leaderboardType === 'weekly' },
                    { label: lang.fun.level.select.typeVoiceTime, value: 'voice_time', emoji: getButtonEmoji('mic') || '🎙️', default: state.leaderboardType === 'voice_time' },
                    { label: lang.fun.level.select.typeVoiceXp, value: 'voice_xp', emoji: getButtonEmoji('volume') || '🔊', default: state.leaderboardType === 'voice_xp' },
                    { label: lang.fun.level.select.typeMessages, value: 'messages', emoji: getButtonEmoji('chat') || '💬', default: state.leaderboardType === 'messages' },
                    { label: lang.fun.level.select.typeStreak, value: 'streak', emoji: getButtonEmoji('fire') || '🔥', default: state.leaderboardType === 'streak' }
                ])
        ),
        new ActionRowBuilder().addComponents(
            btn(lang.fun.level.nav.previous, 'level_leaderboard_prev', 'back', ButtonStyle.Secondary, state.leaderboardPage <= 1),
            btn(lang.fun.level.nav.next, 'level_leaderboard_next', 'next', ButtonStyle.Secondary, !hasNextPage),
            btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
        )
    ];

    return {
        components: [buildCard(title, sections, rows, guild.iconURL({ dynamic: true, size: 128 }), 0x3B82F6)]
    };
}

async function renderRewardsState(client, guild, state) {
    const levelRewards = [
        { level: 5, reward: `${getEmoji('list')} **Newcomer** role`, description: 'Welcome to the community!' },
        { level: 10, reward: `${getEmoji('chat')} **Active Member** role`, description: 'Access to exclusive channels' },
        { level: 15, reward: `${getEmoji('sparkles')} **Custom Role Color**`, description: 'Choose your own role color' },
        { level: 20, reward: `${getEmoji('medal')} **Veteran** role`, description: 'Respected community member' },
        { level: 25, reward: `${getEmoji('tools')} **Moderator Applications**`, description: 'Apply to become a moderator' },
        { level: 30, reward: `${getEmoji('crown')} **VIP** role`, description: 'VIP perks and benefits' },
        { level: 40, reward: `${getEmoji('star')} **Server Booster Perks**`, description: 'Extra privileges' },
        { level: 50, reward: `${getEmoji('medal')} **Legend** role`, description: 'Ultimate achievement!' }
    ];

    const title = `${getEmoji('gift')} Level Rewards & Calculator`;
    const sections = [];

    let milestoneList = `**${getEmoji('gift')} Available Milestones:**\n`;
    levelRewards.forEach(r => {
        milestoneList += `• **Level ${r.level}:** ${r.reward} - *${r.description}*\n`;
    });
    sections.push(milestoneList);

    if (state.targetLevel) {
        const requiredXP = levelingController.calculateXPForLevel(state.targetLevel);
        sections.push(
            `### ${getEmoji('analytics')} **Target Level XP Requirements**\n• **Target Level:** ${state.targetLevel}\n• **Required Total XP:** ${requiredXP.toLocaleString()} XP`
        );
    }

    const hasLevelCalculation = state.calcLevel !== null && state.calcLevel !== undefined;
    const hasXpCalculation = state.calcXp !== null && state.calcXp !== undefined;
    if (hasLevelCalculation || hasXpCalculation) {
        if (hasLevelCalculation) {
            const totalXP = levelingController.calculateXPForLevel(state.calcLevel);
            sections.push(
                `### ${getEmoji('settings')} **Level ${state.calcLevel} Calculation**\n• **Required Total XP:** ${totalXP.toLocaleString()} XP`
            );
        } else if (hasXpCalculation) {
            const level = levelingController.calculateLevel(state.calcXp);
            const currentLevelXP = levelingController.calculateXPForLevel(level);
            const nextLevelXP = levelingController.calculateXPForLevel(level + 1);
            sections.push(
                `### ${getEmoji('settings')} **${state.calcXp.toLocaleString()} XP Calculation**\n• **Achieved Level:** ${level}\n• **Progress to Next:** ${(state.calcXp - currentLevelXP).toLocaleString()} / ${(nextLevelXP - currentLevelXP).toLocaleString()} XP`
            );
        }
    }

    const rows = [
        tabsRow('rewards'),
        new ActionRowBuilder().addComponents(
            btn(lang.fun.level.nav.calcTarget, 'level_calc_btn_target', 'sparkles', ButtonStyle.Primary),
            btn(lang.fun.level.nav.calcConverter, 'level_calc_btn_calc', 'settings', ButtonStyle.Secondary),
            btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
        )
    ];

    return {
        components: [buildCard(title, sections, rows, guild.iconURL({ dynamic: true, size: 128 }), 0xF59E0B)]
    };
}

async function renderAchievementsState(client, guild, state) {
    const targetUser = await client.users.fetch(state.targetUserId).catch(() => null);
    if (!targetUser) {
        return {
            components: [buildCard(
                `${getEmoji('cross')} User Error`,
                [`Could not fetch target user.`],
                [],
                null,
                0xFF0000
            )]
        };
    }

    const data = await levelingController.getUserRank(targetUser.id, guild.id);
    if (!data) {
        return {
            components: [buildCard(
                `${getEmoji('cross')} No Data Found`,
                [`No data available for achievements setup.`],
                [tabsRow('achievements')],
                null,
                0xFF4757
            )]
        };
    }

    const title = `${getEmoji('medal')} Achievements Dashboard`;
    const sections = [];
    const rows = [tabsRow('achievements')];

    rows.push(
        new ActionRowBuilder().addComponents(
            btn(lang.fun.level.nav.unlockedList, 'level_ach_tab_list', 'list', state.achievementMode === 'list' ? ButtonStyle.Danger : ButtonStyle.Secondary),
            btn(lang.fun.level.nav.yourProgress, 'level_ach_tab_progress', 'trend', state.achievementMode === 'progress' ? ButtonStyle.Danger : ButtonStyle.Secondary),
            btn(lang.fun.level.nav.allRequirements, 'level_ach_tab_overview', 'document', state.achievementMode === 'overview' ? ButtonStyle.Danger : ButtonStyle.Secondary)
        )
    );

    const per = 5;
    if (state.achievementMode === 'list') {
        const unlocked = data.achievements || [];
        const total = levelingController.achievements.length;
        const totalPages = Math.max(1, Math.ceil(unlocked.length / per));
        const page = Math.max(1, Math.min(state.achievementPage, totalPages));
        state.achievementPage = page;

        const start = (page - 1) * per;
        const slice = unlocked.slice(start, start + per);

        const listLines = slice.map(a => {
            const achName = levelingController.achievements.find(ach => ach.id === a.id)?.name || a.id;
            return `• **${achName}** - Unlocked <t:${Math.floor(new Date(a.unlockedAt).getTime() / 1000)}:R>`;
        }).join('\n') || '_No achievements unlocked yet._';

        sections.push(
            `### **Unlocked Achievements (Page ${page}/${totalPages})**\n${listLines}\n\n**Total Progress:** ${unlocked.length}/${total} unlocked.`
        );

        if (totalPages > 1) {
            rows.push(
                new ActionRowBuilder().addComponents(
                    btn(lang.fun.level.nav.previous, 'level_ach_prev', 'back', ButtonStyle.Secondary, page <= 1),
                    btn(lang.fun.level.nav.next, 'level_ach_next', 'next', ButtonStyle.Secondary, page >= totalPages),
                    btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
                )
            );
        } else {
            rows.push(
                new ActionRowBuilder().addComponents(
                    btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
                )
            );
        }

    } else if (state.achievementMode === 'progress') {
        const total = levelingController.achievements.length;
        const totalPages = Math.max(1, Math.ceil(total / per));
        const page = Math.max(1, Math.min(state.achievementPage, totalPages));
        state.achievementPage = page;

        const start = (page - 1) * per;
        const slice = levelingController.achievements.slice(start, start + per);

        const progressLines = slice.map(ach => {
            const unlocked = data.achievements.find(a => a.id === ach.id);
            if (unlocked) return `${getEmoji('tick')} **${ach.name}** – Complete!`;
            
            let prog = 0;
            switch (ach.type) {
                case 'levels': prog = data.level; break;
                case 'messages': prog = data.messageCount; break;
                case 'voice_minutes': prog = data.voiceStats?.totalMinutes || 0; break;
                case 'streak': prog = data.streaks?.daily || 0; break;
            }
            const unit = { levels: 'levels', messages: 'msgs', voice_minutes: 'mins', streak: 'days' }[ach.type] || '';
            return `▪️ **${ach.name}** – ${prog.toLocaleString()} / ${ach.requirement.toLocaleString()} ${unit}`;
        }).join('\n');

        sections.push(
            `### **Achievements Progress (Page ${page}/${totalPages})**\n${progressLines}`
        );

        if (totalPages > 1) {
            rows.push(
                new ActionRowBuilder().addComponents(
                    btn(lang.fun.level.nav.previous, 'level_ach_prev', 'back', ButtonStyle.Secondary, page <= 1),
                    btn(lang.fun.level.nav.next, 'level_ach_next', 'next', ButtonStyle.Secondary, page >= totalPages),
                    btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
                )
            );
        } else {
            rows.push(
                new ActionRowBuilder().addComponents(
                    btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
                )
            );
        }

    } else {
        const total = levelingController.achievements.length;
        const totalPages = Math.max(1, Math.ceil(total / per));
        const page = Math.max(1, Math.min(state.achievementPage, totalPages));
        state.achievementPage = page;

        const start = (page - 1) * per;
        const slice = levelingController.achievements.slice(start, start + per);

        const overviewLines = slice.map(a => {
            const unit = { levels: 'levels', messages: 'msgs', voice_minutes: 'mins', streak: 'days' }[a.type] || '';
            return `• **${a.name}**\n  *${a.description}* (Req: ${a.requirement.toLocaleString()} ${unit})`;
        }).join('\n');

        sections.push(
            `### **All Achievements Directory (Page ${page}/${totalPages})**\n${overviewLines}`
        );

        if (totalPages > 1) {
            rows.push(
                new ActionRowBuilder().addComponents(
                    btn(lang.fun.level.nav.previous, 'level_ach_prev', 'back', ButtonStyle.Secondary, page <= 1),
                    btn(lang.fun.level.nav.next, 'level_ach_next', 'next', ButtonStyle.Secondary, page >= totalPages),
                    btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
                )
            );
        } else {
            rows.push(
                new ActionRowBuilder().addComponents(
                    btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
                )
            );
        }
    }

    return {
        components: [buildCard(title, sections, rows, targetUser.displayAvatarURL({ dynamic: true, size: 128 }), 0x22C55E)]
    };
}

async function renderSystemState(client, guild, state) {
    const title = `${getEmoji('info')} Leveling System Information`;
    const sections = [
        `** Text Activity XP**\n• Earn random XP per chat message sent.\n• Earn bonus XP for message length and attachments.\n• Cooldown prevents rapid spamming.`,
        `** Voice Activity XP**\n• Earn XP per minute spent active in voice chats.\n• Streaming, camera sharing, and multi-user chat multipliers apply.`,
        `** Server Features**\n• Earn level milestone roles.\n• Unlock server achievements and track daily streaks.\n• Double XP multipliers enabled during weekends!`
    ];
    const rows = [
        tabsRow('system'),
        new ActionRowBuilder().addComponents(
            btn(lang.fun.level.nav.close, 'level_close', 'stop', ButtonStyle.Danger)
        )
    ];

    return {
        components: [buildCard(title, sections, rows, guild.iconURL({ dynamic: true, size: 128 }), 0x10B981)]
    };
}

async function renderState(client, guild, state) {
    switch (state.mode) {
        case 'leaderboard':
            return await renderLeaderboardState(client, guild, state);
        case 'rewards':
            return await renderRewardsState(client, guild, state);
        case 'achievements':
            return await renderAchievementsState(client, guild, state);
        case 'system':
            return await renderSystemState(client, guild, state);
        case 'rank':
        default:
            return await renderRankState(client, guild, state);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Complete leveling system commands')
        .addSubcommand(sub => sub
            .setName('rank')
            .setDescription('View your or someone else\'s professional rank card')
            .addUserOption(opt => opt.setName('user').setDescription('User to view rank for').setRequired(false))
            .addStringOption(opt => opt.setName('theme')
                .setDescription('Professional rank card theme')
                .addChoices(
                    { name: 'Default - Professional Blue', value: 'default' },
                    { name: 'Dark - Sleek Black', value: 'dark' },
                    { name: 'Neon - Cyberpunk Style', value: 'neon' },
                    { name: 'Minimal - Clean White', value: 'minimal' },
                    { name: 'Gaming - Elite Red', value: 'gaming' }
                )
                .setRequired(false))
            .addBooleanOption(opt => opt.setName('detailed').setDescription('Show detailed statistics in embed').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('leaderboard')
            .setDescription('View server leveling leaderboards')
            .addStringOption(opt => opt.setName('type')
                .setDescription('Type of leaderboard to display')
                .addChoices(
                    { name: 'Total XP - Overall Rankings', value: 'xp' },
                    { name: 'Weekly XP - This Week', value: 'weekly' },
                    { name: 'Voice Time - Most Active', value: 'voice_time' },
                    { name: 'Voice XP - Voice Rankings', value: 'voice_xp' },
                    { name: 'Messages - Chat Activity', value: 'messages' },
                    { name: 'Daily Streak - Consistency', value: 'streak' }
                )
                .setRequired(false))
            .addIntegerOption(opt => opt.setName('page').setDescription('Page number to view').setMinValue(1).setMaxValue(10).setRequired(false)))
        .addSubcommand(sub => sub
            .setName('xp-needed')
            .setDescription('Check XP needed for next level or specific level')
            .addUserOption(opt => opt.setName('user').setDescription('User to check (defaults to you)').setRequired(false))
            .addIntegerOption(opt => opt.setName('target-level').setDescription('Specific level to check XP requirement for').setMinValue(1).setMaxValue(1000).setRequired(false)))
        .addSubcommand(sub => sub
            .setName('rewards')
            .setDescription('Check what rewards are available at different levels')
            .addIntegerOption(opt => opt.setName('level').setDescription('Specific level to check rewards for').setMinValue(1).setMaxValue(1000).setRequired(false)))
        .addSubcommand(sub => sub
            .setName('calculator')
            .setDescription('Calculate XP and level relationships')
            .addIntegerOption(opt => opt.setName('level').setDescription('Level to calculate total XP for').setMinValue(1).setMaxValue(1000).setRequired(false))
            .addIntegerOption(opt => opt.setName('xp').setDescription('XP amount to calculate level for').setMinValue(0).setMaxValue(10000000).setRequired(false)))
        .addSubcommand(sub => sub
            .setName('system')
            .setDescription('View leveling system information and statistics'))
        .addSubcommand(sub => sub
            .setName('achievement-list')
            .setDescription('List unlocked achievements for a user')
            .addUserOption(opt => opt.setName('user').setDescription('User to check (defaults to you)').setRequired(false))
            .addIntegerOption(opt => opt.setName('page').setDescription('Page number').setMinValue(1).setMaxValue(10).setRequired(false)))
        .addSubcommand(sub => sub
            .setName('achievement-progress')
            .setDescription('Show progress toward all achievements for a user')
            .addUserOption(opt => opt.setName('user').setDescription('User to check (defaults to you)').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('achievement-overview')
            .setDescription('See every achievement and its requirement')),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('level_')) return false;

        const modalSession = interaction.isModalSubmit() ? parseDashboardModalId(interaction.customId) : null;
        const messageId = modalSession?.messageId || interaction.message?.id;
        if (!messageId) {
            await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.fun.level.session.expired}`);
            return true;
        }
        const clickerId = interaction.user.id;
        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) return false;

        
        if (interaction.customId === 'level_close') {
            const session = sessionManager.get(messageId);
            if (!session) {
                await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.fun.level.session.expired}`);
                return true;
            }
            if (clickerId !== session.state.userId) {
                await replyUnauthorized(interaction, session.state.userId, 'level');
                return true;
            }

            sessionManager.close(messageId);
            const closedCard = buildCard(
                `${getEmoji('warning')} ${lang.fun.level.panel.closedTitle}`,
                [lang.fun.level.session.closed],
                [],
                null,
                0xFF4757
            );
            await closeAndAutoDelete(interaction, closedCard);
            return true;
        }

        
        const session = sessionManager.get(messageId);
        if (!session) {
            await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.fun.level.session.expired}`);
            return true;
        }

        
        if (clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, session.state.userId, 'level');
            return true;
        }

        const { state } = session;
        const customId = modalSession?.baseCustomId || interaction.customId;

        
        if (interaction.isModalSubmit()) {
            try {
                await interaction.deferUpdate();
            } catch {
                await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.fun.level.session.expired}`);
                return true;
            }
            sessionManager.touch(client, interaction.channelId, messageId);

            if (customId === 'level_calc_modal_target') {
                const targetLvl = parseInt(interaction.fields.getTextInputValue('target_level'), 10);
                if (isNaN(targetLvl) || targetLvl < 1 || targetLvl > 1000) {
                    await interaction.followUp({ content: `${getEmoji('cross')} ${lang.fun.level.modal.invalidLevel}`, flags: MessageFlags.Ephemeral }).catch(() => {});
                    return true;
                }
                state.targetLevel = targetLvl;
                state.calcLevel = null;
                state.calcXp = null;
            } else if (customId === 'level_calc_modal_xp') {
                const valInput = interaction.fields.getTextInputValue('calc_value');
                const modeInput = interaction.fields.getTextInputValue('calc_mode').toLowerCase();

                const parsedVal = parseInt(valInput, 10);
                if (isNaN(parsedVal) || parsedVal < 0) {
                    await interaction.followUp({ content: `${getEmoji('cross')} ${lang.fun.level.modal.invalidNumeric}`, flags: MessageFlags.Ephemeral }).catch(() => {});
                    return true;
                }

                if (modeInput.includes('level')) {
                    state.calcLevel = parsedVal;
                    state.calcXp = null;
                    state.targetLevel = null;
                } else {
                    state.calcXp = parsedVal;
                    state.calcLevel = null;
                    state.targetLevel = null;
                }
            }

            try {
                const payload = await renderState(client, guild, state);
                const dashboardMessage = await resolveDashboardMessage(interaction, session, messageId);
                if (dashboardMessage) await dashboardMessage.edit({ ...payload, flags: MessageFlags.IsComponentsV2 });
            } catch (error) {
                console.error('[Level Modal Submit Error]:', error);
                await interaction.followUp({
                    content: 'Your level panel could not refresh. Please reopen it and try again.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
            return true;
        }

        
        try {
            if (interaction.customId === 'level_calc_btn_target' || 
                interaction.customId === 'level_calc_btn_calc') {
                
            } else {
                await interaction.deferUpdate();
            }
        } catch {
            return true;
        }

        sessionManager.touch(client, interaction.channelId, messageId);
        await cacheCommandIds(client, interaction).catch(() => { });

        
        if (customId.startsWith('level_tab_')) {
            state.mode = customId.split('_')[2];
            state.selectingMember = false;
        }

        
        else if (customId === 'level_rank_toggle_detail') {
            state.detailed = !state.detailed;
        } else if (customId === 'level_rank_select_member') {
            state.selectingMember = true;
        } else if (customId === 'level_rank_back_select') {
            state.selectingMember = false;
        } else if (customId === 'level_rank_user_select') {
            state.targetUserId = interaction.values[0];
            state.selectingMember = false;
        } else if (customId === 'level_rank_select_theme') {
            state.theme = interaction.values[0] || 'default';
        }

        
        else if (customId === 'level_leaderboard_select_type') {
            state.leaderboardType = interaction.values[0] || 'xp';
            state.leaderboardPage = 1;
        } else if (customId === 'level_leaderboard_prev') {
            state.leaderboardPage = Math.max(1, state.leaderboardPage - 1);
        } else if (customId === 'level_leaderboard_next') {
            state.leaderboardPage = state.leaderboardPage + 1;
        } else if (customId === 'level_leaderboard_first') {
            state.leaderboardPage = 1;
        }

        
        else if (customId === 'level_ach_tab_list') {
            state.achievementMode = 'list';
            state.achievementPage = 1;
        } else if (customId === 'level_ach_tab_progress') {
            state.achievementMode = 'progress';
            state.achievementPage = 1;
        } else if (customId === 'level_ach_tab_overview') {
            state.achievementMode = 'overview';
            state.achievementPage = 1;
        } else if (customId === 'level_ach_prev') {
            state.achievementPage = Math.max(1, state.achievementPage - 1);
        } else if (customId === 'level_ach_next') {
            state.achievementPage = state.achievementPage + 1;
        }

        
        else if (customId === 'level_calc_btn_target') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('level_calc_modal_target', messageId))
                .setTitle(lang.fun.level.modal.calcTargetTitle);

            const lvlInput = new TextInputBuilder()
                .setCustomId('target_level')
                .setLabel(lang.fun.level.modal.targetLevelLabel)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(lang.fun.level.modal.targetLevelPlaceholder)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(lvlInput));
            await interaction.showModal(modal).catch(() => replyEphemeral(interaction, lang.fun.level.modal.errorOpening || 'Could not open that form. Please try again.'));
            return true;
        } else if (customId === 'level_calc_btn_calc') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('level_calc_modal_xp', messageId))
                .setTitle(lang.fun.level.modal.converterTitle);

            const valInput = new TextInputBuilder()
                .setCustomId('calc_value')
                .setLabel(lang.fun.level.modal.numericValueLabel)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(lang.fun.level.modal.numericValuePlaceholder)
                .setRequired(true);

            const modeInput = new TextInputBuilder()
                .setCustomId('calc_mode')
                .setLabel(lang.fun.level.modal.calcModeLabel)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(lang.fun.level.modal.calcModePlaceholder)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(valInput),
                new ActionRowBuilder().addComponents(modeInput)
            );
            await interaction.showModal(modal).catch(() => replyEphemeral(interaction, lang.fun.level.modal.errorOpening || 'Could not open that form. Please try again.'));
            return true;
        }

        try {
            const payload = await renderState(client, guild, state);
            await interaction.message.edit({ ...payload, flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error('[Level Component Error]:', err.message);
        }

        return true;
    },

    async execute(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
        } catch (err) {
            console.error('[Level] deferReply failed:', err.message);
            return;
        }

        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            const errorContainer = cards.serverRequired();
            const payload = { components: [errorContainer], flags: MessageFlags.IsComponentsV2 };
            if (isSlash) {
                await interaction.editReply(payload).catch(() => { });
            } else {
                await interaction.reply(payload).catch(() => { });
            }
            return;
        }

        await cacheCommandIds(client, interaction).catch(() => { });

        let subcommand = 'rank';
        let targetUser = isSlash ? (interaction.options.getUser('user') || interaction.user) : interaction.author;
        let theme = 'default';
        let detailed = false;
        let leaderboardType = 'xp';
        let leaderboardPage = 1;
        let targetLevel = null;
        let calcLevel = null;
        let calcXp = null;
        let achievementMode = 'list';

        if (isSlash) {
            subcommand = interaction.options.getSubcommand(false) || 'rank';
            if (subcommand === 'rank') {
                targetUser = interaction.options.getUser('user') || interaction.user;
                theme = interaction.options.getString('theme') || 'default';
                detailed = interaction.options.getBoolean('detailed') || false;
            } else if (subcommand === 'leaderboard') {
                leaderboardType = interaction.options.getString('type') || 'xp';
                leaderboardPage = interaction.options.getInteger('page') || 1;
            } else if (subcommand === 'xp-needed') {
                targetUser = interaction.options.getUser('user') || interaction.user;
                targetLevel = interaction.options.getInteger('target-level');
                subcommand = 'rewards';
            } else if (subcommand === 'rewards') {
                targetLevel = interaction.options.getInteger('level');
            } else if (subcommand === 'calculator') {
                calcLevel = interaction.options.getInteger('level');
                calcXp = interaction.options.getInteger('xp');
                subcommand = 'rewards';
            } else if (subcommand === 'system') {
                subcommand = 'system';
            } else if (subcommand === 'achievement-list') {
                targetUser = interaction.options.getUser('user') || interaction.user;
                leaderboardPage = interaction.options.getInteger('page') || 1;
                subcommand = 'achievements';
                achievementMode = 'list';
            } else if (subcommand === 'achievement-progress') {
                targetUser = interaction.options.getUser('user') || interaction.user;
                subcommand = 'achievements';
                achievementMode = 'progress';
            } else if (subcommand === 'achievement-overview') {
                subcommand = 'achievements';
                achievementMode = 'overview';
            }
        } else {
            const args = String(interaction.content || '').split(' ').slice(1);
            const argSub = args[0]?.toLowerCase();
            const validSubs = ['rank', 'leaderboard', 'xp-needed', 'rewards', 'calculator', 'system', 'achievement-list', 'achievement-progress', 'achievement-overview'];
            
            if (validSubs.includes(argSub)) {
                subcommand = argSub;
                if (subcommand === 'rank') {
                    targetUser = await resolveUser(interaction.guild, args[1]) || interaction.author;
                    theme = args[2] || 'default';
                } else if (subcommand === 'leaderboard') {
                    leaderboardType = args[1] || 'xp';
                    leaderboardPage = parseInt(args[2], 10) || 1;
                } else if (subcommand === 'xp-needed') {
                    targetUser = await resolveUser(interaction.guild, args[1]) || interaction.author;
                    targetLevel = parseInt(args[2], 10) || null;
                    subcommand = 'rewards';
                } else if (subcommand === 'rewards') {
                    targetLevel = parseInt(args[1], 10) || null;
                } else if (subcommand === 'calculator') {
                    const calcVal = parseInt(args[1], 10) || null;
                    if (calcVal) {
                        if (calcVal < 1000) calcLevel = calcVal;
                        else calcXp = calcVal;
                    }
                    subcommand = 'rewards';
                } else if (subcommand === 'system') {
                    subcommand = 'system';
                } else if (subcommand === 'achievement-list') {
                    targetUser = await resolveUser(interaction.guild, args[1]) || interaction.author;
                    leaderboardPage = parseInt(args[2], 10) || 1;
                    subcommand = 'achievements';
                    achievementMode = 'list';
                } else if (subcommand === 'achievement-progress') {
                    targetUser = await resolveUser(interaction.guild, args[1]) || interaction.author;
                    subcommand = 'achievements';
                    achievementMode = 'progress';
                } else if (subcommand === 'achievement-overview') {
                    subcommand = 'achievements';
                    achievementMode = 'overview';
                }
            } else if (args[0]) {
                targetUser = await resolveUser(interaction.guild, args[0]) || interaction.author;
                subcommand = 'rank';
            }
        }

        const state = {
            mode: subcommand,
            userId: isSlash ? interaction.user.id : interaction.author.id,
            targetUserId: targetUser.id,
            theme,
            detailed,
            leaderboardType,
            leaderboardPage,
            achievementPage: subcommand === 'achievements' ? leaderboardPage : 1,
            achievementMode,
            targetLevel,
            calcLevel,
            calcXp,
            selectingMember: false
        };

        try {
            const payload = await renderState(client, guild, state);
            const msgPayload = { ...payload, flags: MessageFlags.IsComponentsV2 };

            const message = (interaction.deferred || interaction.replied)
                ? await interaction.editReply(msgPayload)
                : await interaction.reply({ ...msgPayload, fetchReply: true });

            if (message) {
                sessionManager.open(client, interaction.channelId, message.id, state);
            }
        } catch (err) {
            console.error('[Level Initial Render Error]:', err.message);
            const errPayload = { content: 'Failed to initialize the leveling dashboard.', components: [] };
            if (interaction.deferred || interaction.replied) {
                interaction.editReply(errPayload).catch(() => { });
            } else {
                interaction.reply(errPayload).catch(() => { });
            }
        }
    }
};
