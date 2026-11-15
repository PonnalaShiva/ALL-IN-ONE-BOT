const HUNTING_ANIMALS = {
    
    rabbit: {
        name: 'Wild Rabbit',
        tier: 1,
        health: 25,
        damage: 5,
        agility: 80,
        baseValue: 50,
        rarity: 'common',
        requiredJungleDepth: 1,
        
        ammoConsumption: { min: 1, max: 2 }, 
        fuelConsumption: 5, 
        lootTable: {
            meat: { chance: 90, value: 25 },
            pelt: { chance: 60, value: 35 },
            loot_box: { chance: 5, value: 100 }
        }
    },
    deer: {
        name: 'Forest Deer',
        tier: 1,
        health: 60,
        damage: 15,
        agility: 70,
        baseValue: 150,
        rarity: 'common',
        requiredJungleDepth: 1,
        ammoConsumption: { min: 2, max: 4 }, 
        fuelConsumption: 8,
        lootTable: {
            meat: { chance: 95, value: 75 },
            pelt: { chance: 80, value: 100 },
            trophy: { chance: 20, value: 200 }
        }
    },
    wild_boar: {
        name: 'Wild Boar',
        tier: 2,
        health: 120,
        damage: 35,
        agility: 50,
        baseValue: 300,
        rarity: 'uncommon',
        requiredJungleDepth: 2,
        ammoConsumption: { min: 3, max: 6 }, 
        fuelConsumption: 12,
        lootTable: {
            meat: { chance: 90, value: 150 },
            pelt: { chance: 70, value: 120 },
            trophy: { chance: 30, value: 250 }
        }
    },
    black_bear: {
        name: 'Black Bear',
        tier: 3,
        health: 250,
        damage: 60,
        agility: 40,
        baseValue: 800,
        rarity: 'rare',
        requiredJungleDepth: 3,
        ammoConsumption: { min: 5, max: 10 }, 
        fuelConsumption: 18,
        lootTable: {
            meat: { chance: 85, value: 300 },
            pelt: { chance: 90, value: 400 },
            trophy: { chance: 50, value: 600 },
            rare_material: { chance: 15, value: 1000 }
        }
    },
    mountain_lion: {
        name: 'Mountain Lion',
        tier: 4,
        health: 180,
        damage: 85,
        agility: 90,
        baseValue: 1200,
        rarity: 'rare',
        requiredJungleDepth: 4,
        ammoConsumption: { min: 4, max: 8 }, 
        fuelConsumption: 22,
        lootTable: {
            meat: { chance: 80, value: 250 },
            pelt: { chance: 95, value: 800 },
            trophy: { chance: 60, value: 1000 },
            rare_material: { chance: 25, value: 1500 }
        }
    },
    grizzly_bear: {
        name: 'Grizzly Bear',
        tier: 5,
        health: 400,
        damage: 120,
        agility: 35,
        baseValue: 2500,
        rarity: 'epic',
        requiredJungleDepth: 6,
        ammoConsumption: { min: 8, max: 15 }, 
        fuelConsumption: 35,
        lootTable: {
            meat: { chance: 90, value: 800 },
            pelt: { chance: 95, value: 1500 },
            trophy: { chance: 80, value: 2000 },
            rare_material: { chance: 40, value: 3000 }
        }
    },
    white_tiger: {
        name: 'White Tiger',
        tier: 6,
        health: 320,
        damage: 150,
        agility: 85,
        baseValue: 5000,
        rarity: 'legendary',
        requiredJungleDepth: 7,
        ammoConsumption: { min: 10, max: 20 }, 
        fuelConsumption: 45,
        lootTable: {
            meat: { chance: 70, value: 1000 },
            pelt: { chance: 100, value: 4000 },
            trophy: { chance: 90, value: 5000 },
            rare_material: { chance: 60, value: 6000 },
            artifact: { chance: 10, value: 15000 }
        }
    },
    ancient_dragon: {
        name: 'Ancient Forest Dragon',
        tier: 10,
        health: 1000,
        damage: 300,
        agility: 60,
        baseValue: 50000,
        rarity: 'mythic',
        requiredJungleDepth: 10,
        ammoConsumption: { min: 20, max: 40 }, 
        fuelConsumption: 75,
        lootTable: {
            meat: { chance: 100, value: 10000 },
            pelt: { chance: 100, value: 25000 },
            trophy: { chance: 100, value: 40000 },
            rare_material: { chance: 100, value: 30000 },
            artifact: { chance: 50, value: 100000 }
        }
    }
};


const FUEL_TYPES = {
    regular_fuel: {
        name: 'Regular Fuel',
        type: 'regular',
        efficiency: 1.0, 
        price: 10, 
        description: 'Standard fuel for basic expeditions',
        fuelValue: 10 
    },
    premium_fuel: {
        name: 'Premium Fuel',
        type: 'premium', 
        efficiency: 0.8, 
        price: 18,
        description: 'High-quality fuel for longer expeditions',
        fuelValue: 15
    },
    high_octane_fuel: {
        name: 'High-Octane Racing Fuel',
        type: 'racing',
        efficiency: 0.6, 
        price: 35,
        description: 'Premium racing fuel for extreme expeditions',
        fuelValue: 20
    },
    eco_fuel: {
        name: 'Eco-Friendly Fuel',
        type: 'eco',
        efficiency: 1.2, 
        price: 7,
        description: 'Environmentally friendly but less efficient',
        fuelValue: 8
    }
};


const AMMO_TYPES = {
    
    basic_arrows: {
        name: 'Basic Arrows',
        compatibleWeapons: ['bow'],
        damage: 1.0, 
        accuracy: 1.0, 
        price: 5, 
        description: 'Standard wooden arrows',
        ammoValue: 20 
    },
    steel_arrows: {
        name: 'Steel-Tip Arrows',
        compatibleWeapons: ['bow'],
        damage: 1.3,
        accuracy: 1.1,
        price: 12,
        description: 'Sharp steel-tipped arrows for better penetration',
        ammoValue: 15
    },
    
    
    crossbow_bolts: {
        name: 'Crossbow Bolts',
        compatibleWeapons: ['crossbow'],
        damage: 1.0,
        accuracy: 1.0,
        price: 8,
        description: 'Standard crossbow bolts',
        ammoValue: 15
    },
    armor_piercing_bolts: {
        name: 'Armor-Piercing Bolts',
        compatibleWeapons: ['crossbow'],
        damage: 1.5,
        accuracy: 1.2,
        price: 20,
        description: 'Heavy bolts designed to pierce thick hide',
        ammoValue: 12
    },
    
    
    hunting_rounds: {
        name: 'Hunting Rifle Rounds',
        compatibleWeapons: ['rifle'],
        damage: 1.0,
        accuracy: 1.0,
        price: 15,
        description: 'Standard hunting ammunition',
        ammoValue: 30
    },
    hollow_point_rounds: {
        name: 'Hollow Point Rounds',
        compatibleWeapons: ['rifle'],
        damage: 1.4,
        accuracy: 0.9,
        price: 25,
        description: 'Expanding bullets for maximum damage',
        ammoValue: 25
    },
    
    
    sniper_rounds: {
        name: 'Precision Sniper Rounds',
        compatibleWeapons: ['sniper'],
        damage: 1.0,
        accuracy: 1.0,
        price: 50,
        description: 'High-precision long-range ammunition',
        ammoValue: 10
    },
    armor_piercing_sniper: {
        name: 'Armor-Piercing Sniper Rounds',
        compatibleWeapons: ['sniper'],
        damage: 1.6,
        accuracy: 1.3,
        price: 85,
        description: 'Military-grade armor-piercing rounds',
        ammoValue: 8
    },
    
    
    tranq_darts: {
        name: 'Tranquilizer Darts',
        compatibleWeapons: ['tranquilizer'],
        damage: 0.1, 
        accuracy: 1.0,
        price: 30,
        description: 'Non-lethal capture darts',
        ammoValue: 15,
        special: 'capture' 
    },
    
    
    capture_nets: {
        name: 'Reinforced Capture Nets',
        compatibleWeapons: ['net_gun'],
        damage: 0.0, 
        accuracy: 0.8,
        price: 45,
        description: 'Strong nets for capturing animals alive',
        ammoValue: 10,
        special: 'capture'
    }
};


const MAINTENANCE_SUPPLIES = {
    repair_kit: {
        name: 'Equipment Repair Kit',
        type: 'repair',
        price: 150,
        description: 'Repairs vehicle and weapon durability',
        repairAmount: 25, 
        uses: 5 
    },
    weapon_oil: {
        name: 'Weapon Maintenance Oil',
        type: 'weapon_maintenance',
        price: 75,
        description: 'Prevents weapon degradation for 5 hunts',
        effect: 'durability_protection',
        duration: 5 
    },
    vehicle_parts: {
        name: 'Vehicle Spare Parts',
        type: 'vehicle_maintenance',
        price: 200,
        description: 'Emergency vehicle repairs in the field',
        repairAmount: 40,
        uses: 3
    }
};


const HUNTING_VEHICLES = {
    basic_atv: {
        name: 'Basic ATV',
        type: 'atv',
        tier: 1,
        maxDurability: 100,
        fuelCapacity: 50,
        capacity: 3,
        jungleDepth: 2,
        price: 5000,
        maintenanceCost: 100,
        description: 'A reliable all-terrain vehicle for basic hunting expeditions'
    },
    hunter_jeep: {
        name: 'Hunter Jeep',
        type: 'jeep',
        tier: 2,
        maxDurability: 150,
        fuelCapacity: 80,
        capacity: 5,
        jungleDepth: 4,
        price: 15000,
        maintenanceCost: 200,
        description: 'Rugged jeep designed for deeper jungle exploration'
    },
    expedition_truck: {
        name: 'Expedition Truck',
        type: 'truck',
        tier: 3,
        maxDurability: 200,
        fuelCapacity: 120,
        capacity: 8,
        jungleDepth: 6,
        price: 40000,
        maintenanceCost: 400,
        description: 'Heavy-duty truck for serious hunting expeditions'
    },
    stealth_helicopter: {
        name: 'Stealth Helicopter',
        type: 'helicopter',
        tier: 4,
        maxDurability: 180,
        fuelCapacity: 200,
        capacity: 6,
        jungleDepth: 8,
        price: 100000,
        maintenanceCost: 1000,
        description: 'Advanced helicopter for accessing remote hunting grounds'
    },
    armored_tank: {
        name: 'Armored Tank',
        type: 'tank',
        tier: 5,
        maxDurability: 300,
        fuelCapacity: 150,
        capacity: 10,
        jungleDepth: 10,
        price: 250000,
        maintenanceCost: 2000,
        description: 'Ultimate hunting vehicle for the most dangerous expeditions'
    }
};

const HUNTING_WEAPONS = {
    hunting_bow: {
        name: 'Hunting Bow',
        type: 'bow',
        tier: 1,
        damage: 50,
        accuracy: 70,
        maxDurability: 100,
        ammoCapacity: 20,
        criticalChance: 15,
        price: 800,
        description: 'Traditional bow for silent hunting'
    },
    crossbow: {
        name: 'Military Crossbow',
        type: 'crossbow',
        tier: 2,
        damage: 80,
        accuracy: 85,
        maxDurability: 120,
        ammoCapacity: 15,
        criticalChance: 20,
        price: 2500,
        description: 'Powerful crossbow with enhanced precision'
    },
    hunting_rifle: {
        name: 'Hunting Rifle',
        type: 'rifle',
        tier: 3,
        damage: 150,
        accuracy: 90,
        maxDurability: 150,
        ammoCapacity: 10,
        criticalChance: 25,
        price: 8000,
        description: 'High-powered rifle for medium game'
    },
    sniper_rifle: {
        name: 'Sniper Rifle',
        type: 'sniper',
        tier: 4,
        damage: 250,
        accuracy: 95,
        maxDurability: 180,
        ammoCapacity: 5,
        criticalChance: 40,
        price: 25000,
        description: 'Long-range precision weapon for big game'
    },
    dragon_slayer: {
        name: 'Dragon Slayer Cannon',
        type: 'cannon',
        tier: 5,
        damage: 500,
        accuracy: 85,
        maxDurability: 200,
        ammoCapacity: 3,
        criticalChance: 50,
        price: 100000,
        description: 'Legendary weapon capable of taking down mythical beasts'
    }
};

const HUNTING_COMPANIONS = {
    hunting_dog: {
        name: 'Hunting Dog',
        type: 'dog',
        tier: 1,
        maxHealth: 80,
        skill: 40,
        specialAbility: 'tracking',
        price: 2000,
        description: 'Loyal companion that helps track animals'
    },
    falcon: {
        name: 'Hunting Falcon',
        type: 'falcon',
        tier: 2,
        maxHealth: 60,
        skill: 60,
        specialAbility: 'aerial_scout',
        price: 5000,
        description: 'Sharp-eyed bird that scouts ahead'
    },
    expert_tracker: {
        name: 'Expert Tracker',
        type: 'tracker',
        tier: 3,
        maxHealth: 120,
        skill: 80,
        specialAbility: 'rare_animal_detection',
        price: 15000,
        description: 'Experienced tracker who finds rare animals'
    },
    field_medic: {
        name: 'Field Medic',
        type: 'medic',
        tier: 4,
        maxHealth: 100,
        skill: 70,
        specialAbility: 'healing',
        price: 20000,
        description: 'Medical expert who heals injuries during hunts'
    },
    veteran_hunter: {
        name: 'Veteran Hunter',
        type: 'veteran_hunter',
        tier: 5,
        maxHealth: 150,
        skill: 95,
        specialAbility: 'damage_boost',
        price: 50000,
        description: 'Legendary hunter with decades of experience'
    }
};

const HUNTING_WAREHOUSES = {
    basic_storage: {
        name: 'Basic Storage Shed',
        type: 'basic_storage',
        tier: 1,
        capacity: 20,
        preservation: 3, 
        bonusMultiplier: 1.0,
        price: 10000,
        maintenanceCost: 200,
        description: 'Simple shed for storing hunting loot'
    },
    cooled_storage: {
        name: 'Refrigerated Warehouse',
        type: 'cooled_storage',
        tier: 2,
        capacity: 50,
        preservation: 7,
        bonusMultiplier: 1.1,
        price: 30000,
        maintenanceCost: 500,
        description: 'Climate-controlled storage for better preservation'
    },
    premium_vault: {
        name: 'Premium Vault',
        type: 'premium_vault',
        tier: 3,
        capacity: 100,
        preservation: 14,
        bonusMultiplier: 1.25,
        price: 75000,
        maintenanceCost: 1000,
        description: 'High-security vault with extended preservation'
    },
    exotic_preserve: {
        name: 'Exotic Preserve',
        type: 'exotic_preserve',
        tier: 4,
        capacity: 200,
        preservation: 30,
        bonusMultiplier: 1.5,
        price: 150000,
        maintenanceCost: 2000,
        description: 'Specialized facility for exotic specimens'
    },
    legendary_sanctuary: {
        name: 'Legendary Sanctuary',
        type: 'legendary_sanctuary',
        tier: 5,
        capacity: 500,
        preservation: 60,
        bonusMultiplier: 2.0,
        price: 500000,
        maintenanceCost: 5000,
        description: 'Ultimate storage facility for mythical creatures'
    }
};

const LOOT_BOXES = {
    basic_crate: {
        name: 'Basic Supply Crate',
        rarity: 'common',
        contents: {
            money: { min: 100, max: 500, chance: 80 },
            ammo: { min: 5, max: 20, chance: 60 },
            medical_kit: { chance: 30, value: 200 },
            weapon_upgrade: { chance: 10, value: 1000 }
        }
    },
    rare_chest: {
        name: 'Rare Treasure Chest',
        rarity: 'rare',
        contents: {
            money: { min: 1000, max: 5000, chance: 90 },
            rare_ammo: { min: 10, max: 30, chance: 70 },
            companion_heal: { chance: 50, value: 500 },
            weapon_upgrade: { chance: 30, value: 2500 },
            vehicle_fuel: { chance: 40, value: 300 }
        }
    },
    legendary_vault: {
        name: 'Legendary Vault',
        rarity: 'legendary',
        contents: {
            money: { min: 10000, max: 50000, chance: 100 },
            premium_ammo: { min: 20, max: 50, chance: 80 },
            legendary_material: { chance: 60, value: 15000 },
            weapon_blueprint: { chance: 25, value: 25000 },
            companion_upgrade: { chance: 40, value: 10000 }
        }
    }
};

module.exports = {
    HUNTING_ANIMALS,
    HUNTING_VEHICLES,
    HUNTING_WEAPONS,
    HUNTING_COMPANIONS,
    HUNTING_WAREHOUSES,
    LOOT_BOXES
};
