'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'mirror',
    description: lang.other.mirror.desc,
    execute(message) {
        const card = buildCard({ accent: ACCENT.primary })
            .addText(`**${lang.other.mirror.header}**`)
            .addSeparator()
            .addText(lang.other.mirror.text);

        return sendV2(message, card);
    },
};
