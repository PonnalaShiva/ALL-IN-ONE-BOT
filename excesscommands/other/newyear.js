'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'newyear',
    description: 'Countdown to the New Year',
    execute(message) {
        const today = new Date();
        const newYear = new Date(today.getFullYear() + 1, 0, 1);

        const daysLeft = Math.ceil((newYear - today) / (1000 * 60 * 60 * 24));

        const card = buildCard({ accent: ACCENT.success })
            .addText(`**${lang.countdowns?.newYearTitle || 'New Year Countdown'}**`)
            .addSeparator()
            .addText((lang.countdowns?.newYearDaysLeft || '**{days} days** left until New Year!').replace('{days}', daysLeft));

        return sendV2(message, card);
    },
};
