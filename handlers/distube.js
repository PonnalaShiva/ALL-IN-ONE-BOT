const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { Dynamic } = require('musicard');
const musicIcons = require('../UI/icons/musicicons');
const { MessageFlags } = require('discord.js');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const path = require('path');
const data = require('../UI/banners/musicard');
const pendingCleanupTimers = new Set();

function scheduleCleanup(callback, delay) {
    const timer = setTimeout(async () => {
        pendingCleanupTimers.delete(timer);
        await callback();
    }, delay);
    timer.unref?.();
    pendingCleanupTimers.add(timer);
    return timer;
}

function autoDeleteMessage(message, delay) {
    const timer = scheduleCleanup(async () => {
        try {
            if (message && !message.deleted) {
                await message.delete().catch(() => {});
            }
        } catch (error) {
            
        }
    }, delay);
    return timer;
}

module.exports = async (client) => {
  
    const distubeConfig = require('../utils/distubeConfig'); 
    
    
    client.distube = new DisTube(client, {
        ...distubeConfig.distubeOptions,
        plugins: [
            new YtDlpPlugin({
                update: false, 
                cookies: path.join(__dirname, '../utils/cookies.txt'), 
            })
        ],
    });

    
    client.musicMessages = new Map(); 
    
  
    const addMessageForCleanup = (guildId, message) => {
        if (!client.musicMessages.has(guildId)) {
            client.musicMessages.set(guildId, []);
        }
        client.musicMessages.get(guildId).push(message);
    };
    
  
    const cleanupMessages = async (guildId, delay = 0) => {
        const messages = client.musicMessages.get(guildId);
        if (!messages || messages.length === 0) return;
        
        if (delay > 0) {
            scheduleCleanup(async () => {
                await performCleanup(guildId, messages);
            }, delay);
        } else {
            await performCleanup(guildId, messages);
        }
    };
    
  
    const performCleanup = async (guildId, messages) => {
      
        
        for (const message of messages) {
            try {
                if (message && !message.deleted) {
                    await message.delete();
                }
            } catch (error) {
                
            }
        }
        
       
        client.musicMessages.set(guildId, []);
    };

   
    client.playMusic = async (channel, query, options = {}) => {
        try {

            const connection = await client.distube.voices.join(channel);

            await new Promise(resolve => setTimeout(resolve, 500));
            
        
            const queue = await client.distube.play(channel, query, {
                textChannel: options.textChannel || null,
                member: options.member || null,
                ...options
            });
            
          
            return queue;
            
        } catch (error) {

            if (error.message.includes('VOICE_CONNECT_FAILED') || error.message.includes('connection')) {
             
                try {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const connection = await client.distube.voices.join(channel);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const queue = await client.distube.play(channel, query, {
                        textChannel: options.textChannel || null,
                        member: options.member || null,
                        ...options
                    });
                    
                  
                    return queue;
                    
                } catch (retryError) {
              
                    throw retryError;
                }
            }
            throw error;
        }
    };

   
    const distubeListeners = [];
    const registerDisTubeEvent = (eventName, listener) => {
        client.distube.on(eventName, listener);
        distubeListeners.push({ eventName, listener });
    };

    registerDisTubeEvent('playSong', async (queue, song) => {

        if (queue.voiceChannel) {
            await cleanupMessages(queue.voiceChannel.guild.id);
        }
        
        if (queue.textChannel) {
            try {
                const musicCard = await generateMusicCard(song);
                const embed = {
                    color: 0xDC92FF,
                    author: {
                        name: 'Now playing',
                        url: 'https://discord.gg/xQF9f9yUEM',
                        icon_url: musicIcons.playerIcon
                    },
                    description: `- Song name: **${song.name}** \n- Duration: **${song.formattedDuration}**\n- Requested by: ${song.user}`,
                    image: {
                        url: 'attachment://musicCard.png'
                    },
                    footer: {
                        text: 'Distube Player',
                        icon_url: musicIcons.footerIcon
                    },
                    timestamp: new Date().toISOString()
                };
                
                const message = await queue.textChannel.send({ 
                    embeds: [embed], 
                    files: [{ attachment: musicCard, name: 'musicCard.png' }] 
                });
                
             
                addMessageForCleanup(queue.voiceChannel.guild.id, message);
                
            } catch (error) {

                const fallbackCard = buildCard({
                    title: `${getEmoji('music')} Now playing`,
                    tone: 'music',
                    sections: [
                        `**${song.name}**\n• **Duration:** ${song.formattedDuration}\n• **Requested by:** ${song.user}`
                    ],
                    thumbnailURL: song.thumbnail || null,
                    _footer: 'Distube Player'
                });
                try {
                    const message = await queue.textChannel.send({ components: [fallbackCard], flags: MessageFlags.IsComponentsV2 });
                    addMessageForCleanup(queue.voiceChannel.guild.id, message);
                } catch (err) {
                
                }
            }
        }
    });

  
    registerDisTubeEvent('addSong', async (queue, song) => {
      
        
        if (queue.textChannel) {
            try {
                const card = buildCard({
                    title: `${getEmoji('check')} Song added successfully`,
                    tone: 'success',
                    sections: [
                        `**${song.name}**\n• **Duration:** ${song.formattedDuration}\n• **Added by:** ${song.user}`
                    ],
                    thumbnailURL: song.thumbnail || null,
                    _footer: 'Distube Player'
                });
                const message = await queue.textChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
                addMessageForCleanup(queue.voiceChannel.guild.id, message);
                autoDeleteMessage(message, 5000);
                
            } catch (error) {
             
            }
        }
    });

  
    registerDisTubeEvent('addList', async (queue, playlist) => {
      
        
        if (queue.textChannel) {
            try {
                const card = buildCard({
                    title: `${getEmoji('check')} Playlist added successfully`,
                    tone: 'success',
                    sections: [
                        `**${playlist.name}**\n• **Songs:** ${playlist.songs.length}\n• **Added by:** ${playlist.user}`
                    ],
                    thumbnailURL: playlist.thumbnail || null,
                    _footer: 'Distube Player'
                });
                const message = await queue.textChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
                addMessageForCleanup(queue.voiceChannel.guild.id, message);
                autoDeleteMessage(message, 8000);
                
            } catch (error) {
            
            }
        }
    });


    registerDisTubeEvent('finish', async (queue) => {

        if (queue.voiceChannel) {
            await cleanupMessages(queue.voiceChannel.guild.id);
        }
        
        if (queue.textChannel) {
            try {
                const card = buildCard({
                    title: `${getEmoji('music')} Queue finished`,
                    tone: 'danger',
                    sections: ['All songs have been played!'],
                    _footer: 'Distube Player'
                });
                const message = await queue.textChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
                autoDeleteMessage(message, 5000);
                
            } catch (error) {
              
            }
        }
    });

    
    registerDisTubeEvent('disconnect', async (queue) => {

        if (queue.voiceChannel) {
            await cleanupMessages(queue.voiceChannel.guild.id);
        }
        
        if (queue.textChannel) {
            const card = buildCard({
                title: `${getEmoji('alert')} Disconnected`,
                tone: 'warning',
                sections: ['Disconnected from voice channel'],
                _footer: 'Distube Player'
            });
            try {
                const message = await queue.textChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
                autoDeleteMessage(message, 3000);
                
            } catch (error) {
             
            }
        }
    });


    registerDisTubeEvent('empty', async (queue) => {

        if (queue.voiceChannel) {
            await cleanupMessages(queue.voiceChannel.guild.id);
        }
        
        if (queue.textChannel) {
            const card = buildCard({
                title: `${getEmoji('alert')} Voice channel empty`,
                tone: 'warning',
                sections: ['Left the voice channel due to inactivity'],
                _footer: 'Distube Player'
            });
            try {
                const message = await queue.textChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
                autoDeleteMessage(message, 3000);
                
            } catch (error) {
              
            }
        }
    });

    
    registerDisTubeEvent('error', async (channel, error) => {

        if (channel && channel.guild) {
            await cleanupMessages(channel.guild.id);
        }
        
        if (channel && typeof channel.send === 'function') {
            const card = buildCard({
                title: `${getEmoji('cross')} Error occurred`,
                tone: 'danger',
                sections: [error.message],
                _footer: 'Distube Player'
            });
            try {
                const message = await channel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
                autoDeleteMessage(message, 8000);
                
            } catch (err) {
              
            }
        }
    });
    

    client.cleanupMusicMessages = cleanupMessages;
    client.addMusicMessage = addMessageForCleanup;
    
   
    registerDisTubeEvent('debug', (message) => {
      
    });

    return {
        stop() {
            for (const { eventName, listener } of distubeListeners) {
                client.distube.off(eventName, listener);
            }
            distubeListeners.length = 0;
            for (const voice of client.distube?.voices?.collection?.values?.() || []) {
                try {
                    voice.leave();
                } catch (error) {
                    
                }
            }
            for (const timer of pendingCleanupTimers) clearTimeout(timer);
            pendingCleanupTimers.clear();
            client.musicMessages.clear();
        }
    };
};

async function generateMusicCard(song) {
    try {
        const randomIndex = Math.floor(Math.random() * data.backgroundImages.length);
        const backgroundImage = data.backgroundImages[randomIndex];

        return await Dynamic({
            thumbnailImage: song.thumbnail,
            name: song.name,
            author: song.formattedDuration,
            authorColor: "#FF7A00",
            progress: 50,
            imageDarkness: 60,
            backgroundImage: backgroundImage,
            nameColor: "#FFFFFF",
            progressColor: "#FF7A00",
            progressBarColor: "#5F2D00",
        });
    } catch (error) {
      
        throw error;
    }
}
