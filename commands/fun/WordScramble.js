const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, sendV2, ACCENT } = require('../../UI');

const scrambleWord = word => {
    const letters = word.split('');
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters.join('');
};

const words = [
    'apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew', 'kiwi', 'lemon',
    'mango', 'nectarine', 'orange', 'papaya', 'quince', 'raspberry', 'strawberry', 'tangerine', 'ugli', 'vine',
    'watermelon', 'xigua', 'yam', 'zucchini', 'avocado', 'blueberry', 'cantaloupe', 'dragonfruit', 'grapefruit', 'huckleberry',
    'jackfruit', 'kiwano', 'lime', 'melon', 'nectar', 'olive', 'pear', 'plum', 'pomegranate', 'rhubarb',
    'starfruit', 'tomato', 'apricot', 'blackberry', 'coconut', 'cucumber', 'gooseberry', 'pear', 'persimmon', 'pineapple',
    'pomegranate', 'quince', 'raspberry', 'strawberry', 'tamarind', 'banana', 'kiwi', 'fig', 'dates', 'grapefruit',
    'grapes', 'lemon', 'lime', 'melon', 'mango', 'nectarine', 'peach', 'plum', 'papaya', 'passionfruit',
    'peach', 'pear', 'pineapple', 'plum', 'pomegranate', 'tangerine', 'watermelon', 'zucchini', 'eggplant', 'onion',
    'tomato', 'cucumber', 'bellpepper', 'broccoli', 'carrot', 'cauliflower', 'celery', 'corn', 'spinach', 'garlic',
    'ginger', 'kale', 'lettuce', 'mushroom', 'pumpkin', 'radish', 'squash', 'sweetpotato', 'turnip', 'beet',
    'artichoke', 'asparagus', 'bean', 'brusselsprout', 'cabbage', 'chard', 'chili', 'dandelion', 'edamame', 'jalapeno',
    'leek', 'olives', 'parsley', 'pea', 'potato', 'rhubarb', 'shallot', 'snowpea', 'sprout', 'swisschard',
    'taro', 'tomatillo', 'watercress', 'yarrow', 'zucchini', 'yam', 'jicama', 'daikon', 'chayote', 'yogurt',
    'cheddar', 'mozzarella', 'parmesan', 'brie', 'camembert', 'feta', 'gouda', 'ricotta', 'blue', 'goat',
    'cottage', 'cream', 'gruyere', 'provolone', 'swiss', 'havarti', 'american', 'colby', 'jack', 'queso'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordscramble')
        .setDescription('Starts a word scramble game with a scrambled word.'),

    async execute(interaction) {
        const word = words[Math.floor(Math.random() * words.length)];
        const scrambledWord = scrambleWord(word);

        const card = buildCard({
            title: lang.fun.wordScramble.title.replace('{emoji}', getEmoji('sparkles')),
            description: lang.fun.wordScramble.prompt.replace('{word}', scrambledWord),
            footer: lang.fun.wordScramble.footer,
            accentColor: ACCENT.primary
        });

        await sendV2(interaction, card);

        const filter = response => response.author.id === interaction.user.id;

        try {
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const answer = collected.first();
            const resultCard = !answer
                ? buildCard({
                    title: lang.fun.wordScramble.timeout.replace('{emoji}', getEmoji('time') || '⏰'),
                    tone: 'warning'
                })
                : answer.content.toLowerCase() === word.toLowerCase()
                    ? buildCard({
                        title: lang.fun.wordScramble.correct.replace('{emoji}', getEmoji('tick')),
                        tone: 'success'
                    })
                    : buildCard({
                        title: lang.fun.wordScramble.wrong.replace('{emoji}', getEmoji('cross')).replace('{word}', word),
                        tone: 'danger'
                    });

            await interaction.followUp({
                components: [resultCard],
                flags: MessageFlags.IsComponentsV2
            }).catch(error => console.error('[WordScramble] Could not send the result:', error.message));
        } catch (error) {
            console.error('[WordScramble] Collector failed:', error);
            const timeoutCard = buildCard({
                title: lang.error || 'The game could not finish. Please try again.',
                tone: 'warning'
            });
            await interaction.followUp({
                components: [timeoutCard],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});
        }
    },
};
