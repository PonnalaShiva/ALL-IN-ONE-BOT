

'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
  ActionRowBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const moment = require('moment');
require('moment-duration-format');

const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const { createDashboardModalId, parseDashboardModalId, resolveDashboardMessage } = require('../../utils/dashboardModalSession');
const { runWithinAcknowledgementWindow } = require('../../utils/interactionRouter');
const lang = require('../../events/loadLanguage');
const {
  buildCard,
  cards,
  btn,
  linkBtn,
  closeBtn,
  paginationRow,
  createSessionManager,
  replyUnauthorized,
  replyEphemeral,
  deferUpdate,
  deferReply,
  sendV2,
  editV2,
  closeAndAutoDelete,
  chunkArray,
  formatCommandLink,
  getRandomCategorySuggestions,
  cacheCommandIds,
} = require('../../UI');

function checkNicknameModification(guild, clickerMember, targetMember) {
  if (!guild || !clickerMember || !targetMember) return { allowed: false, reason: lang.user.nickname.reasonContextMissing };

  
  if (targetMember.id === guild.ownerId) {
    return { allowed: false, reason: lang.user.nickname.reasonOwner };
  }

  const isClickerOwner = clickerMember.id === guild.ownerId;
  const isSelf = clickerMember.id === targetMember.id;

  
  const hasClickerPerm = isClickerOwner ||
    (isSelf && (clickerMember.permissions.has(PermissionsBitField.Flags.ChangeNickname) || clickerMember.permissions.has(PermissionsBitField.Flags.ManageNicknames))) ||
    clickerMember.permissions.has(PermissionsBitField.Flags.ManageNicknames);

  if (!hasClickerPerm) {
    return { allowed: false, reason: lang.user.nickname.reasonPerms };
  }

  
  const clickerBetter = isClickerOwner || isSelf || clickerMember.roles.highest.position > targetMember.roles.highest.position;
  if (!clickerBetter) {
    return { allowed: false, reason: lang.user.nickname.reasonHierarchyUser };
  }

  
  const botCanEdit = guild.members.me.roles.highest.position > targetMember.roles.highest.position;
  if (!botCanEdit) {
    return { allowed: false, reason: lang.user.nickname.reasonHierarchyBot };
  }

  return { allowed: true, reason: lang.user.nickname.authorized };
}


const sessionManager = createSessionManager({
  onExpire: () => cards.expired(formatCommandLink('user')),
});


function tabsRow(active) {
  const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
  return new ActionRowBuilder().addComponents(
    btn(lang.user.nav.overview, 'user_tab_info', 'user', s('info')),
    btn(lang.user.nav.roles, 'user_tab_roles', 'list', s('roles')),
    btn(lang.user.nav.stats, 'user_tab_stats', 'analytics', s('stats'))
  );
}

function allSubcommandSelect(current = null) {
  const opts = [
    { label: lang.user.select.infoLabel, description: lang.user.select.infoDesc, value: 'info', emoji: getButtonEmoji('user'), default: current === 'info' },
    { label: lang.user.select.avatarLabel, description: lang.user.select.avatarDesc, value: 'avatar', emoji: getButtonEmoji('star'), default: current === 'avatar' },
    { label: lang.user.select.bannerLabel, description: lang.user.select.bannerDesc, value: 'banner', emoji: getButtonEmoji('sparkles'), default: current === 'banner' },
    { label: lang.user.select.rolesLabel, description: lang.user.select.rolesDesc, value: 'roles', emoji: getButtonEmoji('list'), default: current === 'roles' },
    { label: lang.user.select.permissionsLabel, description: lang.user.select.permissionsDesc, value: 'permissions', emoji: getButtonEmoji('lock'), default: current === 'permissions' },
    { label: lang.user.select.joinedatLabel, description: lang.user.select.joinedatDesc, value: 'joinedat', emoji: getButtonEmoji('calendar'), default: current === 'joinedat' },
    { label: lang.user.select.badgesLabel, description: lang.user.select.badgesDesc, value: 'badges', emoji: getButtonEmoji('crown'), default: current === 'badges' },
    { label: lang.user.select.createdatLabel, description: lang.user.select.createdatDesc, value: 'createdat', emoji: getButtonEmoji('time'), default: current === 'createdat' },
    { label: lang.user.select.boostingLabel, description: lang.user.select.boostingDesc, value: 'boosting', emoji: getButtonEmoji('rocket'), default: current === 'boosting' },
    { label: lang.user.select.mutualsLabel, description: lang.user.select.mutualsDesc, value: 'mutuals', emoji: getButtonEmoji('world'), default: current === 'mutuals' },
    { label: lang.user.select.activityLabel, description: lang.user.select.activityDesc, value: 'activity', emoji: getButtonEmoji('games'), default: current === 'activity' },
    { label: lang.user.select.nicknameLabel, description: lang.user.select.nicknameDesc, value: 'nickname', emoji: getButtonEmoji('settings'), default: current === 'nickname' },
    { label: lang.user.select.securityLabel, description: lang.user.select.securityDesc, value: 'security', emoji: getButtonEmoji('security'), default: current === 'security' },
    { label: lang.user.select.statsLabel, description: lang.user.select.statsDesc, value: 'stats', emoji: getButtonEmoji('trend'), default: current === 'stats' }
  ];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('user_subcommand_select').setPlaceholder(lang.selectPlaceholder).addOptions(opts)
  );
}

function buildPaginationRow(page, totalPages) {
  return paginationRow('user', page, totalPages, {
    previous: lang.previous,
    next: lang.next,
    close: lang.user.nav.close,
  });
}

function buildSubNavigationRow() {
  return new ActionRowBuilder().addComponents(
    linkBtn(lang.user.nav.support, 'chat', 'https://discord.gg/xQF9f9yUEM'),
    closeBtn('user', lang.user.nav.close)
  );
}

function buildNicknameRow(canModify) {
  return new ActionRowBuilder().addComponents(
    btn(lang.user.nickname.setNickname, 'user_nickname_modal_trigger', 'settings', ButtonStyle.Primary, !canModify),
    btn(lang.user.nickname.clearNickname, 'user_nickname_reset', 'delete', ButtonStyle.Danger, !canModify),
    linkBtn(lang.user.nav.support, 'chat', 'https://discord.gg/xQF9f9yUEM'),
    closeBtn('user', lang.user.nav.close)
  );
}


function infoSections(targetUser, member) {
  let joinPosition = 'N/A';
  if (member) {
    const cachedMembers = member.guild.members.cache;
    if (cachedMembers.size > 0) {
      joinPosition = Array.from(cachedMembers.values())
        .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
        .map(m => m.id)
        .indexOf(member.id) + 1;
    }
  }
  const rolesCount = member?.roles.cache.filter(r => r.name !== '@everyone').size || 0;
  const presenceStatus = member?.presence?.status || 'offline';
  const statusMap = {
    online: lang.user.content.statusOnline,
    idle: lang.user.content.statusIdle,
    dnd: lang.user.content.statusDnd,
    offline: lang.user.content.statusOffline
  };
  const statusLabel = statusMap[presenceStatus] || presenceStatus;
  const highestRoleStr = member?.roles?.highest ? `<@&${member.roles.highest.id}>` : lang.user.content.none;

  return [
    `### ${getEmoji('user')} ${lang.user.content.identityHeader}\n• ${lang.user.content.tag}: **${targetUser.tag}**\n• ${lang.user.content.id}: \`${targetUser.id}\`\n• ${lang.user.content.type}: **${targetUser.bot ? lang.user.content.botAccount : lang.user.content.humanUser}**\n• ${lang.user.content.created}: **${moment(targetUser.createdAt).fromNow()}**\n• ${lang.user.content.joinedServer}: **${member ? moment(member.joinedAt).fromNow() : lang.user.content.notInServer}**\n• ${lang.user.content.joinPosition}: **#${joinPosition}**`,
    `### ${getEmoji('home')} ${lang.user.content.presenceHeader}\n• ${lang.user.content.currentStatus}: **${statusLabel}**\n• ${lang.user.content.highestRole}: ${highestRoleStr}\n• ${lang.user.content.totalRoles}: **${rolesCount} ${lang.user.content.assigned}**\n• ${lang.user.content.boostStatus}: **${member?.premiumSince ? lang.user.content.activeBooster : lang.user.content.notBoosting}**`
  ];
}

function avatarSections(targetUser) {
  const avatarURL = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });
  const isAnimated = avatarURL.includes('.gif') || targetUser.avatar?.startsWith('a_');
  return [
    `### ${getEmoji('star')} ${lang.user.content.avatarViewer}\n${lang.user.content.avatarDisplaying.replace('{tag}', targetUser.tag)}\n\n• **${lang.user.content.format}**: ${isAnimated ? lang.user.content.animatedGif : lang.user.content.staticImage}\n• **${lang.user.content.resolution}**: ${lang.user.content.resolutionAvatar}\n\n**${lang.user.content.directLinks}**\n[${lang.user.content.pngLink}](${targetUser.displayAvatarURL({ format: 'png', size: 1024 })})   [${lang.user.content.webpLink}](${targetUser.displayAvatarURL({ format: 'webp', size: 1024 })}) ${isAnimated ? `  [${lang.user.content.gifLink}](${targetUser.displayAvatarURL({ format: 'gif', size: 1024 })})` : ''}`
  ];
}

function bannerSections(user, client) {
  const bannerURL = user.bannerURL({ dynamic: true, size: 1024 });
  if (bannerURL) {
    return [
      `### ${getEmoji('sparkles')} ${lang.user.content.bannerHeader}\n• ${lang.user.content.accentColor}: **${user.accentColor ? `#${user.accentColor.toString(16).padStart(6, '0')}` : lang.user.content.none}**\n• ${lang.user.content.resolution}: ${lang.user.content.resolutionBanner}\n\n**${lang.user.content.directLinks}**\n[${lang.user.content.pngLink}](${user.bannerURL({ format: 'png', size: 1024 })})   [${lang.user.content.webpLink}](${user.bannerURL({ format: 'webp', size: 1024 })})   [${lang.user.content.jpgLink}](${user.bannerURL({ format: 'jpg', size: 1024 })})`
    ];
  } else {
    return [
      `### ${getEmoji('warning')} ${lang.user.content.bannerProfileHeader}\n• ${lang.user.content.status}: **${lang.user.content.noCustomBanner}**\n• ${lang.user.content.accentColor}: **${user.accentColor ? `#${user.accentColor.toString(16).padStart(6, '0')}` : lang.user.content.defaultDiscord}**\n\n${lang.user.content.nitroBannerPrompt}`
    ];
  }
}

function rolesSections(targetUser, member, pageState) {
  const roles = member?.roles.cache
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position) || [];

  const roleList = Array.from(roles.values()).map(r => `• <@&${r.id}> ${r.name}`);
  const pages = chunkArray(roleList, 10);
  const maxPage = Math.max(1, pages.length);
  const pg = Math.max(0, Math.min(pageState.page, maxPage - 1));
  pageState.page = pg;
  pageState.totalPages = maxPage;
  const pageContent = pages[pg]?.join('\n') || lang.user.content.noRoles;

  return [
    `### ${getEmoji('list')} ${lang.user.content.assignedRolesHeader} (${lang.page} ${pg + 1}/${maxPage})\n${pageContent}`,
    `### ${getEmoji('analytics')} ${lang.user.content.hierarchySummary}\n• ${lang.user.content.totalRoles}: **${roles.size || 0}**\n• ${lang.user.content.highestRole}: ${member?.roles?.highest ? `<@&${member.roles.highest.id}>` : lang.user.content.none}\n• ${lang.user.content.roleColor}: **${member?.roles?.highest?.hexColor || '#000000'}**`
  ];
}

function permissionsSections(targetUser, member, guild, channel, pageState) {
  const permTarget = member || targetUser;
  const permissions = channel.permissionsFor?.(permTarget)?.toArray() || [];
  const adminPerms = permissions.filter(p => ['Administrator', 'ManageGuild', 'ManageChannels', 'ManageRoles'].includes(p));
  const modPerms = permissions.filter(p => ['ManageMessages', 'KickMembers', 'BanMembers', 'ModerateMembers'].includes(p));
  const basicPerms = permissions.filter(p => !adminPerms.includes(p) && !modPerms.includes(p));

  const basicList = basicPerms.map(p => `• ${p}`);
  const pages = chunkArray(basicList, 10);
  const maxPage = Math.max(1, pages.length);
  const pg = Math.max(0, Math.min(pageState.page, maxPage - 1));
  pageState.page = pg;
  pageState.totalPages = maxPage;
  const pageContent = pages[pg]?.join('\n') || lang.user.content.noBasicPerms;

  const isMember = !!member;
  const warningText = !isMember ? lang.user.content.permWarning : '';

  return [
    `### ${getEmoji('security')} ${lang.user.content.permissionsHeader.replace('{channel}', channel.id)}\n• ${lang.user.content.totalPermissions}: **${permissions.length}**\n• ${lang.user.content.adminAccess}: **${adminPerms.length > 0 ? adminPerms.join(', ') : lang.user.content.none}**\n• ${lang.user.content.modAccess}: **${modPerms.length > 0 ? modPerms.join(', ') : lang.user.content.none}**${warningText}`,
    `### ${getEmoji('list')} ${lang.user.content.basicPermsHeader} (${lang.page} ${pg + 1}/${maxPage})\n${pageContent}`
  ];
}

function joinedatSections(targetUser, member) {
  if (!member) {
    return [`### ${getEmoji('warning')} ${lang.user.content.joinAnalysis}\n${lang.user.content.notInServer}`];
  }
  const daysSinceJoin = Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24));
  const memberStatus = daysSinceJoin > 365 ? lang.user.content.veteranMember :
    daysSinceJoin > 180 ? lang.user.content.experiencedMember :
      daysSinceJoin > 30 ? lang.user.content.activeMember : lang.user.content.newMember;
  return [
    `### ${getEmoji('calendar')} ${lang.user.content.joinAnalysis}\n• ${lang.user.content.joinDate}: <t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n• ${lang.user.content.timeSinceJoin}: **${moment(member.joinedAt).fromNow()}**\n• ${lang.user.content.daysActive}: **${daysSinceJoin} ${lang.user.content.days}**\n• ${lang.user.content.memberStatus}: **${memberStatus}**`
  ];
}

function badgesSections(targetUser, client) {
  const flags = targetUser.flags?.toArray() || [];
  const badgeEmojis = {
    'Staff': getEmoji('crown'),
    'Partner': getEmoji('users'),
    'Hypesquad': getEmoji('sparkles'),
    'BugHunterLevel1': getEmoji('bug'),
    'BugHunterLevel2': getEmoji('bug'),
    'HypesquadOnlineHouse1': getEmoji('home'),
    'HypesquadOnlineHouse2': getEmoji('home'),
    'HypesquadOnlineHouse3': getEmoji('home'),
    'PremiumEarlySupporter': getEmoji('star'),
    'TeamPseudoUser': getEmoji('bot'),
    'VerifiedBot': getEmoji('tick'),
    'VerifiedDeveloper': getEmoji('code'),
    'CertifiedModerator': getEmoji('security'),
    'BotHTTPInteractions': getEmoji('world'),
    'ActiveDeveloper': getEmoji('terminal')
  };
  const badgeMap = lang.user.content.badges || {};
  const badgeList = flags.length > 0
    ? flags.map(badge => `${badgeEmojis[badge] || getEmoji('medal')} **${badgeMap[badge] || badge.replace(/([A-Z])/g, ' $1').trim()}**').join('\n`)
    : lang.user.content.noBadges;

  return [
    `### ${getEmoji('crown')} ${lang.user.content.badgeCollection}\n${lang.user.content.badgeSub}\n\n${badgeList}`
  ];
}

function createdatSections(targetUser) {
  const daysSinceCreation = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
  const accountStatus = daysSinceCreation > 1095 ? lang.user.content.veteranAccount : daysSinceCreation > 365 ? lang.user.content.matureAccount : daysSinceCreation > 30 ? lang.user.content.establishedAccount : lang.user.content.newAccount;
  return [
    `### ${getEmoji('time')} ${lang.user.content.accountRegistration}\n• ${lang.user.content.created}: <t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>\n• ${lang.user.content.accountAge}: **${moment(targetUser.createdAt).fromNow()}**\n• ${lang.user.content.daysSinceCreation}: **${daysSinceCreation} ${lang.user.content.days}**\n• ${lang.user.content.accountTier}: **${accountStatus}**`
  ];
}

function boostingSections(targetUser, member, guild) {
  if (!member) {
    return [`### ${getEmoji('warning')} ${lang.user.content.boostAnalysis}\n${lang.user.content.notInServer}`];
  }
  const boostStatus = member.premiumSince;
  const boostDuration = boostStatus ? moment(boostStatus).fromNow() : null;
  return [
    `### ${getEmoji('rocket')} ${lang.user.content.boostHeader}\n• ${lang.user.content.boosting}: **${boostStatus ? lang.user.content.activeSince.replace('{duration}', boostDuration) : lang.user.content.notBoosting}**\n• ${lang.user.content.guildBoostTier}: **${lang.user.content.tier} ${guild.premiumTier}**\n• ${lang.user.content.totalServerBoosts}: **${guild.premiumSubscriptionCount || 0} ${lang.user.content.activeBoosts}**`
  ];
}

function mutualsSections(targetUser, client, pageState) {
  const mutuals = Array.from(client.guilds.cache.filter(g => g.members.cache.has(targetUser.id)).values());
  const mutualList = mutuals.map(g => `• **${g.name}** (${g.memberCount.toLocaleString()} ${lang.user.content.members})`);
  const pages = chunkArray(mutualList, 10);
  const maxPage = Math.max(1, pages.length);
  const pg = Math.max(0, Math.min(pageState.page, maxPage - 1));
  pageState.page = pg;
  pageState.totalPages = maxPage;
  const pageContent = pages[pg]?.join('\n') || lang.user.content.noMutuals;
  const networkReach = mutuals.reduce((acc, g) => acc + g.memberCount, 0);

  return [
    `### ${getEmoji('world')} ${lang.user.content.mutualHeader} (${lang.page} ${pg + 1}/${maxPage})\n${pageContent}`,
    `### ${getEmoji('analytics')} ${lang.user.content.networkStats}\n• ${lang.user.content.totalShared}: **${mutuals.length} ${lang.user.content.servers}**\n• ${lang.user.content.totalReach}: **${networkReach.toLocaleString()} ${lang.user.content.members}**`
  ];
}

function activitySections(targetUser, member) {
  if (!member) {
    return [`### ${getEmoji('warning')} ${lang.user.content.presenceStatusHeader}\n${lang.user.content.notInServer}`];
  }
  const presence = member.presence;
  const status = presence?.status || 'offline';
  const activities = presence?.activities || [];
  const statusMap = {
    'online': { emoji: getEmoji('tick'), label: lang.user.content.statusOnline },
    'idle': { emoji: getEmoji('time'), label: lang.user.content.statusIdle },
    'dnd': { emoji: getEmoji('cross'), label: lang.user.content.statusDnd },
    'offline': { emoji: getEmoji('mute'), label: lang.user.content.statusOffline }
  };
  const currentStatus = statusMap[status] || { emoji: getEmoji('mute'), label: status };
  const platformInfo = presence?.clientStatus ? Object.keys(presence.clientStatus).join(', ') : lang.user.content.unknown;

  const activityList = activities.length > 0
    ? activities.map(a => {
      const type = a.type === 0 ? lang.user.content.playing :
        a.type === 1 ? lang.user.content.streaming :
          a.type === 2 ? lang.user.content.listening :
            a.type === 3 ? lang.user.content.watching :
              a.type === 4 ? lang.user.content.customStatus :
                a.type === 5 ? lang.user.content.competing : lang.user.content.unknown;
      return `• **${type}** ${a.name}${a.details ? `\n  *${a.details}*` : ''}${a.state ? `\n  *${a.state}*` : ''}`;
    }).join('\n\n')
    : lang.user.content.noActivity;

  return [
    `### ${getEmoji('games')} ${lang.user.content.presenceStatusHeader}\n• ${lang.user.content.status}: ${currentStatus.emoji} **${currentStatus.label}**\n• ${lang.user.content.platform}: **${platformInfo}**`,
    `### ${getEmoji('music')} ${lang.user.content.currentActivities}\n${activityList}`
  ];
}

function nicknameSections(targetUser, member, clickerMember) {
  if (!member) {
    return [`### ${getEmoji('warning')} ${lang.user.panel.nicknameTitle}\n${lang.user.content.notInServer}`];
  }
  const nickname = member.nickname || lang.user.nickname.noNickname;
  const check = checkNicknameModification(member.guild, clickerMember, member);

  return [
    `### ${getEmoji('settings')} ${lang.user.content.nicknameAdmin}\n• ${lang.user.content.currentNickname}: **${nickname}**\n• ${lang.user.content.displayName}: **${member.displayName}**\n• ${lang.user.content.modRights}: **${check.allowed ? lang.user.nickname.authorized : lang.user.nickname.unauthorized.replace('{reason}', check.reason)}**`
  ];
}

function securitySections(targetUser, client) {
  const accountAge = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
  const flags = targetUser.flags?.toArray() || [];
  const hasAvatar = targetUser.avatar !== null;
  const isVerified = flags.includes('VerifiedBot') || flags.includes('VerifiedDeveloper');

  const securityScore =
    (accountAge > 30 ? 25 : accountAge > 7 ? 15 : 0) +
    (hasAvatar ? 20 : 0) +
    (flags.length > 0 ? 30 : 0) +
    (isVerified ? 25 : 0);

  const riskLevel = securityScore > 70 ? lang.user.content.lowRisk : securityScore > 40 ? lang.user.content.mediumRisk : lang.user.content.highRisk;
  const riskColor = securityScore > 70 ? getEmoji('tick') : securityScore > 40 ? getEmoji('time') : getEmoji('cross');

  return [
    `### ${getEmoji('security')} ${lang.user.content.securityAssessment}\n• ${lang.user.content.securityScore}: **${securityScore}/100 ${lang.user.content.points}**\n• ${lang.user.content.riskLevel}: ${riskColor} **${riskLevel}**`,
    `### ${getEmoji('list')} ${lang.user.content.verificationFactors}\n• ${lang.user.content.profilePhoto}: **${hasAvatar ? getEmoji('tick') + ' ' + lang.user.content.customAvatar : getEmoji('cross') + ' ' + lang.user.content.defaultAvatar}**\n• ${lang.user.content.verificationStatus}: **${isVerified ? getEmoji('tick') + ' ' + lang.user.content.officiallyVerified : getEmoji('cross') + ' ' + lang.user.content.standardAccount}**\n• ${lang.user.content.accountAge}: **${accountAge > 30 ? getEmoji('tick') : getEmoji('warning')} ${accountAge} ${lang.user.content.days}**`
  ];
}

function statsSections(targetUser, member, client) {
  const accountAge = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
  const serverAge = member ? Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24)) : 0;
  const rolesCount = member?.roles.cache.filter(r => r.name !== '@everyone').size || 0;
  const flagsCount = targetUser.flags?.toArray().length || 0;
  const mutualsCount = client.guilds.cache.filter(g => g.members.cache.has(targetUser.id)).size;
  const overallScore = Math.floor((accountAge / 10) + (serverAge / 5) + (rolesCount * 2) + (flagsCount * 5) + (mutualsCount * 3));

  return [
    `### ${getEmoji('analytics')} ${lang.user.content.advancedStats}\n• ${lang.user.content.overallScore}: **${overallScore} ${lang.user.content.points}**\n• ${lang.user.content.accountAge}: **${accountAge} ${lang.user.content.days}**\n• ${lang.user.content.serverAge}: **${serverAge} ${lang.user.content.days}**\n• ${lang.user.content.mutualServers}: **${mutualsCount} ${lang.user.content.servers}**\n• ${lang.user.content.roleCount}: **${rolesCount} ${lang.user.content.assigned}**`
  ];
}

function helpSections(targetUser, client) {
  const tips = getRandomCategorySuggestions(client, 'basic');
  return [
    `### ${getEmoji('help')} ${lang.user.content.commandCenter}\n${lang.user.content.commandCenterSub}\n\n• ${lang.user.content.targetUser}: <@${targetUser.id}>`,
    `> **${getEmoji('help')} ${lang.suggestions}:** ${tips}`
  ];
}


async function renderState(client, guild, state, isSlashCommand = true) {
  let title = '';
  let sections = [];
  let componentsList = [];
  let thumbnailURL = null;
  let accentColor = 0x5865F2;

  const targetUser = await client.users.fetch(state.targetUserId).catch(() => null);
  if (!targetUser) {
    return [cards.error(lang.user.panel.notFoundTitle, lang.user.panel.notFoundDesc)];
  }
  const member = guild ? await guild.members.fetch(targetUser.id).catch(() => null) : null;

  switch (state.mode) {
    case 'avatar':
      title = lang.user.panel.avatarTitle;
      accentColor = 0x7c3aed;
      sections = avatarSections(targetUser);
      thumbnailURL = targetUser.displayAvatarURL({ dynamic: true, size: 256 });
      componentsList = [tabsRow('info'), allSubcommandSelect('avatar'), buildSubNavigationRow()];
      break;
    case 'banner':
      title = lang.user.panel.bannerTitle;
      const fullUser = await client.users.fetch(targetUser.id, { force: true }).catch(() => targetUser);
      accentColor = fullUser.accentColor || 0x00ff88;
      sections = bannerSections(fullUser, client);
      thumbnailURL = fullUser.bannerURL({ dynamic: true, size: 256 }) || targetUser.displayAvatarURL({ dynamic: true, size: 256 });
      componentsList = [tabsRow('info'), allSubcommandSelect('banner'), buildSubNavigationRow()];
      break;
    case 'roles':
      title = lang.user.panel.rolesTitle;
      accentColor = 0x8e44ad;
      sections = rolesSections(targetUser, member, state);
      componentsList = [tabsRow('roles'), allSubcommandSelect('roles'), buildPaginationRow(state.page, state.totalPages)];
      break;
    case 'permissions':
      title = lang.user.panel.permissionsTitle;
      accentColor = 0x3498db;
      const channel = guild.channels.cache.get(state.channelId) || guild.channels.cache.find(c => c.isTextBased()) || { id: state.channelId, name: 'unknown-channel' };
      sections = permissionsSections(targetUser, member, guild, channel, state);
      componentsList = [tabsRow('roles'), allSubcommandSelect('permissions'), buildPaginationRow(state.page, state.totalPages)];
      break;
    case 'joinedat':
      title = lang.user.panel.joinedatTitle;
      accentColor = 0x2ecc71;
      sections = joinedatSections(targetUser, member);
      componentsList = [tabsRow('info'), allSubcommandSelect('joinedat'), buildSubNavigationRow()];
      break;
    case 'badges':
      title = lang.user.panel.badgesTitle;
      accentColor = 0xf1c40f;
      sections = badgesSections(targetUser, client);
      componentsList = [tabsRow('info'), allSubcommandSelect('badges'), buildSubNavigationRow()];
      break;
    case 'createdat':
      title = lang.user.panel.createdatTitle;
      accentColor = 0x2d98da;
      sections = createdatSections(targetUser);
      componentsList = [tabsRow('info'), allSubcommandSelect('createdat'), buildSubNavigationRow()];
      break;
    case 'boosting':
      title = lang.user.panel.boostingTitle;
      accentColor = 0xe84393;
      sections = boostingSections(targetUser, member, guild);
      componentsList = [tabsRow('info'), allSubcommandSelect('boosting'), buildSubNavigationRow()];
      break;
    case 'mutuals':
      title = lang.user.panel.mutualsTitle;
      accentColor = 0x1abc9c;
      sections = mutualsSections(targetUser, client, state);
      componentsList = [tabsRow('info'), allSubcommandSelect('mutuals'), buildPaginationRow(state.page, state.totalPages)];
      break;
    case 'activity':
      title = lang.user.panel.activityTitle;
      accentColor = 0x9b59b6;
      sections = activitySections(targetUser, member);
      componentsList = [tabsRow('info'), allSubcommandSelect('activity'), buildSubNavigationRow()];
      break;
    case 'nickname':
      title = lang.user.panel.nicknameTitle;
      accentColor = 0x34495e;
      const clickerMember = guild ? await guild.members.fetch(state.userId).catch(() => null) : null;
      const check = checkNicknameModification(guild, clickerMember, member);
      sections = nicknameSections(targetUser, member, clickerMember);
      componentsList = [tabsRow('info'), allSubcommandSelect('nickname'), buildNicknameRow(check.allowed)];
      break;
    case 'security':
      title = lang.user.panel.securityTitle;
      const riskData = securitySections(targetUser, client);
      sections = riskData;
      const accountAge = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
      const flags = targetUser.flags?.toArray() || [];
      const hasAvatar = targetUser.avatar !== null;
      const isVerified = flags.includes('VerifiedBot') || flags.includes('VerifiedDeveloper');
      const score = (accountAge > 30 ? 25 : accountAge > 7 ? 15 : 0) + (hasAvatar ? 20 : 0) + (flags.length > 0 ? 30 : 0) + (isVerified ? 25 : 0);
      accentColor = score > 70 ? 0x2ecc71 : score > 40 ? 0xf1c40f : 0xe74c3c;
      componentsList = [tabsRow('stats'), allSubcommandSelect('security'), buildSubNavigationRow()];
      break;
    case 'stats':
      title = lang.user.panel.statsTitle;
      accentColor = 0x16a085;
      sections = statsSections(targetUser, member, client);
      componentsList = [tabsRow('stats'), allSubcommandSelect('stats'), buildSubNavigationRow()];
      break;
    case 'help':
      title = lang.user.panel.helpTitle;
      accentColor = 0x3498db;
      sections = helpSections(targetUser, client);
      componentsList = [tabsRow('info'), allSubcommandSelect('help'), buildSubNavigationRow()];
      break;
    default: 
      title = lang.user.panel.infoTitle;
      accentColor = 0x00d4ff;
      sections = infoSections(targetUser, member);
      thumbnailURL = targetUser.displayAvatarURL({ dynamic: true, size: 256 });
      componentsList = [tabsRow('info'), allSubcommandSelect('info'), buildSubNavigationRow()];
      break;
  }

  return [buildCard(title, sections, componentsList, thumbnailURL, accentColor)];
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Advanced user profile and analytics tools.')
    .addSubcommand(sub =>
      sub.setName('permissions')
        .setDescription('Detailed channel permissions analysis.')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to analyze').setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false))
    )
    .addSubcommand(sub => sub.setName('mutuals').setDescription('Mutual servers analysis.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('nickname')
        .setDescription('Nickname management (Admin only).')
        .addStringOption(o => o.setName('action').setDescription('Action to perform').setRequired(true).addChoices({ name: 'view', value: 'view' }, { name: 'reset', value: 'reset' }))
        .addUserOption(o => o.setName('target').setDescription('Target user').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('info').setDescription('Comprehensive user information and analytics.').addUserOption(o => o.setName('target').setDescription('Target user to analyze').setRequired(false)))
    .addSubcommand(sub => sub.setName('avatar').setDescription('Display user avatar in high resolution.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('banner').setDescription('Show user profile banner.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('roles').setDescription('Analyze user roles and permissions.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('joinedat').setDescription('Server join date and member analytics.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('badges').setDescription('Discord badges and achievements.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('createdat').setDescription('Account creation date and age.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('boosting').setDescription('Server boost status and history.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('activity').setDescription('User activity and presence status.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('security').setDescription('Account security analysis.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false)))
    .addSubcommand(sub => sub.setName('stats').setDescription('Advanced user statistics.').addUserOption(o => o.setName('target').setDescription('Target user').setRequired(false))),

  async handleComponent(interaction) {
    if (!interaction.customId?.startsWith('user_')) return false;

    const modalSession = interaction.isModalSubmit() ? parseDashboardModalId(interaction.customId) : null;
    const messageId = modalSession?.messageId || interaction.message?.id;
    if (!messageId) {
      await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.sessionExpired}`);
      return true;
    }
    const clickerId = interaction.user.id;
    const client = interaction.client;
    const guild = interaction.guild;

    if (interaction.customId === 'user_close') {
      const session = sessionManager.get(messageId);
      if (session && clickerId !== session.state.userId) {
        await replyUnauthorized(interaction, session.state.userId, 'user');
        return true;
      }

      sessionManager.close(messageId);
      const closedCard = cards.closed(formatCommandLink('user'));
      await closeAndAutoDelete(interaction, closedCard);
      return true;
    }

    const session = sessionManager.get(messageId);
    if (!session) {
      await replyEphemeral(interaction, `${getEmoji('warning')} ${lang.sessionExpired}`);
      return true;
    }

    if (clickerId !== session.state.userId) {
      await replyUnauthorized(interaction, session.state.userId, 'user');
      return true;
    }

    const customId = modalSession?.baseCustomId || interaction.customId;

    
    if (customId === 'user_nickname_modal_trigger') {
      const lookup = await runWithinAcknowledgementWindow(
        interaction,
        async () => {
          const targetUser = await client.users.fetch(session.state.targetUserId).catch(() => null);
          const member = targetUser ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
          const clickerMember = await guild.members.fetch(clickerId).catch(() => null);
          return { targetUser, member, check: checkNicknameModification(guild, clickerMember, member) };
        },
        'Nickname details are taking too long to load. Please try again shortly.'
      );
      if (!lookup.completed) return true;
      const { targetUser, member, check } = lookup.value;

      if (!targetUser || !check.allowed) {
        await replyEphemeral(interaction, `${getEmoji('cross')} ${check.reason}.`);
        return true;
      }

      const modal = new ModalBuilder()
        .setCustomId(createDashboardModalId('user_nickname_modal', messageId))
        .setTitle(lang.user.nickname.modalTitle.replace('{username}', targetUser.username.substring(0, 30)));

      const nicknameInput = new TextInputBuilder()
        .setCustomId('user_nickname_input')
        .setLabel(lang.user.nickname.inputLabel)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(lang.user.nickname.inputPlaceholder)
        .setMaxLength(32)
        .setRequired(false);

      const row = new ActionRowBuilder().addComponents(nicknameInput);
      modal.addComponents(row);

      await interaction.showModal(modal).catch(() => { });
      return true;
    }

    
    if (interaction.isModalSubmit() && customId === 'user_nickname_modal') {
      try {
        await deferReply(interaction, true);
      } catch {
        return true;
      }

      const dashboardMessage = await resolveDashboardMessage(interaction, session, messageId);
      const targetUser = await client.users.fetch(session.state.targetUserId).catch(() => null);
      const member = targetUser ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
      const clickerMember = await guild.members.fetch(clickerId).catch(() => null);

      const check = checkNicknameModification(guild, clickerMember, member);
      if (!check.allowed) {
        await interaction.editReply({ content: `${getEmoji('cross')} ${check.reason}.` }).catch(() => { });
        return true;
      }

      const newNickname = interaction.fields.getTextInputValue('user_nickname_input') || null;

      try {
        await member.setNickname(newNickname);
        if (newNickname) {
          await interaction.editReply({ content: `${getEmoji('tick')} ${lang.user.nickname.setSuccess.replace('{user}', targetUser.id).replace('{nickname}', newNickname)}` }).catch(() => { });
        } else {
          await interaction.editReply({ content: `${getEmoji('tick')} ${lang.user.nickname.clearSuccess.replace('{user}', targetUser.id)}` }).catch(() => { });
        }

        sessionManager.touch(client, interaction.channelId, messageId);
        const components = await renderState(client, guild, session.state, true);
        if (dashboardMessage) await editV2(dashboardMessage, components).catch(() => { });
      } catch (err) {
        await interaction.editReply({ content: `${getEmoji('cross')} ${lang.user.nickname.setFailed.replace('{error}', err.message)}` }).catch(() => { });
      }
      return true;
    }

    
    if (customId === 'user_nickname_reset') {
      const targetUser = await client.users.fetch(session.state.targetUserId).catch(() => null);
      const member = targetUser ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
      const clickerMember = await guild.members.fetch(clickerId).catch(() => null);

      const check = checkNicknameModification(guild, clickerMember, member);
      if (!check.allowed) {
        await replyEphemeral(interaction, `${getEmoji('cross')} ${check.reason}.`);
        return true;
      }

      try {
        await member.setNickname(null);
        await replyEphemeral(interaction, `${getEmoji('tick')} ${lang.user.nickname.resetSuccess.replace('{user}', targetUser.id)}`);

        sessionManager.touch(client, interaction.channelId, messageId);
        const components = await renderState(client, guild, session.state, true);
        await editV2(interaction, components).catch(() => { });
      } catch (err) {
        await replyEphemeral(interaction, `${getEmoji('cross')} ${lang.user.nickname.resetFailed.replace('{error}', err.message)}`);
      }
      return true;
    }

    try {
      await deferUpdate(interaction);
    } catch {
      return true;
    }

    sessionManager.touch(client, interaction.channelId, messageId);
    await cacheCommandIds(client, interaction).catch(() => { });

    const { state } = session;

    if (customId === 'user_tab_info') {
      state.mode = 'info';
      state.page = 0;
    } else if (customId === 'user_tab_roles') {
      state.mode = 'roles';
      state.page = 0;
    } else if (customId === 'user_tab_stats') {
      state.mode = 'stats';
      state.page = 0;
    } else if (customId === 'user_subcommand_select') {
      state.mode = interaction.values[0] || 'info';
      state.page = 0;
    } else if (customId === 'user_prev') {
      state.page = Math.max(0, state.page - 1);
    } else if (customId === 'user_next') {
      state.page = state.page + 1;
    }

    try {
      const components = await renderState(client, guild, state, true);
      await editV2(interaction, components);
    } catch (err) {
      console.error('[User Component Error]:', err.message);
    }

    return true;
  },

  async execute(interaction) {
    const isSlash = Boolean(interaction.isChatInputCommand?.());
    try {
      if (isSlash && !interaction.deferred && !interaction.replied) {
        await deferReply(interaction);
      }
    } catch (err) {
      console.error('[User] deferReply failed:', err.message);
      return;
    }

    const client = interaction.client;
    const guild = interaction.guild;

    if (!guild) {
      const errorContainer = cards.error(lang.serverRequiredTitle, lang.serverRequired);
      await sendV2(interaction, errorContainer).catch(() => { });
      return;
    }

    await cacheCommandIds(client, interaction).catch(() => { });

    let subcommand = 'info';
    let targetUser = null;
    let channel = null;
    let action = null;
    let userId = null;

    if (isSlash) {
      subcommand = interaction.options.getSubcommand() || 'info';
      targetUser = interaction.options.getUser('target') || interaction.user;
      channel = interaction.options.getChannel('channel');
      action = interaction.options.getString('action');
      userId = interaction.user.id;
    } else {
      const message = interaction;
      const args = message.content.split(' ');
      args.shift();
      subcommand = args[0] || 'help';

      if (args[1]) {
        const userMention = args[1].replace(/[<@!>]/g, '');
        targetUser = await message.client.users.fetch(userMention).catch(() => null);
      }
      if (!targetUser) targetUser = message.author;

      if (subcommand === 'permissions' && args[2]) {
        const channelMention = args[2].replace(/[<#>]/g, '');
        channel = message.guild.channels.cache.get(channelMention);
      }

      if (subcommand === 'nickname' && args[2]) {
        action = args[2];
      }
      userId = message.author.id;
    }

    
    if (subcommand === 'nickname' && action === 'reset') {
      const member = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        await sendV2(interaction, cards.error(lang.error, lang.user.nickname.notInServer)).catch(() => { });
        return;
      }

      const clickerMember = await guild.members.fetch(userId).catch(() => null);
      const check = checkNicknameModification(guild, clickerMember, member);
      if (!check.allowed) {
        await sendV2(interaction, cards.error(lang.user.panel.accessDeniedTitle, check.reason)).catch(() => { });
        return;
      }

      try {
        await member.setNickname(null);
        await sendV2(interaction, cards.success(lang.user.panel.nicknameResetTitle, lang.user.nickname.resetSuccess.replace('{user}', targetUser.id))).catch(() => { });
      } catch (err) {
        await sendV2(interaction, cards.error(lang.error, lang.user.nickname.resetFailed.replace('{error}', err.message))).catch(() => { });
      }
      return;
    }

    const state = {
      mode: subcommand.toLowerCase(),
      userId,
      targetUserId: targetUser.id,
      page: 0,
      totalPages: 1,
      channelId: channel ? channel.id : interaction.channelId
    };

    try {
      const components = await renderState(client, guild, state, isSlash);
      const message = await sendV2(interaction, components);
      if (message) {
        sessionManager.open(client, interaction.channelId, message.id, state);
      }
    } catch (err) {
      console.error('[User Initial Render Error]:', err.message);
      await replyEphemeral(interaction, lang.user.error.loadFailed).catch(() => { });
    }
  }
};


