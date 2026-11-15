'use strict';

const { MessageFlags } = require('discord.js');
const { buildCard, cards } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');

function createCommandInteractionAdapter(message, args, command) {
    let replied = false;
    let deferred = false;
    let replyMessage = null;

    const rawOptions = Array.isArray(args) ? args : [];

    const optionsProxy = {
        getSubcommand(required = true) {
            return rawOptions[0] || (required ? null : null);
        },
        getSubcommandGroup() {
            return null;
        },
        getString(name, required = false) {
            if (rawOptions.length === 0) return null;
            if (rawOptions.length === 1 && name === 'subcommand') return rawOptions[0];
            return rawOptions.slice(1).join(' ') || rawOptions[0] || (required ? null : null);
        },
        getUser(name, required = false) {
            return message.mentions?.users?.first() || null;
        },
        getMember(name, required = false) {
            return message.mentions?.members?.first() || null;
        },
        getChannel(name, required = false) {
            return message.mentions?.channels?.first() || null;
        },
        getRole(name, required = false) {
            return message.mentions?.roles?.first() || null;
        },
        getInteger(name, required = false) {
            const num = parseInt(rawOptions[1] || rawOptions[0], 10);
            return Number.isFinite(num) ? num : null;
        },
        getNumber(name, required = false) {
            const num = parseFloat(rawOptions[1] || rawOptions[0]);
            return Number.isFinite(num) ? num : null;
        },
        getBoolean(name, required = false) {
            const val = (rawOptions[1] || rawOptions[0] || '').toLowerCase();
            if (val === 'true' || val === 'yes' || val === 'on' || val === '1') return true;
            if (val === 'false' || val === 'no' || val === 'off' || val === '0') return false;
            return null;
        },
        getMentionable(name, required = false) {
            return message.mentions?.members?.first() || message.mentions?.roles?.first() || message.mentions?.users?.first() || null;
        },
        getAttachment(name, required = false) {
            return message.attachments?.first() || null;
        }
    };

    const shim = {
        isCommand: () => true,
        isChatInputCommand: () => true,
        isButton: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
        isRepliable: () => true,

        id: message.id,
        applicationId: message.client?.user?.id || 'bot',
        commandName: command?.data?.name || command?.name || 'command',
        channelId: message.channel?.id,
        guildId: message.guild?.id,
        user: message.author,
        member: message.member,
        guild: message.guild,
        channel: message.channel,
        client: message.client,
        createdAt: message.createdAt || new Date(),
        createdTimestamp: message.createdTimestamp || Date.now(),
        options: optionsProxy,

        get replied() { return replied; },
        get deferred() { return deferred; },

        async deferReply(options = {}) {
            deferred = true;
            if (message.channel?.sendTyping) {
                await message.channel.sendTyping().catch(() => {});
            }
            return Promise.resolve();
        },

        async deferUpdate() {
            deferred = true;
            return Promise.resolve();
        },

        async reply(payload) {
            replied = true;
            const normalized = typeof payload === 'string' ? { content: payload } : payload;
            replyMessage = await message.reply(normalized);
            return replyMessage;
        },

        async editReply(payload) {
            const normalized = typeof payload === 'string' ? { content: payload } : payload;
            if (replyMessage && typeof replyMessage.edit === 'function') {
                return replyMessage.edit(normalized);
            }
            replied = true;
            replyMessage = await message.reply(normalized);
            return replyMessage;
        },

        async followUp(payload) {
            const normalized = typeof payload === 'string' ? { content: payload } : payload;
            return message.channel.send(normalized);
        },

        async deleteReply() {
            if (replyMessage && typeof replyMessage.delete === 'function') {
                return replyMessage.delete().catch(() => {});
            }
        },

        async showModal(modal) {
            const cmdName = command?.data?.name || command?.name || 'command';
            const card = buildCard({
                title: `${getEmoji('warning')} Modal Requires Slash Command`,
                description: `This configuration wizard requires Discord native modal input.\n\nPlease execute the command using slash:\n\`/${cmdName}\``,
                tone: 'warning'
            });
            replied = true;
            replyMessage = await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            return replyMessage;
        }
    };

    return new Proxy(shim, {
        get(target, prop, receiver) {
            if (prop in target) return target[prop];
            return message[prop];
        }
    });
}

module.exports = {
    createCommandInteractionAdapter
};

