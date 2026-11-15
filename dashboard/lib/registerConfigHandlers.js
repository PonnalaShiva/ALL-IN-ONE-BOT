

const configBus = require('./configBus');
const client = require('../../main');


const afkModule = require('../modules/afk/afk');
const aiChatModule = require('../modules/aichat/aiChat');
const antiSystemModule = require('../modules/antiSystem/antiSystem');
const applicationModule = require('../modules/applications/appModule');
const autoResponderModule = require('../modules/autoresponses/autoResponder');
const autoroleModule = require('../modules/autorole/autorole');
const autoVoiceModule = require('../modules/autoVoice/autoVoice');
const birthdayModule = require('../modules/birthday/birthday');
const boostModule = require('../modules/boost/boost');
const commandLogsModule = require('../modules/commandlogs/commandlogs');
const commandModule = require('../modules/commands/commands');
const countingModule = require('../modules/counting/counting');
const customCommandsModule = require('../modules/customcommands/customCommands');
const embedsModule = require('../modules/embeds/embeds');
const faqModule = require('../modules/faq/faq');
const gateVerificationModule = require('../modules/gateVerification/gateVerification');
const geminiModule = require('../modules/gemini/gemini');
const giveawayModule = require('../modules/giveaway/giveaway');
const hentaiModule = require('../modules/hentai/hentai');
const inviteTrackerModule = require('../modules/invitetracker/inviteTracker');
const leaveModule = require('../modules/leave/leave');
const levelingModule = require('../modules/leveling/leveling');
const modmailModule = require('../modules/modmail/modmail');
const notificationModule = require('../modules/notifications/notifications');
const nqnModule = require('../modules/nqn/nqn');
const protectionModule = require('../modules/protection/protection');
const quarantineModule = require('../modules/quarantine/quarantine');
const reactionRoleModule = require('../modules/reactionroles/reactionroles');
const roleNickModule = require('../modules/rolenickname/rolenickname');
const rulesModule = require('../modules/rules/rules');
const serverConfigModule = require('../modules/serverconfig/serverConfig');
const serverLogsModule = require('../modules/serverlogs/serverLogs');
const serverStatsModule = require('../modules/serverstats/serverstats');
const stickyMessageModule = require('../modules/stickymessage/stickymessage');
const suggestionModule = require('../modules/suggestions/suggestions');
const ticketModule = require('../modules/ticket/tickets');
const truthOrDareModule = require('../modules/truthordare/truthordare');
const welcomeModule = require('../modules/welcome/welcome');
const guildDataModule = require('../guild/guildData');

function register(socketRef) {
    const s = () => socketRef();

    
    configBus.register('afk', 'set', (serverId, p) => afkModule.setUserAFK(p.userId, serverId, p.reason, p.options || {}, s()));
    configBus.register('afk', 'remove', (serverId, p) => afkModule.removeUserAFK(p.userId, serverId, s()));
    configBus.register('afk', 'get', (serverId, p) => afkModule.getUserAFK(p.userId, serverId, s()));
    configBus.register('afkList', 'get', (serverId, p) => afkModule.getAllServerAFK(serverId, p.options || {}, s()));
    configBus.register('afkStats', 'get', (serverId) => afkModule.getAFKStats(serverId, s()));
    configBus.register('afk', 'updateAutoResponse', (serverId, p) => afkModule.updateAutoResponse(p.userId, serverId, p.settings, s()));

    
    configBus.register('aiChat', 'get', (serverId) => aiChatModule.getAiChatConfig(serverId, s()));
    configBus.register('aiChat', 'setup', (serverId, p) => aiChatModule.setupAiChat(serverId, p.channelId, p.isEnabled, p.userId, s()));
    configBus.register('aiChat', 'update', (serverId, p) => aiChatModule.updateAiChat(serverId, p.updateData || {}, p.userId, s()));
    configBus.register('aiChat', 'enable', (serverId, p) => aiChatModule.enableAiChat(serverId, p.userId, s()));
    configBus.register('aiChat', 'disable', (serverId, p) => aiChatModule.disableAiChat(serverId, p.userId, s()));
    configBus.register('aiChat', 'delete', (serverId) => aiChatModule.deleteAiChat(serverId, s()));
    configBus.register('aiChat', 'toggle', (serverId, p) => aiChatModule.toggleAiChat(serverId, p.userId, s()));
    configBus.register('aiChatStats', 'get', (serverId) => aiChatModule.getAiChatStats(serverId, s()));

    
    configBus.register('antiSystem', 'get', (serverId) => antiSystemModule.getAntiConfig(serverId, s()));
    configBus.register('antiSystem', 'reset', (serverId) => antiSystemModule.resetAntiConfig(serverId, s()));
    configBus.register('antiSystem', 'toggleSpam', (serverId, p) => antiSystemModule.toggleAntiSpam(serverId, p.enabled, s()));
    configBus.register('antiSystem', 'toggleLink', (serverId, p) => antiSystemModule.toggleAntiLink(serverId, p.enabled, s()));
    configBus.register('antiSystem', 'toggleRaid', (serverId, p) => antiSystemModule.toggleAntiRaid(serverId, p.enabled, s()));
    configBus.register('antiSystem', 'toggleNuke', (serverId, p) => antiSystemModule.toggleAntiNuke(serverId, p.enabled, s()));
    configBus.register('antiSystem', 'updateSpam', (serverId, p) => antiSystemModule.updateAntiSpamSettings(serverId, p.settings, s()));
    configBus.register('antiSystem', 'updateLink', (serverId, p) => antiSystemModule.updateAntiLinkSettings(serverId, p.settings, s()));
    configBus.register('antiSystem', 'updateRaid', (serverId, p) => antiSystemModule.updateAntiRaidSettings(serverId, p.settings, s()));
    configBus.register('antiSystem', 'updateNuke', (serverId, p) => antiSystemModule.updateAntiNukeSettings(serverId, p.settings, s()));
    configBus.register('antiSystem', 'updateLogging', (serverId, p) => antiSystemModule.updateLoggingSettings(serverId, p.settings, s()));
    configBus.register('antiSystem', 'addWhitelist', (serverId, p) => antiSystemModule.addToWhitelist(serverId, p.type, p.id, s()));
    configBus.register('antiSystem', 'removeWhitelist', (serverId, p) => antiSystemModule.removeFromWhitelist(serverId, p.type, p.id, s()));
    configBus.register('antiSystemThreatScores', 'get', (serverId, p) => antiSystemModule.getThreatScores(serverId, p.options || {}, s()));
    configBus.register('antiSystem', 'getUserThreatScore', (serverId, p) => antiSystemModule.getUserThreatScore(serverId, p.userId, s()));
    configBus.register('antiSystem', 'resetUserThreatScore', (serverId, p) => antiSystemModule.resetUserThreatScore(serverId, p.userId, s()));
    configBus.register('antiSystemViolations', 'get', (serverId, p) => antiSystemModule.getViolations(serverId, p.options || {}, s()));
    configBus.register('antiSystemViolations', 'getStats', (serverId) => antiSystemModule.getViolationStats(serverId, s()));
    configBus.register('antiSystemViolations', 'clear', (serverId, p) => antiSystemModule.clearViolationHistory(serverId, p.options || {}, s()));
    configBus.register('antiSystem', 'setSystemMode', (serverId, p) => antiSystemModule.setSystemMode(serverId, p.mode, p.reason, s()));

    
    configBus.register('applications', 'create', (serverId, p) => applicationModule.createApplication(serverId, p.appName, p.mainChannel, p.responseChannel, s()));
    configBus.register('applications', 'updateChannels', (serverId, p) => applicationModule.updateApplicationChannels(serverId, p.appName, p.mainChannel, p.responseChannel, s()));
    configBus.register('applications', 'activate', (serverId, p) => applicationModule.activateApplication(serverId, p.appName, s()));
    configBus.register('applications', 'deactivate', (serverId, p) => applicationModule.deactivateApplication(serverId, p.appName, s()));
    configBus.register('applications', 'addQuestion', (serverId, p) => applicationModule.addApplicationQuestion(serverId, p.appName, p.questionData, s()));
    configBus.register('applications', 'updateQuestion', (serverId, p) => applicationModule.updateApplicationQuestion(serverId, p.appName, p.questionId, p.updates, s()));
    configBus.register('applications', 'removeQuestion', (serverId, p) => applicationModule.removeApplicationQuestion(serverId, p.appName, p.questionId, s()));
    configBus.register('applications', 'delete', (serverId, p) => applicationModule.deleteApplication(serverId, p.appName, s()));
    configBus.register('applications', 'disableSystem', (serverId) => applicationModule.disableApplicationSystem(serverId, s()));
    configBus.register('applications', 'get', (serverId) => applicationModule.getApplicationsByServer(serverId, s()));

    
    configBus.register('autoresponders', 'create', (serverId, p) => autoResponderModule.createOrUpdateAutoResponder(p.userId, serverId, p.trigger, p.textResponse, p.embedData, p.matchType, p.channels, p.status, s()));
    configBus.register('autoresponders', 'delete', (serverId, p) => autoResponderModule.deleteAutoResponder(p.userId, serverId, p.autoResponderId, s()));
    configBus.register('autoresponders', 'activate', (serverId, p) => autoResponderModule.activateAutoResponder(serverId, p.autoResponderId, s()));
    configBus.register('autoresponders', 'deactivate', (serverId, p) => autoResponderModule.deactivateAutoResponder(serverId, p.autoResponderId, s()));
    configBus.register('autoresponders', 'update', (serverId, p) => autoResponderModule.updateAutoResponder(serverId, p.autoResponderId, p.updateData, s()));
    configBus.register('autoresponders', 'get', (serverId) => autoResponderModule.getAutoRespondersByServer(serverId, s()));
    configBus.register('autoresponders', 'disableSystem', (serverId) => autoResponderModule.disableAutoResponderSystem(serverId, s()));

    
    configBus.register('autorole', 'setup', (serverId, p) => autoroleModule.setupAutoroleSystem(serverId, p, s()));
    configBus.register('autorole', 'update', (serverId, p) => autoroleModule.updateAutoroleConfig(serverId, p, s()));
    configBus.register('autorole', 'get', (serverId) => autoroleModule.getAutoroleConfig(serverId, s()));
    configBus.register('autorole', 'toggle', (serverId) => autoroleModule.toggleAutoroleStatus(serverId, s()));
    configBus.register('autorole', 'delete', (serverId) => autoroleModule.deleteAutoroleConfig(serverId, s()));

    
    configBus.register('autovoice', 'create', (serverId, p) => autoVoiceModule.createOrUpdateAutoVoice(serverId, p.voiceChannelId, p.managerChannelId, p.allowedRoleIds, p.status, p.ownerId, s()));
    configBus.register('autovoice', 'delete', (serverId) => autoVoiceModule.deleteAutoVoice(serverId, s()));
    configBus.register('autovoice', 'activate', (serverId) => autoVoiceModule.activateAutoVoice(serverId, s()));
    configBus.register('autovoice', 'deactivate', (serverId) => autoVoiceModule.deactivateAutoVoice(serverId, s()));
    configBus.register('autovoice', 'update', (serverId, p) => autoVoiceModule.updateAutoVoice(serverId, p.updateData, s()));
    configBus.register('autovoice', 'get', (serverId) => autoVoiceModule.getAutoVoiceConfig(serverId, s()));
    configBus.register('autovoiceTemp', 'get', (serverId) => autoVoiceModule.getTemporaryChannels(serverId, s()));
    configBus.register('autovoiceTemp', 'forceDelete', (serverId, p) => autoVoiceModule.forceDeleteTemporaryChannel(serverId, p.channelId, s()));
    configBus.register('autovoice', 'refreshPanel', (serverId) => autoVoiceModule.refreshControlPanel(serverId, s()));
    configBus.register('autovoice', 'cleanup', (serverId) => autoVoiceModule.cleanupTemporaryChannels(serverId, s()));
    configBus.register('autovoiceStats', 'get', (serverId) => autoVoiceModule.getAutoVoiceStats(serverId, s()));

    
    configBus.register('birthday', 'get', (serverId) => birthdayModule.getBirthdayConfig(serverId, s()));
    configBus.register('birthday', 'setup', (serverId, p) => birthdayModule.setupBirthdaySystem(serverId, p, s()));
    configBus.register('birthday', 'update', (serverId, p) => birthdayModule.updateBirthdayConfig(serverId, p, s()));
    configBus.register('birthday', 'delete', (serverId) => birthdayModule.deleteBirthdayConfig(serverId, s()));
    configBus.register('birthdayUpcoming', 'get', (serverId, p) => birthdayModule.getUpcomingBirthdays(serverId, p.days, s()));

    
    configBus.register('boost', 'get', (serverId) => boostModule.getBoostConfig(serverId, s()));
    configBus.register('boost', 'setup', (serverId, p) => boostModule.setupBoostSystem(serverId, p, s()));
    configBus.register('boost', 'update', (serverId, p) => boostModule.updateBoostConfig(serverId, p, s()));
    configBus.register('boost', 'delete', (serverId) => boostModule.deleteBoostConfig(serverId, s()));

    
    configBus.register('commandlogs', 'setup', (serverId, p) => commandLogsModule.setupCommandLogsSystem(serverId, p, s()));
    configBus.register('commandlogs', 'update', (serverId, p) => commandLogsModule.updateCommandLogsConfig(serverId, p, s()));
    configBus.register('commandlogs', 'get', (serverId) => commandLogsModule.getCommandLogsConfig(serverId, s()));
    configBus.register('commandlogs', 'toggle', (serverId) => commandLogsModule.toggleCommandLogsStatus(serverId, s()));
    configBus.register('commandlogs', 'delete', (serverId) => commandLogsModule.deleteCommandLogsConfig(serverId, s()));

    
    configBus.register('commands', 'getDisabled', (serverId) => commandModule.getDisabledCommands(serverId, s()));
    configBus.register('commands', 'disable', (serverId, p) => commandModule.disableCommand(serverId, p.commandName, p.subcommandName, s()));
    configBus.register('commands', 'enable', (serverId, p) => commandModule.enableCommand(serverId, p.commandName, p.subcommandName, s()));
    configBus.register('commands', 'toggle', (serverId, p) => commandModule.toggleCommand(serverId, p.commandName, p.subcommandName, s()));
    configBus.register('commands', 'enableAll', (serverId) => commandModule.enableAllCommands(serverId, s()));
    configBus.register('commandsStats', 'get', (serverId) => commandModule.getCommandStats(serverId, s()));

    
    configBus.register('counting', 'get', (serverId) => countingModule.getCountingConfig(serverId, s()));
    configBus.register('counting', 'setup', (serverId, p) => countingModule.setupCountingSystem(serverId, p, s()));
    configBus.register('counting', 'update', (serverId, p) => countingModule.updateCountingConfig(serverId, p, s()));
    configBus.register('counting', 'delete', (serverId) => countingModule.deleteCountingConfig(serverId, s()));
    configBus.register('counting', 'toggle', (serverId) => countingModule.toggleCountingStatus(serverId, s()));

    
    configBus.register('customcommands', 'get', (serverId) => customCommandsModule.getServerCustomCommands(serverId, s()));
    configBus.register('customcommands', 'createOrUpdate', (serverId, p) => customCommandsModule.createOrUpdateCustomCommand(serverId, p.userId, p.commandName, p.response, s()));
    configBus.register('customcommands', 'delete', (serverId, p) => customCommandsModule.deleteCustomCommand(serverId, p.commandName, p.isAdmin, s()));

    
    configBus.register('embeds', 'get', (serverId, p) => embedsModule.getEmbedsForServer(serverId, p.options || {}, s()));
    configBus.register('embeds', 'create', (serverId, p) => embedsModule.createEmbed(serverId, p.userId, p.embedData, s()));
    configBus.register('embeds', 'update', (serverId, p) => embedsModule.updateEmbed(p.embedId, serverId, p.userId, p.embedData, s()));
    configBus.register('embeds', 'delete', (serverId, p) => embedsModule.deleteEmbed(p.embedId, serverId, s()));
    configBus.register('embeds', 'clone', (serverId, p) => embedsModule.cloneEmbed(p.embedId, serverId, p.userId, p.newName, s()));
    configBus.register('embeds', 'send', (serverId, p) => embedsModule.sendEmbedToChannel(p.embedId, serverId, p.channelId, p.options || {}, s()));
    configBus.register('embedSchedules', 'get', (serverId) => embedsModule.getSchedulesForServer(serverId, s()));
    configBus.register('embedSchedules', 'create', (serverId, p) => embedsModule.createSchedule(serverId, p.userId, p.scheduleData, s()));
    configBus.register('embedSchedules', 'toggle', (serverId, p) => embedsModule.toggleSchedule(p.scheduleId, serverId, s()));
    configBus.register('embedSchedules', 'delete', (serverId, p) => embedsModule.deleteSchedule(p.scheduleId, serverId, s()));

    
    configBus.register('faq', 'get', (serverId) => faqModule.getFaqConfig(serverId, s()));
    configBus.register('faq', 'setup', (serverId, p) => faqModule.setupFaqSystem(serverId, p, s()));
    configBus.register('faq', 'update', (serverId, p) => faqModule.updateFaqConfig(serverId, p, s()));
    configBus.register('faq', 'toggle', (serverId) => faqModule.toggleFaqStatus(serverId, s()));
    configBus.register('faq', 'delete', (serverId) => faqModule.deleteFaqConfig(serverId, s()));

    
    configBus.register('gateVerification', 'get', (serverId) => gateVerificationModule.getVerificationConfig(serverId, s()));
    configBus.register('gateVerification', 'enable', (serverId, p) => gateVerificationModule.enableVerificationSystem(serverId, p.configData || {}, s()));
    configBus.register('gateVerification', 'disable', (serverId) => gateVerificationModule.disableVerificationSystem(serverId, s()));
    configBus.register('gateVerification', 'update', (serverId, p) => gateVerificationModule.updateVerificationConfig(serverId, p.updateData || {}, s()));
    configBus.register('gateVerification', 'delete', (serverId) => gateVerificationModule.deleteVerificationConfig(serverId, s()));
    configBus.register('gateVerificationStats', 'getStats', (serverId) => gateVerificationModule.getVerificationStats(serverId, s()));
    configBus.register('gateVerification', 'sendMessage', (serverId) => gateVerificationModule.sendVerificationMessage(serverId, s()));

    
    configBus.register('gemini', 'addKey', (serverId, p) => geminiModule.addGeminiApiKey({ ...p, serverId }, s()));
    configBus.register('gemini', 'removeKey', (serverId, p) => geminiModule.removeGeminiApiKey(p.keyId, serverId, s()));
    configBus.register('gemini', 'updateKey', (serverId, p) => geminiModule.updateGeminiApiKey(p.keyId, serverId, p.updates, s()));
    configBus.register('gemini', 'testKeys', (serverId, p) => geminiModule.testGeminiApiKeys(p.keyIds, serverId, s()));
    configBus.register('gemini', 'getAllKeys', (serverId, p) => geminiModule.getAllGeminiApiKeys(serverId, p.options || {}, s()));
    configBus.register('gemini', 'getKey', (serverId, p) => geminiModule.getGeminiApiKey(p.keyId, serverId, s()));
    configBus.register('geminiStats', 'get', (serverId) => geminiModule.getGeminiStats(serverId, s()));

    
    configBus.register('giveaway', 'create', (serverId, p) => giveawayModule.createGiveaway(serverId, p.options, s()));
    configBus.register('giveaway', 'update', (serverId, p) => giveawayModule.updateGiveaway(serverId, p.messageId, p.updates, client, s()));
    configBus.register('giveaway', 'delete', (serverId, p) => giveawayModule.deleteGiveaway(serverId, p.messageId, s()));
    configBus.register('giveaway', 'end', (serverId, p) => giveawayModule.endGiveaway(serverId, p.messageId, client, s()));
    configBus.register('giveaway', 'reroll', (serverId, p) => giveawayModule.rerollWinners(serverId, p.messageId, p.count, client, s()));
    configBus.register('giveaway', 'addParticipant', (serverId, p) => giveawayModule.addParticipant(serverId, p.messageId, p.userId, p.username, client, s()));
    configBus.register('giveaway', 'removeParticipant', (serverId, p) => giveawayModule.removeParticipant(serverId, p.messageId, p.userId, client, s()));
    configBus.register('giveaway', 'clearParticipants', (serverId, p) => giveawayModule.clearParticipants(serverId, p.messageId, client, s()));
    configBus.register('giveaway', 'toggleStatus', (serverId, p) => giveawayModule.toggleGiveawayStatus(serverId, p.messageId, p.status, client, s()));
    configBus.register('giveawayList', 'get', (serverId, p) => giveawayModule.getAllServerGiveaways(serverId, p.options || {}, s()));
    configBus.register('giveaway', 'get', (serverId, p) => giveawayModule.getGiveaway(serverId, p.messageId, s()));
    configBus.register('giveawayStats', 'get', (serverId) => giveawayModule.getGiveawayStats(serverId, s()));

    
    configBus.register('hentai', 'setup', (serverId, p) => hentaiModule.setupHentaiSystem(serverId, p, s()));
    configBus.register('hentai', 'update', (serverId, p) => hentaiModule.updateHentaiConfig(serverId, p, s()));
    configBus.register('hentai', 'get', (serverId) => hentaiModule.getHentaiConfig(serverId, s()));
    configBus.register('hentai', 'toggle', (serverId) => hentaiModule.toggleHentaiStatus(serverId, s()));
    configBus.register('hentai', 'delete', (serverId) => hentaiModule.deleteHentaiConfig(serverId, s()));

    
    configBus.register('inviteTracker', 'get', (serverId) => inviteTrackerModule.getInviteTrackerConfig(serverId, s()));
    configBus.register('inviteTracker', 'setup', (serverId, p) => inviteTrackerModule.setupInviteTracker(serverId, p.channelId, p.status, s()));
    configBus.register('inviteTracker', 'update', (serverId, p) => inviteTrackerModule.updateInviteTracker(serverId, p.updateData, s()));
    configBus.register('inviteTracker', 'enable', (serverId) => inviteTrackerModule.enableInviteTracker(serverId, s()));
    configBus.register('inviteTracker', 'disable', (serverId) => inviteTrackerModule.disableInviteTracker(serverId, s()));
    configBus.register('inviteTracker', 'delete', (serverId) => inviteTrackerModule.deleteInviteTracker(serverId, s()));
    configBus.register('inviteTracker', 'toggle', (serverId) => inviteTrackerModule.toggleInviteTracker(serverId, s()));
    configBus.register('inviteTrackerStats', 'get', (serverId) => inviteTrackerModule.getInviteTrackerStats(serverId, s()));
    configBus.register('inviteTracker', 'updateLogChannel', (serverId, p) => inviteTrackerModule.updateLogChannel(serverId, p.channelId, s()));

    
    configBus.register('leave', 'setup', (serverId, p) => leaveModule.setupLeaveSystem(serverId, p, s()));
    configBus.register('leave', 'update', (serverId, p) => leaveModule.updateLeaveConfig(serverId, p, s()));
    configBus.register('leave', 'get', (serverId) => leaveModule.getLeaveConfig(serverId, s()));
    configBus.register('leave', 'toggleChannel', (serverId, p) => leaveModule.toggleLeaveChannelStatus(serverId, p.status, s()));
    configBus.register('leave', 'toggleDm', (serverId, p) => leaveModule.toggleLeaveDMStatus(serverId, p.status, s()));
    configBus.register('leave', 'delete', (serverId) => leaveModule.deleteLeaveConfig(serverId, s()));

    
    configBus.register('leveling', 'get', (serverId) => levelingModule.getLevelingConfig(serverId, s()));
    configBus.register('leveling', 'setup', (serverId, p) => levelingModule.setupLevelingSystem(serverId, p, s()));
    configBus.register('leveling', 'update', (serverId, p) => levelingModule.updateLevelingConfig(serverId, p, s()));
    configBus.register('leveling', 'toggle', (serverId) => levelingModule.toggleLevelingStatus(serverId, s()));
    configBus.register('leveling', 'delete', (serverId) => levelingModule.deleteLevelingConfig(serverId, s()));

    
    configBus.register('modmail', 'get', (serverId) => modmailModule.getModmailConfig(serverId, s()));
    configBus.register('modmail', 'setup', (serverId, p) => modmailModule.setupModmailSystem(serverId, p, s()));
    configBus.register('modmail', 'update', (serverId, p) => modmailModule.updateModmailConfig(serverId, p, s()));
    configBus.register('modmail', 'toggle', (serverId) => modmailModule.toggleModmailStatus(serverId, s()));
    configBus.register('modmail', 'delete', (serverId) => modmailModule.deleteModmailConfig(serverId, s()));

    
    configBus.register('notifications', 'get', (serverId) => notificationModule.getNotificationConfigs(serverId, s()));
    configBus.register('notifications', 'setup', (serverId, p) => notificationModule.setupNotification(serverId, p, s()));
    configBus.register('notifications', 'update', (serverId, p) => notificationModule.updateNotification(serverId, p.notificationId, p.updates, s()));
    configBus.register('notifications', 'delete', (serverId, p) => notificationModule.deleteNotification(serverId, p.notificationId, s()));
    configBus.register('notifications', 'deleteAll', (serverId) => notificationModule.deleteAllNotifications(serverId, s()));

    
    configBus.register('nqn', 'setup', (serverId, p) => nqnModule.setupNqnSystem(serverId, p, s()));
    configBus.register('nqn', 'update', (serverId, p) => nqnModule.updateNqnConfig(serverId, p, s()));
    configBus.register('nqn', 'get', (serverId) => nqnModule.getNqnConfig(serverId, s()));
    configBus.register('nqn', 'toggle', (serverId) => nqnModule.toggleNqnStatus(serverId, s()));
    configBus.register('nqn', 'delete', (serverId) => nqnModule.deleteNqnConfig(serverId, s()));

    
    configBus.register('protectionLockRoles', 'get', (serverId) => protectionModule.getLockRoles(serverId, s()));
    configBus.register('protectionLockRoles', 'add', (serverId, p) => protectionModule.addLockRole(serverId, p.roleId, p.addedBy, s()));
    configBus.register('protectionLockRoles', 'remove', (serverId, p) => protectionModule.removeLockRole(serverId, p.roleId, s()));
    configBus.register('protectionLockRoles', 'toggleSystem', (serverId, p) => protectionModule.toggleLockRoleSystem(serverId, p.enabled, s()));
    configBus.register('protectionRolePersist', 'get', (serverId) => protectionModule.getRolePersistConfig(serverId, s()));
    configBus.register('protectionRolePersist', 'toggleSystem', (serverId, p) => protectionModule.toggleRolePersistSystem(serverId, p.enabled, s()));
    configBus.register('protectionRolePersist', 'remove', (serverId, p) => protectionModule.removeRolePersist(serverId, p.userId, s()));
    configBus.register('protectionBoycottBans', 'get', (serverId) => protectionModule.getBoycottBans(serverId, s()));
    configBus.register('protectionBoycottBans', 'add', (serverId, p) => protectionModule.addBoycottBan(serverId, p, s()));
    configBus.register('protectionBoycottBans', 'remove', (serverId, p) => protectionModule.removeBoycottBan(serverId, p.userId, s()));

    
    configBus.register('quarantine', 'get', (serverId) => quarantineModule.getQuarantineConfig(serverId, s()));
    configBus.register('quarantine', 'setup', (serverId, p) => quarantineModule.setupQuarantineSystem(serverId, p.configData || {}, s()));
    configBus.register('quarantine', 'disable', (serverId) => quarantineModule.disableQuarantineSystem(serverId, s()));
    configBus.register('quarantine', 'update', (serverId, p) => quarantineModule.updateQuarantineConfig(serverId, p.updateData || {}, s()));
    configBus.register('quarantine', 'delete', (serverId) => quarantineModule.deleteQuarantineConfig(serverId, s()));
    configBus.register('quarantineUsers', 'addUser', (serverId, p) => quarantineModule.addUserToQuarantine(serverId, p.userId, p.reason, p.moderatorId, s()));
    configBus.register('quarantineUsers', 'releaseUser', (serverId, p) => quarantineModule.releaseUserFromQuarantine(serverId, p.userId, s()));
    configBus.register('quarantineUsers', 'getQuarantinedUsers', (serverId) => quarantineModule.getQuarantinedUsers(serverId, s()));
    configBus.register('quarantineStats', 'getStats', (serverId) => quarantineModule.getQuarantineStats(serverId, s()));

    
    configBus.register('reactionroles', 'create', (serverId, p) => reactionRoleModule.createReactionRoleSetup(serverId, p.options, s()));
    configBus.register('reactionroles', 'update', (serverId, p) => reactionRoleModule.updateReactionRoleSetup(serverId, p.setupId, p.updates, s()));
    configBus.register('reactionroles', 'delete', (serverId, p) => reactionRoleModule.deleteReactionRoleSetup(serverId, p.setupId, s()));
    configBus.register('reactionrolesList', 'get', (serverId, p) => reactionRoleModule.getAllServerReactionRoles(serverId, p.options || {}, s()));
    configBus.register('reactionroles', 'get', (serverId, p) => reactionRoleModule.getReactionRoleSetup(serverId, p.setupId, s()));
    configBus.register('reactionrolesStats', 'get', (serverId) => reactionRoleModule.getReactionRoleStats(serverId, s()));

    
    configBus.register('rolenick', 'get', (serverId) => roleNickModule.getRoleNickConfig(serverId, s()));
    configBus.register('rolenick', 'add', (serverId, p) => roleNickModule.addRoleNickConfig(serverId, p.roleId, p.nicknameFormat, s()));
    configBus.register('rolenick', 'remove', (serverId, p) => roleNickModule.removeRoleNickConfig(serverId, p.roleId, s()));
    configBus.register('rolenick', 'clear', (serverId) => roleNickModule.clearRoleNickConfig(serverId, s()));
    configBus.register('rolenick', 'delete', (serverId) => roleNickModule.deleteRoleNickConfig(serverId, s()));
    configBus.register('rolenick', 'updateFormat', (serverId, p) => roleNickModule.updateRoleNickFormat(serverId, p.roleId, p.newFormat, s()));
    configBus.register('rolenickStats', 'get', (serverId) => roleNickModule.getRoleNickStats(serverId, s()));
    configBus.register('rolenick', 'applyToMember', (serverId, p) => roleNickModule.applyNicknameToMember(serverId, p.memberId, s()));

    
    configBus.register('rules', 'getTemplates', () => rulesModule.getRulesTemplates(s()));
    configBus.register('rules', 'send', (serverId, p) => rulesModule.sendRulesToChannel(serverId, p.channelId, p.embedData, p.options || {}, s()));

    
    configBus.register('serverConfig', 'get', (serverId) => serverConfigModule.getServerConfig(serverId, s()));
    configBus.register('serverConfig', 'update', (serverId, p) => serverConfigModule.updateServerConfig(serverId, p.configData || {}, s()));
    configBus.register('serverConfig', 'addManagers', (serverId, p) => serverConfigModule.addBotManagers(serverId, p.managerIds, s()));
    configBus.register('serverConfig', 'removeManagers', (serverId, p) => serverConfigModule.removeBotManagers(serverId, p.managerIds, s()));
    configBus.register('serverConfig', 'updatePrefix', (serverId, p) => serverConfigModule.updatePrefix(serverId, p.prefix, s()));
    configBus.register('serverConfig', 'reset', (serverId) => serverConfigModule.resetServerConfig(serverId, s()));
    configBus.register('serverConfig', 'delete', (serverId) => serverConfigModule.deleteServerConfig(serverId, s()));
    configBus.register('serverConfigStats', 'get', (serverId) => serverConfigModule.getServerConfigStats(serverId, s()));
    configBus.register('serverConfig', 'checkBotManager', (serverId, p) => serverConfigModule.checkBotManager(serverId, p.userId, s()));

    
    configBus.register('serverlogs', 'get', (serverId) => serverLogsModule.getServerLogConfig(serverId, s()));
    configBus.register('serverlogs', 'setupEvent', (serverId, p) => serverLogsModule.setupEventLogging(serverId, p.eventType, p.channelId, s()));
    configBus.register('serverlogs', 'setupAll', (serverId, p) => serverLogsModule.setupAllEventsLogging(serverId, p.channelId, s()));
    configBus.register('serverlogs', 'updateEvent', (serverId, p) => serverLogsModule.updateLogConfig(serverId, p.eventType, p.channelId, s()));
    configBus.register('serverlogs', 'deleteEvent', (serverId, p) => serverLogsModule.deleteLogConfig(serverId, p.eventType, s()));
    configBus.register('serverlogsStats', 'get', (serverId) => serverLogsModule.getServerLogStats(serverId, s()));
    configBus.register('serverlogs', 'clearAll', (serverId) => serverLogsModule.clearAllLogConfigs(serverId, s()));

    
    configBus.register('serverstats', 'get', (serverId) => serverStatsModule.sendServerStatsData(serverId, s()));
    configBus.register('serverstats', 'setup', (serverId, p) => serverStatsModule.setupServerStats(serverId, p.options || {}, s()));
    configBus.register('serverstats', 'removeChannel', (serverId, p) => serverStatsModule.removeServerStatsChannel(serverId, p.type, s()));
    configBus.register('serverstats', 'clear', (serverId) => serverStatsModule.clearServerStats(serverId, s()));
    configBus.register('serverstats', 'forceUpdate', (serverId) => serverStatsModule.forceUpdateServerStats(serverId, s()));
    configBus.register('serverstats', 'updateSettings', (serverId, p) => serverStatsModule.updateServerStatsSettings(serverId, p.settings, s()));

    
    configBus.register('stickymessage', 'get', (serverId) => stickyMessageModule.getStickyMessageConfigs(serverId, s()));
    configBus.register('stickymessage', 'create', (serverId, p) => stickyMessageModule.createStickyMessage(serverId, p, s()));
    configBus.register('stickymessage', 'update', (serverId, p) => stickyMessageModule.updateStickyMessage(serverId, p.stickyId, p.updates, s()));
    configBus.register('stickymessage', 'delete', (serverId, p) => stickyMessageModule.deleteStickyMessage(serverId, p.stickyId, s()));
    configBus.register('stickymessage', 'deleteAll', (serverId) => stickyMessageModule.deleteAllStickyMessages(serverId, s()));
    configBus.register('stickymessage', 'toggle', (serverId, p) => stickyMessageModule.toggleStickyMessage(serverId, p.stickyId, s()));

    
    configBus.register('suggestions', 'setup', (serverId, p) => suggestionModule.setupSuggestionSystem(serverId, p, s()));
    configBus.register('suggestions', 'update', (serverId, p) => suggestionModule.updateSuggestionConfig(serverId, p, s()));
    configBus.register('suggestions', 'get', (serverId) => suggestionModule.getSuggestionConfig(serverId, s()));
    configBus.register('suggestions', 'delete', (serverId) => suggestionModule.deleteSuggestionConfig(serverId, s()));

    
    configBus.register('tickets', 'get', (serverId) => ticketModule.getTicketConfig(serverId, s()));
    configBus.register('tickets', 'setup', (serverId, p) => ticketModule.setupTicketSystem(serverId, p, s()));
    configBus.register('tickets', 'update', (serverId, p) => ticketModule.updateTicketConfig(serverId, p, s()));
    configBus.register('tickets', 'enable', (serverId) => ticketModule.enableTicketSystem(serverId, s()));
    configBus.register('tickets', 'disable', (serverId) => ticketModule.disableTicketSystem(serverId, s()));
    configBus.register('tickets', 'delete', (serverId) => ticketModule.deleteTicketConfig(serverId, s()));
    configBus.register('ticketsStats', 'getStats', (serverId) => ticketModule.getTicketStats(serverId, s()));

    
    configBus.register('truthordare', 'setup', (serverId, p) => truthOrDareModule.setupTruthOrDareSystem(serverId, p, s()));
    configBus.register('truthordare', 'get', (serverId) => truthOrDareModule.getTruthOrDareConfig(serverId, s()));
    configBus.register('truthordare', 'delete', (serverId) => truthOrDareModule.deleteTruthOrDareConfig(serverId, s()));
    configBus.register('truthordare', 'update', (serverId, p) => truthOrDareModule.updateTruthOrDareConfig(serverId, p, s()));

    
    configBus.register('welcome', 'setup', (serverId, p) => welcomeModule.setupWelcomeSystem(serverId, p, s()));
    configBus.register('welcome', 'update', (serverId, p) => welcomeModule.updateWelcomeConfig(serverId, p, s()));
    configBus.register('welcome', 'get', (serverId) => welcomeModule.getWelcomeConfig(serverId, s()));
    configBus.register('welcome', 'delete', (serverId) => welcomeModule.deleteWelcomeConfig(serverId, s()));
    configBus.register('welcome', 'enable', (serverId) => welcomeModule.enableWelcomeSystem(serverId, s()));
    configBus.register('welcome', 'disable', (serverId) => welcomeModule.disableWelcomeSystem(serverId, s()));
    configBus.register('welcome', 'toggleChannel', (serverId, p) => welcomeModule.toggleWelcomeChannel(serverId, p.status, s()));
    configBus.register('welcome', 'toggleDm', (serverId, p) => welcomeModule.toggleWelcomeDM(serverId, p.status, s()));

    
    configBus.register('guildMeta', 'get', (serverId) => guildDataModule.getServerDetails(serverId, s()));
    configBus.register('guildMeta', 'searchMembers', (serverId, p) => guildDataModule.getServerMembers(serverId, p.query || '', s()));
    configBus.register('guildMeta', 'refresh', (serverId) => guildDataModule.refreshServerData(serverId, s()));
}

module.exports = register;
