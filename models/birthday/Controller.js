
const Birthday = require('./Schema');
const moment = require('moment-timezone');

class BirthdayController {

    async setBirthday(userId, guildId, birthdayString, timezone = 'UTC', options = {}) {
        try {
            
            const birthday = this.parseBirthdayString(birthdayString);
            if (!birthday) {
                throw new Error('Invalid birthday format. Please use MM-DD-YYYY, MM-DD, or DD/MM/YYYY format.');
            }

            const birthdayData = {
                userId,
                guildId,
                birthday: birthday.toDate(),
                timezone,
                ...options
            };

            
            const tempBirthday = new Birthday(birthdayData);
            birthdayData.zodiacSign = tempBirthday.calculateZodiacSign();

            const result = await Birthday.findOneAndUpdate(
                { userId, guildId },
                birthdayData,
                { upsert: true, returnDocument: 'after' }
            );

            return {
                success: true,
                birthday: result,
                message: `Birthday set successfully! 🎉`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getBirthday(userId, guildId) {
        try {
            const birthday = await Birthday.findOne({ userId, guildId });
            
            if (!birthday) {
                return {
                    success: false,
                    error: 'No birthday found for this user.'
                };
            }

            return {
                success: true,
                birthday,
                age: birthday.age,
                daysUntil: birthday.daysUntilBirthday,
                zodiacSign: birthday.zodiacSign
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async removeBirthday(userId, guildId) {
        try {
            const result = await Birthday.findOneAndDelete({ userId, guildId });
            
            if (!result) {
                return {
                    success: false,
                    error: 'No birthday found to remove.'
                };
            }

            return {
                success: true,
                message: 'Birthday removed successfully.'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getUpcomingBirthdays(guildId, days = 30) {
        try {
            const upcomingBirthdays = await Birthday.getUpcoming(guildId, days);
            
            return {
                success: true,
                birthdays: upcomingBirthdays,
                count: upcomingBirthdays.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getTodaysBirthdays(guildId) {
        try {
            const todaysBirthdays = await Birthday.getTodaysBirthdays(guildId);
            
            return {
                success: true,
                birthdays: todaysBirthdays,
                count: todaysBirthdays.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async addWish(userId, guildId, fromUserId, message, isAnonymous = false) {
        try {
            const birthday = await Birthday.findOne({ userId, guildId });
            
            if (!birthday) {
                return {
                    success: false,
                    error: 'User not found or birthday not set.'
                };
            }

            const wish = {
                fromUserId: isAnonymous ? null : fromUserId,
                message,
                timestamp: new Date(),
                isAnonymous
            };

            birthday.wishes.push(wish);
            birthday.stats.totalWishes += 1;
            
            await birthday.save();

            return {
                success: true,
                message: 'Birthday wish added successfully! 🎁',
                wishId: birthday.wishes[birthday.wishes.length - 1]._id
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateSettings(userId, guildId, settings) {
        try {
            const birthday = await Birthday.findOneAndUpdate(
                { userId, guildId },
                { $set: { settings: { ...settings } } },
                { returnDocument: 'after' }
            );

            if (!birthday) {
                return {
                    success: false,
                    error: 'Birthday not found.'
                };
            }

            return {
                success: true,
                birthday,
                message: 'Settings updated successfully!'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getGuildStats(guildId) {
        try {
            const stats = await Birthday.aggregate([
                { $match: { guildId } },
                {
                    $group: {
                        _id: null,
                        totalBirthdays: { $sum: 1 },
                        totalWishes: { $sum: '$stats.totalWishes' },
                        totalCelebrations: { $sum: '$stats.celebrationsReceived' },
                        zodiacCounts: {
                            $push: '$zodiacSign'
                        }
                    }
                },
                {
                    $project: {
                        totalBirthdays: 1,
                        totalWishes: 1,
                        totalCelebrations: 1,
                        mostCommonZodiac: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $slice: [
                                                {
                                                    $sortByCount: {
                                                        $filter: {
                                                            input: '$zodiacCounts',
                                                            as: 'zodiac',
                                                            cond: { $ne: ['$$zodiac', null] }
                                                        }
                                                    }
                                                },
                                                1
                                            ]
                                        },
                                        as: 'item',
                                        in: '$$item._id'
                                    }
                                },
                                0
                            ]
                        }
                    }
                }
            ]);

            const thisMonth = await Birthday.countDocuments({
                guildId,
                $expr: {
                    $eq: [{ $month: '$birthday' }, new Date().getMonth() + 1]
                }
            });

            return {
                success: true,
                stats: {
                    ...stats[0],
                    birthdaysThisMonth: thisMonth
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    parseBirthdayString(birthdayString) {
        const formats = [
            'MM-DD-YYYY',
            'MM/DD/YYYY',
            'DD-MM-YYYY',
            'DD/MM/YYYY',
            'YYYY-MM-DD',
            'MM-DD',
            'MM/DD',
            'DD-MM',
            'DD/MM'
        ];

        for (const format of formats) {
            const parsed = moment(birthdayString, format, true);
            if (parsed.isValid()) {
                
                if (format.length <= 5) {
                    parsed.year(2000); 
                }
                return parsed;
            }
        }

        return null;
    }

    async getBirthdayLeaderboard(guildId, limit = 10) {
        try {
            const leaderboard = await Birthday.find({ guildId })
                .sort({ 'stats.totalWishes': -1 })
                .limit(limit)
                .select('userId stats birthday zodiacSign');

            return {
                success: true,
                leaderboard
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getBirthdaysByZodiac(guildId, zodiacSign) {
        try {
            const birthdays = await Birthday.find({ 
                guildId, 
                zodiacSign: zodiacSign.toLowerCase() 
            });

            return {
                success: true,
                birthdays,
                count: birthdays.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async celebrateBirthday(userId, guildId) {
        try {
            const birthday = await Birthday.findOneAndUpdate(
                { userId, guildId },
                {
                    $inc: { 'stats.celebrationsReceived': 1 },
                    $set: { 'stats.lastCelebrated': new Date() }
                },
                { returnDocument: 'after' }
            );

            if (!birthday) {
                return {
                    success: false,
                    error: 'Birthday not found.'
                };
            }

            return {
                success: true,
                birthday,
                message: 'Birthday celebration recorded! 🎉'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new BirthdayController();