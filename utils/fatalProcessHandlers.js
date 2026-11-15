'use strict';

function installFatalProcessHandlers({ processRef = process, shutdown, log = console.error }) {
    if (!processRef || typeof processRef.once !== 'function' || typeof processRef.off !== 'function' || typeof shutdown !== 'function') {
        throw new TypeError('A process event target and shutdown callback are required.');
    }

    const reportAndShutdown = (signal, error) => {
        log(`[FATAL] ${signal}; starting graceful shutdown.`, error);
        try {
            Promise.resolve(shutdown(signal, error)).catch(shutdownError => {
                log(`[FATAL] ${signal} shutdown failed.`, shutdownError);
            });
        } catch (shutdownError) {
            log(`[FATAL] ${signal} shutdown failed.`, shutdownError);
        }
    };
    const onUncaughtException = error => reportAndShutdown('UNCAUGHT_EXCEPTION', error);
    const onUnhandledRejection = reason => reportAndShutdown('UNHANDLED_REJECTION', reason);

    const attach = typeof processRef.on === 'function' ? processRef.on.bind(processRef) : processRef.once.bind(processRef);
    attach('uncaughtException', onUncaughtException);
    attach('unhandledRejection', onUnhandledRejection);

    return () => {
        processRef.off('uncaughtException', onUncaughtException);
        processRef.off('unhandledRejection', onUnhandledRejection);
    };
}

module.exports = { installFatalProcessHandlers };
