'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'halloween',
    description: 'Countdown to Halloween',
    execute(message) {
        const today = new Date();
        const halloween = new Date(today.getFullYear(), 9, 31);

        if (today > halloween) {
            halloween.setFullYear(halloween.getFullYear() + 1);
        }

        const daysLeft = Math.ceil((halloween - today) / (1000 * 60 * 60 * 24));

        const card = buildCard({ accent: ACCENT.warning })
            .addText(`**${lang.countdowns?.halloweenTitle || 'Halloween Countdown'}**`)
            .addSeparator()
            .addText((lang.countdowns?.halloweenDaysLeft || '**{days} days** left until Halloween!').replace('{days}', daysLeft));

        return sendV2(message, card);
    },
};
