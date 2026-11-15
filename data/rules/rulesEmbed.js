


'use strict';

const { buildCard, ACCENT } = require('../../UI');
const { getEmoji } = require('../../UI/emojis/emoji');

const ruleEmbeds = {
    spam: buildCard({
        title: `${getEmoji('warning')} Spam Rules`,
        accentColor: ACCENT.danger,
        sections: [
            "**1. No excessive messages:** Avoid sending too many messages in a short time.\n" +
            "**2. No emoji spam:** Do not flood chat with emojis or stickers.\n" +
            "**3. No reaction spam:** Repeatedly adding/removing reactions is disruptive.\n" +
            "**4. No copy-pasta:** Long, repetitive text blocks are not allowed.\n" +
            "**5. No self-promotion spam:** Promoting your content excessively is forbidden."
        ]
    }),

    nsfw: buildCard({
        title: `${getEmoji('warning')} NSFW Rules`,
        accentColor: 0x800080,
        sections: [
            "**1. NSFW content is not allowed:** This includes images, text, or links.\n" +
            "**2. No inappropriate jokes or discussions:** Keep it clean.\n" +
            "**3. No sexual harassment:** Making explicit or suggestive comments is prohibited.\n" +
            "**4. No adult roleplay:** This is not an 18+ server."
        ]
    }),

    discord_terms: buildCard({
        title: `${getEmoji('document')} Discord Terms & Conditions`,
        accentColor: ACCENT.primary,
        sections: [
            "**1. Follow Discord's [Terms of Service](https://discord.com/terms)**.\n" +
            "**2. Follow Discord's [Community Guidelines](https://discord.com/guidelines)**.\n" +
            "**3. Do not use unauthorized bots, hacks, or exploits.**\n" +
            "**4. Do not engage in fraud, scamming, or phishing.**"
        ]
    }),

    harassment: buildCard({
        title: `${getEmoji('security')} Harassment Rules`,
        accentColor: ACCENT.warning,
        sections: [
            "**1. No personal attacks:** Do not insult or target others.\n" +
            "**2. No hate speech:** Racism, sexism, homophobia, or any form of discrimination is strictly forbidden.\n" +
            "**3. No threats or doxing:** Threatening or sharing private information is a bannable offense.\n" +
            "**4. No excessive trolling:** Light jokes are fine, but being disruptive isn't."
        ]
    }),

    links: buildCard({
        title: `${getEmoji('world')} Link Rules`,
        accentColor: 0xFFFF00,
        sections: [
            "**1. No posting harmful links:** Malware, scams, or NSFW links are not allowed.\n" +
            "**2. No self-promotion outside dedicated channels:** Advertising should only be done where permitted.\n" +
            "**3. No IP grabbers, trackers, or shortened links:** Only share safe, verifiable URLs."
        ]
    }),

    images: buildCard({
        title: `${getEmoji('media')} Image Rules`,
        accentColor: 0xFF00FF,
        sections: [
            "**1. No NSFW or explicit images:** This is a safe space.\n" +
            "**2. No graphic violence or gore:** Keep content appropriate.\n" +
            "**3. No meme spam:** Keep meme posts reasonable.\n" +
            "**4. No offensive or discriminatory images.**"
        ]
    }),

    hacking: buildCard({
        title: `${getEmoji('security')} Hacking Rules`,
        accentColor: ACCENT.danger,
        sections: [
            "**1. No hacking, cheating, or exploiting:** Do not attempt to hack bots, servers, or users.\n" +
            "**2. No sharing exploits or scripts:** Unauthorized software is forbidden.\n" +
            "**3. No social engineering or phishing:** Do not trick users into revealing sensitive information.\n" +
            "**4. No use of alt accounts to bypass bans or restrictions.**"
        ]
    }),

    mic_spam: buildCard({
        title: `${getEmoji('voice')} Mic Spam Rules`,
        accentColor: 0xFFA500,
        sections: [
            "**1. No loud, distorted, or annoying sounds:** Do not intentionally disrupt voice chats.\n" +
            "**2. No voice changers or soundboards:** Unless allowed in specific channels.\n" +
            "**3. No playing music through your mic:** Use the designated music bots instead.\n" +
            "**4. No screaming or shouting excessively.**"
        ]
    }),

    bot_usage: buildCard({
        title: `${getEmoji('bot')} Bot Usage Rules`,
        accentColor: 0x008000,
        sections: [
            "**1. Do not abuse bot commands:** Use them responsibly.\n" +
            "**2. No spamming bot commands in main channels:** Keep it in bot channels.\n" +
            "**3. Do not attempt to hack or exploit bots.**"
        ]
    }),

    trading_selling: buildCard({
        title: `${getEmoji('cart')} Trading & Selling Rules`,
        accentColor: 0x8B4513,
        sections: [
            "**1. No selling accounts, items, or services:** This is not a marketplace.\n" +
            "**2. No trading or gambling activities:** Use trusted platforms instead.\n" +
            "**3. No advertising personal businesses without permission.**"
        ]
    }),

    language: buildCard({
        title: `${getEmoji('chat')} Language Rules`,
        accentColor: 0x4682B4,
        sections: [
            "**1. English only in general channels:** Use other channels for different languages.\n" +
            "**2. No excessive swearing:** Keep the chat friendly.\n" +
            "**3. No slurs, insults, or offensive language.**"
        ]
    }),

    spoilers: buildCard({
        title: `${getEmoji('help')} Spoiler Rules`,
        accentColor: 0xA52A2A,
        sections: [
            "**1. Use spoiler tags for major spoilers:** Example: `||spoiler here||`.\n" +
            "**2. No posting spoilers outside designated spoiler channels.**"
        ]
    }),

    self_promotion: buildCard({
        title: `${getEmoji('speaker')} Self-Promotion Rules`,
        accentColor: 0x9370DB,
        sections: [
            "**1. No self-promotion outside dedicated channels.**\n" +
            "**2. No DM advertising:** Do not send unsolicited links to members.\n" +
            "**3. No begging for followers, subscribers, or donations.**"
        ]
    }),

    moderation: buildCard({
        title: `${getEmoji('scales')} Moderation Rules`,
        accentColor: 0x228B22,
        sections: [
            "**1. Respect moderators and their decisions.**\n" +
            "**2. Do not backseat moderate:** Let staff handle issues.\n" +
            "**3. If you have concerns, message staff privately.**"
        ]
    })
};

module.exports = ruleEmbeds;
