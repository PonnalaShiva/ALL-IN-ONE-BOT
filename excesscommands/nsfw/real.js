'use strict';

const { buildCard, cards, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');
const { NSFW } = require('nsfwhub');

module.exports = {
    name: 'real',
    description: lang.nsfw.descriptions['real'] || 'real',
    async execute(message) {
        if (!message.channel?.nsfw) {
            return sendV2(message, cards.warning(lang.nsfw.warningTitle, lang.nsfw.channelRequired));
        }

        try {
            const r = await new NSFW().fetch('real');
            const url = r?.image?.url || r?.url;

            if (!url) {
                return sendV2(message, cards.error(lang.nsfw.errorTitle, lang.nsfw.fetchFailed));
            }

            const card = buildCard({
                title: lang.nsfw.titles['real'] || 'real',
                bannerURL: url,
                accentColor: ACCENT.nsfw
            });

            return sendV2(message, card);
        } catch (error) {
            console.error('[NSFW Error - real]:', error);
            return sendV2(message, cards.error(lang.nsfw.errorTitle, lang.nsfw.genericError));
        }
    }
};
