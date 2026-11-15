'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'diwali',
    description: 'Countdown to Diwali',
    execute(message) {
        const today = new Date();
        const diwali = new Date(today.getFullYear(), 10, 1);

        if (today > diwali) {
            diwali.setFullYear(diwali.getFullYear() + 1);
        }

        const daysLeft = Math.ceil((diwali - today) / (1000 * 60 * 60 * 24));
        const dateStr = `October 21, ${diwali.getFullYear()}`;

        const card = buildCard({ accent: ACCENT.warning })
            .addText(`**${lang.countdowns?.diwaliTitle || 'Diwali Countdown'}**`)
            .addSeparator()
            .addText(
                (lang.countdowns?.diwaliDaysLeft || '**{days} days** left until Diwali!\nNext Diwali: {date}')
                    .replace('{days}', daysLeft)
                    .replace('{date}', dateStr)
            );

        return sendV2(message, card);
    },
};
