const CARS = {
    'economy_sedan': {
        name: 'Economy Sedan',
        type: 'economy',
        price: 15000,
        speed: 45,
        acceleration: 40,
        handling: 50,
        maintenanceCost: 200
    },
    'sports_coupe': {
        name: 'Sports Coupe',
        type: 'sports',
        price: 45000,
        speed: 70,
        acceleration: 75,
        handling: 65,
        maintenanceCost: 600
    },
    'luxury_sedan': {
        name: 'Luxury Sedan',
        type: 'luxury',
        price: 80000,
        speed: 60,
        acceleration: 55,
        handling: 80,
        maintenanceCost: 1000
    },
    'supercar': {
        name: 'Supercar',
        type: 'supercar',
        price: 200000,
        speed: 95,
        acceleration: 90,
        handling: 85,
        maintenanceCost: 2500
    },
    'hypercar': {
        name: 'Hypercar',
        type: 'hypercar',
        price: 500000,
        speed: 100,
        acceleration: 100,
        handling: 95,
        maintenanceCost: 5000
    }
};

const PETS = {
    'house_cat': {
        name: 'House Cat',
        type: 'cat',
        price: 500,
        securityLevel: 10,
        breed: 'Domestic'
    },
    'guard_dog': {
        name: 'Guard Dog',
        type: 'security_dog',
        price: 2000,
        securityLevel: 40,
        breed: 'German Shepherd'
    },
    'security_cat': {
        name: 'Security Cat',
        type: 'guard_cat',
        price: 1500,
        securityLevel: 25,
        breed: 'Maine Coon'
    },
    'attack_dog': {
        name: 'Attack Dog',
        type: 'security_dog',
        price: 5000,
        securityLevel: 70,
        breed: 'Rottweiler'
    },
    'surveillance_bird': {
        name: 'Surveillance Parrot',
        type: 'bird',
        price: 3000,
        securityLevel: 35,
        breed: 'Macaw'
    }
};

const PROPERTIES = {
    'studio': {
        name: 'Studio Apartment',
        type: 'studio',
        price: 50000,
        monthlyRent: 800,
        utilities: 150,
        maxFamilyMembers: 1,
        securityLevel: 1,
        vaultCapacity: 10000,
        hasGarage: false,
        garageCapacity: 0
    },
    'apartment': {
        name: '2BR Apartment',
        type: 'apartment',
        price: 120000,
        monthlyRent: 1500,
        utilities: 250,
        maxFamilyMembers: 3,
        securityLevel: 2,
        vaultCapacity: 25000,
        hasGarage: true,
        garageCapacity: 1
    },
    'house': {
        name: 'Family House',
        type: 'house',
        price: 300000,
        monthlyRent: 2500,
        utilities: 400,
        maxFamilyMembers: 5,
        securityLevel: 4,
        vaultCapacity: 75000,
        hasGarage: true,
        garageCapacity: 2
    },
    'mansion': {
        name: 'Luxury Mansion',
        type: 'mansion',
        price: 800000,
        monthlyRent: 5000,
        utilities: 800,
        maxFamilyMembers: 8,
        securityLevel: 7,
        vaultCapacity: 200000,
        hasGarage: true,
        garageCapacity: 5
    },
    'estate': {
        name: 'Private Estate',
        type: 'estate',
        price: 2000000,
        monthlyRent: 10000,
        utilities: 1500,
        maxFamilyMembers: 12,
        securityLevel: 10,
        vaultCapacity: 500000,
        hasGarage: true,
        garageCapacity: 10
    }
};

const ROLES = {
    'vip': {
        name: 'VIP Member',
        price: 50000,
        duration: 30,
        benefits: {
            workMultiplier: 1.5,
            racingBonus: 1000,
            robberyProtection: 20,
            familyBonus: 0.2
        }
    },
    'premium': {
        name: 'Premium Member',
        price: 100000,
        duration: 30,
        benefits: {
            workMultiplier: 2.0,
            racingBonus: 2500,
            robberyProtection: 40,
            familyBonus: 0.5
        }
    },
    'diamond': {
        name: 'Diamond Elite',
        price: 250000,
        duration: 30,
        benefits: {
            workMultiplier: 3.0,
            racingBonus: 5000,
            robberyProtection: 60,
            familyBonus: 1.0
        }
    }
};


const SHOP_ITEMS = {
    'pet_food': {
        name: 'Premium Pet Food',
        price: 200,
        description: 'Instantly restores 40 hunger and 10 health to all pets',
        category: 'pet_care',
        cooldown: 0
    },
    'car_repair': {
        name: 'Car Repair Kit',
        price: 1500,
        description: 'Restores 30 durability to your active car',
        category: 'vehicle',
        cooldown: 0
    },
    'security_upgrade': {
        name: 'Home Security System',
        price: 5000,
        description: 'Permanently increases your property security by 2 levels',
        category: 'security',
        cooldown: 0
    },
    'family_vacation': {
        name: 'Family Vacation Package',
        price: 3000,
        description: 'Increases all family member bonds by 15%',
        category: 'family',
        cooldown: 0
    },
    'lucky_charm': {
        name: 'Lucky Charm',
        price: 10000,
        description: 'Increases work earnings by 50% for 7 days',
        category: 'boost',
        cooldown: 0,
        effect: {
            type: 'work_boost',
            multiplier: 1.5,
            duration: 7 * 24 * 60 * 60 * 1000 
        }
    },
    
    'gambling_luck': {
        name: 'Rabbit\'s Foot',
        price: 5000,
        description: 'Increases gambling luck by 20% for 4 hours (stacks up to 5 times)',
        category: 'boost',
        cooldown: 0,
        effect: {
            type: 'gambling_luck',
            multiplier: 1.2,
            duration: 4 * 60 * 60 * 1000, 
            stackable: true
        }
    },
    'robbery_protection': {
        name: 'Security Guard',
        price: 15000,
        description: 'Provides +30% robbery protection for 24 hours',
        category: 'security',
        cooldown: 0,
        effect: {
            type: 'robbery_protection',
            multiplier: 30,
            duration: 24 * 60 * 60 * 1000 
        }
    },
    'vault_expansion': {
        name: 'Vault Expansion Kit',
        price: 25000,
        description: 'Doubles your vault capacity for 72 hours (resets on new property)',
        category: 'storage',
        cooldown: 0,
        effect: {
            type: 'vault_boost',
            multiplier: 2.0,
            duration: 72 * 60 * 60 * 1000 
        }
    },
    'bank_upgrade': {
        name: 'Premium Banking',
        price: 30000,
        description: 'Increases bank deposit limit by 50% for 48 hours',
        category: 'storage',
        cooldown: 0,
        effect: {
            type: 'bank_boost',
            multiplier: 1.5,
            duration: 48 * 60 * 60 * 1000 
        }
    },
    
    'business_boost_small': {
        name: 'Business Ad Campaign',
        price: 15000,
        description: 'Increases all business income by 25% for 24 hours',
        category: 'boost',
        cooldown: 0,
        effect: {
            type: 'business_boost',
            multiplier: 1.25,
            duration: 24 * 60 * 60 * 1000 
        }
    },
    'business_boost_medium': {
        name: 'Market Expansion',
        price: 35000,
        description: 'Increases all business income by 50% for 48 hours',
        category: 'boost',
        cooldown: 0,
        effect: {
            type: 'business_boost',
            multiplier: 1.5,
            duration: 48 * 60 * 60 * 1000 
        }
    },
    'business_boost_large': {
        name: 'Economic Boom',
        price: 75000,
        description: 'Increases all business income by 100% for 72 hours',
        category: 'boost',
        cooldown: 0,
        effect: {
            type: 'business_boost',
            multiplier: 2.0,
            duration: 72 * 60 * 60 * 1000 
        }
    }
};

const FAMILY_TYPES = {
    spouse: {
        id: 'spouse',
        type: 'spouse',
        salaryRange: [300, 800],
        minAge: 20,
        maxAge: 50,
        emoji: '💍'
    },
    child: {
        id: 'child',
        type: 'child',
        salaryRange: [50, 200],
        minAge: 5,
        maxAge: 20,
        emoji: '👶'
    },
    parent: {
        id: 'parent',
        type: 'parent',
        salaryRange: [400, 900],
        minAge: 45,
        maxAge: 65,
        emoji: '👵'
    },
    sibling: {
        id: 'sibling',
        type: 'sibling',
        salaryRange: [250, 600],
        minAge: 20,
        maxAge: 50,
        emoji: '🤝'
    }
};

module.exports = { CARS, PETS, PROPERTIES, ROLES, SHOP_ITEMS, FAMILY_TYPES };
