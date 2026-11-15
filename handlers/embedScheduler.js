const cron = require('node-cron');
const mongoose = require('mongoose');
const { MessageFlags } = require('discord.js');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const Embed = require('../models/embed/embed');
const EmbedSchedule = require('../models/embed/schedule');

class EmbedSchedulerHandler {
    constructor(client) {
        this.client = client;
        if (this.client) this.client.embedScheduler = this;
        this.activeJobs = new Map();
        this.healthCheckJob = null;
        this.cleanupJob = null;
        this.init();
    }

    async init() {
        
        this.healthCheckJob = cron.schedule('0 * * * *', async () => {
            await this.healthCheck();
        });
        
        
        this.cleanupJob = cron.schedule('0 3 * * *', async () => {
            await this.cleanupFailedSchedules();
        });
        
        
        await this.loadSchedules();
    }

    async loadSchedules() {
        if (mongoose.connection?.readyState !== 1) return;
        try {
            const schedules = await EmbedSchedule.find({ 
                isActive: true,
                $or: [
                    { maxRuns: { $exists: false } },
                    { $expr: { $lt: ['$runCount', '$maxRuns'] } }
                ]
            });
            
            let loaded = 0;
            for (const schedule of schedules) {
                if (await this.createJob(schedule)) {
                    loaded++;
                }
            }
            
            
        } catch (error) {
            console.error('Error loading embed schedules:', error);
        }
    }

    async createJob(schedule) {
        try {
            const cronExpression = this.getCronExpression(schedule);
            if (!cronExpression) return false;

            const job = cron.schedule(cronExpression, async () => {
                await this.executeSchedule(schedule.scheduleId);
            }, {
                scheduled: true,
                timezone: schedule.timezone || 'UTC'
            });

            this.activeJobs.set(schedule.scheduleId, {
                job,
                schedule,
                lastCheck: new Date()
            });

            return true;
        } catch (error) {
            console.error(`Failed to create job for schedule ${schedule.scheduleId}:`, error);
            await this.recordFailure(schedule.scheduleId, error.message);
            return false;
        }
    }

    getCronExpression(schedule) {
        const [hours, minutes] = schedule.time.split(':').map(Number);
        
        switch (schedule.frequency) {
            case 'hourly':
                return `${minutes} * * * *`;
            case 'daily':
                return `${minutes} ${hours} * * *`;
            case 'weekly_monday':
                return `${minutes} ${hours} * * 1`;
            case 'weekly_tuesday':
                return `${minutes} ${hours} * * 2`;
            case 'weekly_wednesday':
                return `${minutes} ${hours} * * 3`;
            case 'weekly_thursday':
                return `${minutes} ${hours} * * 4`;
            case 'weekly_friday':
                return `${minutes} ${hours} * * 5`;
            case 'weekly_saturday':
                return `${minutes} ${hours} * * 6`;
            case 'weekly_sunday':
                return `${minutes} ${hours} * * 0`;
            case 'monthly':
                return `${minutes} ${hours} 1 * *`;
            case 'custom':
                return schedule.customCron;
            default:
                return null;
        }
    }

    async executeSchedule(scheduleId) {
        try {
            const schedule = await EmbedSchedule.findOne({ 
                scheduleId,
                isActive: true 
            });
            
            if (!schedule) {
                console.log(`Schedule ${scheduleId} not found or inactive`);
                this.removeJob(scheduleId);
                return;
            }

            
            if (schedule.maxRuns && schedule.runCount >= schedule.maxRuns) {
                console.log(`Schedule ${scheduleId} reached max runs limit`);
                await this.deactivateSchedule(scheduleId);
                return;
            }

            
            const embed = await Embed.findOne({ embedId: schedule.embedId });
            if (!embed) {
                console.error(`Embed ${schedule.embedId} not found for schedule ${scheduleId}`);
                await this.recordFailure(scheduleId, 'Embed not found');
                return;
            }

            
            const guild = this.client.guilds.cache.get(schedule.guildId);
            if (!guild) {
                console.error(`Guild ${schedule.guildId} not found for schedule ${scheduleId}`);
                await this.recordFailure(scheduleId, 'Guild not found');
                return;
            }

            const channel = guild.channels.cache.get(schedule.channelId);
            if (!channel) {
                console.error(`Channel ${schedule.channelId} not found for schedule ${scheduleId}`);
                await this.recordFailure(scheduleId, 'Channel not found');
                return;
            }

            
            const card = this.buildCardFromData(embed);
            
            
            let content = schedule.messageContent || '';
            if (schedule.mentionRoleId) {
                const role = guild.roles.cache.get(schedule.mentionRoleId);
                if (role) {
                    content = `${role.toString()} ${content}`.trim();
                }
            }

            
            if (content) {
                await channel.send({ content });
            }
            await channel.send({
                components: [card],
                flags: MessageFlags.IsComponentsV2
            });

            
            await EmbedSchedule.updateOne(
                { scheduleId },
                {
                    $inc: { runCount: 1 },
                    $set: { 
                        lastRun: new Date(),
                        failureCount: 0,
                        lastError: null
                    }
                }
            );

            
            await Embed.updateOne(
                { embedId: schedule.embedId },
                {
                    $inc: { usageCount: 1 },
                    $set: { lastUsed: new Date() }
                }
            );

            console.log(`[EmbedScheduler] Schedule ${scheduleId} executed successfully in ${channel.name}`);

        } catch (error) {
            console.error(`Error executing schedule ${scheduleId}:`, error);
            await this.recordFailure(scheduleId, error.message);
        }
    }

    buildCardFromData(embedData) {
        const sections = [];
        if (embedData.description) {
            sections.push(embedData.description);
        }
        if (embedData.fields?.length) {
            const fieldsText = embedData.fields
                .map(f => `**${f.name}**\n${f.value}`)
                .join('\n\n');
            if (fieldsText) sections.push(fieldsText);
        }
        
        let accentColor = ACCENT.primary;
        if (embedData.color) {
            try {
                accentColor = typeof embedData.color === 'string' && embedData.color.startsWith('#')
                    ? parseInt(embedData.color.replace('#', ''), 16)
                    : Number(embedData.color);
            } catch (e) {
                accentColor = ACCENT.primary;
            }
        }

        return buildCard({
            title: embedData.title || null,
            sections: sections.length ? sections : ['\u200b'],
            thumbnailURL: embedData.thumbnail || null,
            bannerURL: embedData.image || null,
            accentColor,
            _footer: embedData.footer?.text || null
        });
    }

    buildEmbedFromData(embedData) {
        return this.buildCardFromData(embedData);
    }

    async recordFailure(scheduleId, errorMessage) {
        try {
            const result = await EmbedSchedule.updateOne(
                { scheduleId },
                {
                    $inc: { failureCount: 1 },
                    $set: { lastError: errorMessage }
                }
            );

            const schedule = await EmbedSchedule.findOne({ scheduleId });
            if (schedule && schedule.failureCount >= schedule.maxFailures) {
                console.log(`Schedule ${scheduleId} disabled due to max failures`);
                await this.deactivateSchedule(scheduleId);
            }
        } catch (error) {
            console.error(`Error recording failure for schedule ${scheduleId}:`, error);
        }
    }

    async deactivateSchedule(scheduleId) {
        try {
            await EmbedSchedule.updateOne(
                { scheduleId },
                { $set: { isActive: false } }
            );
            this.removeJob(scheduleId);
        } catch (error) {
            console.error(`Error deactivating schedule ${scheduleId}:`, error);
        }
    }

    removeJob(scheduleId) {
        const jobData = this.activeJobs.get(scheduleId);
        if (jobData) {
            jobData.job.stop();
            this.activeJobs.delete(scheduleId);
        }
    }

    async addSchedule(scheduleData) {
        try {
            const schedule = new EmbedSchedule(scheduleData);
            await schedule.save();
            
            if (await this.createJob(schedule)) {
                return { success: true, schedule };
            } else {
                return { success: false, error: 'Failed to create cron job' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async removeSchedule(scheduleId) {
        try {
            await EmbedSchedule.deleteOne({ scheduleId });
            this.removeJob(scheduleId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async healthCheck() {
        try {
            const activeSchedules = await EmbedSchedule.find({ isActive: true });
            const jobCount = this.activeJobs.size;
            
            if (activeSchedules.length !== jobCount) {
                console.log(`[EmbedScheduler] Schedule mismatch: ${activeSchedules.length} in DB, ${jobCount} active jobs`);
                
                await this.loadSchedules();
            }
            
           
        } catch (error) {
           
        }
    }

    async cleanupFailedSchedules() {
        try {
            const failedSchedules = await EmbedSchedule.find({
                isActive: false,
                updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
            });
            
            for (const schedule of failedSchedules) {
                this.removeJob(schedule.scheduleId);
            }
            
            if (failedSchedules.length > 0) {
                console.log(`[EmbedScheduler] Cleaned up ${failedSchedules.length} failed schedules`);
            }
        } catch (error) {
            console.error('Error cleaning up failed schedules:', error);
        }
    }

    stop() {
        if (this.healthCheckJob) {
            this.healthCheckJob.stop();
            this.healthCheckJob = null;
        }
        if (this.cleanupJob) {
            this.cleanupJob.stop();
            this.cleanupJob = null;
        }
        for (const [scheduleId, jobData] of this.activeJobs.entries()) {
            if (jobData?.job?.stop) jobData.job.stop();
        }
        this.activeJobs.clear();
    }

    getStats() {
        return {
            activeJobs: this.activeJobs.size,
            jobs: Array.from(this.activeJobs.keys())
        };
    }
}

module.exports = (client) => {
    return new EmbedSchedulerHandler(client);
};
