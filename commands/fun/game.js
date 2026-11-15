

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, sendV2, deferReply, ACCENT } = require('../../UI');
const {
  Snake, TwoZeroFourEight, Connect4, FastType, FindEmoji, Flood,
  Hangman, MatchPairs, Minesweeper, TicTacToe, Wordle, Trivia
} = require('discord-gamecord');


const activeGames = new Map();
const activeCollectors = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('Play games with your friends')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start a new game'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('challenge')
        .setDescription('Challenge someone to a multiplayer game')
        .addUserOption(option =>
          option
            .setName('opponent')
            .setDescription('The player you want to challenge')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('game')
            .setDescription('The game to play')
            .setRequired(true)
            .addChoices(
              { name: 'Connect4', value: 'connect4' },
              { name: 'TicTacToe', value: 'tictactoe' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close and end your active game or challenge')),

  async execute(interaction, args, client) {
    const isSlash = Boolean(interaction.isChatInputCommand?.());

    let subcommand = 'start';
    if (isSlash) {
      subcommand = interaction.options.getSubcommand();
    } else {
      const rawSub = args?.[0]?.toLowerCase();
      if (rawSub === 'challenge') {
        subcommand = 'challenge';
      } else if (rawSub === 'close' || rawSub === 'end' || rawSub === 'stop' || rawSub === 'cancel') {
        subcommand = 'close';
      }
    }

    
    if (subcommand === 'close') {
      return await handleCloseGame(interaction);
    }

    
    const existingUserGame = activeGames.get(interaction.user.id);
    if (existingUserGame) {
      if (isSlash) {
        return interaction.reply({
          content: lang.fun.game.alreadyInGame,
          flags: MessageFlags.Ephemeral
        });
      } else {
        return interaction.reply({ content: lang.fun.game.alreadyInGame });
      }
    }

    if (subcommand === 'challenge') {
      await handleChallenge(interaction, args, client);
    } else {
      await handleSinglePlayerMenu(interaction);
    }
  }
};

async function handleSinglePlayerMenu(interaction) {
  
  const existingCollector = activeCollectors.get(interaction.user.id);
  if (existingCollector) {
    try { existingCollector.stop('new_menu'); } catch (_) { }
    activeCollectors.delete(interaction.user.id);
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('game_select')
      .setPlaceholder(lang.fun.game.selectPlaceholder)
      .addOptions([
        { label: 'Snake', value: 'snake', description: 'Classic snake game', emoji: getButtonEmoji('games') },
        { label: '2048', value: '2048', description: 'Merge tiles to reach 2048', emoji: getButtonEmoji('games') },
        { label: 'FastType', value: 'fasttype', description: 'Test your typing speed', emoji: '⌨️' },
        { label: 'Find Emoji', value: 'findemoji', description: 'Find the different emoji', emoji: getButtonEmoji('games') },
        { label: 'Flood', value: 'flood', description: 'Fill the board with one color', emoji: getButtonEmoji('games') },
        { label: 'Hangman', value: 'hangman', description: 'Guess the word', emoji: getButtonEmoji('games') },
        { label: 'Match Pairs', value: 'matchpairs', description: 'Find matching pairs', emoji: getButtonEmoji('games') },
        { label: 'Minesweeper', value: 'minesweeper', description: 'Avoid the mines', emoji: getButtonEmoji('games') },
        { label: 'Wordle', value: 'wordle', description: 'Guess the 5-letter word', emoji: getButtonEmoji('games') },
        { label: 'Trivia', value: 'trivia', description: 'Test your knowledge', emoji: getButtonEmoji('games') }
      ])
  );

  const multiplayerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('multiplayer_games')
      .setLabel(lang.fun.game.multiplayerButton)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(getButtonEmoji('users'))
  );

  const card = buildCard({
    title: lang.fun.game.centerTitle,
    description: lang.fun.game.centerDescription,
    accentColor: ACCENT.primary
  });

  if (!interaction.deferred && !interaction.replied) {
    await deferReply(interaction);
  }

  await interaction.editReply({
    components: [card, row, multiplayerRow],
    flags: MessageFlags.IsComponentsV2
  });

  const message = await interaction.fetchReply();

  
  const filter = i => (i.customId === 'game_select' || i.customId === 'multiplayer_games') && i.user.id === interaction.user.id;
  const collector = message.createMessageComponentCollector({ filter, time: 60000 });

  
  activeCollectors.set(interaction.user.id, collector);

  collector.on('collect', async i => {
    if (i.customId === 'multiplayer_games') {
      collector.stop('multiplayer_menu');
      activeCollectors.delete(interaction.user.id);
      await handleMultiplayerMenu(i);
      return;
    }

    const game = i.values[0];
    collector.stop('single_game_selected');
    activeCollectors.delete(interaction.user.id);

    
    const gameRecord = {
      gameType: game,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      messageId: message.id,
      message: message,
      interaction: i,
      startedAt: Date.now()
    };
    activeGames.set(interaction.user.id, gameRecord);

    await startGame(game, i, interaction.user, gameRecord);
  });

  collector.on('end', (collected, reason) => {
    activeCollectors.delete(interaction.user.id);

    if (reason === 'time' && collected.size === 0) {
      interaction.editReply({
        components: [cards.expired()],
        flags: MessageFlags.IsComponentsV2
      }).catch(console.error);
      setTimeout(() => {
        interaction.deleteReply?.().catch(() => { });
      }, 3000);
    }
  });
}

async function handleMultiplayerMenu(interaction) {
  
  const existingCollector = activeCollectors.get(interaction.user.id);
  if (existingCollector) {
    try { existingCollector.stop('multiplayer_switch'); } catch (_) { }
    activeCollectors.delete(interaction.user.id);
  }

  const multiplayerRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('multiplayer_select')
      .setPlaceholder(lang.fun.game.selectPlaceholder)
      .addOptions([
        { label: 'Connect4', value: 'connect4', description: 'Connect 4 pieces in a row', emoji: getButtonEmoji('games') },
        { label: 'TicTacToe', value: 'tictactoe', description: 'Classic X and O game', emoji: '⭕' }
      ])
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('back_to_games')
      .setLabel(lang.fun.game.backButton)
      .setStyle(ButtonStyle.Secondary)
  );

  const card = buildCard({
    title: lang.fun.game.multiplayerTitle,
    description: lang.fun.game.multiplayerDescription,
    accentColor: ACCENT.primary
  });

  await interaction.deferUpdate();

  await interaction.editReply({
    components: [card, multiplayerRow, backRow],
    flags: MessageFlags.IsComponentsV2
  });

  const message = interaction.message || await interaction.fetchReply();

  const filter = i => (i.customId === 'multiplayer_select' || i.customId === 'opponent_select' || i.customId === 'back_to_games') && i.user.id === interaction.user.id;
  const collector = message.createMessageComponentCollector({ filter, time: 60000 });

  activeCollectors.set(interaction.user.id, collector);

  let selectedGame = 'connect4';

  collector.on('collect', async i => {
    if (i.customId === 'back_to_games') {
      await i.deferUpdate();
      collector.stop('back');
      activeCollectors.delete(interaction.user.id);
      await handleSinglePlayerMenu(i);
      return;
    }

    if (i.customId === 'multiplayer_select') {
      selectedGame = i.values[0];

      
      const opponentRow = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId('opponent_select')
          .setPlaceholder(lang.fun.game.chooseOpponentTitle)
          .setMinValues(1)
          .setMaxValues(1)
      );

      const oppDesc = lang.fun.game.chooseOpponentDescription
        .replace('{game}', gameDisplayNames[selectedGame] || selectedGame);

      const oppCard = buildCard({
        title: lang.fun.game.chooseOpponentTitle,
        description: oppDesc,
        accentColor: ACCENT.primary
      });

      await i.update({
        components: [oppCard, opponentRow, backRow],
        flags: MessageFlags.IsComponentsV2
      });
      return;
    }

    if (i.customId === 'opponent_select') {
      try {
        await i.deferUpdate();
      } catch (error) {
        if (error.code !== 10062) console.error('Could not acknowledge opponent selection:', error);
        return;
      }

      try {
        const opponentId = i.values[0];
        const opponent = i.users?.get(opponentId) ||
          await interaction.client.users.fetch(opponentId).catch(() => null);

        if (!opponent) {
          return i.followUp({
            content: 'Could not resolve the selected user. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }

        
        if (opponent.id === interaction.user.id) {
          return i.followUp({
            content: lang.fun.game.cannotChallengeSelf,
            flags: MessageFlags.Ephemeral
          });
        }

        
        if (opponent.bot) {
          return i.followUp({
            content: lang.fun.game.cannotChallengeBot,
            flags: MessageFlags.Ephemeral
          });
        }

        
        if (activeGames.get(opponent.id)) {
          const oppInGameMsg = lang.fun.game.opponentAlreadyInGame
            .replace('{opponent}', opponent.username);
          return i.followUp({
            content: oppInGameMsg,
            flags: MessageFlags.Ephemeral
          });
        }

        collector.stop('opponent_selected');
        activeCollectors.delete(interaction.user.id);

        await createChallenge(i, interaction.user, opponent, selectedGame);
      } catch (error) {
        console.error('Failed to process opponent selection:', error);
        await i.followUp({
          content: lang.fun.game.startError,
          flags: MessageFlags.Ephemeral
        }).catch(() => { });
      }
    }
  });

  collector.on('end', (collected, reason) => {
    activeCollectors.delete(interaction.user.id);

    if (reason === 'time' && collected.size === 0) {
      interaction.editReply({
        components: [cards.expired()],
        flags: MessageFlags.IsComponentsV2
      }).catch(console.error);
      setTimeout(() => {
        interaction.deleteReply?.().catch(() => { });
      }, 3000);
    }
  });
}

async function handleChallenge(interaction, args, client) {
  const isSlash = Boolean(interaction.isChatInputCommand?.());
  let game;
  let opponent;

  if (isSlash) {
    game = interaction.options.getString('game');
    opponent = interaction.options.getUser('opponent');
  } else {
    const rawOpponent = args?.[1];
    const rawGame = args?.[2]?.toLowerCase() || 'tictactoe';
    game = ['connect4', 'tictactoe'].includes(rawGame) ? rawGame : 'tictactoe';

    if (rawOpponent) {
      const match = rawOpponent.match(/^<@!?(\d+)>$/);
      const id = match ? match[1] : (/^\d+$/.test(rawOpponent) ? rawOpponent : null);
      if (id) {
        opponent = client.users.cache.get(id) || await client.users.fetch(id).catch(() => null);
      }
    }
  }

  if (!opponent) {
    return interaction.reply({
      content: lang.fun.game.chooseOpponentTitle,
      flags: MessageFlags.Ephemeral
    });
  }

  
  if (opponent.id === interaction.user.id) {
    return interaction.reply({
      content: lang.fun.game.cannotChallengeSelf,
      flags: MessageFlags.Ephemeral
    });
  }

  
  if (opponent.bot) {
    return interaction.reply({
      content: lang.fun.game.cannotChallengeBot,
      flags: MessageFlags.Ephemeral
    });
  }

  
  if (activeGames.get(opponent.id)) {
    const oppInGameMsg = lang.fun.game.opponentAlreadyInGame
      .replace('{opponent}', opponent.username);
    return interaction.reply({
      content: oppInGameMsg,
      flags: MessageFlags.Ephemeral
    });
  }

  await createChallenge(interaction, interaction.user, opponent, game);
}

async function createChallenge(interaction, challenger, opponent, game) {
  const acceptRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('accept_challenge')
      .setLabel(lang.fun.game.acceptButton)
      .setStyle(ButtonStyle.Success)
      .setEmoji(getButtonEmoji('tick')),
    new ButtonBuilder()
      .setCustomId('decline_challenge')
      .setLabel(lang.fun.game.declineButton)
      .setStyle(ButtonStyle.Danger)
      .setEmoji(getButtonEmoji('cross'))
  );

  const challengePrompt = lang.fun.game.challengePrompt
    .replace('{opponent}', opponent.toString())
    .replace('{game}', gameDisplayNames[game] || game)
    .replace('{challenger}', challenger.username);

  const challengeCard = buildCard({
    title: lang.fun.game.challengeTitle,
    description: challengePrompt,
    accentColor: ACCENT.warning
  });

  let response;
  if (interaction.deferred || interaction.replied) {
    if (interaction.replied) {
      response = await interaction.followUp({
        components: [challengeCard, acceptRow],
        flags: MessageFlags.IsComponentsV2
      });
    } else {
      await interaction.editReply({
        components: [challengeCard, acceptRow],
        flags: MessageFlags.IsComponentsV2
      });
      response = await interaction.fetchReply();
    }
  } else {
    response = await interaction.reply({
      components: [challengeCard, acceptRow],
      flags: MessageFlags.IsComponentsV2,
      fetchReply: true
    });
  }

  
  const challengeRecord = {
    gameType: game,
    status: 'waiting',
    userId: challenger.id,
    opponentId: opponent.id,
    channelId: interaction.channelId,
    messageId: response.id,
    message: response,
    startedAt: Date.now()
  };
  activeGames.set(challenger.id, challengeRecord);

  const filter = i =>
    (i.customId === 'accept_challenge' || i.customId === 'decline_challenge');

  const collector = response.createMessageComponentCollector({ filter, time: 60000 });
  challengeRecord.collector = collector;

  collector.on('collect', async i => {
    
    if (i.user.id !== opponent.id) {
      return i.reply({
        content: `Only ${opponent.username} can accept or decline this challenge!`,
        flags: MessageFlags.Ephemeral
      });
    }

    collector.stop(i.customId);

    if (i.customId === 'accept_challenge') {
      await i.deferUpdate();

      
      const multiRecord = {
        gameType: game,
        status: 'playing',
        userId: challenger.id,
        opponentId: opponent.id,
        channelId: interaction.channelId,
        messageId: response.id,
        message: response,
        startedAt: Date.now()
      };
      activeGames.set(opponent.id, multiRecord);
      activeGames.set(challenger.id, multiRecord);

      const acceptCard = buildCard({
        title: lang.fun.game.challengeAccepted,
        accentColor: ACCENT.success
      });

      await i.editReply({
        components: [acceptCard],
        flags: MessageFlags.IsComponentsV2
      });

      
      await startMultiplayerGame(game, interaction, challenger, opponent, multiRecord);
    } else {
      
      await i.deferUpdate();
      activeGames.delete(challenger.id);
      activeGames.delete(opponent.id);

      const declineCard = buildCard({
        title: lang.fun.game.challengeDeclined,
        accentColor: ACCENT.danger
      });

      await i.editReply({
        components: [declineCard],
        flags: MessageFlags.IsComponentsV2
      });
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      activeGames.delete(challenger.id);
      activeGames.delete(opponent.id);

      try {
        if (interaction.replied || interaction.deferred) {
          const timeoutCard = buildCard({
            title: lang.fun.game.challengeTimeout,
            accentColor: ACCENT.warning
          });

          interaction.editReply({
            components: [timeoutCard],
            flags: MessageFlags.IsComponentsV2
          }).catch(console.error);
          setTimeout(() => {
            interaction.deleteReply?.().catch(() => { });
          }, 3000);
        }
      } catch (error) {
        console.error('Error updating expired challenge:', error);
      }
    }
  });
}

async function startGame(game, interaction, player, gameRecord) {
  const GameClass = getGameClass(game);
  const gameConfig = getGameConfig(game, player);

  try {
    await interaction.deferUpdate().catch(console.error);

    const gameInstance = new GameClass({
      message: interaction,
      isSlashGame: true,
      ...gameConfig
    });

    if (gameRecord) {
      gameRecord.gameInstance = gameInstance;
      gameRecord.interaction = interaction;
    }

    gameInstance.startGame();
    gameInstance.on('gameOver', result => {
      console.log(`Game over for ${player.username}: ${JSON.stringify(result)}`);
      setTimeout(() => {
        activeGames.delete(player.id);
      }, 2000);
    });
  } catch (error) {
    console.error('Error starting game:', error);
    try {
      interaction.followUp({
        content: lang.fun.game.startError,
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    } catch (followUpError) {
      console.error('Error sending follow-up:', followUpError);
    }

    activeGames.delete(player.id);
  }
}

async function startMultiplayerGame(game, interaction, challenger, opponent, multiRecord) {
  const GameClass = getGameClass(game);
  const gameConfig = getMultiplayerGameConfig(game, challenger, opponent);

  try {
    const startingText = lang.fun.game.startingMultiplayer
      .replace('{game}', gameDisplayNames[game] || game)
      .replace('{challenger}', challenger.username)
      .replace('{opponent}', opponent.username);

    const gameMessage = await interaction.followUp({
      content: startingText,
      fetchReply: true
    });

    
    const messageProxy = new Proxy(gameMessage, {
      get(target, prop) {
        if (prop === 'author') return challenger;
        if (prop === 'user') return challenger;
        const val = target[prop];
        if (typeof val === 'function') return val.bind(target);
        return val;
      }
    });

    const gameInstance = new GameClass({
      message: messageProxy,
      opponent: opponent,
      isSlashGame: false,
      ...gameConfig
    });

    if (multiRecord) {
      multiRecord.gameInstance = gameInstance;
      multiRecord.gameMessage = gameMessage;
    }

    
    if (game === 'connect4') {
      await gameInstance.connect4Game(messageProxy);
    } else if (game === 'tictactoe') {
      await gameInstance.TicTacToeGame(messageProxy);
    } else {
      gameInstance.startGame();
    }

    gameInstance.on('gameOver', result => {
      console.log(`Game over for ${challenger.username} vs ${opponent.username}: ${JSON.stringify(result)}`);
      setTimeout(() => {
        activeGames.delete(challenger.id);
        activeGames.delete(opponent.id);
      }, 2000);
    });
  } catch (error) {
    console.error('Error starting multiplayer game:', error);

    try {
      await interaction.followUp({
        content: lang.fun.game.startError,
        flags: MessageFlags.Ephemeral
      });
    } catch (followUpError) {
      console.error('Error sending follow-up:', followUpError);
    }

    activeGames.delete(challenger.id);
    activeGames.delete(opponent.id);
  }
}

async function handleCloseGame(interaction) {
  const isSlash = Boolean(interaction.isChatInputCommand?.());
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  let targetRecord = activeGames.get(userId);
  let isModClose = false;

  
  if (!targetRecord) {
    for (const [id, record] of activeGames.entries()) {
      if (record?.opponentId === userId) {
        targetRecord = record;
        break;
      }
    }
  }

  
  if (!targetRecord) {
    const hasModPerms = interaction.memberPermissions?.has('ManageMessages') ||
      interaction.memberPermissions?.has('Administrator');
    if (hasModPerms) {
      for (const [id, record] of activeGames.entries()) {
        if (record?.channelId === channelId) {
          targetRecord = record;
          isModClose = true;
          break;
        }
      }
    }
  }

  const userCollector = activeCollectors.get(userId);

  if (!targetRecord && !userCollector) {
    const noGameCard = buildCard({
      title: 'No Active Game',
      description: lang.fun.game.noActiveGame,
      accentColor: ACCENT.warning
    });

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        components: [noGameCard],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [noGameCard],
      flags: isSlash ? (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) : MessageFlags.IsComponentsV2
    });
  }

  
  if (userCollector) {
    try {
      userCollector.stop('closed');
    } catch (_) { }
    activeCollectors.delete(userId);
  }

  if (targetRecord) {
    const u1 = targetRecord.userId;
    const u2 = targetRecord.opponentId;
    if (u1) {
      activeGames.delete(u1);
      activeCollectors.delete(u1);
    }
    if (u2) {
      activeGames.delete(u2);
      activeCollectors.delete(u2);
    }
    activeGames.delete(userId);

    if (targetRecord.collector) {
      try {
        targetRecord.collector.stop('closed');
      } catch (_) { }
    }

    if (targetRecord.gameInstance) {
      try {
        const targetMsg = targetRecord.gameMessage || targetRecord.message;
        if (typeof targetRecord.gameInstance.gameOver === 'function' && targetMsg) {
          targetRecord.gameInstance.gameOver(targetMsg).catch?.(() => { });
        }
      } catch (_) { }
    }

    
    try {
      if (targetRecord.gameMessage && typeof targetRecord.gameMessage.edit === 'function') {
        await targetRecord.gameMessage.edit({
          content: '**Game Ended**: This game was closed.',
          components: []
        }).catch(() => { });
      } else if (targetRecord.message && typeof targetRecord.message.edit === 'function') {
        await targetRecord.message.edit({
          content: '**Game Ended**: This game was closed.',
          components: []
        }).catch(() => { });
      }
    } catch (_) { }
  }

  const closeCard = buildCard({
    title: lang.fun.game.closeTitle,
    description: isModClose
      ? (lang.fun.game.channelGameClosed)
      : lang.fun.game.closeDescription,
    accentColor: ACCENT.danger
  });

  if (interaction.replied || interaction.deferred) {
    return interaction.followUp({
      components: [closeCard],
      flags: MessageFlags.IsComponentsV2
    });
  }
  return interaction.reply({
    components: [closeCard],
    flags: MessageFlags.IsComponentsV2
  });
}

function getGameClass(game) {
  const games = {
    snake: Snake,
    '2048': TwoZeroFourEight,
    connect4: Connect4,
    fasttype: FastType,
    findemoji: FindEmoji,
    flood: Flood,
    hangman: Hangman,
    matchpairs: MatchPairs,
    minesweeper: Minesweeper,
    tictactoe: TicTacToe,
    wordle: Wordle,
    trivia: Trivia
  };

  return games[game];
}

const gameDisplayNames = {
  snake: 'Snake',
  '2048': '2048',
  connect4: 'Connect 4',
  fasttype: 'Fast Type',
  findemoji: 'Find Emoji',
  flood: 'Flood',
  hangman: 'Hangman',
  matchpairs: 'Match Pairs',
  minesweeper: 'Minesweeper',
  tictactoe: 'Tic Tac Toe',
  wordle: 'Wordle',
  trivia: 'Trivia'
};

function getGameConfig(game, player) {
  const baseConfig = {
    embed: {
      title: `${gameDisplayNames[game]}`,
      color: '#5865F2'
    },
    timeoutTime: 60000,
    buttonStyle: 'PRIMARY',
    playerOnlyMessage: `Only ${player.username} can use these buttons.`
  };

  const gameSpecificConfigs = {
    trivia: {
      embed: {
        ...baseConfig.embed,
        description: 'You have 60 seconds to guess the answer.'
      },
      trueButtonStyle: 'SUCCESS',
      falseButtonStyle: 'DANGER',
      mode: 'multiple',
      difficulty: 'medium',
      winMessage: 'You won! The correct answer is {answer}.',
      loseMessage: 'You lost! The correct answer is {answer}.',
      errMessage: 'Unable to fetch question data! Please try again.'
    }
  };

  return { ...baseConfig, ...(gameSpecificConfigs[game] || {}) };
}

function getMultiplayerGameConfig(game, challenger, opponent) {
  const baseConfig = {
    embed: {
      title: `${gameDisplayNames[game]} - ${challenger.username} vs ${opponent.username}`,
      statusTitle: 'Status',
      overTitle: 'Game Over',
      color: '#5865F2'
    },
    timeoutTime: 120000,
    buttonStyle: 'PRIMARY',
    playerOnlyMessage: `Only ${challenger.username} and ${opponent.username} can use these buttons.`
  };

  const gameSpecificConfigs = {
    connect4: {
      opponent: opponent,
      emojis: {
        board: '·',
        player1: 'X',
        player2: 'O'
      },
      turnMessage: '{emoji} | It\'s {player}\'s turn!',
      winMessage: '{emoji} | **{player}** won the Connect 4 Game!',
      tieMessage: 'The Game tied! No one won the Game!',
      timeoutMessage: 'The Game went unfinished! No one won the Game!'
    },
    tictactoe: {
      opponent: opponent,
      emojis: {
        xButton: 'X',
        oButton: '⭕',
        blankButton: '-'
      },
      xButtonStyle: 'DANGER',
      oButtonStyle: 'PRIMARY',
      turnMessage: '{emoji} | It\'s {player}\'s turn!',
      winMessage: '{emoji} | **{player}** won the Tic Tac Toe Game!',
      tieMessage: 'The Game tied! No one won the Game!',
      timeoutMessage: 'The Game went unfinished! No one won the Game!'
    }
  };

  return { ...baseConfig, ...(gameSpecificConfigs[game] || {}) };
}
