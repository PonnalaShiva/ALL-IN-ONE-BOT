'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'holi',
    description: 'Countdown to Holi',
    execute(message) {
        const today = new Date();
        const holi = new Date(today.getFullYear(), 2, 14);

        if (today > holi) {
            holi.setFullYear(holi.getFullYear() + 1);
        }

        const daysLeft = Math.ceil((holi - today) / (1000 * 60 * 60 * 24));
        const dateStr = `March 14, ${holi.getFullYear()}`;

        const card = buildCard({ accent: ACCENT.primary })
            .addText(`**${lang.countdowns?.holiTitle || 'Holi Countdown'}**`)
            .addSeparator()
            .addText(
                (lang.countdowns?.holiDaysLeft || '**{days} days** left until Holi!\nNext Holi: {date}')
                    .replace('{days}', daysLeft)
                    .replace('{date}', dateStr)
            );

        return sendV2(message, card);
    },
};
