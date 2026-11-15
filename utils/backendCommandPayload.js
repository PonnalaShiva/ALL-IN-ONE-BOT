'use strict';

const COMMAND_NAME = /^[a-z0-9_-]{1,32}$/;
const HTTP_URL = /^https?:\/\//i;
const HEX_COLOR = /^#?(?:[\da-f]{3}|[\da-f]{6})$/i;

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBackendCommandPayload(payload) {
    if (!Array.isArray(payload)) {
        throw new TypeError('Backend commands response must be an array.');
    }

    const commands = [];
    const rejected = [];
    const seenNames = new Set();

    payload.forEach((command, index) => {
        const name = typeof command?.name === 'string' ? command.name.trim().toLowerCase() : '';
        const reject = reason => rejected.push({ index, name: name || null, reason });

        if (!isRecord(command) || !COMMAND_NAME.test(name)) return reject('invalid name or command object');
        if (seenNames.has(name)) return reject('duplicate name');

        const embed = command.embed === undefined || command.embed === null ? {} : command.embed;
        if (!isRecord(embed)) return reject('embed must be an object');
        for (const key of ['title', 'description', 'image', 'color']) {
            if (embed[key] !== undefined && embed[key] !== null && typeof embed[key] !== 'string') {
                return reject(`embed.${key} must be a string`);
            }
        }
        if (embed.footer !== undefined && embed.footer !== null && !isRecord(embed.footer)) {
            return reject('embed.footer must be an object');
        }
        if (embed.footer?.text !== undefined && embed.footer.text !== null && typeof embed.footer.text !== 'string') {
            return reject('embed.footer.text must be a string');
        }
        if (embed.fields !== undefined && embed.fields !== null && !Array.isArray(embed.fields)) {
            return reject('embed.fields must be an array');
        }
        const sourceFields = embed.fields || [];
        if (sourceFields.length > 25 || sourceFields.some(field =>
            !isRecord(field) || typeof field.name !== 'string' || typeof field.value !== 'string'
        )) {
            return reject('embed.fields contains invalid entries or exceeds the 25-field limit');
        }
        const image = embed.image || null;
        if (image && (image.length > 2048 || !HTTP_URL.test(image) || !URL.canParse(image))) {
            return reject('embed.image must be an HTTP or HTTPS URL');
        }

        seenNames.add(name);
        commands.push({
            name,
            embed: {
                title: embed.title?.slice(0, 256) || null,
                description: embed.description?.slice(0, 4096) || null,
                fields: sourceFields.map(field => ({
                    name: field.name.slice(0, 256),
                    value: field.value.slice(0, 1024)
                })),
                image,
                color: typeof embed.color === 'string' && HEX_COLOR.test(embed.color) ? embed.color : null,
                footer: { text: embed.footer?.text?.slice(0, 2048) || null }
            }
        });
    });

    return { commands, rejected };
}

module.exports = { normalizeBackendCommandPayload };
