'use strict';

function isCommandCategoryEnabled(command, categories) {
    if (!command || command.source === 'shiva') return true;
    const category = command.category || 'undefined';
    return Boolean(categories?.[category]);
}

module.exports = { isCommandCategoryEnabled };
