/**
 * Enhanced Tesla Inventory Service
 * 
 * Fixed Background Service Worker with proper initialization
 */

// Define Tesla Inventory Service
const TeslaInventoryService = {
  // Base API URL for inventory
  API_URL: "https://www.tesla.com/inventory/api/v1/inventory-results",
  
  // Region-specific configurations with detailed settings
  REGION_CONFIGS: {
    US: {
      baseUrl: "https://www.tesla.com",
      currencySymbol: "$",
      defaultZip: "98052", // Redmond, WA
      language: "en",
      market: "US",
      super_region: "north america",
      numberFormat: 'en-US'
    },
    TR: {
      baseUrl: "https://www.tesla.com/tr_TR",
      currencySymbol: "₺",
      defaultZip: "34000", // Istanbul
      language: "tr",
      market: "TR",
      super_region: "europe",
      numberFormat: 'tr-TR'
    }
    // Can add more regions as needed: DE, FR, GB, etc.
  },
  
  // Comprehensive model configurations
  MODELS: {
    m3: {
      displayName: "Model 3",
      trims: [
        { code: "MRRWD", name: "RWD" },
        { code: "LRRWD", name: "Long Range RWD" },
        { code: "LRAWD", name: "Long Range AWD" },
        { code: "PERFORMANCE", name: "Performance" }
      ]
    },
    my: {
      displayName: "Model Y",
      trims: [
        { code: "MRRWD", name: "RWD" },
        { code: "LRRWD", name: "Long Range RWD" },
        { code: "LRAWD", name: "Long Range AWD" },
        { code: "PERFORMANCE", name: "Performance" }
      ]
    },
    ms: {
      displayName: "Model S",
      trims: [
        { code: "LRAWD", name: "Long Range" },
        { code: "PLAID", name: "Plaid" }
      ]
    },
    mx: {
      displayName: "Model X",
      trims: [
        { code: "LRAWD", name: "Long Range" },
        { code: "PLAID", name: "Plaid" }
      ]
    }
  },
  
  // Autopilot options
  AUTOPILOT_OPTIONS: [
    { code: "AUTOPILOT_FULL_SELF_DRIVING", name: "Full Self-Driving" },
    { code: "AUTOPILOT_ENHANCED", name: "Enhanced Autopilot" },
    { code: "AUTOPILOT_STANDARD", name: "Autopilot" }
  ],
  
  // Storage for last results
  lastSearchResults: {
    totalLocalMatches: 0,
    totalOutsideMatches: 0,
    totalFiltered: 0,
    searchDate: null,
    results: []
  },
  
  /**
   * Initialize the service
   */
  initialize() {
    console.log('Tesla Inventory Service initialized');
    return this;
  },
  
  /**
   * Create a safe fetch function with timeout and retry capability
   */
  async safeFetch(url, options = {}, timeout = 10000, retries = 2) {
    return new Promise(async (resolve, reject) => {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        // Add signal to options
        const fetchOptions = {
          ...options,
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...(options.headers || {})
          }
        };
        
        // Attempt fetch
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        
        // Check if response is ok
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        
        resolve(response);
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle abort error
        if (error.name === 'AbortError') {
          console.warn(`Request timeout for ${url}`);
        }
        
        // Retry logic
        if (retries > 0) {
          console.log(`Retrying fetch for ${url}, ${retries} retries left`);
          try {
            const result = await this.safeFetch(url, options, timeout, retries - 1);
            resolve(result);
          } catch (retryError) {
            reject(retryError);
          }
        } else {
          reject(error);
        }
      }
    });
  },
  
  /**
   * Fetch inventory data with advanced filters
   */
  async fetchInventory(filters = {}) {
    try {
      // Set default filters
      const defaultFilters = {
        region: "US",
        model: "my",
        condition: "new",
        priceMax: null,
        priceMin: null,
        zip: null,
        range: 0,
        trimLevels: null,
        autopilot: null
      };
      
      // Merge with provided filters
      const options = { ...defaultFilters, ...filters };
      
      // Get region configuration
      const regionConfig = this.REGION_CONFIGS[options.region] || this.REGION_CONFIGS.US;
      
      // Build inventory query using structured approach
      const queryObject = {
        query: {
          model: options.model,
          condition: options.condition,
          options: {},
          arrangeby: "Price",
          order: "asc",
          market: regionConfig.market,
          language: regionConfig.language,
          super_region: regionConfig.super_region,
          zip: options.zip || regionConfig.defaultZip,
          range: options.range || 0
        },
        offset: 0,
        count: 100,
        outsideOffset: 0
      };
      
      // Add trim levels if provided
      if (options.trimLevels && Array.isArray(options.trimLevels) && options.trimLevels.length > 0) {
        queryObject.query.options.TRIM = options.trimLevels;
      }
      
      // Add autopilot filter if provided
      if (options.autopilot && Array.isArray(options.autopilot) && options.autopilot.length > 0) {
        queryObject.query.options.AUTOPILOT = options.autopilot;
      }
      
      // Create local search query
      const localQuery = JSON.stringify({...queryObject, outsideSearch: false});
      const localUrl = `${this.API_URL}?query=${encodeURIComponent(localQuery)}`;
      
      console.log("Fetching Tesla inventory...");
      
      try {
        // Start with a single fetch for simplified debugging
        const localResponse = await this.safeFetch(localUrl).then(res => res.json());
        
        // Process and return local results only for now
        let results = localResponse.results || [];
        
        // Process each vehicle
        results = results.map(vehicle => this.formatVehicle(vehicle, options, regionConfig));
        
        // Apply price filtering if needed
        if (options.priceMax && options.priceMax > 0) {
          results = results.filter(vehicle => vehicle.price <= options.priceMax);
        }
        
        if (options.priceMin && options.priceMin > 0) {
          results = results.filter(vehicle => vehicle.price >= options.priceMin);
        }
        
        console.log(`Found ${results.length} matching vehicles after filtering`);
        
        // Save for download
        this.lastSearchResults = {
          totalLocalMatches: localResponse.total_matches_found || "0",
          totalOutsideMatches: "0",
          totalFiltered: results.length,
          searchDate: new Date().toISOString(),
          results: results
        };
        
        // Prepare CSV data
        this.prepareCSVExport(results);
        
        return results;
      } catch (error) {
        console.error("Error fetching inventory:", error);
        return [];
      }
    } catch (error) {
      console.error("Error building inventory query:", error);
      return [];
    }
  },
  
  /**
   * Format a vehicle object
   */
  formatVehicle(vehicle, options, regionConfig) {
    try {
      // Extract key information with null/undefined handling
      const price = parseInt(vehicle.Price) || 0;
      const vin = vehicle.VIN || '';
      const model = this.MODELS[options.model]?.displayName || 'Tesla';
      const trim = vehicle.TRIM || '';
      
      // Format price for display
      const formattedPrice = `${regionConfig.currencySymbol}${price.toLocaleString(regionConfig.numberFormat)}`;
      
      // Create inventory URL
      const inventoryPath = vehicle.VINurl || `/inventory/${options.condition}/${options.model}/${vin}`;
      const inventoryUrl = `${regionConfig.baseUrl}${inventoryPath}`;
      
      // Return simplified vehicle object for stability
      return {
        price,
        formattedPrice,
        vin,
        model,
        trim,
        inventoryUrl,
        lastSeen: new Date().toISOString(),
        raw: vehicle // Keep raw data for debugging
      };
    } catch (err) {
      console.warn("Error processing vehicle:", err);
      // Return a minimal object if processing fails
      return {
        price: 0,
        vin: vehicle.VIN || '',
        model: options.model,
        lastSeen: new Date().toISOString(),
        raw: vehicle
      };
    }
  },
  
  /**
   * Prepare CSV export data
   */
  prepareCSVExport(vehicles) {
    try {
      // Start with header
      let csvContent = '"VIN","Model","Trim","Price","Last Seen"\n';
      
      // Add each vehicle
      vehicles.forEach(vehicle => {
        const row = [
          vehicle.vin || '',
          vehicle.model || '',
          vehicle.trim || '',
          vehicle.price || '',
          vehicle.lastSeen || ''
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
        
        csvContent += row + '\n';
      });
      
      // Store the CSV content for download
      this.lastCSVExport = csvContent;
      
      // Store the export time
      this.lastExportTime = new Date().toISOString();
      
      return csvContent;
    } catch (error) {
      console.error("Error preparing CSV export:", error);
      return "";
    }
  },
  
  /**
   * Trigger download of the last CSV export
   */
  downloadCSVExport() {
    if (!this.lastCSVExport) {
      console.error("No CSV data available for download");
      return false;
    }
    
    try {
      // Create a download link
      const blob = new Blob([this.lastCSVExport], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      // Format date for filename
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Create a link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `tesla-inventory-${dateStr}.csv`;
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Error downloading CSV:", error);
      return false;
    }
  }
};

// Simple storage wrapper for more reliable operations
const StorageManager = {
  /**
   * Save data to storage
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

// Default filters
const DEFAULT_FILTERS = {
  region: "US",
  model: "my",
  condition: "new",
  priceMax: 45000,
  range: 0
};

// Inventory Monitor
const InventoryMonitor = {
  // Default polling intervals (in minutes)
  DEFAULT_POLL_INTERVAL: 5,
  AGGRESSIVE_POLL_INTERVAL: 1,
  
  // Active polling state
  activeAlarm: null,
  isMonitoring: false,
  
  /**
   * Start monitoring for vehicles matching filters
   */
  async startMonitoring(filters, intervalMinutes = this.DEFAULT_POLL_INTERVAL) {
    try {
      // Stop any existing monitoring
      await this.stopMonitoring();
      
      // Save the filters
      await StorageManager.saveData({ monitoringFilters: filters });
      
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
      await StorageManager.saveData({
        isMonitoring: true,
        monitoringInterval: intervalMinutes,
        monitoringStarted: new Date().toISOString()
      });
      
      console.log(`Inventory monitoring started with interval: ${intervalMinutes} minutes`);
      
      // Check inventory immediately
      this.checkInventory();
      
      return true;
    } catch (error) {
      console.error("Error starting inventory monitoring:", error);
      return false;
    }
  },
  
  /**
   * Stop monitoring for vehicles
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
      await StorageManager.saveData({
        isMonitoring: false
      });
      
      console.log("Inventory monitoring stopped");
      return true;
    } catch (error) {
      console.error("Error stopping inventory monitoring:", error);
      return false;
    }
  },
  
  /**
   * Check inventory for matches
   */
  async checkInventory() {
    try {
      console.log("Running inventory check...");
      
      // Get monitoring filters
      const data = await StorageManager.getData("monitoringFilters");
      const monitoringFilters = data.monitoringFilters;
      
      if (!monitoringFilters) {
        console.error("No monitoring filters defined");
        return [];
      }
      
      // Fetch inventory with filters
      const vehicles = await TeslaInventoryService.fetchInventory(monitoringFilters);
      
      // Save most recent results
      await StorageManager.saveData({
        lastInventoryCheck: new Date().toISOString(),
        lastInventoryResults: vehicles
      });
      
      // Show notification if vehicles found
      if (vehicles.length > 0) {
        this.showNotification(vehicles, monitoringFilters);
      }
      
      return vehicles;
    } catch (error) {
      console.error("Error checking inventory:", error);
      return [];
    }
  },
  
  /**
   * Show a notification for new vehicles
   */
  showNotification(vehicles, filters) {
    if (!vehicles || vehicles.length === 0) return;
    
    try {
      // Make sure chrome.notifications is available
      if (!chrome.notifications) {
        console.warn("Chrome notifications API not available. Check manifest permissions.");
        return;
      }
      
      // Get region configuration
      const regionConfig = TeslaInventoryService.REGION_CONFIGS[filters.region] || TeslaInventoryService.REGION_CONFIGS.US;
      
      // Format a nice notification
      const lowestPrice = vehicles.reduce((min, v) => Math.min(min, v.price), Infinity);
      const formattedPrice = `${regionConfig.currencySymbol}${lowestPrice.toLocaleString(
        filters.region === 'TR' ? 'tr-TR' : 'en-US'
      )}`;
      
      const modelName = TeslaInventoryService.MODELS[filters.model]?.displayName || 'Tesla';
      
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
  },
  
  /**
   * Initialize the monitor
   */
  initialize() {
    try {
      console.log("Initializing inventory monitor...");
      
      // Restore monitoring state if active
      StorageManager.getData(["isMonitoring", "monitoringFilters", "monitoringInterval"])
        .then(data => {
          if (data.isMonitoring && data.monitoringFilters) {
            this.startMonitoring(
              data.monitoringFilters, 
              data.monitoringInterval || this.DEFAULT_POLL_INTERVAL
            ).catch(err => {
              console.error("Error restoring monitoring:", err);
            });
          }
        })
        .catch(err => {
          console.error("Error retrieving monitoring state:", err);
        });
      
      console.log("Inventory monitor initialized");
    } catch (error) {
      console.error("Error initializing inventory monitor:", error);
    }
  }
};

// Initialize the services
TeslaInventoryService.initialize();
InventoryMonitor.initialize();

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request.action);
  
  if (request.action === "fetchInventory") {
    TeslaInventoryService.fetchInventory(request.filters)
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }
  
  if (request.action === "downloadCSV") {
    const success = TeslaInventoryService.downloadCSVExport();
    sendResponse({ success });
    return true;
  }
  
  if (request.action === "startMonitoring") {
    InventoryMonitor.startMonitoring(request.filters, request.interval)
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }
  
  if (request.action === "stopMonitoring") {
    InventoryMonitor.stopMonitoring()
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }
  
  if (request.action === "checkInventory") {
    InventoryMonitor.checkInventory()
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true;
  }
  
  if (request.action === "fillForm" || 
      request.action === "fixValidation" || 
      request.action === "togglePanel" ||
      request.action === "fillZipDialog") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: request.action }, response => {
          sendResponse(response || { status: "Message sent" });
        });
      } else {
        sendResponse({ status: "No active tab" });
      }
    });
    return true;
  }
  
  if (request.action === "refreshData") {
    // Simple acknowledgment
    sendResponse({ status: "Refresh requested" });
    return false;
  }
});

// Initialize the extension when installed or updated
chrome.runtime.onInstalled.addListener(details => {
  console.log("Tesla AutoPilot extension installed or updated", details.reason);
});

// Listen for alarm events outside the class for extra reliability
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "tesla-inventory-monitor") {
      InventoryMonitor.checkInventory().catch(error => {
        console.error("Error in global alarm handler:", error);
      });
    }
  });
}