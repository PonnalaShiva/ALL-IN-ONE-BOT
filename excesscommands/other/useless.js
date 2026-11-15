'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'useless',
    description: lang.other.useless.desc,
    execute(message) {
        const card = buildCard({ accent: ACCENT.warning })
            .addText(`**${lang.other.useless.header}**`)
            .addSeparator()
            .addText(lang.other.useless.text);

        return sendV2(message, card);
    },
};
