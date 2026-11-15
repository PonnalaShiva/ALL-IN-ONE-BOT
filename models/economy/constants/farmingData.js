

const CROPS = {
    wheat: {
        id: 'wheat',
        name: 'Wheat',
        emoji: '🌾',
        seedPrice: 10,
        sellPrice: 25,
        growTime: 30 * 60 * 1000, 
        xp: 5,
        description: 'Basic crop, fast growing',
        level: 0,
        waterNeeded: 1,
        category: 'grain'
    },
    carrot: {
        id: 'carrot',
        name: 'Carrot',
        emoji: '🥕',
        seedPrice: 20,
        sellPrice: 50,
        growTime: 45 * 60 * 1000, 
        xp: 8,
        description: 'Underground veggie, reliable profit',
        level: 3,
        waterNeeded: 1,
        category: 'vegetable'
    },
    potato: {
        id: 'potato',
        name: 'Potato',
        emoji: '🥔',
        seedPrice: 15,
        sellPrice: 40,
        growTime: 40 * 60 * 1000,
        xp: 7,
        description: 'Hearty tuber, decent returns',
        level: 2,
        waterNeeded: 1,
        category: 'vegetable'
    },
    tomato: {
        id: 'tomato',
        name: 'Tomato',
        emoji: '🍅',
        seedPrice: 30,
        sellPrice: 75,
        growTime: 60 * 60 * 1000, 
        xp: 12,
        description: 'Juicy fruit, good margins',
        level: 5,
        waterNeeded: 2,
        category: 'fruit'
    },
    corn: {
        id: 'corn',
        name: 'Corn',
        emoji: '🌽',
        seedPrice: 25,
        sellPrice: 65,
        growTime: 50 * 60 * 1000,
        xp: 10,
        description: 'Versatile crop, steady income',
        level: 4,
        waterNeeded: 2,
        category: 'grain'
    },
    strawberry: {
        id: 'strawberry',
        name: 'Strawberry',
        emoji: '🍓',
        seedPrice: 50,
        sellPrice: 130,
        growTime: 90 * 60 * 1000, 
        xp: 18,
        description: 'Sweet berries, premium price',
        level: 8,
        waterNeeded: 2,
        category: 'fruit'
    },
    pumpkin: {
        id: 'pumpkin',
        name: 'Pumpkin',
        emoji: '🎃',
        seedPrice: 75,
        sellPrice: 200,
        growTime: 120 * 60 * 1000, 
        xp: 25,
        description: 'Large gourd, high value',
        level: 12,
        waterNeeded: 3,
        category: 'vegetable'
    },
    watermelon: {
        id: 'watermelon',
        name: 'Watermelon',
        emoji: '🍉',
        seedPrice: 100,
        sellPrice: 280,
        growTime: 150 * 60 * 1000, 
        xp: 30,
        description: 'Massive melon, massive profit',
        level: 15,
        waterNeeded: 3,
        category: 'fruit'
    },
    golden_apple: {
        id: 'golden_apple',
        name: 'Golden Apple',
        emoji: '🍎',
        seedPrice: 200,
        sellPrice: 600,
        growTime: 240 * 60 * 1000, 
        xp: 50,
        description: 'Rare golden fruit, extremely valuable',
        level: 20,
        waterNeeded: 4,
        category: 'rare'
    },
    dragon_fruit: {
        id: 'dragon_fruit',
        name: 'Dragon Fruit',
        emoji: '🐉',
        seedPrice: 500,
        sellPrice: 1500,
        growTime: 480 * 60 * 1000, 
        xp: 100,
        description: 'Exotic legendary crop',
        level: 30,
        waterNeeded: 5,
        category: 'legendary'
    }
};

const FERTILIZERS = {
    basic: {
        id: 'basic',
        name: 'Basic Fertilizer',
        emoji: '💩',
        price: 25,
        growthBoost: 0.15, 
        qualityBoost: 0,
        description: 'Speeds up growth slightly'
    },
    premium: {
        id: 'premium',
        name: 'Premium Fertilizer',
        emoji: '🧪',
        price: 75,
        growthBoost: 0.30, 
        qualityBoost: 0.10, 
        description: 'Faster growth and better quality'
    },
    magical: {
        id: 'magical',
        name: 'Magical Fertilizer',
        emoji: '✨',
        price: 200,
        growthBoost: 0.50, 
        qualityBoost: 0.25, 
        description: 'Enchanted growth formula'
    }
};

const FARM_UPGRADES = {
    extra_plot: { name: 'Extra Plot', price: 500, description: 'Add one more farming plot', maxLevel: 10 },
    sprinkler: { name: 'Auto Sprinkler', price: 2000, description: 'Auto-waters crops every cycle', maxLevel: 1 },
    greenhouse: { name: 'Greenhouse', price: 5000, description: '20% growth speed bonus to all crops', maxLevel: 1 },
    scarecrow: { name: 'Scarecrow', price: 1000, description: 'Prevents crop theft and disease', maxLevel: 1 }
};

const CROP_QUALITY = {
    withered: { name: 'Withered', multiplier: 0, emoji: '💀', description: 'Died from neglect' },
    poor: { name: 'Poor', multiplier: 0.5, emoji: '😟', description: 'Below average quality' },
    normal: { name: 'Normal', multiplier: 1.0, emoji: '😊', description: 'Standard quality' },
    good: { name: 'Good', multiplier: 1.3, emoji: '😄', description: 'Above average quality' },
    excellent: { name: 'Excellent', multiplier: 1.6, emoji: '🌟', description: 'Premium quality' },
    legendary: { name: 'Legendary', multiplier: 2.5, emoji: '👑', description: 'Legendary quality' }
};

module.exports = { CROPS, FERTILIZERS, FARM_UPGRADES, CROP_QUALITY };
