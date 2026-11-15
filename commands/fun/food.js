

const { SlashCommandBuilder } = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');
const aiManager = require('../../utils/AIManager');
const { sendV2AIResponse } = require('../../utils/v2ContainerHelper');

const cache = new Map();
const CACHE_TTL = 600000;

function getCache(key) {
    const item = cache.get(key);
    if (!item || Date.now() - item.time > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    cache.set(key, { data, time: Date.now() });
}

function sendError(sendReply, text) {
    return sendReply(cards.error(
        lang.fun.food.errorTitle.replace('{emoji}', getEmoji('cross')),
        text
    ));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('food')
        .setDescription('AI Food Assistant - Complete Cooking & Nutrition Helper')
        .addSubcommand(sub => sub
            .setName('recipe')
            .setDescription('Get any recipe from AI')
            .addStringOption(opt => opt.setName('dish').setDescription('What dish do you want to cook?').setRequired(true))
            .addStringOption(opt => opt.setName('difficulty').setDescription('Cooking level').addChoices(
                { name: 'Easy', value: 'easy' },
                { name: 'Medium', value: 'medium' },
                { name: 'Hard', value: 'hard' }
            )))
        .addSubcommand(sub => sub
            .setName('nutrition')
            .setDescription('Get nutrition facts for any food')
            .addStringOption(opt => opt.setName('food').setDescription('Food item or meal').setRequired(true))
            .addIntegerOption(opt => opt.setName('amount').setDescription('Amount in grams (default: 100g)').setMinValue(1)))
        .addSubcommand(sub => sub
            .setName('substitute')
            .setDescription('Find ingredient substitutes')
            .addStringOption(opt => opt.setName('ingredient').setDescription('Ingredient to substitute').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Why substitute?').addChoices(
                { name: 'Allergic', value: 'allergy' },
                { name: 'Dont have it', value: 'missing' },
                { name: 'Healthier option', value: 'health' },
                { name: 'Diet restriction', value: 'diet' }
            )))
        .addSubcommand(sub => sub
            .setName('chef')
            .setDescription('Ask AI chef any cooking question')
            .addStringOption(opt => opt.setName('question').setDescription('Your cooking question').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('mealplan')
            .setDescription('Generate meal plan')
            .addStringOption(opt => opt.setName('goal').setDescription('Your goal').setRequired(true).addChoices(
                { name: 'Weight Loss', value: 'weightloss' },
                { name: 'Muscle Gain', value: 'muscle' },
                { name: 'Healthy Eating', value: 'healthy' },
                { name: 'Quick Meals', value: 'quick' }
            ))
            .addIntegerOption(opt => opt.setName('days').setDescription('How many days?').setMinValue(1).setMaxValue(7)))
        .addSubcommand(sub => sub
            .setName('calories')
            .setDescription('Calculate calories for a meal')
            .addStringOption(opt => opt.setName('meal').setDescription('Describe your meal').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('ingredients')
            .setDescription('Learn about any ingredient')
            .addStringOption(opt => opt.setName('ingredient').setDescription('Ingredient to learn about').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('diet')
            .setDescription('Diet-specific meal suggestions')
            .addStringOption(opt => opt.setName('type').setDescription('Diet type').setRequired(true).addChoices(
                { name: 'Keto', value: 'keto' },
                { name: 'Vegan', value: 'vegan' },
                { name: 'Vegetarian', value: 'vegetarian' },
                { name: 'Mediterranean', value: 'mediterranean' },
                { name: 'Low Carb', value: 'lowcarb' },
                { name: 'High Protein', value: 'highprotein' }
            ))
            .addStringOption(opt => opt.setName('meal').setDescription('Meal type').addChoices(
                { name: 'Breakfast', value: 'breakfast' },
                { name: 'Lunch', value: 'lunch' },
                { name: 'Dinner', value: 'dinner' },
                { name: 'Snack', value: 'snack' }
            )))
        .addSubcommand(sub => sub
            .setName('pairing')
            .setDescription('Find what pairs with your food')
            .addStringOption(opt => opt.setName('food').setDescription('Food to pair').setRequired(true))
            .addStringOption(opt => opt.setName('type').setDescription('Pairing type').addChoices(
                { name: 'Food Combinations', value: 'food' },
                { name: 'Wine Pairing', value: 'wine' },
                { name: 'Drink Pairing', value: 'drink' }
            )))
        .addSubcommand(sub => sub
            .setName('seasonal')
            .setDescription('Seasonal food recommendations')
            .addStringOption(opt => opt.setName('season').setDescription('Season').setRequired(true).addChoices(
                { name: 'Spring', value: 'spring' },
                { name: 'Summer', value: 'summer' },
                { name: 'Fall', value: 'fall' },
                { name: 'Winter', value: 'winter' }
            ))
            .addStringOption(opt => opt.setName('category').setDescription('Food category').addChoices(
                { name: 'Fruits', value: 'fruits' },
                { name: 'Vegetables', value: 'vegetables' },
                { name: 'Recipes', value: 'recipes' }
            )))
        .addSubcommand(sub => sub
            .setName('cuisine')
            .setDescription('Explore world cuisines')
            .addStringOption(opt => opt.setName('country').setDescription('Country/region cuisine').setRequired(true))
            .addStringOption(opt => opt.setName('dish_type').setDescription('Dish type').addChoices(
                { name: 'Appetizer', value: 'appetizer' },
                { name: 'Main Course', value: 'main' },
                { name: 'Dessert', value: 'dessert' },
                { name: 'Street Food', value: 'street' }
            )))
        .addSubcommand(sub => sub
            .setName('cooking-tips')
            .setDescription('Cooking techniques and tips')
            .addStringOption(opt => opt.setName('technique').setDescription('Technique or cooking problem').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('safety')
            .setDescription('Food safety information')
            .addStringOption(opt => opt.setName('topic').setDescription('Safety topic').setRequired(true).addChoices(
                { name: 'Storage Tips', value: 'storage' },
                { name: 'Expiration Guide', value: 'expiration' },
                { name: 'Temperature Guide', value: 'temperature' },
                { name: 'Food Poisoning Prevention', value: 'prevention' }
            ))
            .addStringOption(opt => opt.setName('food').setDescription('Specific food (optional)')))
        .addSubcommand(sub => sub
            .setName('grocery')
            .setDescription('Smart grocery shopping help')
            .addStringOption(opt => opt.setName('task').setDescription('Grocery task').setRequired(true).addChoices(
                { name: 'Shopping List', value: 'list' },
                { name: 'Budget Planning', value: 'budget' },
                { name: 'Seasonal Guide', value: 'seasonal' },
                { name: 'Bulk Buying', value: 'bulk' }
            ))
            .addStringOption(opt => opt.setName('details').setDescription('Additional details'))
            .addIntegerOption(opt => opt.setName('budget').setDescription('Weekly budget')))
        .addSubcommand(sub => sub
            .setName('leftover')
            .setDescription('Creative leftover ideas')
            .addStringOption(opt => opt.setName('food').setDescription('Leftover food').setRequired(true))
            .addIntegerOption(opt => opt.setName('people').setDescription('People to feed').setMinValue(1)))
        .addSubcommand(sub => sub
            .setName('compare')
            .setDescription('Compare nutrition of foods')
            .addStringOption(opt => opt.setName('food1').setDescription('First food').setRequired(true))
            .addStringOption(opt => opt.setName('food2').setDescription('Second food').setRequired(true))
            .addStringOption(opt => opt.setName('food3').setDescription('Third food (optional)')))
        .addSubcommand(sub => sub
            .setName('meal-prep')
            .setDescription('Meal prep strategies')
            .addStringOption(opt => opt.setName('goal').setDescription('Prep goal').setRequired(true).addChoices(
                { name: 'Save Time', value: 'time' },
                { name: 'Save Money', value: 'money' },
                { name: 'Healthy Eating', value: 'health' },
                { name: 'Weight Goals', value: 'weight' }
            ))
            .addIntegerOption(opt => opt.setName('days').setDescription('Days to prep').setMinValue(1).setMaxValue(7)))
        .addSubcommand(sub => sub
            .setName('quick')
            .setDescription('Quick meal ideas')
            .addIntegerOption(opt => opt.setName('minutes').setDescription('Max cooking time').setRequired(true).setMinValue(5).setMaxValue(60))
            .addStringOption(opt => opt.setName('meal_type').setDescription('Meal type').addChoices(
                { name: 'Breakfast', value: 'breakfast' },
                { name: 'Lunch', value: 'lunch' },
                { name: 'Dinner', value: 'dinner' },
                { name: 'Snack', value: 'snack' }
            )))
        .addSubcommand(sub => sub
            .setName('allergy')
            .setDescription('Allergy-friendly recipes')
            .addStringOption(opt => opt.setName('allergens').setDescription('Allergens to avoid (comma separated)').setRequired(true))
            .addStringOption(opt => opt.setName('meal_type').setDescription('Meal type').addChoices(
                { name: 'Breakfast', value: 'breakfast' },
                { name: 'Lunch', value: 'lunch' },
                { name: 'Dinner', value: 'dinner' },
                { name: 'Snack', value: 'snack' },
                { name: 'Dessert', value: 'dessert' }
            ))),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Food] Defer failed:', err.message);
                return;
            }
        }

        
        const guildId = interaction.guild?.id;
        let prefix = '!';
        if (guildId) {
            try {
                const { getServerConfig } = require('../../utils/cacheHelpers');
                const serverConfig = await getServerConfig(guildId);
                if (serverConfig?.prefix) {
                    prefix = serverConfig.prefix;
                }
            } catch (_) { }
        }
        interaction.guildPrefix = prefix;

        const VALID_SUBS = new Set([
            'recipe', 'nutrition', 'substitute', 'chef', 'mealplan',
            'calories', 'ingredients', 'diet', 'pairing', 'seasonal',
            'cuisine', 'cooking-tips', 'safety', 'grocery', 'leftover',
            'compare', 'meal-prep', 'quick', 'allergy'
        ]);

        let subcommand = 'chef';
        let optionsMock = {};

        if (isSlash) {
            subcommand = interaction.options.getSubcommand();
        } else {
            const rawSub = args?.[0]?.toLowerCase();
            if (rawSub && VALID_SUBS.has(rawSub)) {
                subcommand = rawSub;
                const remainingArgs = args.slice(1);
                const queryStr = remainingArgs.join(' ');

                if (subcommand === 'recipe') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.dish = parts[0].trim();
                        optionsMock.difficulty = parts[1].trim().toLowerCase();
                    } else {
                        optionsMock.dish = queryStr.trim();
                        optionsMock.difficulty = 'medium';
                    }
                } else if (subcommand === 'nutrition') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.food = parts[0].trim();
                        optionsMock.amount = parseInt(parts[1].trim(), 10) || 100;
                    } else {
                        optionsMock.food = queryStr.trim();
                        optionsMock.amount = 100;
                    }
                } else if (subcommand === 'substitute') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.ingredient = parts[0].trim();
                        optionsMock.reason = parts[1].trim().toLowerCase();
                    } else {
                        optionsMock.ingredient = queryStr.trim();
                        optionsMock.reason = 'missing';
                    }
                } else if (subcommand === 'chef') {
                    optionsMock.question = queryStr.trim();
                } else if (subcommand === 'mealplan') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.goal = parts[0].trim().toLowerCase();
                        optionsMock.days = parseInt(parts[1].trim(), 10) || 3;
                    } else {
                        optionsMock.goal = queryStr.trim().toLowerCase() || 'healthy';
                        optionsMock.days = 3;
                    }
                } else if (subcommand === 'calories') {
                    optionsMock.meal = queryStr.trim();
                } else if (subcommand === 'ingredients') {
                    optionsMock.ingredient = queryStr.trim();
                } else if (subcommand === 'diet') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.type = parts[0].trim().toLowerCase();
                        optionsMock.meal = parts[1].trim().toLowerCase();
                    } else {
                        optionsMock.type = queryStr.trim().toLowerCase() || 'keto';
                        optionsMock.meal = 'any';
                    }
                } else if (subcommand === 'pairing') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.food = parts[0].trim();
                        optionsMock.type = parts[1].trim().toLowerCase();
                    } else {
                        optionsMock.food = queryStr.trim();
                        optionsMock.type = 'food';
                    }
                } else if (subcommand === 'seasonal') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.season = parts[0].trim().toLowerCase();
                        optionsMock.category = parts[1].trim().toLowerCase();
                    } else {
                        optionsMock.season = queryStr.trim().toLowerCase() || 'summer';
                        optionsMock.category = 'recipes';
                    }
                } else if (subcommand === 'cuisine') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.country = parts[0].trim();
                        optionsMock.dish_type = parts[1].trim().toLowerCase();
                    } else {
                        optionsMock.country = queryStr.trim();
                        optionsMock.dish_type = 'main';
                    }
                } else if (subcommand === 'cooking-tips') {
                    optionsMock.technique = queryStr.trim();
                } else if (subcommand === 'safety') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.topic = parts[0].trim().toLowerCase();
                        optionsMock.food = parts[1].trim();
                    } else {
                        optionsMock.topic = queryStr.trim().toLowerCase() || 'storage';
                        optionsMock.food = null;
                    }
                } else if (subcommand === 'grocery') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.task = parts[0].trim().toLowerCase();
                        optionsMock.details = parts[1]?.trim() || null;
                        optionsMock.budget = parseInt(parts[2]?.trim(), 10) || null;
                    } else {
                        optionsMock.task = queryStr.trim().toLowerCase() || 'list';
                        optionsMock.details = null;
                        optionsMock.budget = null;
                    }
                } else if (subcommand === 'leftover') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.food = parts[0].trim();
                        optionsMock.people = parseInt(parts[1].trim(), 10) || 2;
                    } else {
                        optionsMock.food = queryStr.trim();
                        optionsMock.people = 2;
                    }
                } else if (subcommand === 'compare') {
                    const parts = queryStr.split(',').map(p => p.trim());
                    optionsMock.food1 = parts[0] || null;
                    optionsMock.food2 = parts[1] || null;
                    optionsMock.food3 = parts[2] || null;
                } else if (subcommand === 'meal-prep') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.goal = parts[0].trim().toLowerCase();
                        optionsMock.days = parseInt(parts[1].trim(), 10) || 5;
                    } else {
                        optionsMock.goal = queryStr.trim().toLowerCase() || 'time';
                        optionsMock.days = 5;
                    }
                } else if (subcommand === 'quick') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.minutes = parseInt(parts[0].trim(), 10) || 15;
                        optionsMock.meal_type = parts[1].trim().toLowerCase();
                    } else {
                        optionsMock.minutes = parseInt(queryStr.trim(), 10) || 15;
                        optionsMock.meal_type = 'any';
                    }
                } else if (subcommand === 'allergy') {
                    if (queryStr.includes(',')) {
                        const parts = queryStr.split(',');
                        optionsMock.allergens = parts[0].trim();
                        optionsMock.meal_type = parts[1].trim().toLowerCase();
                    } else {
                        optionsMock.allergens = queryStr.trim();
                        optionsMock.meal_type = 'any';
                    }
                }
            } else if (args && args.length > 0) {
                const fullText = args.join(' ');
                if (fullText.endsWith('?')) {
                    subcommand = 'chef';
                    optionsMock.question = fullText;
                } else {
                    subcommand = 'recipe';
                    optionsMock.dish = fullText;
                    optionsMock.difficulty = 'medium';
                }
            } else {
                subcommand = 'chef';
                optionsMock.question = 'What is a quick and healthy breakfast option?';
            }
        }

        if (!isSlash) {
            interaction.options = {
                getSubcommand: () => subcommand,
                getString: (name) => optionsMock[name] || null,
                getInteger: (name) => optionsMock[name] !== undefined ? optionsMock[name] : null,
                getBoolean: (name) => null,
                getUser: (name) => null
            };
        }

        const sendReply = async (payload) => {
            if (payload && payload.title && payload.text) {
                return await sendV2AIResponse(interaction, payload);
            }
            return await sendV2(interaction, payload);
        };

        try {
            switch (subcommand) {
                case 'recipe':
                    await this.handleRecipe(interaction, sendReply);
                    break;
                case 'nutrition':
                    await this.handleNutrition(interaction, sendReply);
                    break;
                case 'substitute':
                    await this.handleSubstitute(interaction, sendReply);
                    break;
                case 'chef':
                    await this.handleChef(interaction, sendReply);
                    break;
                case 'mealplan':
                    await this.handleMealPlan(interaction, sendReply);
                    break;
                case 'calories':
                    await this.handleCalories(interaction, sendReply);
                    break;
                case 'ingredients':
                    await this.handleIngredients(interaction, sendReply);
                    break;
                case 'diet':
                    await this.handleDiet(interaction, sendReply);
                    break;
                case 'pairing':
                    await this.handlePairing(interaction, sendReply);
                    break;
                case 'seasonal':
                    await this.handleSeasonal(interaction, sendReply);
                    break;
                case 'cuisine':
                    await this.handleCuisine(interaction, sendReply);
                    break;
                case 'cooking-tips':
                    await this.handleCookingTips(interaction, sendReply);
                    break;
                case 'safety':
                    await this.handleSafety(interaction, sendReply);
                    break;
                case 'grocery':
                    await this.handleGrocery(interaction, sendReply);
                    break;
                case 'leftover':
                    await this.handleLeftover(interaction, sendReply);
                    break;
                case 'compare':
                    await this.handleCompare(interaction, sendReply);
                    break;
                case 'meal-prep':
                    await this.handleMealPrep(interaction, sendReply);
                    break;
                case 'quick':
                    await this.handleQuick(interaction, sendReply);
                    break;
                case 'allergy':
                    await this.handleAllergy(interaction, sendReply);
                    break;
                default:
                    await sendError(sendReply, lang.fun.food.unknownSubcommand);
                    break;
            }
        } catch (error) {
            console.error('Food command error:', error);
            await sendError(sendReply, lang.fun.food.aiUnavailable).catch(() => { });
        }
    },


    async handleRecipe(interaction, sendReply) {
        const dish = interaction.options.getString('dish');
        const difficulty = interaction.options.getString('difficulty') || 'medium';

        const cacheKey = `recipe_${dish}_${difficulty}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Give me a ${difficulty} recipe for ${dish}. Format your response exactly like this:

**${dish.toUpperCase()} RECIPE**

 **Prep Time:** [time]
 **Serves:** [number]
⭐ **Difficulty:** ${difficulty.toUpperCase()}

 **INGREDIENTS:**
- [ingredient 1]
- [ingredient 2]
[continue list]

 **INSTRUCTIONS:**
1. [step 1]
2. [step 2]
[continue steps]

 **CHEF TIPS:**
[2-3 helpful cooking tips]

Keep it practical and easy to follow. No fluff, just the recipe.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 30000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.recipeTitle.replace('{emoji}', getEmoji('document')).replace('{dish}', dish.charAt(0).toUpperCase() + dish.slice(1)),
                headerEmoji: 'document',
                accentColor: 0x2ecc71,
                text: result
            };
            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Recipe AI error:', error);
            await sendError(sendReply, lang.fun.food.recipeNotFound.replace('{dish}', dish));
        }
    },

    async handleNutrition(interaction, sendReply) {
        const food = interaction.options.getString('food');
        const amount = interaction.options.getInteger('amount') || 100;

        const cacheKey = `nutrition_${food}_${amount}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Provide nutrition facts for ${amount}g of ${food}. Format exactly like this:

**${food.toUpperCase()} - ${amount}g**

 **CALORIES & MACROS:**
 Calories: [number] kcal
 Carbs: [number]g
 Protein: [number]g  
 Fat: [number]g
 Fiber: [number]g
 Sugar: [number]g

 **KEY VITAMINS & MINERALS:**
[List top 4-5 vitamins/minerals with amounts]

 **HEALTH BENEFITS:**
• [benefit 1]
• [benefit 2]
• [benefit 3]

Just give accurate nutrition data, no extra text.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.nutritionTitle.replace('{emoji}', getEmoji('heart')).replace('{food}', food.charAt(0).toUpperCase() + food.slice(1)).replace('{amount}', amount),
                headerEmoji: 'heart',
                accentColor: 0x3498db,
                text: result
            };
            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Nutrition AI error:', error);
            await sendError(sendReply, lang.fun.food.nutritionNotFound.replace('{food}', food));
        }
    },

    async handleSubstitute(interaction, sendReply) {
        const ingredient = interaction.options.getString('ingredient');
        const reason = interaction.options.getString('reason') || 'missing';

        const reasonText = {
            'allergy': 'due to allergies',
            'missing': 'because I dont have it',
            'health': 'for a healthier option',
            'diet': 'due to dietary restrictions'
        };

        const cacheKey = `substitute_${ingredient}_${reason}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `I need substitutes for ${ingredient} ${reasonText[reason]}. Format like this:

** SUBSTITUTES FOR ${ingredient.toUpperCase()}**

** BEST ALTERNATIVES:**
1. **[substitute 1]** - [ratio] - [why it works]
2. **[substitute 2]** - [ratio] - [why it works]
3. **[substitute 3]** - [ratio] - [why it works]

**️ COOKING NOTES:**
• [important tip 1]
• [important tip 2]

** QUICK TIPS:**
[1-2 helpful substitution tips]

Give practical substitutes that actually work in recipes.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 20000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.substituteTitle.replace('{emoji}', getEmoji('loop')).replace('{ingredient}', ingredient.charAt(0).toUpperCase() + ingredient.slice(1)),
                headerEmoji: 'loop',
                accentColor: 0xf39c12,
                text: result
            };
            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Substitute AI error:', error);
            await sendError(sendReply, lang.fun.food.substituteNotFound.replace('{ingredient}', ingredient));
        }
    },

    async handleChef(interaction, sendReply) {
        const question = interaction.options.getString('question');

        const prompt = `You are a professional chef AI. Answer this cooking question: "${question}"

Be helpful, practical, and give actionable advice. If it's about:
- Techniques: Explain step by step
- Problems: Give solutions
- Ingredients: Explain uses and tips
- Equipment: Suggest alternatives
- Recipes: Provide quick guidance

Keep it conversational but informative. Use emojis to make it engaging.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            await sendReply({
                title: lang.fun.food.chefTitle.replace('{emoji}', getEmoji('smile') || '‍'),
                subtitle: `Question: ${question}`,
                headerEmoji: 'settings',
                accentColor: 0xe74c3c,
                text: result
            });

        } catch (error) {
            console.error('Chef AI error:', error);
            await sendError(sendReply, lang.fun.food.chefBusy);
        }
    },

    async handleMealPlan(interaction, sendReply) {
        const goal = interaction.options.getString('goal');
        const days = interaction.options.getInteger('days') || 3;

        const goalText = {
            'weightloss': 'weight loss (calorie deficit)',
            'muscle': 'muscle gain (high protein)',
            'healthy': 'general health (balanced)',
            'quick': 'quick & easy meals'
        };

        const cacheKey = `mealplan_${goal}_${days}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Create a ${days}-day meal plan for ${goalText[goal]}. Format like this:

**️ ${days}-DAY MEAL PLAN - ${goal.toUpperCase()}**

${Array.from({ length: days }, (_, i) => `
**DAY ${i + 1}:**
 **Breakfast:** [meal]
 **Lunch:** [meal]  
 **Dinner:** [meal]
 **Snack:** [healthy snack]
`
        ).join('\n\n')}

** GROCERY LIST:**
[List key ingredients needed]

** MEAL PREP TIPS:**
• [tip 1]
• [tip 2]

Make meals practical and achievable. Include variety and nutrition.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 35000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.mealplanTitle.replace('{emoji}', getEmoji('calendar')).replace('{days}', days) + ` (${goalText[goal]})`,
                headerEmoji: 'calendar',
                accentColor: 0x9b59b6,
                text: result
            };
            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Meal plan AI error:', error);
            await sendError(sendReply, lang.fun.food.mealplanError);
        }
    },

    async handleCalories(interaction, sendReply) {
        const meal = interaction.options.getString('meal');
        if (!meal) {
            return await sendError(sendReply, lang.fun.food.caloriesError);
        }

        const prompt = `Calculate calories for this meal: "${meal}"

Break down the meal and estimate calories. Format like this:

** CALORIE BREAKDOWN - ${meal.toUpperCase()}**

** MEAL COMPONENTS:**
• [ingredient/item 1]: ~[calories] kcal
• [ingredient/item 2]: ~[calories] kcal
• [ingredient/item 3]: ~[calories] kcal
[continue for all components]

** TOTAL ESTIMATED CALORIES: ~[total] kcal**

** MACRO SPLIT:**
 Carbs: ~[number]g ([percent]%)
 Protein: ~[number]g ([percent]%)
 Fat: ~[number]g ([percent]%)

** NOTES:**
[Any important notes about the meal]

Be realistic with portions and give accurate estimates.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            await sendReply({
                title: lang.fun.food.caloriesTitle.replace('{emoji}', getEmoji('fire')) + `: ${meal.charAt(0).toUpperCase() + meal.slice(1)}`,
                headerEmoji: 'fire',
                accentColor: 0x1abc9c,
                text: result
            });

        } catch (error) {
            console.error('Calories AI error:', error);
            await sendError(sendReply, lang.fun.food.caloriesError);
        }
    },

    async handleIngredients(interaction, sendReply) {
        const ingredient = interaction.options.getString('ingredient');
        if (!ingredient) {
            return await sendError(sendReply, lang.fun.food.ingredientsNotFound.replace('{ingredient}', ''));
        }

        const cacheKey = `ingredient_${ingredient}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Tell me everything about ${ingredient} as an ingredient. Format like this:

** ${ingredient.toUpperCase()} - INGREDIENT GUIDE**

** NUTRITION HIGHLIGHTS:**
[Key nutritional benefits]

** COOKING USES:**
• [use 1]: [how to use]
• [use 2]: [how to use]
• [use 3]: [how to use]

** BUYING & STORAGE:**
• **Selection:** [how to choose quality]
• **Storage:** [how to store and for how long]

** PAIRS WELL WITH:**
[List 4-5 foods that pair well]

** COOKING TIPS:**
[2-3 practical cooking tips]

Keep it informative and practical.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.ingredientsTitle.replace('{emoji}', getEmoji('list')).replace('{ingredient}', ingredient.charAt(0).toUpperCase() + ingredient.slice(1)),
                headerEmoji: 'list',
                accentColor: 0x27ae60,
                text: result
            };
            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Ingredients AI error:', error);
            await sendError(sendReply, lang.fun.food.ingredientsNotFound.replace('{ingredient}', ingredient));
        }
    },

    async handleDiet(interaction, sendReply) {
        const dietType = interaction.options.getString('type');
        const mealType = interaction.options.getString('meal') || 'any';
        if (!dietType) {
            return await sendError(sendReply, lang.fun.food.dietError);
        }

        const cacheKey = `diet_${dietType}_${mealType}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const mealText = mealType === 'any' ? 'meal ideas' : `${mealType} ideas`;

        const prompt = `Give me ${dietType} diet ${mealText}. Format like this:

** ${dietType.toUpperCase()} DIET - ${mealText.toUpperCase()}**

**️ MEAL OPTIONS:**
1. **[meal 1]** - [brief description]
2. **[meal 2]** - [brief description] 
3. **[meal 3]** - [brief description]
4. **[meal 4]** - [brief description]
5. **[meal 5]** - [brief description]

** KEY INGREDIENTS TO USE:**
• [ingredient 1] - [why good for this diet]
• [ingredient 2] - [why good for this diet]
• [ingredient 3] - [why good for this diet]

**️ AVOID:**
[Foods to avoid on this diet]

** DIET TIPS:**
[2-3 helpful tips for this diet]

Make suggestions practical and achievable.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 30000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.dietTitle.replace('{emoji}', getEmoji('sparkles')).replace('{diet}', dietType.charAt(0).toUpperCase() + dietType.slice(1)) + ` (${mealText})`,
                headerEmoji: 'heart',
                accentColor: 0x8e44ad,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Diet AI error:', error);
            await sendError(sendReply, lang.fun.food.dietError);
        }
    },

    async handlePairing(interaction, sendReply) {
        const food = interaction.options.getString('food');
        const pairingType = interaction.options.getString('type') || 'food';
        if (!food) {
            return await sendError(sendReply, lang.fun.food.pairingNotFound.replace('{food}', ''));
        }

        const cacheKey = `pairing_${food}_${pairingType}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const typeText = {
            'food': 'food combinations',
            'wine': 'wine pairings',
            'drink': 'drink pairings'
        };

        const prompt = `Suggest ${typeText[pairingType]} for ${food}. Format like this:

** PERFECT PAIRINGS FOR ${food.toUpperCase()}**

** TOP RECOMMENDATIONS:**
1. **[pairing 1]** - [why it works]
2. **[pairing 2]** - [why it works]
3. **[pairing 3]** - [why it works]
4. **[pairing 4]** - [why it works]
5. **[pairing 5]** - [why it works]

** FLAVOR PROFILE:**
[Describe the flavor profile of the main food]

** PAIRING PRINCIPLES:**
[Explain why these pairings work]

**️ SERVING SUGGESTIONS:**
[1-2 serving ideas]

Focus on practical pairings that enhance flavors.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.pairingTitle.replace('{emoji}', getEmoji('sparkles')).replace('{food}', food.charAt(0).toUpperCase() + food.slice(1)) + ` (${typeText[pairingType]})`,
                headerEmoji: 'smile',
                accentColor: 0xd35400,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Pairing AI error:', error);
            await sendError(sendReply, lang.fun.food.pairingNotFound.replace('{food}', food));
        }
    },

    async handleSeasonal(interaction, sendReply) {
        const season = interaction.options.getString('season');
        const category = interaction.options.getString('category') || 'recipes';
        if (!season) {
            return await sendError(sendReply, lang.fun.food.seasonalError);
        }

        const cacheKey = `seasonal_${season}_${category}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Give me ${season} ${category} recommendations. Format like this:

** ${season.toUpperCase()} ${category.toUpperCase()} GUIDE**

** TOP SEASONAL PICKS:**
1. **[item 1]** - [why perfect for this season]
2. **[item 2]** - [why perfect for this season]
3. **[item 3]** - [why perfect for this season]
4. **[item 4]** - [why perfect for this season]
5. **[item 5]** - [why perfect for this season]

**️ SEASONAL BENEFITS:**
[Why eating seasonally in ${season} is good]

** SHOPPING TIPS:**
• [tip 1]
• [tip 2]

** ${season.toUpperCase()} COOKING IDEAS:**
[2-3 seasonal cooking suggestions]

Focus on what's naturally in season and tastes best.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.seasonalTitle.replace('{emoji}', getEmoji('sparkles')) + `: ${season.charAt(0).toUpperCase() + season.slice(1)} (${category})`,
                headerEmoji: 'calendar',
                accentColor: 0x16a085,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Seasonal AI error:', error);
            await sendError(sendReply, lang.fun.food.seasonalError);
        }
    },

    async handleCuisine(interaction, sendReply) {
        const country = interaction.options.getString('country');
        const dishType = interaction.options.getString('dish_type') || 'main';
        if (!country) {
            return await sendError(sendReply, lang.fun.food.cuisineNotFound.replace('{country}', ''));
        }

        const cacheKey = `cuisine_${country}_${dishType}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Explore ${country} cuisine ${dishType} dishes. Format like this:

** ${country.toUpperCase()} CUISINE - ${dishType.toUpperCase()} DISHES**

**️ SIGNATURE DISHES:**
1. **[dish 1]** - [brief description]
2. **[dish 2]** - [brief description]
3. **[dish 3]** - [brief description]
4. **[dish 4]** - [brief description]
5. **[dish 5]** - [brief description]

** KEY FLAVORS & INGREDIENTS:**
[Typical flavors, spices, and ingredients used]

** COOKING TECHNIQUES:**
[Common cooking methods in this cuisine]

** CULTURAL NOTES:**
[Interesting cultural facts about the cuisine]

** TRY AT HOME:**
[1-2 tips for cooking this cuisine at home]

Focus on authentic, traditional dishes.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.cuisineTitle.replace('{emoji}', getEmoji('world')).replace('{country}', country.charAt(0).toUpperCase() + country.slice(1)) + ` (${dishType})`,
                headerEmoji: 'search',
                accentColor: 0xC0392B,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Cuisine AI error:', error);
            await sendError(sendReply, lang.fun.food.cuisineNotFound.replace('{country}', country));
        }
    },

    async handleCookingTips(interaction, sendReply) {
        const technique = interaction.options.getString('technique');
        if (!technique) {
            return await sendError(sendReply, lang.fun.food.tipsNotFound);
        }

        const cacheKey = `cookingtips_${technique}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Give me cooking tips about "${technique}". Format like this:

** COOKING GUIDE: ${technique.toUpperCase()}**

** TECHNIQUE OVERVIEW:**
[What this technique is and when to use it]

** STEP-BY-STEP:**
1. [step 1]
2. [step 2]
3. [step 3]
[continue as needed]

**️ COMMON MISTAKES:**
• [mistake 1] - [how to avoid]
• [mistake 2] - [how to avoid]

** PRO TIPS:**
• [expert tip 1]
• [expert tip 2]

**️ EQUIPMENT NEEDED:**
[List necessary tools or equipment]

**️ BEST USED FOR:**
[What foods/dishes this technique works best with]

Be practical and detailed for home cooks.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 30000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.tipsTitle.replace('{emoji}', getEmoji('document')) + `: ${technique.charAt(0).toUpperCase() + technique.slice(1)}`,
                headerEmoji: 'document',
                accentColor: 0x34495E,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Cooking tips AI error:', error);
            await sendError(sendReply, lang.fun.food.tipsNotFound);
        }
    },

    async handleSafety(interaction, sendReply) {
        const topic = interaction.options.getString('topic');
        const specificFood = interaction.options.getString('food');
        if (!topic) {
            return await sendError(sendReply, lang.fun.food.safetyError);
        }

        const topicText = {
            'storage': 'food storage',
            'expiration': 'expiration dates',
            'temperature': 'temperature guidelines',
            'prevention': 'food poisoning prevention'
        };

        const foodText = specificFood ? ` for ${specificFood}` : '';

        const cacheKey = `safety_${topic}_${specificFood || 'none'}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Give me ${topicText[topic]} information${foodText}. Format like this:

**️ FOOD SAFETY: ${topicText[topic].toUpperCase()}${foodText.toUpperCase()}**

**️ KEY SAFETY RULES:**
• [rule 1]
• [rule 2]
• [rule 3]
• [rule 4]

**️ TEMPERATURE GUIDELINES:**
[Relevant temperature information]

**⏰ TIME LIMITS:**
[How long foods last under different conditions]

** WARNING SIGNS:**
[Signs of spoilage or unsafe food]

** SAFETY TIPS:**
• [practical tip 1]
• [practical tip 2]

** WHEN TO THROW AWAY:**
[Clear guidelines on when food is unsafe]

Focus on practical safety information for home kitchens.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.safetyTitle.replace('{emoji}', getEmoji('security') || '️') + `: ${topicText[topic].charAt(0).toUpperCase() + topicText[topic].slice(1)}${foodText}`,
                headerEmoji: 'shield',
                accentColor: 0xE67E22,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Safety AI error:', error);
            await sendError(sendReply, lang.fun.food.safetyError);
        }
    },

    async handleGrocery(interaction, sendReply) {
        const task = interaction.options.getString('task');
        const details = interaction.options.getString('details');
        const budget = interaction.options.getInteger('budget');
        if (!task) {
            return await sendError(sendReply, lang.fun.food.groceryError);
        }

        const taskText = {
            'list': 'shopping list generation',
            'budget': 'budget meal planning',
            'seasonal': 'seasonal shopping guide',
            'bulk': 'bulk buying tips'
        };

        const extraInfo = details ? ` Details: ${details}.` : '';
        const budgetInfo = budget ? ` Weekly budget: $${budget}.` : '';

        const cacheKey = `grocery_${task}_${details || 'none'}_${budget || 'none'}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Help me with ${taskText[task]}.${extraInfo}${budgetInfo} Format like this:

** GROCERY HELPER: ${taskText[task].toUpperCase()}**

** MAIN RECOMMENDATIONS:**
• [recommendation 1]
• [recommendation 2]
• [recommendation 3]
• [recommendation 4]
• [recommendation 5]

** MONEY-SAVING TIPS:**
• [money tip 1]
• [money tip 2]

** PLANNING ADVICE:**
• [planning tip 1]
• [planning tip 2]

**️ SHOPPING STRATEGY:**
[Best practices for this type of shopping]

**️ AVOID:**
[Common mistakes to avoid]

Make it practical for everyday grocery shopping.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.groceryTitle.replace('{emoji}', getEmoji('sparkles')) + `: ${taskText[task].charAt(0).toUpperCase() + taskText[task].slice(1)}`,
                headerEmoji: 'cart',
                accentColor: 0x7F8C8D,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Grocery AI error:', error);
            await sendError(sendReply, lang.fun.food.groceryError);
        }
    },

    async handleLeftover(interaction, sendReply) {
        const leftoverFood = interaction.options.getString('food');
        const people = interaction.options.getInteger('people') || 2;
        if (!leftoverFood) {
            return await sendError(sendReply, lang.fun.food.leftoverNotFound.replace('{food}', ''));
        }

        const cacheKey = `leftover_${leftoverFood}_${people}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Give me creative ideas for leftover ${leftoverFood} that feeds ${people} people. Format like this:

**️ LEFTOVER MAGIC: ${leftoverFood.toUpperCase()}**

**️ CREATIVE RECIPE IDEAS:**
1. **[recipe 1]** - [quick description]
2. **[recipe 2]** - [quick description]
3. **[recipe 3]** - [quick description]
4. **[recipe 4]** - [quick description]
5. **[recipe 5]** - [quick description]

** QUICK TRANSFORMATIONS:**
• [quick idea 1]
• [quick idea 2]
• [quick idea 3]

** ADD TO MAKE IT COMPLETE:**
[Ingredients to add to make a full meal]

**⏰ STORAGE REMINDER:**
[How long this leftover is safe to use]

** CHEF'S SECRET:**
[Pro tip for making leftovers taste fresh]

Focus on easy, practical transformations.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.leftoverTitle.replace('{emoji}', getEmoji('sparkles')).replace('{food}', leftoverFood.charAt(0).toUpperCase() + leftoverFood.slice(1)) + ` (for ${people} people)`,
                headerEmoji: 'loop',
                accentColor: 0x95A5A6,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Leftover AI error:', error);
            await sendError(sendReply, lang.fun.food.leftoverNotFound.replace('{food}', leftoverFood));
        }
    },

    async handleCompare(interaction, sendReply) {
        const food1 = interaction.options.getString('food1');
        const food2 = interaction.options.getString('food2');
        const food3 = interaction.options.getString('food3');
        if (!food1 || !food2) {
            return await sendError(sendReply, lang.fun.food.compareError);
        }

        const foods = food3 ? [food1, food2, food3] : [food1, food2];
        const foodList = foods.join(' vs ');

        const cacheKey = `compare_${food1}_${food2}_${food3 || 'none'}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Compare nutrition between ${foodList}. Format like this:

**️ NUTRITION COMPARISON: ${foodList.toUpperCase()}**

${foods.map(food => `
**${food.toUpperCase()}:**
• Calories: [number] per 100g
• Protein: [number]g
• Carbs: [number]g
• Fat: [number]g
• Fiber: [number]g
• Key nutrients: [list top 3]`
        ).join('\n\n')}

** WINNER BY CATEGORY:**
• **Lowest Calories:** [food]
• **Highest Protein:** [food]
• **Most Fiber:** [food]
• **Best Overall:** [food and why]

** HEALTH VERDICT:**
[Which is healthiest and why]

** BOTTOM LINE:**
[Practical advice on when to choose each]

Use typical serving sizes and be accurate with numbers.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 30000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.compareTitle.replace('{emoji}', getEmoji('analytics') || '️') + `: ${foodList}`,
                headerEmoji: 'chart',
                accentColor: 0xF1C40F,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Compare AI error:', error);
            await sendError(sendReply, lang.fun.food.compareError);
        }
    },

    async handleMealPrep(interaction, sendReply) {
        const goal = interaction.options.getString('goal');
        const days = interaction.options.getInteger('days') || 5;
        if (!goal) {
            return await sendError(sendReply, lang.fun.food.mealPrepError);
        }

        const goalText = {
            'time': 'save time',
            'money': 'save money',
            'health': 'eat healthier',
            'weight': 'achieve weight goals'
        };

        const cacheKey = `mealprep_${goal}_${days}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Create a ${days}-day meal prep plan to ${goalText[goal]}. Format like this:

** MEAL PREP PLAN: ${goalText[goal].toUpperCase()}**

**️ ${days}-DAY MEAL SCHEDULE:**
${Array.from({ length: days }, (_, i) => `
**Day ${i + 1}:**
• Breakfast: [prepped meal]
• Lunch: [prepped meal]
• Dinner: [prepped meal]`
        ).join('\n\n')}

**‍ PREP DAY STRATEGY:**
1. [prep step 1]
2. [prep step 2]
3. [prep step 3]
4. [prep step 4]

** SHOPPING LIST:**
[Essential ingredients for the week]

** STORAGE TIPS:**
• [storage tip 1]
• [storage tip 2]

**⏰ TIME BREAKDOWN:**
[How long prep day will take]

Focus on practical, achievable meal prep for busy people.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 35000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.mealPrepTitle.replace('{emoji}', getEmoji('calendar')) + `: ${goalText[goal].charAt(0).toUpperCase() + goalText[goal].slice(1)} (${days} days)`,
                headerEmoji: 'calendar',
                accentColor: 0x2980B9,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Meal prep AI error:', error);
            await sendError(sendReply, lang.fun.food.mealPrepError);
        }
    },

    async handleQuick(interaction, sendReply) {
        const minutes = interaction.options.getInteger('minutes');
        const mealType = interaction.options.getString('meal_type') || 'any';
        if (!minutes) {
            return await sendError(sendReply, lang.fun.food.quickError);
        }

        const mealText = mealType === 'any' ? 'meal' : mealType;

        const cacheKey = `quick_${minutes}_${mealType}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Give me ${mealText} ideas that take ${minutes} minutes or less. Format like this:

** ${minutes}-MINUTE ${mealText.toUpperCase()} IDEAS**

** LIGHTNING-FAST RECIPES:**
1. **[recipe 1]** (${Math.floor(minutes / 2)} min) - [ingredients list]
2. **[recipe 2]** (${Math.floor(minutes * 0.7)} min) - [ingredients list]
3. **[recipe 3]** (${minutes} min) - [ingredients list]
4. **[recipe 4]** (${Math.floor(minutes * 0.8)} min) - [ingredients list]
5. **[recipe 5]** (${Math.floor(minutes * 0.6)} min) - [ingredients list]

** PANTRY STAPLES TO KEEP:**
• [staple 1]
• [staple 2]
• [staple 3]

**⏰ TIME-SAVING HACKS:**
• [hack 1]
• [hack 2]

**️ SERVING TIP:**
[How to make it feel like a complete meal]

Focus on realistic cooking times and common ingredients.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 25000 });
            const result = response.text();

            const payload = {
                title: lang.fun.food.quickTitle.replace('{emoji}', getEmoji('time')).replace('{minutes}', minutes) + ` (${mealText})`,
                headerEmoji: 'fire',
                accentColor: 0xE74C3C,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Quick meals AI error:', error);
            await sendError(sendReply, lang.fun.food.quickError);
        }
    },

    async handleAllergy(interaction, sendReply) {
        const allergens = interaction.options.getString('allergens');
        const mealType = interaction.options.getString('meal_type') || 'any';
        if (!allergens) {
            return await sendError(sendReply, lang.fun.food.allergyError);
        }

        const mealText = mealType === 'any' ? 'meal' : mealType;

        const cacheKey = `allergy_${allergens}_${mealType}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return await sendReply(cached);
        }

        const prompt = `Give me ${mealText} recipes that avoid these allergens: ${allergens}. Format like this:

** ALLERGY-FREE ${mealText.toUpperCase()} RECIPES**
**Avoiding:** ${allergens.toUpperCase()}

**️ SAFE RECIPE OPTIONS:**
1. **[recipe 1]** - [ingredients summary]
2. **[recipe 2]** - [ingredients summary]
3. **[recipe 3]** - [ingredients summary]
4. **[recipe 4]** - [ingredients summary]
5. **[recipe 5]** - [ingredients summary]

** SAFE INGREDIENTS TO USE:**
• [safe ingredient 1]
• [safe ingredient 2]
• [safe ingredient 3]
• [safe ingredient 4]

**️ HIDDEN SOURCES TO AVOID:**
• [hidden source 1]
• [hidden source 2]
• [hidden source 3]

** SHOPPING TIPS:**
• [label reading tip]
• [brand recommendation if applicable]

** SUBSTITUTION IDEAS:**
[How to replace common allergenic ingredients]

Focus on naturally allergen-free options and safe substitutes.`;

        try {
            const serverId = interaction.guild?.id || 'global_user';
            const response = await aiManager.generateContent(serverId, prompt, { timeout: 30000 });
            const result = response.text();

            const payload = {
                title: `${lang.fun.food.allergyTitle.replace('{emoji}', getEmoji('security'))} (Avoiding: ${allergens})`,
                headerEmoji: 'cross',
                accentColor: 0xA569BD,
                text: result
            };

            setCache(cacheKey, payload);
            await sendReply(payload);

        } catch (error) {
            console.error('Allergy AI error:', error);
            await sendError(sendReply, lang.fun.food.allergyError);
        }
    }
};

