
require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const lang = require('../../events/loadLanguage');
const { ACCENT, getEmoji, getButtonEmoji } = require('../../UI');

function makeCard(text, color = ACCENT.primary) {
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
}

function claimSingleSelection(state) {
  if (state.claimed) return false;
  state.claimed = true;
  return true;
}

const ytSearch = require('yt-search');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('distube')
    .setDescription('Complete music control system.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('play')
        .setDescription('Search for and play a song.')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('The song to search for')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('url')
        .setDescription('Play a song from URL.')
        .addStringOption(option =>
          option.setName('url')
            .setDescription('YouTube URL to play')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('Pause the current song.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('resume')
        .setDescription('Resume the paused song.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('Skip the current song.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stop playing and clear the queue.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('nowplaying')
        .setDescription('Show currently playing song.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('queue')
        .setDescription('Show the music queue.')
        .addIntegerOption(option =>
          option.setName('page')
            .setDescription('Page number to view')
            .setMinValue(1)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('loop')
        .setDescription('Toggle loop mode.')
        .addStringOption(option =>
          option.setName('mode')
            .setDescription('Loop mode')
            .setRequired(true)
            .addChoices(
              { name: 'Off', value: '0' },
              { name: 'Song', value: '1' },
              { name: 'Queue', value: '2' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('volume')
        .setDescription('Set the volume.')
        .addIntegerOption(option =>
          option.setName('level')
            .setDescription('Volume level (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('shuffle')
        .setDescription('Shuffle the queue.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a song from queue.')
        .addIntegerOption(option =>
          option.setName('position')
            .setDescription('Position in queue to remove')
            .setRequired(true)
            .setMinValue(1))),

  
  async autoDeleteMessage(message, timeout = 3000) {
    setTimeout(async () => {
      try {
        if (message && message.deletable) {
          await message.delete();
        }
      } catch (error) {
        console.log('Could not delete message:', error.message);
      }
    }, timeout);
  },

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const query = interaction.options.getString('query') || interaction.options.getString('url');
    const channel = interaction.member.voice.channel;
    const distube = interaction.client.distube;

    
    if (['queue', 'nowplaying'].includes(subcommand)) {
      const queue = distube.getQueue(interaction.guild.id);

      if (subcommand === 'queue') {
        if (!queue || !queue.songs.length) {
          const message = await interaction.followUp({
            components: [makeCard(`${getEmoji('cross')} The queue is empty.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(message, 7000); 
          return;
        }

        const songsPerPage = 10;
        const page = interaction.options.getInteger('page') || 1;
        const totalPages = Math.ceil(queue.songs.length / songsPerPage);

        if (page > totalPages) {
          const message = await interaction.followUp({
            components: [makeCard(`${getEmoji('cross')} Page ${page} doesn't exist. Total pages: ${totalPages}`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
          this.autoDeleteMessage(message, 7000);
          return;
        }

        const startIndex = (page - 1) * songsPerPage;
        const endIndex = Math.min(startIndex + songsPerPage, queue.songs.length);
        const pageSongs = queue.songs.slice(startIndex, endIndex);

        let queueContent = `## ${lang.distube.queue.title.replace('{page}', String(page)).replace('{total}', String(totalPages))}\n\n`;
        queueContent += `${lang.distube.queue.totalSongs.replace('{count}', String(queue.songs.length))}\n`;
        queueContent += `${lang.distube.queue.totalDuration.replace('{duration}', queue.formattedDuration)}\n\n`;

        pageSongs.forEach((song, index) => {
          const position = startIndex + index + 1;
          const prefix = position === 1 ? lang.distube.queue.nowPlayingPrefix : `**${position}.**`;
          const durStr = lang.distube.nowplaying.duration.replace('{duration}', song.formattedDuration);
          const reqStr = lang.distube.nowplaying.requestedBy.replace('{user}', song.user.displayName);
          queueContent += `${prefix} ${song.name}\n> ${durStr} | ${reqStr}\n\n`;
        });

        const queueContainer = new ContainerBuilder()
          .setAccentColor(ACCENT.success)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(queueContent.trim()));

        const components = [];
        let displayedQueueContainer = queueContainer;
        let displayedQueueComponents = components;
        if (totalPages > 1) {
          const row = new ActionRowBuilder();

          if (page > 1) {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`queue_${page - 1}`)
                .setLabel(lang.distube.queue.prevButton)
                .setStyle(ButtonStyle.Secondary)
            );
          }

          if (page < totalPages) {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`queue_${page + 1}`)
                .setLabel(lang.distube.queue.nextButton)
                .setStyle(ButtonStyle.Secondary)
            );
          }

          if (row.components.length > 0) {
            components.push(row);
          }
        }

        const message = await interaction.followUp({ components: [queueContainer, ...components], flags: MessageFlags.IsComponentsV2 });

        if (components.length > 0) {
          const collector = message.createMessageComponentCollector({
            filter: i => i.customId.startsWith('queue_') && i.user.id === interaction.user.id,
            time: 60000
          });

          collector.on('collect', async i => {
            try {
              await i.deferUpdate();
              const newPage = parseInt(i.customId.split('_')[1]);

              const newStartIndex = (newPage - 1) * songsPerPage;
              const newEndIndex = Math.min(newStartIndex + songsPerPage, queue.songs.length);
              const newPageSongs = queue.songs.slice(newStartIndex, newEndIndex);

              let newQueueContent = `## ${lang.distube.queue.title.replace('{page}', String(newPage)).replace('{total}', String(totalPages))}\n\n`;
              newQueueContent += `${lang.distube.queue.totalSongs.replace('{count}', String(queue.songs.length))}\n`;
              newQueueContent += `${lang.distube.queue.totalDuration.replace('{duration}', queue.formattedDuration)}\n\n`;

              newPageSongs.forEach((song, index) => {
                const position = newStartIndex + index + 1;
                const prefix = position === 1 ? lang.distube.queue.nowPlayingPrefix : `**${position}.**`;
                const durStr = lang.distube.nowplaying.duration.replace('{duration}', song.formattedDuration);
                const reqStr = lang.distube.nowplaying.requestedBy.replace('{user}', song.user.displayName);
                newQueueContent += `${prefix} ${song.name}\n> ${durStr} | ${reqStr}\n\n`;
              });

              const newQueueContainer = new ContainerBuilder()
                .setAccentColor(ACCENT.success)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(newQueueContent.trim()));

              const newComponents = [];
              const newRow = new ActionRowBuilder();

              if (newPage > 1) {
                newRow.addComponents(
                  new ButtonBuilder()
                    .setCustomId(`queue_${newPage - 1}`)
                    .setLabel(lang.distube.queue.prevButton)
                    .setStyle(ButtonStyle.Secondary)
                );
              }

              if (newPage < totalPages) {
                newRow.addComponents(
                  new ButtonBuilder()
                    .setCustomId(`queue_${newPage + 1}`)
                    .setLabel(lang.distube.queue.nextButton)
                    .setStyle(ButtonStyle.Secondary)
                );
              }

              if (newRow.components.length > 0) {
                newComponents.push(newRow);
              }

              await i.editReply({ components: [newQueueContainer, ...newComponents], flags: MessageFlags.IsComponentsV2 });
              displayedQueueContainer = newQueueContainer;
              displayedQueueComponents = newComponents;
            } catch (error) {
              console.error('[Distube] Queue pagination failed:', error);
              const payload = {
                content: 'Could not update the queue page. Please try again.',
                flags: MessageFlags.Ephemeral
              };
              if (i.deferred || i.replied) {
                await i.followUp(payload).catch(() => { });
              } else {
                await i.reply(payload).catch(() => { });
              }
            }
          });

          collector.on('end', () => {
            const disabledComponents = displayedQueueComponents.map(row =>
              new ActionRowBuilder().addComponents(
                row.components.map(button => ButtonBuilder.from(button).setDisabled(true))
              )
            );
            message.edit({ components: [displayedQueueContainer, ...disabledComponents], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
            
            this.autoDeleteMessage(message, 7000);
          });
        } else {
          
          this.autoDeleteMessage(message, 7000);
        }

        return;
      }

      if (subcommand === 'nowplaying') {
        if (!queue || !queue.songs.length) {
          const message = await interaction.followUp({
            components: [makeCard(`${getEmoji('cross')} Nothing is currently playing.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(message);
          return;
        }

        const song = queue.songs[0];
        const npContent =
          `## ${getEmoji('music')} Now Playing\n\n` +
          `**${song.name}**\n\n` +
          `• **${getEmoji('user')} Artist:** ${song.uploader.name || 'Unknown'}\n` +
          `• **${getEmoji('time')} Duration:** ${song.formattedDuration}\n` +
          `• **${getEmoji('music')} Requested by:** ${song.user.displayName}\n` +
          `• **${getEmoji('loop')} Loop Mode:** ${this.getLoopModeText(queue.repeatMode)}\n` +
          `• **${getEmoji('volume_high')} Volume:** ${queue.volume}%\n` +
          `• **${getEmoji('pause')} Status:** ${queue.paused ? 'Paused' : 'Playing'}`;

        const npContainer = new ContainerBuilder()
          .setAccentColor(ACCENT.success)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(npContent));

        const message = await interaction.followUp({ components: [npContainer], flags: MessageFlags.IsComponentsV2 });
        this.autoDeleteMessage(message);
        return;
      }
    }

    
    if (!channel) {
      const message = await interaction.followUp({
        components: [makeCard(`${getEmoji('cross')} You need to be in a voice channel to use music commands.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      this.autoDeleteMessage(message);
      return;
    }

    const permissions = channel.permissionsFor(interaction.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      const message = await interaction.followUp({
        components: [makeCard(`${getEmoji('cross')} I need **Connect** and **Speak** permissions in the voice channel!`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      this.autoDeleteMessage(message);
      return;
    }

    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    const botVoiceChannel = botMember?.voice?.channel;

    if (botVoiceChannel && botVoiceChannel.id !== channel.id) {
      try {
        console.log(`[DisTube] Bot is in different channel (${botVoiceChannel.name}), cleaning up...`);

        if (interaction.client.riffy && interaction.client.riffy.players) {
          const player = interaction.client.riffy.players.get(interaction.guild.id);
          if (player) {
            console.log('[DisTube] Destroying Riffy player...');
            await player.destroy().catch(() => { });
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
        if (interaction.client.nodeManager && interaction.client.nodeManager.riffy && interaction.client.nodeManager.riffy.players) {
          const player = interaction.client.nodeManager.riffy.players.get(interaction.guild.id);
          if (player) {
            console.log('[DisTube] Destroying NodeManager Riffy player...');
            await player.destroy().catch(() => { });
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        const existingQueue = distube.getQueue(interaction.guild.id);
        if (existingQueue) {
          console.log('[DisTube] Stopping existing DisTube queue...');
          await distube.stop(interaction.guild.id).catch(() => { });
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        console.log('[DisTube] Disconnecting from voice channel...');
        await botMember.voice.disconnect().catch(() => { });
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (cleanupError) {
        console.error('[DisTube] Cleanup error:', cleanupError);
      }
    } else if (botVoiceChannel && botVoiceChannel.id === channel.id) {
      const existingQueue = distube.getQueue(interaction.guild.id);
      if (!existingQueue && (interaction.client.riffy?.players?.get(interaction.guild.id) || interaction.client.nodeManager?.riffy?.players?.get(interaction.guild.id))) {
        try {
          console.log('[DisTube] Bot is in same channel but Riffy is active, cleaning up...');
          if (interaction.client.riffy && interaction.client.riffy.players) {
            const player = interaction.client.riffy.players.get(interaction.guild.id);
            if (player) {
              await player.destroy().catch(() => { });
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
          if (interaction.client.nodeManager && interaction.client.nodeManager.riffy && interaction.client.nodeManager.riffy.players) {
            const player = interaction.client.nodeManager.riffy.players.get(interaction.guild.id);
            if (player) {
              await player.destroy().catch(() => { });
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
        } catch (cleanupError) {
          console.error('[DisTube] Cleanup error:', cleanupError);
        }
      }
    }

    const queue = distube.getQueue(interaction.guild.id);

    try {
      switch (subcommand) {
        case 'play':
        case 'url':
          if (subcommand === 'play') {
            const searchResult = await ytSearch(query);

            if (!searchResult || !searchResult.videos.length) {
              const message = await interaction.followUp({
                components: [makeCard(`${getEmoji('cross')} No songs found for your query.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
              });
              this.autoDeleteMessage(message);
              return;
            }

            const videos = searchResult.videos.slice(0, 3);

            let searchContent = `## ${getEmoji('search')} Search Results\n\nSelect a song to play:\n\n`;
            videos.forEach((video, index) => {
              searchContent += `**${index + 1}. ${video.title}**\n> Duration: ${video.timestamp} | ${video.author.name}\n\n`;
            });

            const searchContainer = new ContainerBuilder()
              .setAccentColor(ACCENT.primary)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(searchContent.trim()));

            const row1 = new ActionRowBuilder();

            videos.forEach((video, index) => {
              row1.addComponents(
                new ButtonBuilder()
                  .setCustomId(`play_${index}`)
                  .setLabel(`${index + 1}`)
                  .setStyle(ButtonStyle.Primary)
              );
            });

            const sentMessage = await interaction.followUp({ components: [searchContainer, row1], flags: MessageFlags.IsComponentsV2 });

            const filter = i => i.customId.startsWith('play_') && i.user.id === interaction.user.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 15000 });
            const selectionState = { claimed: false };

            collector.on('collect', async i => {
              if (!claimSingleSelection(selectionState)) {
                await i.reply({ content: 'A song selection is already being processed.', flags: MessageFlags.Ephemeral }).catch(() => { });
                return;
              }

              collector.stop('selected');
              try {
                const disabledRow = new ActionRowBuilder().addComponents(
                  row1.components.map(button =>
                    ButtonBuilder.from(button).setDisabled(true)
                  )
                );

                await i.update({ components: [searchContainer, disabledRow], flags: MessageFlags.IsComponentsV2 });

                const [action, index] = i.customId.split('_');
                const selectedVideo = videos[parseInt(index)];

                if (selectedVideo) {
                  const queueMessage = await interaction.followUp({
                    components: [makeCard(`${getEmoji('music')} Queuing: **${selectedVideo.title}**...`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
                  });

                  try {
                    await distube.play(channel, selectedVideo.url, {
                      member: interaction.member,
                      textChannel: interaction.channel,
                    });
                  } catch (playError) {
                    if (playError.errorCode === 'VOICE_CONNECT_FAILED' || playError.message?.includes('VOICE_CONNECT_FAILED')) {
                      console.log('Voice connect failed, attempting to rejoin...');
                      try {
                        const botMember = channel.guild.members.cache.get(interaction.client.user.id);
                        if (botMember?.voice?.channel) {
                          await botMember.voice.disconnect().catch(() => { });
                          await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        if (interaction.client.riffy && interaction.client.riffy.players) {
                          const player = interaction.client.riffy.players.get(channel.guild.id);
                          if (player) {
                            await player.destroy().catch(() => { });
                            await new Promise(resolve => setTimeout(resolve, 1000));
                          }
                        }
                        const queue = distube.getQueue(channel.guild.id);
                        if (queue) {
                          await distube.stop(channel.guild.id).catch(() => { });
                          await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await distube.voices.join(channel);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await distube.play(channel, selectedVideo.url, {
                          member: interaction.member,
                          textChannel: interaction.channel,
                        });
                      } catch (retryError) {
                        console.error('Retry failed:', retryError);
                        const errorMessage = await queueMessage.edit({
                          components: [makeCard(`${getEmoji('cross')} Failed to connect to voice channel. The bot may be connected via another music system. Please try \`/distube stop\` first or restart the bot.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
                        });
                        this.autoDeleteMessage(errorMessage);
                        return;
                      }
                    } else {
                      throw playError;
                    }
                  }

                  const successMessage = await queueMessage.edit({
                    components: [makeCard(`${getEmoji('tick')} Successfully queued: **${selectedVideo.title}**`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
                  });

                  
                  this.autoDeleteMessage(successMessage);
                } else {
                  const errorMessage = await interaction.followUp({
                    components: [makeCard(`${getEmoji('cross')} The selected song could not be found.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
                  });
                  this.autoDeleteMessage(errorMessage);
                }
              } catch (error) {
                console.error('Play Error:', error);
                const errorMessage = await interaction.followUp({
                  components: [makeCard(`${getEmoji('cross')} An error occurred while trying to play the song.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
                });
                this.autoDeleteMessage(errorMessage);
              }

              
              this.autoDeleteMessage(sentMessage);
              collector.stop();
            });

            collector.on('end', async collected => {
              if (!collected.size) {
                try {
                  const timeoutRow = new ActionRowBuilder().addComponents(
                    row1.components.map(button =>
                      ButtonBuilder.from(button).setDisabled(true)
                    )
                  );

                  await sentMessage.edit({
                    components: [searchContainer, timeoutRow],
                    flags: MessageFlags.IsComponentsV2
                  });

                  const timeoutMessage = await interaction.followUp({
                    components: [makeCard(`${getEmoji('warning')} You didn\'t select any song in time.`, ACCENT.info)], flags: MessageFlags.IsComponentsV2,
                  });

                  
                  this.autoDeleteMessage(sentMessage);
                  this.autoDeleteMessage(timeoutMessage);
                } catch (error) {
                  console.error('[Distube] Search selection timeout cleanup failed:', error);
                  this.autoDeleteMessage(sentMessage);
                }
              }
            });

          } else if (subcommand === 'url') {
            const queueMessage = await interaction.followUp({
              components: [makeCard(`${getEmoji('music')} Loading song from URL...`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });

            try {
              await distube.play(channel, query, {
                member: interaction.member,
                textChannel: interaction.channel,
              });

              const successMessage = await queueMessage.edit({
                components: [makeCard(`${getEmoji('tick')} Successfully loaded song from URL!`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
              });
              this.autoDeleteMessage(successMessage);
            } catch (error) {
              console.error('URL Play Error:', error);
              if (error.errorCode === 'VOICE_CONNECT_FAILED' || error.message?.includes('VOICE_CONNECT_FAILED')) {
                try {
                  const botMember = channel.guild.members.cache.get(interaction.client.user.id);
                  if (botMember?.voice?.channel) {
                    await botMember.voice.disconnect().catch(() => { });
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                  if (interaction.client.riffy && interaction.client.riffy.players) {
                    const player = interaction.client.riffy.players.get(channel.guild.id);
                    if (player) {
                      await player.destroy().catch(() => { });
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                  }
                  const queue = distube.getQueue(channel.guild.id);
                  if (queue) {
                    await distube.stop(channel.guild.id).catch(() => { });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  await distube.voices.join(channel);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  await distube.play(channel, query, {
                    member: interaction.member,
                    textChannel: interaction.channel,
                  });
                  const successMessage = await queueMessage.edit({
                    components: [makeCard(`${getEmoji('tick')} Successfully loaded song from URL!`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
                  });
                  this.autoDeleteMessage(successMessage);
                } catch (retryError) {
                  console.error('Retry failed:', retryError);
                  const errorMessage = await queueMessage.edit({
                    components: [makeCard(`${getEmoji('cross')} Failed to connect to voice channel. The bot may be connected via another music system. Please try \`/distube stop\` first or restart the bot.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
                  });
                  this.autoDeleteMessage(errorMessage);
                }
              } else {
                const errorMessage = await queueMessage.edit({
                  components: [makeCard(`${getEmoji('cross')} Failed to load song from URL. Please check if the URL is valid.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
                });
                this.autoDeleteMessage(errorMessage);
              }
            }
          }
          break;

        case 'pause':
          if (!queue) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Nothing is currently playing.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          if (queue.paused) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('pause')} The song is already paused.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          distube.pause(interaction.guild.id);
          const pauseMessage = await interaction.followUp({
            components: [makeCard(`${getEmoji('pause')} Paused the current song.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(pauseMessage);
          break;

        case 'resume':
          if (!queue) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Nothing is currently playing.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          if (!queue.paused) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('play')} The song is not paused.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          distube.resume(interaction.guild.id);
          const resumeMessage = await interaction.followUp({
            components: [makeCard(`${getEmoji('play')} Resumed the current song.`, ACCENT.success)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(resumeMessage);
          break;

        case 'skip':
          if (!queue || queue.songs.length === 0) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Nothing is currently playing.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          if (queue.songs.length === 1) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} No more songs in the queue to skip to.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          const skippedSong = queue.songs[0];
          distube.skip(interaction.guild.id);
          const skipMessage = await interaction.followUp({
            components: [makeCard(`${getEmoji('nextsong')} Skipped: **${skippedSong.name}**`, ACCENT.success)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(skipMessage);
          break;

        case 'stop':
          if (!queue) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Nothing is currently playing.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          distube.stop(interaction.guild.id);
          const stopMessage = await interaction.followUp({
            components: [makeCard(`${getEmoji('stop')} Stopped playing and cleared the queue.`, ACCENT.danger)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(stopMessage);
          break;

        case 'loop':
          if (!queue) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Nothing is currently playing.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          const mode = parseInt(interaction.options.getString('mode'));
          distube.setRepeatMode(interaction.guild.id, mode);
          const loopMessage = await interaction.followUp({
            components: [makeCard(`${getEmoji('loop')} Loop mode set to: **${this.getLoopModeText(mode)}**`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(loopMessage);
          break;

        case 'volume':
          if (!queue) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Nothing is currently playing.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          const volume = interaction.options.getInteger('level');
          distube.setVolume(interaction.guild.id, volume);
          const volumeMessage = await interaction.followUp({
            components: [makeCard(`${getEmoji('volume_high')} Volume set to **${volume}%**`, ACCENT.success)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(volumeMessage);
          break;

        case 'shuffle':
          if (!queue || queue.songs.length <= 2) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Need at least 2 songs in queue to shuffle.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          distube.shuffle(interaction.guild.id);
          const shuffleMessage = await interaction.followUp({
            components: [makeCard(`${getEmoji('loop')} Shuffled the queue!`, ACCENT.success)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(shuffleMessage);
          break;

        case 'remove':
          if (!queue || queue.songs.length <= 1) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} No songs in queue to remove.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          const position = interaction.options.getInteger('position');
          if (position === 1) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Cannot remove the currently playing song. Use skip instead.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          if (position > queue.songs.length) {
            const message = await interaction.followUp({
              components: [makeCard(`${getEmoji('cross')} Position ${position} doesn't exist in queue.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
            });
            this.autoDeleteMessage(message);
            return;
          }
          const removedSong = queue.songs[position - 1];
          queue.songs.splice(position - 1, 1);
          const removeMessage = await interaction.followUp({
            components: [makeCard(`${getEmoji('delete')} Removed: **${removedSong.name}** from position ${position}`, ACCENT.success)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(removeMessage);
          break;

        default:
          const message = await interaction.followUp({
            components: [makeCard(`${getEmoji('cross')} Unknown command.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
          });
          this.autoDeleteMessage(message);
          break;
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = await interaction.followUp({
        components: [makeCard(`${getEmoji('cross')} An error occurred while processing your request.`, ACCENT.warning)], flags: MessageFlags.IsComponentsV2,
      });
      this.autoDeleteMessage(errorMessage);
    }
  },

  getLoopModeText(mode) {
    switch (mode) {
      case 0: return 'Off';
      case 1: return 'Song';
      case 2: return 'Queue';
      default: return 'Unknown';
    }
  },
};

module.exports.claimSingleSelection = claimSingleSelection;


