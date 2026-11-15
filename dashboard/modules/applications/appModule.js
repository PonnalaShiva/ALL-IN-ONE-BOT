const Application = require('../../../models/applications/applications');
const { LIMITS, sanitizeQuestion } = require('../../../models/applications/controller');
const colors = require('../../../UI/colors/colors');
const { sendMainApplicationEmbed } = require('./activation');
const { invalidateApplication, invalidateGuildApplications } = require('../../../utils/cacheHelpers');
const client = require('../../../main');

async function trySendApplicationEmbed(serverId, appName) {
    try {
        const guild = await client.guilds.fetch(serverId);
        const application = await Application.findOne({ guildId: serverId, appName });

        if (!guild || !application || !application.mainChannel) {
            console.warn(`🛑 Skipped embed sending for ${appName}: missing guild or main channel`);
            return;
        }

        await sendMainApplicationEmbed(guild, appName, application.mainChannel);
        console.log(`📩 Resent embed for application "${appName}" in ${serverId}`);
    } catch (err) {
        console.error(`❌ Failed to resend application embed:`, err);
    }
}


function emitApplicationUpdate(serverId, app, socket) {
    socket.emit('bot_data_update', {
        type: 'application_config',
        payload: {
            guildId: serverId,
            appName: app.appName,
            questions: app.questions || [],
            isActive: app.isActive,
            mainChannel: app.mainChannel || null,
            responseChannel: app.responseChannel || null,
            _id: app._id
        }
    });
}


async function createApplication(serverId, appName, mainChannel, responseChannel, socket) {
    try {
        
        const sanitizedName = (appName || '').substring(0, 30).trim();

        if (!sanitizedName) {
            throw new Error('Application name is required');
        }

        let app = await Application.findOne({ guildId: serverId, appName: sanitizedName });

        if (app) {
            throw new Error(`Application "${sanitizedName}" already exists.`);
        }

        app = new Application({
            guildId: serverId,
            appName: sanitizedName,
            questions: [],
            isActive: false,
            mainChannel: mainChannel || null,
            responseChannel: responseChannel || null
        });

        await app.save();
        invalidateApplication(serverId, sanitizedName);
        invalidateGuildApplications(serverId);

        emitApplicationUpdate(serverId, app, socket);

        console.log(`${colors.green}✅ Created application: ${sanitizedName} for server ${serverId}${colors.reset}`);

        return app;
    } catch (error) {
        console.error(`${colors.red}❌ Error creating application:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'create_application'
            }
        });

        throw error;
    }
}


async function updateApplicationChannels(serverId, appName, mainChannel, responseChannel, socket) {
    try {
        const app = await Application.findOneAndUpdate(
            { guildId: serverId, appName },
            {
                ...(mainChannel && { mainChannel }),
                ...(responseChannel && { responseChannel })
            },
            { returnDocument: 'after' }
        );

        if (!app) {
            throw new Error(`Application "${appName}" not found.`);
        }

        emitApplicationUpdate(serverId, app, socket);
        await trySendApplicationEmbed(serverId, appName);
        invalidateApplication(serverId, appName);
        invalidateGuildApplications(serverId);
        console.log(`${colors.cyan}🔄 Updated channels for ${appName}${colors.reset}`);

        return app;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating application channels:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'update_application_channels'
            }
        });

        throw error;
    }
}


async function activateApplication(serverId, appName, socket) {
    try {
        const existingApp = await Application.findOne({ guildId: serverId, appName });

        if (!existingApp) {
            throw new Error(`Application "${appName}" not found.`);
        }

        
        if (!existingApp.questions || existingApp.questions.length < 1) {
            throw new Error('Application must have at least 1 question before activation (Discord modal limit: min 1, max 5)');
        }

        
        if (existingApp.questions.length > LIMITS.MAX_QUESTIONS) {
            throw new Error(`Application has too many questions. Discord modals support max ${LIMITS.MAX_QUESTIONS} questions.`);
        }

        const app = await Application.findOneAndUpdate(
            { guildId: serverId, appName },
            { isActive: true },
            { returnDocument: 'after' }
        );

        emitApplicationUpdate(serverId, app, socket);
        await trySendApplicationEmbed(serverId, appName);
        invalidateApplication(serverId, appName);
        invalidateGuildApplications(serverId);
        console.log(`${colors.green}✅ Activated application: ${appName}${colors.reset}`);

        return app;
    } catch (error) {
        console.error(`${colors.red}❌ Error activating application:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'activate_application'
            }
        });

        throw error;
    }
}


async function deactivateApplication(serverId, appName, socket) {
    try {
        const app = await Application.findOneAndUpdate(
            { guildId: serverId, appName },
            { isActive: false },
            { returnDocument: 'after' }
        );

        if (!app) {
            throw new Error(`Application "${appName}" not found.`);
        }

        emitApplicationUpdate(serverId, app, socket);
        invalidateApplication(serverId, appName);
        invalidateGuildApplications(serverId);
        console.log(`${colors.yellow}⚠️ Deactivated application: ${appName}${colors.reset}`);

        return app;
    } catch (error) {
        console.error(`${colors.red}❌ Error deactivating application:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'deactivate_application'
            }
        });

        throw error;
    }
}


async function addApplicationQuestion(serverId, appName, questionData, socket) {
    try {
        const application = await Application.findOne({ guildId: serverId, appName });

        if (!application) {
            throw new Error(`Application "${appName}" not found.`);
        }

        
        if (application.questions.length >= LIMITS.MAX_QUESTIONS) {
            throw new Error(`Cannot add more than ${LIMITS.MAX_QUESTIONS} questions (Discord modal limit)`);
        }

        
        const sanitizedQuestion = sanitizeQuestion(questionData);

        
        if (!sanitizedQuestion.text || sanitizedQuestion.text.length === 0) {
            throw new Error('Question label cannot be empty');
        }

        application.questions.push(sanitizedQuestion);
        await application.save();

        emitApplicationUpdate(serverId, application, socket);
        invalidateApplication(serverId, appName);
        invalidateGuildApplications(serverId);
        console.log(`${colors.green}➕ Added question to ${appName}: "${sanitizedQuestion.text}" (${sanitizedQuestion.inputType})${colors.reset}`);

        return application;
    } catch (error) {
        console.error(`${colors.red}❌ Error adding question:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'add_application_question'
            }
        });

        throw error;
    }
}


async function updateApplicationQuestion(serverId, appName, questionId, updates, socket) {
    try {
        const application = await Application.findOne({ guildId: serverId, appName });

        if (!application) {
            throw new Error(`Application "${appName}" not found.`);
        }

        const questionIndex = application.questions.findIndex(q => q.id === questionId);
        if (questionIndex === -1) {
            throw new Error(`Question with ID "${questionId}" not found.`);
        }

        
        const currentQuestion = application.questions[questionIndex];
        const updatedQuestion = sanitizeQuestion({
            ...currentQuestion.toObject ? currentQuestion.toObject() : currentQuestion,
            ...updates,
            id: questionId 
        });

        application.questions[questionIndex] = updatedQuestion;
        await application.save();

        emitApplicationUpdate(serverId, application, socket);
        invalidateApplication(serverId, appName);
        invalidateGuildApplications(serverId);
        console.log(`${colors.cyan}✏️ Updated question in ${appName}: "${updatedQuestion.text}"${colors.reset}`);

        return application;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating question:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'update_application_question'
            }
        });

        throw error;
    }
}


async function removeApplicationQuestion(serverId, appName, questionId, socket) {
    try {
        const application = await Application.findOne({ guildId: serverId, appName });

        if (!application) {
            throw new Error(`Application "${appName}" not found.`);
        }

        const originalLength = application.questions.length;
        application.questions = application.questions.filter(q => q.id !== questionId);

        if (application.questions.length === originalLength) {
            throw new Error(`Question with ID "${questionId}" not found.`);
        }

        await application.save();

        emitApplicationUpdate(serverId, application, socket);
        invalidateApplication(serverId, appName);
        invalidateGuildApplications(serverId);
        console.log(`${colors.yellow}➖ Removed question from ${appName}${colors.reset}`);

        return application;
    } catch (error) {
        console.error(`${colors.red}❌ Error removing question:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'remove_application_question'
            }
        });

        throw error;
    }
}


async function deleteApplication(serverId, appName, socket) {
    try {
        const deletedApp = await Application.findOneAndDelete({ guildId: serverId, appName });

        if (!deletedApp) {
            throw new Error(`Application "${appName}" not found.`);
        }

        socket.emit('bot_data_update', {
            type: 'application_deleted',
            payload: {
                guildId: serverId,
                appName,
                _id: deletedApp._id
            }
        });

        invalidateApplication(serverId, appName);
        invalidateGuildApplications(serverId);
        console.log(`${colors.red}🗑️ Deleted application: ${appName}${colors.reset}`);

        return deletedApp;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting application:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'delete_application'
            }
        });

        throw error;
    }
}


async function disableApplicationSystem(serverId, socket) {
    try {
        const result = await Application.updateMany(
            { guildId: serverId },
            { isActive: false }
        );

        socket.emit('bot_data_update', {
            type: 'application_system_disabled',
            payload: {
                guildId: serverId,
                disabledCount: result.modifiedCount
            }
        });

        invalidateGuildApplications(serverId);
        console.log(`${colors.yellow}⚠️ Application system disabled for server ${serverId}. ${result.modifiedCount} applications deactivated.${colors.reset}`);

        return result;
    } catch (error) {
        console.error(`${colors.red}❌ Error disabling application system:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'disable_application_system'
            }
        });

        throw error;
    }
}


async function sendAllApplicationConfigs(socket) {
    try {
        const applications = await Application.find({});

        for (const app of applications) {
            socket.emit('bot_data_update', {
                type: 'application_config',
                payload: {
                    guildId: app.guildId,
                    appName: app.appName,
                    questions: app.questions || [],
                    isActive: app.isActive,
                    mainChannel: app.mainChannel || null,
                    responseChannel: app.responseChannel || null,
                    _id: app._id
                }
            });
        }

        console.log(`${colors.green}📊 Sent ${applications.length} application configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all application configs:${colors.reset}`, error);
    }
}


async function getApplicationsByServer(serverId, socket) {
    try {
        const applications = await Application.find({ guildId: serverId });

        socket.emit('bot_data_update', {
            type: 'server_applications',
            payload: {
                guildId: serverId,
                applications: applications.map(app => ({
                    appName: app.appName,
                    questions: app.questions || [],
                    isActive: app.isActive,
                    mainChannel: app.mainChannel || null,
                    responseChannel: app.responseChannel || null,
                    _id: app._id
                }))
            }
        });

        return applications;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting applications for server:${colors.reset}`, error);

        socket.emit('bot_data_update', {
            type: 'application_error',
            payload: {
                guildId: serverId,
                error: error.message,
                action: 'get_applications_by_server'
            }
        });

        throw error;
    }
}

module.exports = {
    createApplication,
    updateApplicationChannels,
    activateApplication,
    deactivateApplication,
    addApplicationQuestion,
    updateApplicationQuestion,
    removeApplicationQuestion,
    deleteApplication,
    disableApplicationSystem,
    sendAllApplicationConfigs,
    getApplicationsByServer
};