const mongoose = require('mongoose');


const huntingVehicleSchema = new mongoose.Schema({
    vehicleId: String,
    name: String,
    type: {
        type: String,
        enum: ['atv', 'jeep', 'truck', 'helicopter', 'tank']
    },
    tier: { type: Number, min: 1, max: 5 },
    durability: { type: Number, min: 0, max: 100, default: 100 },
    maxDurability: { type: Number, default: 100 },
    fuelCapacity: { type: Number, default: 100 },
    currentFuel: { type: Number, default: 100 },
    capacity: { type: Number, default: 5 },
    jungleDepth: { type: Number, min: 1, max: 10 },
    purchasePrice: Number,
    maintenanceCost: { type: Number, default: 100 },
    dateAcquired: { type: Date, default: Date.now }
});


const huntingWeaponSchema = new mongoose.Schema({
    weaponId: String,
    name: String,
    type: {
        type: String,
        enum: ['bow', 'crossbow', 'rifle', 'sniper', 'tranquilizer', 'net_gun'] 
    },
    tier: { type: Number, min: 1, max: 5 },
    damage: { type: Number, min: 10, max: 500 },
    accuracy: { type: Number, min: 50, max: 100 },
    durability: { type: Number, min: 0, max: 100, default: 100 },
    maxDurability: { type: Number, default: 100 },
    ammoCapacity: { type: Number, default: 30 },
    currentAmmo: { type: Number, default: 30 },
    criticalChance: { type: Number, min: 5, max: 50, default: 10 },
    purchasePrice: Number,
    upgradeLevel: { type: Number, default: 0, max: 10 },
    dateAcquired: { type: Date, default: Date.now }
});


const huntingCompanionSchema = new mongoose.Schema({
    companionId: String,
    name: String,
    type: {
        type: String,
        enum: ['dog', 'falcon', 'tracker', 'medic', 'veteran_hunter'] 
    },
    tier: { type: Number, min: 1, max: 5 },
    health: { type: Number, min: 0, max: 100, default: 100 },
    maxHealth: { type: Number, default: 100 },
    stamina: { type: Number, min: 0, max: 100, default: 100 },
    skill: { type: Number, min: 1, max: 100, default: 50 },
    experience: { type: Number, default: 0 },
    level: { type: Number, default: 1, max: 20 },
    injured: { type: Boolean, default: false },
    injuryTime: Date,
    healingCost: { type: Number, default: 0 },
    specialAbility: String,
    purchasePrice: Number,
    dateAcquired: { type: Date, default: Date.now }
});


const huntingWarehouseSchema = new mongoose.Schema({
    warehouseId: String,
    name: String,
    type: {
        type: String,
        enum: ['basic_storage', 'cooled_storage', 'premium_vault', 'exotic_preserve', 'legendary_sanctuary'] 
    },
    tier: { type: Number, min: 1, max: 5 },
    capacity: { type: Number, default: 20 },
    preservation: { type: Number, min: 1, max: 10, default: 5 },
    bonusMultiplier: { type: Number, default: 1.0 },
    currentItems: { type: Number, default: 0 },
    maintenanceCost: { type: Number, default: 500 },
    location: String,
    purchasePrice: Number,
    dateAcquired: { type: Date, default: Date.now }
});


const huntingInventorySchema = new mongoose.Schema({
    itemId: String,
    name: String,
    type: {
        type: String,
        enum: ['animal', 'pelt', 'meat', 'trophy', 'rare_material', 'loot_box', 'artifact'] 
    },
    rarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    },
    baseValue: Number,
    currentValue: Number,
    weight: { type: Number, default: 1 },
    quantity: { type: Number, default: 1 },
    expiryDate: Date,
    location: String,
    huntDate: { type: Date, default: Date.now },
    description: String
});


const businessSchema = new mongoose.Schema({
    businessId: String,
    name: String,
    type: {
        type: String,
        enum: ['restaurant', 'tech_startup', 'real_estate', 'car_dealership', 'security_company', 'casino'] 
    },
    level: { type: Number, default: 1, max: 10 },
    employees: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    expenses: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    reputation: { type: Number, default: 50, min: 0, max: 100 },
    location: String,
    purchasePrice: Number,
    upgradeCost: Number,
    dailyIncome: { type: Number, default: 0 },
    lastCollection: Date,
    efficiency: { type: Number, default: 1.0 },
    specialBonus: { type: Number, default: 0 },
    dateAcquired: { type: Date, default: Date.now }
});


const heistSchema = new mongoose.Schema({
    heistId: String,
    plannerUserId: String,
    targetType: {
        type: String,
        enum: ['central_bank', 'casino_vault', 'mansion_safe', 'jewelry_store', 'armored_truck'] 
    },
    targetName: String,
    difficulty: { type: Number, min: 1, max: 5 },
    requiredMembers: { type: Number, min: 3, max: 6 },
    members: [{
        userId: String,
        username: String,
        role: {
            type: String,
            enum: ['mastermind', 'hacker', 'driver', 'muscle', 'lookout', 'safecracker']
        },
        confirmed: { type: Boolean, default: false },
        equipment: [String]
    }],
    plannedDate: Date,
    executionDate: Date,
    status: {
        type: String,
        enum: ['planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled'], 
        default: 'planning'
    },
    potential_payout: Number, 
    actual_payout: Number, 
    success_chance: { type: Number, default: 0 }, 
    heat_level: { type: Number, default: 0 }, 
    preparation_time: { type: Number, default: 0 }, 
    equipment_cost: { type: Number, default: 0 }, 
    createdAt: { type: Date, default: Date.now }
});

const heistCollectionSchema = new mongoose.Schema({
    heistId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    ...heistSchema.obj
});
heistCollectionSchema.index({ guildId: 1, plannerUserId: 1, status: 1 });
heistCollectionSchema.index({ guildId: 1, 'members.userId': 1, status: 1, executionDate: -1 });

const lotteryEntrySchema = new mongoose.Schema({
    ticketId: { type: String, required: true },
    roundId: { type: String, required: true },
    numbers: { type: [Number], required: true },
    purchasedAt: { type: Date, default: Date.now }
}, { _id: false });

const lotteryRoundSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    roundId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['open', 'drawing', 'completed'], default: 'open', required: true },
    startedAt: { type: Date, default: Date.now },
    drawAt: { type: Date, required: true },
    ticketCount: { type: Number, default: 0, min: 0 },
    prizePool: { type: Number, default: 0, min: 0 },
    winningNumbers: { type: [Number], default: [] },
    winnersCount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    carryover: { type: Number, default: 0, min: 0 },
    drawStartedAt: Date,
    completedAt: Date
}, { timestamps: true });
lotteryRoundSchema.index({ guildId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });
lotteryRoundSchema.index({ status: 1, drawAt: 1 });

const transactionSchema = new mongoose.Schema({
    
    referenceId: { type: String, index: false },
    type: {
        type: String,
        enum: ['income', 'expense', 'transfer', 'investment', 'trade', 'racing', 'robbery', 'family_work', 'gambling', 'shop'], 
        required: true
    },
    amount: { type: Number, required: true },
    description: String,
    category: String,
    timestamp: { type: Date, default: Date.now }
});

const carSchema = new mongoose.Schema({
    carId: String,
    name: String,
    type: {
        type: String,
        enum: ['economy', 'sports', 'luxury', 'supercar', 'hypercar']
    },
    speed: { type: Number, min: 1, max: 100 },
    acceleration: { type: Number, min: 1, max: 100 },
    handling: { type: Number, min: 1, max: 100 },
    durability: { type: Number, min: 1, max: 100, default: 100 },
    purchasePrice: Number,
    currentValue: Number,
    maintenanceCost: Number,
    raceWins: { type: Number, default: 0 },
    raceLosses: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    dateAcquired: { type: Date, default: Date.now }
});

const petSchema = new mongoose.Schema({
    petId: String,
    name: String,
    type: {
        type: String,
        enum: ['dog', 'cat', 'bird', 'security_dog', 'guard_cat'] 
    },
    breed: String,
    securityLevel: { type: Number, min: 1, max: 100 },
    happiness: { type: Number, min: 0, max: 100, default: 50 },
    health: { type: Number, min: 0, max: 100, default: 100 },
    hunger: { type: Number, min: 0, max: 100, default: 50 },
    cleanliness: { type: Number, min: 0, max: 100, default: 50 },
    lastFed: Date,
    lastGroomed: Date,
    lastPlayed: Date,
    purchasePrice: Number,
    dateAdopted: { type: Date, default: Date.now }
});

const familyMemberSchema = new mongoose.Schema({
    memberId: String,
    name: String,
    relationship: {
        type: String,
        enum: ['spouse', 'child', 'parent', 'sibling', 'grandparent']
    },
    age: Number,
    profession: String,
    salary: Number,
    bond: { type: Number, min: 0, max: 100, default: 50 },
    workEfficiency: { type: Number, min: 0.5, max: 2.0, default: 1.0 },
    lastTrip: Date,
    totalTrips: { type: Number, default: 0 }
});

const propertySchema = new mongoose.Schema({
    propertyId: String,
    name: String,
    type: {
        type: String,
        enum: ['studio', 'apartment', 'house', 'mansion', 'penthouse', 'estate']
    },
    purchasePrice: Number,
    currentValue: Number,
    monthlyRent: Number,
    utilities: Number,
    securityLevel: { type: Number, min: 1, max: 10, default: 1 },
    maxFamilyMembers: Number,
    hasGarage: { type: Boolean, default: false },
    garageCapacity: { type: Number, default: 0 },
    vaultCapacity: { type: Number, default: 0 },
    condition: {
        type: String,
        enum: ['poor', 'fair', 'good', 'excellent'],
        default: 'good'
    },
    dateAcquired: Date
});

const roleSchema = new mongoose.Schema({
    roleId: String,
    roleName: String,
    price: Number,
    benefits: {
        workMultiplier: { type: Number, default: 1.0 },
        racingBonus: { type: Number, default: 0 },
        robberyProtection: { type: Number, default: 0 },
        familyBonus: { type: Number, default: 0 }
    },
    datePurchased: { type: Date, default: Date.now },
    expiryDate: Date
});


const activeEffectSchema = new mongoose.Schema({
    effectId: String,
    name: String,
    type: { 
        type: String, 
        enum: ['gambling_luck', 'work_boost', 'robbery_protection', 'vault_boost', 'bank_boost', 'business_boost', 'xp_boost', 'fishing_boost', 'farming_boost', 'insurance']
    },
    multiplier: { type: Number, default: 1 },
    stacks: { type: Number, default: 1, max: 5 },
    startTime: { type: Date, default: Date.now },
    expiryTime: Date,
    description: String
});


const stockSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    name: String,
    shares: { type: Number, default: 0, min: 0 },
    avgBuyPrice: { type: Number, default: 0 },
    totalInvested: { type: Number, default: 0 },
    dateBought: { type: Date, default: Date.now }
});


const achievementSchema = new mongoose.Schema({
    achievementId: { type: String, required: true },
    name: String,
    description: String,
    category: { type: String, enum: ['wealth', 'gambling', 'business', 'heist', 'hunting', 'social', 'fishing', 'farming', 'crime', 'prestige'] },
    unlockedAt: { type: Date, default: Date.now },
    reward: { type: Number, default: 0 }
});


const fishSchema = new mongoose.Schema({
    fishId: String,
    name: String,
    rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] },
    weight: Number,
    value: Number,
    caughtAt: { type: Date, default: Date.now }
});


const farmPlotSchema = new mongoose.Schema({
    plotId: String,
    crop: String,
    plantedAt: Date,
    harvestAt: Date,
    lastWatered: Date,
    fertilized: { type: Boolean, default: false },
    watered: { type: Boolean, default: false },
    quality: { type: String, enum: ['withered', 'poor', 'normal', 'good', 'excellent', 'legendary', 'premium', 'golden'], default: 'normal' },
    status: { type: String, enum: ['empty', 'planted', 'growing', 'ready', 'withered'], default: 'empty' }
});


const insuranceSchema = new mongoose.Schema({
    policyId: String,
    type: { type: String, enum: ['robbery', 'property', 'vehicle', 'pet', 'business', 'full'] },
    coverage: { type: Number, default: 0 },
    premium: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    expiryDate: Date,
    claimsUsed: { type: Number, default: 0 },
    maxClaims: { type: Number, default: 3 }
});


const economySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    
    
    wallet: { type: Number, default: 1000, min: 0 },
    bank: { type: Number, default: 0, min: 0 },
    bankLimit: { type: Number, default: 10000 },
    bankInterestRate: { type: Number, default: 0.01 }, 
    lastInterestClaim: Date,
    
    
    familyVault: { type: Number, default: 0, min: 0 },
    familyMembers: [familyMemberSchema],
    familyBond: { type: Number, min: 0, max: 100, default: 0 },
    
    
    marriedTo: { type: String, default: null }, 
    marriageDate: Date,
    marriageBonus: { type: Number, default: 1.05 }, 
    
    
    cars: [carSchema],
    activeCar: String,
    
    
    pets: [petSchema],
    maxPets: { type: Number, default: 1 },
    
    
    properties: [propertySchema],
    primaryResidence: String,
    
    
    businesses: [businessSchema],
    maxBusinesses: { type: Number, default: 1 },
    businessSkill: { type: Number, default: 0, max: 100 },
    
    
    activeHeists: [String],
    completedHeists: { type: Number, default: 0 },
    failedHeists: { type: Number, default: 0 },
    heistSkill: { type: Number, default: 0, max: 100 },
    heistEquipment: [String],
    heatLevel: { type: Number, default: 0, max: 100 },
    lastHeatDecay: Date,
    jailTime: Date,
    
    
    crimeStats: {
        totalCrimes: { type: Number, default: 0 },
        successfulCrimes: { type: Number, default: 0 },
        failedCrimes: { type: Number, default: 0 },
        totalFines: { type: Number, default: 0 },
        totalStolen: { type: Number, default: 0 },
        jailBreaks: { type: Number, default: 0 },
        wantedLevel: { type: Number, default: 0, max: 5 }
    },
    
    
    huntingVehicles: [huntingVehicleSchema],
    activeVehicle: String,
    huntingWeapons: [huntingWeaponSchema],
    activeWeapon: String,
    huntingCompanions: [huntingCompanionSchema],
    activeCompanions: [String],
    maxCompanions: { type: Number, default: 2 },
    huntingWarehouses: [huntingWarehouseSchema],
    huntingInventory: [huntingInventorySchema],

    
    huntingStats: {
        totalHunts: { type: Number, default: 0 },
        successfulHunts: { type: Number, default: 0 },
        failedHunts: { type: Number, default: 0 },
        animalsKilled: { type: Number, default: 0 },
        totalDamageDealt: { type: Number, default: 0 },
        totalDamageTaken: { type: Number, default: 0 },
        deepestJungleLevel: { type: Number, default: 1 },
        rareAnimalsFound: { type: Number, default: 0 },
        lootBoxesFound: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        huntingSkill: { type: Number, default: 0, max: 100 },
        survivalSkill: { type: Number, default: 0, max: 100 }
    },

    
    huntingProfile: {
        hunterLevel: { type: Number, default: 1 },
        hunterExperience: { type: Number, default: 0 },
        reputation: { type: Number, default: 0, min: -100, max: 100 },
        currentHealth: { type: Number, default: 100, min: 0, max: 100 },
        maxHealth: { type: Number, default: 100 },
        stamina: { type: Number, default: 100, min: 0, max: 100 },
        lastHunt: Date,
        expeditionCount: { type: Number, default: 0 },
        currentLocation: { type: String, default: 'base_camp' },
        licenses: [String],
        achievements: [String]
    },
    
    
    fishingStats: {
        totalCatches: { type: Number, default: 0 },
        rareCatches: { type: Number, default: 0 },
        biggestCatch: { type: Number, default: 0 }, 
        totalEarnings: { type: Number, default: 0 },
        fishingLevel: { type: Number, default: 1, max: 50 },
        fishingXP: { type: Number, default: 0 }
    },
    fishingRod: { type: String, default: null },
    baitBox: [{ baitType: String, quantity: { type: Number, default: 0 } }],
    fishCollection: [fishSchema],
    
    
    farmPlots: [farmPlotSchema],
    lastCropWitherCheck: Date,
    lastPetDecayAt: Date,
    lastMonthlyBillPeriod: String,
    maxPlots: { type: Number, default: 2 },
    farmingStats: {
        totalHarvests: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        farmingLevel: { type: Number, default: 1, max: 50 },
        farmingXP: { type: Number, default: 0 },
        cropsGrown: { type: Number, default: 0 }
    },
    
    
    stockPortfolio: [stockSchema],
    stockStats: {
        totalTrades: { type: Number, default: 0 },
        totalProfit: { type: Number, default: 0 },
        totalLoss: { type: Number, default: 0 },
        bestTrade: { type: Number, default: 0 }
    },
    
    
    achievements: [achievementSchema],
    achievementPoints: { type: Number, default: 0 },
    
    
    insurancePolicies: [insuranceSchema],
    
    
    lotteryTickets: { type: Number, default: 0 },
    lotteryWins: { type: Number, default: 0 },
    lotteryEntries: { type: [lotteryEntrySchema], default: [] },
    
    
    prestigeLevel: { type: Number, default: 0 },
    prestigeMultiplier: { type: Number, default: 1.0 },
    totalPrestigeResets: { type: Number, default: 0 },
    lifetimeEarnings: { type: Number, default: 0 },
    
    
    purchasedRoles: [roleSchema],
    
    
    activeEffects: [activeEffectSchema],
    
    
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 },
    netWorth: { type: Number, default: 1000 }, 
    
    
    racingStats: {
        totalRaces: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 },
        winStreak: { type: Number, default: 0 }
    },
    
    
    gamblingStats: {
        totalBets: { type: Number, default: 0 },
        totalWagered: { type: Number, default: 0 },
        totalWon: { type: Number, default: 0 },
        totalLost: { type: Number, default: 0 },
        biggestWin: { type: Number, default: 0 },
        biggestLoss: { type: Number, default: 0 },
        winStreak: { type: Number, default: 0 },
        bestStreak: { type: Number, default: 0 }
    },
    
    
    lastRobbed: Date,
    lastNightlyRobberyCheck: Date,
    robberyAttempts: { type: Number, default: 0 },
    successfulRobberies: { type: Number, default: 0 },
    
    
    cooldowns: {
        daily: Date,
        weekly: Date,
        work: Date,
        race: Date,
        trip: Date,
        petCare: Date,
        robbery: Date,
        beg: Date,
        gambling: Date,
        shop: Date,
        business: Date,
        heist: Date,
        hunt: Date,
        fish: Date,
        farm: Date,
        crime: Date,
        lottery: Date,
        stocks: Date
    },
    activeGamblingSession: String,
    activeGamblingSessionExpiresAt: Date,
    
    dailyStreak: { type: Number, default: 0 },
    transactions: [transactionSchema],
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


economySchema.index({ userId: 1, guildId: 1 }, { unique: true });
economySchema.index({ guildId: 1 });
economySchema.index({ guildId: 1, 'lotteryEntries.roundId': 1 });


economySchema.pre('save', function() {
    this.updatedAt = Date.now();
    
    
    this.activeEffects = this.activeEffects.filter(effect =>
        !effect.expiryTime || new Date(effect.expiryTime) > new Date()
    );
    
    
    if (this.insurancePolicies) {
        this.insurancePolicies = this.insurancePolicies.filter(policy =>
            new Date(policy.expiryDate) > new Date()
        );
    }
    
    
    let nw = (this.wallet || 0) + (this.bank || 0) + (this.familyVault || 0);
    if (this.properties) this.properties.forEach(p => nw += p.currentValue || p.purchasePrice || 0);
    if (this.cars) this.cars.forEach(c => nw += c.currentValue || c.purchasePrice || 0);
    if (this.businesses) this.businesses.forEach(b => nw += b.purchasePrice || 0);
    if (this.stockPortfolio) this.stockPortfolio.forEach(s => nw += (s.shares * s.avgBuyPrice) || 0);
    this.netWorth = Math.max(0, nw);

    const baseline = this.$locals?.economyBalanceBaseline;
    if (baseline && (this.isModified('wallet') || this.isModified('bank'))) {
        const before = (baseline.wallet || 0) + (baseline.bank || 0);
        const after = (this.wallet || 0) + (this.bank || 0);
        const earned = after - before;
        if (earned > 0) this.lifetimeEarnings = (this.lifetimeEarnings || 0) + earned;
    }
});

economySchema.post('save', function() {
    this.$locals.economyBalanceBaseline = {
        wallet: this.wallet || 0,
        bank: this.bank || 0
    };
});

module.exports = {
    Economy: mongoose.model('Economy', economySchema),
    Heist: mongoose.model('Heist', heistCollectionSchema),
    LotteryRound: mongoose.model('LotteryRound', lotteryRoundSchema)
};
