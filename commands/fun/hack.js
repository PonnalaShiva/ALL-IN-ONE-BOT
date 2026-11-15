
const { SlashCommandBuilder } = require('discord.js');
const wait = require('node:timers/promises').setTimeout;
const { getEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hack')
        .setDescription('Ultimate hacking simulation (100% FAKE - for fun only!)')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('User to hack (fake simulation)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('method')
                .setDescription('Hacking method to use')
                .addChoices(
                    { name: 'Script Kiddie (Basic)', value: 'basic' },
                    { name: 'Advanced Hacker', value: 'advanced' },
                    { name: 'Elite Black Hat', value: 'elite' },
                    { name: 'Government Level', value: 'government' },
                    { name: 'Matrix Mode', value: 'matrix' }
                )),

    async execute(interaction, args, client) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        if (isSlash) {
            try {
                await deferReply(interaction);
            } catch (err) {
                console.error('[Hack] Defer failed:', err.message);
                return;
            }
        }

        const resolveUser = (input) => {
            if (!input) return null;
            const mentionMatch = input.match(/^<@!?(\d+)>$/);
            if (mentionMatch) {
                const userId = mentionMatch[1];
                const resolved = client.users.cache.get(userId);
                if (resolved) return resolved;
            }
            if (/^\d+$/.test(input)) {
                const resolved = client.users.cache.get(input);
                if (resolved) return resolved;
            }
            const username = input.toLowerCase();
            const resolved = client.users.cache.find(u => u.username.toLowerCase() === username || u.displayName?.toLowerCase() === username);
            if (resolved) return resolved;
            return null;
        };

        let target = null;
        let method = 'advanced';

        if (isSlash) {
            target = interaction.options.getUser('target');
            method = interaction.options.getString('method') || 'advanced';
        } else {
            if (!args || args.length === 0) {
                const helpCard = buildCard({
                    title: `${getEmoji('games')} ${lang.fun.hack.guideTitle}`,
                    description: lang.fun.hack.guideDescription,
                    sections: [
                        `**Usage:**\n\`!hack @user [method]\`\n\n**Available Methods:**\n• \`basic\` (Script Kiddie)\n• \`advanced\` (Advanced Hacker)\n• \`elite\` (Elite Black Hat)\n• \`government\` (State-Sponsored Cyber Warfare)\n• \`matrix\` (Reality Hack)`
                    ],
                    accentColor: ACCENT.primary
                });
                return await sendV2(interaction, helpCard);
            }

            target = resolveUser(args[0]);
            if (!target) {
                const errCard = cards.error(
                    lang.fun.hack.errorTitle.replace('{emoji}', getEmoji('cross')),
                    lang.fun.hack.userNotFound
                );
                return await sendV2(interaction, errCard);
            }

            const rawMethod = args[1]?.toLowerCase();
            if (rawMethod && ['basic', 'advanced', 'elite', 'government', 'matrix'].includes(rawMethod)) {
                method = rawMethod;
            }
        }

        const executorId = isSlash ? interaction.user.id : interaction.author.id;
        if (target.id === executorId) {
            const errCard = cards.error(
                lang.fun.hack.errorTitle.replace('{emoji}', getEmoji('warning')),
                lang.fun.hack.cannotHackSelf
            );
            return await sendV2(interaction, errCard);
        }

        if (target.bot) {
            const errCard = cards.error(
                lang.fun.hack.errorTitle.replace('{emoji}', getEmoji('bot')),
                lang.fun.hack.cannotHackBot
            );
            return await sendV2(interaction, errCard);
        }

        await this.executeHackingSimulation(interaction, target, method);
    },

    async executeHackingSimulation(interaction, target, method) {
        const hackConfig = this.getHackConfig(method);
        const phases = this.getHackingPhases(target, hackConfig);

        const startCard = buildCard({
            title: `${getEmoji('lightning')} ${lang.fun.hack.initiated}`,
            description: `## Target: ${target.displayName || target.username}\n\n> **METHOD:** ${hackConfig.name}\n> **DIFFICULTY:** ${hackConfig.difficulty}\n> **SUCCESS RATE:** ${hackConfig.successRate}%\n\n${getEmoji('red_dot')} **INITIALIZING ATTACK VECTORS...**`,
            thumbnailURL: target.displayAvatarURL({ dynamic: true, size: 256 }),
            accentColor: ACCENT.danger
        });

        await sendV2(interaction, startCard);

        for (let i = 0; i < phases.length; i++) {
            await wait(hackConfig.timing);

            const phase = phases[i];
            const sections = [];

            if (hackConfig.level >= 3) {
                sections.push([
                    `## ${getEmoji('desktop')} **Technical Output**`,
                    '```',
                    phase.techOutput,
                    '```',
                    `**${getEmoji('target')} Attack Vector:** ${phase.vector}`,
                    `**${getEmoji('lock')} Security Bypass:** ${phase.bypass}`,
                    `**${getEmoji('wifi')} Connection:** ${phase.connection}`
                ].join('\n'));
            }

            const phaseCard = buildCard({
                title: `${phase.icon} ${phase.title}`,
                description: `## ${phase.subtitle}\n\n> ${phase.description}\n\n**STATUS:** ${phase.status}\n**PROGRESS:** ${Math.round((i + 1) / phases.length * 100)}%`,
                thumbnailURL: target.displayAvatarURL({ dynamic: true, size: 256 }),
                sections,
                accentColor: phase.color
            });

            await sendV2(interaction, phaseCard);
        }

        await wait(3000);
        await this.showHackResults(interaction, target, hackConfig);
    },

    async showHackResults(interaction, target, hackConfig) {
        const fakeData = this.generateAdvancedFakeData(target, hackConfig);
        const execName = interaction.user ? (interaction.user.displayName || interaction.user.username) : (interaction.author.displayName || interaction.author.username);

        const finalCard = buildCard({
            title: `${getEmoji('success')} ${lang.fun.hack.successful}`,
            description: `## ${target.displayName || target.username} - COMPROMISED\n\n> **TARGET FULLY PENETRATED**\n> All systems breached using ${hackConfig.name}\n> Data extraction complete - ${fakeData.totalFiles.toLocaleString()} files stolen\n\n${getEmoji('fire')} **WELCOME TO THE MATRIX** ${getEmoji('fire')}`,
            thumbnailURL: target.displayAvatarURL({ dynamic: true, size: 256 }),
            accentColor: ACCENT.success,
            sections: [
                [
                    `### ${getEmoji('user')} **PERSONAL INFORMATION EXTRACTED**`,
                    `**Name:** ${fakeData.realName} | **Username:** ${target.username} | **Discord ID:** \`${target.id}\``,
                    `**Account Age:** ${fakeData.accountAge} | **DOB:** ${fakeData.dob} | **Phone:** ${fakeData.phone}`,
                    `**Email:** ${fakeData.email} (Recovery: ${fakeData.recoveryEmail})`,
                    `**Address:** ${fakeData.address}`
                ].join('\n'),
                [
                    `### ${getEmoji('desktop')} **DEVICE & NETWORK INTELLIGENCE**`,
                    `**Device:** ${fakeData.deviceName} (${fakeData.os})`,
                    `**Login Password:** \`${fakeData.devicePassword}\` | **PIN:** \`${fakeData.pinCode}\``,
                    `**WiFi:** ${fakeData.wifiName} (\`${fakeData.wifiPassword}\`) | **IP:** \`${fakeData.ipAddress}\``,
                    `**Security:** Firewall: ${fakeData.firewall} | AV: ${fakeData.antivirus} | VPN: ${fakeData.vpnStatus}`
                ].join('\n'),
                [
                    `### ${getEmoji('card')} **FINANCIAL & WALLET DATA**`,
                    `**Bank:** ${fakeData.bank} (\`****${fakeData.bankAccount}\`) - Balance: $${fakeData.balance.toLocaleString()}`,
                    `**Credit Card:** \`****-****-****-${fakeData.creditCard1}\` | CVV: \`${fakeData.cvv}\` | Exp: \`${fakeData.expiry}\``,
                    `**Crypto:** BTC: \`${fakeData.bitcoinWallet.substring(0, 16)}...\` | Total: $${fakeData.cryptoValue.toLocaleString()}`
                ].join('\n'),
                [
                    `### ${getEmoji('key')} **PASSWORD VAULT CRACKED**`,
                    `Discord: \`${fakeData.passwords.discord}\` | Google: \`${fakeData.passwords.gmail}\``,
                    `Steam: \`${fakeData.passwords.steam}\` | Apple ID: \`${fakeData.passwords.apple}\``,
                    `Instagram: \`${fakeData.passwords.instagram}\` | Twitter/X: \`${fakeData.passwords.twitter}\``
                ].join('\n'),
                [
                    `### ${hackConfig.level >= 4 ? (getEmoji('pirate')) : (getEmoji('analytics'))} **OPERATION SUMMARY**`,
                    `**Method:** ${hackConfig.name} | **Time:** ${hackConfig.duration} | **Success Rate:** ${hackConfig.successRate}%`,
                    `**Capabilities:** ${hackConfig.capabilities.join(', ')}`,
                    '',
                    `> **DISCLAIMER:** ${lang.fun.hack.disclaimer}`
                ].join('\n')
            ],
            footer: `Simulation completed by ${execName}`
        });

        await sendV2(interaction, finalCard);
    },

    getHackConfig(method) {
        const configs = {
            basic: {
                name: 'Script Kiddie Attack',
                difficulty: 'Beginner',
                successRate: 45,
                level: 1,
                timing: 2500,
                duration: '2 minutes',
                capabilities: ['Basic password cracking', 'Simple malware', 'Social engineering']
            },
            advanced: {
                name: 'Advanced Penetration Testing',
                difficulty: 'Intermediate',
                successRate: 78,
                level: 3,
                timing: 3500,
                duration: '8 minutes',
                capabilities: ['SQL injection', 'Buffer overflow', 'Network sniffing', 'Privilege escalation']
            },
            elite: {
                name: 'Elite Black Hat Operations',
                difficulty: 'Expert',
                successRate: 92,
                level: 4,
                timing: 4000,
                duration: '15 minutes',
                capabilities: ['Zero-day exploits', 'Advanced persistent threats', 'Rootkit deployment', 'Steganography']
            },
            government: {
                name: 'State-Sponsored Cyber Warfare',
                difficulty: 'Nation-State',
                successRate: 98,
                level: 5,
                timing: 4500,
                duration: '45 minutes',
                capabilities: ['Quantum decryption', 'Satellite hijacking', 'Infrastructure disruption', 'Deep cover operations']
            },
            matrix: {
                name: 'Matrix-Level Reality Hack',
                difficulty: 'Neo',
                successRate: 100,
                level: 6,
                timing: 1500,
                duration: '0.1 seconds',
                capabilities: ['Reality manipulation', 'Time dilation', 'Consciousness transfer', 'Digital transcendence']
            }
        };

        return configs[method] || configs.advanced;
    },

    getHackingPhases(target, config) {
        const phases = [
            {
                icon: getEmoji('search'),
                title: 'RECONNAISSANCE',
                subtitle: 'Intelligence Gathering',
                description: `Scanning ${target.displayName || target.username} digital footprint across all platforms`,
                status: 'OSINT data collection in progress...',
                color: 0x3498db,
                thumbnailDesc: 'Scanning target',
                techOutput: `nmap -sS -O ${target.id}.target.local\nPort 22: SSH - OPEN\nPort 80: HTTP - OPEN\nPort 443: HTTPS - OPEN\nOS Detection: Complete`,
                vector: 'Social Media Analysis',
                bypass: 'Public Information Mining',
                connection: 'Anonymous Proxy Chain'
            },
            {
                icon: getEmoji('lightning'),
                title: 'VULNERABILITY SCANNING',
                subtitle: 'Weakness Detection',
                description: `Probing ${target.displayName || target.username} systems for security vulnerabilities`,
                status: 'Critical vulnerabilities detected!',
                color: 0xf39c12,
                thumbnailDesc: 'Analyzing weaknesses',
                techOutput: `nikto -h ${target.username}.local\n+ Server: Apache/2.4.41\n+ OSVDB-3268: /admin/: Admin login found\n+ OSVDB-3092: /passwords/: Passwords directory\n+ CVE-2023-0001: Buffer overflow detected`,
                vector: 'Web Application Testing',
                bypass: 'CVE-2023-0001 Exploit',
                connection: 'Tor Hidden Service'
            },
            {
                icon: getEmoji('fire'),
                title: 'EXPLOITATION',
                subtitle: 'System Penetration',
                description: `Executing exploit chain against ${target.displayName || target.username} infrastructure`,
                status: 'BREACH SUCCESSFUL - Shell access obtained!',
                color: 0xe74c3c,
                thumbnailDesc: 'Infiltrating systems',
                techOutput: `msfconsole\nuse exploit/multi/handler\nset payload windows/meterpreter/reverse_tcp\nexploit\n[*] Sending stage (175174 bytes)\n[*] Meterpreter session 1 opened\nmeterpreter > shell`,
                vector: 'Metasploit Framework',
                bypass: 'Windows Defender Evasion',
                connection: 'Encrypted C2 Channel'
            },
            {
                icon: getEmoji('document'),
                title: 'DATA EXFILTRATION',
                subtitle: 'Information Harvesting',
                description: `Extracting sensitive data from ${target.displayName || target.username} compromised systems`,
                status: 'Terabytes of data being transferred...',
                color: 0x00ff41,
                thumbnailDesc: 'Stealing data',
                techOutput: `7z a -p"hack2023!" stolen_data.7z C:\\Users\\*\\*\nwinrar a -hp"encrypt" data.rar D:\\Documents\\*\nFileZilla.exe -upload darknet.onion/drop/\n[████████████████] 100% Complete\n2.3 TB transferred`,
                vector: 'Automated Data Mining',
                bypass: 'Encrypted Compression',
                connection: 'Dark Web Drop Zone'
            },
            {
                icon: getEmoji('bot'),
                title: 'PERSISTENCE & CLEANUP',
                subtitle: 'Covering Tracks',
                description: `Installing backdoors and erasing evidence of breach`,
                status: 'Ghost mode activated - completely undetectable!',
                color: 0x34495e,
                thumbnailDesc: 'Erasing traces',
                techOutput: `schtasks /create /tn "WindowsUpdate" /tr "C:\\Windows\\system32\\backdoor.exe"\nwevtutil cl System\nwevtutil cl Security\nwevtutil cl Application\n[+] Event logs cleared\n[+] Rootkit installed\n[+] Completely invisible`,
                vector: 'Rootkit Deployment',
                bypass: 'Anti-Forensics Techniques',
                connection: 'Dormant Until Activated'
            }
        ];

        return phases.slice(0, Math.min(config.level + 1, phases.length));
    },

    generateAdvancedFakeData(target, config) {
        const firstNames = ['Alex', 'Jordan', 'Casey', 'Riley', 'Avery', 'Morgan', 'Quinn', 'Sage', 'Rowan', 'Blake'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
        const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'protonmail.com', 'hotmail.com'];
        const banks = ['Chase Bank', 'Wells Fargo', 'Bank of America', 'Citibank', 'Capital One'];
        const cities = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ'];

        const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        return {
            realName: `${randomChoice(firstNames)} ${randomChoice(lastNames)}`,
            accountAge: `${randomNumber(1, 8)} years`,
            email: `${target.username}${randomNumber(10, 99)}@${randomChoice(domains)}`,
            recoveryEmail: `${target.username}.recovery@${randomChoice(domains)}`,
            dob: `${randomNumber(1990, 2005)}-${String(randomNumber(1, 12)).padStart(2, '0')}-${String(randomNumber(1, 28)).padStart(2, '0')}`,
            phone: `+1 (${randomNumber(200, 999)}) ${randomNumber(100, 999)}-${randomNumber(1000, 9999)}`,
            address: `${randomNumber(100, 9999)} ${randomChoice(['Oak', 'Maple', 'Pine', 'Elm', 'Cedar'])} ${randomChoice(['St', 'Ave', 'Dr', 'Ln', 'Ct'])}, ${randomChoice(cities)}`,

            os: randomChoice(['Windows 11 Pro', 'macOS Ventura', 'Ubuntu 22.04 LTS', 'Windows 10 Home']),
            deviceName: `${target.username}-${randomChoice(['Desktop', 'Laptop', 'Gaming-PC', 'MacBook'])}`,
            devicePassword: `${target.username}${randomNumber(100, 999)}!`,
            pinCode: String(randomNumber(1000, 9999)),

            wifiName: `${randomChoice(['NETGEAR', 'Linksys', 'TP-Link', 'ASUS'])}_${randomNumber(1000, 9999)}`,
            wifiPassword: `${randomChoice(['WiFi', 'Network', 'Internet'])}${randomNumber(100, 999)}!`,
            routerPassword: `admin${randomNumber(100, 999)}`,
            ipAddress: `192.168.${randomNumber(1, 255)}.${randomNumber(1, 255)}`,

            firewall: randomChoice(['Disabled', 'Windows Defender', 'Norton', 'McAfee', 'Bitdefender']),
            antivirus: randomChoice(['None', 'Windows Defender', 'AVG', 'Avast', 'Kaspersky']),
            vpnStatus: randomChoice(['Not Using VPN', 'ExpressVPN', 'NordVPN', 'Surfshark', 'CyberGhost']),

            bank: randomChoice(banks),
            bankAccount: String(randomNumber(1000, 9999)),
            balance: randomNumber(50, 50000),
            creditCard1: String(randomNumber(1000, 9999)),
            creditCard2: String(randomNumber(1000, 9999)),
            cvv: String(randomNumber(100, 999)),
            expiry: `${String(randomNumber(1, 12)).padStart(2, '0')}/${String(randomNumber(25, 30))}`,

            bitcoinWallet: `1${Array(33).fill().map(() => randomChoice('ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789')).join('')}`,
            ethWallet: `0x${Array(40).fill().map(() => randomChoice('0123456789abcdef')).join('')}`,
            cryptoValue: randomNumber(100, 10000),

            passwords: {
                discord: `${target.username}${randomNumber(100, 999)}!`,
                instagram: `Insta${randomNumber(1000, 9999)}!`,
                twitter: `Tweet${randomNumber(100, 999)}$`,
                gmail: `Gmail${randomNumber(100, 999)}@`,
                apple: `Apple${randomNumber(1000, 9999)}!`,
                microsoft: `MS${randomNumber(100, 999)}$`,
                steam: `Steam${randomNumber(1000, 9999)}`,
                epic: `Epic${randomNumber(100, 999)}!`,
                playstation: `PS${randomNumber(1000, 9999)}#`
            },

            totalFiles: randomNumber(50000, 500000)
        };
    }
};