
const BUSINESS_TYPES = {
    'restaurant': {
        name: 'Restaurant Chain',
        description: 'Serve customers and earn daily profits',
        baseCost: 50000,
        dailyIncome: [200, 800], 
        maxLevel: 10,
        employeeCost: 150, 
        maxEmployees: 20,
        upgradeCostMultiplier: 1.5,
        categories: ['food_quality', 'service', 'location', 'marketing'],
        specialBonuses: {
            family_discount: 'Family members eat free (saves $50/day per member)',
            celebrity_chef: 'Hire famous chef (+50% income for 30 days)',
            franchise: 'Expand to multiple locations (+25% base income)'
        }
    },
    'tech_startup': {
        name: 'Tech Startup',
        description: 'Develop apps and software for high profits',
        baseCost: 100000,
        dailyIncome: [100, 1500], 
        maxLevel: 10,
        employeeCost: 300, 
        maxEmployees: 15,
        upgradeCostMultiplier: 2.0,
        categories: ['innovation', 'marketing', 'user_base', 'funding'],
        specialBonuses: {
            ipo: 'Go public (1000x daily income for 7 days, then +100% forever)',
            viral_app: 'Create viral app (+200% income for 14 days)',
            government_contract: 'Secure government deal (+75% income, very stable)'
        }
    },
    'real_estate': {
        name: 'Real Estate Agency',
        description: 'Earn commissions from property sales',
        baseCost: 75000,
        dailyIncome: [300, 600], 
        maxLevel: 10,
        employeeCost: 200,
        maxEmployees: 12,
        upgradeCostMultiplier: 1.3,
        categories: ['market_knowledge', 'network', 'reputation', 'listings'],
        specialBonuses: {
            luxury_specialist: 'Specialize in luxury properties (+100% income)',
            market_insider: 'Get insider info (predict market trends)',
            property_flip: 'Buy and flip properties (massive profit events)'
        }
    },
    'car_dealership': {
        name: 'Car Dealership',
        description: 'Sell cars to players and NPCs',
        baseCost: 200000,
        dailyIncome: [400, 1000],
        maxLevel: 10,
        employeeCost: 250,
        maxEmployees: 10,
        upgradeCostMultiplier: 1.4,
        categories: ['inventory', 'sales_team', 'service_center', 'reputation'],
        specialBonuses: {
            exotic_cars: 'Sell hypercars (+150% profit margins)',
            racing_team: 'Sponsor racing team (marketing boost)',
            trade_ins: 'Accept player car trade-ins (extra revenue stream)'
        }
    },
    'security_company': {
        name: 'Security Company',
        description: 'Provide protection services to players',
        baseCost: 150000,
        dailyIncome: [250, 700],
        maxLevel: 10,
        employeeCost: 280,
        maxEmployees: 25,
        upgradeCostMultiplier: 1.6,
        categories: ['equipment', 'training', 'contracts', 'reputation'],
        specialBonuses: {
            government_contract: 'Protect government buildings (+200% income)',
            private_military: 'Become PMC (can participate in heists)',
            insurance_partner: 'Partner with insurance companies (+50% steady income)'
        }
    },
    'casino': {
        name: 'Private Casino',
        description: 'Ultimate high-risk, high-reward business',
        baseCost: 500000,
        dailyIncome: [0, 3000], 
        maxLevel: 10,
        employeeCost: 400,
        maxEmployees: 30,
        upgradeCostMultiplier: 1.8,
        categories: ['games', 'security', 'vip_services', 'entertainment'],
        specialBonuses: {
            high_roller_suite: 'Attract whales (+300% income spikes)',
            tournament_host: 'Host poker tournaments (huge profit events)',
            money_laundering: 'Illegal but profitable (+100% income, +50% heat)'
        }
    }
};

const HEIST_TARGETS = {
    'central_bank': {
        name: 'Central Bank',
        difficulty: 5,
        requiredMembers: 4,
        minHeatLevel: 80,
        payout: [2000000, 5000000],
        successChance: 15,
        planningTime: 72, 
        requiredRoles: ['mastermind', 'hacker', 'safecracker', 'driver', 'muscle', 'lookout'],
        equipment: ['thermal_lance', 'emp_device', 'getaway_cars', 'explosives', 'hacking_tools'],
        description: 'The ultimate heist - Fort Knox level security'
    },
    'casino_vault': {
        name: 'Casino Vault',
        difficulty: 4,
        requiredMembers: 4,
        minHeatLevel: 60,
        payout: [800000, 2000000],
        successChance: 25,
        planningTime: 48,
        requiredRoles: ['mastermind', 'hacker', 'safecracker', 'driver', 'muscle'],
        equipment: ['keycard_cloner', 'getaway_cars', 'masks', 'weapons'],
        description: 'Ocean\'s Eleven style casino heist'
    },
    'mansion_safe': {
        name: 'Billionaire Mansion',
        difficulty: 3,
        requiredMembers: 4,
        minHeatLevel: 40,
        payout: [300000, 800000],
        successChance: 40,
        planningTime: 24,
        requiredRoles: ['mastermind', 'hacker', 'driver', 'muscle'],
        equipment: ['lock_picks', 'getaway_cars', 'masks'],
        description: 'Rob a wealthy player\'s mansion'
    },
    'jewelry_store': {
        name: 'Diamond Exchange',
        difficulty: 2,
        requiredMembers: 3,
        minHeatLevel: 20,
        payout: [100000, 400000],
        successChance: 60,
        planningTime: 12,
        requiredRoles: ['mastermind', 'driver', 'muscle'],
        equipment: ['glass_cutter', 'getaway_cars', 'masks'],
        description: 'Quick smash and grab operation'
    },
    'armored_truck': {
        name: 'Armored Vehicle',
        difficulty: 1,
        requiredMembers: 3,
        minHeatLevel: 0,
        payout: [50000, 150000],
        successChance: 75,
        planningTime: 6,
        requiredRoles: ['mastermind', 'driver', 'muscle'],
        equipment: ['weapons', 'getaway_cars'],
        description: 'Intercept money transport'
    }
};

const HEIST_EQUIPMENT = {
    'thermal_lance': { name: 'Thermal Lance', cost: 50000, description: 'Cuts through vault doors' },
    'emp_device': { name: 'EMP Device', cost: 75000, description: 'Disables electronic security' },
    'hacking_tools': { name: 'Hacking Equipment', cost: 25000, description: 'Bypass computer systems' },
    'explosives': { name: 'C4 Explosives', cost: 40000, description: 'Blast through obstacles' },
    'getaway_cars': { name: 'Getaway Vehicles', cost: 30000, description: 'Fast escape vehicles' },
    'keycard_cloner': { name: 'Keycard Cloner', cost: 15000, description: 'Copy access cards' },
    'lock_picks': { name: 'Lock Pick Set', cost: 5000, description: 'Silent entry tools' },
    'glass_cutter': { name: 'Glass Cutter', cost: 3000, description: 'Cut display cases' },
    'masks': { name: 'Disguise Masks', cost: 2000, description: 'Hide identities' },
    'weapons': { name: 'Weapons Cache', cost: 20000, description: 'Intimidation and protection' }
};

module.exports = { BUSINESS_TYPES, HEIST_TARGETS, HEIST_EQUIPMENT };
