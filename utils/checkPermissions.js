const { MessageFlags } = require('discord.js');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const serverConfigController = require('../models/serverConfig/Controller');
const cmdIcons = require('../UI/icons/commandicons');

async function hasPermission(context, requiredLevel = 'botmanager') {
  const isInteraction = Boolean(context?.user && typeof context.reply === 'function');
  const guild = context.guild;
  const user = isInteraction ? context.user : context.author;
  const member = context.member;
  if (!guild || !user || !member) return false;

  const serverId = guild.id;
  const configData = await serverConfigController.getConfig(serverId);
  const botManagers = configData?.botManagers || [];
  const adminRoles = configData?.adminRoles || [];
  const modRoles = configData?.modRoles || [];
  const isOwner = user.id === guild.ownerId;
  const isBotManager = botManagers.includes(user.id);
  const hasRole = roleId => member.roles?.cache?.has?.(roleId) || member.roles?.includes?.(roleId) || false;
  const hasAdminRole = adminRoles.some(hasRole);
  const hasModRole = modRoles.some(hasRole);

  switch (requiredLevel) {
    case 'owner':
      return isOwner;

    case 'botmanager':
      return isOwner || isBotManager;

    case 'admin':
      return isOwner || isBotManager || hasAdminRole;

    case 'moderator':
      return isOwner || isBotManager || hasAdminRole || hasModRole;

    default:
      return isOwner || isBotManager;
  }
}

module.exports = async function checkPermissions(context, requiredLevel = 'botmanager') {
  const isInteraction = Boolean(context?.user && typeof context.reply === 'function');
  const guild = context.guild;
  if (!await hasPermission(context, requiredLevel)) {
    if (!guild) {
      console.error('checkPermissions: Missing guild, user, or member data');
      return false;
    }

    const serverId = guild.id;
    const lang = await loadLanguage(serverId);
    const p = lang.permissions || {};
    const levels = p.levels || {};
    const levelText = `**${levels[requiredLevel] || levels.default || 'authorized users'}**`;

    const card = buildCard({
      title: `${getEmoji('cross')} ${p.deniedTitle || 'Permission Denied'}`,
      accentColor: ACCENT.danger,
      sections: [
        `- ${(p.onlyRoles || 'Only {level} can use this command.').replace('{level}', levelText)}\n` +
        `- ${p.mistakeContact || 'If you believe this is a mistake, please contact the server owner or a bot manager.'}\n` +
        `- ${p.ownerConfigure || 'If you are the server owner, configure permissions using **/setup-serverconfig**.'}`
      ]
    });

    if (isInteraction) {
      const payload = {
        components: [card],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      };
      if (context.deferred && context.ephemeral) {
        await context.editReply(payload);
        setTimeout(() => {
          context.deleteReply?.().catch(() => { });
        }, 5000);
      } else if (context.deferred || context.replied) {
        const response = await context.followUp(payload).catch(() => null);
        if (response?.delete) {
          setTimeout(() => response.delete().catch(() => { }), 5000);
        }
      } else {
        await context.reply(payload);
        setTimeout(() => {
          context.deleteReply?.().catch(() => { });
        }, 5000);
      }
    } else {
      const reply = await context.reply({
        components: [card],
        flags: MessageFlags.IsComponentsV2
      });

      setTimeout(() => {
        reply.delete().catch(() => { });
      }, 5000);
    }

    return false;
  }

  return true;
};

module.exports.hasPermission = hasPermission;
