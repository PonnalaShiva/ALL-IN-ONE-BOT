


const HOMOGLYPH_MAP = {
    
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
    'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X',
    'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
    
    
    'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v',
    'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ω': 'w',
    'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M',
    'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
    
    
    '𝐚': 'a', '𝐛': 'b', '𝐜': 'c', '𝐝': 'd', '𝐞': 'e', '𝐟': 'f', '𝐠': 'g',
    '𝐡': 'h', '𝐢': 'i', '𝐣': 'j', '𝐤': 'k', '𝐥': 'l', '𝐦': 'm', '𝐧': 'n',
    '𝐨': 'o', '𝐩': 'p', '𝐪': 'q', '𝐫': 'r', '𝐬': 's', '𝐭': 't', '𝐮': 'u',
    '𝐯': 'v', '𝐰': 'w', '𝐱': 'x', '𝐲': 'y', '𝐳': 'z',
    
    
    '𝕒': 'a', '𝕓': 'b', '𝕔': 'c', '𝕕': 'd', '𝕖': 'e', '𝕗': 'f', '𝕘': 'g',
    '𝕙': 'h', '𝕚': 'i', '𝕛': 'j', '𝕜': 'k', '𝕝': 'l', '𝕞': 'm', '𝕟': 'n',
    '𝕠': 'o', '𝕡': 'p', '𝕢': 'q', '𝕣': 'r', '𝕤': 's', '𝕥': 't', '𝕦': 'u',
    '𝕧': 'v', '𝕨': 'w', '𝕩': 'x', '𝕪': 'y', '𝕫': 'z',
    
    
    '𝑎': 'a', '𝑏': 'b', '𝑐': 'c', '𝑑': 'd', '𝑒': 'e', '𝑓': 'f', '𝑔': 'g',
    '𝘢': 'a', '𝘣': 'b', '𝘤': 'c', '𝘥': 'd', '𝘦': 'e', '𝘧': 'f', '𝘨': 'g',
    
    
    'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e', 'ｆ': 'f', 'ｇ': 'g',
    'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j', 'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n',
    'ｏ': 'o', 'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't', 'ｕ': 'u',
    'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z',
    'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E', 'Ｆ': 'F', 'Ｇ': 'G',
    'Ｈ': 'H', 'Ｉ': 'I', 'Ｊ': 'J', 'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ｎ': 'N',
    'Ｏ': 'O', 'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R', 'Ｓ': 'S', 'Ｔ': 'T', 'Ｕ': 'U',
    'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X', 'Ｙ': 'Y', 'Ｚ': 'Z',
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
    
    
    'ℓ': 'l', 'ⅰ': 'i', 'ⅱ': 'ii', 'ⅲ': 'iii', 'ⅳ': 'iv', 'ⅴ': 'v',
    'ℯ': 'e', 'ℊ': 'g', 'ℎ': 'h', 'ℐ': 'I', 'ℒ': 'L', 'ℳ': 'M',
    'ℕ': 'N', 'ℙ': 'P', 'ℚ': 'Q', 'ℝ': 'R', 'ℤ': 'Z',
    
    
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
    
    
    '@': 'a', '$': 's', '!': 'i', '|': 'l', '0': 'o', '1': 'l', '3': 'e',
    '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
    
    
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ė': 'e', 'ę': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'į': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'ō': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u',
    'ñ': 'n', 'ń': 'n', 'ç': 'c', 'ć': 'c', 'č': 'c',
    'ß': 'ss', 'ÿ': 'y', 'ý': 'y', 'ž': 'z', 'ź': 'z', 'ż': 'z'
};

const LEETSPEAK_MAP = {
    '4': 'a', '@': 'a', '/-\\': 'a', '^': 'a',
    '8': 'b', '|3': 'b', '13': 'b',
    '(': 'c', '<': 'c', '{': 'c',
    '|)': 'd', '[)': 'd',
    '3': 'e', '€': 'e',
    '|=': 'f', 'ph': 'f',
    '6': 'g', '9': 'g', '&': 'g',
    '#': 'h', '|-|': 'h', '}{': 'h',
    '1': 'i', '!': 'i', '|': 'i',
    '_|': 'j', ']': 'j',
    '|<': 'k', '|{': 'k',
    '1': 'l', '|_': 'l', '£': 'l',
    '|\\/|': 'm', '/\\/\\': 'm', '^^': 'm',
    '|\\|': 'n', '/\\/': 'n',
    '0': 'o', '()': 'o', '[]': 'o',
    '|*': 'p', '|>': 'p',
    '0_': 'q', '(_,)': 'q',
    '|2': 'r', '®': 'r',
    '5': 's', '$': 's', '§': 's',
    '7': 't', '+': 't', '†': 't',
    '|_|': 'u', '\\_/': 'u', '(_)': 'u',
    '\\/': 'v', '\\|/': 'v',
    '\\/\\/': 'w', 'vv': 'w', '\\^/': 'w',
    '><': 'x', '}{': 'x', '×': 'x',
    '`/': 'y', '¥': 'y',
    '2': 'z', '%': 'z'
};

const ZERO_WIDTH_CHARS = [
    '\u200B', 
    '\u200C', 
    '\u200D', 
    '\u200E', 
    '\u200F', 
    '\u2060', 
    '\u2061', 
    '\u2062', 
    '\u2063', 
    '\u2064', 
    '\uFEFF', 
    '\u00AD', 
    '\u034F', 
    '\u061C', 
    '\u115F', 
    '\u1160', 
    '\u17B4', 
    '\u17B5', 
    '\u180E', 
    '\u2000', 
    '\u2001', 
    '\u2002', 
    '\u2003', 
    '\u2004', 
    '\u2005', 
    '\u2006', 
    '\u2007', 
    '\u2008', 
    '\u2009', 
    '\u200A', 
    '\u202F', 
    '\u205F', 
    '\u3000', 
    '\u3164', 
    '\uFFA0'  
];

const CONFUSABLE_DOMAINS = {
    'discord': ['d1scord', 'disc0rd', 'discrd', 'dlscord', 'disсord', 'dіscord', 'discоrd', 'discorԁ'],
    'nitro': ['n1tro', 'nitr0', 'nltro', 'nіtro', 'nitrо'],
    'steam': ['stearn', 'steain', 'stеam', 'steаm', 'stearn'],
    'paypal': ['paypa1', 'раypal', 'paypаl', 'paypaі'],
    'gift': ['g1ft', 'gіft', 'gіfт'],
    'free': ['fr3e', 'frее', 'frеe'],
    'login': ['log1n', 'lоgin', 'logіn'],
    'verify': ['ver1fy', 'vеrify', 'verіfy'],
    'account': ['acc0unt', 'асcount', 'accоunt']
};

class AntiEvasion {
    constructor(config = {}) {
        this.config = {
            normalizeUnicode: true,
            removeZeroWidth: true,
            detectHomoglyphs: true,
            decodeUrls: true,
            removeInvisibleChars: true,
            normalizeWhitespace: true,
            detectLeetSpeak: true,
            customMappings: new Map(),
            ...config
        };
        
        
        this.homoglyphRegex = this._buildHomoglyphRegex();
        this.zeroWidthRegex = new RegExp(`[${ZERO_WIDTH_CHARS.join('')}]', 'g`);
    }

    _buildHomoglyphRegex() {
        const chars = Object.keys(HOMOGLYPH_MAP).map(c => 
            c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        ).join('');
        return new RegExp(`[${chars}]`, 'g');
    }

    normalize(text, options = {}) {
        const config = { ...this.config, ...options };
        const changes = [];
        let normalized = text;
        let evasionScore = 0;
        
        
        if (config.decodeUrls) {
            const decoded = this._decodeUrl(normalized);
            if (decoded.changed) {
                changes.push({ type: 'url_decode', count: decoded.count });
                evasionScore += decoded.count * 2;
            }
            normalized = decoded.text;
        }
        
        
        if (config.removeZeroWidth) {
            const cleaned = this._removeZeroWidth(normalized);
            if (cleaned.changed) {
                changes.push({ type: 'zero_width', count: cleaned.count });
                evasionScore += cleaned.count * 5; 
            }
            normalized = cleaned.text;
        }
        
        
        if (config.removeInvisibleChars) {
            const cleaned = this._removeInvisible(normalized);
            if (cleaned.changed) {
                changes.push({ type: 'invisible_chars', count: cleaned.count });
                evasionScore += cleaned.count * 3;
            }
            normalized = cleaned.text;
        }
        
        
        if (config.detectHomoglyphs) {
            const converted = this._normalizeHomoglyphs(normalized);
            if (converted.changed) {
                changes.push({ type: 'homoglyphs', count: converted.count });
                evasionScore += converted.count * 4;
            }
            normalized = converted.text;
        }
        
        
        if (config.normalizeUnicode) {
            const nfcNormalized = normalized.normalize('NFC');
            if (nfcNormalized !== normalized) {
                changes.push({ type: 'unicode_normalize', count: 1 });
                evasionScore += 2;
            }
            normalized = nfcNormalized;
        }
        
        
        if (config.detectLeetSpeak) {
            const deleet = this._normalizeLeetSpeak(normalized);
            if (deleet.changed) {
                changes.push({ type: 'leetspeak', count: deleet.count });
                evasionScore += deleet.count * 2;
            }
            normalized = deleet.text;
        }
        
        
        if (config.normalizeWhitespace) {
            const wsNormalized = this._normalizeWhitespace(normalized);
            if (wsNormalized !== normalized) {
                changes.push({ type: 'whitespace', count: 1 });
            }
            normalized = wsNormalized;
        }
        
        
        if (config.customMappings?.size > 0) {
            for (const [from, to] of config.customMappings) {
                if (normalized.includes(from)) {
                    normalized = normalized.split(from).join(to);
                    changes.push({ type: 'custom_mapping', from, to });
                }
            }
        }
        
        return {
            original: text,
            normalized: normalized.toLowerCase(), 
            normalizedPreserveCase: normalized,
            changes,
            evasionScore,
            isEvasionAttempt: evasionScore >= 5,
            evasionDetails: this._getEvasionDetails(changes, evasionScore)
        };
    }

    _decodeUrl(text) {
        let count = 0;
        let result = text;
        
        try {
            
            const matches = text.match(/%[0-9A-Fa-f]{2}/g);
            if (matches) {
                count = matches.length;
                result = decodeURIComponent(text);
            }
        } catch (e) {
            
            result = text.replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
                try {
                    count++;
                    return String.fromCharCode(parseInt(hex, 16));
                } catch {
                    return match;
                }
            });
        }
        
        return { text: result, changed: count > 0, count };
    }

    _removeZeroWidth(text) {
        const matches = text.match(this.zeroWidthRegex);
        const count = matches ? matches.length : 0;
        const result = text.replace(this.zeroWidthRegex, '');
        
        return { text: result, changed: count > 0, count };
    }

    _removeInvisible(text) {
        let count = 0;
        
        
        const result = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, () => {
            count++;
            return '';
        });
        
        return { text: result, changed: count > 0, count };
    }

    _normalizeHomoglyphs(text) {
        let count = 0;
        
        const result = text.replace(this.homoglyphRegex, (char) => {
            if (HOMOGLYPH_MAP[char]) {
                count++;
                return HOMOGLYPH_MAP[char];
            }
            return char;
        });
        
        return { text: result, changed: count > 0, count };
    }

    _normalizeLeetSpeak(text) {
        let count = 0;
        let result = text;
        
        
        const sortedKeys = Object.keys(LEETSPEAK_MAP).sort((a, b) => b.length - a.length);
        
        for (const leet of sortedKeys) {
            if (result.includes(leet)) {
                const regex = new RegExp(leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const matches = result.match(regex);
                if (matches) {
                    count += matches.length;
                    result = result.replace(regex, LEETSPEAK_MAP[leet]);
                }
            }
        }
        
        return { text: result, changed: count > 0, count };
    }

    _normalizeWhitespace(text) {
        return text
            .replace(/\s+/g, ' ')  
            .replace(/^\s+|\s+$/g, ''); 
    }

    _getEvasionDetails(changes, score) {
        if (changes.length === 0) {
            return { severity: 'none', description: 'No evasion detected' };
        }
        
        const details = changes.map(c => {
            switch (c.type) {
                case 'zero_width': return `${c.count} zero-width characters (strong evasion indicator)`;
                case 'homoglyphs': return `${c.count} homoglyph characters`;
                case 'leetspeak': return `${c.count} leetspeak substitutions`;
                case 'url_decode': return `${c.count} URL-encoded characters`;
                case 'invisible_chars': return `${c.count} invisible/control characters`;
                case 'unicode_normalize': return 'Unicode normalization applied';
                case 'whitespace': return 'Whitespace normalized';
                default: return c.type;
            }
        });
        
        let severity = 'low';
        if (score >= 20) severity = 'critical';
        else if (score >= 10) severity = 'high';
        else if (score >= 5) severity = 'medium';
        
        return {
            severity,
            score,
            description: details.join('; '),
            changes
        };
    }

    checkConfusableDomains(text) {
        const normalized = this.normalize(text).normalized;
        const matches = [];
        
        for (const [legitimate, confusables] of Object.entries(CONFUSABLE_DOMAINS)) {
            
            for (const confusable of confusables) {
                if (text.toLowerCase().includes(confusable) || 
                    normalized.includes(confusable)) {
                    matches.push({
                        found: confusable,
                        legitimate,
                        type: 'domain_spoof'
                    });
                }
            }
            
            
            if (normalized.includes(legitimate) && !text.toLowerCase().includes(legitimate)) {
                matches.push({
                    found: text,
                    legitimate,
                    type: 'hidden_domain'
                });
            }
        }
        
        return {
            isConfusable: matches.length > 0,
            matches,
            details: matches.map(m => 
                `"${m.found}" appears to be spoofing "${m.legitimate}"`
            ).join('; ')
        };
    }

    analyzeUrl(url) {
        const result = {
            original: url,
            normalized: null,
            isEvasion: false,
            evasionScore: 0,
            flags: [],
            hostname: null,
            normalizedHostname: null
        };
        
        try {
            
            const normalizedUrl = this.normalize(url);
            result.normalized = normalizedUrl.normalized;
            result.evasionScore = normalizedUrl.evasionScore;
            
            
            let urlObj;
            try {
                urlObj = new URL(url);
            } catch {
                
                try {
                    urlObj = new URL('https://' + url);
                } catch {
                    result.flags.push('invalid_url');
                    return result;
                }
            }
            
            result.hostname = urlObj.hostname;
            
            
            const normalizedHostname = this.normalize(urlObj.hostname);
            result.normalizedHostname = normalizedHostname.normalized;
            
            
            if (normalizedHostname.evasionScore > 0) {
                result.isEvasion = true;
                result.flags.push('hostname_evasion');
            }
            
            
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (ipRegex.test(urlObj.hostname)) {
                result.flags.push('ip_address');
            }
            
            
            const confusable = this.checkConfusableDomains(urlObj.hostname);
            if (confusable.isConfusable) {
                result.isEvasion = true;
                result.flags.push('confusable_domain');
                result.confusableDetails = confusable;
            }
            
            
            const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click'];
            if (suspiciousTlds.some(tld => urlObj.hostname.endsWith(tld))) {
                result.flags.push('suspicious_tld');
            }
            
            
            const subdomains = urlObj.hostname.split('.').length - 2;
            if (subdomains > 2) {
                result.flags.push('excessive_subdomains');
            }
            
            result.isEvasion = result.evasionScore >= 5 || result.flags.includes('confusable_domain');
            
        } catch (error) {
            result.flags.push('parse_error');
            result.error = error.message;
        }
        
        return result;
    }

    checkBlockedWords(text, blockedWords) {
        const normalized = this.normalize(text);
        const matches = [];
        
        for (const word of blockedWords) {
            const normalizedWord = word.toLowerCase();
            
            
            if (normalized.normalized.includes(normalizedWord)) {
                matches.push({
                    word,
                    foundIn: 'normalized',
                    evasionAttempt: !text.toLowerCase().includes(normalizedWord)
                });
            }
        }
        
        return {
            isBlocked: matches.length > 0,
            matches,
            evasionAttempted: matches.some(m => m.evasionAttempt),
            normalizedText: normalized.normalized,
            evasionDetails: normalized.evasionDetails
        };
    }

    hasEvasion(text) {
        return this.normalize(text).evasionScore >= 5;
    }

    getEvasionScore(text) {
        return this.normalize(text).evasionScore;
    }
}


const defaultInstance = new AntiEvasion();

module.exports = {
    AntiEvasion,
    normalize: (text, options) => defaultInstance.normalize(text, options),
    checkConfusableDomains: (text) => defaultInstance.checkConfusableDomains(text),
    analyzeUrl: (url) => defaultInstance.analyzeUrl(url),
    checkBlockedWords: (text, words) => defaultInstance.checkBlockedWords(text, words),
    hasEvasion: (text) => defaultInstance.hasEvasion(text),
    getEvasionScore: (text) => defaultInstance.getEvasionScore(text),
    HOMOGLYPH_MAP,
    LEETSPEAK_MAP,
    ZERO_WIDTH_CHARS,
    CONFUSABLE_DOMAINS
};
