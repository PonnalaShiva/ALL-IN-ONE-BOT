'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'christmas',
    description: 'Countdown to Christmas',
    execute(message) {
        const today = new Date();
        const christmas = new Date(today.getFullYear(), 11, 25);

        if (today > christmas) {
            christmas.setFullYear(christmas.getFullYear() + 1);
        }

        const daysLeft = Math.ceil((christmas - today) / (1000 * 60 * 60 * 24));

        const card = buildCard({ accent: ACCENT.danger })
            .addText(`**${lang.countdowns?.christmasTitle || 'Christmas Countdown'}**`)
            .addSeparator()
            .addText((lang.countdowns?.christmasDaysLeft || '**{days} days** left until Christmas!').replace('{days}', daysLeft));

        return sendV2(message, card);
    },
};
