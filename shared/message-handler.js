/**
 * Tesla AutoPilot Extension - Message Handler Service
 * 
 * Provides a centralized way to handle messages between different parts
 * of the extension (background, content scripts, popup).
 */

import { ACTION_TYPES } from './constants.js';
import { inventoryApiService } from './inventory-api.js';
import { storageService } from './storage.js';

class MessageHandlerService {
  constructor() {
    // Map of action types to handler functions
    this.handlers = new Map();
    
    // Register default handlers
    this._registerDefaultHandlers();
  }
  
  /**
   * Initialize the message handler service
   */
  initialize() {
    // Set up the message listener
    chrome.runtime.onMessage.addListener(this._handleMessage.bind(this));
    console.log('Message handler service initialized');
    return this;
  }
  
  /**
   * Register a handler for an action type
   * @param {string} actionType - Action type
   * @param {Function} handler - Handler function
   */
  registerHandler(actionType, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for ${actionType} must be a function`);
    }
    
    this.handlers.set(actionType, handler);
  }
  
  /**
   * Unregister a handler for an action type
   * @param {string} actionType - Action type
   */
  unregisterHandler(actionType) {
    this.handlers.delete(actionType);
  }
  
  /**
   * Send a message to a specific tab
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message to send
   * @returns {Promise<any>} Response from the tab
   */
  async sendMessageToTab(tabId, message) {
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
   * Send a message to all tabs
   * @param {Object} message - Message to send
   * @returns {Promise<Array>} Array of responses
   */
  async broadcastToTabs(message) {
    try {
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => resolve(tabs));
      });
      
      const responses = await Promise.all(
        tabs.map(tab => this.sendMessageToTab(tab.id, message).catch(() => null))
      );
      
      return responses.filter(response => response !== null);
    } catch (error) {
      console.error('Error broadcasting message:', error);
      return [];
    }
  }
  
  /**
   * Internal message handler
   * @param {Object} message - Message object
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response function
   * @returns {boolean} Whether the response will be sent asynchronously
   * @private
   */
  _handleMessage(message, sender, sendResponse) {
    if (!message || !message.action) {
      sendResponse({ error: 'Invalid message format' });
      return false;
    }
    
    const { action } = message;
    
    // Check if we have a handler for this action
    if (this.handlers.has(action)) {
      const handler = this.handlers.get(action);
      
      try {
        // Execute the handler
        const result = handler(message, sender);
        
        // If the result is a promise, handle it asynchronously
        if (result instanceof Promise) {
          result
            .then(response => sendResponse(response))
            .catch(error => {
              console.error(`Error handling ${action}:`, error);
              sendResponse({ 
                success: false, 
                error: error.message || String(error) 
              });
            });
          
          // Return true to indicate we'll send the response asynchronously
          return true;
        } else {
          // Send the response synchronously
          sendResponse(result);
          return false;
        }
      } catch (error) {
        console.error(`Error in ${action} handler:`, error);
        sendResponse({ 
          success: false, 
          error: error.message || String(error) 
        });
        return false;
      }
    } else {
      console.warn(`No handler registered for action: ${action}`);
      sendResponse({ 
        success: false, 
        error: `Unknown action: ${action}` 
      });
      return false;
    }
  }
  
  /**
   * Register default message handlers
   * @private
   */
  _registerDefaultHandlers() {
    // Fetch inventory handler
    this.registerHandler(ACTION_TYPES.FETCH_INVENTORY, async (message) => {
      try {
        const result = await inventoryApiService.fetchInventory(message.filters);
        return result;
      } catch (error) {
        console.error('Error in fetchInventory handler:', error);
        return { 
          success: false, 
          error: error.message || String(error) 
        };
      }
    });
    
    // Check inventory handler
    this.registerHandler(ACTION_TYPES.CHECK_INVENTORY, async (message) => {
      try {
        // Get monitoring filters
        const filters = message.filters || {};
        
        // Fetch inventory with filters
        const result = await inventoryApiService.fetchInventory(filters);
        
        // Save last check time and results
        await storageService.saveData({
          lastInventoryCheck: new Date().toISOString(),
          lastInventoryResults: result.results
        });
        
        // If vehicles found and we have a valid tab, show notification
        if (result.results.length > 0) {
          this._showNotificationForVehicles(result.results, filters);
        }
        
        return result;
      } catch (error) {
        console.error('Error in checkInventory handler:', error);
        
        // If API access failed, try the fallback method
        if (
          error.message.includes("403") || 
          error.message.includes("Failed to fetch") || 
          error.message.includes("Network error")
        ) {
          return { 
            success: false, 
            fallback: true,
            error: "Automated inventory checks are currently not possible. Tesla may have updated their API or is blocking automated access. Try using the 'Open Tesla Inventory' button instead." 
          };
        }
        
        return { 
          success: false, 
          error: error.message || String(error) 
        };
      }
    });
    
    // Start monitoring handler
    this.registerHandler(ACTION_TYPES.START_MONITORING, async (message) => {
      try {
        const { filters, interval = 5 } = message;
        
        // Save the filters
        await storageService.saveData({ monitoringFilters: filters });
        
        // Make sure chrome.alarms is available
        if (!chrome.alarms) {
          throw new Error("Chrome alarms API not available. Check manifest permissions.");
        }
        
        // Set up polling with Chrome alarms
        const alarmName = "tesla-inventory-monitor";
        
        chrome.alarms.create(alarmName, {
          periodInMinutes: interval,
          delayInMinutes: 0.1 // Start almost immediately
        });
        
        // Set monitoring state
        await storageService.saveData({
          isMonitoring: true,
          monitoringInterval: interval,
          monitoringStarted: new Date().toISOString()
        });
        
        console.log(`Inventory monitoring started with interval: ${interval} minutes`);
        
        // Check inventory immediately
        this.handlers.get(ACTION_TYPES.CHECK_INVENTORY)({
          filters: filters
        });
        
        return { success: true };
      } catch (error) {
        console.error('Error in startMonitoring handler:', error);
        return { 
          success: false, 
          error: error.message || String(error) 
        };
      }
    });
    
    // Stop monitoring handler
    this.registerHandler(ACTION_TYPES.STOP_MONITORING, async () => {
      try {
        // Verify chrome.alarms is available
        if (!chrome.alarms) {
          console.warn("Chrome alarms API not available, but continuing with cleanup");
        } else {
          // Clear the alarm
          await new Promise((resolve) => {
            chrome.alarms.clear("tesla-inventory-monitor", (wasCleared) => {
              resolve(wasCleared);
            });
          });
        }
        
        // Update monitoring state
        await storageService.saveData({
          isMonitoring: false
        });
        
        console.log("Inventory monitoring stopped");
        return { success: true };
      } catch (error) {
        console.error('Error in stopMonitoring handler:', error);
        return { 
          success: false, 
          error: error.message || String(error) 
        };
      }
    });
    
    // Download CSV handler
    this.registerHandler(ACTION_TYPES.DOWNLOAD_CSV, async () => {
      try {
        const success = await inventoryApiService.downloadCSV();
        return { success };
      } catch (error) {
        console.error('Error in downloadCSV handler:', error);
        return { 
          success: false, 
          error: error.message || String(error) 
        };
      }
    });
    
    // Fill form handler
    this.registerHandler(ACTION_TYPES.FILL_FORM, async (message, sender) => {
      try {
        // Send message to content script
        const activeTab = await this._getActiveTab();
        
        if (!activeTab) {
          return { status: "No active tab" };
        }
        
        const response = await this.sendMessageToTab(activeTab.id, { action: ACTION_TYPES.FILL_FORM });
        return response || { status: "Message sent" };
      } catch (error) {
        console.error('Error in fillForm handler:', error);
        return { 
          success: false, 
          error: error.message || String(error) 
        };
      }
    });
    
    // Fix validation handler
    this.registerHandler(ACTION_TYPES.FIX_VALIDATION, async () => {
      try {
        const activeTab = await this._getActiveTab();
        
        if (!activeTab) {
          return { status: "No active tab" };
        }
        
        const response = await this.sendMessageToTab(activeTab.id, { action: ACTION_TYPES.FIX_VALIDATION });
        return response || { status: "Message sent" };
      } catch (error) {
        console.error('Error in fixValidation handler:', error);
        return { 
          success: false, 
          error: error.message || String(error) 
        };
      }
    });
    
    // Toggle panel handler
    this.registerHandler(ACTION_TYPES.TOGGLE_PANEL, async () => {
      try {
        const activeTab = await this._getActiveTab();
        
        if (!activeTab) {
          return { status: "No active tab" };
        }
        
        const response = await this.sendMessageToTab(activeTab.id, { action: ACTION_TYPES.TOGGLE_PANEL });
        return response || { status: "Panel toggled" };
      } catch (error) {
        console.error('Error in togglePanel handler:', error);
        return { 
          success: false, 
          error: error.message || String(error) 
        };
      }
    });
    
    // Refresh data handler (simple acknowledgment)
    this.registerHandler(ACTION_TYPES.REFRESH_DATA, () => {
      return { status: "Refresh requested" };
    });
  }
  
  /**
   * Get the active tab
   * @returns {Promise<Object|null>} Active tab or null
   * @private
   */
  async _getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Error querying tabs:', chrome.runtime.lastError);
          resolve(null);
        } else if (tabs.length === 0) {
          resolve(null);
        } else {
          resolve(tabs[0]);
        }
      });
    });
  }
  
  /**
   * Show a notification for found vehicles
   * @param {Array} vehicles - Found vehicles
   * @param {Object} filters - Search filters
   * @private
   */
  _showNotificationForVehicles(vehicles, filters) {
    if (!vehicles || vehicles.length === 0) return;
    
    try {
      // Make sure chrome.notifications is available
      if (!chrome.notifications) {
        console.warn("Chrome notifications API not available. Check manifest permissions.");
        return;
      }
      
      // Get region configuration
      const regionConfig = CONFIG.REGIONS[filters.region] || CONFIG.REGIONS.US;
      
      // Format a nice notification
      const lowestPrice = vehicles.reduce((min, v) => Math.min(min, v.price), Infinity);
      const formattedPrice = formatPrice(lowestPrice, filters.region);
      
      const modelName = CONFIG.MODELS[filters.model]?.displayName || 'Tesla';
      
      // Customize message based on region
      let title, message;
      if (filters.region === 'TR') {
        title = `${vehicles.length} ${modelName} bulundu!`;
        message = `Fiyatlar ${formattedPrice}'dan başlıyor - Görmek için tıklayın`;
      } else {
        title = `${vehicles.length} ${modelName}${vehicles.length > 1 ? 's' : ''} found!`;
        message = `Starting at ${formattedPrice} - Click to view`;
      }
      
      // Create Chrome notification
      chrome.notifications.create("tesla-inventory-find", {
        type: "basic",
        iconUrl: "/icons/science.png",
        title,
        message,
        priority: 2
      });
      
      // Set badge with number of matches
      if (chrome.action && chrome.action.setBadgeText) {
        chrome.action.setBadgeText({ text: String(vehicles.length) });
        chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
      }
    } catch (error) {
      console.error("Error showing notification:", error);
    }
  }
}

// Export a singleton instance
export const messageHandlerService = new MessageHandlerService();