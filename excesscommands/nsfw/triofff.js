'use strict';

const { buildCard, cards, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');
const { gifs } = require('mediacord');

module.exports = {
    name: 'triofff',
    description: lang.nsfw.descriptions['triofff'] || 'triofff',
    async execute(message) {
        if (!message.channel?.nsfw) {
            return sendV2(message, cards.warning(lang.nsfw.warningTitle, lang.nsfw.channelRequired));
        }

        try {
            const url = await gifs.nsfw.triofff();

            if (!url) {
                return sendV2(message, cards.error(lang.nsfw.errorTitle, lang.nsfw.fetchFailed));
            }

            const card = buildCard({
                title: lang.nsfw.titles['triofff'] || 'triofff',
                bannerURL: url,
                accentColor: ACCENT.nsfw
            });

            return sendV2(message, card);
        } catch (error) {
            console.error('[NSFW Error - triofff]:', error);
            return sendV2(message, cards.error(lang.nsfw.errorTitle, lang.nsfw.genericError));
        }
    }
};
