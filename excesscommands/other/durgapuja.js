'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    name: 'durgapuja',
    description: lang.durgaPoojaDescription || 'Countdown to Durga Puja',
    execute(message) {
        const today = new Date();
        const durgaPoojaStart = new Date(today.getFullYear(), 8, 28);
        const durgaPoojaEnd = new Date(today.getFullYear(), 9, 2);

        if (today > durgaPoojaEnd) {
            durgaPoojaStart.setFullYear(durgaPoojaStart.getFullYear() + 1);
            durgaPoojaEnd.setFullYear(durgaPoojaEnd.getFullYear() + 1);
        }

        const oneDay = 1000 * 60 * 60 * 24;
        const daysLeft = Math.ceil((durgaPoojaStart.getTime() - today.getTime()) / oneDay);

        let statusMessage;
        if (today >= durgaPoojaStart && today <= durgaPoojaEnd) {
            statusMessage = (lang.countdowns?.durgaPujaNow || 'Durga Puja is happening now! It will end on **{endDate}**.')
                .replace('{endDate}', `October 2, ${durgaPoojaEnd.getFullYear()}`);
        } else {
            statusMessage = (lang.countdowns?.durgaPujaDaysLeft || 'Durga Puja starts in **{days} days**!\nIt begins on **{startDate}** and ends on **{endDate}**.')
                .replace('{days}', daysLeft)
                .replace('{startDate}', `September 28, ${durgaPoojaStart.getFullYear()}`)
                .replace('{endDate}', `October 2, ${durgaPoojaEnd.getFullYear()}`);
        }

        const card = buildCard({ accent: ACCENT.danger })
            .addText(`**${lang.countdowns?.durgaPujaTitle || 'Durga Puja Countdown'}**`)
            .addSeparator()
            .addText(statusMessage);

        return sendV2(message, card);
    },
};
