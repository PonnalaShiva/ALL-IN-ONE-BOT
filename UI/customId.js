'use strict';

const SEPARATOR = ':';
const MAX_LENGTH = 100;

function build(namespace, action, ...args) {
    const parts = [namespace, action, ...args];
    const id = parts.join(SEPARATOR);
    if (id.length > MAX_LENGTH) {
        throw new RangeError(`Custom ID exceeds ${MAX_LENGTH} chars: "${id}" (${id.length})`);
    }
    return id;
}

function parse(customId) {
    const parts = String(customId).split(SEPARATOR);
    return {
        namespace: parts[0] || '',
        action:    parts[1] || '',
        args:      parts.slice(2),
    };
}

function match(customId, namespace) {
    return String(customId).startsWith(namespace + SEPARATOR);
}

module.exports = { build, parse, match, SEPARATOR, MAX_LENGTH };
