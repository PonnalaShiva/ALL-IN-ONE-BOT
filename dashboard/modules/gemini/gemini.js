const colors = require('../../../UI/colors/colors');
const GeminiApiKey = require('../../../models/ai/GeminiApiKey');
const { GoogleGenerativeAI } = require('@google/generative-ai');


async function sendAllGeminiData(socket, serverId) {
    try {
        if (!serverId) {
            console.log(`${colors.yellow}⚠️ No serverId provided for Gemini data${colors.reset}`);
            return;
        }

        console.log(`${colors.blue}📊 Sending Gemini API key data for server ${serverId}${colors.reset}`);

        const allKeys = await GeminiApiKey.find({ serverId }).sort({ addedAt: -1 }).limit(100);

        const sanitizedKeys = allKeys.map(key => ({
            ...key.toObject(),
            apiKey: formatApiKeyForDisplay(key.apiKey)
        }));

        emitGeminiUpdate(serverId, {
            apiKeys: sanitizedKeys,
            stats: await getGeminiStats(serverId)
        }, socket, 'gemini_data');

        console.log(`${colors.green}✅ Sent ${allKeys.length} Gemini API keys for server ${serverId}${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Error sending Gemini data:${colors.reset}`, error);
    }
}


function formatApiKeyForDisplay(apiKey) {
    if (!apiKey) return '***HIDDEN***';

    if (apiKey.length > 12) {
        const start = apiKey.slice(0, 8);
        const end = apiKey.slice(-4);
        const middle = '*'.repeat(Math.min(apiKey.length - 12, 20));
        return `${start}${middle}${end}`;
    }

    if (apiKey.length > 6) {
        const start = apiKey.slice(0, 4);
        const end = apiKey.slice(-2);
        const middle = '*'.repeat(apiKey.length - 6);
        return `${start}${middle}${end}`;
    }

    return '*'.repeat(apiKey.length);
}


function emitGeminiUpdate(serverId, data, socket, eventType = 'gemini_update') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: {
                serverId: serverId,
                data: data,
                timestamp: Date.now()
            }
        });
    }
}


async function addGeminiApiKey(options, socket) {
    try {
        const { apiKey, name, addedBy, serverId } = options;

        if (!serverId) {
            throw new Error('serverId is required');
        }

        console.log(`${colors.blue}🔑 Adding new Gemini API key for server ${serverId}${colors.reset}`);

        
        const existingKey = await GeminiApiKey.findOne({ apiKey, serverId });
        if (existingKey) {
            throw new Error('This API key is already registered for this server');
        }

        
        const keyId = `GEMINI_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        
        const testResult = await testApiKey(apiKey);

        if (!testResult.success) {
            console.log(`${colors.yellow}⚠️ API key test failed (will save anyway): ${testResult.error}${colors.reset}`);
        }

        
        const newKey = new GeminiApiKey({
            keyId,
            apiKey,
            serverId,
            name,
            addedBy,
            avgResponseTime: testResult.responseTime || 0,
            
            isBlocked: !testResult.success,
            blockedReason: !testResult.success ? testResult.error : null
        });

        await newKey.save();

        console.log(`${colors.green}✅ Gemini API key added for server ${serverId}: ${name}${colors.reset}`);

        emitGeminiUpdate(serverId, {
            type: 'api_key_added',
            apiKey: {
                ...newKey.toObject(),
                apiKey: formatApiKeyForDisplay(apiKey)
            },
            testResult,
            stats: await getGeminiStats(serverId)
        }, socket, 'gemini_update');

        return { apiKey: newKey, testResult };

    } catch (error) {
        console.error(`${colors.red}❌ Error adding Gemini API key:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'gemini_error',
                payload: {
                    error: error.message,
                    action: 'add_api_key',
                    serverId: options.serverId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function removeGeminiApiKey(keyId, serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Removing Gemini API key: ${keyId} from server ${serverId}${colors.reset}`);

        const deleted = await GeminiApiKey.deleteOne({ keyId, serverId });

        if (deleted.deletedCount === 0) {
            throw new Error('API key not found');
        }

        console.log(`${colors.green}✅ Gemini API key removed: ${keyId}${colors.reset}`);

        emitGeminiUpdate(serverId, {
            type: 'api_key_removed',
            keyId,
            stats: await getGeminiStats(serverId)
        }, socket, 'gemini_update');

        return { deleted: true };

    } catch (error) {
        console.error(`${colors.red}❌ Error removing Gemini API key:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'gemini_error',
                payload: {
                    error: error.message,
                    action: 'remove_api_key',
                    keyId,
                    serverId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function updateGeminiApiKey(keyId, serverId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating Gemini API key: ${keyId} for server ${serverId}${colors.reset}`);

        const apiKey = await GeminiApiKey.findOneAndUpdate(
            { keyId, serverId },
            {
                $set: {
                    ...updates,
                    lastModifiedAt: new Date()
                }
            },
            { returnDocument: 'after', runValidators: true }
        );

        if (!apiKey) {
            throw new Error('API key not found');
        }

        console.log(`${colors.green}✅ Gemini API key updated: ${keyId}${colors.reset}`);

        emitGeminiUpdate(serverId, {
            type: 'api_key_updated',
            keyId,
            apiKey: {
                ...apiKey.toObject(),
                apiKey: formatApiKeyForDisplay(apiKey.apiKey)
            },
            updates,
            stats: await getGeminiStats(serverId)
        }, socket, 'gemini_update');

        return apiKey;

    } catch (error) {
        console.error(`${colors.red}❌ Error updating Gemini API key:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'gemini_error',
                payload: {
                    error: error.message,
                    action: 'update_api_key',
                    keyId,
                    serverId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function testGeminiApiKeys(keyIds, serverId, socket) {
    try {
        console.log(`${colors.blue}🔧 Testing Gemini API keys for server ${serverId}${colors.reset}`);

        let keysToTest;
        if (keyIds && keyIds.length > 0) {
            keysToTest = await GeminiApiKey.find({ keyId: { $in: keyIds }, serverId });
        } else {
            keysToTest = await GeminiApiKey.find({ serverId, isActive: true, isBlocked: false }).limit(5);
        }

        if (keysToTest.length === 0) {
            throw new Error('No API keys found to test');
        }

        const results = [];

        for (const key of keysToTest) {
            const result = await testApiKey(key.apiKey);

            results.push({
                keyId: key.keyId,
                name: key.name,
                ...result
            });

            if (result.success) {
                key.lastUsedAt = new Date();
                key.avgResponseTime = Math.round((key.avgResponseTime + result.responseTime) / 2);
            } else {
                key.lastErrorAt = new Date();
                key.lastErrorMessage = result.error;
            }
            await key.save();
        }

        console.log(`${colors.green}✅ Tested ${results.length} Gemini API keys${colors.reset}`);

        emitGeminiUpdate(serverId, {
            type: 'api_keys_tested',
            results,
            stats: await getGeminiStats(serverId)
        }, socket, 'gemini_update');

        return { results };

    } catch (error) {
        console.error(`${colors.red}❌ Error testing Gemini API keys:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'gemini_error',
                payload: {
                    error: error.message,
                    action: 'test_api_keys',
                    serverId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getAllGeminiApiKeys(serverId, options = {}, socket) {
    try {
        console.log(`${colors.blue}📋 Getting Gemini API keys for server ${serverId}${colors.reset}`);

        const { page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;

        const [apiKeys, total] = await Promise.all([
            GeminiApiKey.find({ serverId })
                .sort({ addedAt: -1 })
                .skip(skip)
                .limit(limit),
            GeminiApiKey.countDocuments({ serverId })
        ]);

        const sanitizedKeys = apiKeys.map(key => ({
            ...key.toObject(),
            apiKey: formatApiKeyForDisplay(key.apiKey)
        }));

        const pagination = {
            current: page,
            total: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
            totalItems: total
        };

        console.log(`${colors.green}✅ Retrieved ${apiKeys.length} Gemini API keys for server ${serverId}${colors.reset}`);

        emitGeminiUpdate(serverId, {
            type: 'api_keys_list',
            apiKeys: sanitizedKeys,
            pagination,
            stats: await getGeminiStats(serverId)
        }, socket, 'gemini_data');

        return { apiKeys: sanitizedKeys, pagination };

    } catch (error) {
        console.error(`${colors.red}❌ Error getting Gemini API keys:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'gemini_error',
                payload: {
                    error: error.message,
                    action: 'get_all_api_keys',
                    serverId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getGeminiApiKey(keyId, serverId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting Gemini API key: ${keyId} for server ${serverId}${colors.reset}`);

        const apiKey = await GeminiApiKey.findOne({ keyId, serverId });

        if (!apiKey) {
            throw new Error('API key not found');
        }

        const sanitizedKey = {
            ...apiKey.toObject(),
            apiKey: formatApiKeyForDisplay(apiKey.apiKey)
        };

        console.log(`${colors.green}✅ Retrieved Gemini API key: ${keyId}${colors.reset}`);

        emitGeminiUpdate(serverId, {
            type: 'single_api_key',
            keyId,
            apiKey: sanitizedKey
        }, socket, 'gemini_data');

        return sanitizedKey;

    } catch (error) {
        console.error(`${colors.red}❌ Error getting Gemini API key:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'gemini_error',
                payload: {
                    error: error.message,
                    action: 'get_api_key',
                    keyId,
                    serverId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getGeminiStats(serverId, socket = null) {
    try {
        const query = serverId ? { serverId } : {};

        const [
            totalKeys,
            activeKeys,
            blockedKeys,
            disabledKeys,
            totalRequests,
            totalSuccessful,
            totalFailed,
            recentKeys
        ] = await Promise.all([
            GeminiApiKey.countDocuments(query),
            GeminiApiKey.countDocuments({ ...query, isActive: true, isBlocked: false }),
            GeminiApiKey.countDocuments({ ...query, isBlocked: true }),
            GeminiApiKey.countDocuments({ ...query, isActive: false }),
            GeminiApiKey.aggregate([
                { $match: query },
                { $group: { _id: null, total: { $sum: '$totalRequests' } } }
            ]),
            GeminiApiKey.aggregate([
                { $match: query },
                { $group: { _id: null, total: { $sum: '$successfulRequests' } } }
            ]),
            GeminiApiKey.aggregate([
                { $match: query },
                { $group: { _id: null, total: { $sum: '$failedRequests' } } }
            ]),
            GeminiApiKey.countDocuments({
                ...query,
                addedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            })
        ]);

        const stats = {
            totalKeys,
            activeKeys,
            blockedKeys,
            disabledKeys,
            totalRequests: totalRequests[0]?.total || 0,
            totalSuccessful: totalSuccessful[0]?.total || 0,
            totalFailed: totalFailed[0]?.total || 0,
            successRate: totalRequests[0]?.total > 0 ?
                Math.round((totalSuccessful[0]?.total || 0) / totalRequests[0].total * 100) : 0,
            recentKeys
        };

        if (socket) {
            emitGeminiUpdate(serverId, {
                type: 'gemini_stats',
                stats
            }, socket, 'gemini_stats_update');
        }

        return stats;

    } catch (error) {
        console.error(`${colors.red}❌ Error getting Gemini stats:${colors.reset}`, error);
        return {
            totalKeys: 0,
            activeKeys: 0,
            blockedKeys: 0,
            disabledKeys: 0,
            totalRequests: 0,
            totalSuccessful: 0,
            totalFailed: 0,
            successRate: 0,
            recentKeys: 0
        };
    }
}


async function testApiKey(apiKey) {
    try {
        const startTime = Date.now();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

        const result = await Promise.race([
            model.generateContent("Test message: respond with 'OK'"),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
            )
        ]);

        const responseTime = Date.now() - startTime;
        const response = await result.response;

        return {
            success: true,
            responseTime,
            response: response.text()
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    sendAllGeminiData,
    addGeminiApiKey,
    removeGeminiApiKey,
    updateGeminiApiKey,
    testGeminiApiKeys,
    getAllGeminiApiKeys,
    getGeminiApiKey,
    getGeminiStats
};
