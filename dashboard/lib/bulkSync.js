

const modules = [
    { name: 'welcome', fn: (shim) => require('../modules/welcome/welcome').sendAllWelcomeConfigs(shim) },
    { name: 'tickets', fn: (shim) => require('../modules/ticket/tickets').sendAllTicketConfigs(shim) },
    { name: 'applications', fn: (shim) => require('../modules/applications/appModule').sendAllApplicationConfigs(shim) },
    { name: 'quarantine', fn: (shim) => require('../modules/quarantine/quarantine').sendAllQuarantineConfigs(shim) },
    { name: 'inviteTracker', fn: (shim) => require('../modules/invitetracker/inviteTracker').sendAllInviteTrackerConfigs(shim) },
    { name: 'gateVerification', fn: (shim) => require('../modules/gateVerification/gateVerification').sendAllVerificationConfigs(shim) },
    { name: 'rolenick', fn: (shim) => require('../modules/rolenickname/rolenickname').sendAllRoleNickConfigs(shim) },
    { name: 'aiChat', fn: (shim) => require('../modules/aichat/aiChat').sendAllAiChatConfigs(shim) },
    { name: 'commands', fn: (shim) => require('../modules/commands/commands').sendAllDisabledCommands(shim) },
    { name: 'autoresponders', fn: (shim) => require('../modules/autoresponses/autoResponder').sendAllAutoResponderConfigs(shim) },
    { name: 'autovoice', fn: (shim) => require('../modules/autoVoice/autoVoice').sendAllAutoVoiceConfigs(shim) },
    { name: 'customcommands', fn: (shim) => require('../modules/customcommands/customCommands').sendAllCustomCommands(shim) },
    { name: 'serverlogs', fn: (shim) => require('../modules/serverlogs/serverLogs').sendAllServerLogConfigs(shim) },
    { name: 'truthordare', fn: (shim) => require('../modules/truthordare/truthordare').sendAllTruthOrDareConfigs(shim) },
    { name: 'leave', fn: (shim) => require('../modules/leave/leave').sendAllLeaveConfigs(shim) },
    { name: 'suggestions', fn: (shim) => require('../modules/suggestions/suggestions').sendAllSuggestionConfigs(shim) },
    { name: 'nqn', fn: (shim) => require('../modules/nqn/nqn').sendAllNqnConfigs(shim) },
    { name: 'autorole', fn: (shim) => require('../modules/autorole/autorole').sendAllAutoroleConfigs(shim) },
    { name: 'hentai', fn: (shim) => require('../modules/hentai/hentai').sendAllHentaiConfigs(shim) },
    { name: 'commandlogs', fn: (shim) => require('../modules/commandlogs/commandlogs').sendAllCommandLogsConfigs(shim) },
    { name: 'afk', fn: (shim) => require('../modules/afk/afk').sendAllAFKData(shim) },
    { name: 'giveaway', fn: (shim) => require('../modules/giveaway/giveaway').sendAllGiveawayData(shim) },
    { name: 'reactionroles', fn: (shim) => require('../modules/reactionroles/reactionroles').sendAllReactionRoleData(shim) },
    { name: 'serverstats', fn: (shim) => require('../modules/serverstats/serverstats').sendAllServerStatsData(shim) },
    { name: 'protection', fn: (shim) => require('../modules/protection/protection').sendAllProtectionData(shim) },
    { name: 'antiSystem', fn: (shim) => require('../modules/antiSystem/antiSystem').sendAllAntiSystemData(shim) },
    { name: 'birthday', fn: (shim) => require('../modules/birthday/birthday').sendAllBirthdayConfigs(shim) },
    { name: 'boost', fn: (shim) => require('../modules/boost/boost').sendAllBoostConfigs(shim) },
    { name: 'counting', fn: (shim) => require('../modules/counting/counting').sendAllCountingConfigs(shim) },
    { name: 'faq', fn: (shim) => require('../modules/faq/faq').sendAllFaqConfigs(shim) },
    { name: 'leveling', fn: (shim) => require('../modules/leveling/leveling').sendAllLevelingConfigs(shim) },
    { name: 'modmail', fn: (shim) => require('../modules/modmail/modmail').sendAllModmailConfigs(shim) },
    { name: 'notifications', fn: (shim) => require('../modules/notifications/notifications').sendAllNotificationConfigs(shim) },
    { name: 'rules', fn: (shim) => require('../modules/rules/rules').sendAllRulesData(shim) },
    { name: 'stickymessage', fn: (shim) => require('../modules/stickymessage/stickymessage').sendAllStickyMessageConfigs(shim) },
    { name: 'embeds', fn: (shim) => require('../modules/embeds/embeds').sendAllEmbedsData(shim) },
    { name: 'guildMeta', fn: (shim) => require('../guild/guildData').sendAllGuildData(shim), guildIdKey: 'serverId' },
    { name: 'serverConfig', fn: (shim) => require('../modules/serverconfig/serverConfig').sendAllServerConfigs(shim), guildIdKey: 'serverId' },
];

async function collectBulkSyncPayloads(configBus, guilds) {
    const results = await Promise.allSettled(
        modules.map(({ name, fn, guildIdKey }) => fn(configBus.legacySyncShim(name, guildIdKey)))
    );

    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            console.error(`❌ Bulk sync failed for module "${modules[i].name}":`, result.reason);
        }
    });
}

module.exports = { collectBulkSyncPayloads, modules };
