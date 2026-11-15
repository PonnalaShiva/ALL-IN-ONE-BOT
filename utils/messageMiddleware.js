
'use strict';

const { performance } = require('node:perf_hooks');
const { recordInteractionDuration } = require('./runtimeMetrics');

class MessageMiddleware {
    constructor() {
        this.middlewares = [];
    }

    use(middleware, priority = 100) {
        const registration = { middleware, priority };
        this.middlewares.push(registration);
        this.middlewares.sort((a, b) => a.priority - b.priority);
        return () => {
            const index = this.middlewares.indexOf(registration);
            if (index !== -1) this.middlewares.splice(index, 1);
        };
    }

    async execute(message) {
        let index = 0;
        let handled = false;
        let middlewareErrors = 0;
        const startedAt = performance.now();

        const next = async () => {
            if (index >= this.middlewares.length) {
                return false; 
            }

            const { middleware } = this.middlewares[index++];
            
            try {
                const result = await middleware(message, next);
                if (result === true) {
                    handled = true;
                }
                return result;
            } catch (error) {
                middlewareErrors++;
                console.error('[Middleware Error]', error);
                return false; 
            }
        };

        try {
            await next();
            return handled;
        } finally {
            recordInteractionDuration('message_pipeline', 'message_event', performance.now() - startedAt, middlewareErrors > 0);
        }
    }

    clear() {
        this.middlewares = [];
    }
}

const messageMiddleware = new MessageMiddleware();

module.exports = messageMiddleware;

