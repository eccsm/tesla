/**
 * Tesla Inventory Monitor - Background Script
 */

// === Tesla inventory API offscreen approach (Manifest V3 compatible) =========
// Set up declarativeNetRequest rules for Tesla API headers
function setupDeclarativeNetRequestRules() {
  console.log("Attempting to set up declarativeNetRequest rules for Tesla API");
  const rule = {
    id: 1001,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "Origin", operation: "set", value: "https://www.tesla.com" },
        // { header: "Referer", operation: "set", value: "https://www.tesla.com/inventory" }, // Will be set dynamically in offscreen.js
        { header: "User-Agent", operation: "set", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" },
        { header: "sec-ch-ua", operation: "set", value: "\"Google Chrome\";v=\"123\", \"Chromium\";v=\"123\", \";Not A_Brand\";v=\"99\"" },
        { header: "sec-ch-ua-mobile", operation: "set", value: "?0" },
        { header: "sec-ch-ua-platform", operation: "set", value: "\"Windows\"" },
        { header: "Sec-Fetch-Site", operation: "set", value: "same-origin" },
        { header: "Sec-Fetch-Mode", operation: "set", value: "cors" },
        { header: "Sec-Fetch-Dest", operation: "set", value: "empty" }
      ]
    },
    condition: {
      urlFilter: "*://www.tesla.com/*/inventory/api/v*/inventory-results*",
      resourceTypes: ["xmlhttprequest", "other"]
    }
  };

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: [rule.id],
      addRules: [rule]
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to update declarativeNetRequest rules:", chrome.runtime.lastError.message);
      } else {
        console.log("Successfully updated declarativeNetRequest rules.");
        // Optionally, verify rules by logging them
        chrome.declarativeNetRequest.getDynamicRules((rules) => {
          if (chrome.runtime.lastError) {
            console.error("Failed to get dynamic rules:", chrome.runtime.lastError.message);
          } else {
            console.log("Current dynamic rules:", rules);
          }
        });
      }
    }
  );
}

// Function to ensure the offscreen document is created
async function ensureOffscreen() {
  try {
    // Check if we already have an offscreen document
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      console.log("Offscreen document already exists");
      return;
    }
    
    // Create an offscreen document
    console.log("Creating offscreen document");
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ["DOM_PARSER"],
      justification: "Need context to call Tesla inventory API"
    });
    console.log("Offscreen document created successfully");
  } catch (error) {
    console.error("Error creating offscreen document:", error);
    throw error;
  }
}

// Function to fetch inventory data using the offscreen document
async function offscreenFetchInventory(queryObj) {
  try {
    await ensureOffscreen();
    
    return new Promise((resolve, reject) => {
      const messageListener = (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error in offscreen fetch:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (!response || !response.success) {
          const errorMsg = response?.error || "Unknown error";
          console.error("Error in offscreen fetch:", errorMsg);
          reject(new Error(errorMsg));
          return;
        }
        
        console.log("Offscreen fetch successful, data received");
        resolve(response.data);
      };
      
      console.log("Sending message to offscreen document", queryObj);
      chrome.runtime.sendMessage(
        {
          target: "offscreen",
          action: "fetchInventory",
          query: queryObj
        },
        messageListener
      );
    });
  } catch (error) {
    console.error("Error setting up offscreen fetch:", error);
    throw error;
  }
}
// ========================================================================

// --- Inline CONFIG, Storage, and Inventory API logic for Manifest V3 compatibility ---

const CONFIG = {
    API: {
        TIMEOUT: 30000,
        MAX_RETRIES: 3,
        ENDPOINTS: {
            // Updated API endpoint URLs to v4
            INVENTORY: 'https://www.tesla.com/inventory/api/v4/inventory-results',
            ORDER: 'https://www.tesla.com/inventory/api/v1/orders'
        }
    },
    REGIONS: {
        TR: {
            baseUrl: 'https://www.tesla.com/tr_tr',
            currency: 'TRY',
            language: 'tr',
            dateFormat: 'DD.MM.YYYY'
        },
        US: {
            baseUrl: 'https://www.tesla.com/en_us',
            currency: 'USD',
            language: 'en',
            dateFormat: 'MM/DD/YYYY'
        }
    },
    MODELS: {
        ms: 'Model S', m3: 'Model 3', mx: 'Model X', my: 'Model Y', ct: 'Cybertruck'
    },
    TRIMS: {
        PAWD: 'Performance All-Wheel Drive',
        LRAWD: 'Long Range All-Wheel Drive',
        LRRWD: 'Long Range Rear-Wheel Drive'
    },
    DEFAULT_VALUES: {
        TR: { zip: '34000', range: 100, priceMin: '1590000', priceMax: '3500000' },
        US: { zip: '94043', range: 200, priceMin: '45000', priceMax: '100000' }
    }
};

const storageService = {
    storage: chrome.storage.local,
    async initialize() { return this; },
    async getData(key) { return (await this.storage.get(key))[key]; },
    async saveData(data) { await this.storage.set(data); },
    async removeData(keys) { await this.storage.remove(keys); },
    async clearData() { await this.storage.clear(); },
    async getAllData() { return await this.storage.get(null); },
    async saveFormData(formData) { await this.saveData({ formData }); },
    async getFormData() { return (await this.getData('formData')) || {}; },
    async saveLastSearch(results) { await this.saveData({ lastSearch: results }); },
    async getLastSearch() { return (await this.getData('lastSearch')) || null; },
    async saveSettings(settings) { await this.saveData({ settings }); },
    async getSettings() { return (await this.getData('settings')) || {}; },
    async addToWatchList(vehicle) {
        const watchList = (await this.getData('watchList')) || [];
        if (!watchList.some(v => v.vin === vehicle.vin)) {
            watchList.push({ ...vehicle, addedAt: new Date().toISOString() });
            await this.saveData({ watchList });
        }
    },
    async removeFromWatchList(vin) {
        const watchList = (await this.getData('watchList')) || [];
        await this.saveData({ watchList: watchList.filter(v => v.vin !== vin) });
    },
    async getWatchList() { return (await this.getData('watchList')) || []; }
};

function formatPrice(price, currency = 'USD') {
    if (!price) return '';
    const formatter = new Intl.NumberFormat(currency === 'TRY' ? 'tr-TR' : 'en-US', {
        style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0
    });
    return formatter.format(price);
}

function withRetry(fn, options = {}) {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
    let lastError;
    return new Promise(async (resolve, reject) => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try { 
                return resolve(await fn()); 
            } catch (error) {
                lastError = error;
                
                // Skip retries for certain error conditions
                if (error.noRetry || 
                   (error.status && (error.status === 400 || error.status === 404))) {
                    console.log(`withRetry: Skipping retry for error:`, error);
                    return reject(error);
                }
                
                if (attempt === maxRetries) {
                    return reject(error);
                }
                
                const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay) + Math.random() * 1000;
                console.log(`withRetry: Attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${Math.round(delay)}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        reject(lastError);
    });
}

// ZIP code to lat/lng mappings for common locations
const zipCodeCache = {
    // US Examples
    '94043': { lat: 37.4030, lng: -122.0326 }, // Mountain View
    '10001': { lat: 40.7501, lng: -73.9970 }, // New York
    
    // Turkey Examples
    '34000': { lat: 41.0082, lng: 28.9784 }, // Istanbul
    '06000': { lat: 39.9208, lng: 32.8541 }  // Ankara
};

/**
 * Inventory API Service with adapters for handling API changes
 * This serves as an abstraction layer to gracefully handle Tesla API evolution
 */
const inventoryApiService = {
    lastSearchResults: { totalMatches: 0, searchDate: null, results: [], page: 1, count: 50 },
    apiVersion: 'v1',  // Track API version for potential future changes
    
    // Map of current parameter names to possible future names
    // This allows us to quickly adapt if Tesla renames parameters
    parameterMap: {
        'super_region': ['super_region', 'sup_region', 'superRegion', 'region_group'],
        'market': ['market', 'region', 'country_code'],
        'arrangeby': ['arrangeby', 'arrange_by', 'sort_by', 'orderBy']
        // Add more mappings as parameters potentially change
    },
    
    // Initialize the service
    async initialize() { 
        // Check if the API is accessible and determine current parameter names
        // For now, we'll use default parameter names
        return this; 
    },
    
    // Adapter function to handle parameter changes over time
    adaptFilters(filters) {
        // For now, just return a copy of the filters
        // In future, this could adapt parameter names based on API version
        return { ...filters };
    },
    
    // Get coordinates for a ZIP code with caching
    async getCoordinates(zipCode, region) {
        // Return from cache if available
        if (zipCodeCache[zipCode]) {
            return zipCodeCache[zipCode];
        }
        
        // For now, return default coordinates for the region
        // In a production app, you'd implement geocoding here
        return region === 'TR' 
            ? { lat: 41.0082, lng: 28.9784 }  // Istanbul default
            : { lat: 37.4030, lng: -122.0326 }; // Mountain View default
    },
    
    async fetchInventory(filters = {}) {
        try {
            console.log('Using offscreen approach to fetch inventory data');
            
            const count = filters.count || 50;
            const offset = filters.offset || 0;
            
            // Construct the query object exactly as Tesla's website does
            const queryObj = {
                query: {
                    model: filters.model || 'my',
                    condition: filters.condition || 'new',
                    options: {},
                    arrangeby: 'Price',
                    order: 'asc',
                    market: filters.region || 'US',
                    language: 'en',
                    super_region: 'north america',
                    lng: -122.150583,
                    lat: 37.459525,
                    zip: filters.zip || '94043',
                    range: filters.region === 'TR' ? 100 : 200,
                    region: 'CA',
                    isFalconDeliverySelectionEnabled: false
                },
                offset: offset,
                count: count,
                outsideOffset: 0,
                outsideSearch: false,
                version: 4
            };
            
            // Add any custom options
            if (filters.options) {
                Object.assign(queryObj, filters.options);
            }
            
            // Log this inventory check attempt
            logBackgroundEvent('inventory_fetch_attempt', { 
                endpoint: CONFIG.API.ENDPOINTS.INVENTORY,
                filters: queryObj
            });
            
            // Use the offscreen document to make the request
            // This ensures all the proper headers are included
            const data = await offscreenFetchInventory(queryObj);
            
            // Log the successful response
            console.log('Tesla API response received via offscreen document');
            
            // Log the structure of the response for debugging
            logBackgroundEvent('inventory_response_received', { 
                structure: Object.keys(data),
                totalMatches: data.total_matches_found || data.totalMatchesFound || 0,
                resultsCount: (data.results || data.inventory_results || []).length
            });
            
            // Handle both old and new API response formats
            const results = data.results || data.inventory_results || [];
            const totalMatches = data.total_matches_found || data.totalMatchesFound || results.length || 0;
            
            this.lastSearchResults = {
                totalMatches: totalMatches,
                searchDate: new Date().toISOString(),
                page: Math.floor(offset / count) + 1,
                count: count,
                offset: offset,
                results: results.map(vehicle => ({
                    vin: vehicle.vin,
                    year: vehicle.year || new Date().getFullYear().toString(),
                    model: CONFIG.MODELS[vehicle.model] || vehicle.model,
                    trim: CONFIG.TRIMS[vehicle.trim] || vehicle.trim,
                    price: formatPrice(vehicle.price, (CONFIG.REGIONS[filters.region || 'US'] || {}).currency),
                    range: vehicle.range, 
                    acceleration: vehicle.acceleration,
                    color: vehicle.color, 
                    wheels: vehicle.wheels, 
                    interior: vehicle.interior,
                    location: vehicle.location || 'Unknown',
                    lastSeen: new Date().toISOString()
                }))
            };
            
            return this.lastSearchResults;
        } catch (error) {
            console.error('Error fetching inventory:', error);
            return { 
                totalMatches: 0, 
                searchDate: new Date().toISOString(), 
                results: [], 
                error: error.message || 'Unknown error',
                page: 1,
                count: filters.count || 50,
                offset: filters.offset || 0
            };
        }
    }
};

// Initialize services
async function initializeExtension() {
    console.log('Starting Tesla Inventory Monitor initialization...');
    
    try {
        // Initialize services in order
        await storageService.initialize();
        console.log('Storage service initialized');
        
        await inventoryApiService.initialize();
        console.log('Inventory API service initialized');
        
        console.log('Tesla Inventory Monitor fully initialized!');
    } catch (error) {
        console.error('Error during service initialization:', error);
        throw error;
    }
}

// Set up installation and update handler
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Tesla Inventory Monitor installed or updated:', details.reason);
    
    // Set up declarativeNetRequest rules for Tesla API headers
    setupDeclarativeNetRequestRules();
    
    await initializeExtension();
    
    if (details.reason === 'install') {
        await initializeDefaultSettings();
    }
});

// Initialize default settings
async function initializeDefaultSettings() {
    try {
        const locale = chrome.i18n?.getUILanguage() || 'en-US';
        const region = locale.includes('tr') ? 'TR' : 'US';
        
        const defaults = {
            region,
            model: 'my',
            condition: 'new',
            ...CONFIG.DEFAULT_VALUES[region]
        };
        
        await storageService.saveSettings(defaults);
        console.log('Default settings initialized for region:', region);
    } catch (error) {
        console.error('Error initializing default settings:', error);
    }
}

// Add comprehensive logging system for monitoring and debugging
const sessionLog = [];
const MAX_SESSION_LOGS = 200;  // Session log size limit
const MAX_STORAGE_LOGS = 1000; // Storage log size limit

/**
 * Enhanced logging system that supports both in-memory session logs and persisted logs
 * 1. All logs are kept in memory for the current session
 * 2. Important logs (monitoring_*, inventory_*, error_*) are also stored in chrome.storage
 * 3. Methods are provided to access, filter, and export logs
 */
function logBackgroundEvent(eventType, details) {
    // Get extension version for logging
    const version = chrome.runtime.getManifest().version;
    
    const logEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        timestamp: new Date().toISOString(),
        version,
        eventType,
        details
    };
    
    // Add to in-memory session logs
    sessionLog.push(logEntry);
    if (sessionLog.length > MAX_SESSION_LOGS) sessionLog.shift();
    
    // Determine if this log should be persisted to storage
    const isPersistentLogType = 
        eventType.startsWith('monitoring_') || 
        eventType.startsWith('inventory_') || 
        eventType.startsWith('error_') || 
        eventType === 'api_auth_required' || 
        eventType === 'fetch_inventory_success' || 
        eventType === 'fetch_inventory_error';
    
    if (isPersistentLogType) {
        // Store important logs to chrome.storage.local
        chrome.storage.local.get(['monitoringLogs'], (data) => {
            const logs = data.monitoringLogs || [];
            logs.push(logEntry);
            
            // Limit size by keeping the newest logs
            if (logs.length > MAX_STORAGE_LOGS) {
                logs.splice(0, logs.length - MAX_STORAGE_LOGS);
            }
            
            chrome.storage.local.set({ monitoringLogs: logs });
        });
    }
    
    return logEntry;
}

/**
 * Get monitoring logs with optional filtering
 * @param {Object} options - Filter options
 * @param {string} options.type - Filter by event type
 * @param {string} options.startDate - Filter by start date
 * @param {string} options.endDate - Filter by end date
 * @param {number} options.limit - Max number of logs to return
 * @returns {Promise<Array>} - Filtered logs
 */
async function getMonitoringLogs(options = {}) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['monitoringLogs'], (data) => {
            let logs = data.monitoringLogs || [];
            
            // Apply filters
            if (options.type) {
                logs = logs.filter(log => log.eventType.includes(options.type));
            }
            
            if (options.startDate) {
                const startDate = new Date(options.startDate).getTime();
                logs = logs.filter(log => new Date(log.timestamp).getTime() >= startDate);
            }
            
            if (options.endDate) {
                const endDate = new Date(options.endDate).getTime();
                logs = logs.filter(log => new Date(log.timestamp).getTime() <= endDate);
            }
            
            // Sort by timestamp (newest first)
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Apply limit
            if (options.limit && options.limit > 0) {
                logs = logs.slice(0, options.limit);
            }
            
            resolve(logs);
        });
    });
}

/**
 * Clear monitoring logs
 * @param {boolean} clearAll - If true, clears all logs; if false, keeps last 24 hours
 * @returns {Promise<boolean>} - Success
 */
async function clearMonitoringLogs(clearAll = false) {
    return new Promise((resolve) => {
        if (clearAll) {
            chrome.storage.local.set({ monitoringLogs: [] }, () => {
                resolve(true);
            });
        } else {
            chrome.storage.local.get(['monitoringLogs'], (data) => {
                const logs = data.monitoringLogs || [];
                const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
                const recentLogs = logs.filter(log => log.timestamp >= oneDayAgo);
                chrome.storage.local.set({ monitoringLogs: recentLogs }, () => {
                    resolve(true);
                });
            });
        }
    });
}

/**
 * Export monitoring logs to JSON string
 * @returns {Promise<string>} - JSON string of logs
 */
async function exportMonitoringLogs() {
    const logs = await getMonitoringLogs();
    return JSON.stringify(logs, null, 2);
}

// Handle robust message response with error handling
function safeResponse(sendResponse, data) {
    try {
        sendResponse(data);
    } catch (err) {
        console.warn('Background: Error sending response:', err.message);
        // Store response for retry if needed
        chrome.storage.local.set({
            lastResponse: {
                data,
                timestamp: Date.now(),
                error: err.message
            }
        });
    }
}

/**
 * Unified handler for inventory fetch requests. 
 * This is the ONLY implementation of handleFetchInventory.
 */
async function handleFetchInventory(filters) {
    try {
        console.log('Background: Handling fetchInventory request with filters:', filters);
        
        // Log the request for debugging
        logBackgroundEvent('fetch_inventory_request', { filters });
        
        // Prepare filters with the adapter to handle future API changes
        const adaptedFilters = inventoryApiService.adaptFilters(filters);

        // Fetch inventory using the API service with adaptable filters
        const results = await inventoryApiService.fetchInventory(adaptedFilters);
        
        // Save results to storage for history/caching
        await storageService.saveLastSearch(results);
        
        // Log success/failure with more detailed information
        if (results.error) {
            logBackgroundEvent('inventory_fetch_error', { 
                error: results.error,
                filters: filters,
                timestamp: new Date().toISOString(),
                requestId: Date.now().toString(36)
            });
            return { success: false, error: results.error };
        }
        
        // Log successful inventory fetch with comprehensive details
        logBackgroundEvent('inventory_fetch_success', { 
            totalMatches: results.totalMatches,
            resultCount: results.results?.length || 0,
            page: results.page,
            totalPages: Math.ceil(results.totalMatches / results.count) || 1,
            filters: filters,
            region: filters.region || 'US',
            model: filters.model || 'unknown',
            foundVehicles: results.results?.length > 0,
            firstVehicleVin: results.results?.[0]?.vin || null,
            timestamp: results.searchDate
        });
        
        // Process vehicle data for display
        const vehicles = results.results?.map(vehicle => ({
            // Transform any data as needed
            ...vehicle,
            year: vehicle.year || new Date().getFullYear().toString(),
            price: vehicle.price,
            location: vehicle.location || 'Unknown',
            url: `${CONFIG.REGIONS[filters.region || 'US'].baseUrl}/inventory/used/${vehicle.model}/${vehicle.vin}`
        }));
        
        return { 
            success: true, 
            totalMatches: results.totalMatches, 
            vehicles: vehicles || [],
            searchDate: results.searchDate,
            page: results.page,
            count: results.count,
            offset: results.offset,
            totalPages: Math.ceil(results.totalMatches / results.count) || 1
        };
    } catch (error) {
        console.error('Background: Error in handleFetchInventory:', error);
        logBackgroundEvent('fetch_inventory_exception', { error: error.message });
        return { success: false, error: error.message };
    }
}

// SINGLE unified message handler for all messages - this is the ONLY message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Track request receipt
    const logEntry = logBackgroundEvent('message_received', { 
        action: message.action, 
        sender: sender.id, 
        requestId: message.requestId || 'none',
        tabId: sender.tab?.id
    });
    
    console.log('Background received message:', message);
    
    // Handle different message types
    switch (message.action) {
        case 'fetchInventory':
            handleFetchInventory(message.filters).then(sendResponse);
            return true;
            
        case 'getFormData':
            handleGetFormData().then(sendResponse);
            return true;
            
        case 'saveFormData':
            handleSaveFormData(message.data).then(sendResponse);
            return true;
            
        case 'clearData':
            handleClearData().then(sendResponse);
            return true;
            
        case 'addToWatchList':
            handleAddToWatchList(message.vehicle).then(sendResponse);
            return true;
            
        case 'removeFromWatchList':
            handleRemoveFromWatchList(message.vin).then(sendResponse);
            return true;
            
        case 'navigateToUrl':
            if (message.tabId && message.url) {
                handleNavigateToUrl(message.tabId, message.url).then(sendResponse);
            } else {
                console.error("Background: navigateToUrl message missing tabId or url", message);
                sendResponse({ success: false, error: "Missing tabId or url in navigateToUrl message" });
            }
            return true;
            
        // Auto-fill handler for order form
        case 'fillAccountDetails':
            handleFillAccountDetails(message.tabId).then(sendResponse);
            return true;
            
        // Save account details handler
        case 'saveAccountDetails':
            handleSaveAccountDetails(message.accountDetails).then(sendResponse);
            return true;
            
        // Get account details handler
        case 'getAccountDetails':
            handleGetAccountDetails().then(sendResponse);
            return true;
            
        // Get current tab ID for content script navigation
        case 'getCurrentTabId':
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs.length > 0 && tabs[0].id) {
                    console.log('Background: Providing current tab ID:', tabs[0].id);
                    sendResponse({ success: true, tabId: tabs[0].id });
                } else {
                    console.error('Background: Could not determine current tab ID');
                    sendResponse({ success: false, error: 'Could not determine current tab ID' });
                }
            });
            return true;
        case 'startMonitoring':
            console.log('Background: Received startMonitoring with settings:', message.settings);
            logBackgroundEvent('monitoring_start_requested', { 
                settings: message.settings,
                requestId: message.requestId || 'none'
            });
            
            if (message.settings && message.settings.pollInterval) {
                // Save settings for the alarm to use - with tracking info
                chrome.storage.local.set({ 
                    monitoringSettings: { ...message.settings, isActive: true },
                    lastBackgroundAction: {
                        action: 'startMonitoring',
                        timestamp: Date.now(),
                        requestId: message.requestId || Date.now().toString(),
                        status: 'processing'
                    }
                }, () => {
                    try {
                        // Create alarm for periodic inventory check
                        const minutes = message.settings.pollInterval;
                        chrome.alarms.create('inventoryCheck', { periodInMinutes: minutes });
                        
                        // Update status to success
                        chrome.storage.local.set({
                            lastBackgroundAction: {
                                action: 'startMonitoring',
                                timestamp: Date.now(),
                                requestId: message.requestId || Date.now().toString(),
                                status: 'success'
                            }
                        });
                        
                        // Safely respond to sender
                        safeResponse(sendResponse, { success: true });
                        
                        // Log success
                        logBackgroundEvent('monitoring_started', { 
                            pollInterval: minutes,
                            requestId: message.requestId || 'none'
                        });
                    } catch (err) {
                        console.error('Background: Error creating alarm:', err);
                        
                        // Update status to error
                        chrome.storage.local.set({
                            lastBackgroundAction: {
                                action: 'startMonitoring',
                                timestamp: Date.now(),
                                requestId: message.requestId || Date.now().toString(),
                                status: 'error',
                                error: err.message
                            }
                        });
                        
                        safeResponse(sendResponse, { success: false, error: 'Error creating alarm: ' + err.message });
                    }
                });
            } else {
                safeResponse(sendResponse, { success: false, error: 'Missing settings or pollInterval for startMonitoring.' });
                
                // Log error
                logBackgroundEvent('monitoring_start_error', { 
                    reason: 'Missing settings or pollInterval',
                    requestId: message.requestId || 'none'
                });
            }
            return true; // Async due to storageService and alarm creation

        case 'stopMonitoring':
            console.log('Background: Received stopMonitoring.');
            logBackgroundEvent('monitoring_stop_requested', { 
                requestId: message.requestId || 'none'
            });
            
            // First update status to show we're processing the request
            chrome.storage.local.set({
                lastBackgroundAction: {
                    action: 'stopMonitoring',
                    timestamp: Date.now(),
                    requestId: message.requestId || Date.now().toString(),
                    status: 'processing'
                }
            }, () => {
                try {
                    chrome.alarms.clear('inventoryCheck', (wasCleared) => {
                        if (chrome.runtime.lastError) {
                            console.error('Background: Error clearing alarm:', chrome.runtime.lastError.message);
                            
                            // Update status to error
                            chrome.storage.local.set({
                                lastBackgroundAction: {
                                    action: 'stopMonitoring',
                                    timestamp: Date.now(),
                                    requestId: message.requestId || Date.now().toString(),
                                    status: 'error',
                                    error: chrome.runtime.lastError.message
                                }
                            });
                            
                            safeResponse(sendResponse, { 
                                success: false, 
                                error: chrome.runtime.lastError.message 
                            });
                            return;
                        }
                        
                        chrome.storage.local.get(['monitoringSettings'], (data) => {
                            const currentSettings = data.monitoringSettings || {};
                            chrome.storage.local.set({ 
                                monitoringSettings: { ...currentSettings, isActive: false },
                                lastBackgroundAction: {
                                    action: 'stopMonitoring',
                                    timestamp: Date.now(),
                                    requestId: message.requestId || Date.now().toString(),
                                    status: 'success'
                                }
                            }, () => {
                                console.log('Background: Monitoring stopped successfully.');
                                safeResponse(sendResponse, { success: true });
                                
                                // Log successful stop
                                logBackgroundEvent('monitoring_stopped', { 
                                    requestId: message.requestId || 'none'
                                });
                            });
                        });
                    });
                } catch (err) {
                    console.error('Background: Exception during stopMonitoring:', err);
                    
                    // Update status to error
                    chrome.storage.local.set({
                        lastBackgroundAction: {
                            action: 'stopMonitoring',
                            timestamp: Date.now(),
                            requestId: message.requestId || Date.now().toString(),
                            status: 'error',
                            error: err.message
                        }
                    });
                    
                    safeResponse(sendResponse, { 
                        success: false, 
                        error: 'Exception during stopMonitoring: ' + err.message 
                    });
                }
            });
            return true; // Async due to alarm clearing and storage

        default:
            console.log('Background: Received unhandled action:', message.action);
            // sendResponse({ success: false, error: `Unhandled action: ${message.action}` });
            // It's often better not to respond to unknown actions unless specifically required.
            return false; // No async response planned for unknown actions
    }
});

// New handler for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'logEvent') {
        // Store logs from content script
        const event = message.event || {};
        logBackgroundEvent('content_script_event', event);
        sendResponse({ success: true });
        return true;
    }
});

// --- Alarm Handler with better error handling ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'inventoryCheck') {
        console.log('Background: inventoryCheck alarm triggered at', new Date().toLocaleTimeString());
        const settings = await storageService.getData('monitoringSettings');
        if (settings && settings.model && settings.condition) {
            console.log('Background: Performing scheduled inventory check with settings:', settings);
            try {
                const filters = {
                    model: settings.model,
                    condition: settings.condition,
                    zip: settings.zip,
                    market: settings.region === 'US' ? 'US' : (settings.region === 'TR' ? 'TR' : 'US'), // default to US if not TR
                    language: settings.region === 'TR' ? 'tr' : 'en',
                    currency: settings.region === 'TR' ? 'TRY' : 'USD',
                    price: settings.price // Assuming this is maxPrice
                    // Add other relevant filters from 'settings' if needed by fetchInventory
                };
                const results = await inventoryApiService.fetchInventory(filters);
                console.log(`Background: Scheduled check found ${results.totalMatches} vehicles.`);
                await storageService.saveData({ lastAlarmCheckResults: results, lastAlarmCheckTimestamp: new Date().toISOString() });

                // Basic notification logic (can be expanded)
                // This requires 'notifications' permission in manifest.json
                // And ideally, a check to see if the user actually wants notifications from settings.
                if (results.totalMatches > 0) {
                    // Check against previous results or specific criteria before notifying
                    // For now, just a generic notification if new inventory is found
                    // This is a very basic example. A real app would compare with previous state.
                    chrome.notifications.create(`inventoryNotification_${Date.now()}`, {
                        type: 'basic',
                        iconUrl: 'icons/icon128.png', // Make sure you have this icon
                        title: 'Tesla Inventory Alert!',
                        message: `${results.totalMatches} vehicles matching your criteria found. Check the extension popup.`,
                        priority: 2
                    });
                }
            } catch (error) {
                console.error('Background: Error during scheduled inventory check:', error);
            }
        } else {
            console.warn('Background: inventoryCheck alarm fired, but no valid monitoring settings found. Stopping alarm.');
            chrome.alarms.clear('inventoryCheck');
            await storageService.removeData(['monitoringSettings']);
        }
    }
});

// Message handlers
async function handleFetchInventory(filters) {
    try {
        const results = await inventoryApiService.fetchInventory(filters);
        await storageService.saveLastSearch(results);
        return { success: true, data: results };
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return { success: false, error: error.message };
    }
}

async function handleGetFormData() {
    try {
        const formData = await storageService.getFormData();
        return { success: true, data: formData };
    } catch (error) {
        console.error('Error getting form data:', error);
        return { success: false, error: error.message };
    }
}

async function handleSaveFormData(data) {
    try {
        await storageService.saveFormData(data);
        return { success: true };
    } catch (error) {
        console.error('Error saving form data:', error);
        return { success: false, error: error.message };
    }
}

async function handleClearData() {
    try {
        await storageService.clearData();
        return { success: true };
    } catch (error) {
        console.error('Error clearing data:', error);
        return { success: false, error: error.message };
    }
}

async function handleAddToWatchList(vehicle) {
    try {
        await storageService.addToWatchList(vehicle);
        return { success: true };
    } catch (error) {
        console.error('Error adding to watch list:', error);
        return { success: false, error: error.message };
    }
}

async function handleRemoveFromWatchList(vin) {
    try {
        await storageService.removeFromWatchList(vin);
        return { success: true };
    } catch (error) {
        console.error('Error removing from watch list:', error);
        return { success: false, error: error.message };
    }
}

async function handleNavigateToUrl(tabId, url) {
    try {
        if (typeof tabId !== 'number' || typeof url !== 'string' || !url.startsWith('http')) {
            console.error('Background: Invalid arguments for handleNavigateToUrl.', { tabId, url });
            return { success: false, error: 'Invalid tabId or URL provided for navigation.' };
        }

        console.log(`Background: Attempting to navigate tab ${tabId} to ${url}`);
        
        const updatedTab = await new Promise((resolve, reject) => {
            chrome.tabs.update(tabId, { url: url }, (tab) => {
                if (chrome.runtime.lastError) {
                    // Log the full error for better diagnostics
                    console.error(`Background: chrome.tabs.update failed for tab ${tabId} to url ${url}:`, chrome.runtime.lastError);
                    return reject(new Error(chrome.runtime.lastError.message)); // Ensure an Error object is rejected
                }
                if (!tab) {
                    // This case might occur if the tab was closed just before update, or if tabId is invalid
                    console.warn(`Background: chrome.tabs.update for tab ${tabId} did not return a tab object. URL: ${url}. This might happen if the tab was closed or doesn't exist.`);
                    return reject(new Error('Tab not found or could not be updated. It might have been closed.'));
                }
                resolve(tab);
            });
        });

        console.log(`Background: Successfully navigated tab ${updatedTab.id}. New URL: ${updatedTab.url}. Status: ${updatedTab.status}`);
        return { success: true, tabId: updatedTab.id, newUrl: updatedTab.url, status: updatedTab.status };

    } catch (error) {
        // Catch any error from the promise or other synchronous parts
        console.error('Background: Error in handleNavigateToUrl:', error);
        return { success: false, error: error.message || 'An unknown error occurred during navigation.' };
    }
}

// Initialize on startup
initializeExtension().catch(error => {
    console.error('Error during extension initialization:', error);
});

// Register handler for fetching monitoring logs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getMonitoringLogs') {
        getMonitoringLogs(message.options).then(logs => {
            sendResponse({ success: true, logs });
        });
        return true;
    }
    if (message.action === 'clearMonitoringLogs') {
        clearMonitoringLogs(message.clearAll).then(success => {
            sendResponse({ success });
        });
        return true;
    }
    if (message.action === 'exportMonitoringLogs') {
        exportMonitoringLogs().then(jsonString => {
            sendResponse({ success: true, data: jsonString });
        });
        return true;
    }
});

// Export services and utilities for debugging
self.services = {
    inventoryApiService,
    storageService,
    monitoringLogs: {
        getLogs: getMonitoringLogs,
        clearLogs: clearMonitoringLogs,
        exportLogs: exportMonitoringLogs
    }
};

// Export logs for debugging
self.sessionLog = sessionLog;

/**
 * Handlers for account details (auto-fill feature)
 */

// Save account details to storage
async function handleSaveAccountDetails(accountDetails) {
    try {
        if (!accountDetails) {
            return { success: false, error: 'No account details provided' };
        }
        
        // Validate the account details
        const { firstName, lastName, email, phone, countryCode } = accountDetails;
        
        // Basic validation to ensure required fields are present
        if (!firstName || !lastName || !email) {
            return { success: false, error: 'Missing required fields (firstName, lastName, email)' };
        }
        
        // Store in chrome.storage.local
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ accountDetails }, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(result);
            });
        });
        
        logBackgroundEvent('account_details_saved', { 
            firstName, lastName, 
            emailMask: email ? `${email.substring(0, 2)}...${email.split('@')[1] || ''}` : null
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error saving account details:', error);
        return { success: false, error: error.message };
    }
}

// Get account details from storage
async function handleGetAccountDetails() {
    try {
        const accountDetails = await new Promise((resolve) => {
            chrome.storage.local.get(['accountDetails'], (result) => {
                resolve(result.accountDetails || {});
            });
        });
        
        return { success: true, accountDetails };
    } catch (error) {
        console.error('Error retrieving account details:', error);
        return { success: false, error: error.message };
    }
}

// Fill account details on the order form
async function handleFillAccountDetails(tabId) {
    try {
        // Check if we have a valid tab ID
        if (!tabId) {
            return { success: false, error: 'No tab ID provided' };
        }
        
        // Get account details from storage
        const accountDetails = await new Promise((resolve) => {
            chrome.storage.local.get(['accountDetails'], (result) => {
                resolve(result.accountDetails || {});
            });
        });
        
        // Verify we have data to fill
        if (!accountDetails || !accountDetails.firstName) {
            return { success: false, error: 'No account details found to auto-fill' };
        }
        
        // Execute content script to fill the form
        await new Promise((resolve, reject) => {
            chrome.tabs.executeScript(tabId, {
                code: `
                    (function() {
                        // Data to fill
                        const data = ${JSON.stringify(accountDetails)};
                        
                        // Fill first name
                        const firstNameField = document.querySelector('input#FIRST_NAME');
                        if (firstNameField) firstNameField.value = data.firstName;
                        
                        // Fill last name
                        const lastNameField = document.querySelector('input#LAST_NAME');
                        if (lastNameField) lastNameField.value = data.lastName;
                        
                        // Fill email
                        const emailField = document.querySelector('input#EMAIL');
                        if (emailField) emailField.value = data.email;
                        
                        // Fill email confirmation
                        const emailConfirmField = document.querySelector('input#EMAIL_CONFIRM');
                        if (emailConfirmField) emailConfirmField.value = data.email;
                        
                        // Fill phone number (handling country code dropdown is complex)
                        const phoneField = document.querySelector('input[type="tel"]');
                        if (phoneField) phoneField.value = data.phone;
                        
                        // Try to select country code if possible
                        if (data.countryCode) {
                            // This is more complex and might need a more robust solution
                            // depending on Tesla's form implementation
                            const countryDropdown = document.querySelector('button.tds-dropdown-trigger');
                            if (countryDropdown) {
                                // This is a simplified approach - might need adjustment
                                countryDropdown.click();
                                setTimeout(() => {
                                    const countryOption = document.querySelector('[data-value="' + data.countryCode + '"]');
                                    if (countryOption) countryOption.click();
                                }, 500);
                            }
                        }
                        
                        // Dispatch input events to trigger any form validation
                        const fields = [firstNameField, lastNameField, emailField, emailConfirmField, phoneField];
                        fields.forEach(field => {
                            if (field) {
                                field.dispatchEvent(new Event('input', { bubbles: true }));
                                field.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                        
                        return { 
                            filledFields: fields.filter(f => f).length,
                            success: fields.some(f => f)
                        };
                    })();
                `
            }, (results) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                
                if (!results || !results[0]) {
                    reject(new Error('No results from form filling script'));
                    return;
                }
                
                resolve(results[0]);
            });
        });
        
        logBackgroundEvent('account_details_filled', { tabId });
        
        return { success: true, message: 'Form auto-fill attempted' };
    } catch (error) {
        console.error('Error auto-filling account details:', error);
        return { success: false, error: error.message };
    }
}

// Handle port connections and disconnections to track page visibility
chrome.runtime.onConnect.addListener((port) => {
    console.log(`Background: Port connected: ${port.name}`);
    logBackgroundEvent('port_connected', { portName: port.name });
    
    port.onDisconnect.addListener(() => {
        console.log(`Background: Port disconnected: ${port.name}`);
        logBackgroundEvent('port_disconnected', { 
            portName: port.name,
            reason: chrome.runtime.lastError?.message || 'normal disconnect'
        });
    });
});

// Track when extension pages are navigated away from
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    logBackgroundEvent('tab_removed', { tabId, windowId: removeInfo.windowId });
});

// Use alarms API for background heartbeat instead of setInterval
// This is more efficient and won't keep Chrome awake on laptops
chrome.alarms.create('backgroundHeartbeat', { periodInMinutes: 1 });

// Handle the heartbeat alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'backgroundHeartbeat') {
        chrome.storage.local.get(['monitoringSettings'], (data) => {
            if (data.monitoringSettings?.isActive) {
                // Update heartbeat timestamp to show background is alive
                chrome.storage.local.set({
                    backgroundHeartbeat: Date.now()
                });
                
                logBackgroundEvent('background_heartbeat', {
                    timestamp: new Date().toISOString(),
                    monitoringActive: true
                });
            }
        });
    }
});
