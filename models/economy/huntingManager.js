const { EconomyManager } = require('./economy');
const { 
    HUNTING_ANIMALS, 
    HUNTING_VEHICLES, 
    HUNTING_WEAPONS, 
    HUNTING_COMPANIONS, 
    HUNTING_WAREHOUSES,
    LOOT_BOXES,
    FUEL_TYPES,
    AMMO_TYPES,
    MAINTENANCE_SUPPLIES
} = require('./constants/huntingData');

class HuntingManager {
    
    static generateRandomAnimal(jungleDepth, huntingSkill = 0) {
        const availableAnimals = Object.entries(HUNTING_ANIMALS).filter(([key, animal]) => 
            animal.requiredJungleDepth <= jungleDepth
        );

        if (availableAnimals.length === 0) {
            return HUNTING_ANIMALS.rabbit;
        }

        
        const skillBonus = huntingSkill * 0.01;
        const rarityWeights = {
            common: 50 - (skillBonus * 10),
            uncommon: 30,
            rare: 15 + (skillBonus * 5),
            epic: 4 + (skillBonus * 3),
            legendary: 1 + (skillBonus * 2),
            mythic: 0.1 + skillBonus
        };

        const totalWeight = Object.values(rarityWeights).reduce((sum, weight) => sum + Math.max(0, weight), 0);
        let random = Math.random() * totalWeight;

        for (const [key, animal] of availableAnimals) {
            const weight = rarityWeights[animal.rarity] || 1;
            random -= Math.max(0, weight);
            if (random <= 0) {
                return { key, ...animal };
            }
        }

        return { key: availableAnimals[0][0], ...availableAnimals[0][1] };
    }

    
    static calculateDamage(weapon, companions, criticalHit = false) {
        let baseDamage = weapon.damage;
        
        const upgradeBonus = weapon.upgradeLevel * 0.1;
        baseDamage *= (1 + upgradeBonus);

        companions.forEach(companion => {
            if (companion.specialAbility === 'damage_boost' && companion.health > 50) {
                baseDamage *= 1.2;
            }
        });

        if (criticalHit) {
            baseDamage *= 2;
        }

        const variance = 0.8 + (Math.random() * 0.4);
        return Math.floor(baseDamage * variance);
    }

    
    static calculateFuelConsumption(vehicle, animal, jungleDepth) {
        let baseFuelCost = animal.fuelConsumption || 10;
        
        const vehicleEfficiency = {
            'atv': 1.2,
            'jeep': 1.0,
            'truck': 1.5,
            'helicopter': 2.0,
            'tank': 2.5
        };
        
        const depthMultiplier = 1 + (jungleDepth * 0.3);
        
        const finalFuelCost = Math.ceil(
            baseFuelCost * 
            (vehicleEfficiency[vehicle.type] || 1.0) * 
            depthMultiplier
        );
        
        return Math.max(5, finalFuelCost);
    }
    
    
    static calculateAmmoConsumption(weapon, animal, huntResult) {
        const baseAmmoRange = animal.ammoConsumption || { min: 1, max: 3 };
        
        let ammoUsed = Math.floor(Math.random() * (baseAmmoRange.max - baseAmmoRange.min + 1)) + baseAmmoRange.min;
        
        const weaponEfficiency = {
            'bow': 1.0,
            'crossbow': 0.8,
            'rifle': 0.6,
            'sniper': 0.4,
            'tranquilizer': 1.2,
            'net_gun': 1.5
        };
        
        const agilityFactor = 1 + (animal.agility / 200);
        const successFactor = huntResult.success ? 1.0 : 1.8;
        const accuracyFactor = Math.max(0.5, 1.0 - (weapon.accuracy / 200));
        
        ammoUsed = Math.ceil(
            ammoUsed * 
            (weaponEfficiency[weapon.type] || 1.0) * 
            agilityFactor * 
            successFactor * 
            accuracyFactor
        );
        
        return Math.max(1, Math.min(ammoUsed, weapon.currentAmmo));
    }

    
    static async executeHunt(profile) {
        const results = {
            success: false,
            animal: null,
            damageDealt: 0,
            damageTaken: 0,
            loot: [],
            companionInjuries: [],
            experience: 0,
            skillGain: 0,
            costs: {
                fuel: 0,
                ammo: 0,
                healing: 0,
                repairs: 0
            },
            consumption: {
                fuelUsed: 0,
                ammoUsed: 0
            }
        };

        const vehicle = profile.huntingVehicles.find(v => v.vehicleId === profile.activeVehicle);
        const weapon = profile.huntingWeapons.find(w => w.weaponId === profile.activeWeapon);
        const companions = profile.huntingCompanions.filter(c => 
            profile.activeCompanions.includes(c.companionId) && c.health > 0
        );

        if (!vehicle || !weapon) {
            throw new Error('No active vehicle or weapon equipped!');
        }

        if (vehicle.currentFuel < 5) {
            throw new Error('Not enough fuel for expedition! Need at least 5 fuel units.');
        }
        if (weapon.currentAmmo < 1) {
            throw new Error('Weapon needs ammunition! Use !huntshop ammo to buy ammo.');
        }

        const animal = this.generateRandomAnimal(vehicle.jungleDepth, profile.huntingStats.huntingSkill);
        results.animal = animal;

        const fuelNeeded = this.calculateFuelConsumption(vehicle, animal, vehicle.jungleDepth);
        if (vehicle.currentFuel < fuelNeeded) {
            throw new Error(`Not enough fuel! Need ${fuelNeeded} fuel units, have ${vehicle.currentFuel}.`);
        }
        
        vehicle.currentFuel = Math.max(0, vehicle.currentFuel - fuelNeeded);
        results.consumption.fuelUsed = fuelNeeded;

        
        let animalHealth = animal.health;
        let hunterHealth = profile.huntingProfile.currentHealth;
        let roundCount = 0;
        const maxRounds = 10;
        let totalAmmoUsed = 0;

        while (animalHealth > 0 && hunterHealth > 0 && roundCount < maxRounds && weapon.currentAmmo > 0) {
            roundCount++;

            if (weapon.currentAmmo > 0) {
                const ammoPerShot = Math.min(
                    Math.floor(Math.random() * 2) + 1,
                    weapon.currentAmmo
                );
                weapon.currentAmmo -= ammoPerShot;
                totalAmmoUsed += ammoPerShot;
                
                let hitChance = weapon.accuracy;
                
                companions.forEach(companion => {
                    if (companion.specialAbility === 'tracking' && companion.health > 30) {
                        hitChance += 10;
                    }
                });

                hitChance -= (animal.agility * 0.3);
                hitChance = Math.max(20, Math.min(95, hitChance));

                if (Math.random() * 100 < hitChance) {
                    const criticalHit = Math.random() * 100 < weapon.criticalChance;
                    const damage = this.calculateDamage(weapon, companions, criticalHit);
                    
                    animalHealth -= damage;
                    results.damageDealt += damage;
                    
                    weapon.durability = Math.max(0, weapon.durability - 1);
                }
            } else {
                break;
            }

            if (animalHealth > 0) {
                let animalDamage = animal.damage;
                
                let protectionReduction = 0;
                companions.forEach(companion => {
                    if (companion.health > 50) {
                        protectionReduction += 10;
                        
                        if (Math.random() * 100 < 20) {
                            const injury = Math.floor(15 + Math.random() * 20);
                            companion.health = Math.max(0, companion.health - injury);
                            companion.injured = companion.health < 30;
                            
                            if (companion.injured) {
                                companion.injuryTime = new Date();
                                companion.healingCost = Math.floor(500 + (injury * 50));
                                results.companionInjuries.push({
                                    name: companion.name,
                                    injury: injury,
                                    healingCost: companion.healingCost
                                });
                            }
                            protectionReduction += 20;
                        }
                    }
                });

                animalDamage = Math.max(5, animalDamage - protectionReduction);
                hunterHealth -= animalDamage;
                results.damageTaken += animalDamage;
            }
        }

        results.consumption.ammoUsed = totalAmmoUsed;

        if (animalHealth <= 0) {
            results.success = true;
            results.loot = this.generateLoot(animal, profile.huntingStats.huntingSkill);
            results.experience = Math.floor(50 + (animal.tier * 25));
            results.skillGain = Math.floor(1 + (animal.tier * 0.5));
            
            const lootBoxChance = 10 + (profile.huntingStats.huntingSkill * 0.2);
            if (Math.random() * 100 < lootBoxChance) {
                const lootBox = this.generateLootBox();
                results.loot.push(lootBox);
            }
        } else {
            results.success = false;
            const healingCost = Math.floor(500 + (results.damageTaken * 20));
            results.costs.healing = healingCost;
            results.experience = 10;
        }

        profile.huntingProfile.currentHealth = Math.max(0, hunterHealth);
        
        if (vehicle.durability < 50) {
            const repairCost = Math.floor((100 - vehicle.durability) * 50);
            results.costs.repairs = repairCost;
        }

        return results;
    }

    
    static generateLoot(animal, huntingSkill = 0) {
        const loot = [];
        const skillBonus = huntingSkill * 0.01;

        Object.entries(animal.lootTable).forEach(([itemType, itemData]) => {
            const chance = itemData.chance + (skillBonus * 10);
            
            if (Math.random() * 100 < chance) {
                let value = itemData.value;
                const qualityMultiplier = 0.7 + (Math.random() * 0.6);
                value = Math.floor(value * qualityMultiplier);
                
                loot.push({
                    itemId: `${itemType}_${Date.now()}_${Math.random()}`,
                    name: `${animal.name} ${itemType.replace('_', ' ')}`,
                    type: itemType,
                    rarity: animal.rarity,
                    baseValue: itemData.value,
                    currentValue: value,
                    weight: 1,
                    quantity: 1,
                    huntDate: new Date(),
                    description: `High-quality ${itemType} from ${animal.name}`
                });
            }
        });

        return loot;
    }

    
    static generateLootBox() {
        const boxTypes = Object.keys(LOOT_BOXES);
        const randomType = boxTypes[Math.floor(Math.random() * boxTypes.length)];
        const boxData = LOOT_BOXES[randomType];

        return {
            itemId: `lootbox_${Date.now()}_${Math.random()}`,
            name: boxData.name,
            type: 'loot_box',
            rarity: boxData.rarity,
            baseValue: 500,
            currentValue: 500,
            weight: 2,
            quantity: 1,
            huntDate: new Date(),
            description: 'Mysterious container found during expedition',
            contents: boxData.contents
        };
    }

    
    static openLootBox(lootBox) {
        const rewards = [];
        const contents = lootBox.contents;

        Object.entries(contents).forEach(([rewardType, rewardData]) => {
            if (Math.random() * 100 < rewardData.chance) {
                let amount = rewardData.value;
                
                if (rewardData.min && rewardData.max) {
                    amount = Math.floor(Math.random() * (rewardData.max - rewardData.min + 1)) + rewardData.min;
                }

                rewards.push({
                    type: rewardType,
                    amount: amount,
                    description: `${rewardType.replace('_', ' ')} from ${lootBox.name}`
                });
            }
        });

        return rewards;
    }

    
    static calculateStorageCapacity(profile) {
        return profile.huntingWarehouses.reduce((total, warehouse) => total + warehouse.capacity, 0);
    }

    
    static calculateInventoryWeight(profile) {
        return profile.huntingInventory.reduce((total, item) => total + (item.weight * item.quantity), 0);
    }

    
    static async sellHuntingItems(profile, itemIds) {
        let totalValue = 0;
        const soldItems = [];

        itemIds.forEach(itemId => {
            const itemIndex = profile.huntingInventory.findIndex(item => item.itemId === itemId);
            if (itemIndex !== -1) {
                const item = profile.huntingInventory[itemIndex];
                
                let sellValue = item.currentValue;
                const warehouse = profile.huntingWarehouses.find(w => item.location === w.warehouseId);
                if (warehouse) {
                    sellValue = Math.floor(sellValue * warehouse.bonusMultiplier);
                }

                totalValue += sellValue * item.quantity;
                soldItems.push({
                    name: item.name,
                    value: sellValue,
                    quantity: item.quantity,
                    rarity: item.rarity
                });

                profile.huntingInventory.splice(itemIndex, 1);
            }
        });

        if (totalValue > 0) {
            profile.wallet += totalValue;
            
            profile.transactions.push({
                type: 'income',
                amount: totalValue,
                description: `Sold hunting loot (${soldItems.length} items)`,
                category: 'hunting'
            });

            profile.huntingStats.totalEarnings += totalValue;
        }

        return { totalValue, soldItems };
    }

    
    static async healCompanions(profile, companionIds) {
        let totalCost = 0;
        const healedCompanions = [];

        companionIds.forEach(companionId => {
            const companion = profile.huntingCompanions.find(c => c.companionId === companionId);
            if (companion && (companion.injured || companion.health < (companion.maxHealth || 100))) {
                const cost = Math.max(0, Number(companion.healingCost) || 0);
                totalCost += cost;
                companion.health = companion.maxHealth || 100;
                companion.injured = false;
                companion.injuryTime = null;
                
                healedCompanions.push({
                    name: companion.name,
                    cost
                });
                
                companion.healingCost = 0;
            }
        });

        if (healedCompanions.length > 0) {
            if (profile.wallet < totalCost) throw new Error(`Not enough money to heal companions! Need $${totalCost.toLocaleString()}`);
            profile.wallet -= totalCost;
            profile.transactions.push({
                type: 'expense',
                amount: totalCost,
                description: 'Healed injured companions',
                category: 'hunting'
            });
        }

        return { totalCost, healedCompanions };
    }

    
    static async upgradeWeapon(profile, weaponId) {
        const weapon = profile.huntingWeapons.find(w => w.weaponId === weaponId);
        if (!weapon) {
            throw new Error('Weapon not found!');
        }

        if (weapon.upgradeLevel >= 10) {
            throw new Error('Weapon is already at maximum upgrade level!');
        }

        const upgradeCost = Math.floor(weapon.purchasePrice * 0.3 * (weapon.upgradeLevel + 1));
        
        if (profile.wallet < upgradeCost) {
            throw new Error(`Not enough money! Upgrade costs $${upgradeCost.toLocaleString()}`);
        }

        
        const oldDamage = weapon.damage;
        const oldAccuracy = weapon.accuracy;
        const oldCritChance = weapon.criticalChance;

        
        profile.wallet -= upgradeCost;
        weapon.upgradeLevel += 1;
        weapon.damage = Math.floor(weapon.damage * 1.1);
        weapon.accuracy = Math.min(100, weapon.accuracy + 2);
        weapon.criticalChance = Math.min(50, weapon.criticalChance + 1);
        
        profile.transactions.push({
            type: 'expense',
            amount: upgradeCost,
            description: `Upgraded ${weapon.name} to level ${weapon.upgradeLevel}`,
            category: 'hunting'
        });

        return {
            upgradeCost,
            newLevel: weapon.upgradeLevel,
            improvements: {
                damage: weapon.damage - oldDamage,
                accuracy: weapon.accuracy - oldAccuracy,
                criticalChance: weapon.criticalChance - oldCritChance
            },
            newStats: {
                damage: weapon.damage,
                accuracy: weapon.accuracy,
                criticalChance: weapon.criticalChance
            }
        };
    }

    
    static async upgradeVehicle(profile, vehicleId) {
        const vehicle = profile.huntingVehicles.find(v => v.vehicleId === vehicleId);
        if (!vehicle) {
            throw new Error('Vehicle not found!');
        }

        if (vehicle.tier >= 5) {
            throw new Error('Vehicle is already at maximum tier!');
        }

        const upgradeCost = Math.floor(vehicle.purchasePrice * 0.4 * vehicle.tier);
        
        if (profile.wallet < upgradeCost) {
            throw new Error(`Not enough money! Upgrade costs $${upgradeCost.toLocaleString()}`);
        }

        const oldCapacity = vehicle.capacity;
        const oldFuelCapacity = vehicle.fuelCapacity;
        const oldJungleDepth = vehicle.jungleDepth;

        profile.wallet -= upgradeCost;
        vehicle.tier += 1;
        vehicle.capacity = Math.floor(vehicle.capacity * 1.2);
        vehicle.fuelCapacity = Math.floor(vehicle.fuelCapacity * 1.15);
        vehicle.jungleDepth = Math.min(10, vehicle.jungleDepth + 1);
        vehicle.maxDurability = Math.min(120, vehicle.maxDurability + 10);
        vehicle.durability = vehicle.maxDurability;

        profile.transactions.push({
            type: 'expense',
            amount: upgradeCost,
            description: `Upgraded ${vehicle.name} to tier ${vehicle.tier}`,
            category: 'hunting'
        });

        return {
            upgradeCost,
            newTier: vehicle.tier,
            improvements: {
                capacity: vehicle.capacity - oldCapacity,
                fuelCapacity: vehicle.fuelCapacity - oldFuelCapacity,
                jungleDepth: vehicle.jungleDepth - oldJungleDepth
            }
        };
    }

    
    static async refuelVehicle(profile, vehicleId, fuelType, quantity) {
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('Fuel quantity must be a whole number from 1 to 1000.');
        const vehicle = profile.huntingVehicles.find(v => v.vehicleId === vehicleId);
        if (!vehicle) {
            throw new Error('Vehicle not found!');
        }

        const fuel = FUEL_TYPES[fuelType];
        if (!fuel) {
            throw new Error('Invalid fuel type!');
        }

        const fuelToAdd = fuel.fuelValue * quantity;
        const newFuelLevel = Math.min(vehicle.fuelCapacity, vehicle.currentFuel + fuelToAdd);
        const actualFuelAdded = newFuelLevel - vehicle.currentFuel;
        if (actualFuelAdded <= 0) throw new Error('This vehicle already has a full tank.');
        const totalCost = fuel.price * Math.ceil(actualFuelAdded / fuel.fuelValue);
        if (profile.wallet < totalCost) throw new Error(`Not enough money! Need $${totalCost.toLocaleString()}`);

        vehicle.currentFuel = newFuelLevel;
        profile.wallet -= totalCost;

        profile.transactions.push({
            type: 'expense',
            amount: totalCost,
            description: `Refueled ${vehicle.name} with ${quantity}x ${fuel.name}`,
            category: 'hunting'
        });

        return {
            fuelAdded: actualFuelAdded,
            newFuelLevel: newFuelLevel,
            cost: totalCost
        };
    }

    
    static async reloadWeapon(profile, weaponId, ammoType, quantity) {
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('Ammo quantity must be a whole number from 1 to 1000.');
        const weapon = profile.huntingWeapons.find(w => w.weaponId === weaponId);
        if (!weapon) {
            throw new Error('Weapon not found!');
        }

        const ammo = AMMO_TYPES[ammoType];
        if (!ammo) {
            throw new Error('Invalid ammo type!');
        }

        if (!ammo.compatibleWeapons.includes(weapon.type)) {
            throw new Error(`${ammo.name} is not compatible with ${weapon.name}!`);
        }

        const ammoToAdd = ammo.ammoValue * quantity;
        const newAmmoLevel = Math.min(weapon.ammoCapacity, weapon.currentAmmo + ammoToAdd);
        const actualAmmoAdded = newAmmoLevel - weapon.currentAmmo;
        if (actualAmmoAdded <= 0) throw new Error('This weapon is already fully loaded.');
        const totalCost = ammo.price * Math.ceil(actualAmmoAdded / ammo.ammoValue);
        if (profile.wallet < totalCost) throw new Error(`Not enough money! Need $${totalCost.toLocaleString()}`);

        weapon.currentAmmo = newAmmoLevel;
        profile.wallet -= totalCost;

        profile.transactions.push({
            type: 'expense',
            amount: totalCost,
            description: `Reloaded ${weapon.name} with ${quantity}x ${ammo.name}`,
            category: 'hunting'
        });

        return {
            ammoAdded: actualAmmoAdded,
            newAmmoLevel: newAmmoLevel,
            cost: totalCost
        };
    }
}

module.exports = { HuntingManager };
