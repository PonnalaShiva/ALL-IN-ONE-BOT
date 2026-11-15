
const STOCKS = {
    DCRD: {
        symbol: 'DCRD',
        name: 'Discord Corp',
        description: 'Leading communication platform',
        basePrice: 150,
        volatility: 0.08,
        sector: 'technology',
        emoji: '💬',
        dividendRate: 0.02
    },
    MEME: {
        symbol: 'MEME',
        name: 'MemeVault Inc',
        description: 'Digital meme marketplace',
        basePrice: 45,
        volatility: 0.15,
        sector: 'entertainment',
        emoji: '🎭',
        dividendRate: 0
    },
    ROBO: {
        symbol: 'ROBO',
        name: 'RoboTech AI',
        description: 'Artificial intelligence solutions',
        basePrice: 300,
        volatility: 0.12,
        sector: 'technology',
        emoji: '🤖',
        dividendRate: 0.01
    },
    FOOD: {
        symbol: 'FOOD',
        name: 'FoodDelivery Co',
        description: 'Global food delivery network',
        basePrice: 80,
        volatility: 0.06,
        sector: 'services',
        emoji: '🍕',
        dividendRate: 0.03
    },
    GAME: {
        symbol: 'GAME',
        name: 'GameStream Ltd',
        description: 'Cloud gaming platform',
        basePrice: 200,
        volatility: 0.10,
        sector: 'entertainment',
        emoji: '🎮',
        dividendRate: 0.015
    },
    SPACE: {
        symbol: 'SPACE',
        name: 'StarVentures',
        description: 'Space tourism company',
        basePrice: 500,
        volatility: 0.20,
        sector: 'aerospace',
        emoji: '🚀',
        dividendRate: 0
    },
    BANK: {
        symbol: 'BANK',
        name: 'CryptoBank',
        description: 'Decentralized banking',
        basePrice: 120,
        volatility: 0.09,
        sector: 'finance',
        emoji: '🏦',
        dividendRate: 0.04
    },
    HEAL: {
        symbol: 'HEAL',
        name: 'BioHealth Corp',
        description: 'Medical research company',
        basePrice: 250,
        volatility: 0.07,
        sector: 'healthcare',
        emoji: '💊',
        dividendRate: 0.025
    },
    MINE: {
        symbol: 'MINE',
        name: 'DigiMine Ltd',
        description: 'Digital resource mining',
        basePrice: 60,
        volatility: 0.18,
        sector: 'mining',
        emoji: '⛏️',
        dividendRate: 0.01
    },
    PETS: {
        symbol: 'PETS',
        name: 'VirtualPets Co',
        description: 'Virtual pet marketplace',
        basePrice: 35,
        volatility: 0.11,
        sector: 'entertainment',
        emoji: '🐾',
        dividendRate: 0.02
    }
};


const MARKET_EVENTS = [
    { name: 'Bull Market', effect: 0.15, duration: 4, description: 'Markets are soaring!', emoji: '📈', sectors: ['all'] },
    { name: 'Bear Market', effect: -0.12, duration: 4, description: 'Markets are crashing!', emoji: '📉', sectors: ['all'] },
    { name: 'Tech Boom', effect: 0.20, duration: 3, description: 'Tech stocks are booming!', emoji: '💻', sectors: ['technology'] },
    { name: 'Entertainment Surge', effect: 0.18, duration: 2, description: 'Entertainment is hot!', emoji: '🎬', sectors: ['entertainment'] },
    { name: 'Market Correction', effect: -0.08, duration: 2, description: 'Markets correcting...', emoji: '⚖️', sectors: ['all'] },
    { name: 'IPO Frenzy', effect: 0.10, duration: 1, description: 'IPO excitement!', emoji: '🎉', sectors: ['all'] },
    { name: 'Scandal', effect: -0.25, duration: 1, description: 'Corporate scandal!', emoji: '😱', sectors: ['finance'] },
    { name: 'Space Race', effect: 0.30, duration: 2, description: 'Space exploration hype!', emoji: '🌟', sectors: ['aerospace'] },
    { name: 'Mining Rush', effect: 0.22, duration: 2, description: 'Resource mining boom!', emoji: '💎', sectors: ['mining'] },
    { name: 'Health Crisis', effect: 0.15, duration: 3, description: 'Healthcare demand surges!', emoji: '🏥', sectors: ['healthcare'] }
];

module.exports = { STOCKS, MARKET_EVENTS };
