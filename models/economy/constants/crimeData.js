

const CRIME_TYPES = {
    pickpocket: {
        id: 'pickpocket',
        name: 'Pickpocket',
        emoji: '🤏',
        description: 'Steal from unsuspecting NPCs',
        successRate: 70,
        minReward: 20,
        maxReward: 100,
        minFine: 50,
        maxFine: 200,
        heatGain: 5,
        xp: 3,
        cooldown: 5 * 60 * 1000, 
        level: 0,
        jailTime: 2 * 60 * 1000 
    },
    shoplifting: {
        id: 'shoplifting',
        name: 'Shoplifting',
        emoji: '🏪',
        description: 'Steal from local stores',
        successRate: 60,
        minReward: 50,
        maxReward: 250,
        minFine: 100,
        maxFine: 400,
        heatGain: 10,
        xp: 5,
        cooldown: 10 * 60 * 1000,
        level: 3,
        jailTime: 5 * 60 * 1000
    },
    carjacking: {
        id: 'carjacking',
        name: 'Carjacking',
        emoji: '🚗',
        description: 'Steal and chop cars for parts',
        successRate: 45,
        minReward: 200,
        maxReward: 800,
        minFine: 300,
        maxFine: 1000,
        heatGain: 20,
        xp: 12,
        cooldown: 20 * 60 * 1000,
        level: 8,
        jailTime: 10 * 60 * 1000
    },
    hacking: {
        id: 'hacking',
        name: 'Hacking',
        emoji: '💻',
        description: 'Hack into systems for data and money',
        successRate: 40,
        minReward: 500,
        maxReward: 2000,
        minFine: 500,
        maxFine: 2500,
        heatGain: 25,
        xp: 20,
        cooldown: 30 * 60 * 1000,
        level: 15,
        jailTime: 15 * 60 * 1000
    },
    bank_fraud: {
        id: 'bank_fraud',
        name: 'Bank Fraud',
        emoji: '🏦',
        description: 'Forge documents and steal transactions',
        successRate: 30,
        minReward: 1000,
        maxReward: 5000,
        minFine: 1000,
        maxFine: 5000,
        heatGain: 35,
        xp: 35,
        cooldown: 60 * 60 * 1000,
        level: 22,
        jailTime: 30 * 60 * 1000
    },
    art_heist: {
        id: 'art_heist',
        name: 'Art Heist',
        emoji: '🖼️',
        description: 'Steal priceless artwork from museums',
        successRate: 20,
        minReward: 3000,
        maxReward: 15000,
        minFine: 3000,
        maxFine: 10000,
        heatGain: 50,
        xp: 60,
        cooldown: 120 * 60 * 1000, 
        level: 30,
        jailTime: 60 * 60 * 1000
    },
    cyber_war: {
        id: 'cyber_war',
        name: 'Cyber Warfare',
        emoji: '🌐',
        description: 'Launch sophisticated cyber operations',
        successRate: 15,
        minReward: 8000,
        maxReward: 30000,
        minFine: 5000,
        maxFine: 20000,
        heatGain: 75,
        xp: 100,
        cooldown: 240 * 60 * 1000, 
        level: 40,
        jailTime: 120 * 60 * 1000 
    }
};


const JAILBREAK_METHODS = {
    bribe: { name: 'Bribe Guard', cost: 500, successRate: 60, emoji: '💰' },
    tunnel: { name: 'Dig Tunnel', cost: 0, successRate: 30, emoji: '🕳️' },
    lawyer: { name: 'Hire Lawyer', cost: 2000, successRate: 85, emoji: '⚖️' },
    riot: { name: 'Start Riot', cost: 0, successRate: 15, emoji: '🔥' }
};


const HEAT_LEVELS = [
    { min: 0, max: 20, name: 'Clean', emoji: '😇', penalty: 0, description: 'No criminal record' },
    { min: 21, max: 40, name: 'Suspicious', emoji: '🤨', penalty: 5, description: 'Police are watching' },
    { min: 41, max: 60, name: 'Wanted', emoji: '🚨', penalty: 10, description: 'Active warrant out' },
    { min: 61, max: 80, name: 'Most Wanted', emoji: '🔴', penalty: 20, description: 'Top priority target' },
    { min: 81, max: 100, name: 'Public Enemy', emoji: '💀', penalty: 35, description: 'Shoot on sight' }
];

module.exports = { CRIME_TYPES, JAILBREAK_METHODS, HEAT_LEVELS };
