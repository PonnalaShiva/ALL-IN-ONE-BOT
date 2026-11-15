'use strict';

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',

    
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',

    
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
};

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
function stripAnsi(str) {
    return String(str ?? '').replace(ANSI_REGEX, '');
}

function getTimestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
}


const systemState = {
    system: 'Production',
    bot: 'All n One#7740 (1270691569225433150)',
    database: '● Connected (MongoDB + Mongoose)',
    security: '● Protected (Anti-Spam/Link/Nuke/Raid)',
    commands: '● 148 Loaded (100 Local Slash)',
    lavalink: '● Standby (Riffy Engine)',
    license: '● Verified (ShivaReddy • cache)',
    status: '● All Systems Operational'
};

let isBooting = false;
const rawConsoleLog = console.log;
const bootBuffer = [];

const logger = {
    colors: ANSI,

    startBoot() {
        isBooting = true;
        console.log = function (...args) {
            if (!isBooting || process.env.DEBUG_STARTUP) {
                rawConsoleLog.apply(console, args);
                return;
            }
            bootBuffer.push(args);
        };
    },

    endBoot() {
        if (!isBooting) return;
        isBooting = false;
        console.log = rawConsoleLog;
        bootBuffer.length = 0;
    },

    setStatus(key, value) {
        if (key in systemState) {
            systemState[key] = value;
        }
    },

    getStatus(key) {
        return systemState[key];
    },

    info(component, message) {
        if (isBooting && !process.env.DEBUG_STARTUP) return;
        const time = `${ANSI.gray}${getTimestamp()}${ANSI.reset}`;
        const level = `${ANSI.brightCyan}INFO ${ANSI.reset}`;
        const tag = `${ANSI.bold}${ANSI.cyan}[${String(component).toUpperCase()}]${ANSI.reset}`;
        rawConsoleLog(`${time} ${level} ${tag.padEnd(24)} ${message}`);
    },

    success(component, message) {
        if (isBooting && !process.env.DEBUG_STARTUP) return;
        const time = `${ANSI.gray}${getTimestamp()}${ANSI.reset}`;
        const level = `${ANSI.brightGreen}OK   ${ANSI.reset}`;
        const tag = `${ANSI.bold}${ANSI.green}[${String(component).toUpperCase()}]${ANSI.reset}`;
        rawConsoleLog(`${time} ${level} ${tag.padEnd(24)} ${message}`);
    },

    warn(component, message) {
        if (isBooting && !process.env.DEBUG_STARTUP) return;
        const time = `${ANSI.gray}${getTimestamp()}${ANSI.reset}`;
        const level = `${ANSI.brightYellow}WARN ${ANSI.reset}`;
        const tag = `${ANSI.bold}${ANSI.yellow}[${String(component).toUpperCase()}]${ANSI.reset}`;
        rawConsoleLog(`${time} ${level} ${tag.padEnd(24)} ${message}`);
    },

    error(component, message, err = null) {
        
        const time = `${ANSI.gray}${getTimestamp()}${ANSI.reset}`;
        const level = `${ANSI.brightRed}${ANSI.bold}ERROR${ANSI.reset}`;
        const tag = `${ANSI.bold}${ANSI.red}[${String(component).toUpperCase()}]${ANSI.reset}`;
        console.error(`${time} ${level} ${tag.padEnd(24)} ${message}`);

        if (err) {
            const errStr = err.stack || err.message || String(err);
            const errLines = errStr.split(/\r?\n/).slice(0, 5);
            console.error(`${ANSI.gray}      ${errLines.join('\n      ')}${ANSI.reset}`);
        }
    },

    ready(component, message) {
        const time = `${ANSI.gray}${getTimestamp()}${ANSI.reset}`;
        const level = `${ANSI.bgGreen}${ANSI.black}${ANSI.bold} READY ${ANSI.reset}`;
        const tag = `${ANSI.bold}${ANSI.brightGreen}[${String(component).toUpperCase()}]${ANSI.reset}`;
        rawConsoleLog(`${time} ${level} ${tag.padEnd(23)} ${message}`);
    },

    system(component, message) {
        if (isBooting && !process.env.DEBUG_STARTUP) return;
        const time = `${ANSI.gray}${getTimestamp()}${ANSI.reset}`;
        const level = `${ANSI.brightMagenta}SYS  ${ANSI.reset}`;
        const tag = `${ANSI.bold}${ANSI.magenta}[${String(component).toUpperCase()}]${ANSI.reset}`;
        rawConsoleLog(`${time} ${level} ${tag.padEnd(24)} ${message}`);
    },

    errorBox(component, title, lines = []) {
        const width = 64;
        const compTag = `[ERROR: ${String(component).toUpperCase()}]`;
        const topBar = `╭─ ${compTag} `.padEnd(width - 1, '─') + '╮';
        console.error(`\n${ANSI.brightRed}${topBar}${ANSI.reset}`);
        console.error(`${ANSI.brightRed}│${ANSI.reset} ${ANSI.bold}${title}${ANSI.reset}`.padEnd(width + 8) + `${ANSI.brightRed}│${ANSI.reset}`);
        if (lines.length) {
            console.error(`${ANSI.brightRed}├${'─'.repeat(width - 2)}┤${ANSI.reset}`);
            for (const line of lines) {
                const visible = stripAnsi(line);
                const pad = Math.max(0, width - 4 - visible.length);
                console.error(`${ANSI.brightRed}│${ANSI.reset}  ${line}${' '.repeat(pad)} ${ANSI.brightRed}│${ANSI.reset}`);
            }
        }
        console.error(`${ANSI.brightRed}╰${'─'.repeat(width - 2)}╯\n${ANSI.reset}`);
    },

    printLoaderTable(steps = []) {
        this.endBoot();
        const width = 66;
        const centerText = (text, customWidth = width) => {
            const visible = stripAnsi(text);
            const padLeft = Math.max(0, Math.floor((customWidth - 2 - visible.length) / 2));
            const padRight = Math.max(0, customWidth - 2 - visible.length - padLeft);
            return `${' '.repeat(padLeft)}${text}${' '.repeat(padRight)}`;
        };

        const title = `${ANSI.bold}${ANSI.brightCyan}S Y S T E M   I N I T I A L I Z A T I O N${ANSI.reset}`;
        rawConsoleLog('');
        rawConsoleLog(`${ANSI.cyan}╭${'─'.repeat(width - 2)}╮${ANSI.reset}`);
        rawConsoleLog(`${ANSI.cyan}│${ANSI.reset}${centerText(title)}${ANSI.cyan}│${ANSI.reset}`);
        rawConsoleLog(`${ANSI.cyan}├${'─'.repeat(width - 2)}┤${ANSI.reset}`);
        for (const s of steps) {
            const icon = s.error ? `${ANSI.brightRed}✖${ANSI.reset}` : `${ANSI.brightGreen}✔${ANSI.reset}`;
            const label = `${ANSI.white}${s.label.padEnd(20)}${ANSI.reset}`;
            const status = `${s.color || ANSI.brightCyan}${s.status}${ANSI.reset}`;
            const content = `  ${icon}  ${label}  ${status}`;
            const visibleLen = stripAnsi(content).length;
            const padRight = Math.max(0, width - 2 - visibleLen);
            rawConsoleLog(`${ANSI.cyan}│${ANSI.reset}${content}${' '.repeat(padRight)}${ANSI.cyan}│${ANSI.reset}`);
        }
        rawConsoleLog(`${ANSI.cyan}╰${'─'.repeat(width - 2)}╯${ANSI.reset}`);
    },

    printBanner(customData = {}) {
        this.endBoot();
        const data = { ...systemState, ...customData };
        const width = 66;

        const formatRow = (label, value) => {
            const labelStr = `  • ${label.padEnd(12)}: `;
            const content = `${ANSI.gray}${labelStr}${ANSI.reset}${value}`;
            const visibleLen = stripAnsi(content).length;
            const padRight = Math.max(0, width - 2 - visibleLen);
            return `${ANSI.cyan}│${ANSI.reset}${content}${' '.repeat(padRight)}${ANSI.cyan}│${ANSI.reset}`;
        };

        const centerText = (text, customWidth = width) => {
            const visible = stripAnsi(text);
            const padLeft = Math.max(0, Math.floor((customWidth - 2 - visible.length) / 2));
            const padRight = Math.max(0, customWidth - 2 - visible.length - padLeft);
            return `${' '.repeat(padLeft)}${text}${' '.repeat(padRight)}`;
        };

        const title = `${ANSI.bold}${ANSI.brightCyan}F L U E N O S I T Y${ANSI.reset}`;
        const subtitle = `${ANSI.gray}Discord Operating System • v2.0.0${ANSI.reset}`;

        rawConsoleLog('');
        rawConsoleLog(`${ANSI.cyan}╭${'─'.repeat(width - 2)}╮${ANSI.reset}`);
        rawConsoleLog(`${ANSI.cyan}│${ANSI.reset}${centerText(title)}${ANSI.cyan}│${ANSI.reset}`);
        rawConsoleLog(`${ANSI.cyan}│${ANSI.reset}${centerText(subtitle)}${ANSI.cyan}│${ANSI.reset}`);
        rawConsoleLog(`${ANSI.cyan}├${'─'.repeat(width - 2)}┤${ANSI.reset}`);
        rawConsoleLog(formatRow('System', `${ANSI.white}${data.system}${ANSI.reset}`));
        rawConsoleLog(formatRow('Bot', `${ANSI.brightCyan}${data.bot}${ANSI.reset}`));
        rawConsoleLog(formatRow('Database', `${ANSI.brightGreen}${data.database}${ANSI.reset}`));
        rawConsoleLog(formatRow('Security', `${ANSI.brightGreen}${data.security}${ANSI.reset}`));
        rawConsoleLog(formatRow('Commands', `${ANSI.brightGreen}${data.commands}${ANSI.reset}`));
        rawConsoleLog(formatRow('Lavalink', `${data.lavalink.includes('Connected') ? ANSI.brightGreen : ANSI.yellow}${data.lavalink}${ANSI.reset}`));
        rawConsoleLog(formatRow('License', `${ANSI.brightGreen}${data.license}${ANSI.reset}`));
        rawConsoleLog(formatRow('Status', `${ANSI.bold}${ANSI.brightGreen}${data.status}${ANSI.reset}`));
        rawConsoleLog(`${ANSI.cyan}╰${'─'.repeat(width - 2)}╯${ANSI.reset}`);
        rawConsoleLog(`\n${ANSI.gray}─── LIVE SYSTEM LOGS ───────────────────────────────────────────${ANSI.reset}`);
    }
};

module.exports = logger;
