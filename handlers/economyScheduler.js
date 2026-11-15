const cron = require('node-cron');
const { MessageFlags } = require('discord.js');
const loadLanguage = require('../events/loadLanguage');
const lang = loadLanguage;
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const { Economy, EconomyManager } = require('../models/economy/economy');
const EconomyUtils = require('../utils/economyUtils');
const { STOCKS, MARKET_EVENTS } = require('../models/economy/constants/stockData');
const { CROPS } = require('../models/economy/constants/farmingData');
const { LOTTERY_CONFIG } = require('../models/economy/constants/systemData');
const { processDueLotteryDraws } = require('../models/economy/lotteryService');

module.exports = (client) => {
    const scheduledTasks = [];

    function scheduleTask(cronExpr, taskFn) {
        const task = cron.schedule(cronExpr, taskFn);
        scheduledTasks.push(task);
        return task;
    }

    
    scheduleTask('0 2 * * *', async () => {
        await handleNightlyRobberies(client);
    });

    
    scheduleTask('0 */6 * * *', async () => {
        await EconomyUtils.decayPetStats();
    });

    
    scheduleTask('0 0 1 * *', async () => {
        await EconomyUtils.handleMonthlyBills();
    });

    
    scheduleTask('0 1 * * *', async () => {
        await handleRoleExpiries(client);
    });

    
    scheduleTask('0 */4 * * *', async () => {
        await handleRandomEvents(client);
    });

    
    scheduleTask('0 3 * * *', async () => {
        await handleHeatDecay();
    });

    
    scheduleTask('30 */4 * * *', async () => {
        await handleStockFluctuations();
    });

    
    scheduleTask('0 * * * *', async () => {
        await handleCropWithering();
    });

    
    scheduleTask('*/5 * * * *', async () => {
        await handleLotteryDraw(client);
    });

    
    scheduleTask('0 0 * * *', async () => {
        await handleBankInterest();
    });

    
    scheduleTask('0 6 * * 0', async () => {
        await handleStockDividends();
    });

    
    scheduleTask('0 4 * * *', async () => {
        await handleInsuranceExpiry();
    });
    
    async function handleNightlyRobberies(client) {
        try {
            const batchSize = 100;
            const scheduledDay = new Date();
            scheduledDay.setUTCHours(0, 0, 0, 0);
            const referenceId = `night-robbery:${scheduledDay.toISOString().slice(0, 10)}`;
            let lastId = null;
            let totalChecks = 0;
            let totalRobberies = 0;
            while (true) {
                const query = { familyVault: { $gte: 5000 } };
                if (lastId) query._id = { $gt: lastId };
                const profiles = await Economy.find(query).sort({ _id: 1 }).limit(batchSize).select('_id userId guildId').lean();
                if (!profiles.length) break;
                lastId = profiles[profiles.length - 1]._id;
                for (let i = 0; i < profiles.length; i += 10) {
                    await Promise.all(profiles.slice(i, i + 10).map(async profile => {
                        try {
                            const result = await executeRobbery(client, profile, referenceId, scheduledDay);
                            if (result?.checked) totalChecks++;
                            if (result?.robbed) totalRobberies++;
                        } catch (error) {
                            console.error(`Error processing nightly robbery for ${profile.userId}/${profile.guildId}:`, error);
                        }
                    }));
                }
            }
            console.log(`[EconomyScheduler] Nightly vault checks complete: ${totalRobberies} robberies from ${totalChecks} eligible profiles.`);
        } catch (error) {
            console.error('Error in nightly robbery system:', error);
        }
    }
    
    async function executeRobbery(client, profile, referenceId, scheduledDay) {
        const result = await EconomyManager.mutateProfileAtomically({
            userId: profile.userId,
            guildId: profile.guildId,
            referenceId,
            mutate: async current => {
                if (current.lastNightlyRobberyCheck && new Date(current.lastNightlyRobberyCheck) >= scheduledDay) return { success: false, error: 'already_checked' };
                current.lastNightlyRobberyCheck = scheduledDay;
                if ((current.familyVault || 0) < 5000) return { noLedger: true, checked: false, robbed: false };
                const securityLevel = EconomyManager.calculateSecurityLevel(current);
                const robberyChance = Math.max(2, 25 - securityLevel);
                if (Math.random() * 100 >= robberyChance) return { noLedger: true, checked: true, robbed: false };

                const now = new Date();
                const baseStealPercentage = 0.6;
                const securityReduction = (securityLevel / 100) * 0.3;
                const stealPercentage = Math.max(0.2, baseStealPercentage - securityReduction);
                const stolenAmount = Math.floor((current.familyVault || 0) * stealPercentage);
                current.familyVault = Math.max(0, (current.familyVault || 0) - stolenAmount);
                current.lastRobbed = now;
                current.robberyAttempts = (current.robberyAttempts || 0) + 1;
                for (const pet of current.pets || []) {
                    if (pet.health > 80 && pet.happiness > 70) {
                        pet.health = Math.max(50, pet.health - Math.floor(Math.random() * 20));
                        pet.happiness = Math.max(30, pet.happiness - Math.floor(Math.random() * 15));
                    }
                }
                current.transactions.push({ type: 'expense', amount: stolenAmount, description: `Robbed during the night (Security: ${securityLevel}%)`, category: 'robbery', timestamp: now });
                return { checked: true, robbed: true, securityLevel, stealPercentage, stolenAmount, remainingAmount: current.familyVault, hasPets: (current.pets || []).length > 0 };
            }
        });
        if (!result?.success || !result.robbed) return result;

        const user = await client.users.fetch(profile.userId).catch(() => null);
        if (user) {
            const guildLang = loadLanguage(profile.guildId);
            const card = buildCard({
                title: `${getEmoji('alert')} ${guildLang.economy.scheduler.robberyAlertTitle}`,
                tone: 'danger',
                sections: [
                    guildLang.economy.scheduler.robberyAlertDesc,
                    [
                        `**${getEmoji('coin')} ${guildLang.economy.scheduler.stolenAmountLabel}:** ${result.stolenAmount.toLocaleString()}`,
                        `**${getEmoji('bank')} ${guildLang.economy.scheduler.remainingVaultLabel}:** ${result.remainingAmount.toLocaleString()}`,
                        `**${getEmoji('shield')} ${guildLang.economy.scheduler.securityLevelLabel}:** ${result.securityLevel}%`,
                        `**${getEmoji('analytics')} ${guildLang.economy.scheduler.theftPercentageLabel}:** ${(result.stealPercentage * 100).toFixed(1)}%`,
                        `**${getEmoji('heart')} ${guildLang.economy.scheduler.petStatusLabel}:** ${result.hasPets ? guildLang.economy.scheduler.petInjuredDefending : guildLang.economy.scheduler.noPetsDefending}`
                    ].join('\n')
                ],
                _footer: guildLang.economy.scheduler.robberyTip
            });
            user.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
        return result;
    }
    
    async function handleRoleExpiries(client) {
        try {
            const BATCH_SIZE = 250;
            const now = new Date();
            let lastId = null;
            let totalProcessed = 0;

            console.log('[EconomyScheduler] Starting role expiry checks with optimized batch processing...');

            while (true) {
                const query = { 'purchasedRoles.expiryDate': { $lte: now } };
                if (lastId) query._id = { $gt: lastId };
                const profiles = await Economy.find(query)
                .sort({ _id: 1 })
                .limit(BATCH_SIZE)
                .lean();

                if (!profiles.length) break;
                lastId = profiles[profiles.length - 1]._id;

                for (const profile of profiles) {
                    try {
                        
                        const claimed = await Economy.findOneAndUpdate(
                            { userId: profile.userId, guildId: profile.guildId, 'purchasedRoles.expiryDate': { $lte: now } },
                            { $pull: { purchasedRoles: { expiryDate: { $lte: now } } } },
                            { returnDocument: 'before' }
                        ).select('userId guildId purchasedRoles');
                        if (!claimed) continue;
                        const expiredRoleNames = (claimed.purchasedRoles || [])
                            .filter(role => role.expiryDate && new Date(role.expiryDate) <= now)
                            .map(role => role.roleName)
                            .filter(Boolean);
                        if (!expiredRoleNames.length) continue;
                        totalProcessed++;

                        try {
                            const guild = client.guilds.cache.get(profile.guildId);
                            const member = guild ? await guild.members.fetch(profile.userId).catch(() => null) : null;
                            if (guild && member) {
                                for (const roleName of expiredRoleNames) {
                                    const discordRole = guild.roles.cache.find(role => role.name.toLowerCase() === roleName.toLowerCase());
                                    if (discordRole && member.roles.cache.has(discordRole.id)) await member.roles.remove(discordRole).catch(() => {});
                                }
                            }
                        } catch (error) {
                            console.error(`[EconomyScheduler] Discord role cleanup failed for ${profile.userId}/${profile.guildId}:`, error);
                        }

                        const user = await client.users.fetch(profile.userId).catch(() => null);
                        if (user) {
                            const card = buildCard({
                                title: `${getEmoji('crown')} ${lang.economy.scheduler.premiumRolesExpiredTitle}`,
                                tone: 'warning',
                                sections: [
                                    `${lang.economy.scheduler.expiredRolesNotice}\n**${expiredRoleNames.join(', ')}**`,
                                    `**${getEmoji('refresh')} ${lang.economy.scheduler.renewRolesTitle}**\n${lang.economy.scheduler.renewRolesDesc}`
                                ]
                            });
                            user.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                        }
                    } catch (err) {
                        console.error(`Error processing role expiry for ${profile.userId}/${profile.guildId}:`, err);
                    }
                }

                if (profiles.length < BATCH_SIZE) break;
            }

            console.log(`[EconomyScheduler] Role expiry complete! Processed ${totalProcessed} profiles.`);
        } catch (error) {
            console.error('Error in role expiry system:', error);
        }
    }
    
    
    async function handleHeatDecay() {
        try {
            const BATCH_SIZE = 250;
            const now = new Date();
            const decayDay = new Date(now);
            decayDay.setUTCHours(0, 0, 0, 0);
            let lastId = null;
            let totalDecayed = 0;
            const { EconomyManager } = require('../models/economy/economy');

            console.log('[EconomyScheduler] Starting heat decay processing...');

            while (true) {
                const query = { heatLevel: { $gt: 0 } };
                if (lastId) query._id = { $gt: lastId };
                const profiles = await Economy.find(query)
                .sort({ _id: 1 })
                .limit(BATCH_SIZE)
                .lean();

                if (!profiles.length) break;
                lastId = profiles[profiles.length - 1]._id;
                for (const profile of profiles) {
                    try {
                        const result = await EconomyManager.mutateProfileAtomically({
                            userId: profile.userId,
                            guildId: profile.guildId,
                            referenceId: `heat-decay:${decayDay.toISOString().slice(0, 10)}`,
                            mutate: async current => {
                                const lastDecay = current.lastHeatDecay ? new Date(current.lastHeatDecay) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
                                const elapsedDays = Math.floor((now.getTime() - lastDecay.getTime()) / 86400000);
                                if (elapsedDays < 1 || (current.heatLevel || 0) <= 0) return { success: false, error: 'not_due' };
                                const decayAmount = Math.min(current.heatLevel, elapsedDays);
                                current.heatLevel = Math.max(0, current.heatLevel - decayAmount);
                                current.lastHeatDecay = now;
                                return { noLedger: true, decayed: decayAmount };
                            }
                        });
                        if (result?.success) totalDecayed += result.decayed || 0;
                    } catch (error) {
                        console.error(`[EconomyScheduler] Heat decay failed for ${profile.userId}/${profile.guildId}:`, error);
                    }
                }
                if (profiles.length < BATCH_SIZE) break;
            }

            console.log(`[EconomyScheduler] Heat decay complete! Total heat reduced: ${totalDecayed}%`);
        } catch (error) {
            console.error('[EconomyScheduler] Error in heat decay:', error);
        }
    }

    async function handleRandomEvents(client) {
        try {
            const BATCH_SIZE = 100;
            const EVENT_CHANCE = 0.15; 
            let lastId = null;
            let totalEvents = 0;
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const eventCycle = Math.floor(Date.now() / (4 * 60 * 60 * 1000));
            const referenceId = `random-event:${eventCycle}`;

            console.log('[EconomyScheduler] Starting random events with optimized batch processing...');

            while (totalEvents < 50) { 
                const query = {
                    $or: [
                        { 'cooldowns.work': { $gte: oneDayAgo } },
                        { 'cooldowns.daily': { $gte: oneDayAgo } },
                        { 'cooldowns.business': { $gte: oneDayAgo } }
                    ]
                };
                if (lastId) query._id = { $gt: lastId };
                const activeProfiles = await Economy.find(query)
                .sort({ _id: 1 })
                .limit(BATCH_SIZE)
                .lean();

                if (activeProfiles.length === 0) break;
                lastId = activeProfiles[activeProfiles.length - 1]._id;

                const eventPromises = [];

                for (const profile of activeProfiles) {
                    if (Math.random() < EVENT_CHANCE && totalEvents < 50) {
                        totalEvents++;
                        eventPromises.push(
                            triggerRandomEvent(client, profile, referenceId).catch(err => {
                                console.error(`Error triggering event for ${profile.userId}:`, err);
                            })
                        );

                        
                        if (eventPromises.length >= 10) {
                            await Promise.all(eventPromises);
                            eventPromises.length = 0;
                        }
                    }
                }

                
                if (eventPromises.length > 0) {
                    await Promise.all(eventPromises);
                }

                if (activeProfiles.length < BATCH_SIZE) break;
            }

            console.log(`[EconomyScheduler] Random events complete! Triggered ${totalEvents} events.`);
        } catch (error) {
            console.error('Error in random events system:', error);
        }
    }
    
    async function triggerRandomEvent(client, profileData, referenceId) {
        const guildLang = loadLanguage(profileData.guildId);
        const ev = guildLang.economy?.scheduler?.events || {};
        const settlement = await EconomyManager.mutateProfileAtomically({
            userId: profileData.userId,
            guildId: profileData.guildId,
            referenceId,
            mutate: async current => {
                const events = [
                    { name: 'Lucky Find', condition: () => true, apply: () => {
                        const amount = Math.floor(Math.random() * 2000) + 500;
                        current.wallet = (current.wallet || 0) + amount;
                        return { title: `${getEmoji('sparkles')} ${ev.luckyFindTitle}`, description: ev.luckyFindDesc.replace('{amount}', amount), color: '#4CAF50', amount };
                    } },
                    { name: 'Car Breakdown', condition: () => (current.cars || []).length > 0, apply: () => {
                        const car = current.cars[Math.floor(Math.random() * current.cars.length)];
                        const nominalCost = Math.floor(Math.random() * 1000) + 200;
                        const cost = Math.min(current.wallet || 0, nominalCost);
                        const durabilityLoss = Math.floor(Math.random() * 20) + 5;
                        current.wallet = Math.max(0, (current.wallet || 0) - cost);
                        car.durability = Math.max(0, (car.durability || 0) - durabilityLoss);
                        return { title: `${getEmoji('settings')} ${ev.carBreakdownTitle}`, description: ev.carBreakdownDesc.replace('{car}', car.name).replace('{cost}', cost).replace('{durability}', car.durability), color: '#FF5722', amount: -cost };
                    } },
                    { name: 'Pet Illness', condition: () => (current.pets || []).length > 0, apply: () => {
                        const pet = current.pets[Math.floor(Math.random() * current.pets.length)];
                        const nominalCost = Math.floor(Math.random() * 500) + 100;
                        const cost = Math.min(current.wallet || 0, nominalCost);
                        current.wallet = Math.max(0, (current.wallet || 0) - cost);
                        pet.health = Math.max(20, pet.health - 30);
                        pet.happiness = Math.max(10, pet.happiness - 20);
                        return { title: `${getEmoji('warning')} ${ev.petEmergencyTitle}`, description: ev.petEmergencyDesc.replace('{pet}', pet.name).replace('{cost}', cost), color: '#FF9800', amount: -cost };
                    } },
                    { name: 'Family Bonus', condition: () => (current.familyMembers || []).length > 0, apply: () => {
                        const member = current.familyMembers[Math.floor(Math.random() * current.familyMembers.length)];
                        const bonus = Math.floor(Math.random() * 1500) + 500;
                        current.wallet = (current.wallet || 0) + bonus;
                        member.bond = Math.min(100, (member.bond || 0) + 5);
                        return { title: `${getEmoji('groupusers')} ${ev.familySuccessTitle}`, description: ev.familySuccessDesc.replace('{member}', member.name).replace('{bonus}', bonus), color: '#E91E63', amount: bonus };
                    } },
                    { name: 'Property Appreciation', condition: () => (current.properties || []).length > 0, apply: () => {
                        const property = current.properties[Math.floor(Math.random() * current.properties.length)];
                        const value = Number(property.currentValue ?? property.purchasePrice) || 0;
                        const appreciation = Math.floor(value * 0.02);
                        property.currentValue = value + appreciation;
                        return { title: `${getEmoji('home')} ${ev.propertyValueUpTitle}`, description: ev.propertyValueUpDesc.replace('{property}', property.name).replace('{appreciation}', appreciation.toLocaleString()), color: '#2196F3', amount: 0 };
                    } },
                    { name: 'Utility Bill Spike', condition: () => (current.properties || []).length > 0, apply: () => {
                        const nominalCost = Math.floor(Math.random() * 800) + 200;
                        const cost = Math.min(current.wallet || 0, nominalCost);
                        current.wallet = Math.max(0, (current.wallet || 0) - cost);
                        return { title: `${getEmoji('fire')} ${ev.utilityBillSpikeTitle}`, description: ev.utilityBillSpikeDesc.replace('{cost}', cost), color: '#FF5722', amount: -cost };
                    } },
                    { name: 'Business Boom', condition: () => (current.businesses || []).length > 0, apply: () => {
                        const business = current.businesses[Math.floor(Math.random() * current.businesses.length)];
                        const bonusProfit = Math.floor(Math.random() * 5000) + 1000;
                        current.wallet = (current.wallet || 0) + bonusProfit;
                        business.reputation = Math.min(100, (business.reputation || 0) + 2);
                        return { title: `${getEmoji('trend')} ${ev.businessBoomTitle}`, description: ev.businessBoomDesc.replace('{business}', business.name).replace('{profit}', bonusProfit.toLocaleString()), color: '#4CAF50', amount: bonusProfit };
                    } },
                    { name: 'Hunting Trophy Found', condition: () => (current.huntingStats?.totalHunts || 0) > 5, apply: () => {
                        const trophyValue = Math.floor(Math.random() * 3000) + 1000;
                        current.wallet = (current.wallet || 0) + trophyValue;
                        current.huntingStats.rareAnimalsFound = (current.huntingStats.rareAnimalsFound || 0) + 1;
                        return { title: `${getEmoji('crown')} ${ev.rareTrophyTitle}`, description: ev.rareTrophyDesc.replace('{trophy}', trophyValue.toLocaleString()), color: '#FFD700', amount: trophyValue };
                    } },
                    { name: 'Heist Opportunity', condition: () => (current.heistSkill || 0) > 20, apply: () => {
                        const opportunityValue = Math.floor(Math.random() * 100000) + 50000;
                        return { title: `${getEmoji('security')} ${ev.heistOpportunityTitle}`, description: ev.heistOpportunityDesc.replace('{payout}', opportunityValue.toLocaleString()), color: '#9C27B0', amount: 0 };
                    } }
                ].filter(event => event.condition());
                if (!events.length) return { success: false, error: 'no_event' };
                const event = events[Math.floor(Math.random() * events.length)];
                const result = event.apply();
                current.transactions.push({ type: result.amount > 0 ? 'income' : result.amount < 0 ? 'expense' : 'shop', amount: Math.abs(result.amount), description: `Random Event: ${event.name}`, category: 'random_event', timestamp: new Date() });
                return { eventName: event.name, ...result };
            }
        });
        if (!settlement?.success) return settlement;
        const user = await client.users.fetch(profileData.userId).catch(() => null);
        if (!user) return settlement;
        const result = settlement;
        const card = buildCard({
            title: result.title,
            sections: [result.description],
            accentColor: result.color ? parseInt(result.color.replace('#', ''), 16) : ACCENT.primary,
            _footer: guildLang.economy.scheduler.randomEventFooter
        });
        user.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        return settlement;
    }

    async function handleStockFluctuations() {
        try {
            console.log('[EconomyScheduler] Processing stock price fluctuations...');
            
            
            const hasEvent = Math.random() < 0.2;
            let eventApplied = null;
            
            if (hasEvent && MARKET_EVENTS && MARKET_EVENTS.length > 0) {
                eventApplied = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
            }

            const stockKeys = Object.keys(STOCKS);
            for (const symbol of stockKeys) {
                
                await EconomyManager.getStockPrice(symbol);
            }

            if (eventApplied) {
                console.log(`[EconomyScheduler] Market Event: ${eventApplied.name} (${eventApplied.effect > 0 ? '+' : ''}${(eventApplied.effect * 100).toFixed(1)}%)`);
            }
            
            console.log('[EconomyScheduler] Stock fluctuations processed.');
        } catch (error) {
            console.error('[EconomyScheduler] Error in stock fluctuations:', error);
        }
    }

    async function handleCropWithering() {
        try {
            const BATCH_SIZE = 200;
            const now = new Date();
            const checkHour = new Date(now);
            checkHour.setUTCMinutes(0, 0, 0);
            let lastId = null;
            let totalWithered = 0;

            while (true) {
                const query = {
                    'farmPlots.0': { $exists: true }
                };
                if (lastId) query._id = { $gt: lastId };
                const profiles = await Economy.find(query)
                .sort({ _id: 1 })
                .limit(BATCH_SIZE);

                if (!profiles.length) break;
                lastId = profiles[profiles.length - 1]._id;

                for (const profile of profiles) {
                    try {
                        const result = await EconomyManager.mutateProfileAtomically({
                            userId: profile.userId,
                            guildId: profile.guildId,
                            referenceId: `crop-wither:${checkHour.toISOString()}`,
                            mutate: async current => {
                                if (current.lastCropWitherCheck && new Date(current.lastCropWitherCheck) >= checkHour) return { success: false, error: 'already_checked' };
                                current.lastCropWitherCheck = now;
                                let withered = 0;
                                for (const plot of current.farmPlots || []) {
                                    if (!plot.crop || plot.status !== 'growing' || !plot.plantedAt) continue;
                                    const cropData = CROPS[plot.crop];
                                    if (!cropData) continue;
                                    const harvestAt = plot.harvestAt ? new Date(plot.harvestAt) : new Date(new Date(plot.plantedAt).getTime() + cropData.growTime);
                                    
                                    if (now >= harvestAt) continue;
                                    const lastWatered = plot.lastWatered ? new Date(plot.lastWatered) : new Date(plot.plantedAt);
                                    if (!Number.isFinite(lastWatered.getTime()) || now.getTime() - lastWatered.getTime() <= cropData.growTime * 2) continue;
                                    Object.assign(plot, { crop: null, plantedAt: null, harvestAt: null, fertilized: false, watered: false, lastWatered: null, quality: 'normal', status: 'empty' });
                                    withered++;
                                }
                                if (!withered) return { noLedger: true, withered: 0 };
                                current.transactions.push({ type: 'shop', amount: 0, description: `Withered ${withered} unattended crop(s)`, category: 'farming', timestamp: now });
                                return { withered };
                            }
                        });
                        totalWithered += result?.withered || 0;
                    } catch (error) {
                        console.error(`[EconomyScheduler] Crop withering failed for ${profile.userId}/${profile.guildId}:`, error);
                    }
                }

                if (profiles.length < BATCH_SIZE) break;
            }

            if (totalWithered > 0) console.log(`[Farming] ${totalWithered} crops withered.`);
        } catch (error) {
            console.error('[EconomyScheduler] Error in crop withering:', error);
        }
    }

    async function handleLotteryDraw(client) {
        try {
            const results = await processDueLotteryDraws();
            if (results.length) console.log(`[EconomyScheduler] Processing ${results.length} due/recovering lottery round(s)...`);
            for (const draw of results) {
                if (draw.status !== 'completed') continue;
                console.log(`[EconomyScheduler] Lottery ${draw.roundId} completed; winners=${draw.winnersCount}, paid=$${draw.paidAmount.toLocaleString()}, carryover=$${draw.carryover.toLocaleString()}`);
                for (const winner of draw.winners || []) {
                    const user = await client.users.fetch(winner.userId).catch(() => null);
                    if (!user) continue;
                    const matches = Number(winner.description.match(/(\d+)\//)?.[1]) || 0;
                    const card = buildCard({
                        title: `${getEmoji('gift')} ${lang.economy.scheduler.lotteryWinnerTitle}`,
                        tone: 'success',
                        sections: [
                            lang.economy.scheduler.lotteryMatchedDesc
                                .replace('{match}', String(matches))
                                .replace('{total}', String(LOTTERY_CONFIG.numbersPerTicket || 6)),
                            [
                                `**${getEmoji('coin')} ${lang.economy.scheduler.prizeLabel}:** ${winner.amount.toLocaleString()}`,
                                `**${getEmoji('target')} ${lang.economy.scheduler.winningNumbersLabel}:** ${draw.winningNumbers.join(', ')}`
                            ].join('\n')
                        ]
                    });
                    user.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                }
            }
        } catch (error) {
            console.error('[EconomyScheduler] Error in lottery draw:', error);
        }
    }

    async function handleBankInterest() {
        try {
            console.log('[EconomyScheduler] Processing daily bank interest...');
            const BATCH_SIZE = 100;
            let totalInterest = 0;
            let profilesProcessed = 0;
            let lastId = null;
            while (true) {
                const query = { bank: { $gt: 0 } };
                if (lastId) query._id = { $gt: lastId };
                const profiles = await Economy.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).select('_id userId guildId');
                if (!profiles.length) break;
                lastId = profiles[profiles.length - 1]._id;
                for (let i = 0; i < profiles.length; i += 10) {
                    await Promise.all(profiles.slice(i, i + 10).map(async profile => {
                        try {
                            const claim = await EconomyManager.claimInterest(profile.userId, profile.guildId);
                            if (claim.success) {
                                totalInterest += claim.interest;
                                profilesProcessed++;
                            }
                        } catch (error) {
                            console.error(`[EconomyScheduler] Interest claim failed for ${profile.userId}/${profile.guildId}:`, error);
                        }
                    }));
                }
            }

            console.log(`[EconomyScheduler] Interest complete! $${totalInterest.toLocaleString()} distributed to ${profilesProcessed} profiles where a daily claim was due.`);
        } catch (error) {
            console.error('[EconomyScheduler] Error in bank interest:', error);
        }
    }

    async function handleStockDividends() {
        try {
            console.log('[EconomyScheduler] Processing weekly stock dividends...');
            const BATCH_SIZE = 100;
            let totalDividends = 0;
            const weekStart = new Date();
            weekStart.setUTCHours(0, 0, 0, 0);
            weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
            const referenceId = `stock-dividends:${weekStart.toISOString().slice(0, 10)}`;
            const prices = Object.fromEntries(Object.keys(STOCKS).map(symbol => [symbol, EconomyManager.getStockPrice(symbol)]));
            let lastId = null;
            while (true) {
                const query = { 'stockPortfolio.0': { $exists: true } };
                if (lastId) query._id = { $gt: lastId };
                const profiles = await Economy.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).select('_id userId guildId');
                if (!profiles.length) break;
                lastId = profiles[profiles.length - 1]._id;
                for (let i = 0; i < profiles.length; i += 10) {
                    await Promise.all(profiles.slice(i, i + 10).map(async profile => {
                        try {
                            const settlement = await EconomyManager.mutateProfileAtomically({ userId: profile.userId, guildId: profile.guildId, referenceId, mutate: async current => {
                                const totalDividends = (current.stockPortfolio || []).reduce((sum, holding) => {
                                    const stockData = STOCKS[holding.symbol];
                                    const price = prices[holding.symbol];
                                    if (!stockData || stockData.dividendRate <= 0 || !price) return sum;
                                    return sum + Math.floor(price * stockData.dividendRate * holding.shares);
                                }, 0);
                                if (totalDividends <= 0) return { success: false, error: 'no_dividend' };
                                current.wallet += totalDividends;
                                current.transactions.push({ type: 'income', amount: totalDividends, description: `Weekly stock dividends (${referenceId.slice(-10)})`, category: 'stocks', timestamp: new Date() });
                                return { totalDividends };
                            }});
                            if (settlement.success) totalDividends += settlement.totalDividends;
                        } catch (error) {
                            console.error(`[EconomyScheduler] Dividend settlement failed for ${profile.userId}/${profile.guildId}:`, error);
                        }
                    }));
                }
            }

            console.log(`[EconomyScheduler] Dividends complete! $${totalDividends.toLocaleString()} distributed for ${referenceId}.`);
        } catch (error) {
            console.error('[EconomyScheduler] Error in stock dividends:', error);
        }
    }

    async function handleInsuranceExpiry() {
        try {
            console.log('[EconomyScheduler] Cleaning expired insurance policies...');
            const result = await Economy.updateMany(
                { 'insurancePolicies.expiryDate': { $lte: new Date() } },
                { $pull: { insurancePolicies: { expiryDate: { $lte: new Date() } } } }
            );
            if (result.modifiedCount > 0) {
                console.log(`[EconomyScheduler] Cleaned expired policies from ${result.modifiedCount} profiles.`);
            }
        } catch (error) {
            console.error('[EconomyScheduler] Error in insurance expiry cleanup:', error);
        }
    }

    const stop = () => {
        for (const task of scheduledTasks) {
            if (task && typeof task.stop === 'function') {
                task.stop();
            }
        }
        scheduledTasks.length = 0;
    };

    return {
        scheduledTasks,
        stop,
        handleNightlyRobberies,
        handleRoleExpiries,
        handleRandomEvents,
        handleHeatDecay,
        handleStockFluctuations,
        handleCropWithering,
        handleLotteryDraw,
        handleBankInterest,
        handleStockDividends,
        handleInsuranceExpiry
    };
};
