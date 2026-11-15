const AutoResponder = require('./schema');


async function createOrUpdateAutoResponder(userId, guildId, trigger, textResponse, embedData, matchType, channels, status) {
    console.log(`[DEBUG] Saving AutoResponder: ${trigger} for Guild: ${guildId}`);

    const update = {
        userId,
        guildId,
        trigger: trigger.toLowerCase(),
        textResponse,
        embedData,
        matchType,
        channels,
        status
    };

    await AutoResponder.updateOne({ guildId, trigger: trigger.toLowerCase() }, { $set: update }, { upsert: true });
}

async function deleteAutoResponder(userId, guildId, index) {
    const userResponders = await AutoResponder.find({ userId, guildId });
    if (!userResponders[index]) return false;

    await AutoResponder.deleteOne({ _id: userResponders[index]._id });
    return true;
}

async function getUserAutoResponders(userId, guildId) {
    return await AutoResponder.find({ userId, guildId });
}

module.exports = { createOrUpdateAutoResponder, deleteAutoResponder, getUserAutoResponders };
