'use strict';

const tokens = require('./tokens');
const cards = require('./cards');
const buttons = require('./buttons');
const customId = require('./customId');
const sessions = require('./sessions');
const responses = require('./responses');
const i18n = require('./i18n');
const commandLinks = require('./commandLinks');
const emojis = require('../UI/emojis/emoji');

module.exports = {
    
    ...tokens,

    
    ...cards,

    
    ...buttons,

    
    customId,

    
    ...sessions,

    
    ...responses,

    
    ...i18n,

    
    ...commandLinks,

    
    ...emojis,
};
