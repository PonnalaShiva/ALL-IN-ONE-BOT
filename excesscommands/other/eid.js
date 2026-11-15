'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'eid',
    description: 'Countdown to Eid-al-Fitr',
    execute(message) {
        const today = new Date();
        const eid = new Date(today.getFullYear(), 3, 21);

        if (today > eid) {
            eid.setFullYear(eid.getFullYear() + 1);
        }

        const daysLeft = Math.ceil((eid - today) / (1000 * 60 * 60 * 24));

        const card = buildCard({ accent: ACCENT.success })
            .addText(`**${lang.countdowns?.eidTitle || 'Eid Countdown'}**`)
            .addSeparator()
            .addText((lang.countdowns?.eidDaysLeft || '**{days} days** left until Eid-al-Fitr!').replace('{days}', daysLeft));

        return sendV2(message, card);
    },
};
