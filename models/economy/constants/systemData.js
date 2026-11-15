

const ACHIEVEMENTS = {
    
    first_dollar: { id: 'first_dollar', name: 'First Dollar', description: 'Earn your first dollar', category: 'wealth', emoji: '💵', reward: 50, condition: { type: 'wallet', value: 1 } },
    thousandaire: { id: 'thousandaire', name: 'Thousandaire', description: 'Have $1,000 in wallet', category: 'wealth', emoji: '💰', reward: 200, condition: { type: 'wallet', value: 1000 } },
    millionaire: { id: 'millionaire', name: 'Millionaire', description: 'Have $1,000,000 total net worth', category: 'wealth', emoji: '🏆', reward: 5000, condition: { type: 'netWorth', value: 1000000 } },
    billionaire: { id: 'billionaire', name: 'Billionaire', description: 'Have $1,000,000,000 total net worth', category: 'wealth', emoji: '👑', reward: 50000, condition: { type: 'netWorth', value: 1000000000 } },

    
    first_bet: { id: 'first_bet', name: 'Risk Taker', description: 'Place your first bet', category: 'gambling', emoji: '🎰', reward: 25, condition: { type: 'gamblingStats.totalBets', value: 1 } },
    high_roller: { id: 'high_roller', name: 'High Roller', description: 'Wager $100,000 total', category: 'gambling', emoji: '💎', reward: 2000, condition: { type: 'gamblingStats.totalWagered', value: 100000 } },
    lucky_streak: { id: 'lucky_streak', name: 'Lucky Streak', description: 'Win 50 bets', category: 'gambling', emoji: '🍀', reward: 1000, condition: { type: 'gamblingStats.totalBets', value: 50 } },
    jackpot: { id: 'jackpot', name: 'Jackpot!', description: 'Win $10,000 in a single bet', category: 'gambling', emoji: '🎉', reward: 3000, condition: { type: 'gamblingStats.biggestWin', value: 10000 } },

    
    first_catch: { id: 'first_catch', name: 'Gone Fishing', description: 'Catch your first fish', category: 'fishing', emoji: '🎣', reward: 30, condition: { type: 'fishingStats.totalCaught', value: 1 } },
    master_angler: { id: 'master_angler', name: 'Master Angler', description: 'Catch 100 fish', category: 'fishing', emoji: '🐠', reward: 1500, condition: { type: 'fishingStats.totalCaught', value: 100 } },
    legendary_catch: { id: 'legendary_catch', name: 'Legendary Catch', description: 'Catch a legendary fish', category: 'fishing', emoji: '🐉', reward: 5000, condition: { type: 'fishingStats.legendaryCaught', value: 1 } },

    
    green_thumb: { id: 'green_thumb', name: 'Green Thumb', description: 'Harvest your first crop', category: 'farming', emoji: '🌱', reward: 30, condition: { type: 'farmingStats.totalHarvested', value: 1 } },
    master_farmer: { id: 'master_farmer', name: 'Master Farmer', description: 'Harvest 200 crops', category: 'farming', emoji: '🌾', reward: 2000, condition: { type: 'farmingStats.totalHarvested', value: 200 } },

    
    petty_thief: { id: 'petty_thief', name: 'Petty Thief', description: 'Commit your first crime', category: 'crime', emoji: '🤏', reward: 50, condition: { type: 'crimeStats.crimesCommitted', value: 1 } },
    crime_lord: { id: 'crime_lord', name: 'Crime Lord', description: 'Commit 100 crimes', category: 'crime', emoji: '🕶️', reward: 5000, condition: { type: 'crimeStats.crimesCommitted', value: 100 } },
    jailbreaker: { id: 'jailbreaker', name: 'Jailbreaker', description: 'Escape from jail 5 times', category: 'crime', emoji: '🔓', reward: 2000, condition: { type: 'crimeStats.jailbreaks', value: 5 } },

    
    big_game_hunter: { id: 'big_game_hunter', name: 'Big Game Hunter', description: 'Complete 50 hunts', category: 'hunting', emoji: '🎯', reward: 1500, condition: { type: 'huntingStats.totalHunts', value: 50 } },

    
    family_person: { id: 'family_person', name: 'Family Person', description: 'Reach max family bond', category: 'social', emoji: '👨‍👩‍👧‍👦', reward: 1000, condition: { type: 'familyBond', value: 100 } },
    married: { id: 'married', name: 'Happily Married', description: 'Get married', category: 'social', emoji: '💍', reward: 500, condition: { type: 'marriedTo', value: 'exists' } },

    
    entrepreneur: { id: 'entrepreneur', name: 'Entrepreneur', description: 'Own a business', category: 'business', emoji: '🏢', reward: 500, condition: { type: 'businesses', value: 1 } },
    tycoon: { id: 'tycoon', name: 'Business Tycoon', description: 'Earn $100,000 from businesses', category: 'business', emoji: '💼', reward: 3000, condition: { type: 'businessIncome', value: 100000 } },

    
    first_prestige: { id: 'first_prestige', name: 'Reborn', description: 'Prestige for the first time', category: 'prestige', emoji: '⭐', reward: 0, condition: { type: 'prestigeLevel', value: 1 } },
    prestige_5: { id: 'prestige_5', name: 'Veteran', description: 'Reach prestige level 5', category: 'prestige', emoji: '🌟', reward: 0, condition: { type: 'prestigeLevel', value: 5 } },
    prestige_10: { id: 'prestige_10', name: 'Legend', description: 'Reach prestige level 10', category: 'prestige', emoji: '💫', reward: 0, condition: { type: 'prestigeLevel', value: 10 } },

    
    level_10: { id: 'level_10', name: 'Getting Started', description: 'Reach level 10', category: 'level', emoji: '📈', reward: 200, condition: { type: 'level', value: 10 } },
    level_25: { id: 'level_25', name: 'Experienced', description: 'Reach level 25', category: 'level', emoji: '📊', reward: 500, condition: { type: 'level', value: 25 } },
    level_50: { id: 'level_50', name: 'Master', description: 'Reach level 50', category: 'level', emoji: '🏅', reward: 2000, condition: { type: 'level', value: 50 } },
    level_100: { id: 'level_100', name: 'Ascended', description: 'Reach level 100', category: 'level', emoji: '🌟', reward: 10000, condition: { type: 'level', value: 100 } }
};

const LOTTERY_CONFIG = {
    ticketPrice: 100,
    numbersPerTicket: 6,
    maxTickets: 50,
    drawInterval: 24 * 60 * 60 * 1000, 
    prizePool: {
        base: 10000,
        perTicket: 80 
    },
    prizes: [
        { match: 'jackpot', share: 0.50, description: 'Jackpot (all numbers match)' },
        { match: 'second', share: 0.25, description: 'Second Prize (5 of 6 match)' },
        { match: 'third', share: 0.15, description: 'Third Prize (4 of 6 match)' },
        { match: 'consolation', share: 0.10, description: 'Consolation (3 of 6 match)' }
    ],
    numberRange: { min: 1, max: 49 }
};

const INSURANCE_TYPES = {
    robbery: {
        id: 'robbery',
        name: 'Anti-Robbery Insurance',
        emoji: '🛡️',
        premium: 500,
        coverage: 0.80, 
        duration: 7 * 24 * 60 * 60 * 1000, 
        maxClaims: 3,
        description: 'Protects against robbery losses'
    },
    gambling: {
        id: 'gambling',
        name: 'Gambling Safety Net',
        emoji: '🎰',
        premium: 1000,
        coverage: 0.50, 
        duration: 3 * 24 * 60 * 60 * 1000, 
        maxClaims: 5,
        description: 'Partial gambling loss protection'
    },
    business: {
        id: 'business',
        name: 'Business Insurance',
        emoji: '🏢',
        premium: 2000,
        coverage: 1.0, 
        duration: 14 * 24 * 60 * 60 * 1000, 
        maxClaims: 2,
        description: 'Full business loss protection'
    },
    crime: {
        id: 'crime',
        name: 'Criminal Defense Fund',
        emoji: '⚖️',
        premium: 1500,
        coverage: 0.60, 
        duration: 7 * 24 * 60 * 60 * 1000,
        maxClaims: 5,
        description: 'Covers crime fines'
    },
    premium: {
        id: 'premium',
        name: 'Premium All-Risk',
        emoji: '💎',
        premium: 5000,
        coverage: 0.90, 
        duration: 30 * 24 * 60 * 60 * 1000, 
        maxClaims: 10,
        description: 'Comprehensive all-risk coverage'
    }
};

const PRESTIGE_CONFIG = {
    minLevel: 50, 
    resetFields: ['wallet', 'bank', 'experience', 'level', 'businesses', 'properties', 'cars'],
    keepFields: ['achievements', 'prestigeLevel', 'prestigeMultiplier', 'huntingInventory', 'fishCollection', 'marriedTo'],
    multiplierPerLevel: 0.05, 
    maxPrestigeLevel: 50,
    bonuses: {
        1: { name: 'Prestige I', bonus: 'Unlock daily interest boost', emoji: '⭐' },
        3: { name: 'Prestige III', bonus: 'Unlock exclusive shop items', emoji: '🌟' },
        5: { name: 'Prestige V', bonus: 'Unlock VIP gambling tables', emoji: '💫' },
        10: { name: 'Prestige X', bonus: 'Unlock legendary farm plots', emoji: '✨' },
        25: { name: 'Prestige XXV', bonus: 'Unlock crime immunity perk', emoji: '🔥' },
        50: { name: 'Prestige L', bonus: 'Unlock infinite prestige aura', emoji: '👑' }
    }
};

module.exports = { ACHIEVEMENTS, LOTTERY_CONFIG, INSURANCE_TYPES, PRESTIGE_CONFIG };
