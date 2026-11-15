const { GoogleGenAI, ThinkingLevel } = require('@google/genai');
const GeminiApiKey = require('../models/ai/GeminiApiKey');
const axios = require('axios');


const MODELS = {
    
    FLASH_LITE_CHAIN: [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash-lite',
    ],

    
    FLASH_CHAIN: [
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3-flash',
        'gemini-2.5-flash',
    ],

    
    PRO_CHAIN: [
        'gemini-4-hydrogen',
        'gemini-3.8-flash',
        'gemini-3.6-flash',
    ],

    
    OTHER_CHAIN: [
        'gemma-4-31b',
        'gemma-4-26b',
    ],

    
    IMAGE_CHAIN: [
        'gemini-3.1-flash-image',
    ],

    
    FLASH: 'gemini-3.5-flash-lite',
    PRO: 'gemini-4-hydrogen',
    IMAGE: 'gemini-3.1-flash-image'
};


const RATE_LIMITS = {
    
    'gemini-4-hydrogen': { rpm: 5, tpm: 250000, rpd: 20 },
    'gemini-3.8-flash': { rpm: 5, tpm: 250000, rpd: 20 },
    'gemini-3.6-flash': { rpm: 5, tpm: 250000, rpd: 20 },
    'gemini-3.5-flash': { rpm: 5, tpm: 250000, rpd: 20 },
    'gemini-3-flash': { rpm: 5, tpm: 250000, rpd: 20 },
    'gemini-2.5-flash': { rpm: 5, tpm: 250000, rpd: 20 },
    
    
    'gemini-3.5-flash-lite': { rpm: 15, tpm: 250000, rpd: 500 },
    'gemini-3.1-flash-lite': { rpm: 15, tpm: 250000, rpd: 500 },
    'gemini-2.5-flash-lite': { rpm: 10, tpm: 250000, rpd: 20 },
    
    
    'gemma-4-31b': { rpm: 30, tpm: 16000, rpd: 14400 },
    'gemma-4-26b': { rpm: 30, tpm: 16000, rpd: 14400 },
    
    
    'gemini-3.1-flash-image': { rpm: 5, tpm: 250000, rpd: 20 },
};

class AIManager {
    constructor() {
        this.serverKeyCache = new Map(); 
        this.rateLimits = new Map();     
        this.globalKeyIndex = new Map(); 
        this.modelRotation = new Map();  
        this.cacheTimeout = 60000;       

        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        if (this.cleanupInterval?.unref) this.cleanupInterval.unref();
    }

    stop() {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
        this.serverKeyCache.clear();
        this.rateLimits.clear();
        this.globalKeyIndex.clear();
        this.modelRotation.clear();
    }

    async updateServerKeyCache(serverId) {
        if (!serverId) {
            throw new Error('serverId is required for server-scoped AI operations');
        }

        try {
            const keys = await GeminiApiKey.find({
                serverId,
                isActive: true,
                $or: [
                    { isBlocked: false },
                    { blockedUntil: { $lt: new Date() } }
                ]
            }).sort({ avgResponseTime: 1 });

            const keyMap = new Map();

            for (const key of keys) {
                if (key.isBlocked && key.blockedUntil && key.blockedUntil < new Date()) {
                    key.isBlocked = false;
                    key.blockedUntil = null;
                    key.blockedReason = null;
                    await key.save();
                }

                if (!key.isBlocked) {
                    keyMap.set(key.keyId, {
                        keyId: key.keyId,
                        apiKey: key.apiKey,
                        name: key.name,
                        avgResponseTime: key.avgResponseTime,
                        genAI: new GoogleGenAI({ apiKey: key.apiKey }),
                        dbRef: key
                    });
                }
            }

            this.serverKeyCache.set(serverId, {
                keys: keyMap,
                lastUpdate: Date.now()
            });

            return keyMap.size;
        } catch (error) {
            console.error(`\x1b[31m[ AI MANAGER ]\x1b[0m Cache update failed for server ${serverId}:`, error.message);
            return 0;
        }
    }

    async getHealthyKey(serverId, model = null) {
        if (!serverId) {
            throw new Error('serverId is required');
        }

        const cached = this.serverKeyCache.get(serverId);
        if (!cached || Date.now() - cached.lastUpdate > this.cacheTimeout) {
            await this.updateServerKeyCache(serverId);
        }

        const serverCache = this.serverKeyCache.get(serverId);
        if (!serverCache || serverCache.keys.size === 0) {
            throw new Error(`No active Gemini API keys available for this server. Please add API keys in the dashboard.`);
        }

        
        const availableKeys = Array.from(serverCache.keys.values()).filter(key =>
            !this.isRateLimited(serverId, key.keyId, model || 'default')
        );

        if (availableKeys.length === 0) {
            throw new Error('All API keys are rate limited for this model. Please wait a moment or the system will try a different model.');
        }

        
        const rotationKey = `${serverId}_${model || 'default'}`;
        const currentIndex = this.modelRotation.get(rotationKey) || 0;
        const selectedKey = availableKeys[currentIndex % availableKeys.length];
        this.modelRotation.set(rotationKey, currentIndex + 1);

        return selectedKey;
    }

    isRateLimited(serverId, keyId, model) {
        const rateKey = `${serverId}_${keyId}_${model}`;
        const rateLimit = this.rateLimits.get(rateKey);
        if (!rateLimit) return false;

        const now = Date.now();
        const limits = RATE_LIMITS[model] || { rpm: 5, tpm: 250000, rpd: 20 };

        
        rateLimit.requests = rateLimit.requests.filter(time => now - time < 60000);
        rateLimit.tokens = rateLimit.tokens.filter(entry => now - entry.time < 60000);

        
        if (!rateLimit.lastReset || now - rateLimit.lastReset > 86400000) { 
            rateLimit.dailyRequests = [];
            rateLimit.lastReset = now;
        }

        
        rateLimit.dailyRequests = rateLimit.dailyRequests.filter(time => now - time < 86400000);

        
        if (rateLimit.requests.length >= limits.rpm) {
            return true;
        }

        
        const totalTokens = rateLimit.tokens.reduce((sum, entry) => sum + entry.count, 0);
        if (totalTokens >= limits.tpm) {
            return true;
        }

        
        if (rateLimit.dailyRequests.length >= limits.rpd) {
            return true;
        }

        return false;
    }

    trackRateLimit(serverId, keyId, model, tokenCount = 1000) {
        const rateKey = `${serverId}_${keyId}_${model}`;
        if (!this.rateLimits.has(rateKey)) {
            this.rateLimits.set(rateKey, { 
                requests: [], 
                tokens: [], 
                dailyRequests: [],
                lastReset: Date.now()
            });
        }
        
        const now = Date.now();
        const rateLimit = this.rateLimits.get(rateKey);
        
        rateLimit.requests.push(now);
        rateLimit.tokens.push({ time: now, count: tokenCount });
        rateLimit.dailyRequests.push(now);
    }

    async updateKeyStats(serverId, keyId, success, responseTime, error = null) {
        try {
            const key = await GeminiApiKey.findOne({ keyId, serverId });
            if (!key) return;

            key.totalRequests++;
            key.lastUsedAt = new Date();

            if (success) {
                key.successfulRequests++;
                key.avgResponseTime = Math.round((key.avgResponseTime + responseTime) / 2);
                
                
                if (key.failedRequests > 0) {
                    key.failedRequests = Math.max(0, key.failedRequests - 1);
                }
            } else {
                key.lastErrorAt = new Date();
                key.lastErrorMessage = error;

                const isInvalidKey = error && (
                    error.includes('API_KEY_INVALID') ||
                    error.includes('INVALID_API_KEY') ||
                    error.includes('API key not valid') ||
                    error.includes('API key expired') ||
                    (error.includes('403') && error.includes('API key')) ||
                    (error.includes('401') && error.includes('API key'))
                );
                
                if (isInvalidKey) {
                    key.isBlocked = true;
                    key.blockedUntil = null; 
                    key.blockedReason = 'Invalid/Expired API Key - Please update or remove';
                    console.log(`\x1b[31m[ AI MANAGER ]\x1b[0m BLOCKED key ${key.name} for server ${serverId} - API key is invalid/expired`);
                } else {
                    
                    key.failedRequests++;
                }
            }

            await key.save();
        } catch (dbError) {
            console.error('Failed to update key stats:', dbError.message);
        }
    }

    async generateContent(serverId, prompt, options = {}) {
        if (!serverId) {
            throw new Error('serverId is required for AI operations');
        }

        
        let modelCandidates = [];
        if (Array.isArray(options.model)) {
            modelCandidates = options.model;
        } else if (typeof options.model === 'string' && options.model) {
            
            const fallbackChain = this.getModelChain(options);
            modelCandidates = [options.model, ...fallbackChain.filter(m => m !== options.model)];
        } else {
            
            modelCandidates = this.getModelChain(options);
        }

        const maxKeyAttempts = 1; 
        let lastError;
        let modelAttemptCount = 0;
        const totalModels = modelCandidates.length;

        for (const currentModel of modelCandidates) {
            modelAttemptCount++;
            
            if (modelAttemptCount > 1) {
                console.log(`\x1b[36m[ AI MANAGER ]\x1b[0m Switching to fallback model '${currentModel}' (${modelAttemptCount}/${totalModels})...`);
            }
            
            for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
                let selectedKey;
                try {
                    selectedKey = await this.getHealthyKey(serverId, currentModel);
                    this.trackRateLimit(serverId, selectedKey.keyId, currentModel, 2000); 
                } catch (keyErr) {
                    lastError = keyErr;
                    console.warn(`\x1b[33m[ AI MANAGER ]\x1b[0m No available keys for model '${currentModel}', trying next model...`);
                    break; 
                }

                const config = {};
                if (options.thinkingLevel) {
                    config.thinkingConfig = {
                        thinkingLevel: options.thinkingLevel
                    };
                }
                if (options.systemInstruction) {
                    config.systemInstruction = options.systemInstruction;
                }
                if (options.temperature !== undefined) {
                    config.temperature = options.temperature;
                }

                const startTime = Date.now();
                try {
                    
                    const defaultTimeout = currentModel.includes('lite') ? 20000 : 
                                         currentModel.includes('hydrogen') ? 45000 : 30000;
                    const timeoutMs = options.timeout || defaultTimeout;
                    
                    const result = await Promise.race([
                        selectedKey.genAI.models.generateContent({
                            model: currentModel,
                            contents: prompt,
                            config: Object.keys(config).length > 0 ? config : undefined
                        }),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
                        )
                    ]);

                    const responseTime = Date.now() - startTime;
                    await this.updateKeyStats(serverId, selectedKey.keyId, true, responseTime);

                    console.log(`\x1b[36m[ AI MANAGER ]\x1b[0m Server ${serverId} ✓ model \x1b[33m${currentModel}\x1b[0m via key ${selectedKey.name} (${responseTime}ms)`);

                    return {
                        text: () => result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '',
                        modelUsed: currentModel
                    };

                } catch (error) {
                    lastError = error;

                    if (error.message.includes('safety') || error.message.includes('blocked')) {
                        throw new AIContentBlockedError('Content blocked by AI safety filters');
                    }

                    
                    const isTimeout = error.message.includes('Timeout');
                    if (!isTimeout) {
                        await this.updateKeyStats(serverId, selectedKey.keyId, false, 0, error.message);
                    }
                    
                    if (isTimeout) {
                        console.warn(`\x1b[33m[ AI MANAGER ]\x1b[0m Timeout on '${currentModel}' - moving to next model`);
                    } else {
                        console.warn(`\x1b[33m[ AI MANAGER ]\x1b[0m Error on '${currentModel}': ${error.message} - moving to next model`);
                    }
                    
                    break; 
                }
            }
        }

        throw new Error(
            `All ${totalModels} Gemini AI models exhausted. ` +
            `This could mean:\n` +
            `1. API is experiencing high demand or downtime\n` +
            `2. Your API key might be on free tier with strict limits\n` +
            `3. Consider upgrading to paid tier for better reliability\n` +
            `4. Add more API keys for better distribution\n` +
            `5. Check usage at https://aistudio.google.com/apikey to monitor what's happening\n` +
            `Last error: ${lastError?.message}`
        );
    }

    getModelChain(options = {}) {
        if (options.thinkingLevel === 'high' || options.complexity === 'high') {
            return MODELS.PRO_CHAIN;
        }
        
        if (options.fast || options.thinkingLevel === 'low') {
            return MODELS.FLASH_LITE_CHAIN;
        }

        
        return MODELS.FLASH_CHAIN;
    }

    async generateImage(serverId, prompt, options = {}) {
        if (!serverId) {
            throw new Error('serverId is required for image generation');
        }

        let modelCandidates = [];
        if (Array.isArray(options.model)) {
            modelCandidates = options.model;
        } else if (typeof options.model === 'string' && options.model) {
            modelCandidates = [options.model, ...MODELS.IMAGE_CHAIN.filter(m => m !== options.model)];
        } else {
            modelCandidates = MODELS.IMAGE_CHAIN;
        }

        const maxKeyAttempts = 1; 
        let lastError;
        const totalModels = modelCandidates.length;
        let modelAttemptCount = 0;

        for (const currentModel of modelCandidates) {
            modelAttemptCount++;
            
            if (modelAttemptCount > 1) {
                console.log(`\x1b[36m[ AI MANAGER ]\x1b[0m Trying fallback image model '${currentModel}' (${modelAttemptCount}/${totalModels})...`);
            }
            
            for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
                let selectedKey;
                try {
                    selectedKey = await this.getHealthyKey(serverId, currentModel);
                    this.trackRateLimit(serverId, selectedKey.keyId, currentModel, 5000); 
                } catch (keyErr) {
                    lastError = keyErr;
                    console.warn(`\x1b[33m[ AI MANAGER ]\x1b[0m No available keys for image model '${currentModel}': ${keyErr.message}`);
                    break; 
                }

                const config = {
                    responseModalities: ['TEXT', 'IMAGE'],
                };
                if (options.aspectRatio || options.imageSize) {
                    config.imageConfig = {};
                    if (options.aspectRatio) config.imageConfig.aspectRatio = options.aspectRatio;
                    if (options.imageSize) config.imageConfig.imageSize = options.imageSize;
                }
                if (options.useSearch) {
                    config.tools = [{ googleSearch: {} }];
                }

                const startTime = Date.now();
                try {
                    let imageBuffer = null;
                    let textResponse = "";

                    if (currentModel.startsWith('imagen-')) {
                        const response = await Promise.race([
                            selectedKey.genAI.models.generateImages({
                                model: currentModel,
                                prompt: prompt,
                                config: {
                                    numberOfImages: 1,
                                    outputMimeType: 'image/jpeg',
                                    ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {})
                                }
                            }),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Timeout')), options.timeout || 60000)
                            )
                        ]);

                        if (response.generatedImages?.[0]?.image?.imageBytes) {
                            imageBuffer = Buffer.from(response.generatedImages[0].image.imageBytes, "base64");
                        }
                    } else {
                        const response = await Promise.race([
                            selectedKey.genAI.models.generateContent({
                                model: currentModel,
                                contents: prompt,
                                config
                            }),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Timeout')), options.timeout || 60000)
                            )
                        ]);

                        for (const part of response.candidates?.[0]?.content?.parts || []) {
                            if (part.thought) continue;

                            if (part.text) {
                                textResponse += part.text;
                            } else if (part.inlineData) {
                                const imageData = part.inlineData.data;
                                imageBuffer = Buffer.from(imageData, "base64");
                            }
                        }
                    }

                    if (!imageBuffer) {
                        throw new Error(`Model '${currentModel}' did not produce a valid image output.`);
                    }

                    const responseTime = Date.now() - startTime;
                    await this.updateKeyStats(serverId, selectedKey.keyId, true, responseTime);
                    console.log(`\x1b[36m[ AI MANAGER ]\x1b[0m Image generated using model \x1b[33m${currentModel}\x1b[0m for server ${serverId} (${responseTime}ms)`);

                    return {
                        imageBuffer,
                        textResponse: textResponse.trim(),
                        modelUsed: currentModel,
                        success: true
                    };

                } catch (error) {
                    lastError = error;

                    if (error.message.includes('safety') || error.message.includes('blocked')) {
                        throw new AIContentBlockedError('Image prompt blocked by AI safety filters');
                    }

                    const isTimeout = error.message.includes('Timeout');
                    if (!isTimeout) {
                        await this.updateKeyStats(serverId, selectedKey.keyId, false, 0, error.message);
                    }
                    
                    console.warn(`\x1b[33m[ AI MANAGER ]\x1b[0m Image model '${currentModel}' failed: ${error.message} - trying next model...`);
                    break; 
                }
            }
        }

        throw new Error(
            `All ${totalModels} image generation models exhausted. ` +
            `This could mean:\n` +
            `1. API is experiencing high demand\n` +
            `2. Your API key might be on free tier with strict limits\n` +
            `3. Check usage at https://aistudio.google.com/apikey\n` +
            `Last error: ${lastError?.message}`
        );
    }

    async analyzeImage(serverId, imageUrl, focus = 'general') {
        const focusPrompts = {
            general: "Look at this image and describe what you see in detail.",
            objects: "Look at this image and identify all objects, people, and things you can see.",
            ocr: "Look at this image and extract any text you can see. If no text, describe the image.",
            emotions: "Look at this image and describe the emotions, mood, and feelings it conveys.",
            artistic: "Look at this image and analyze the colors, style, composition, and artistic elements."
        };

        try {
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            const base64Image = imageBuffer.toString('base64');
            const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';

            const contents = [
                {
                    role: "user",
                    parts: [
                        { text: focusPrompts[focus] || focusPrompts.general },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Image
                            }
                        }
                    ]
                }
            ];

            const result = await this.generateContent(serverId, contents, {
                timeout: 30000,
                thinkingLevel: 'low'
            });

            return {
                analysis: result.text(),
                focus: focus,
                modelUsed: result.modelUsed
            };

        } catch (error) {
            console.error('Image analysis error:', error);
            throw error;
        }
    }

    async generateStory(serverId, prompt, genre = 'adventure', length = 'medium') {
        const genreStyles = {
            horror: "Write a spine-chilling horror story with suspense and dark atmosphere.",
            romantic: "Write a heartwarming romance story with emotional depth.",
            adventure: "Write an exciting adventure story with action and exploration.",
            anime: "Write a story in anime/manga style with dramatic moments.",
            kids: "Write a fun, family-friendly story appropriate for children.",
            scifi: "Write a science fiction story with futuristic technology.",
            fantasy: "Write a fantasy story with magic and mythical creatures.",
            mystery: "Write a mystery story with clues and investigation."
        };

        const lengthGuides = {
            short: "Keep it brief, around 2-3 paragraphs.",
            medium: "Write a moderate length story, around 4-6 paragraphs.",
            long: "Write a detailed, full story with multiple scenes."
        };

        const storyPrompt = `${genreStyles[genre]} 
Theme/Prompt: ${prompt}
${lengthGuides[length]}
Make it engaging and creative.`;

        const response = await this.generateContent(serverId, storyPrompt, {
            timeout: 45000,
            thinkingLevel: 'high'
        });

        return {
            story: response.text(),
            genre,
            length,
            modelUsed: response.modelUsed
        };
    }

    async summarizeText(serverId, text, style = 'brief') {
        const stylePrompts = {
            brief: "Provide a brief, concise summary of the main points:",
            points: "Extract and list the key points as bullet points:",
            detailed: "Provide a comprehensive analysis and detailed summary:",
            eli5: "Explain this in simple terms that a 5-year-old could understand:"
        };

        const prompt = `${stylePrompts[style]}\n\n${text}`;
        const response = await this.generateContent(serverId, prompt, {
            timeout: 30000,
            thinkingLevel: 'low'
        });

        return {
            summary: response.text(),
            style,
            originalLength: text.length,
            modelUsed: response.modelUsed
        };
    }

    async helpWithCode(serverId, request, language = 'general') {
        const languageContext = language !== 'general' ? `Focus on ${language} programming language. ` : '';

        const prompt = `${languageContext}Help with this coding request: ${request}

Please provide:
1. Clear explanation
2. Code examples if applicable
3. Best practices
4. Any important notes or warnings`;

        const response = await this.generateContent(serverId, prompt, {
            timeout: 30000,
            thinkingLevel: 'high'
        });

        return {
            response: response.text(),
            language,
            request,
            modelUsed: response.modelUsed
        };
    }

    async analyzeSpam(serverId, message, context = {}) {
        const prompt = this.buildSpamPrompt(message, context);

        try {
            const response = await this.generateContent(serverId, prompt, {
                timeout: 15000,
                thinkingLevel: 'low'
            });
            const result = this.parseAIResponse(response.text());

            return {
                isSpam: result.isSpam || false,
                confidence: Math.max(0, Math.min(1, result.confidence || 0)),
                severity: result.severity || 'low',
                reasoning: result.reasoning || 'AI analysis completed',
                categories: result.categories || [],
                success: true,
                modelUsed: response.modelUsed
            };

        } catch (error) {
            if (error instanceof AIContentBlockedError) {
                return {
                    isSpam: true,
                    confidence: 0.9,
                    severity: 'high',
                    reasoning: 'Content flagged by AI safety filters',
                    categories: ['inappropriate_content'],
                    success: true
                };
            }

            return {
                isSpam: false,
                confidence: 0,
                severity: 'low',
                reasoning: 'AI analysis unavailable',
                categories: [],
                success: false
            };
        }
    }

    async analyzeLink(serverId, url, context = {}) {
        const prompt = this.buildLinkPrompt(url, context);

        try {
            const response = await this.generateContent(serverId, prompt, {
                timeout: 10000,
                thinkingLevel: 'low'
            });
            const result = this.parseAIResponse(response.text());

            return {
                isMalicious: result.isMalicious || false,
                confidence: Math.max(0, Math.min(1, result.confidence || 0)),
                riskLevel: result.riskLevel || 'low',
                reasoning: result.reasoning || 'Link analysis completed',
                categories: result.categories || [],
                success: true,
                modelUsed: response.modelUsed
            };

        } catch (error) {
            return {
                isMalicious: false,
                confidence: 0,
                riskLevel: 'unknown',
                reasoning: 'AI analysis unavailable',
                categories: [],
                success: false
            };
        }
    }

    buildSpamPrompt(message, context) {
        return `
Analyze this Discord message for spam/malicious content:

Message: "${message.content}"
Author: ${message.author?.tag || 'Unknown'}
Channel: ${message.channel?.name || 'Unknown'}
Server: ${context.guildName || 'Unknown'}

Consider: spam patterns, malicious intent, harassment, promotional spam.

Respond ONLY in valid JSON format:
{
    "isSpam": boolean,
    "confidence": number (0-1),
    "severity": "low|medium|high|critical",
    "reasoning": "brief explanation under 100 chars",
    "categories": ["array", "of", "violation", "types"]
}`;
    }

    buildLinkPrompt(url, context) {
        return `
Analyze this URL for potential threats:

URL: ${url}
Context: Posted in Discord server "${context.guildName || 'Unknown'}"

Check for: phishing, malware, scams, suspicious domains.

Respond ONLY in valid JSON format:
{
    "isMalicious": boolean,
    "confidence": number (0-1),
    "riskLevel": "low|medium|high|critical",
    "reasoning": "brief explanation under 100 chars",
    "categories": ["array", "of", "threat", "types"]
}`;
    }

    parseAIResponse(text) {
        try {
            let cleanText = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleanText.match(/{[\s\S]*}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('No JSON found');
        } catch {
            return {
                isSpam: false,
                isMalicious: false,
                confidence: 0,
                severity: 'low',
                riskLevel: 'low',
                reasoning: 'Failed to parse AI response',
                categories: []
            };
        }
    }

    async getStats(serverId) {
        if (!serverId) {
            const keys = await GeminiApiKey.find();
            const totalRequests = keys.reduce((sum, key) => sum + key.totalRequests, 0);
            const totalSuccessful = keys.reduce((sum, key) => sum + key.successfulRequests, 0);
            const activeKeys = keys.filter(k => k.isActive && !k.isBlocked).length;

            return {
                totalKeys: keys.length,
                activeKeys,
                totalRequests,
                successRate: totalRequests > 0 ? ((totalSuccessful / totalRequests) * 100).toFixed(1) + '%' : '0%',
                availableModels: this.getAvailableModels()
            };
        }

        const keys = await GeminiApiKey.find({ serverId });
        const totalRequests = keys.reduce((sum, key) => sum + key.totalRequests, 0);
        const totalSuccessful = keys.reduce((sum, key) => sum + key.successfulRequests, 0);
        const activeKeys = keys.filter(k => k.isActive && !k.isBlocked).length;

        return {
            serverId,
            totalKeys: keys.length,
            activeKeys,
            cachedKeys: this.serverKeyCache.get(serverId)?.keys?.size || 0,
            totalRequests,
            successRate: totalRequests > 0 ? ((totalSuccessful / totalRequests) * 100).toFixed(1) + '%' : '0%',
            availableModels: this.getAvailableModels()
        };
    }

    getAvailableModels() {
        return {
            flashLite: MODELS.FLASH_LITE_CHAIN,
            flash: MODELS.FLASH_CHAIN,
            pro: MODELS.PRO_CHAIN,
            other: MODELS.OTHER_CHAIN,
            image: MODELS.IMAGE_CHAIN,
            total: [
                ...MODELS.FLASH_LITE_CHAIN,
                ...MODELS.FLASH_CHAIN,
                ...MODELS.PRO_CHAIN,
                ...MODELS.OTHER_CHAIN,
                ...MODELS.IMAGE_CHAIN
            ].filter((v, i, a) => a.indexOf(v) === i).length
        };
    }

    getRateLimitInfo(model) {
        return RATE_LIMITS[model] || { rpm: 5, tpm: 250000, rpd: 20 };
    }

    cleanup() {
        const now = Date.now();

        for (const [rateKey, rateLimit] of this.rateLimits.entries()) {
            rateLimit.requests = rateLimit.requests.filter(time => now - time < 60000);
            rateLimit.tokens = rateLimit.tokens.filter(entry => now - entry.time < 60000);
            rateLimit.dailyRequests = rateLimit.dailyRequests.filter(time => now - time < 86400000);
            
            if (rateLimit.requests.length === 0 && 
                rateLimit.tokens.length === 0 && 
                rateLimit.dailyRequests.length === 0) {
                this.rateLimits.delete(rateKey);
            }
        }

        for (const [serverId, cache] of this.serverKeyCache.entries()) {
            if (now - cache.lastUpdate > 5 * 60 * 1000) {
                this.serverKeyCache.delete(serverId);
            }
        }
    }
}

class AIContentBlockedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AIContentBlockedError';
    }
}

const aiManager = new AIManager();

module.exports = aiManager;
module.exports.AIContentBlockedError = AIContentBlockedError;
module.exports.MODELS = MODELS;
module.exports.RATE_LIMITS = RATE_LIMITS;
