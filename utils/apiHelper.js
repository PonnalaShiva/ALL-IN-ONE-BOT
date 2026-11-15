


const axios = require('axios');

async function apiRequestWithRetry(requestFn, options = {}) {
    const {
        maxRetries = 3,
        timeout = 10000,
        retryDelay = 1000,
        exponentialBackoff = true,
        retryableErrors = [429, 500, 502, 503, 504]
    } = options;

    let lastError;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeout);
            });

            
            const result = await Promise.race([
                requestFn(),
                timeoutPromise
            ]);

            
            clearTimeout(timeoutId);
            return result;
        } catch (error) {
            lastError = error;
            attempt++;

            
            if (attempt > maxRetries) {
                break;
            }

            
            if (error.response) {
                const status = error.response.status;
                if (!retryableErrors.includes(status)) {
                    throw error;
                }
            }

            
            if (error.message === 'Request timeout' || error.code === 'ECONNABORTED') {
                
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                
            } else {
                
                if (!error.message.includes('timeout') && !error.message.includes('ECONN')) {
                    throw error; 
                }
            }

            
            const delay = exponentialBackoff
                ? retryDelay * Math.pow(2, attempt - 1)
                : retryDelay;

            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`API request failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
}

async function axiosWithRetry(url, config = {}, retryOptions = {}) {
    return apiRequestWithRetry(
        () => axios({
            url,
            timeout: retryOptions.timeout || 10000,
            ...config
        }),
        retryOptions
    );
}

async function fetchWithRetry(url, options = {}, retryOptions = {}) {
    const timeout = retryOptions.timeout || 10000;

    return apiRequestWithRetry(
        async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        },
        retryOptions
    );
}

module.exports = {
    apiRequestWithRetry,
    axiosWithRetry,
    fetchWithRetry
};

