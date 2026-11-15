
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MessageFlags
} = require('discord.js');
const UserProfile = require('../../models/profile/UserProfile');
const { ProfileCardGenerator } = require('../../UI/ProfileCardGenerator');
const path = require('path');
const cacheManager = require('../../utils/cacheManager');
const lang = require('../../events/loadLanguage');
const { linkBtn } = require('../../UI');
const { getEmoji } = require('../../UI/emojis/emoji');


const MAX_BUTTONS_PER_ROW = 5;
const MAX_ROWS = 4;

const platformCategories = {
    gaming: ['steam', 'epic', 'riot', 'minecraft', 'xbox', 'playstation', 'nintendo', 'battlenet', 'fortnite'],
    social: ['youtube', 'twitch', 'instagram', 'twitter', 'facebook', 'linkedin', 'github', 'reddit', 'snapchat'],
    content: ['website', 'portfolio'],
    other: ['spotify', 'soundcloud', 'pinterest', 'telegram', 'whatsapp']
};

const platformEmojis = {
    steam: getEmoji('settings'), epic: getEmoji('games'), riot: getEmoji('games'), minecraft: getEmoji('wrench'), xbox: getEmoji('games'), playstation: getEmoji('games'),
    nintendo: getEmoji('games'), battlenet: getEmoji('security'), fortnite: getEmoji('crown'),
    youtube: getEmoji('media'), twitch: getEmoji('media'), instagram: getEmoji('media'), twitter: getEmoji('chat'), facebook: getEmoji('chat'),
    tiktok: getEmoji('music'), linkedin: getEmoji('folder'), github: getEmoji('code'), reddit: getEmoji('chat'), snapchat: getEmoji('chat'),
    website: getEmoji('world'), portfolio: getEmoji('folder'),
    spotify: getEmoji('music'), soundcloud: getEmoji('music'), pinterest: getEmoji('tag'), telegram: getEmoji('chat'), whatsapp: getEmoji('chat')
};


const platformUrlGenerators = {
    steam: (data) => data.profileUrl || `https://steamcommunity.com/id/${data.username}`,
    epic: (data) => data.profileUrl || `https://fortnitetracker.com/profile/all/${data.username}`,
    riot: (data) => data.profileUrl || `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(data.riotId)}`,
    minecraft: (data) => data.profileUrl || `https://namemc.com/profile/${data.username}`,
    xbox: (data) => data.profileUrl || `https://account.xbox.com/en-us/profile?gamertag=${data.gamertag}`,
    playstation: (data) => data.profileUrl || `https://psnprofiles.com/${data.psnId}`,
    nintendo: (data) => data.profileUrl || `https://nintendo.com`,
    battlenet: (data) => data.profileUrl || `https://worldofwarcraft.com`,
    fortnite: (data) => data.profileUrl || `https://fortnitetracker.com/profile/all/${data.epicName}`,

    
    youtube: (data) => data.channelUrl || `https://youtube.com/@${data.channelName}`,
    twitch: (data) => data.profileUrl || `https://twitch.tv/${data.username}`,
    instagram: (data) => data.profileUrl || `https://instagram.com/${data.username}`,
    twitter: (data) => data.profileUrl || `https://twitter.com/${data.username}`,
    facebook: (data) => data.profileUrl || `https://facebook.com`,
    linkedin: (data) => data.profileUrl || `https://linkedin.com`,
    github: (data) => data.profileUrl || `https://github.com/${data.username}`,
    reddit: (data) => data.profileUrl || `https://reddit.com/user/${data.username}`,
    snapchat: (data) => data.profileUrl || `https://snapchat.com`,

    
    website: (data) => data.url,
    portfolio: (data) => data.url,

    
    spotify: (data) => data.profileUrl || `https://open.spotify.com/user/${data.displayName}`,
    soundcloud: (data) => data.profileUrl || `https://soundcloud.com/${data.username}`,
    pinterest: (data) => data.profileUrl || `https://pinterest.com/${data.username}`,
    telegram: (data) => data.profileUrl || `https://t.me/${data.username}`,
    whatsapp: (data) => data.profileUrl || `https://wa.me/${data.number}`
};

function paginateButtons(buttons) {
    const rows = [];
    for (let i = 0; i < buttons.length; i += MAX_BUTTONS_PER_ROW) {
        const row = new ActionRowBuilder()
            .addComponents(...buttons.slice(i, i + MAX_BUTTONS_PER_ROW));
        rows.push(row);
        if (rows.length >= MAX_ROWS) break;
    }
    return rows;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Manage your complete Discord profile')

        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View your or someone else\'s profile')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('User to view profile of')
                .setRequired(false)))

        .addSubcommand(sub => sub
            .setName('bio')
            .setDescription('Set your profile bio')
            .addStringOption(opt => opt
                .setName('text')
                .setDescription('Your bio text (max 500 characters)')
                .setMaxLength(500)
                .setRequired(true)))

        .addSubcommand(sub => sub
            .setName('banner')
            .setDescription('Set your profile banner')
            .addStringOption(opt => opt
                .setName('url')
                .setDescription('Banner image URL')
                .setRequired(true)))

        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Add a platform account')
            .addStringOption(opt => opt
                .setName('platform')
                .setDescription('Platform to add')
                .setRequired(true)
                .addChoices(
                    { name: 'Steam', value: 'steam' },
                    { name: 'Epic Games', value: 'epic' },
                    { name: 'Riot Games', value: 'riot' },
                    { name: 'Minecraft', value: 'minecraft' },
                    { name: 'Xbox', value: 'xbox' },
                    { name: 'PlayStation', value: 'playstation' },
                    { name: 'Nintendo', value: 'nintendo' },
                    { name: 'Battle.net', value: 'battlenet' },
                    { name: 'Fortnite', value: 'fortnite' },
                    { name: 'YouTube', value: 'youtube' },
                    { name: 'Twitch', value: 'twitch' },
                    { name: 'Instagram', value: 'instagram' },
                    { name: 'Twitter', value: 'twitter' },
                    { name: 'Facebook', value: 'facebook' },
                    { name: 'LinkedIn', value: 'linkedin' },
                    { name: 'GitHub', value: 'github' },
                    { name: 'Reddit', value: 'reddit' },
                    { name: 'Snapchat', value: 'snapchat' },
                    { name: 'Website', value: 'website' },
                    { name: 'Portfolio', value: 'portfolio' },
                    { name: 'Spotify', value: 'spotify' },
                    { name: 'SoundCloud', value: 'soundcloud' },
                    { name: 'Telegram', value: 'telegram' },
                    { name: 'WhatsApp', value: 'whatsapp' }
                ))
            .addStringOption(opt => opt
                .setName('username')
                .setDescription('Your username/ID for this platform')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('url')
                .setDescription('Profile URL (optional)')
                .setRequired(false)))

        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a platform account')
            .addStringOption(opt => opt
                .setName('platform')
                .setDescription('Platform to remove')
                .setRequired(true)))

        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edit a platform account')
            .addStringOption(opt => opt
                .setName('platform')
                .setDescription('Platform to edit')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('username')
                .setDescription('New username/ID')
                .setRequired(false))
            .addStringOption(opt => opt
                .setName('url')
                .setDescription('New profile URL')
                .setRequired(false)))

        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Delete your entire profile'))

        .addSubcommand(sub => sub
            .setName('platforms')
            .setDescription('List all your added platforms')),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'view':
                await handleView(interaction);
                break;
            case 'bio':
                await handleBio(interaction);
                break;
            case 'banner':
                await handleBanner(interaction);
                break;
            case 'add':
                await handleAdd(interaction);
                break;
            case 'remove':
                await handleRemove(interaction);
                break;
            case 'edit':
                await handleEdit(interaction);
                break;
            case 'delete':
                await handleDelete(interaction);
                break;
            case 'platforms':
                await handlePlatforms(interaction);
                break;
        }
    }
};

async function handleView(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    let profile = cacheManager.get('userProfile', targetUser.id);
    if (!profile) {
        profile = await UserProfile.findOne({ userId: targetUser.id });
        if (profile) cacheManager.set('userProfile', targetUser.id, profile);
    }

    if (!profile) {
        const noProfileContainer = new ContainerBuilder()
            .setAccentColor(0x95A5A6)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.noProfile.title)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent(lang.profile.noProfile.user.replace('{user}', targetUser.username))
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setURL((typeof targetUser.displayAvatarURL === 'function' ? targetUser.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                            .setDescription(lang.profile.noProfile.avatarDesc.replace('{user}', targetUser.username))
                    )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.noProfile.footer.replace('{time}', new Date().toLocaleString()))
            );

        return interaction.editReply({
            components: [noProfileContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    
    let cardBuffer = null;
    let attachment = null;

    try {
        const cardGenerator = new ProfileCardGenerator();
        const platformCount = getPlatformCount(profile);

        cardBuffer = await cardGenerator.generateCard(
            targetUser.username,
            profile.bio,
            (typeof targetUser.displayAvatarURL === 'function' ? targetUser.displayAvatarURL({ extension: 'png', size: 512 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'),
            profile.customBanner,
            platformCount,
            'Your Elite Profile System'
        );

        if (cardBuffer) {
            attachment = new AttachmentBuilder(cardBuffer, { name: 'profile-card.png' });
        }
    } catch (cardError) {
        console.error('Profile card generation error:', cardError);
    }

    const bioText = profile.bio
        ? lang.profile.view.bio.replace('{bio}', profile.bio.substring(0, 100) + (profile.bio.length > 100 ? '...' : ''))
        : lang.profile.view.bioNotSet;
    const bannerStatus = profile.customBanner ? lang.profile.view.bannerSet : lang.profile.view.bannerNotSet;

    const profileContainer = new ContainerBuilder()
        .setAccentColor(0x0099FF)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.view.header.replace('{user}', targetUser.username))
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            lang.profile.view.user.replace('{user}', targetUser.username),
                            lang.profile.view.userId.replace('{id}', targetUser.id),
                            bioText,
                            lang.profile.view.customBanner.replace('{status}', bannerStatus),
                            lang.profile.view.platforms.replace('{count}', getPlatformCount(profile))
                        ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL((typeof targetUser.displayAvatarURL === 'function' ? targetUser.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                        .setDescription(lang.profile.noProfile.avatarDesc.replace('{user}', targetUser.username))
                )
        );

    if (attachment) {
        profileContainer
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder()
                    .addItems(
                        mediaItem => mediaItem
                            .setURL('attachment://profile-card.png')
                            .setDescription(lang.profile.view.cardTitle.replace('{user}', targetUser.username))
                    )
            );
    }

    profileContainer
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.view.footer.replace('{time}', new Date().toLocaleString()))
        );

    const platformButtons = await createPlatformButtons(profile);
    const allComponents = [profileContainer];

    const maxButtonRows = Math.min(platformButtons.length, MAX_ROWS);
    for (let i = 0; i < maxButtonRows; i++) {
        allComponents.push(platformButtons[i]);
    }

    const reply = {
        components: allComponents,
        flags: MessageFlags.IsComponentsV2
    };

    if (attachment) {
        reply.files = [attachment];
    }

    await interaction.editReply(reply);
}

async function handleBio(interaction) {
    const bio = interaction.options.getString('text');

    if (bio.length > 500) {
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.bio.tooLongTitle)
            );

        return interaction.editReply({
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    await UserProfile.findOneAndUpdate(
        { userId: interaction.user.id },
        { bio },
        { upsert: true, returnDocument: 'after' }
    );
    cacheManager.delete('userProfile', interaction.user.id);

    const bioContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.bio.updatedTitle)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(lang.profile.bio.newBio.replace('{bio}', bio))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL((typeof interaction.user.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                        .setDescription(lang.profile.bio.avatarDesc.replace('{user}', interaction.user.username))
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.bio.footer.replace('{time}', new Date().toLocaleString()))
        );

    await interaction.editReply({
        components: [bioContainer],
        flags: MessageFlags.IsComponentsV2
    });
}

async function handleBanner(interaction) {
    const bannerUrl = interaction.options.getString('url');

    if (!bannerUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)) {
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.banner.invalidUrlTitle)
            );

        return interaction.editReply({
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    await UserProfile.findOneAndUpdate(
        { userId: interaction.user.id },
        { customBanner: bannerUrl },
        { upsert: true, returnDocument: 'after' }
    );
    cacheManager.delete('userProfile', interaction.user.id);

    const bannerContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.banner.updatedTitle)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(lang.profile.banner.details.replace('{url}', bannerUrl))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL((typeof interaction.user.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                        .setDescription(lang.profile.bio.avatarDesc.replace('{user}', interaction.user.username))
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder()
                .addItems(
                    mediaItem => mediaItem
                        .setURL(bannerUrl)
                        .setDescription(lang.profile.banner.bannerDesc)
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.banner.footer.replace('{time}', new Date().toLocaleString()))
        );

    await interaction.editReply({
        components: [bannerContainer],
        flags: MessageFlags.IsComponentsV2
    });
}

async function handleAdd(interaction) {
    const platform = interaction.options.getString('platform');
    const username = interaction.options.getString('username');
    const url = interaction.options.getString('url');

    
    if (url && !/^https?:\/\/.+/i.test(url)) {
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.add.invalidUrl)
            );
        return interaction.editReply({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 });
    }

    const category = getCategoryForPlatform(platform);

    
    let updateData = {};

    switch (platform) {
        case 'riot':
            updateData = { riotId: username, region: 'global' };
            break;
        case 'xbox':
            updateData = { gamertag: username };
            break;
        case 'playstation':
            updateData = { psnId: username };
            break;
        case 'nintendo':
            updateData = { friendCode: username, username: username };
            break;
        case 'battlenet':
            updateData = { battleTag: username };
            break;
        case 'fortnite':
            updateData = { epicName: username };
            break;
        case 'youtube':
            
            updateData = { channelName: username };
            if (url) updateData.channelUrl = url;
            break;
        case 'facebook':
        case 'linkedin':
        case 'spotify':
            updateData = { displayName: username };
            break;
        case 'website':
        case 'portfolio':
            updateData = { title: username };
            if (url) updateData.url = url;
            break;
        case 'whatsapp':
            updateData = { number: username, displayName: username };
            break;
        case 'minecraft':
            updateData = { username: username, uuid: null };
            break;
        default:
            updateData = { username };
    }

    if (url && !['website', 'portfolio', 'youtube'].includes(platform)) {
        updateData.profileUrl = url;
    }

    await UserProfile.findOneAndUpdate(
        { userId: interaction.user.id },
        { [`${category}.${platform}`]: updateData },
        { upsert: true, returnDocument: 'after' }
    );
    cacheManager.delete('userProfile', interaction.user.id);

    const addUrlDisplay = url
        ? lang.profile.add.url.replace('{url}', url)
        : lang.profile.add.urlNotProvided;

    const addContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.add.successTitle)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            lang.profile.add.platform.replace('{emoji}', platformEmojis[platform] || getEmoji('games')).replace('{name}', platform.charAt(0).toUpperCase() + platform.slice(1)),
                            lang.profile.add.username.replace('{user}', username),
                            addUrlDisplay,
                            lang.profile.add.category.replace('{category}', category.charAt(0).toUpperCase() + category.slice(1))
                        ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL((typeof interaction.user.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                        .setDescription(lang.profile.bio.avatarDesc.replace('{user}', interaction.user.username))
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.add.footer.replace('{time}', new Date().toLocaleString()))
        );

    await interaction.editReply({
        components: [addContainer],
        flags: MessageFlags.IsComponentsV2
    });
}

async function handleRemove(interaction) {
    const platform = interaction.options.getString('platform');
    const category = getCategoryForPlatform(platform);

    let profile = cacheManager.get('userProfile', interaction.user.id);
    if (!profile) {
        profile = await UserProfile.findOne({ userId: interaction.user.id });
        if (profile) cacheManager.set('userProfile', interaction.user.id, profile);
    }
    if (!profile || !profile[category] || !profile[category][platform]) {
        const notFoundContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.remove.notFound.replace('{platform}', platform))
            );

        return interaction.editReply({
            components: [notFoundContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    await UserProfile.findOneAndUpdate(
        { userId: interaction.user.id },
        { $unset: { [`${category}.${platform}`]: 1 } }
    );
    cacheManager.delete('userProfile', interaction.user.id);

    const removeContainer = new ContainerBuilder()
        .setAccentColor(0xE74C3C)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.remove.successTitle)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            lang.profile.add.platform.replace('{emoji}', platformEmojis[platform] || getEmoji('games')).replace('{name}', platform.charAt(0).toUpperCase() + platform.slice(1)),
                            lang.profile.add.category.replace('{category}', category.charAt(0).toUpperCase() + category.slice(1)),
                            lang.profile.remove.action,
                            lang.profile.remove.status
                        ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL((typeof interaction.user.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                        .setDescription(lang.profile.bio.avatarDesc.replace('{user}', interaction.user.username))
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.remove.footer.replace('{time}', new Date().toLocaleString()))
        );

    await interaction.editReply({
        components: [removeContainer],
        flags: MessageFlags.IsComponentsV2
    });
}

async function handleEdit(interaction) {
    const platform = interaction.options.getString('platform');
    const username = interaction.options.getString('username');
    const url = interaction.options.getString('url');

    const category = getCategoryForPlatform(platform);
    let profile = cacheManager.get('userProfile', interaction.user.id);
    if (!profile) {
        profile = await UserProfile.findOne({ userId: interaction.user.id });
        if (profile) cacheManager.set('userProfile', interaction.user.id, profile);
    }

    if (!profile || !profile[category] || !profile[category][platform]) {
        const notFoundContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.edit.notFound.replace('{platform}', platform))
            );

        return interaction.editReply({
            components: [notFoundContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    const updateData = {};
    if (username) {
        
        switch (platform) {
            case 'riot':
                updateData[`${category}.${platform}.riotId`] = username;
                break;
            case 'xbox':
                updateData[`${category}.${platform}.gamertag`] = username;
                break;
            case 'playstation':
                updateData[`${category}.${platform}.psnId`] = username;
                break;
            case 'nintendo':
                updateData[`${category}.${platform}.friendCode`] = username;
                updateData[`${category}.${platform}.username`] = username;
                break;
            case 'battlenet':
                updateData[`${category}.${platform}.battleTag`] = username;
                break;
            case 'fortnite':
                updateData[`${category}.${platform}.epicName`] = username;
                break;
            case 'youtube':
                
                updateData[`${category}.${platform}.channelName`] = username;
                break;
            case 'facebook':
            case 'linkedin':
            case 'spotify':
                updateData[`${category}.${platform}.displayName`] = username;
                break;
            case 'website':
            case 'portfolio':
                updateData[`${category}.${platform}.title`] = username;
                break;
            case 'whatsapp':
                updateData[`${category}.${platform}.number`] = username;
                updateData[`${category}.${platform}.displayName`] = username;
                break;
            default:
                updateData[`${category}.${platform}.username`] = username;
        }
    }

    if (url) {
        if (['website', 'portfolio'].includes(platform)) {
            updateData[`${category}.${platform}.url`] = url;
        } else if (platform === 'youtube') {
            updateData[`${category}.${platform}.channelUrl`] = url;
        } else {
            updateData[`${category}.${platform}.profileUrl`] = url;
        }
    }

    await UserProfile.findOneAndUpdate(
        { userId: interaction.user.id },
        updateData
    );
    cacheManager.delete('userProfile', interaction.user.id);

    const usernameDisplay = username ? lang.profile.edit.newUsername.replace('{user}', username) : lang.profile.edit.usernameUnchanged;
    const editUrlDisplay = url ? lang.profile.edit.newUrl.replace('{url}', url) : lang.profile.edit.urlUnchanged;

    const editContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.edit.successTitle)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            lang.profile.add.platform.replace('{emoji}', platformEmojis[platform] || getEmoji('games')).replace('{name}', platform.charAt(0).toUpperCase() + platform.slice(1)),
                            usernameDisplay,
                            editUrlDisplay,
                            lang.profile.add.category.replace('{category}', category.charAt(0).toUpperCase() + category.slice(1))
                        ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL((typeof interaction.user.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                        .setDescription(lang.profile.bio.avatarDesc.replace('{user}', interaction.user.username))
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.edit.footer.replace('{time}', new Date().toLocaleString()))
        );

    await interaction.editReply({
        components: [editContainer],
        flags: MessageFlags.IsComponentsV2
    });
}

async function handleDelete(interaction) {
    let profile = cacheManager.get('userProfile', interaction.user.id);
    if (!profile) {
        profile = await UserProfile.findOne({ userId: interaction.user.id });
        if (profile) cacheManager.set('userProfile', interaction.user.id, profile);
    }
    if (!profile) {
        const noProfileContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.delete.notFound)
            );

        return interaction.editReply({
            components: [noProfileContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    await UserProfile.findOneAndDelete({ userId: interaction.user.id });
    cacheManager.delete('userProfile', interaction.user.id);

    const deleteContainer = new ContainerBuilder()
        .setAccentColor(0xE74C3C)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.delete.successTitle)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            lang.profile.noProfile.user.replace('{user}', interaction.user.username),
                            lang.profile.delete.action,
                            lang.profile.delete.status,
                            lang.profile.delete.recovery
                        ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL((typeof interaction.user.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                        .setDescription(lang.profile.delete.avatarDesc)
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.delete.footer.replace('{time}', new Date().toLocaleString()))
        );

    await interaction.editReply({
        components: [deleteContainer],
        flags: MessageFlags.IsComponentsV2
    });
}

async function handlePlatforms(interaction) {
    let profile = cacheManager.get('userProfile', interaction.user.id);
    if (!profile) {
        profile = await UserProfile.findOne({ userId: interaction.user.id });
        if (profile) cacheManager.set('userProfile', interaction.user.id, profile);
    }
    if (!profile) {
        const noPlatformsContainer = new ContainerBuilder()
            .setAccentColor(0x95A5A6)
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.platforms.notFound)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.platforms.getStarted)
            );

        return interaction.editReply({
            components: [noPlatformsContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    const profileStatus = profile.bio ? lang.profile.platforms.statusComplete : lang.profile.platforms.statusNeedsBio;
    const bannerStatus = profile.customBanner ? lang.profile.view.bannerSet : lang.profile.view.bannerNotSet;

    const platformsContainer = new ContainerBuilder()
        .setAccentColor(0x0099FF)
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.platforms.header)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            lang.profile.view.user.replace('{user}', interaction.user.username),
                            lang.profile.platforms.total.replace('{count}', getPlatformCount(profile)),
                            lang.profile.platforms.status.replace('{status}', profileStatus),
                            lang.profile.view.customBanner.replace('{status}', bannerStatus)
                        ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL((typeof interaction.user.displayAvatarURL === 'function' ? interaction.user.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'))
                        .setDescription(lang.profile.bio.avatarDesc.replace('{user}', interaction.user.username))
                )
        );

    const platformList = getPlatformSummary(profile);

    if (platformList && platformList !== lang.profile.platforms.emptySummary && platformList !== 'No platforms added. Use `/profile add` to link your accounts.') {
        platformsContainer
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(platformList.substring(0, 3800))
            );
    } else {
        platformsContainer
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(lang.profile.platforms.emptyNotice)
            );
    }

    platformsContainer
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(lang.profile.platforms.footer.replace('{time}', new Date().toLocaleString()))
        );

    await interaction.editReply({
        components: [platformsContainer],
        flags: MessageFlags.IsComponentsV2
    });
}

function getCategoryForPlatform(platform) {
    for (const [category, platforms] of Object.entries(platformCategories)) {
        if (platforms.includes(platform)) return category;
    }
    return 'other';
}


function getConnectedPlatforms(profile) {
    const connected = [];

    for (const [category, platforms] of Object.entries(platformCategories)) {
        if (profile[category]) {
            for (const platform of platforms) {
                if (profile[category][platform]) {
                    const data = profile[category][platform];

                    
                    let hasData = false;

                    switch (platform) {
                        case 'youtube':
                            hasData = data && (data.channelName || data.channelUrl);
                            break;
                        case 'riot':
                            hasData = data && data.riotId;
                            break;
                        case 'xbox':
                            hasData = data && data.gamertag;
                            break;
                        case 'playstation':
                            hasData = data && data.psnId;
                            break;
                        case 'nintendo':
                            hasData = data && (data.friendCode || data.username);
                            break;
                        case 'battlenet':
                            hasData = data && data.battleTag;
                            break;
                        case 'fortnite':
                            hasData = data && data.epicName;
                            break;
                        case 'facebook':
                        case 'linkedin':
                        case 'spotify':
                            hasData = data && data.displayName;
                            break;
                        case 'website':
                        case 'portfolio':
                            hasData = data && (data.url || data.title);
                            break;
                        case 'whatsapp':
                            hasData = data && data.number;
                            break;
                        default:
                            hasData = data && data.username;
                    }

                    if (hasData) {
                        connected.push({
                            platform,
                            category,
                            data
                        });
                    }
                }
            }
        }
    }

    return connected;
}

function getPlatformCount(profile) {
    return getConnectedPlatforms(profile).length;
}

function generatePlatformUrl(platform, data) {
    if (!data) return null;

    if (platformUrlGenerators[platform]) {
        try {
            return platformUrlGenerators[platform](data);
        } catch (error) {
            console.error(`Error generating URL for ${platform}:`, error);
            return data.profileUrl || data.url || data.channelUrl || null;
        }
    }

    return data.profileUrl || data.url || data.channelUrl || null;
}

function getPlatformSummary(profile) {
    const connectedPlatforms = getConnectedPlatforms(profile);

    if (connectedPlatforms.length === 0) {
        return lang.profile.platforms.emptySummary;
    }

    let summary = '';
    const categorizedPlatforms = {};

    
    for (const { platform, category, data } of connectedPlatforms) {
        if (!categorizedPlatforms[category]) {
            categorizedPlatforms[category] = [];
        }

        let displayName;
        const labels = lang.profile.platformLabels || {};
        switch (platform) {
            case 'youtube':
                displayName = data.channelName || labels.youtube;
                break;
            case 'riot':
                displayName = data.riotId || labels.riot;
                break;
            case 'xbox':
                displayName = data.gamertag || labels.xbox;
                break;
            case 'playstation':
                displayName = data.psnId || labels.playstation;
                break;
            case 'nintendo':
                displayName = data.friendCode || data.username || labels.nintendo;
                break;
            case 'battlenet':
                displayName = data.battleTag || labels.battlenet;
                break;
            case 'fortnite':
                displayName = data.epicName || labels.fortnite;
                break;
            case 'facebook':
            case 'linkedin':
            case 'spotify':
                displayName = data.displayName || labels.account;
                break;
            case 'website':
            case 'portfolio':
                displayName = data.title || labels.website;
                break;
            case 'whatsapp':
                displayName = data.displayName || data.number || labels.whatsapp;
                break;
            default:
                displayName = data.username || labels.account;
        }

        const url = generatePlatformUrl(platform, data);
        const urlText = url ? ` - [${lang.profile.buttons.openLink}](${url})` : '';

        categorizedPlatforms[category].push(
            `${platformEmojis[platform]} **${platform.charAt(0).toUpperCase() + platform.slice(1)}:** ${displayName}${urlText}`
        );
    }

    
    for (const [category, platforms] of Object.entries(categorizedPlatforms)) {
        summary += `\n**${category.charAt(0).toUpperCase() + category.slice(1)}**\n${platforms.join('\n')}\n`;
    }

    return summary;
}


async function createPlatformButtons(profile) {
    const buttons = [];
    const connectedPlatforms = getConnectedPlatforms(profile);

    for (const { platform, category, data } of connectedPlatforms) {
        let displayName;
        switch (platform) {
            case 'youtube':
                displayName = data.channelName || 'YouTube';
                break;
            case 'riot':
                displayName = data.riotId || 'Riot';
                break;
            case 'xbox':
                displayName = data.gamertag || 'Xbox';
                break;
            case 'playstation':
                displayName = data.psnId || 'PlayStation';
                break;
            case 'nintendo':
                displayName = data.friendCode || data.username || 'Nintendo';
                break;
            case 'battlenet':
                displayName = data.battleTag || 'Battle.net';
                break;
            case 'fortnite':
                displayName = data.epicName || 'Fortnite';
                break;
            case 'facebook':
            case 'linkedin':
            case 'spotify':
                displayName = data.displayName || platform;
                break;
            case 'website':
            case 'portfolio':
                displayName = data.title || platform;
                break;
            case 'whatsapp':
                displayName = data.displayName || data.number || 'WhatsApp';
                break;
            default:
                displayName = data.username || platform;
        }

        const label = `${platformEmojis[platform]} ${displayName}`.substring(0, 80);
        const url = generatePlatformUrl(platform, data);

        
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            buttons.push(
                linkBtn({
                    label,
                    url
                })
            );
        }
    }

    return paginateButtons(buttons);
}

