const Application = require('./applications');
const { v4: uuidv4 } = require('uuid');
const { invalidateApplication, invalidateGuildApplications } = require('../../utils/cacheHelpers');

const LIMITS = {
    MAX_QUESTIONS: 5,
    LABEL_MAX: 45,
    PLACEHOLDER_MAX: 100,
    CUSTOM_ID_MAX: 100,
    INPUT_MAX: 4000
};

function sanitizeQuestion(questionData) {
    if (typeof questionData === 'string') {
        
        return {
            id: uuidv4().substring(0, LIMITS.CUSTOM_ID_MAX),
            text: questionData.substring(0, LIMITS.LABEL_MAX).trim(),
            placeholder: '',
            inputType: 'PARAGRAPH',
            required: true,
            minLength: 1,
            maxLength: LIMITS.INPUT_MAX
        };
    }

    
    return {
        id: (questionData.id || uuidv4()).substring(0, LIMITS.CUSTOM_ID_MAX),
        text: (questionData.text || '').substring(0, LIMITS.LABEL_MAX).trim(),
        placeholder: (questionData.placeholder || '').substring(0, LIMITS.PLACEHOLDER_MAX).trim(),
        inputType: ['SHORT', 'PARAGRAPH'].includes(questionData.inputType) ? questionData.inputType : 'PARAGRAPH',
        required: questionData.required !== false,
        minLength: Math.min(Math.max(0, questionData.minLength || 1), LIMITS.INPUT_MAX),
        maxLength: Math.min(Math.max(1, questionData.maxLength || LIMITS.INPUT_MAX), LIMITS.INPUT_MAX)
    };
}

async function createApplication(guildId, appName) {
    
    const sanitizedName = appName.substring(0, 30).trim();

    const application = new Application({
        guildId,
        appName: sanitizedName,
        questions: []
    });
    await application.save();

    
    invalidateGuildApplications(guildId);
    invalidateApplication(guildId, sanitizedName);

    return application;
}

async function addQuestion(guildId, appName, questionData) {
    
    const app = await Application.findOne({ guildId, appName });
    if (!app) {
        throw new Error(`Application "${appName}" not found`);
    }

    if (app.questions.length >= LIMITS.MAX_QUESTIONS) {
        throw new Error(`Cannot add more than ${LIMITS.MAX_QUESTIONS} questions (Discord modal limit)`);
    }

    const sanitizedQuestion = sanitizeQuestion(questionData);

    await Application.findOneAndUpdate(
        { guildId, appName },
        { $push: { questions: sanitizedQuestion } }
    );

    
    invalidateApplication(guildId, appName);

    return sanitizedQuestion;
}

async function updateQuestion(guildId, appName, questionId, updates) {
    const app = await Application.findOne({ guildId, appName });
    if (!app) {
        throw new Error(`Application "${appName}" not found`);
    }

    const questionIndex = app.questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) {
        throw new Error(`Question not found`);
    }

    
    const currentQuestion = app.questions[questionIndex];
    const updatedQuestion = sanitizeQuestion({
        ...currentQuestion,
        ...updates,
        id: questionId 
    });

    app.questions[questionIndex] = updatedQuestion;
    await app.save();

    invalidateApplication(guildId, appName);

    return updatedQuestion;
}

async function removeQuestion(guildId, appName, index) {
    const app = await Application.findOne({ guildId, appName });
    if (!app || index < 0 || index >= app.questions.length) return false;

    app.questions.splice(index, 1);
    await app.save();

    
    invalidateApplication(guildId, appName);

    return true;
}

async function removeQuestionById(guildId, appName, questionId) {
    const app = await Application.findOne({ guildId, appName });
    if (!app) return false;

    const originalLength = app.questions.length;
    app.questions = app.questions.filter(q => q.id !== questionId);

    if (app.questions.length === originalLength) return false;

    await app.save();
    invalidateApplication(guildId, appName);

    return true;
}

async function deleteApplication(guildId, appName) {
    const result = await Application.deleteOne({ guildId, appName });

    
    if (result.deletedCount > 0) {
        invalidateApplication(guildId, appName);
        invalidateGuildApplications(guildId);
    }

    return result.deletedCount > 0;
}

async function activateApplication(guildId, appName, mainChannel, responseChannel) {
    const app = await Application.findOne({ guildId, appName });

    if (!app) {
        throw new Error(`Application "${appName}" not found`);
    }

    
    if (!app.questions || app.questions.length < 1) {
        throw new Error('Application must have at least 1 question before activation');
    }

    await Application.findOneAndUpdate(
        { guildId, appName },
        {
            isActive: true,
            mainChannel,
            responseChannel
        }
    );

    
    invalidateApplication(guildId, appName);
}

async function deactivateApplication(guildId, appName) {
    await Application.findOneAndUpdate(
        { guildId, appName },
        { isActive: false }
    );

    invalidateApplication(guildId, appName);
}

async function getActiveApplication(guildId) {
    try {
        return await Application.findOne({ guildId, isActive: true });
    } catch (error) {
        console.error('[ApplicationController] Error getting active application:', error);
        return null;
    }
}

async function getApplication(guildId, appName) {
    try {
        const { getApplication: getCachedApplication } = require('../../utils/cacheHelpers');
        return await getCachedApplication(guildId, appName);
    } catch (error) {
        console.error('[ApplicationController] Error getting application:', error);
        
        return await Application.findOne({ guildId, appName });
    }
}

async function getAllApplications(guildId) {
    try {
        const { getAllApplications: getCachedApplications } = require('../../utils/cacheHelpers');
        return await getCachedApplications(guildId);
    } catch (error) {
        console.error('[ApplicationController] Error getting all applications:', error);
        
        return await Application.find({ guildId });
    }
}

module.exports = {
    createApplication,
    addQuestion,
    updateQuestion,
    removeQuestion,
    removeQuestionById,
    deleteApplication,
    activateApplication,
    deactivateApplication,
    getActiveApplication,
    getApplication,
    getAllApplications,
    LIMITS,
    sanitizeQuestion
};
