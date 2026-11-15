'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { INSURANCE_TYPES } = require('../../models/economy/constants/systemData');
const { resolveEntity } = require('../../models/economy/utils/entityResolver');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.insurance);

function buildInsuranceCatalogCard(profile) {
    const policyLines = [];
    for (const [id, policy] of Object.entries(INSURANCE_TYPES)) {
        const durationDays = Math.round(policy.duration / (24 * 60 * 60 * 1000));
        const activePol = profile.insurancePolicies?.find(
            p => p.type === id && new Date(p.expiryDate) > new Date()
        );
        const status = activePol ? ` [${lang.activeBadge}]` : '';
        const locPolicy = resolveEntity('insurance', id, policy);

        policyLines.push(lang.policyItemLine({
            name: locPolicy.name,
            status,
            premiumLabel: lang.premiumLabel,
            premium: policy.premium.toLocaleString(),
            coverageLabel: lang.coverageLabel,
            coverage: (policy.coverage * 100).toFixed(0),
            durationLabel: lang.durationLabel,
            duration: durationDays,
            maxClaimsLabel: lang.maxClaimsLabel,
            maxClaims: policy.maxClaims,
            desc: locPolicy.description
        }));
    }

    const card = buildCard({
        title: lang.officeTitle,
        description: lang.officeSubtitle,
        accentColor: ACCENT.primary
    })
        .addText(`${lang.officeDesc}\n\n### ${lang.availablePoliciesTitle}\n\n${policyLines.join('\n\n')}`);

    const selectOptions = Object.entries(INSURANCE_TYPES).map(([id, policy]) => {
        const loc = resolveEntity('insurance', id, policy);
        return {
            label: loc.name,
            value: id,
            description: lang.policySelectOptionDesc({
                premium: policy.premium.toLocaleString(),
                coverage: (policy.coverage * 100).toFixed(0)
            }).toString(),
            emoji: loc.emoji || '🛡️'
        };
    });

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ins_policy_select')
            .setPlaceholder(lang.selectPolicyPlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.primary('ins_status', lang.btnStatus),
        btn.danger('ins_close', lang.btnClose)
    );

    return { card, rows: [selectRow, btnRow] };
}

function buildActiveStatusCard(profile) {
    const activePolicies = (profile.insurancePolicies || []).filter(
        p => new Date(p.expiryDate) > new Date()
    );

    if (activePolicies.length === 0) {
        const card = cards.warning(
            lang.noActivePoliciesTitle,
            lang.noActivePoliciesDesc
        );
        const rows = [
            new ActionRowBuilder().addComponents(
                btn.primary('ins_shop', lang.btnShop),
                btn.secondary('ins_close', lang.btnClose)
            )
        ];
        return { card, rows };
    }

    const lines = [];
    for (const policy of activePolicies) {
        const insData = INSURANCE_TYPES[policy.type];
        const loc = resolveEntity('insurance', policy.type, insData);
        const daysLeft = Math.max(0, Math.ceil((new Date(policy.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
        const claimsLeft = Math.max(0, policy.maxClaims - policy.claimsUsed);

        lines.push(lang.activePolicyItemLine({
            name: loc.name,
            coverageLabel: lang.coverageLabel,
            coverage: (policy.coverage * 100).toFixed(0),
            expiresInLabel: lang.expiresInLabel,
            daysLeft,
            claimsLeftLabel: lang.claimsLeftLabel,
            claimsLeft,
            maxClaims: policy.maxClaims
        }));
    }

    const card = buildCard({
        title: lang.activeTitle,
        description: lang.activeSubtitle,
        accentColor: ACCENT.success
    }).addText(lines.join('\n\n'));

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('ins_shop', lang.btnShop),
            btn.secondary('ins_close', lang.btnClose)
        )
    ];

    return { card, rows };
}

async function handleBuyPolicy(userId, guildId, policyType, referenceId) {
    if (!policyType || !INSURANCE_TYPES[policyType]) {
        return {
            error: 'invalid',
            card: cards.warning(
                lang.invalidPolicyTitle,
                lang.invalidPolicyDesc({
                    available: Object.keys(INSURANCE_TYPES).map(k => `\`${k}\``).join(', ')
                })
            )
        };
    }

    const loc = resolveEntity('insurance', policyType, INSURANCE_TYPES[policyType]);
    const txDesc = lang.txPurchasedInsurance({ name: loc.name }).toString();
    const result = await EconomyManager.buyInsurance(userId, guildId, policyType, txDesc, referenceId);
    if (!result.success) {
        return {
            error: 'failed',
            card: cards.error(lang.purchaseFailedTitle, result.error)
        };
    }

    const policy = result.policy;
    const durationDays = Math.round(policy.duration / (24 * 60 * 60 * 1000));

    const card = buildCard({
        title: lang.purchaseSuccessTitle,
        description: loc.name,
        accentColor: ACCENT.success
    })
        .addText(`${lang.purchaseSuccessDesc({ name: loc.name })}\n\n` +
            `> **${lang.premiumPaidLabel}:** \`$${policy.premium.toLocaleString()}\`\n` +
            `> **${lang.coverageLabel}:** \`${(policy.coverage * 100).toFixed(0)}%\`\n` +
            `> **${lang.durationLabel}:** \`${lang.durationDaysText({ days: durationDays })}\`\n` +
            `> **${lang.maxClaimsLabel}:** \`${policy.maxClaims}\`\n\n` +
            `*${lang.coverageNote}*`
        );

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('ins_status', lang.btnStatus),
            btn.secondary('ins_close', lang.btnClose)
        )
    ];

    return { success: true, card, rows };
}

module.exports = {
    name: 'insurance',
    aliases: ['insure', 'policy'],
    description: lang.cmdDesc.toString(),
    usage: '!insurance | !insurance buy <type> | !insurance status',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const user = message.author || message.user;
            const userId = user.id;
            const guildId = message.guild?.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const action = args[0]?.toLowerCase();

            const attachInsuranceCollector = (sentMsg) => {
                if (!sentMsg) return null;
                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'ins_close') {
                            collector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'ins_status') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const st = buildActiveStatusCard(freshProfile);
                            return editV2(sentMsg, { card: st.card, rows: st.rows });
                        }

                        if (interaction.customId === 'ins_shop') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const cat = buildInsuranceCatalogCard(freshProfile);
                            return editV2(sentMsg, { card: cat.card, rows: cat.rows });
                        }

                        if (interaction.customId === 'ins_policy_select') {
                            const selectedType = interaction.values[0];
                            const buyRes = await handleBuyPolicy(userId, guildId, selectedType, `insurance:${interaction.id}`);
                            const receiptRows = buyRes.rows || [new ActionRowBuilder().addComponents(btn.primary('ins_status', lang.btnViewActive), btn.danger('ins_close', lang.btnClose))];
                            return editV2(sentMsg, { card: buyRes.card, rows: receiptRows });
                        }
                    } catch (err) {
                        console.error('Error in insurance collector:', err);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return collector;
            };

            
            if (action === 'buy') {
                const buyRes = await handleBuyPolicy(userId, guildId, args[1]?.toLowerCase(), `insurance:${message.id}`);
                if (buyRes.rows) {
                    const sentMessage = await sendV2(message, { card: buyRes.card, rows: buyRes.rows });
                    attachInsuranceCollector(sentMessage);
                    return;
                }
                return sendV2(message, buyRes.card);
            }

            
            if (action === 'status' || action === 'active') {
                const st = buildActiveStatusCard(profile);
                const sentMessage = await sendV2(message, { card: st.card, rows: st.rows });
                attachInsuranceCollector(sentMessage);
                return;
            }

            
            const initial = buildInsuranceCatalogCard(profile);
            const sentMessage = await sendV2(message, { card: initial.card, rows: initial.rows });
            attachInsuranceCollector(sentMessage);

        } catch (error) {
            console.error('Error in insurance command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
