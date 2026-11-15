'use strict';

const { buildCard, cards, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'mock',
    description: lang.other.mock.desc,
    execute(message, args) {
        if (!args || !args.length) {
            return sendV2(message, cards.warning(lang.other.mock.title, lang.other.mock.errorNoText));
        }

        const mockedText = args.join(' ')
            .split('')
            .map((char, index) => index % 2 ? char.toLowerCase() : char.toUpperCase())
            .join('');

        const card = buildCard({ accent: ACCENT.primary })
            .addText(`**${lang.other.mock.outputTitle}**`)
            .addSeparator()
            .addText(mockedText);

        return sendV2(message, card);
    },
};
