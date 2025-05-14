/**
 * Tesla AutoPilot Extension - Inventory Monitor Service
 * 
 * Handles monitoring of Tesla inventory using alarms and background polling.
 */

import { CONFIG, ACTION_TYPES, STORAGE_KEYS } from './constants.js';
import { storageService } from './storage.js';
import { messageHandlerService } from './message-handler.js';

class InventoryMonitorService {
  constructor() {
    // Default polling intervals (in minutes)
    this.DEFAULT_POLL_INTERVAL = CONFIG.DEFAULT_POLL_INTERVAL;
    this.AGGRESSIVE_POLL_INTERVAL = CONFIG.AGGRESSIVE_POLL_INTERVAL;
    
    // Active polling state
    this.activeAlarm = null;
    this.isMonitoring = false;
  }
  
  /**
   * Initialize the monitor service
   */
  initialize() {
    try {
      console.log("Initializing inventory monitor...");
      
      // Set up alarm listener
      if (chrome.alarms) {
        chrome.alarms.onAlarm.addListener(this._handleAlarm.bind(this));
      }
      
      // Restore monitoring state if active
      this._restoreMonitoringState();
      
      console.log("Inventory monitor initialized");
      return this;
    } catch (error) {
      console.error("Error initializing inventory monitor:", error);
      return this;
    }
  }
  
  /**
   * Start monitoring for vehicles matching filters
   * @param {Object} filters - Inventory filters
   * @param {number} intervalMinutes - Polling interval in minutes
   * @returns {Promise<boolean>} Success status
   */
  async startMonitoring(filters, intervalMinutes = this.DEFAULT_POLL_INTERVAL) {
    try {
      // Stop any existing monitoring
      await this.stopMonitoring();
      
      // Save the filters
      await storageService.saveData({ 
        [STORAGE_KEYS.MONITORING_FILTERS]: filters 
      });
      
      // Make sure chrome.alarms is available
      if (!chrome.alarms) {
        throw new Error("Chrome alarms API not available. Check manifest permissions.");
      }
      
      // Set up polling with Chrome alarms
      this.activeAlarm = "tesla-inventory-monitor";
      
      chrome.alarms.create(this.activeAlarm, {
        periodInMinutes: intervalMinutes,
        delayInMinutes: 0.1 // Start almost immediately
      });
      
      this.isMonitoring = true;
      
      // Set monitoring state
      await storageService.saveData({
        [STORAGE_KEYS.IS_MONITORING]: true,
        [STORAGE_KEYS.MONITORING_INTERVAL]: intervalMinutes,
        [STORAGE_KEYS.MONITORING_STARTED]: new Date().toISOString()
      });
      
      console.log(`Inventory monitoring started with interval: ${intervalMinutes} minutes`);
      
      // Check inventory immediately
      this.checkInventory();
      
      return true;
    } catch (error) {
      console.error("Error starting inventory monitoring:", error);
      return false;
    }
  }
  
  /**
   * Stop monitoring for vehicles
   * @returns {Promise<boolean>} Success status
   */
  async stopMonitoring() {
    try {
      // Verify chrome.alarms is available
      if (!chrome.alarms) {
        console.warn("Chrome alarms API not available, but continuing with cleanup");
      } else {
        // Clear the alarm if one is active
        if (this.activeAlarm) {
          try {
            await new Promise((resolve) => {
              chrome.alarms.clear(this.activeAlarm, (wasCleared) => {
                resolve(wasCleared);
              });
            });
          } catch (alarmError) {
            console.warn("Error clearing alarm:", alarmError);
          }
          this.activeAlarm = null;
        }
      }
      
      this.isMonitoring = false;
      
      // Update monitoring state
      await storageService.saveData({
        [STORAGE_KEYS.IS_MONITORING]: false
      });
      
      console.log("Inventory monitoring stopped");
      return true;
    } catch (error) {
      console.error("Error stopping inventory monitoring:", error);
      return false;
    }
  }
  
  /**
   * Check inventory for matches
   * @returns {Promise<Array>} Array of matching vehicles
   */
  async checkInventory() {
    try {
      console.log("Running inventory check...");
      
      // Get monitoring filters
      const data = await storageService.getData(STORAGE_KEYS.MONITORING_FILTERS);
      const monitoringFilters = data[STORAGE_KEYS.MONITORING_FILTERS];
      
      if (!monitoringFilters) {
        console.error("No monitoring filters defined");
        return [];
      }
      
      // Use the message handler to check inventory
      // This ensures consistent error handling and notifications
      const response = await messageHandlerService.handlers.get(ACTION_TYPES.CHECK_INVENTORY)({
        filters: monitoringFilters
      });
      
      if (response.success) {
        return response.results;
      } else if (response.fallback) {
        // Handle fallback case - API is blocked by Tesla
        console.warn("API blocked, inventory check failed");
        return [];
      } else {
        console.error("Inventory check failed:", response.error);
        return [];
      }
    } catch (error) {
      console.error("Error checking inventory:", error);
      return [];
    }
  }
  
  /**
   * Handle alarm events
   * @param {Object} alarm - Alarm object
   * @private
   */
  _handleAlarm(alarm) {
    if (alarm.name === "tesla-inventory-monitor") {
      this.checkInventory().catch(error => {
        console.error("Error in alarm handler:", error);
      });
    }
  }
  
  /**
   * Restore monitoring state if active
   * @private
   */
  async _restoreMonitoringState() {
    try {
      // Get monitoring state
      const data = await storageService.getData([
        STORAGE_KEYS.IS_MONITORING,
        STORAGE_KEYS.MONITORING_FILTERS,
        STORAGE_KEYS.MONITORING_INTERVAL
      ]);
      
      if (data[STORAGE_KEYS.IS_MONITORING] && data[STORAGE_KEYS.MONITORING_FILTERS]) {
        this.startMonitoring(
          data[STORAGE_KEYS.MONITORING_FILTERS], 
          data[STORAGE_KEYS.MONITORING_INTERVAL] || this.DEFAULT_POLL_INTERVAL
        ).catch(err => {
          console.error("Error restoring monitoring:", err);
        });
      }
    } catch (err) {
      console.error("Error retrieving monitoring state:", err);
    }
  }
}

// Export a singleton instance
export const inventoryMonitorService = new InventoryMonitorService();