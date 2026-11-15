'use strict';

function resolveUser(message, args, argIndex = 0) {
    if (!message || !args || !args[argIndex]) return null;

    if (message.mentions?.users?.size > 0) {
        return message.mentions.users.first();
    }

    const query = args[argIndex];
    const cleanId = query.replace(/[<@!>]/g, '');
    if (/^\d{17,19}$/.test(cleanId)) {
        const member = message.guild?.members?.cache?.get(cleanId);
        if (member) return member.user;
    }

    const lowerQuery = query.toLowerCase();
    const foundMember = message.guild?.members?.cache?.find(m =>
        m.user?.username?.toLowerCase() === lowerQuery ||
        m.displayName?.toLowerCase() === lowerQuery
    );
    if (foundMember) return foundMember.user;

    return null;
}

module.exports = { resolveUser };

