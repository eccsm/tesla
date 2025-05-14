/**
 * Tesla AutoPilot Extension - Storage Service
 * 
 * A robust storage utility that provides:
 * - Promise-based API for Chrome storage operations
 * - Error handling and automatic retries
 * - Support for both sync and local storage
 * - Default values and validation
 */

import { STORAGE_KEYS } from './constants.js';

class StorageService {
  /**
   * Maximum number of retries for storage operations
   * @type {number}
   */
  MAX_RETRIES = 3;
  
  /**
   * Delay between retries in milliseconds
   * @type {number}
   */
  RETRY_DELAY = 200;

  /**
   * Save data to Chrome storage
   * @param {Object} data - Data to save
   * @param {boolean} [useLocal=false] - Whether to use local storage instead of sync
   * @param {boolean} [saveToSecondary=true] - Whether to save to secondary storage as backup
   * @returns {Promise<void>}
   */
  async saveData(data, useLocal = false, saveToSecondary = true) {
    return this._storageOperation(async () => {
      // Determine primary storage
      const primaryStorage = useLocal ? chrome.storage.local : chrome.storage.sync;

      // Save to primary storage
      await new Promise((resolve, reject) => {
        primaryStorage.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
          } else {
            resolve();
          }
        });
      });

      // Save to secondary storage as backup if requested
      if (saveToSecondary) {
        const secondaryStorage = useLocal ? chrome.storage.sync : chrome.storage.local;
        try {
          await new Promise((resolve, reject) => {
            secondaryStorage.set(data, () => {
              if (chrome.runtime.lastError) {
                // Just log, don't reject - secondary storage is just backup
                console.warn(`Secondary storage warning: ${chrome.runtime.lastError.message}`);
              }
              resolve(); // Always resolve secondary storage
            });
          });
        } catch (e) {
          // Log but don't throw for secondary storage errors
          console.warn('Error in secondary storage:', e);
        }
      }

      // Dispatch a custom event to notify about storage changes
      this._dispatchStorageEvent(data);
    });
  }

  /**
   * Get data from Chrome storage
   * @param {string|Array|Object|null} keys - Keys to get (null for all)
   * @param {boolean} [useLocal=false] - Whether to use local storage
   * @param {boolean} [fallbackToSecondary=true] - Whether to fallback to secondary storage
   * @returns {Promise<Object>}
   */
  async getData(keys = null, useLocal = false, fallbackToSecondary = true) {
    return this._storageOperation(async () => {
      // Determine primary storage
      const primaryStorage = useLocal ? chrome.storage.local : chrome.storage.sync;
      
      try {
        // Attempt to get from primary storage
        const data = await new Promise((resolve, reject) => {
          primaryStorage.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
            } else {
              resolve(result);
            }
          });
        });
        
        return data;
      } catch (primaryError) {
        // If primary storage fails and fallback is enabled, try secondary storage
        if (fallbackToSecondary) {
          console.warn('Primary storage error, trying secondary:', primaryError);
          const secondaryStorage = useLocal ? chrome.storage.sync : chrome.storage.local;
          
          try {
            return await new Promise((resolve, reject) => {
              secondaryStorage.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(`Secondary storage error: ${chrome.runtime.lastError.message}`));
                } else {
                  resolve(result);
                }
              });
            });
          } catch (secondaryError) {
            console.error('Both storage methods failed:', secondaryError);
            throw primaryError; // Throw original error
          }
        } else {
          throw primaryError;
        }
      }
    });
  }

  /**
   * Clear all data from storage
   * @param {boolean} [useLocal=false] - Whether to clear local storage instead of sync
   * @param {boolean} [clearBoth=true] - Whether to clear both sync and local storage
   * @returns {Promise<void>}
   */
  async clearStorage(useLocal = false, clearBoth = true) {
    const clearPromises = [];
    
    if (useLocal || clearBoth) {
      clearPromises.push(new Promise((resolve, reject) => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Error clearing local storage: ${chrome.runtime.lastError.message}`));
          } else {
            resolve();
          }
        });
      }));
    }
    
    if (!useLocal || clearBoth) {
      clearPromises.push(new Promise((resolve, reject) => {
        chrome.storage.sync.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Error clearing sync storage: ${chrome.runtime.lastError.message}`));
          } else {
            resolve();
          }
        });
      }));
    }
    
    return Promise.all(clearPromises);
  }

  /**
   * Get current region from storage with fallback to default
   * @returns {Promise<string>} The region code (e.g. 'US', 'TR')
   */
  async getRegion() {
    const { region } = await this.getData(STORAGE_KEYS.REGION);
    return region || 'US';
  }

  /**
   * Get current model from storage with fallback to default
   * @returns {Promise<string>} The model code (e.g. 'my', 'm3')
   */
  async getModel() {
    const { model } = await this.getData(STORAGE_KEYS.MODEL);
    return model || 'my';
  }

  /**
   * Set current region
   * @param {string} region - The region code
   * @returns {Promise<void>}
   */
  async setRegion(region) {
    await this.saveData({ [STORAGE_KEYS.REGION]: region });
  }

  /**
   * Get all user settings
   * @returns {Promise<Object>} User settings
   */
  async getAllSettings() {
    return this.getData(null);
  }

  /**
   * Wrapper for storage operations with retry logic
   * @param {Function} operation - Storage operation function
   * @returns {Promise<any>}
   * @private
   */
  async _storageOperation(operation) {
    let lastError;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`Storage operation failed (attempt ${attempt + 1}/${this.MAX_RETRIES}):`, error);
        lastError = error;
        
        // Wait before retrying
        if (attempt < this.MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Dispatch a custom event for storage changes
   * @param {Object} data - Changed data
   * @private
   */
  _dispatchStorageEvent(data) {
    try {
      // Create a custom event with the changed data
      const event = new CustomEvent('storage-changed', { 
        detail: { changes: data, timestamp: Date.now() }
      });
      
      // Dispatch the event - this can be listened to by content scripts via window
      // or by background service workers with self.addEventListener
      if (typeof window !== 'undefined') {
        window.dispatchEvent(event);
      } else if (typeof self !== 'undefined') {
        self.dispatchEvent(event);
      }
    } catch (e) {
      console.warn('Error dispatching storage event:', e);
    }
  }
}

// Export a singleton instance
export const storageService = new StorageService();