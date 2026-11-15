const mongoose = require('mongoose');

const birthdaySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    birthday: {
        type: Date,
        required: true
    },
    timezone: {
        type: String,
        default: 'UTC',
        required: true
    },
    settings: {
        allowPublicView: {
            type: Boolean,
            default: true
        },
        allowMentions: {
            type: Boolean,
            default: true
        },
        allowDMs: {
            type: Boolean,
            default: false
        },
        celebrationStyle: {
            type: String,
            enum: ['simple', 'party', 'quiet', 'none'],
            default: 'simple'
        }
    },
    notifications: {
        remindMe: {
            type: Boolean,
            default: false
        },
        remindDaysBefore: {
            type: Number,
            min: 1,
            max: 30,
            default: 1
        }
    },
    stats: {
        celebrationsReceived: {
            type: Number,
            default: 0
        },
        lastCelebrated: {
            type: Date,
            default: null
        },
        totalWishes: {
            type: Number,
            default: 0
        }
    },
    wishes: [{
        fromUserId: String,
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        isAnonymous: {
            type: Boolean,
            default: false
        }
    }],
    zodiacSign: {
        type: String,
        enum: ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
               'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'],
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});


birthdaySchema.virtual('age').get(function() {
    if (!this.birthday) return null;
    const today = new Date();
    const birthDate = new Date(this.birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
});


birthdaySchema.virtual('daysUntilBirthday').get(function() {
    if (!this.birthday) return null;
    const today = new Date();
    const currentYear = today.getFullYear();
    let nextBirthday = new Date(this.birthday);
    nextBirthday.setFullYear(currentYear);
    
    if (nextBirthday < today) {
        nextBirthday.setFullYear(currentYear + 1);
    }
    
    const timeDiff = nextBirthday.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
});


birthdaySchema.index({ guildId: 1, birthday: 1 });
birthdaySchema.index({ userId: 1, guildId: 1 });


birthdaySchema.statics.getUpcoming = function(guildId, days = 30) {
    const today = new Date();
    const endDate = new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));
    
    return this.aggregate([
        { $match: { guildId } },
        {
            $addFields: {
                nextBirthday: {
                    $dateFromParts: {
                        year: { $year: today },
                        month: { $month: '$birthday' },
                        day: { $dayOfMonth: '$birthday' }
                    }
                }
            }
        },
        {
            $addFields: {
                adjustedBirthday: {
                    $cond: {
                        if: { $lt: ['$nextBirthday', today] },
                        then: {
                            $dateFromParts: {
                                year: { $add: [{ $year: today }, 1] },
                                month: { $month: '$birthday' },
                                day: { $dayOfMonth: '$birthday' }
                            }
                        },
                        else: '$nextBirthday'
                    }
                }
            }
        },
        {
            $match: {
                adjustedBirthday: { $lte: endDate }
            }
        },
        {
            $sort: { adjustedBirthday: 1 }
        }
    ]);
};

birthdaySchema.statics.getTodaysBirthdays = function(guildId) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    return this.find({
        guildId,
        $expr: {
            $and: [
                { $eq: [{ $month: '$birthday' }, startOfDay.getMonth() + 1] },
                { $eq: [{ $dayOfMonth: '$birthday' }, startOfDay.getDate()] }
            ]
        }
    });
};


birthdaySchema.methods.calculateZodiacSign = function() {
    if (!this.birthday) return null;
    
    const month = this.birthday.getMonth() + 1;
    const day = this.birthday.getDate();
    
    const zodiacSigns = [
        { sign: 'capricorn', start: { month: 12, day: 22 }, end: { month: 1, day: 19 } },
        { sign: 'aquarius', start: { month: 1, day: 20 }, end: { month: 2, day: 18 } },
        { sign: 'pisces', start: { month: 2, day: 19 }, end: { month: 3, day: 20 } },
        { sign: 'aries', start: { month: 3, day: 21 }, end: { month: 4, day: 19 } },
        { sign: 'taurus', start: { month: 4, day: 20 }, end: { month: 5, day: 20 } },
        { sign: 'gemini', start: { month: 5, day: 21 }, end: { month: 6, day: 20 } },
        { sign: 'cancer', start: { month: 6, day: 21 }, end: { month: 7, day: 22 } },
        { sign: 'leo', start: { month: 7, day: 23 }, end: { month: 8, day: 22 } },
        { sign: 'virgo', start: { month: 8, day: 23 }, end: { month: 9, day: 22 } },
        { sign: 'libra', start: { month: 9, day: 23 }, end: { month: 10, day: 22 } },
        { sign: 'scorpio', start: { month: 10, day: 23 }, end: { month: 11, day: 21 } },
        { sign: 'sagittarius', start: { month: 11, day: 22 }, end: { month: 12, day: 21 } }
    ];
    
    for (const zodiac of zodiacSigns) {
        if (zodiac.sign === 'capricorn') {
            if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
                return zodiac.sign;
            }
        } else {
            if ((month === zodiac.start.month && day >= zodiac.start.day) ||
                (month === zodiac.end.month && day <= zodiac.end.day)) {
                return zodiac.sign;
            }
        }
    }
    
    return null;
};

module.exports = mongoose.model('Birthday', birthdaySchema);