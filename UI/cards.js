'use strict';

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} = require('discord.js');

const { ACCENT } = require('./tokens');
const { getEmoji, replaceWithCustomEmojis } = require('../UI/emojis/emoji');
const lang = require('../events/loadLanguage');

function buildCard(
    titleOrOpts = '',
    sections = [],
    rows = [],
    thumbnailURL = null,
    accentColor = ACCENT.primary,
    bannerURL = null
) {
    let title = '';
    let finalSections = sections;
    let finalRows = rows;
    let finalThumbnail = thumbnailURL;
    let finalAccent = accentColor;
    let finalBanner = bannerURL;

    if (typeof titleOrOpts === 'object' && titleOrOpts !== null && !Array.isArray(titleOrOpts)) {
        title = titleOrOpts.title || '';
        finalRows = titleOrOpts.rows || [];
        finalThumbnail = titleOrOpts.thumbnailURL ?? null;
        finalBanner = titleOrOpts.bannerURL ?? null;

        
        const toneMap = {
            success: ACCENT.success,
            error:   ACCENT.danger,
            danger:  ACCENT.danger,
            warning: ACCENT.warning,
            info:    ACCENT.info,
            setup:   ACCENT.setup,
            music:   ACCENT.music,
            moderation: ACCENT.moderation,
            nsfw:    ACCENT.nsfw,
        };
        finalAccent = titleOrOpts.accentColor
            ?? titleOrOpts.accent
            ?? (titleOrOpts.tone ? (toneMap[titleOrOpts.tone] ?? ACCENT.primary) : ACCENT.primary);

        
        const builtSections = [];

        
        if (titleOrOpts.description) {
            builtSections.push(String(titleOrOpts.description));
        }

        
        if (Array.isArray(titleOrOpts.sections)) {
            for (const s of titleOrOpts.sections) builtSections.push(s);
        }

        
        if (Array.isArray(titleOrOpts.fields) && titleOrOpts.fields.length > 0) {
            const fieldLines = titleOrOpts.fields
                .map(f => `**${f.name}:** ${f.value}`)
                .join('\n');
            builtSections.push(fieldLines);
        }

        finalSections = builtSections;

        if (titleOrOpts.footer) {
            titleOrOpts._footer = String(titleOrOpts.footer);
        }
    } else {
        title = String(titleOrOpts || '');
        if (typeof thumbnailURL === 'number') {
            finalAccent = thumbnailURL;
            finalThumbnail = null;
        } else if (typeof thumbnailURL === 'object' && thumbnailURL !== null) {
            finalAccent = thumbnailURL.accentColor ?? ACCENT.primary;
            finalThumbnail = thumbnailURL.thumbnailURL ?? null;
            finalBanner = thumbnailURL.bannerURL ?? null;
        } else if (typeof thumbnailURL === 'string' && !/^https?:\/\//i.test(thumbnailURL)) {
            if (/^#?[0-9a-fA-F]{6}$/.test(thumbnailURL)) {
                finalAccent = parseInt(thumbnailURL.replace('#', ''), 16);
                finalThumbnail = null;
            }
        }
    }

    const clampDisplayContent = (text, max = 3900) => {
        const str = replaceWithCustomEmojis(String(text || ''));
        return str.length > max ? str.slice(0, max) + '...' : str;
    };

    const c = new ContainerBuilder().setAccentColor(finalAccent);

    
    if (title) {
        c.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${clampDisplayContent(title, 250)}`)
        );
    }

    
    if (typeof finalBanner === 'string' && /^https?:\/\//i.test(finalBanner)) {
        c.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(finalBanner)
            )
        );
    }

    
    if (finalSections.length > 0) {
        if (typeof finalThumbnail === 'string' && /^https?:\/\//i.test(finalThumbnail)) {
            
            c.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );
            c.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(clampDisplayContent(finalSections[0]))
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setURL(finalThumbnail)
                            .setDescription(title || 'thumbnail')
                    )
            );
            for (let i = 1; i < finalSections.length; i++) {
                c.addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                );
                c.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(clampDisplayContent(finalSections[i]))
                );
            }
        } else {
            
            for (const section of finalSections) {
                c.addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                );
                c.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(clampDisplayContent(section))
                );
            }
        }
    }

    
    for (const row of finalRows) {
        if (!row) continue;
        c.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
        c.addActionRowComponents(row);
    }

    
    if (typeof titleOrOpts === 'object' && titleOrOpts !== null && titleOrOpts._footer) {
        c.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
        c.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ${clampDisplayContent(titleOrOpts._footer, 500)}`)
        );
    }

    
    c.addText = function (content) {
        c.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(replaceWithCustomEmojis(String(content ?? '')))
        );
        return c;
    };

    c.addSeparator = function (spacing = SeparatorSpacingSize.Small) {
        c.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(spacing)
        );
        return c;
    };

    c.addRow = function (...rows) {
        for (const row of rows.flat()) {
            if (!row) continue;
            c.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );
            c.addActionRowComponents(row);
        }
        return c;
    };

    return c;
}

function _feedbackCard(emojiKey, title, description, color) {
    const emoji = getEmoji(emojiKey) || '';
    const sections = description ? [description] : [];
    return buildCard({
        title: `${emoji} ${title}`.trim(),
        sections,
        accentColor: color,
    });
}

const cards = {
    success(title, description) {
        return _feedbackCard('tick', title || lang.success, description, ACCENT.success);
    },

    error(title, description) {
        return _feedbackCard('cross', title || lang.error, description, ACCENT.danger);
    },

    warning(title, description) {
        return _feedbackCard('warning', title || lang.warning, description, ACCENT.warning);
    },

    info(title, description) {
        return _feedbackCard('sparkles', title || lang.info, description, ACCENT.info);
    },

    expired(commandMention) {
        const desc = commandMention
            ? `This panel has expired, run again ${commandMention}.`
            : lang.sessionExpired;
        const c = _feedbackCard('warning', lang.sessionExpiredTitle, desc, ACCENT.warning);
        c._isTerminalSessionCard = true;
        return c;
    },

    closed(commandMention) {
        const homeEmoji = getEmoji('home') || '🏠';
        const desc = commandMention
            ? `${lang.panelClosed}\n${homeEmoji} Run ${commandMention} again to reopen it.`
            : lang.panelClosed;
        const c = _feedbackCard('warning', lang.panelClosedTitle, desc, ACCENT.neutral);
        c._isTerminalSessionCard = true;
        return c;
    },
};

function card(title, sections = [], rows = [], accent = ACCENT.primary) {
    return buildCard({
        title,
        accentColor: accent,
        sections: sections.map(s => typeof s === 'string' ? s : (s?.text || String(s))),
        rows: rows.filter(Boolean),
    });
}

module.exports = { buildCard, cards, card };
