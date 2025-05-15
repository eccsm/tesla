/**
 * Tesla AutoPilot Extension - Message Handler Service
 * 
 * Provides a centralized way to handle messages between different parts
 * of the extension (background, content scripts, popup).
 */

import { ACTION_TYPES } from './constants.js';
import { inventoryApiService } from './inventory-api.js';
import { storageService } from './storage.js';

export class MessageHandlerService {
    constructor() {
      this.handlers = new Map();
    }
    
    initialize() {
      console.log('Message Handler Service initialized');
      
      // Set up message handlers
      this.setupMessageHandlers();
      
      return this;
    }
    
    /**
     * Register a handler for a specific action type
     * @param {string} actionType - The action type to handle
     * @param {Function} handler - The handler function
     */
    registerHandler(actionType, handler) {
      this.handlers.set(actionType, handler);
      console.log(`Registered handler for action: ${actionType}`);
    }
    
    /**
     * Set up message handlers
     */
    setupMessageHandlers() {
      // Register CHECK_INVENTORY handler
      this.registerHandler(ACTION_TYPES.CHECK_INVENTORY, async (message) => {
        try {
          // Get monitoring filters
          const filters = message.filters || {};
          
          // Check if this is a silent check (for threshold updates)
          const isSilent = message.silent === true;
          
          // For Tesla API requests that fail with protocol errors, retry with a delay
          const maxRetries = 2;
          let retryCount = 0;
          let result = null;
          
          while (retryCount <= maxRetries) {
            try {
              // Fetch inventory with filters
              result = await inventoryApiService.fetchInventory(filters);
              // Success, exit retry loop
              break;
            } catch (fetchError) {
              // If this is a protocol error, retry
              if (fetchError.message.includes('HTTP2_PROTOCOL_ERROR') || 
                  fetchError.message.includes('net::ERR_HTTP2_PROTOCOL_ERROR')) {
                
                retryCount++;
                if (retryCount <= maxRetries) {
                  // Exponential backoff - wait longer between retries
                  const delayMs = 1000 * Math.pow(2, retryCount - 1);
                  console.log(`HTTP2 protocol error, retrying in ${delayMs}ms (attempt ${retryCount}/${maxRetries})`);
                  await new Promise(resolve => setTimeout(resolve, delayMs));
                  continue;
                }
              }
              // For other errors or if we've exceeded retries, rethrow
              throw fetchError;
            }
          }
          
          // If we still don't have results after retries, fall back to browser method
          if (!result) {
            console.log("No results after retries, trying browser method");
            result = await inventoryApiService.getInventoryViaBrowser(filters);
          }
          
          // Save last check time and results
          await storageService.saveData({
            lastInventoryCheck: new Date().toISOString(),
            lastInventoryResults: result.results
          });
          
          // If vehicles found and not in silent mode, show notification
          if (result.results.length > 0) {
            if (!isSilent) {
              this._showNotificationForVehicles(result.results, filters);
            }
            
            // Update active tab with results regardless of silent mode
            await showInventoryResultsOnTab(result.results, filters);
          }
          
          return result;
        } catch (error) {
          console.error('Error in checkInventory handler:', error);
          
          // If API access failed, try the fallback method
          if (
            error.message.includes("403") || 
            error.message.includes("Failed to fetch") || 
            error.message.includes("Network error") ||
            error.message.includes("HTTP2_PROTOCOL_ERROR")
          ) {
            try {
              // Try browser method instead
              console.log("API error, using browser method");
              const browserResult = await inventoryApiService.getInventoryViaBrowser(message.filters || {});
              return browserResult;
            } catch (browserError) {
              console.error("Browser method also failed:", browserError);
              return { 
                success: false, 
                fallback: true,
                error: "Automated inventory checks failed. Try using the 'Open Tesla Inventory' button instead." 
              };
            }
          }
          
          return { 
            success: false, 
            error: error.message || String(error) 
          };
        }
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