'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'ramadan',
    description: 'Countdown to Ramadan',
    execute(message) {
        const today = new Date();
        const ramadan = new Date(today.getFullYear(), 2, 1);

        if (today > ramadan) {
            ramadan.setFullYear(ramadan.getFullYear() + 1);
        }

        const daysLeft = Math.ceil((ramadan - today) / (1000 * 60 * 60 * 24));
        const dateStr = `February 28, ${ramadan.getFullYear()}`;

        const card = buildCard({ accent: ACCENT.info })
            .addText(`**${lang.countdowns?.ramadanTitle || 'Ramadan Countdown'}**`)
            .addSeparator()
            .addText(
                (lang.countdowns?.ramadanDaysLeft || '**{days} days** left until Ramadan begins!\nNext Ramadan starts: {date}')
                    .replace('{days}', daysLeft)
                    .replace('{date}', dateStr)
            );

        return sendV2(message, card);
    },
};
