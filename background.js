/**
 * Tesla AutoPilot Extension - Background Script
 * 
 * Main entry point for the extension's background service worker.
 * Initializes and coordinates the various services.
 */

import { inventoryApiService } from './shared/inventory-api.js';
import { messageHandlerService } from './shared/message-handler.js';
import { inventoryMonitorService } from './shared/monitor-service.js';
import { storageService } from './shared/storage.js';

/**
 * Initialize all services when the extension is installed or updated
 */
async function initializeExtension() {
  console.log("Starting Tesla AutoPilot extension initialization...");
  
  try {
    // Initialize services in the correct order - storage first, then API, then message handler
    await storageService.initialize();
    console.log("Storage service initialized");
    
    await inventoryApiService.initialize();
    console.log("Inventory API service initialized");
    
    await messageHandlerService.initialize();
    console.log("Message handler service initialized");
    
    await inventoryMonitorService.initialize();
    console.log("Inventory monitor service initialized");
    
    console.log("Tesla AutoPilot extension fully initialized!");
  } catch (error) {
    console.error("Error during service initialization:", error);
  }
}

// Set up installation and update handler
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Tesla AutoPilot extension installed or updated", details.reason);
  
  // Initialize on install/update
  await initializeExtension();
  
  // If this is a first install, set default values
  if (details.reason === 'install') {
    await initializeDefaultSettings();
  }
});

/**
 * Initialize default settings for a new installation
 */
async function initializeDefaultSettings() {
  try {
    // Get current region from browser or default to US
    const locale = chrome.i18n ? chrome.i18n.getUILanguage() : 'en-US';
    const region = locale.includes('tr') ? 'TR' : 'US';
    
    // Get default values for the region
    const defaults = {
      region,
      model: 'my',
      condition: 'new',
      priceFloor: region === 'TR' ? '1590000' : '45000',
      pollingInterval: 5,
      defaultsInitialized: true
    };
    
    // Add detailed user info from constants
    const { CONFIG } = await import('./shared/constants.js');
    const regionDefaults = CONFIG.DEFAULT_VALUES[region] || CONFIG.DEFAULT_VALUES.US;
    
    // Save to storage
    await storageService.saveData({
      ...defaults,
      ...regionDefaults,
      defaultsInitialized: true
    });
    
    console.log("Default settings initialized for region:", region);
  } catch (error) {
    console.error("Error initializing default settings:", error);
  }
}

// Initialize the extension on startup
initializeExtension().catch(error => {
  console.error("Error during extension initialization:", error);
});

// Listen for alarm events
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "tesla-inventory-monitor") {
      inventoryMonitorService.checkInventory().catch(error => {
        console.error("Error in global alarm handler:", error);
      });
    }
  });
}

// Export services for easier access in dev tools
self.services = {
  inventoryApiService,
  messageHandlerService,
  inventoryMonitorService,
  storageService
};

// Export a simple log function for debugging
self.logServices = () => {
  console.log("Available services:", Object.keys(self.services));
  return self.services;
};

console.log("Tesla AutoPilot background script loaded!");