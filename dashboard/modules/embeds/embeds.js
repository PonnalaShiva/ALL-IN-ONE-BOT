const colors = require('../../../UI/colors/colors');
const Embed = require('../../../models/embed/embed');
const EmbedSchedule = require('../../../models/embed/schedule');
const client = require('../../../main');

function emitEmbedsUpdate(serverId, data, socket, eventType = 'embeds_update') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: { serverId, data, timestamp: Date.now() }
        });
    }
}

function generateId(prefix = 'EMB') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefix}-${result}`;
}

function validateEmbedData(data) {
    const errors = [];
    if (data.title && data.title.length > 256) errors.push('Title must be 256 characters or less');
    if (data.description && data.description.length > 4096) errors.push('Description must be 4096 characters or less');
    if (data.fields && data.fields.length > 25) errors.push('Maximum 25 fields allowed');
    if (data.fields) {
        data.fields.forEach((f, i) => {
            if (!f.name || f.name.length > 256) errors.push(`Field ${i + 1} name must be 1-256 characters`);
            if (!f.value || f.value.length > 1024) errors.push(`Field ${i + 1} value must be 1-1024 characters`);
        });
    }
    if (data.footer?.text && data.footer.text.length > 2048) errors.push('Footer text must be 2048 characters or less');
    if (data.author?.name && data.author.name.length > 256) errors.push('Author name must be 256 characters or less');

    
    let total = 0;
    if (data.title) total += data.title.length;
    if (data.description) total += data.description.length;
    if (data.footer?.text) total += data.footer.text.length;
    if (data.author?.name) total += data.author.name.length;
    if (data.fields) data.fields.forEach(f => { total += (f.name?.length || 0) + (f.value?.length || 0); });
    if (total > 6000) errors.push(`Total embed characters (${total}) exceeds 6000 limit`);

    return errors;
}

async function sendAllEmbedsData(socket, guildId = null) {
    try {
        console.log(`${colors.blue}📋 Sending embeds data to middleware${colors.reset}`);

        let query = {};
        if (guildId) query.guildId = guildId;

        const embeds = await Embed.find(query).sort({ updatedAt: -1 }).limit(200);
        const schedules = await EmbedSchedule.find(query).sort({ createdAt: -1 }).limit(100);

        const guildGroups = {};
        embeds.forEach(e => {
            const gid = e.guildId;
            if (!guildGroups[gid]) guildGroups[gid] = { embeds: [], schedules: [] };
            guildGroups[gid].embeds.push(e);
        });
        schedules.forEach(s => {
            const gid = s.guildId;
            if (!guildGroups[gid]) guildGroups[gid] = { embeds: [], schedules: [] };
            guildGroups[gid].schedules.push(s);
        });

        for (const [gid, data] of Object.entries(guildGroups)) {
            emitEmbedsUpdate(gid, data, socket, 'server_embeds_data');
        }

        console.log(`${colors.green}✅ Sent embeds data for ${Object.keys(guildGroups).length} servers${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending embeds data:${colors.reset}`, error);
    }
}

async function getEmbedsForServer(guildId, options = {}, socket) {
    try {
        const { page = 1, limit = 20, category, search } = options;
        const skip = (page - 1) * limit;

        const query = { guildId };
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { embedId: { $regex: search, $options: 'i' } }
            ];
        }

        const [embeds, total] = await Promise.all([
            Embed.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
            Embed.countDocuments(query)
        ]);

        const pagination = {
            current: page,
            total: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
            totalItems: total
        };

        emitEmbedsUpdate(guildId, { type: 'embeds_list', embeds, pagination }, socket, 'embeds_list');
        return { embeds, pagination };
    } catch (error) {
        console.error(`${colors.red}❌ Error getting embeds:${colors.reset}`, error);
        throw error;
    }
}

async function createEmbed(guildId, userId, embedData, socket) {
    try {
        console.log(`${colors.blue}📝 Creating embed in server ${guildId}${colors.reset}`);

        const errors = validateEmbedData(embedData);
        if (errors.length > 0) throw new Error(errors.join(', '));

        const embed = new Embed({
            embedId: generateId('EMB'),
            guildId,
            createdBy: userId,
            name: embedData.name || 'Untitled Embed',
            title: embedData.title || '',
            description: embedData.description || '',
            url: embedData.url || '',
            color: embedData.color || '#3498db',
            timestamp: embedData.timestamp || false,
            author: embedData.author || {},
            footer: embedData.footer || {},
            image: embedData.image || '',
            thumbnail: embedData.thumbnail || '',
            fields: embedData.fields || [],
            category: embedData.category || 'general',
            tags: embedData.tags || [],
            type: embedData.type || 'normal',
            isPublic: embedData.isPublic || false
        });

        await embed.save();

        console.log(`${colors.green}✅ Embed created: ${embed.embedId}${colors.reset}`);
        emitEmbedsUpdate(guildId, { type: 'embed_created', embed }, socket, 'embeds_update');
        return embed;
    } catch (error) {
        console.error(`${colors.red}❌ Error creating embed:${colors.reset}`, error);
        throw error;
    }
}

async function updateEmbed(embedId, guildId, userId, embedData, socket) {
    try {
        console.log(`${colors.blue}✏️ Updating embed ${embedId} in server ${guildId}${colors.reset}`);

        const errors = validateEmbedData(embedData);
        if (errors.length > 0) throw new Error(errors.join(', '));

        const embed = await Embed.findOne({ embedId, guildId });
        if (!embed) throw new Error('Embed not found');

        
        const fields = ['name', 'title', 'description', 'url', 'color', 'timestamp',
            'author', 'footer', 'image', 'thumbnail', 'fields', 'category', 'tags', 'type', 'isPublic'];
        fields.forEach(f => { if (embedData[f] !== undefined) embed[f] = embedData[f]; });
        embed.updatedBy = userId;

        await embed.save();

        console.log(`${colors.green}✅ Embed updated: ${embedId}${colors.reset}`);
        emitEmbedsUpdate(guildId, { type: 'embed_updated', embed }, socket, 'embeds_update');
        return embed;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating embed:${colors.reset}`, error);
        throw error;
    }
}

async function deleteEmbed(embedId, guildId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting embed ${embedId} from server ${guildId}${colors.reset}`);

        const embed = await Embed.findOneAndDelete({ embedId, guildId });
        if (!embed) throw new Error('Embed not found');

        
        await EmbedSchedule.updateMany({ embedId, guildId }, { isActive: false });

        
        if (client.embedScheduler) {
            const schedules = await EmbedSchedule.find({ embedId, guildId });
            for (const schedule of schedules) {
                client.embedScheduler.removeSchedule(schedule.scheduleId);
            }
        }

        console.log(`${colors.green}✅ Embed deleted: ${embedId}${colors.reset}`);
        emitEmbedsUpdate(guildId, { type: 'embed_deleted', embedId }, socket, 'embeds_update');
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting embed:${colors.reset}`, error);
        throw error;
    }
}

async function cloneEmbed(embedId, guildId, userId, newName, socket) {
    try {
        console.log(`${colors.blue}📋 Cloning embed ${embedId} in server ${guildId}${colors.reset}`);

        const source = await Embed.findOne({ embedId, guildId });
        if (!source) throw new Error('Source embed not found');

        const clone = new Embed({
            embedId: generateId('EMB'),
            guildId,
            createdBy: userId,
            name: newName || `${source.name} (Copy)`,
            title: source.title,
            description: source.description,
            url: source.url,
            color: source.color,
            timestamp: source.timestamp,
            author: source.author ? { ...source.author.toObject() } : {},
            footer: source.footer ? { ...source.footer.toObject() } : {},
            image: source.image,
            thumbnail: source.thumbnail,
            fields: source.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })),
            category: source.category,
            tags: [...source.tags],
            type: 'normal',
            isPublic: source.isPublic
        });

        await clone.save();

        console.log(`${colors.green}✅ Embed cloned: ${clone.embedId}${colors.reset}`);
        emitEmbedsUpdate(guildId, { type: 'embed_created', embed: clone }, socket, 'embeds_update');
        return clone;
    } catch (error) {
        console.error(`${colors.red}❌ Error cloning embed:${colors.reset}`, error);
        throw error;
    }
}

async function sendEmbedToChannel(embedId, guildId, channelId, options = {}, socket) {
    try {
        console.log(`${colors.blue}📤 Sending embed ${embedId} to channel ${channelId}${colors.reset}`);

        const embed = await Embed.findOne({ embedId, guildId });
        if (!embed) throw new Error('Embed not found');

        const guild = client.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild not found');

        const channel = guild.channels.cache.get(channelId);
        if (!channel) throw new Error('Channel not found');

        const { MessageFlags } = require('discord.js');
        const { buildCard, ACCENT } = require('../../../UI');

        const sections = [];
        if (embed.description) sections.push(embed.description);
        if (embed.fields?.length) {
            sections.push(embed.fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n'));
        }

        const card = buildCard({
            title: embed.title || null,
            sections: sections.length ? sections : ['\u200b'],
            accentColor: embed.color || ACCENT.primary,
            bannerURL: embed.image || null,
            thumbnailURL: embed.thumbnail || null,
            _footer: embed.footer?.text || null
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

        
        embed.usageCount = (embed.usageCount || 0) + 1;
        embed.lastUsed = new Date();
        await embed.save();

        console.log(`${colors.green}✅ Embed sent to #${channel.name}${colors.reset}`);
        emitEmbedsUpdate(guildId, { type: 'embed_sent', embedId, channelId }, socket, 'embeds_update');
        return { sent: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error sending embed:${colors.reset}`, error);
        throw error;
    }
}

async function getSchedulesForServer(guildId, socket) {
    try {
        const schedules = await EmbedSchedule.find({ guildId }).sort({ createdAt: -1 });

        
        const embedIds = [...new Set(schedules.map(s => s.embedId))];
        const embeds = await Embed.find({ embedId: { $in: embedIds }, guildId });
        const embedMap = {};
        embeds.forEach(e => { embedMap[e.embedId] = e; });

        const enriched = schedules.map(s => {
            const obj = s.toObject();
            obj.embedName = embedMap[s.embedId]?.name || 'Unknown Embed';
            return obj;
        });

        emitEmbedsUpdate(guildId, { type: 'schedules_list', schedules: enriched }, socket, 'embeds_schedules');
        return { schedules: enriched };
    } catch (error) {
        console.error(`${colors.red}❌ Error getting schedules:${colors.reset}`, error);
        throw error;
    }
}

async function createSchedule(guildId, userId, scheduleData, socket) {
    try {
        console.log(`${colors.blue}⏰ Creating schedule in server ${guildId}${colors.reset}`);

        
        const embed = await Embed.findOne({ embedId: scheduleData.embedId, guildId });
        if (!embed) throw new Error('Embed not found');

        const schedule = new EmbedSchedule({
            scheduleId: generateId('SCH'),
            guildId,
            createdBy: userId,
            embedId: scheduleData.embedId,
            name: scheduleData.name || `Schedule for ${embed.name}`,
            channelId: scheduleData.channelId,
            frequency: scheduleData.frequency || 'daily',
            time: scheduleData.time || '12:00',
            customCron: scheduleData.customCron || '',
            timezone: scheduleData.timezone || 'UTC',
            mentionRoleId: scheduleData.mentionRoleId || '',
            messageContent: scheduleData.messageContent || '',
            isActive: true,
            maxRuns: scheduleData.maxRuns || null
        });

        await schedule.save();

        
        if (client.embedScheduler) {
            client.embedScheduler.addSchedule(schedule);
        }

        console.log(`${colors.green}✅ Schedule created: ${schedule.scheduleId}${colors.reset}`);
        emitEmbedsUpdate(guildId, { type: 'schedule_created', schedule }, socket, 'embeds_update');
        return schedule;
    } catch (error) {
        console.error(`${colors.red}❌ Error creating schedule:${colors.reset}`, error);
        throw error;
    }
}

async function toggleSchedule(scheduleId, guildId, socket) {
    try {
        const schedule = await EmbedSchedule.findOne({ scheduleId, guildId });
        if (!schedule) throw new Error('Schedule not found');

        schedule.isActive = !schedule.isActive;
        await schedule.save();

        if (client.embedScheduler) {
            if (schedule.isActive) {
                client.embedScheduler.addSchedule(schedule);
            } else {
                client.embedScheduler.removeSchedule(scheduleId);
            }
        }

        console.log(`${colors.green}✅ Schedule ${scheduleId} toggled to ${schedule.isActive ? 'active' : 'inactive'}${colors.reset}`);
        emitEmbedsUpdate(guildId, { type: 'schedule_toggled', schedule }, socket, 'embeds_update');
        return schedule;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling schedule:${colors.reset}`, error);
        throw error;
    }
}

async function deleteSchedule(scheduleId, guildId, socket) {
    try {
        const schedule = await EmbedSchedule.findOneAndDelete({ scheduleId, guildId });
        if (!schedule) throw new Error('Schedule not found');

        if (client.embedScheduler) {
            client.embedScheduler.removeSchedule(scheduleId);
        }

        console.log(`${colors.green}✅ Schedule deleted: ${scheduleId}${colors.reset}`);
        emitEmbedsUpdate(guildId, { type: 'schedule_deleted', scheduleId }, socket, 'embeds_update');
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting schedule:${colors.reset}`, error);
        throw error;
    }
}

module.exports = {
    sendAllEmbedsData,
    getEmbedsForServer,
    createEmbed,
    updateEmbed,
    deleteEmbed,
    cloneEmbed,
    sendEmbedToChannel,
    getSchedulesForServer,
    createSchedule,
    toggleSchedule,
    deleteSchedule
};
