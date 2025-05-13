// Simple storage wrapper for more reliable operations
const StorageManager = {
    /**
     * Save data to storage
     * @param {Object} data - Data to save
     * @returns {Promise<void>}
     */
    async saveData(data) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.set(data, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    },
    
    /**
     * Get data from storage
     * @param {string|Array|Object} keys - Keys to get
     * @returns {Promise<Object>}
     */
    async getData(keys) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.get(keys, (data) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(data);
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    }
  };