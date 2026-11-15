

const FISH_TYPES = {
    
    sardine: { name: 'Sardine', emoji: '🐟', rarity: 'common', baseValue: 5, weight: [0.1, 0.5], xp: 2 },
    anchovy: { name: 'Anchovy', emoji: '🐟', rarity: 'common', baseValue: 8, weight: [0.1, 0.3], xp: 2 },
    herring: { name: 'Herring', emoji: '🐟', rarity: 'common', baseValue: 10, weight: [0.2, 0.8], xp: 3 },
    mackerel: { name: 'Mackerel', emoji: '🐟', rarity: 'common', baseValue: 12, weight: [0.5, 2.0], xp: 3 },
    perch: { name: 'Perch', emoji: '🐟', rarity: 'common', baseValue: 15, weight: [0.3, 1.5], xp: 4 },

    
    trout: { name: 'Rainbow Trout', emoji: '🐠', rarity: 'uncommon', baseValue: 30, weight: [1.0, 5.0], xp: 8 },
    bass: { name: 'Largemouth Bass', emoji: '🐠', rarity: 'uncommon', baseValue: 35, weight: [1.5, 6.0], xp: 10 },
    salmon: { name: 'Atlantic Salmon', emoji: '🐠', rarity: 'uncommon', baseValue: 45, weight: [2.0, 8.0], xp: 12 },
    catfish: { name: 'Catfish', emoji: '🐠', rarity: 'uncommon', baseValue: 40, weight: [1.0, 10.0], xp: 10 },
    pike: { name: 'Northern Pike', emoji: '🐠', rarity: 'uncommon', baseValue: 50, weight: [2.0, 12.0], xp: 14 },

    
    swordfish: { name: 'Swordfish', emoji: '🗡️', rarity: 'rare', baseValue: 100, weight: [30, 80], xp: 25 },
    tuna: { name: 'Bluefin Tuna', emoji: '🐟', rarity: 'rare', baseValue: 120, weight: [50, 200], xp: 30 },
    marlin: { name: 'Blue Marlin', emoji: '🎣', rarity: 'rare', baseValue: 150, weight: [80, 250], xp: 35 },
    sturgeon: { name: 'Sturgeon', emoji: '🐠', rarity: 'rare', baseValue: 130, weight: [20, 100], xp: 28 },

    
    shark: { name: 'Great White Shark', emoji: '🦈', rarity: 'epic', baseValue: 350, weight: [300, 800], xp: 60 },
    manta: { name: 'Giant Manta Ray', emoji: '🦈', rarity: 'epic', baseValue: 300, weight: [100, 500], xp: 50 },
    octopus: { name: 'Giant Octopus', emoji: '🐙', rarity: 'epic', baseValue: 400, weight: [10, 50], xp: 65 },

    
    goldenKoi: { name: 'Golden Koi', emoji: '✨', rarity: 'legendary', baseValue: 1000, weight: [2.0, 5.0], xp: 150 },
    seaDragon: { name: 'Sea Dragon', emoji: '🐉', rarity: 'legendary', baseValue: 2000, weight: [500, 1000], xp: 250 },
    kraken: { name: 'Baby Kraken', emoji: '🦑', rarity: 'legendary', baseValue: 5000, weight: [1000, 5000], xp: 500 }
};

const RARITY_CHANCES = {
    common: 60,
    uncommon: 25,
    rare: 10,
    epic: 4,
    legendary: 1
};

const FISHING_RODS = {
    basic_rod: {
        id: 'basic_rod',
        name: 'Basic Fishing Rod',
        emoji: '🎣',
        price: 0,
        description: 'A simple bamboo fishing rod',
        catchBonus: 1.0,
        rarityBoost: 0,
        durability: Infinity,
        level: 0
    },
    carbon_rod: {
        id: 'carbon_rod',
        name: 'Carbon Fiber Rod',
        emoji: '🎣',
        price: 500,
        description: 'Lightweight and strong carbon fiber rod',
        catchBonus: 1.2,
        rarityBoost: 5,
        durability: 200,
        level: 5
    },
    golden_rod: {
        id: 'golden_rod',
        name: 'Golden Rod',
        emoji: '🏆',
        price: 2000,
        description: 'A legendary golden fishing rod',
        catchBonus: 1.5,
        rarityBoost: 10,
        durability: 500,
        level: 15
    },
    deep_sea_rod: {
        id: 'deep_sea_rod',
        name: 'Deep Sea Rod',
        emoji: '🌊',
        price: 5000,
        description: 'Built for the deepest ocean catches',
        catchBonus: 1.8,
        rarityBoost: 15,
        durability: 300,
        level: 25
    },
    mythical_rod: {
        id: 'mythical_rod',
        name: 'Mythical Trident Rod',
        emoji: '🔱',
        price: 15000,
        description: 'Forged from ancient sea artifacts',
        catchBonus: 2.5,
        rarityBoost: 25,
        durability: 1000,
        level: 40
    }
};

const BAIT_TYPES = {
    worm: {
        id: 'worm',
        name: 'Earthworm',
        emoji: '🪱',
        price: 5,
        description: 'Basic bait for small fish',
        catchBonus: 1.0,
        rarityBoost: 0,
        attractsFish: ['common', 'uncommon']
    },
    minnow: {
        id: 'minnow',
        name: 'Live Minnow',
        emoji: '🐟',
        price: 15,
        description: 'Attracts medium-sized fish',
        catchBonus: 1.3,
        rarityBoost: 5,
        attractsFish: ['uncommon', 'rare']
    },
    shrimp: {
        id: 'shrimp',
        name: 'Fresh Shrimp',
        emoji: '🦐',
        price: 30,
        description: 'Premium bait for larger fish',
        catchBonus: 1.5,
        rarityBoost: 10,
        attractsFish: ['rare', 'epic']
    },
    golden_lure: {
        id: 'golden_lure',
        name: 'Golden Lure',
        emoji: '✨',
        price: 100,
        description: 'Magical lure that attracts rare fish',
        catchBonus: 2.0,
        rarityBoost: 20,
        attractsFish: ['epic', 'legendary']
    },
    mystic_bait: {
        id: 'mystic_bait',
        name: 'Mystic Bait',
        emoji: '🔮',
        price: 250,
        description: 'Enchanted bait for legendary catches',
        catchBonus: 3.0,
        rarityBoost: 35,
        attractsFish: ['legendary']
    }
};

const FISHING_LOCATIONS = {
    pond: { name: 'Village Pond', emoji: '🏞️', fishTypes: ['common'], bonusXp: 0, level: 0 },
    river: { name: 'Crystal River', emoji: '🌊', fishTypes: ['common', 'uncommon'], bonusXp: 2, level: 5 },
    lake: { name: 'Deep Lake', emoji: '💧', fishTypes: ['common', 'uncommon', 'rare'], bonusXp: 5, level: 10 },
    ocean: { name: 'Open Ocean', emoji: '🌊', fishTypes: ['uncommon', 'rare', 'epic'], bonusXp: 10, level: 20 },
    abyss: { name: 'The Abyss', emoji: '🕳️', fishTypes: ['rare', 'epic', 'legendary'], bonusXp: 25, level: 35 }
};

module.exports = { FISH_TYPES, RARITY_CHANCES, FISHING_RODS, BAIT_TYPES, FISHING_LOCATIONS };
