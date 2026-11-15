'use strict';

const { buildCard, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

function getEasterDate(year) {
    
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

module.exports = {
    name: 'easter',
    description: 'Countdown to Easter',
    execute(message) {
        const today = new Date();
        let easter = getEasterDate(today.getFullYear());

        if (today > easter) {
            easter = getEasterDate(today.getFullYear() + 1);
        }

        const daysLeft = Math.ceil((easter - today) / (1000 * 60 * 60 * 24));

        const card = buildCard({ accent: ACCENT.warning })
            .addText(`**${lang.countdowns?.easterTitle || 'Easter Countdown'}**`)
            .addSeparator()
            .addText((lang.countdowns?.easterDaysLeft || '**{days} days** left until Easter!\nGet ready for Easter celebrations!').replace('{days}', daysLeft));

        return sendV2(message, card);
    },
};
