'use strict';

const rawLang = require('../../../events/loadLanguage');
const { CARS, PETS, PROPERTIES, ROLES, SHOP_ITEMS, FAMILY_TYPES } = require('../constants/gameData');
const { BUSINESS_TYPES, HEIST_TARGETS } = require('../constants/businessData');
const { CROPS, FERTILIZERS, FARM_UPGRADES } = require('../constants/farmingData');
const { FISH_TYPES, FISHING_RODS, BAIT_TYPES, FISHING_LOCATIONS } = require('../constants/fishingData');
const { HUNTING_ANIMALS, HUNTING_VEHICLES, HUNTING_WEAPONS, HUNTING_COMPANIONS, HUNTING_WAREHOUSES, LOOT_BOXES } = require('../constants/huntingData');
const { INSURANCE_TYPES, ACHIEVEMENTS } = require('../constants/systemData');
const { CRIME_TYPES, JAILBREAK_METHODS } = require('../constants/crimeData');

const STATIC_REGISTRY = {
    items: SHOP_ITEMS,
    vehicles: { ...CARS, ...(HUNTING_VEHICLES || {}) },
    properties: PROPERTIES,
    pets: PETS,
    businesses: BUSINESS_TYPES,
    crops: CROPS,
    fertilizers: FERTILIZERS || {},
    farm_upgrades: FARM_UPGRADES || {},
    fish: FISH_TYPES,
    fishing_rods: FISHING_RODS || {},
    bait: BAIT_TYPES || {},
    fishing_locations: FISHING_LOCATIONS || {},
    hunting_animals: HUNTING_ANIMALS,
    hunting_weapons: HUNTING_WEAPONS || {},
    hunting_companions: HUNTING_COMPANIONS || {},
    hunting_warehouses: HUNTING_WAREHOUSES || {},
    loot_boxes: LOOT_BOXES || {},
    heist_targets: HEIST_TARGETS || {},
    roles: ROLES,
    kinships: FAMILY_TYPES,
    family_types: FAMILY_TYPES,
    insurance: INSURANCE_TYPES || {},
    achievements: ACHIEVEMENTS || {},
    crimes: CRIME_TYPES || {},
    crime: CRIME_TYPES || {},
    jailbreak_methods: JAILBREAK_METHODS || {}
};

function resolveEntity(category, id, fallbackData = {}) {
    if (!id) {
        return { name: 'Unknown', description: '', special: '', emoji: '📦' };
    }

    const staticItem = STATIC_REGISTRY[category]?.[id] || {};
    const entitiesMap = rawLang.economy?.entities;
    const catMap = entitiesMap && (category in entitiesMap) ? entitiesMap[category] : null;
    const localized = catMap && (id in catMap) ? catMap[id] : null;

    const hasProp = (obj, prop) => Boolean(obj && Object.prototype.hasOwnProperty.call(obj, prop));

    const name = (hasProp(localized, 'name') && localized.name)
        ? String(localized.name)
        : fallbackData.name || staticItem.name || id;

    const description = (hasProp(localized, 'description') && localized.description)
        ? String(localized.description)
        : fallbackData.description || staticItem.description || '';

    const special = (hasProp(localized, 'special') && localized.special)
        ? String(localized.special)
        : fallbackData.special || staticItem.special || '';

    const emoji = (hasProp(localized, 'emoji') && localized.emoji)
        ? String(localized.emoji)
        : fallbackData.emoji || staticItem.emoji || '';

    const professions = Array.isArray(localized?.professions)
        ? localized.professions
        : Array.isArray(fallbackData.professions)
            ? fallbackData.professions
            : Array.isArray(staticItem.professions)
                ? staticItem.professions
                : [];

    const defaultNames = Array.isArray(localized?.defaultNames)
        ? localized.defaultNames
        : Array.isArray(fallbackData.defaultNames)
            ? fallbackData.defaultNames
            : Array.isArray(staticItem.defaultNames)
                ? staticItem.defaultNames
                : [];

    return { name, description, special, emoji, professions, defaultNames };
}

module.exports = {
    resolveEntity,
    STATIC_REGISTRY
};
