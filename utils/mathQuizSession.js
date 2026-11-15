'use strict';

function buildMathQuizModalId(messageId, questionIndex) {
    if (typeof messageId !== 'string' || !/^\d+$/.test(messageId) ||
        !Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 99) {
        throw new TypeError('A valid quiz message ID and question index are required.');
    }
    return `math-quiz_modal_${messageId}_${questionIndex}`;
}

function parseMathQuizCustomId(customId) {
    if (typeof customId !== 'string') return null;
    const match = /^math-quiz_(solve|stop|modal)_(\d+)(?:_(\d{1,2}))?$/.exec(customId);
    if (!match) return null;
    const action = match[1];
    const questionIndex = match[3] === undefined ? null : Number(match[3]);
    if ((action === 'modal') !== (questionIndex !== null)) return null;
    return { action, messageId: match[2], questionIndex };
}

function claimQuizQuestionAnswer(session, questionIndex) {
    if (!session || !Number.isInteger(questionIndex) || questionIndex !== session.currentQuestion) return false;
    if (session.answeredQuestionIndex === questionIndex) return false;
    session.answeredQuestionIndex = questionIndex;
    return true;
}

function releaseQuizQuestionAnswer(session, questionIndex) {
    if (session?.answeredQuestionIndex === questionIndex) session.answeredQuestionIndex = null;
}

function parseMathQuizAnswer(answerText, expectedAnswer) {
    const normalized = String(answerText ?? '').trim();
    if (typeof expectedAnswer === 'string') return normalized.toLowerCase();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return Number.NaN;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : Number.NaN;
}

module.exports = {
    buildMathQuizModalId,
    parseMathQuizCustomId,
    claimQuizQuestionAnswer,
    releaseQuizQuestionAnswer,
    parseMathQuizAnswer
};
