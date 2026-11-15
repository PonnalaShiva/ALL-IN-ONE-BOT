'use strict';

const { buildCard, cards, sendV2, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');
const { images } = require('mediacord');

module.exports = {
    name: 'holo',
    description: lang.nsfw.descriptions['holo'] || 'holo',
    async execute(message) {
        if (!message.channel?.nsfw) {
            return sendV2(message, cards.warning(lang.nsfw.warningTitle, lang.nsfw.channelRequired));
        }

        try {
            const url = await images.nsfw.holo();

            if (!url) {
                return sendV2(message, cards.error(lang.nsfw.errorTitle, lang.nsfw.fetchFailed));
            }

            const card = buildCard({
                title: lang.nsfw.titles['holo'] || 'holo',
                bannerURL: url,
                accentColor: ACCENT.nsfw
            });

            return sendV2(message, card);
        } catch (error) {
            console.error('[NSFW Error - holo]:', error);
            return sendV2(message, cards.error(lang.nsfw.errorTitle, lang.nsfw.genericError));
        }
    }
};
