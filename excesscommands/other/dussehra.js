'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'dussehra',
    description: 'Countdown to Dussehra',
    execute(message) {
        const today = new Date();
        const dussehra = new Date(today.getFullYear(), 9, 2);

        if (today > dussehra) {
            dussehra.setFullYear(dussehra.getFullYear() + 1);
        }

        const daysLeft = Math.ceil((dussehra - today) / (1000 * 60 * 60 * 24));
        const dateStr = `October 2, ${dussehra.getFullYear()}`;

        const card = buildCard({ accent: ACCENT.warning })
            .addText(`**${lang.countdowns?.dussehraTitle || 'Dussehra Countdown'}**`)
            .addSeparator()
            .addText(
                (lang.countdowns?.dussehraDaysLeft || '**{days} days** left until Dussehra!\nNext Dussehra: {date}')
                    .replace('{days}', daysLeft)
                    .replace('{date}', dateStr)
            );

        return sendV2(message, card);
    },
};
