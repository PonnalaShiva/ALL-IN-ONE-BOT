const colors = require('../../../UI/colors/colors');
const rulesEmbeds = require('../../../data/rules/rulesEmbed');
const client = require('../../../main');
const { MessageFlags } = require('discord.js');
const { buildCard, ACCENT } = require('../../../UI');

function serializeTemplates() {
    return Object.entries(rulesEmbeds).map(([key, card]) => {
        const data = typeof card?.toJSON === 'function' ? card.toJSON() : (card || {});
        const colorInt = data.accent_color || data.color || 0;
        const colorHex = typeof colorInt === 'string' ? colorInt : '#' + Number(colorInt).toString(16).padStart(6, '0');
        
        let title = '';
        let description = '';
        if (Array.isArray(data.components)) {
            for (const c of data.components) {
                if (c.type === 10) { 
                    if (!title) title = c.content;
                    else description += (description ? '\n' : '') + c.content;
                }
            }
        }
        return {
            id: key,
            name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            title: title || '',
            description: description || '',
            color: colorHex,
            fields: [],
            footer: null,
            author: null,
            image: null,
            thumbnail: null,
        };
    });
}

function sendAllRulesData(socket) {
    try {
        console.log(`${colors.blue}[Rules] Sending rules templates to middleware${colors.reset}`);
        const templates = serializeTemplates();
        socket && socket.emit('bot_data_update', {
            type: 'rules_data',
            payload: { templates, timestamp: Date.now() }
        });
        console.log(`${colors.green}[Rules] Sent ${templates.length} rule templates to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}[Rules] Error sending rules data:${colors.reset}`, error);
    }
}

function getRulesTemplates(socket) {
    try {
        const templates = serializeTemplates();
        socket && socket.emit('bot_data_update', {
            type: 'rules_templates',
            payload: { templates, timestamp: Date.now() }
        });
        return templates;
    } catch (error) {
        console.error(`${colors.red}[Rules] Error getting rules templates:${colors.reset}`, error);
        throw error;
    }
}

async function sendRulesToChannel(serverId, channelId, embedData, options = {}, socket) {
    try {
        console.log(`${colors.blue}[Rules] Sending rules to channel ${channelId} in server ${serverId}${colors.reset}`);

        const guild = client.guilds.cache.get(serverId);
        if (!guild) throw new Error('Guild not found');

        const channel = guild.channels.cache.get(channelId);
        if (!channel) throw new Error('Channel not found');

        const sections = [];
        if (embedData.description) sections.push(embedData.description);
        if (embedData.fields?.length) {
            sections.push(embedData.fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n'));
        }

        const card = buildCard({
            title: embedData.title || null,
            sections: sections.length ? sections : ['\u200b'],
            accentColor: embedData.color || ACCENT.primary,
            bannerURL: embedData.image || null,
            thumbnailURL: embedData.thumbnail || null,
            _footer: embedData.footer?.text || null
        });

        const messagePayload = {
            components: [card],
            flags: MessageFlags.IsComponentsV2
        };
        if (options.messageContent) messagePayload.content = options.messageContent;
        if (options.mentionRoleId) {
            messagePayload.content = `<@&${options.mentionRoleId}> ${messagePayload.content || ''}`.trim();
        }

        await channel.send(messagePayload);

        console.log(`${colors.green}[Rules] Rules card sent to #${channel.name}${colors.reset}`);
        return { sent: true };
    } catch (error) {
        console.error(`${colors.red}[Rules] Error sending rules:${colors.reset}`, error);
        throw error;
    }
}

module.exports = {
    sendAllRulesData,
    getRulesTemplates,
    sendRulesToChannel
};
