/**
 * Tesla Inventory Monitor - Utilities
 */

/**
 * Format price with currency symbol
 * @param {number} price - Price to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted price
 */
export function formatPrice(price, currency = 'USD') {
    if (!price) return '';
    
    const formatter = new Intl.NumberFormat(currency === 'TRY' ? 'tr-TR' : 'en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    
    return formatter.format(price);
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Function result
 */
export async function withRetry(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Calculate delay with exponential backoff
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt),
                maxDelay
            );
            
            // Add some randomness to prevent thundering herd
            const jitter = Math.random() * 1000;
            
            await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
    }
    
    throw lastError;
}

/**
 * Execute code in a tab context
 * @param {number} tabId - Tab ID
 * @param {Function} fn - Function to execute
 * @returns {Promise} Function result
 */
export async function executeInTab(tabId, fn) {
    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript({
            target: { tabId },
            func: fn
        }, (results) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(results[0]?.result);
            }
        });
    });
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param {*} value - Value to check
 * @returns {boolean} True if empty
 */
export function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
