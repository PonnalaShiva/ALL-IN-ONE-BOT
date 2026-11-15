

'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    ActionRowBuilder,
    ButtonStyle,
    MessageFlags,
    StringSelectMenuBuilder,
} = require('discord.js');
const rawLang = require('../../events/loadLanguage');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const {
    createSessionManager,
    buildCard,
    cards,
    btn,
    linkBtn,
    closeBtn,
    deferUpdate,
    deferReply,
    sendV2,
    editV2,
    closeAndAutoDelete,
    replyUnauthorized,
    replyEphemeral,
    ACCENT, createInterpolatableProxy, card
} = require('../../UI');

const lang = { ...rawLang, time: createInterpolatableProxy(rawLang.time) };

const activeTimers = new Map();
const activeReminders = new Map();
const activeStopwatches = new Map();
const activePomodoros = new Map();
const activeIntervals = new Map();


const sessions = createSessionManager({
    ttlMs: 10 * 60 * 1000,
    buildExpiredCard: () => cards.error(
        lang.time.panel.expiredTitle({ emoji: getEmoji('warning') }),
        lang.time.panel.expiredDesc
    ),
});

async function notifyExpiration(client, userId, channelId, title, desc, accent) {
    const alertCard = card(title, [desc], [], accent);

    
    const ch = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
    if (ch) {
        await ch.send({ content: `<@${userId}>` }).catch(() => { });
        await ch.send({
            components: [alertCard],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => { });
    }

    
    const user = client.users.cache.get(userId) || await client.users.fetch(userId).catch(() => null);
    if (user) {
        await user.send({
            components: [alertCard],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => { });
    }
}

function startTimerTask(client, userId, channelId, name, minutes) {
    const timerId = `${userId}-timer-${Date.now()}`;
    const durationMs = minutes * 60 * 1000;
    const endTime = Date.now() + durationMs;

    const timeout = setTimeout(async () => {
        if (activeTimers.has(timerId)) {
            activeTimers.delete(timerId);
            await notifyExpiration(
                client, userId, channelId,
                lang.time.notifications.timerCompletedTitle({ emoji: getEmoji('time') }),
                lang.time.notifications.timerCompletedDesc({ name, minutes }),
                ACCENT.success
            );
        }
    }, durationMs);

    activeTimers.set(timerId, { id: timerId, userId, name, duration: minutes, startTime: Date.now(), endTime, timeout });
    return timerId;
}

function startReminderTask(client, userId, channelId, task, minutes) {
    const reminderId = `${userId}-reminder-${Date.now()}`;
    const durationMs = minutes * 60 * 1000;
    const endTime = Date.now() + durationMs;

    const timeout = setTimeout(async () => {
        if (activeReminders.has(reminderId)) {
            activeReminders.delete(reminderId);
            await notifyExpiration(
                client, userId, channelId,
                lang.time.notifications.reminderTriggeredTitle({ emoji: getEmoji('warning') }),
                lang.time.notifications.reminderTriggeredDesc({ task, minutes }),
                ACCENT.info
            );
        }
    }, durationMs);

    activeReminders.set(reminderId, { id: reminderId, userId, task, duration: minutes, startTime: Date.now(), endTime, timeout });
    return reminderId;
}

function startPomodoroTask(client, userId, channelId, workMin, breakMin) {
    const pomoId = `${userId}-pomo-${Date.now()}`;

    const runPomo = async () => {
        
        const workTimeout = setTimeout(async () => {
            const current = activePomodoros.get(pomoId);
            if (!current) return;

            
            await notifyExpiration(
                client, userId, channelId,
                lang.time.notifications.pomoFocusCompleteTitle,
                lang.time.notifications.pomoFocusCompleteDesc({ minutes: breakMin }),
                ACCENT.success
            );

            current.phase = 'break';
            current.endTime = Date.now() + (breakMin * 60 * 1000);

            const breakTimeout = setTimeout(async () => {
                if (activePomodoros.has(pomoId)) {
                    activePomodoros.delete(pomoId);
                    await notifyExpiration(
                        client, userId, channelId,
                        lang.time.notifications.pomoRestCompleteTitle,
                        lang.time.notifications.pomoRestCompleteDesc,
                        ACCENT.info
                    );
                }
            }, breakMin * 60 * 1000);

            current.timeout = breakTimeout;
        }, workMin * 60 * 1000);

        activePomodoros.set(pomoId, {
            id: pomoId,
            userId,
            workDuration: workMin,
            breakDuration: breakMin,
            phase: 'work',
            startTime: Date.now(),
            endTime: Date.now() + (workMin * 60 * 1000),
            timeout: workTimeout,
        });
    };

    runPomo();
    return pomoId;
}

function startIntervalTask(client, userId, channelId, message, minutes, maxCount) {
    const intId = `${userId}-interval-${Date.now()}`;
    let currentCount = 0;

    const interval = setInterval(async () => {
        const current = activeIntervals.get(intId);
        if (!current) {
            clearInterval(interval);
            return;
        }

        currentCount++;
        current.currentCount = currentCount;

        await notifyExpiration(
            client, userId, channelId,
            lang.time.notifications.intervalAlertTitle,
            lang.time.notifications.intervalAlertDesc({ count: currentCount, message, minutes }),
            ACCENT.warning
        );

        if (maxCount > 0 && currentCount >= maxCount) {
            clearInterval(interval);
            activeIntervals.delete(intId);
            await notifyExpiration(
                client, userId, channelId,
                lang.time.notifications.intervalCompleteTitle,
                lang.time.notifications.intervalCompleteDesc({ count: maxCount }),
                ACCENT.info
            );
        }
    }, minutes * 60 * 1000);

    activeIntervals.set(intId, { id: intId, userId, message, duration: minutes, maxCount, currentCount: 0, intervalObj: interval });
    return intId;
}

function stopUserTimeTasks(userId, type = 'all') {
    let stopped = 0;

    if (type === 'timer' || type === 'all') {
        for (const [key, timer] of activeTimers.entries()) {
            if (timer.userId === userId) {
                clearTimeout(timer.timeout);
                activeTimers.delete(key);
                stopped++;
            }
        }
    }
    if (type === 'reminder' || type === 'all') {
        for (const [key, reminder] of activeReminders.entries()) {
            if (reminder.userId === userId) {
                clearTimeout(reminder.timeout);
                activeReminders.delete(key);
                stopped++;
            }
        }
    }
    if (type === 'pomodoro' || type === 'all') {
        for (const [key, pomo] of activePomodoros.entries()) {
            if (pomo.userId === userId) {
                clearTimeout(pomo.timeout);
                activePomodoros.delete(key);
                stopped++;
            }
        }
    }
    if (type === 'interval' || type === 'all') {
        for (const [key, intv] of activeIntervals.entries()) {
            if (intv.userId === userId) {
                clearInterval(intv.intervalObj);
                activeIntervals.delete(key);
                stopped++;
            }
        }
    }
    if (type === 'stopwatch' || type === 'all') {
        if (activeStopwatches.has(userId)) {
            activeStopwatches.delete(userId);
            stopped++;
        }
    }

    return stopped;
}

function tabsRow(active) {
    const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
    return new ActionRowBuilder().addComponents(
        btn(lang.time.nav.overview, 'time_tab_overview', 'home', s('overview')),
        btn(lang.time.nav.timerRemind, 'time_tab_timer', 'time', s('timer')),
        btn(lang.time.nav.pomodoro, 'time_tab_pomodoro', 'rocket', s('pomodoro')),
        btn(lang.time.nav.stopwatch, 'time_tab_stopwatch', 'stop', s('stopwatch'))
    );
}

function quickTimerSelectRow(current) {
    const curVal = String(current || '5');
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('time_sel_timer_dur').setPlaceholder(lang.time.select.quickTimerPlaceholder).addOptions([
            { label: lang.time.select.min1, value: '1', emoji: getButtonEmoji('time'), default: curVal === '1' },
            { label: lang.time.select.min5, value: '5', emoji: getButtonEmoji('time'), default: curVal === '5' },
            { label: lang.time.select.min15, value: '15', emoji: getButtonEmoji('time'), default: curVal === '15' },
            { label: lang.time.select.min30, value: '30', emoji: getButtonEmoji('time'), default: curVal === '30' },
            { label: lang.time.select.hour1, value: '60', emoji: getButtonEmoji('time'), default: curVal === '60' },
            { label: lang.time.select.hour2, value: '120', emoji: getButtonEmoji('time'), default: curVal === '120' },
        ])
    );
}

function quickReminderSelectRow(current) {
    const curVal = String(current || '5');
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('time_sel_remind_dur').setPlaceholder(lang.time.select.quickReminderPlaceholder).addOptions([
            { label: lang.time.select.min5, value: '5', emoji: getButtonEmoji('warning'), default: curVal === '5' },
            { label: lang.time.select.min15, value: '15', emoji: getButtonEmoji('warning'), default: curVal === '15' },
            { label: lang.time.select.min30, value: '30', emoji: getButtonEmoji('warning'), default: curVal === '30' },
            { label: lang.time.select.hour1, value: '60', emoji: getButtonEmoji('warning'), default: curVal === '60' },
            { label: lang.time.select.hour3, value: '180', emoji: getButtonEmoji('warning'), default: curVal === '180' },
        ])
    );
}

function quickReminderTaskSelectRow(current) {
    const curVal = String(current || 'Drink Water');
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('time_sel_remind_task').setPlaceholder(lang.time.select.taskPlaceholder).addOptions([
            { label: lang.time.select.taskDrinkWater, value: 'Drink Water', emoji: getButtonEmoji('heart'), default: curVal === 'Drink Water' },
            { label: lang.time.select.taskTakeBreak, value: 'Take a Break', emoji: getButtonEmoji('home'), default: curVal === 'Take a Break' },
            { label: lang.time.select.taskStretch, value: 'Stretch', emoji: getButtonEmoji('sparkles'), default: curVal === 'Stretch' },
            { label: lang.time.select.taskReviewCode, value: 'Review Code', emoji: getButtonEmoji('document'), default: curVal === 'Review Code' },
            { label: lang.time.select.taskMeeting, value: 'Meeting Start', emoji: getButtonEmoji('groupusers'), default: curVal === 'Meeting Start' },
            { label: lang.time.select.taskSleepRest, value: 'Sleep/Rest', emoji: getButtonEmoji('time'), default: curVal === 'Sleep/Rest' },
        ])
    );
}

function timerCreatorControlsRow() {
    return new ActionRowBuilder().addComponents(
        btn(lang.time.nav.startTimer, 'time_btn_create_timer', 'tick', ButtonStyle.Success),
        btn(lang.time.nav.startReminder, 'time_btn_create_remind', 'star', ButtonStyle.Success),
        btn(lang.time.nav.stopAllActive, 'time_btn_stop_all', 'delete', ButtonStyle.Danger),
        closeBtn(lang.time.nav.closePanel, 'time_close')
    );
}

function pomodoroDurationSelectRow(currentWork, currentBreak) {
    const curVal = `${currentWork || 25}:${currentBreak || 5}`;
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('time_sel_pomo_dur').setPlaceholder(lang.time.select.pomoDurPlaceholder).addOptions([
            { label: lang.time.select.pomo25_5, value: '25:5', emoji: getButtonEmoji('rocket'), default: curVal === '25:5' },
            { label: lang.time.select.pomo15_3, value: '15:3', emoji: getButtonEmoji('rocket'), default: curVal === '15:3' },
            { label: lang.time.select.pomo45_10, value: '45:10', emoji: getButtonEmoji('rocket'), default: curVal === '45:10' },
            { label: lang.time.select.pomo60_15, value: '60:15', emoji: getButtonEmoji('rocket'), default: curVal === '60:15' },
        ])
    );
}

function stopwatchControlsRow(stopwatchActive, isPaused) {
    const row = new ActionRowBuilder();
    if (!stopwatchActive) {
        row.addComponents(btn(lang.time.nav.startStopwatch, 'time_btn_sw_toggle', 'play', ButtonStyle.Success));
    } else {
        row.addComponents(
            btn(isPaused ? lang.time.nav.resume : lang.time.nav.pause, 'time_btn_sw_toggle', isPaused ? 'play' : 'pause', isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
            btn(lang.time.nav.lap, 'time_btn_sw_lap', 'document', ButtonStyle.Primary),
            btn(lang.time.nav.reset, 'time_btn_sw_reset', 'loop', ButtonStyle.Danger)
        );
    }
    row.addComponents(closeBtn(lang.time.nav.closePanel, 'time_close'));
    return row;
}

function viewOverview(client, state) {
    const now = new Date();
    const utcTime = now.toUTCString();

    
    const formatZone = z => {
        try {
            return now.toLocaleTimeString('en-US', { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        } catch { return 'N/A'; }
    };

    const userTimers = Array.from(activeTimers.values()).filter(t => t.userId === state.userId);
    const userReminders = Array.from(activeReminders.values()).filter(r => r.userId === state.userId);
    const hasSw = activeStopwatches.has(state.userId);
    const hasPomo = activePomodoros.has(state.userId);

    return card(
        lang.time.panel.overviewTitle({ emoji: getEmoji('time') }),
        [
            `### ${lang.time.content.worldClockHeading({ emoji: getEmoji('world') })}\n${lang.time.content.utc({ time: utcTime })}\n${lang.time.content.newYork({ time: formatZone('America/New_York') })}\n${lang.time.content.london({ time: formatZone('Europe/London') })}\n${lang.time.content.tokyo({ time: formatZone('Asia/Tokyo') })}\n${lang.time.content.kolkata({ time: formatZone('Asia/Kolkata') })}`,
            `### ${lang.time.content.activeSummaryHeading({ emoji: getEmoji('analytics') })}\n${lang.time.content.timersRunning({ count: userTimers.length })}\n${lang.time.content.remindersConfigured({ count: userReminders.length })}\n${lang.time.content.stopwatchStatus({ status: hasSw ? lang.time.content.active : lang.time.content.inactive })}\n${lang.time.content.pomodoroRunning({ status: hasPomo ? lang.time.content.yes : lang.time.content.no })}`,
            lang.time.content.tabPrompt({ emoji: getEmoji('info') }),
        ],
        [
            tabsRow('overview'),
            new ActionRowBuilder().addComponents(
                linkBtn(lang.time.nav.supportServer, 'support', 'https://discord.gg/xQF9f9yUEM'),
                closeBtn(lang.time.nav.closePanel, 'time_close')
            )
        ],
        ACCENT.primary
    );
}

function viewTimer(state) {
    const userTimers = Array.from(activeTimers.values()).filter(t => t.userId === state.userId);
    const userReminders = Array.from(activeReminders.values()).filter(r => r.userId === state.userId);

    const timerList = userTimers.length
        ? userTimers.map((t, idx) => `**${idx + 1}.** \`${t.name}\` \u2012 Ends <t:${Math.floor(t.endTime / 1000)}:R> (<t:${Math.floor(t.endTime / 1000)}:T>)`).join('\n')
        : lang.time.content.noTimers;

    const reminderList = userReminders.length
        ? userReminders.map((r, idx) => `**${idx + 1}.** \`${r.task}\` \u2012 Triggering <t:${Math.floor(r.endTime / 1000)}:R> (<t:${Math.floor(r.endTime / 1000)}:T>)`).join('\n')
        : lang.time.content.noReminders;

    return card(
        lang.time.panel.timerTitle({ emoji: getEmoji('time') }),
        [
            `### ${lang.time.content.quickConfigsHeading({ emoji: getEmoji('settings') })}\n${lang.time.content.quickTimerSelected({ minutes: state.quickTimerDuration })}\n${lang.time.content.quickReminderSelected({ minutes: state.quickReminderDuration, task: state.quickReminderTask })}`,
            `### ${lang.time.content.activeTimersHeading}\n${timerList}`,
            `### ${lang.time.content.activeRemindersHeading}\n${reminderList}`,
        ],
        [
            tabsRow('timer'),
            quickTimerSelectRow(state.quickTimerDuration),
            quickReminderSelectRow(state.quickReminderDuration),
            quickReminderTaskSelectRow(state.quickReminderTask),
            timerCreatorControlsRow()
        ],
        ACCENT.warning
    );
}

function viewPomodoro(state) {
    const userPomo = activePomodoros.get(state.userId);

    let statusText;
    let color = ACCENT.danger;
    let pomoControls = [];

    if (userPomo) {
        const isWork = userPomo.phase === 'work';
        color = isWork ? ACCENT.danger : ACCENT.success;
        statusText = lang.time.content.activePomoSession({
            phase: isWork ? lang.time.content.phaseFocus : lang.time.content.phaseRest,
            work: userPomo.workDuration,
            breakMin: userPomo.breakDuration,
            endTime: Math.floor(userPomo.endTime / 1000),
        });
        pomoControls = [
            btn(lang.time.nav.stopSession, 'time_btn_pomo_stop', 'delete', ButtonStyle.Danger),
            closeBtn(lang.time.nav.closePanel, 'time_close')
        ];
    } else {
        statusText = lang.time.content.startPomoText;
        pomoControls = [
            btn(lang.time.nav.startPomodoro, 'time_btn_pomo_start', 'play', ButtonStyle.Success),
            closeBtn(lang.time.nav.closePanel, 'time_close')
        ];
    }

    return card(
        lang.time.panel.pomodoroTitle,
        [
            statusText,
            `### ${lang.time.content.focusCycleSettings({ emoji: getEmoji('info') })}\n${lang.time.content.currentPresetSelected({ work: state.pomoWork, breakMin: state.pomoBreak })}`,
        ],
        [
            tabsRow('pomodoro'),
            pomodoroDurationSelectRow(state.pomoWork, state.pomoBreak),
            new ActionRowBuilder().addComponents(pomoControls)
        ],
        color
    );
}

function viewStopwatch(state) {
    const sw = activeStopwatches.get(state.userId);
    let swText = '';
    let color = ACCENT.secondary || 0x9B59B6;

    if (sw) {
        const elapsed = sw.isPaused ? sw.elapsed : Date.now() - sw.startTime;
        const totalSec = Math.floor(elapsed / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const ms = Math.floor((elapsed % 1000) / 10);
        const lapList = sw.laps.length
            ? sw.laps.map((l, i) => lang.time.content.lapItem({ num: i + 1, lap: l })).join('\n')
            : lang.time.content.noLaps;

        const timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        swText = `### ${lang.time.content.runningSwHeading}\n${lang.time.content.swCurrentTime({ time: timeStr })}\n${lang.time.content.swStatus({ status: sw.isPaused ? lang.time.content.swPaused : lang.time.content.swRecording })}\n${lang.time.content.swStarted({ time: Math.floor(sw.absoluteStart / 1000) })}\n\n### ${lang.time.content.lapRecordsHeading}\n${lapList}`;
    } else {
        swText = lang.time.content.swInactiveHeading;
    }

    return card(
        lang.time.panel.stopwatchTitle,
        [swText],
        [
            tabsRow('stopwatch'),
            stopwatchControlsRow(Boolean(sw), sw?.isPaused)
        ],
        color
    );
}

function renderState(client, state) {
    switch (state.mode) {
        case 'timer': return [viewTimer(state)];
        case 'pomodoro': return [viewPomodoro(state)];
        case 'stopwatch': return [viewStopwatch(state)];
        default: return [viewOverview(client, state)];
    }
}

function applyInteraction(client, customId, values, state, channelId) {
    
    if (customId === 'time_tab_overview') return Object.assign(state, { mode: 'overview' });
    if (customId === 'time_tab_timer') return Object.assign(state, { mode: 'timer' });
    if (customId === 'time_tab_pomodoro') return Object.assign(state, { mode: 'pomodoro' });
    if (customId === 'time_tab_stopwatch') return Object.assign(state, { mode: 'stopwatch' });

    
    if (customId === 'time_sel_timer_dur') {
        state.quickTimerDuration = parseInt(values[0]) || 5;
        return;
    }
    if (customId === 'time_sel_remind_dur') {
        state.quickReminderDuration = parseInt(values[0]) || 5;
        return;
    }
    if (customId === 'time_sel_remind_task') {
        state.quickReminderTask = String(values[0] || 'Drink Water');
        return;
    }
    if (customId === 'time_sel_pomo_dur') {
        const parts = String(values[0] || '25:5').split(':');
        state.pomoWork = parseInt(parts[0]) || 25;
        state.pomoBreak = parseInt(parts[1]) || 5;
        return;
    }

    
    if (customId === 'time_btn_create_timer') {
        startTimerTask(client, state.userId, channelId, `Quick Timer (${state.quickTimerDuration}m)`, state.quickTimerDuration);
        return;
    }
    if (customId === 'time_btn_create_remind') {
        startReminderTask(client, state.userId, channelId, state.quickReminderTask, state.quickReminderDuration);
        return;
    }
    if (customId === 'time_btn_stop_all') {
        stopUserTimeTasks(state.userId, 'all');
        return;
    }

    
    if (customId === 'time_btn_pomo_start') {
        if (!activePomodoros.has(state.userId)) {
            startPomodoroTask(client, state.userId, channelId, state.pomoWork, state.pomoBreak);
        }
        return;
    }
    if (customId === 'time_btn_pomo_stop') {
        stopUserTimeTasks(state.userId, 'pomodoro');
        return;
    }

    
    if (customId === 'time_btn_sw_toggle') {
        const sw = activeStopwatches.get(state.userId);
        if (!sw) {
            activeStopwatches.set(state.userId, {
                startTime: Date.now(),
                absoluteStart: Date.now(),
                elapsed: 0,
                isPaused: false,
                laps: []
            });
        } else {
            if (sw.isPaused) {
                sw.startTime = Date.now() - sw.elapsed;
                sw.isPaused = false;
            } else {
                sw.elapsed = Date.now() - sw.startTime;
                sw.isPaused = true;
            }
        }
        return;
    }
    if (customId === 'time_btn_sw_lap') {
        const sw = activeStopwatches.get(state.userId);
        if (sw) {
            const elapsed = sw.isPaused ? sw.elapsed : Date.now() - sw.startTime;
            const totalSec = Math.floor(elapsed / 1000);
            const min = Math.floor(totalSec / 60);
            const sec = totalSec % 60;
            const ms = Math.floor((elapsed % 1000) / 10);
            const formatted = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
            sw.laps.push(formatted);
        }
        return;
    }
    if (customId === 'time_btn_sw_reset') {
        activeStopwatches.delete(state.userId);
        return;
    }
}

async function handleComponent(interaction) {
    if (!interaction.customId?.startsWith('time_')) return false;

    const messageId = interaction.message.id;
    const clickerId = interaction.user.id;

    
    if (interaction.customId === 'time_close') {
        const session = sessions.get(messageId);
        if (session && clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, lang.time.session.unauthorized({ emoji: getEmoji('cross'), userId: session.state.userId }));
            return true;
        }

        await deferUpdate(interaction);
        sessions.delete(messageId);

        const closed = cards.info(
            lang.time.panel.closedTitle({ emoji: getEmoji('warning') }),
            lang.time.panel.closedDesc
        );
        await closeAndAutoDelete(interaction, closed, 2000);
        return true;
    }

    const session = sessions.get(messageId);
    if (!session) {
        await replyEphemeral(interaction, lang.time.session.expired({ emoji: getEmoji('warning') }));
        return true;
    }

    if (clickerId !== session.state.userId) {
        await replyUnauthorized(interaction, lang.time.session.unauthorized({ emoji: getEmoji('cross'), userId: session.state.userId }));
        return true;
    }

    await deferUpdate(interaction);
    sessions.touch(interaction.client, interaction.channelId, messageId);

    const { state } = session;
    try {
        applyInteraction(interaction.client, interaction.customId, interaction.values ?? [], state, interaction.channelId);
    } catch (e) {
        console.error('[Time] applyInteraction error:', e);
        return true;
    }

    try {
        const components = renderState(interaction.client, state);
        await editV2(interaction, components);
    } catch (err) {
        console.error('[Time] message.edit error:', err);
        try {
            const errCard = card(
                lang.time.panel.renderErrorTitle({ emoji: getEmoji('warning') }),
                [`\`${String(err.message || '').slice(0, 120)}\``, lang.time.panel.renderErrorSub],
                [tabsRow(state.mode || 'overview')],
                ACCENT.danger
            );
            await editV2(interaction, errCard);
        } catch { }
    }

    return true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Advanced dashboard to manage timers, reminders, stopwatches, and pomodoro focus')
        .addStringOption(o =>
            o.setName('view')
                .setDescription('Select default dashboard starting view')
                .setRequired(false)
                .addChoices(
                    { name: 'Overview Clock', value: 'overview' },
                    { name: 'Timer Setup', value: 'timer' },
                    { name: 'Pomodoro Focus', value: 'pomodoro' },
                    { name: 'Stopwatch Details', value: 'stopwatch' }
                ))
        .addIntegerOption(o =>
            o.setName('timer_minutes')
                .setDescription('Start a quick timer with these minutes')
                .setRequired(false))
        .addStringOption(o =>
            o.setName('reminder_task')
                .setDescription('Task title for quick reminder (needs minutes option below)')
                .setRequired(false))
        .addIntegerOption(o =>
            o.setName('reminder_minutes')
                .setDescription('Minutes for the quick reminder task')
                .setRequired(false)),

    aliases: ['timer', 'remind', 'stopwatch', 't', 'pomo', 'pomodoro'],
    category: 'utility',
    description: 'Advanced dashboard to manage timers, reminders, stopwatches, pomodoro, and world timezone info',
    handleComponent,

    async execute(interaction, args = []) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await deferReply(interaction);
            }
        } catch (err) {
            console.error('[Time] deferReply failed:', err.message);
            return;
        }

        const client = interaction.client;
        const channelId = interaction.channelId;
        const userId = isSlash ? interaction.user.id : interaction.author.id;

        
        let initialMode = 'overview';
        if (isSlash) {
            const rawView = interaction.options.getString('view');
            if (rawView) initialMode = rawView;
        } else if (args && args.length > 0) {
            const sub = args[0].toLowerCase();
            if (sub === 'timer') initialMode = 'timer';
            else if (sub === 'pomo' || sub === 'pomodoro') initialMode = 'pomodoro';
            else if (sub === 'sw' || sub === 'stopwatch') initialMode = 'stopwatch';
            else if (sub === 'stop') {
                stopUserTimeTasks(userId, args[1] || 'all');
            }
        }

        
        const state = {
            mode: initialMode,
            userId,
            quickTimerDuration: 5,
            quickReminderDuration: 5,
            quickReminderTask: 'Drink Water',
            pomoWork: 25,
            pomoBreak: 5
        };

        
        if (isSlash) {
            const timerMin = interaction.options.getInteger('timer_minutes');
            if (timerMin && timerMin > 0) {
                startTimerTask(client, userId, channelId, `Timer (${timerMin}m)`, timerMin);
                state.mode = 'timer';
            }

            const remindTask = interaction.options.getString('reminder_task');
            const remindMin = interaction.options.getInteger('reminder_minutes');
            if (remindTask && remindMin && remindMin > 0) {
                startReminderTask(client, userId, channelId, remindTask, remindMin);
                state.mode = 'timer';
            }
        }

        try {
            const components = renderState(client, state);
            const message = await sendV2(interaction, components);
            if (message) sessions.open(client, channelId, message.id, state);
        } catch (err) {
            console.error('[Time] Initial render failed:', err.message);
            const errCard = cards.error(
                lang.time.panel.loadError({ emoji: getEmoji('cross') })
            );
            await sendV2(interaction, errCard);
        }
    }
};

