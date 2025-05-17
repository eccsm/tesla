/**
 * Tesla Inventory Monitor - Storage Service
 */

import { STORAGE_KEYS } from './constants.js';

class StorageService {
    constructor() {
        this.storage = chrome.storage.local;
    }

    /**
     * Initialize storage service
     */
    async initialize() {
        console.log('Storage service initializing...');
        return this;
    }

    /**
     * Get data from storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} Stored data
     */
    async getData(key) {
        try {
            const result = await this.storage.get(key);
            return result[key];
        } catch (error) {
            console.error('Error getting data from storage:', error);
            throw error;
        }
    }

    /**
     * Save data to storage
     * @param {Object} data - Data to save
     * @returns {Promise<void>}
     */
    async saveData(data) {
        try {
            await this.storage.set(data);
        } catch (error) {
            console.error('Error saving data to storage:', error);
            throw error;
        }
    }

    /**
     * Remove data from storage
     * @param {string|Array<string>} keys - Keys to remove
     * @returns {Promise<void>}
     */
    async removeData(keys) {
        try {
            await this.storage.remove(keys);
        } catch (error) {
            console.error('Error removing data from storage:', error);
            throw error;
        }
    }

    /**
     * Clear all data from storage
     * @returns {Promise<void>}
     */
    async clearData() {
        try {
            await this.storage.clear();
        } catch (error) {
            console.error('Error clearing storage:', error);
            throw error;
        }
    }

    /**
     * Get all data from storage
     * @returns {Promise<Object>} All stored data
     */
    async getAllData() {
        try {
            return await this.storage.get(null);
        } catch (error) {
            console.error('Error getting all data from storage:', error);
            throw error;
        }
    }

    /**
     * Save form data
     * @param {Object} formData - Form data to save
     * @returns {Promise<void>}
     */
    async saveFormData(formData) {
        await this.saveData({ [STORAGE_KEYS.FORM_DATA]: formData });
    }

    /**
     * Get form data
     * @returns {Promise<Object>} Form data
     */
    async getFormData() {
        return await this.getData(STORAGE_KEYS.FORM_DATA) || {};
    }

    /**
     * Save last search results
     * @param {Object} results - Search results to save
     * @returns {Promise<void>}
     */
    async saveLastSearch(results) {
        await this.saveData({ [STORAGE_KEYS.LAST_SEARCH]: results });
    }

    /**
     * Get last search results
     * @returns {Promise<Object>} Last search results
     */
    async getLastSearch() {
        return await this.getData(STORAGE_KEYS.LAST_SEARCH) || null;
    }

    /**
     * Save settings
     * @param {Object} settings - Settings to save
     * @returns {Promise<void>}
     */
    async saveSettings(settings) {
        await this.saveData({ [STORAGE_KEYS.SETTINGS]: settings });
    }

    /**
     * Get settings
     * @returns {Promise<Object>} Settings
     */
    async getSettings() {
        return await this.getData(STORAGE_KEYS.SETTINGS) || {};
    }

    /**
     * Add vehicle to watch list
     * @param {Object} vehicle - Vehicle to add
     * @returns {Promise<void>}
     */
    async addToWatchList(vehicle) {
        const watchList = await this.getData(STORAGE_KEYS.WATCH_LIST) || [];
        const exists = watchList.some(v => v.vin === vehicle.vin);
        
        if (!exists) {
            watchList.push({
                ...vehicle,
                addedAt: new Date().toISOString()
            });
            await this.saveData({ [STORAGE_KEYS.WATCH_LIST]: watchList });
        }
    }

    /**
     * Remove vehicle from watch list
     * @param {string} vin - Vehicle VIN
     * @returns {Promise<void>}
     */
    async removeFromWatchList(vin) {
        const watchList = await this.getData(STORAGE_KEYS.WATCH_LIST) || [];
        const filtered = watchList.filter(v => v.vin !== vin);
        await this.saveData({ [STORAGE_KEYS.WATCH_LIST]: filtered });
    }

    /**
     * Get watch list
     * @returns {Promise<Array>} Watch list
     */
    async getWatchList() {
        return await this.getData(STORAGE_KEYS.WATCH_LIST) || [];
    }
}

// Export singleton instance
export const storageService = new StorageService();
