'use strict';

function captureRolePermissionBackups(guild, roleId) {
    return [...guild.channels.cache.values()]
        .filter(channel => channel.permissionOverwrites?.cache && typeof channel.permissionOverwrites.edit === 'function')
        .map(channel => {
            const overwrite = channel.permissionOverwrites.cache.get(roleId);
            return {
                channelId: channel.id,
                hadOverwrite: Boolean(overwrite),
                allow: overwrite?.allow?.toArray?.() || [],
                deny: overwrite?.deny?.toArray?.() || []
            };
        });
}

async function restoreRolePermissionBackups(guild, roleId, backups = []) {
    const failures = [];
    for (const backup of backups) {
        const channel = guild.channels.cache.get(backup.channelId) ||
            await guild.channels.fetch(backup.channelId).catch(() => null);
        if (!channel?.permissionOverwrites) continue;

        try {
            if (backup.hadOverwrite) {
                await channel.permissionOverwrites.edit(roleId, {
                    allow: backup.allow || [],
                    deny: backup.deny || []
                });
            } else if (channel.permissionOverwrites.cache?.has(roleId)) {
                await channel.permissionOverwrites.delete(roleId);
            }
        } catch (error) {
            failures.push({ channelId: backup.channelId, error });
        }
    }
    if (failures.length) {
        throw new Error(`Could not restore the unverified role's saved channel permissions in ${failures.length} channel(s).`);
    }
}

module.exports = { captureRolePermissionBackups, restoreRolePermissionBackups };
