const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');

function cleanAIMarkdown(text) {
    if (!text) return '';
    return text
        
        .replace(/^#{4,6}\s*(.+)$/gm, '### $1')
        
        .replace(/\n#{4,6}\s*/g, '\n### ')
        
        .replace(/^###\s*#+\s*/gm, '### ')
        
        .split('\n').map(line => line.trimEnd()).join('\n');
}

function chunkText(text, maxChunkSize = 2500) {
    if (!text) return [''];
    if (text.length <= maxChunkSize) return [text];

    const chunks = [];
    let currentChunk = '';

    const lines = text.split('\n');

    for (const line of lines) {
        if ((currentChunk + '\n' + line).length > maxChunkSize) {
            if (currentChunk.trim().length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }

            if (line.length > maxChunkSize) {
                const words = line.split(' ');
                for (const word of words) {
                    if ((currentChunk + ' ' + word).length > maxChunkSize) {
                        if (currentChunk.trim().length > 0) {
                            chunks.push(currentChunk.trim());
                            currentChunk = '';
                        }
                    }

                    if (word.length > maxChunkSize) {
                        let remainingWord = word;
                        while (remainingWord.length > maxChunkSize) {
                            const part = remainingWord.slice(0, maxChunkSize);
                            chunks.push(part);
                            remainingWord = remainingWord.slice(maxChunkSize);
                        }
                        currentChunk = remainingWord;
                    } else {
                        currentChunk += (currentChunk ? ' ' : '') + word;
                    }
                }
            } else {
                currentChunk = line;
            }
        } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

function createV2AIContainers(options = {}) {
    const {
        title = 'AI Response',
        headerEmoji = 'settings',
        accentColor = 0x0099FF,
        text = '',
        subtitle = null
    } = options;

    const cleanedText = cleanAIMarkdown(text);
    const chunks = chunkText(cleanedText, 2500);
    const containers = [];

    
    const firstContainer = new ContainerBuilder().setAccentColor(accentColor);
    const cleanTitle = (title || '').trim();
    const hasLeadingEmoji = /^<a?:[a-zA-Z0-9_]+:\d+>|^[\p{Emoji}\u200d\uFE0F]/u.test(cleanTitle);
    const emojiStr = getEmoji(headerEmoji);

    let firstHeader = '';
    if (hasLeadingEmoji) {
        firstHeader = `## **${cleanTitle}**`;
    } else if (emojiStr) {
        firstHeader = `## ${emojiStr} **${cleanTitle}**`;
    } else {
        firstHeader = `## 🤖 **${cleanTitle}**`;
    }
    if (subtitle) {
        firstHeader += `\n> ${subtitle}`;
    }

    const firstContent = `${firstHeader}\n\n${chunks[0] || 'No response generated.'}`;
    firstContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            firstContent.length > 3900 ? firstContent.slice(0, 3900) : firstContent
        )
    );
    containers.push(firstContainer);

    
    for (let i = 1; i < chunks.length && i < 10; i++) {
        const followContainer = new ContainerBuilder().setAccentColor(accentColor);
        let partHeader = '';
        if (hasLeadingEmoji) {
            partHeader = `### **${cleanTitle} (Part ${i + 1})**`;
        } else if (emojiStr) {
            partHeader = `### ${emojiStr} **${cleanTitle} (Part ${i + 1})**`;
        } else {
            partHeader = `### 🤖 **${cleanTitle} (Part ${i + 1})**`;
        }

        const followContent = `${partHeader}\n\n${chunks[i]}`;
        followContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                followContent.length > 3900 ? followContent.slice(0, 3900) : followContent
            )
        );

        containers.push(followContainer);
    }

    return containers;
}

async function sendV2AIResponse(interaction, options = {}) {
    const containers = createV2AIContainers(options);
    if (!containers.length) return;

    const isInteraction = typeof interaction?.deferReply === 'function';

    if (isInteraction) {
        const isDeferredOrReplied = interaction.deferred || interaction.replied;
        if (!isDeferredOrReplied) {
            await interaction.deferReply().catch(() => {});
        }
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                components: [containers[0]],
                flags: MessageFlags.IsComponentsV2
            });
        } else {
            await interaction.reply({
                components: [containers[0]],
                flags: MessageFlags.IsComponentsV2
            });
        }

        
        for (let i = 1; i < containers.length; i++) {
            await new Promise(r => setTimeout(r, 300));
            await interaction.followUp({
                components: [containers[i]],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});
        }
    } else {
        
        const channel = interaction?.channel;
        if (typeof interaction?.reply === 'function') {
            await interaction.reply({
                components: [containers[0]],
                flags: MessageFlags.IsComponentsV2
            }).catch(async () => {
                if (channel?.send) {
                    await channel.send({
                        components: [containers[0]],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }
            });
        } else if (channel?.send) {
            await channel.send({
                components: [containers[0]],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});
        }

        for (let i = 1; i < containers.length; i++) {
            await new Promise(r => setTimeout(r, 300));
            if (channel?.send) {
                await channel.send({
                    components: [containers[i]],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }
        }
    }
}

module.exports = {
    cleanAIMarkdown,
    chunkText,
    createV2AIContainers,
    sendV2AIResponse
};
