'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'invisible',
    description: lang.other.invisible.desc,
    execute(message) {
        const card = buildCard({ accent: ACCENT.neutral })
            .addText(lang.other.invisible.text);

        return sendV2(message, card);
    },
};
