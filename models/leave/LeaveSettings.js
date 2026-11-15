const mongoose = require('mongoose');


const fieldOptions = [
    'username',
    'userid', 
    'leavedate',
    'accountcreated',
    'membercount',
    'servername',
    'joindate',
    'timeinguild',
    'none'
];

const thumbnailImageOptions = [
    'userimage',
    'serverimage',
    'none'
];

const leaveSettingsSchema = new mongoose.Schema({
    serverId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    
    
    leaveChannelId: { type: String },
    channelStatus: { type: Boolean, default: false },
    
    
    dmStatus: { type: Boolean, default: false },
    
    
    channelEmbed: {
        title: { type: String, default: 'Goodbye!' },
        description: { type: String, default: '{member} has left our server. We now have **{membercount}** members.' },
        color: { type: String, default: '#ff4757' },
        author: {
            name: { type: String, default: '' },
            iconURL: { type: String, default: '' },
            url: { type: String, default: '' }
        },
        footer: {
            text: { type: String, default: "We'll miss you!" },
            iconURL: { type: String, default: '' }
        },
        thumbnail: { 
            type: { type: String, enum: thumbnailImageOptions, default: 'userimage' }
        },
        image: {
            useWcard: { type: Boolean, default: false },
            customURL: { type: String, default: '' }
        },
        fields: [{
            name: { type: String, default: 'Username' },
            value: { type: String, enum: fieldOptions, default: 'username' },
            inline: { type: Boolean, default: true }
        }, {
            name: { type: String, default: 'Time in Guild' },
            value: { type: String, enum: fieldOptions, default: 'timeinguild' },
            inline: { type: Boolean, default: true }
        }, {
            name: { type: String, default: 'Leave Date' },
            value: { type: String, enum: fieldOptions, default: 'leavedate' },
            inline: { type: Boolean, default: true }
        }]
    },
    
    
    dmEmbed: {
        title: { type: String, default: 'Thanks for being part of our community!' },
        description: { type: String, default: 'Goodbye {username}! Thanks for being part of {servername}. You\'re always welcome back!' },
        color: { type: String, default: '#ff4757' },
        footer: {
            text: { type: String, default: 'Hope to see you again!' },
            iconURL: { type: String, default: '' }
        },
        thumbnail: { 
            type: { type: String, enum: thumbnailImageOptions, default: 'serverimage' }
        },
        image: {
            useWcard: { type: Boolean, default: false },
            customURL: { type: String, default: '' }
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('LeaveSettings', leaveSettingsSchema);