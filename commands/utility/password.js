

'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const crypto = require('crypto');

const rawLang = require('../../events/loadLanguage');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const {
    createSessionManager,
    buildCard,
    cards,
    btn,
    linkBtn,
    closeBtn,
    deferUpdate,
    deferReply,
    sendV2,
    editV2,
    closeAndAutoDelete,
    replyUnauthorized,
    replyEphemeral,
    ACCENT,
    createInterpolatableProxy
} = require('../../UI');

const lang = {
    ...rawLang,
    password: createInterpolatableProxy(rawLang.password)
};

const sessions = createSessionManager({
    ttlMs: 10 * 60 * 1000,
    buildExpiredCard: () => cards.expired(),
});

function card(title, sections, rows = [], accent = ACCENT.primary) {
    return buildCard({
        title: String(title || ''),
        accentColor: accent,
        sections: sections.map(s => (typeof s === 'object' && s !== null ? s.text || '' : String(s))),
        rows: rows.filter(Boolean),
    });
}

function generatePassword(length, type, excludeSimilar) {
    let charset = '';
    switch (type) {
        case 'ultra':
            charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
            break;
        case 'secure':
            charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
            break;
        case 'alphanum':
            charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            break;
        case 'letters':
            charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
            break;
        case 'numbers':
            charset = '0123456789';
            break;
        case 'pronounce':
            return generatePronounceable(length);
    }
    if (excludeSimilar) charset = charset.replace(/[0O1lI]/g, '');
    let password = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) password += charset[array[i] % charset.length];
    return password;
}

function generatePronounceable(length) {
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    const vowels = 'aeiou';
    let pw = '';
    for (let i = 0; i < length; i++) {
        const pool = i % 2 === 0 ? consonants : vowels;
        pw += pool[Math.floor(Math.random() * pool.length)];
    }
    return pw;
}

function generatePassphrase(wordCount, includeNumbers, includeSymbols) {
    const words = [
        'apple', 'beach', 'cloud', 'dance', 'eagle', 'flame', 'grape', 'house',
        'island', 'jungle', 'knight', 'lemon', 'mouse', 'north', 'ocean', 'piano',
        'queen', 'river', 'stone', 'tiger', 'urban', 'voice', 'whale', 'xenon',
        'yellow', 'zebra', 'amber', 'blaze', 'coral', 'dream', 'ember', 'frost',
        'ghost', 'heart', 'ivory', 'jewel', 'kiwi', 'lunar', 'maple', 'novel',
        'orbit', 'prism', 'quill', 'raven', 'solar', 'thorn', 'unity', 'vivid',
        'wrath', 'zephyr', 'atlas', 'bloom', 'crest', 'delta', 'fable', 'gleam',
    ];
    const selected = [];
    for (let i = 0; i < wordCount; i++) {
        const w = words[Math.floor(Math.random() * words.length)];
        selected.push(w.charAt(0).toUpperCase() + w.slice(1));
    }
    let sepChar = '-';
    if (includeNumbers) sepChar = Math.floor(Math.random() * 10).toString();
    if (includeSymbols) sepChar = ['!', '@', '#', '%', '&', '*'][Math.floor(Math.random() * 6)];
    return selected.join(sepChar);
}

function getPresetConfig(template) {
    const p = lang.password.presets[template] || lang.password.presets.banking;
    const presets = {
        banking: { name: p.name, length: 24, type: 'ultra', excludeSimilar: true, color: 0x1E3D59, security: p.security, useCase: p.useCase, recommendations: [p.rec1, p.rec2, p.rec3] },
        social: { name: p.name, length: 18, type: 'secure', excludeSimilar: true, color: 0x3498DB, security: p.security, useCase: p.useCase, recommendations: [p.rec1, p.rec2, p.rec3] },
        gaming: { name: p.name, length: 16, type: 'secure', excludeSimilar: true, color: 0x9B59B6, security: p.security, useCase: p.useCase, recommendations: [p.rec1, p.rec2, p.rec3] },
        email: { name: p.name, length: 20, type: 'ultra', excludeSimilar: true, color: 0xE74C3C, security: p.security, useCase: p.useCase, recommendations: [p.rec1, p.rec2, p.rec3] },
        wifi: { name: p.name, length: 22, type: 'secure', excludeSimilar: true, color: 0x00FF88, security: p.security, useCase: p.useCase, recommendations: [p.rec1, p.rec2, p.rec3] },
        corporate: { name: p.name, length: 20, type: 'ultra', excludeSimilar: true, color: 0x2C3E50, security: p.security, useCase: p.useCase, recommendations: [p.rec1, p.rec2, p.rec3] },
    };
    return presets[template] || presets.banking;
}

function analyzeStrength(password) {
    let score = 0;
    let entropy = 0;
    let charTypes = 0;
    const recommendations = [];

    if (password.length >= 12) score += 25;
    else if (password.length >= 8) score += 15;
    else recommendations.push(lang.password.strength.recMin12);

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNums = /[0-9]/.test(password);
    const hasSyms = /[^A-Za-z0-9]/.test(password);

    if (hasLower) { score += 5; charTypes++; }
    if (hasUpper) { score += 5; charTypes++; }
    if (hasNums) { score += 10; charTypes++; }
    if (hasSyms) { score += 15; charTypes++; }

    if (!hasLower) recommendations.push(lang.password.strength.recAddLower);
    if (!hasUpper) recommendations.push(lang.password.strength.recAddUpper);
    if (!hasNums) recommendations.push(lang.password.strength.recAddNums);
    if (!hasSyms) recommendations.push(lang.password.strength.recAddSyms);

    let charsetSize = 0;
    if (hasLower) charsetSize += 26;
    if (hasUpper) charsetSize += 26;
    if (hasNums) charsetSize += 10;
    if (hasSyms) charsetSize += 32;
    if (charsetSize > 0) entropy = Math.log2(Math.pow(charsetSize, password.length));

    if (!/(.)\1{2,}/.test(password)) score += 10;
    else recommendations.push(lang.password.strength.recNoRepeat);

    if (!/012|123|234|345|456|567|678|789|890|abc|bcd|cde|def/.test(password.toLowerCase())) score += 10;
    else recommendations.push(lang.password.strength.recNoSeq);

    const common = ['password', 'admin', 'user', 'login', '1234', 'qwerty'];
    if (!common.some(w => password.toLowerCase().includes(w))) score += 10;
    else recommendations.push(lang.password.strength.recNoCommon);

    score = Math.min(score, 100);
    let level;
    if (score >= 80) level = lang.password.strength.excellent;
    else if (score >= 60) level = lang.password.strength.good;
    else if (score >= 40) level = lang.password.strength.fair;
    else level = lang.password.strength.weak;

    const combinations = charsetSize > 0 ? Math.pow(charsetSize, password.length) : 0;
    const crackTime = {
        online: fmtTime(combinations / 2000),
        offline: fmtTime(combinations / 2000000000),
        gpu: fmtTime(combinations / 200000000000),
    };

    return { score, level, entropy, charTypes, recommendations: recommendations.length ? recommendations : [lang.password.strength.recLooksGreat], crackTime };
}

function fmtTime(seconds) {
    if (!isFinite(seconds) || seconds > 31536000000) return lang.password.crackTime.impossible;
    if (seconds < 60) return lang.password.crackTime.seconds({ count: Math.round(seconds) });
    if (seconds < 3600) return lang.password.crackTime.minutes({ count: Math.round(seconds / 60) });
    if (seconds < 86400) return lang.password.crackTime.hours({ count: Math.round(seconds / 3600) });
    if (seconds < 31536000) return lang.password.crackTime.days({ count: Math.round(seconds / 86400) });
    return lang.password.crackTime.years({ count: Math.round(seconds / 31536000) });
}

function strengthColor(score) {
    if (score >= 80) return 0x00FF88;
    if (score >= 60) return 0xF39C12;
    if (score >= 40) return 0xFF8C00;
    return 0xFF4757;
}

function strengthBar(score) {
    const filled = Math.floor(score / 5);
    return '\u2588'.repeat(filled) + '\u2591'.repeat(20 - filled);
}

function tabsRow(active) {
    const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
    return new ActionRowBuilder().addComponents(
        btn(lang.password.nav.generate, 'pwd_tab_generate', 'lock', s('generate')),
        btn(lang.password.nav.preset, 'pwd_tab_preset', 'star', s('preset')),
        btn(lang.password.nav.passphrase, 'pwd_tab_passphrase', 'document', s('passphrase')),
        btn(lang.password.nav.analyze, 'pwd_tab_analyze', 'search', s('analyze')),
    );
}

function generateControlRow(state) {
    return new ActionRowBuilder().addComponents(
        btn(lang.password.nav.regenerate, 'pwd_regenerate', 'loop', ButtonStyle.Success),
        btn(lang.password.nav.bulk5, 'pwd_bulk_5', 'list', ButtonStyle.Secondary),
        closeBtn(lang.password.nav.close, 'pwd_close'),
    );
}

function presetSelectRow(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('pwd_sel_preset').setPlaceholder(lang.password.select.presetPlaceholder).addOptions([
            { label: lang.password.select.banking, value: 'banking', emoji: getButtonEmoji('security'), default: current === 'banking' },
            { label: lang.password.select.social, value: 'social', emoji: getButtonEmoji('chat'), default: current === 'social' },
            { label: lang.password.select.gaming, value: 'gaming', emoji: getButtonEmoji('games'), default: current === 'gaming' },
            { label: lang.password.select.email, value: 'email', emoji: getButtonEmoji('warning'), default: current === 'email' },
            { label: lang.password.select.wifi, value: 'wifi', emoji: getButtonEmoji('world'), default: current === 'wifi' },
            { label: lang.password.select.corporate, value: 'corporate', emoji: getButtonEmoji('crown'), default: current === 'corporate' },
        ])
    );
}

function typeSelectRow(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('pwd_sel_type').setPlaceholder(lang.password.select.typePlaceholder).addOptions([
            { label: lang.password.select.typeSecure, value: 'secure', emoji: getButtonEmoji('lock'), default: current === 'secure' },
            { label: lang.password.select.typeUltra, value: 'ultra', emoji: getButtonEmoji('security'), default: current === 'ultra' },
            { label: lang.password.select.typeAlphanum, value: 'alphanum', emoji: getButtonEmoji('document'), default: current === 'alphanum' },
            { label: lang.password.select.typeLetters, value: 'letters', emoji: getButtonEmoji('folder'), default: current === 'letters' },
            { label: lang.password.select.typeNumbers, value: 'numbers', emoji: getButtonEmoji('list'), default: current === 'numbers' },
            { label: lang.password.select.typePronounce, value: 'pronounce', emoji: getButtonEmoji('chat'), default: current === 'pronounce' },
        ])
    );
}

function lengthSelectRow(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('pwd_sel_length').setPlaceholder(lang.password.select.lengthPlaceholder).addOptions([
            { label: lang.password.select.len8, value: '8', default: current === 8 },
            { label: lang.password.select.len12, value: '12', default: current === 12 },
            { label: lang.password.select.len16, value: '16', default: current === 16 },
            { label: lang.password.select.len20, value: '20', default: current === 20 },
            { label: lang.password.select.len24, value: '24', default: current === 24 },
            { label: lang.password.select.len32, value: '32', default: current === 32 },
            { label: lang.password.select.len48, value: '48', default: current === 48 },
            { label: lang.password.select.len64, value: '64', default: current === 64 },
        ])
    );
}

function passphraseControlRow() {
    return new ActionRowBuilder().addComponents(
        btn(lang.password.nav.regenerate, 'pwd_regen_phrase', 'loop', ButtonStyle.Success),
        btn(lang.password.nav.moreWords, 'pwd_phrase_more', 'arrright', ButtonStyle.Secondary),
        btn(lang.password.nav.fewerWords, 'pwd_phrase_less', 'arrleft', ButtonStyle.Secondary),
        closeBtn(lang.password.nav.close, 'pwd_close'),
    );
}

function analyzeControlRow() {
    return new ActionRowBuilder().addComponents(
        linkBtn(lang.password.nav.support, 'support', 'https://discord.gg/xQF9f9yUEM'),
        closeBtn(lang.password.nav.close, 'pwd_close'),
    );
}

function viewGenerate(state) {
    const pw = state.password;
    const s = state.strength;
    const typeNames = {
        secure: lang.password.select.typeSecure,
        ultra: lang.password.select.typeUltra,
        alphanum: lang.password.select.typeAlphanum,
        letters: lang.password.select.typeLetters,
        numbers: lang.password.select.typeNumbers,
        pronounce: lang.password.select.typePronounce,
    };

    return card(
        lang.password.panel.generateTitle({ emoji: getEmoji('lock') }),
        [
            `### ${lang.password.content.genHeading({ emoji: getEmoji('security') })}\n\`\`\`\n${pw}\n\`\`\``,
            `### ${lang.password.content.strengthHeading({ emoji: getEmoji('analytics') })}\n${lang.password.content.scoreLevel({ score: s.score, level: s.level })}\n${lang.password.content.entropy({ entropy: s.entropy.toFixed(1) })}\n\`${strengthBar(s.score)}\``,
            `### ${lang.password.content.detailsHeading({ emoji: getEmoji('document') })}\n${lang.password.content.detailLength({ length: pw.length })}\n${lang.password.content.detailType({ type: typeNames[state.type] || state.type })}\n${lang.password.content.detailExclude({ exclude: state.excludeSimilar ? lang.password.content.yes : lang.password.content.no })}\n${lang.password.content.detailCharTypes({ charTypes: s.charTypes })}`,
            `### ${lang.password.content.crackHeading({ emoji: getEmoji('time') })}\n${lang.password.content.onlineAttack({ time: s.crackTime.online })}\n${lang.password.content.offlineAttack({ time: s.crackTime.offline })}\n${lang.password.content.gpuCluster({ time: s.crackTime.gpu })}`,
            `### ${lang.password.content.tipsHeading({ emoji: getEmoji('info') })}\n${lang.password.content.tipManager}\n${lang.password.content.tipUnique}\n${lang.password.content.tip2fa}`,
        ],
        [tabsRow('generate'), typeSelectRow(state.type), lengthSelectRow(state.length), generateControlRow(state)],
        strengthColor(s.score)
    );
}

function viewPreset(state) {
    const pw = state.password;
    const s = state.strength;
    const cfg = state.presetConfig;

    return card(
        lang.password.panel.presetTitle({ emoji: getEmoji('star'), name: cfg.name }),
        [
            `### ${lang.password.content.genHeading({ emoji: getEmoji('security') })}\n\`\`\`\n${pw}\n\`\`\``,
            `### ${lang.password.content.presetStrengthHeading({ emoji: getEmoji('analytics'), level: s.level, score: s.score })}\n\`${strengthBar(s.score)}\`\n${lang.password.content.entropy({ entropy: s.entropy.toFixed(1) })}\n${lang.password.content.detailCharTypes({ charTypes: s.charTypes })}`,
            `### ${lang.password.content.specsHeading({ emoji: getEmoji('document') })}\n${lang.password.content.specUseCase({ useCase: cfg.useCase })}\n${lang.password.content.detailLength({ length: pw.length })}\n${lang.password.content.specSecurity({ security: cfg.security })}`,
            `### ${lang.password.content.crackHeading({ emoji: getEmoji('time') })}\n${lang.password.content.onlineAttack({ time: s.crackTime.online })}\n${lang.password.content.offlineAttack({ time: s.crackTime.offline })}\n${lang.password.content.gpuCluster({ time: s.crackTime.gpu })}`,
            `### ${lang.password.content.recHeading({ emoji: getEmoji('info') })}\n${cfg.recommendations.map(r => `\u2022 ${r}`).join('\n')}`,
        ],
        [tabsRow('preset'), presetSelectRow(state.preset), new ActionRowBuilder().addComponents(
            btn(lang.password.nav.regenerate, 'pwd_regen_preset', 'loop', ButtonStyle.Success),
            closeBtn(lang.password.nav.close, 'pwd_close'),
        )],
        cfg.color
    );
}

function viewPassphrase(state) {
    const pw = state.password;
    const s = state.strength;

    return card(
        lang.password.panel.passphraseTitle({ emoji: getEmoji('document') }),
        [
            `### ${lang.password.content.genPassphraseHeading({ emoji: getEmoji('security') })}\n\`\`\`\n${pw}\n\`\`\``,
            `### ${lang.password.content.presetStrengthHeading({ emoji: getEmoji('analytics'), level: s.level, score: s.score })}\n\`${strengthBar(s.score)}\`\n${lang.password.content.entropy({ entropy: s.entropy.toFixed(1) })}`,
            `### ${lang.password.content.detailsHeading({ emoji: getEmoji('document') })}\n${lang.password.content.phraseWords({ count: state.phraseWords })}\n${lang.password.content.phraseNumbers({ value: state.phraseNumbers ? lang.password.content.valBetweenWords : lang.password.content.valNone })}\n${lang.password.content.phraseSymbols({ value: state.phraseSymbols ? lang.password.content.valBetweenWords : lang.password.content.valNone })}\n${lang.password.content.detailLength({ length: pw.length })}`,
            `### ${lang.password.content.crackHeading({ emoji: getEmoji('time') })}\n${lang.password.content.onlineAttack({ time: s.crackTime.online })}\n${lang.password.content.offlineAttack({ time: s.crackTime.offline })}\n${lang.password.content.gpuCluster({ time: s.crackTime.gpu })}`,
            `### ${lang.password.content.memoryHeading({ emoji: getEmoji('info') })}\n${lang.password.content.memStory}\n${lang.password.content.memPractice}\n${lang.password.content.memEasier}`,
        ],
        [tabsRow('passphrase'), passphraseControlRow()],
        0x8B5CF6
    );
}

function viewBulk(state) {
    const passwords = state.bulkPasswords;
    const list = passwords.map((pw, i) => {
        const s = analyzeStrength(pw);
        return `**${i + 1}.** \`${pw}\`\n\u2003\u2003${getEmoji('analytics')} ${s.level} (${s.score}/100) \u2022 ${pw.length} chars`;
    }).join('\n');

    return card(
        lang.password.panel.bulkTitle({ emoji: getEmoji('list') }),
        [
            `### ${lang.password.content.bulkHeading({ emoji: getEmoji('security'), count: passwords.length })}\n${lang.password.content.bulkLength({ length: state.length })}\n${lang.password.content.bulkType}`,
            `### ${lang.password.content.bulkListHeading({ emoji: getEmoji('lock') })}\n${list}`,
            `### ${lang.password.content.bulkUsageHeading({ emoji: getEmoji('info') })}\n${lang.password.content.tipDiff}\n${lang.password.content.tipStoreAll}\n${lang.password.content.tipNoReuse}`,
        ],
        [tabsRow('generate'), new ActionRowBuilder().addComponents(
            btn(lang.password.nav.regenerateAll, 'pwd_regen_bulk', 'loop', ButtonStyle.Success),
            closeBtn(lang.password.nav.close, 'pwd_close'),
        )],
        0x10B981
    );
}

function viewAnalyze(state) {
    const s = state.analysisResult;
    const pw = state.analyzedPassword;
    const masked = pw.charAt(0) + '*'.repeat(Math.max(0, pw.length - 2)) + (pw.length > 1 ? pw.charAt(pw.length - 1) : '');

    const statusText = s.score >= 80 ? lang.password.strength.verdictExcellent({ emoji: getEmoji('tick') })
        : s.score >= 60 ? lang.password.strength.verdictGood({ emoji: getEmoji('warning') })
            : s.score >= 40 ? lang.password.strength.verdictFair({ emoji: getEmoji('warning') })
                : lang.password.strength.verdictWeak({ emoji: getEmoji('cross') });

    return card(
        lang.password.panel.analyzeTitle({ emoji: getEmoji('search') }),
        [
            `### ${lang.password.content.analyzedHeading({ emoji: getEmoji('lock') })}\n\`\`\`\n${masked}\n\`\`\``,
            `### ${lang.password.content.strengthHeading({ emoji: getEmoji('analytics') })}: ${s.score}/100\n\`${strengthBar(s.score)}\`\n${lang.password.content.scoreLevelDetail({ level: s.level, entropy: s.entropy.toFixed(1), charTypes: s.charTypes, length: pw.length })}`,
            `### ${lang.password.content.crackHeading({ emoji: getEmoji('time') })}\n${lang.password.content.onlineAttack({ time: s.crackTime.online })}\n${lang.password.content.offlineAttack({ time: s.crackTime.offline })}\n${lang.password.content.gpuCluster({ time: s.crackTime.gpu })}`,
            `### ${lang.password.content.recHeading({ emoji: getEmoji('info') })}\n${s.recommendations.map(r => `\u2022 ${r}`).join('\n')}`,
            `### ${lang.password.content.verdictHeading({ emoji: getEmoji('security') })}\n${statusText}`,
        ],
        [tabsRow('analyze'), analyzeControlRow()],
        strengthColor(s.score)
    );
}

function renderState(state) {
    switch (state.mode) {
        case 'preset': return [viewPreset(state)];
        case 'passphrase': return [viewPassphrase(state)];
        case 'bulk': return [viewBulk(state)];
        case 'analyze': return [viewAnalyze(state)];
        default: return [viewGenerate(state)];
    }
}

function genAndStore(state) {
    state.password = generatePassword(state.length, state.type, state.excludeSimilar);
    state.strength = analyzeStrength(state.password);
}

function genPresetAndStore(state) {
    const cfg = getPresetConfig(state.preset);
    state.presetConfig = cfg;
    state.password = generatePassword(cfg.length, cfg.type, cfg.excludeSimilar);
    state.strength = analyzeStrength(state.password);
}

function genPhraseAndStore(state) {
    state.password = generatePassphrase(state.phraseWords, state.phraseNumbers, state.phraseSymbols);
    state.strength = analyzeStrength(state.password);
}

function genBulkAndStore(state) {
    state.bulkPasswords = [];
    for (let i = 0; i < 5; i++) state.bulkPasswords.push(generatePassword(state.length, 'secure', true));
}

function applyInteraction(customId, values, state) {
    
    if (customId === 'pwd_tab_generate') {
        state.mode = 'generate';
        genAndStore(state);
        return;
    }
    if (customId === 'pwd_tab_preset') {
        state.mode = 'preset';
        if (!state.preset) state.preset = 'banking';
        genPresetAndStore(state);
        return;
    }
    if (customId === 'pwd_tab_passphrase') {
        state.mode = 'passphrase';
        genPhraseAndStore(state);
        return;
    }
    if (customId === 'pwd_tab_analyze') {
        state.mode = 'analyze';
        if (!state.analysisResult) {
            state.analyzedPassword = state.password || 'example';
            state.analysisResult = analyzeStrength(state.analyzedPassword);
        }
        return;
    }

    
    if (customId === 'pwd_regenerate') { genAndStore(state); return; }
    if (customId === 'pwd_regen_preset') { genPresetAndStore(state); return; }
    if (customId === 'pwd_regen_phrase') { genPhraseAndStore(state); return; }
    if (customId === 'pwd_regen_bulk') { genBulkAndStore(state); return; }

    
    if (customId === 'pwd_bulk_5') {
        state.mode = 'bulk';
        genBulkAndStore(state);
        return;
    }

    
    if (customId === 'pwd_phrase_more') {
        state.phraseWords = Math.min(8, (state.phraseWords || 4) + 1);
        genPhraseAndStore(state);
        return;
    }
    if (customId === 'pwd_phrase_less') {
        state.phraseWords = Math.max(3, (state.phraseWords || 4) - 1);
        genPhraseAndStore(state);
        return;
    }

    
    if (customId === 'pwd_sel_type') {
        state.type = String(values[0] || 'secure');
        genAndStore(state);
        return;
    }
    if (customId === 'pwd_sel_length') {
        state.length = parseInt(values[0]) || 16;
        genAndStore(state);
        return;
    }
    if (customId === 'pwd_sel_preset') {
        state.preset = String(values[0] || 'banking');
        genPresetAndStore(state);
        return;
    }
}

async function handleComponent(interaction) {
    if (!interaction.customId?.startsWith('pwd_')) return false;

    const messageId = interaction.message.id;
    const clickerId = interaction.user.id;

    
    if (interaction.customId === 'pwd_close') {
        const session = sessions.get(messageId);
        if (session && clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, lang.password.session.unauthorized({ emoji: getEmoji('cross'), userId: session.state.userId }));
            return true;
        }
        await deferUpdate(interaction);
        sessions.delete(messageId);
        const closed = cards.info({
            title: lang.password.panel.closedTitle({ emoji: getEmoji('warning') }),
            description: lang.password.panel.closedDesc,
        });
        await closeAndAutoDelete(interaction, closed, 2000);
        return true;
    }

    
    const session = sessions.get(messageId);
    if (!session) {
        await replyEphemeral(interaction, lang.password.session.expired({ emoji: getEmoji('warning') }));
        return true;
    }
    if (clickerId !== session.state.userId) {
        await replyUnauthorized(interaction, lang.password.session.unauthorized({ emoji: getEmoji('cross'), userId: session.state.userId }));
        return true;
    }

    
    await deferUpdate(interaction);
    sessions.touch(interaction.client, interaction.channelId, messageId);

    
    const { state } = session;
    try { applyInteraction(interaction.customId, interaction.values ?? [], state); }
    catch (err) { console.error('[Password] applyInteraction:', err); return true; }

    
    try {
        const components = renderState(state);
        await editV2(interaction, components);
    } catch (err) {
        console.error('[Password] message.edit failed:', err.message);
        try {
            const errCard = card(
                lang.password.panel.renderErrorTitle({ emoji: getEmoji('warning') }),
                [`\`${String(err.message || '').slice(0, 120)}\``, lang.password.panel.renderErrorSub],
                [tabsRow(state.mode || 'generate')],
                ACCENT.danger
            );
            await editV2(interaction, errCard);
        } catch { }
    }
    return true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('password')
        .setDescription('Interactive password generator dashboard with presets, passphrases, and analysis')
        .addSubcommand(sub => sub
            .setName('generate')
            .setDescription('Generate a custom password')
            .addIntegerOption(o => o.setName('length').setDescription('Password length (8-128)').setMinValue(8).setMaxValue(128).setRequired(false))
            .addStringOption(o => o.setName('type').setDescription('Password type').addChoices(
                { name: 'Secure (Mixed)', value: 'secure' }, { name: 'Ultra Secure', value: 'ultra' },
                { name: 'Alphanumeric Only', value: 'alphanum' }, { name: 'Letters Only', value: 'letters' },
                { name: 'Numbers Only', value: 'numbers' }, { name: 'Pronounceable', value: 'pronounce' },
            ))
            .addBooleanOption(o => o.setName('exclude_similar').setDescription('Exclude similar characters (0, O, l, I)').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('preset')
            .setDescription('Generate password from preset templates')
            .addStringOption(o => o.setName('template').setDescription('Choose a preset template').setRequired(true).addChoices(
                { name: 'Banking (Ultra Secure)', value: 'banking' }, { name: 'Social Media', value: 'social' },
                { name: 'Gaming', value: 'gaming' }, { name: 'Email Account', value: 'email' },
                { name: 'Wi-Fi Password', value: 'wifi' }, { name: 'Corporate', value: 'corporate' },
            )))
        .addSubcommand(sub => sub
            .setName('passphrase')
            .setDescription('Generate a memorable passphrase')
            .addIntegerOption(o => o.setName('words').setDescription('Number of words (3-8)').setMinValue(3).setMaxValue(8).setRequired(false))
            .addBooleanOption(o => o.setName('numbers').setDescription('Add numbers between words').setRequired(false))
            .addBooleanOption(o => o.setName('symbols').setDescription('Add symbols between words').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('bulk')
            .setDescription('Generate multiple passwords at once')
            .addIntegerOption(o => o.setName('count').setDescription('Number of passwords (2-10)').setMinValue(2).setMaxValue(10).setRequired(true))
            .addIntegerOption(o => o.setName('length').setDescription('Password length').setMinValue(8).setMaxValue(64).setRequired(false)))
        .addSubcommand(sub => sub
            .setName('analyze')
            .setDescription('Analyze password strength')
            .addStringOption(o => o.setName('password').setDescription('Password to analyze').setRequired(true))),

    aliases: ['pass', 'pw', 'genpass'],
    category: 'utility',
    description: 'Interactive password generator dashboard with presets, passphrases, and analysis',

    handleComponent,

    async execute(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await deferReply(interaction);
            }
        } catch (err) {
            console.error('[Password] deferReply failed:', err.message);
            return;
        }

        const subcommand = isSlash ? interaction.options.getSubcommand() : 'generate';
        const userId = isSlash ? interaction.user.id : interaction.author.id;

        
        const state = {
            mode: 'generate',
            userId,
            type: 'secure',
            length: 16,
            excludeSimilar: true,
            password: '',
            strength: null,
            preset: 'banking',
            presetConfig: null,
            phraseWords: 4,
            phraseNumbers: false,
            phraseSymbols: false,
            bulkPasswords: [],
            analyzedPassword: '',
            analysisResult: null,
        };

        
        switch (subcommand) {
            case 'generate': {
                state.mode = 'generate';
                state.length = (isSlash ? interaction.options.getInteger('length') : null) || 16;
                state.type = (isSlash ? interaction.options.getString('type') : null) || 'secure';
                state.excludeSimilar = isSlash ? (interaction.options.getBoolean('exclude_similar') ?? true) : true;
                genAndStore(state);
                break;
            }
            case 'preset': {
                state.mode = 'preset';
                state.preset = (isSlash ? interaction.options.getString('template') : null) || 'banking';
                genPresetAndStore(state);
                break;
            }
            case 'passphrase': {
                state.mode = 'passphrase';
                state.phraseWords = (isSlash ? interaction.options.getInteger('words') : null) || 4;
                state.phraseNumbers = isSlash ? (interaction.options.getBoolean('numbers') ?? false) : false;
                state.phraseSymbols = isSlash ? (interaction.options.getBoolean('symbols') ?? false) : false;
                genPhraseAndStore(state);
                break;
            }
            case 'bulk': {
                state.mode = 'bulk';
                const count = (isSlash ? interaction.options.getInteger('count') : null) || 5;
                state.length = (isSlash ? interaction.options.getInteger('length') : null) || 16;
                state.bulkPasswords = [];
                for (let i = 0; i < count; i++) state.bulkPasswords.push(generatePassword(state.length, 'secure', true));
                break;
            }
            case 'analyze': {
                state.mode = 'analyze';
                state.analyzedPassword = (isSlash ? interaction.options.getString('password') : '') || 'example';
                state.analysisResult = analyzeStrength(state.analyzedPassword);
                break;
            }
        }

        try {
            const components = renderState(state);
            const message = await sendV2(interaction, components);
            if (message) sessions.open(interaction.client, interaction.channelId, message.id, state);
        } catch (err) {
            console.error('[Password] Initial render failed:', err.message);
            const errCard = cards.error(
                lang.password.panel.renderErrorTitle({ emoji: getEmoji('cross') }),
                lang.password.panel.loadError({ emoji: getEmoji('cross') })
            );
            await sendV2(interaction, errCard).catch(() => { });
        }
    },
};

