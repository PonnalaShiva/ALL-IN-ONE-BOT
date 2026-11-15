'use strict';

const fs = require('fs');
const path = require('path');

let config;

try {
    config = require('../config.js');
} catch (err) {
    console.error('Error loading config file:', err);
    process.exit(1);
}

const defaultLang = require('../languages/default.js');
const { createInterpolatableProxy } = require('../UI/i18n');
let activeLang = defaultLang;

if (config.language && config.language !== 'default') {
    const customLangPath = path.join(__dirname, '../languages', `${config.language}.js`);
    try {
        if (fs.existsSync(customLangPath)) {
            const customLang = require(customLangPath);
            activeLang = new Proxy(customLang, {
                get(target, prop) {
                    if (prop in target && target[prop] !== undefined) {
                        return target[prop];
                    }
                    return defaultLang[prop];
                },
            });
        }
    } catch (err) {
        console.warn(`Could not load language ${config.language}, falling back to default.`, err.message);
    }
}

const loader = new Proxy(function loadLanguage( ) {
    return activeLang;
}, {
    get(fn, prop) {
        if (prop === 'createInterpolatableProxy') return createInterpolatableProxy;
        
        if (prop in fn) return fn[prop];
        
        return activeLang[prop];
    },
    has(fn, prop) {
        if (prop === 'createInterpolatableProxy') return true;
        return prop in fn || prop in activeLang;
    },
});

loader.createInterpolatableProxy = createInterpolatableProxy;

module.exports = loader;

