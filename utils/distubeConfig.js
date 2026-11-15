const ffmpegPath = require('ffmpeg-static');

module.exports = {
    distubeOptions: {
        emitAddListWhenCreatingQueue: true,
        emitAddSongWhenCreatingQueue: false,
        emitNewSongOnly: true,
        joinNewVoiceChannel: true,
        nsfw: true,
        savePreviousSongs: true,
        
        
        ffmpeg: {
            path: ffmpegPath,
        },
    }
};
