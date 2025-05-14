/**
 * Tesla AutoPilot Extension - Utility Functions
 * 
 * Shared utility functions for various extension components.
 */

import { CONFIG } from './constants.js';

/**
 * Format price according to region settings
 * @param {number} price - Price value
 * @param {string} region - Region code (e.g., 'US', 'TR')
 * @returns {string} Formatted price with currency symbol
 */
export function formatPrice(price, region = 'US') {
  const regionConfig = CONFIG.REGIONS[region] || CONFIG.REGIONS.US;
  return `${regionConfig.currencySymbol}${price.toLocaleString(regionConfig.numberFormat)}`;
}

/**
 * Format date according to region settings
 * @param {Date|string|number} date - Date to format
 * @param {string} region - Region code
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date
 */
export function formatDate(date, region = 'US', includeTime = true) {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  const locale = region === 'TR' ? 'tr-TR' : 'en-US';
  
  if (includeTime) {
    return dateObj.toLocaleString(locale);
  } else {
    return dateObj.toLocaleDateString(locale);
  }
}

/**
 * Get the full model name for a model code
 * @param {string} modelCode - Model code (e.g., 'my', 'm3')
 * @returns {string} Full model name
 */
export function getModelName(modelCode) {
  return CONFIG.MODELS[modelCode]?.displayName || modelCode.toUpperCase();
}

/**
 * Check if current page is a Tesla page
 * @returns {Promise<boolean>} Whether current page is a Tesla page
 */
export async function isTeslaPage() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Error checking tab:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        
        if (tabs.length === 0) {
          resolve(false);
          return;
        }
        
        const tab = tabs[0];
        resolve(tab.url?.includes('tesla.com') || false);
      });
    } catch (error) {
      console.error('Error checking if Tesla page:', error);
      resolve(false);
    }
  });
}

/**
 * Send a message to a tab with error handling
 * @param {number} tabId - Tab ID
 * @param {object} message - Message to send
 * @returns {Promise<any>} Response from the tab
 */
export function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Tab message error: ${chrome.runtime.lastError.message}`));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send a message to the background script
 * @param {Object} message - Message to send
 * @returns {Promise<any>} Response from background script
 */
export function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Background message error: ${chrome.runtime.lastError.message}`));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function that returns a promise
 * @param {Object} options - Options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.baseDelay - Base delay in milliseconds
 * @param {number} options.maxDelay - Maximum delay in milliseconds
 * @returns {Promise<any>} Result of the function
 */
export async function withRetry(fn, { maxRetries = 3, baseDelay = 200, maxDelay = 5000 } = {}) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          maxDelay,
          baseDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4)
        );
        
        console.warn(`Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay.toFixed(0)}ms`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Parse expiration date string into separate month and year
 * @param {string} expDateValue - Expiration date string (MM/YY, MM/YYYY, etc.)
 * @returns {Object} Object with month and year properties
 */
export function parseExpirationDate(expDateValue) {
  // Default values
  let month = '';
  let year = '';
  
  // Check if we have a valid format
  if (expDateValue && typeof expDateValue === 'string') {
    // Common formats: MM/YY, MM/YYYY, MM-YY
    const formats = [
      /^(\d{1,2})[\/\-](\d{2,4})$/, // MM/YY, MM/YYYY, MM-YY, MM-YYYY
      /^(\d{1,2})(\d{2})$/ // MMYY
    ];
    
    // Try each format
    for (const format of formats) {
      const match = expDateValue.match(format);
      if (match) {
        month = match[1].padStart(2, '0'); // Ensure 2-digit month
        year = match[2];
        
        // Convert 2-digit year to 4-digit
        if (year.length === 2) {
          year = '20' + year;
        }
        
        break;
      }
    }
  }
  
  return { month, year };
}

/**
 * Get localized message based on region
 * @param {Object} messages - Object with localized messages
 * @param {string} region - Region code
 * @returns {string} Localized message
 */
export function getLocalizedMessage(messages, region = 'US') {
  const lang = region === 'TR' ? 'tr' : 'en';
  return messages[lang] || messages.en || '';
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {number} options.interval - Polling interval in milliseconds
 * @returns {Promise<Element|null>} The element or null if timeout
 */
export function waitForElement(selector, { timeout = 5000, interval = 100 } = {}) {
  return new Promise(resolve => {
    const endTime = Date.now() + timeout;
    
    const checkElement = () => {
      const element = document.querySelector(selector);
      
      if (element) {
        resolve(element);
        return;
      }
      
      if (Date.now() > endTime) {
        resolve(null);
        return;
      }
      
      setTimeout(checkElement, interval);
    };
    
    checkElement();
  });
}

/**
 * Safely execute a function in the context of a tab
 * @param {number} tabId - Tab ID
 * @param {Function} func - Function to execute
 * @param {boolean} returnResults - Whether to return results
 * @returns {Promise<any>} Results of function execution
 */
export async function executeInTab(tabId, func, returnResults = true) {
  return new Promise((resolve, reject) => {
    try {
      chrome.scripting.executeScript({
        target: { tabId },
        function: func,
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Script execution error: ${chrome.runtime.lastError.message}`));
        } else if (returnResults) {
          resolve(results[0]?.result);
        } else {
          resolve(true);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique ID
 */
export function generateUniqueId(prefix = '') {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Show a notification in the UI
 * @param {string} message - Message text
 * @param {boolean} isSuccess - Whether it's a success notification
 * @param {number} duration - Duration in milliseconds
 * @returns {HTMLElement} The notification element
 */
export function showNotification(message, isSuccess = true, duration = 3000) {
  // Check if we're in a document context
  if (typeof document === 'undefined') return null;
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `tesla-autopilot-notification ${isSuccess ? 'success' : 'error'}`;
  notification.textContent = message;
  
  // Add to body
  document.body.appendChild(notification);
  
  // Remove after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, duration);
  
  return notification;
}