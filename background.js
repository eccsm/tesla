/**
 * Enhanced Tesla Inventory Service
 * 
 * Inspired by teslahunt/inventory approach for more reliable
 * and maintainable inventory fetching capabilities.
 */

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
    },
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
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @param {number} retries - Number of retries
   * @returns {Promise<Response>} - Fetch response
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
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} - Filtered inventory results
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
      const queryObject = this.buildInventoryQuery(options, regionConfig);
      
      // Fetch both local and outside inventory data
      const results = await this.fetchAllInventoryData(queryObject, options);
      
      // Return the processed results
      return results;
    } catch (error) {
      console.error("Error fetching Tesla inventory:", error);
      return [];
    }
  },
  
  /**
   * Build inventory query object
   * @param {Object} options - Query options
   * @param {Object} regionConfig - Region configuration
   * @returns {Object} - Query object
   */
  buildInventoryQuery(options, regionConfig) {
    // Base query structure
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
    
    return queryObject;
  },
  
  /**
   * Fetch both local and outside inventory data
   * @param {Object} queryObject - Query object
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Combined results
   */
  async fetchAllInventoryData(queryObject, options) {
    // Create local and outside search queries
    const localQuery = JSON.stringify({...queryObject, outsideSearch: false});
    const outsideQuery = JSON.stringify({...queryObject, outsideSearch: true});
    
    const localUrl = `${this.API_URL}?query=${encodeURIComponent(localQuery)}`;
    const outsideUrl = `${this.API_URL}?query=${encodeURIComponent(outsideQuery)}`;
    
    console.log("Fetching Tesla inventory...");
    
    try {
      // Fetch both local and outside data
      const [localResponse, outsideResponse] = await Promise.all([
        this.safeFetch(localUrl).then(res => res.json()),
        this.safeFetch(outsideUrl).then(res => res.json())
      ]);
      
      // Combine and process results
      return this.processInventoryResults(localResponse, outsideResponse, options);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      
      // Try with individual requests if parallel fetch failed
      try {
        console.log("Retrying with sequential requests...");
        const localResponse = await this.safeFetch(localUrl).then(res => res.json());
        
        try {
          const outsideResponse = await this.safeFetch(outsideUrl).then(res => res.json());
          return this.processInventoryResults(localResponse, outsideResponse, options);
        } catch (outsideError) {
          console.warn("Outside search failed, using only local results:", outsideError);
          return this.processInventoryResults(localResponse, { results: [] }, options);
        }
      } catch (localError) {
        console.error("All inventory requests failed:", localError);
        return [];
      }
    }
  },
  
  /**
   * Process and combine inventory results
   * @param {Object} localData - Local search results
   * @param {Object} outsideData - Outside search results
   * @param {Object} options - Filter options
   * @returns {Array} - Processed results
   */
  processInventoryResults(localData, outsideData, options) {
    // Get region configuration
    const regionConfig = this.REGION_CONFIGS[options.region] || this.REGION_CONFIGS.US;
    
    // Combine results
    const allResults = [
      ...(localData.results || []),
      ...(outsideData.results || [])
    ];
    
    // Process each vehicle
    let results = allResults.map(vehicle => this.formatVehicle(vehicle, options, regionConfig));
    
    // Apply additional filtering for min price if needed
    if (options.priceMin && options.priceMin > 0) {
      results = results.filter(vehicle => vehicle.price >= options.priceMin);
    }
    
    // Apply max price filtering if needed
    if (options.priceMax && options.priceMax > 0) {
      results = results.filter(vehicle => vehicle.price <= options.priceMax);
    }
    
    console.log(`Found ${results.length} matching vehicles after filtering`);
    
    // Export results to CSV format for download
    this.prepareCSVExport(results);
    
    // Save the results for later reference
    this.lastSearchResults = {
      totalLocalMatches: localData.total_matches_found || "0",
      totalOutsideMatches: outsideData.total_matches_found || "0",
      totalFiltered: results.length,
      searchDate: new Date().toISOString(),
      results: results
    };
    
    return results;
  },
  
  /**
   * Format a vehicle object
   * @param {Object} vehicle - Raw vehicle data
   * @param {Object} options - Options
   * @param {Object} regionConfig - Region configuration
   * @returns {Object} - Formatted vehicle
   */
  formatVehicle(vehicle, options, regionConfig) {
    try {
      // Extract key information with null/undefined handling
      const price = parseInt(vehicle.Price) || 0;
      const vin = vehicle.VIN || '';
      const model = this.MODELS[options.model]?.displayName || 'Tesla';
      const trim = vehicle.TRIM || '';
      const range = vehicle.Range || '';
      const autopilot = vehicle.AUTOPILOT || '';
      const color = vehicle.PAINT || '';
      const wheels = vehicle.WHEELS || '';
      const interior = vehicle.INTERIOR || '';
      const year = vehicle.Year || '';
      
      // Format price for display
      const formattedPrice = `${regionConfig.currencySymbol}${price.toLocaleString(regionConfig.numberFormat)}`;
      
      // Create inventory URL
      const inventoryPath = vehicle.VINurl || `/inventory/${options.condition}/${options.model}/${vin}`;
      const inventoryUrl = `${regionConfig.baseUrl}${inventoryPath}`;
      
      // Get trim display name if available
      const trimDisplayName = this.getTrimDisplayName(options.model, trim);
      
      // Return comprehensive vehicle object
      return {
        price,
        formattedPrice,
        vin,
        model,
        trim,
        trimDisplayName,
        range,
        autopilot,
        color,
        wheels,
        interior,
        year,
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
   * Get trim display name
   * @param {string} modelCode - Model code
   * @param {string} trimCode - Trim code
   * @returns {string} - Display name
   */
  getTrimDisplayName(modelCode, trimCode) {
    if (!trimCode || !modelCode) return '';
    
    const model = this.MODELS[modelCode];
    if (!model) return trimCode;
    
    const trim = model.trims.find(t => t.code === trimCode);
    return trim ? trim.name : trimCode;
  },
  
  /**
   * Prepare CSV export data
   * @param {Array} vehicles - Processed vehicle data
   */
  prepareCSVExport(vehicles) {
    try {
      // Start with header
      let csvContent = '"VIN","Model","Trim","Year","Price","Range","Autopilot","Color","Interior","Last Seen"\n';
      
      // Add each vehicle
      vehicles.forEach(vehicle => {
        // Clean each field to prevent CSV issues
        const cleanValue = (val) => {
          if (val === null || val === undefined) return '';
          return String(val).replace(/"/g, '""');
        };
        
        const row = [
          cleanValue(vehicle.vin),
          cleanValue(vehicle.model),
          cleanValue(vehicle.trimDisplayName || vehicle.trim),
          cleanValue(vehicle.year),
          cleanValue(vehicle.price),
          cleanValue(vehicle.range),
          cleanValue(vehicle.autopilot),
          cleanValue(vehicle.color),
          cleanValue(vehicle.interior),
          cleanValue(vehicle.lastSeen)
        ].map(val => `"${val}"`).join(',');
        
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
  },
  
  /**
   * Get available trim levels for a model
   * @param {string} modelCode - Model code
   * @returns {Array} - Available trims
   */
  getTrimsForModel(modelCode) {
    if (!modelCode || !this.MODELS[modelCode]) {
      return [];
    }
    
    return this.MODELS[modelCode].trims || [];
  },
  
  /**
   * Get available autopilot options
   * @returns {Array} - Available autopilot options
   */
  getAutopilotOptions() {
    return this.AUTOPILOT_OPTIONS;
  }
};

// Initialize the service
TeslaInventoryService.initialize();

// Export the service
window.TeslaInventoryService = TeslaInventoryService;

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

const InventoryMonitor = {
  // Default polling intervals (in minutes)
  DEFAULT_POLL_INTERVAL: 5,
  AGGRESSIVE_POLL_INTERVAL: 1,
  
  // Active polling state
  activeAlarm: null,
  isMonitoring: false,
  
  /**
   * Start monitoring for vehicles matching filters
   * @param {Object} filters - Filtering options
   * @param {number} intervalMinutes - Polling interval in minutes
   * @returns {Promise<boolean>} - Success status
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
   * @returns {Promise<boolean>} - Success status
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
   * @returns {Promise<Array>} - Matching vehicles
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
      
      // Get previously seen vehicles
      const knownVehiclesData = await StorageManager.getData("knownVehicles");
      const knownVehicles = knownVehiclesData.knownVehicles || {};
      
      // Find new vehicles
      const newVehicles = vehicles.filter(vehicle => !knownVehicles[vehicle.vin]);
      
      // Update known vehicles
      const updatedKnownVehicles = { ...knownVehicles };
      vehicles.forEach(vehicle => {
        updatedKnownVehicles[vehicle.vin] = {
          lastSeen: new Date().toISOString(),
          price: vehicle.price,
          trim: vehicle.trim
        };
      });
      
      // Save updated known vehicles
      await StorageManager.saveData({ knownVehicles: updatedKnownVehicles });
      
      // Save most recent results
      await StorageManager.saveData({
        lastInventoryCheck: new Date().toISOString(),
        lastInventoryResults: vehicles
      });
      
      // Show notification if new vehicles found
      if (newVehicles.length > 0) {
        this.showNotification(newVehicles, monitoringFilters);
      }
      
      return vehicles;
    } catch (error) {
      console.error("Error checking inventory:", error);
      return [];
    }
  },
  
  /**
   * Show a notification for new vehicles
   * @param {Array} vehicles - New vehicles
   * @param {Object} filters - Applied filters
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
      
      // Check required permissions
      if (!chrome.alarms) {
        console.error("Chrome alarms API not available. Check manifest permissions.");
      }
      
      if (!chrome.notifications) {
        console.warn("Chrome notifications API not available. Check manifest permissions.");
      }
      
      // Listen for alarm events
      if (chrome.alarms) {
        chrome.alarms.onAlarm.addListener(alarm => {
          if (alarm.name === this.activeAlarm) {
            this.checkInventory().catch(err => {
              console.error("Error in alarm handler:", err);
            });
          }
        });
      }
      
      // Listen for notification clicks
      if (chrome.notifications) {
        chrome.notifications.onClicked.addListener(notificationId => {
          if (notificationId === "tesla-inventory-find") {
            this.openInventoryPage().catch(err => {
              console.error("Error opening inventory page:", err);
            });
          }
        });
      }
      
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
  },
  
  /**
   * Open the inventory page
   */
  async openInventoryPage() {
    try {
      // Get monitoring filters
      const data = await StorageManager.getData("monitoringFilters");
      const monitoringFilters = data.monitoringFilters;
      
      if (!monitoringFilters) {
        console.error("No monitoring filters defined");
        return;
      }
      
      // Get region and model
      const region = monitoringFilters.region || "US";
      const model = monitoringFilters.model || "my";
      const condition = monitoringFilters.condition || "new";
      
      // Get region configuration
      const regionConfig = TeslaInventoryService.REGION_CONFIGS[region] || TeslaInventoryService.REGION_CONFIGS.US;
      
      // Construct the URL
      let url = `${regionConfig.baseUrl}/inventory/${condition}/${model}`;
      
      // Add parameters
      const params = new URLSearchParams();
      
      if (monitoringFilters.priceMax) {
        params.append("price", monitoringFilters.priceMax);
      }
      
      if (monitoringFilters.zip) {
        params.append("zip", monitoringFilters.zip);
      }
      
      if (monitoringFilters.range) {
        params.append("range", monitoringFilters.range);
      }
      
      // Add parameters to URL if any exist
      const paramsString = params.toString();
      if (paramsString) {
        url += `?${paramsString}`;
      }
      
      // Open the URL in a new tab
      if (chrome.tabs) {
        chrome.tabs.create({ url });
      }
      
      // Clear the badge
      if (chrome.action && chrome.action.setBadgeText) {
        chrome.action.setBadgeText({ text: "" });
      }
    } catch (error) {
      console.error("Error opening inventory page:", error);
    }
  }
};

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request.action);
  
  if (request.action === "fetchInventory") {
    TeslaInventoryService.fetchInventory(request.filters)
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
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
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === "stopMonitoring") {
    InventoryMonitor.stopMonitoring()
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === "checkInventory") {
    InventoryMonitor.checkInventory()
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === "fillForm") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fillForm" }, response => {
          sendResponse(response || { status: "Message sent" });
        });
      } else {
        sendResponse({ status: "No active tab" });
      }
    });
    return true;
  }
  
  if (request.action === "fixValidation") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fixValidation" }, response => {
          sendResponse(response || { status: "Message sent" });
        });
      } else {
        sendResponse({ status: "No active tab" });
      }
    });
    return true;
  }
  
  if (request.action === "togglePanel") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "togglePanel" }, response => {
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
  
  // Initialize monitoring
  InventoryMonitor.initialize();
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
};

/**
 * Enhanced Tesla Payment Form Helper
 * 
 * This module helps overcome Tesla payment form challenges:
 * 1. Handles payment iframes
 * 2. Uses MutationObservers to detect form changes
 * 3. Provides visual assistance when fields can't be accessed
 */

// Configuration
const PaymentHelper = {
  // Constants
  IFRAME_WAIT_TIME: 2000,
  FIELD_ATTEMPT_INTERVAL: 300,
  MAX_FIELD_ATTEMPTS: 10,
  
  // Payment field selectors - updated for latest Tesla payment forms
  // These target both direct fields and parent containers to improve matching
  FIELD_SELECTORS: {
    cardNumber: [
      // Card number field selectors
      '[name="cardnumber"]',
      '[id*="card-number"]',
      '[placeholder*="card number"]',
      '[aria-label*="card number"]',
      // Container selectors (for when iframe is used)
      '.card-number-frame',
      '[data-card="number"]',
      '.card-number-container',
      '.CardNumberField'
    ],
    cardName: [
      // Cardholder name selectors
      '[name="ccname"]', 
      '[id*="card-name"]',
      '[placeholder*="name on card"]',
      '[aria-label*="cardholder"]',
      // Container selectors
      '.card-name-container',
      '.CardholderField'
    ],
    cardExpiry: [
      // Expiry date selectors 
      '[name="cc-exp"]',
      '[name="ccexp"]',
      '[id*="expiry"]',
      '[placeholder*="MM / YY"]',
      '[aria-label*="expiration"]',
      // Container selectors
      '.card-expiry-frame',
      '.ExpiryField'
    ],
    cardCvv: [
      // CVV/CVC selectors
      '[name="cvc"]',
      '[name="cc-csc"]',
      '[id*="cvv"]',
      '[id*="cvc"]',
      '[placeholder*="security code"]',
      '[aria-label*="cvv"]',
      // Container selectors
      '.card-cvc-frame',
      '.CvvField'
    ],
    zip: [
      // Postal/ZIP code selectors
      '[name="postal"]',
      '[name="zip"]',
      '[id*="postal"]',
      '[id*="zip"]',
      '[placeholder*="postal"]',
      '[placeholder*="zip"]',
      // Container selectors
      '.postal-code-container',
      '.ZipField'
    ]
  },
  
  // Store information about any detected iframes
  paymentIframes: {
    found: false,
    frames: {},
    provider: null
  },

  /**
   * Initialize the payment helper
   */
  initialize() {
    console.log('Initializing Tesla payment form helper');
    
    // Detect payment form type
    this.detectPaymentFormType();
    
    // Set up mutation observer to watch for form changes
    this.setupFormObserver();
    
    // Initial attempt to find fields
    this.detectPaymentFields();
    
    return this;
  },
  
  /**
   * Detect the type of payment form being used
   */
  detectPaymentFormType() {
    // Look for common payment provider indicators
    const stripeFrame = document.querySelector('iframe[name*="stripe"]');
    const braintreeFrame = document.querySelector('iframe[name*="braintree"]');
    const adyenFrame = document.querySelector('iframe[src*="adyen"]');
    
    if (stripeFrame) {
      this.paymentIframes.provider = 'stripe';
      this.paymentIframes.found = true;
      console.log('Detected Stripe payment form');
    } else if (braintreeFrame) {
      this.paymentIframes.provider = 'braintree';
      this.paymentIframes.found = true;
      console.log('Detected Braintree payment form');
    } else if (adyenFrame) {
      this.paymentIframes.provider = 'adyen';
      this.paymentIframes.found = true;
      console.log('Detected Adyen payment form');
    } else {
      // Check for other common iframe indicators
      const iframeCount = document.querySelectorAll('iframe').length;
      if (iframeCount > 0) {
        // There are iframes but not from known providers
        this.paymentIframes.found = true;
        this.paymentIframes.provider = 'unknown';
        console.log('Detected unknown payment provider with iframes');
      } else {
        this.paymentIframes.found = false;
        console.log('No payment iframes detected, direct form access may be possible');
      }
    }
  },
  
  /**
   * Set up mutation observer to watch for form changes
   */
  setupFormObserver() {
    // Create an observer instance
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      // Check if relevant mutations occurred
      mutations.forEach(mutation => {
        // If nodes were added
        if (mutation.addedNodes.length) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            // If it's an element node
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if it might be a form field or container
              if (node.tagName === 'INPUT' || 
                  node.tagName === 'IFRAME' || 
                  node.tagName === 'DIV' || 
                  node.tagName === 'FORM') {
                shouldCheck = true;
                break;
              }
            }
          }
        }
        
        // If attributes were modified
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          // If it's a form element or container
          if (target.tagName === 'INPUT' || 
              target.tagName === 'IFRAME' || 
              target.tagName === 'FORM' ||
              target.className.includes('card')) {
            shouldCheck = true;
          }
        }
      });
      
      // If relevant changes were detected, check for payment fields
      if (shouldCheck) {
        console.log('Form structure changed, rechecking payment fields');
        this.detectPaymentFields();
      }
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { 
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'id']
    });
    
    console.log('Payment form observer initialized');
  },
  
  /**
   * Detect payment fields in the form
   */
  detectPaymentFields() {
    // If using iframes, we need a different approach
    if (this.paymentIframes.found) {
      console.log('Payment form uses iframes, using visual guidance');
      
      // Create a visual helper instead of direct field access
      this.createVisualPaymentHelper();
      return;
    }
    
    // Try to find each payment field directly in the DOM
    const fields = {};
    let foundAny = false;
    
    // Check each field type
    Object.keys(this.FIELD_SELECTORS).forEach(fieldType => {
      const selectors = this.FIELD_SELECTORS[fieldType];
      
      // Try each selector for this field type
      for (const selector of selectors) {
        const field = document.querySelector(selector);
        if (field && field.tagName === 'INPUT') {
          fields[fieldType] = field;
          foundAny = true;
          console.log(`Found ${fieldType} field with selector: ${selector}`);
          break;
        }
      }
    });
    
    if (foundAny) {
      console.log('Found payment fields:', Object.keys(fields).join(', '));
      this.directFieldAccess = true;
      this.paymentFields = fields;
    } else {
      console.log('No direct payment fields found, will use visual helper');
      this.directFieldAccess = false;
      this.createVisualPaymentHelper();
    }
    
    return foundAny;
  },
  
  /**
   * Create a visual helper for payment information
   * This is used when direct field access is not possible (iframe protected fields)
   */
  createVisualPaymentHelper() {
    // First check if we already have a helper
    if (document.getElementById('tesla-payment-helper')) {
      console.log('Payment helper already exists');
      return;
    }
    
    // Get user payment data
    chrome.storage.sync.get(['cardName', 'cardNumber', 'cardExp', 'cardCVV', 'zip'], (data) => {
      // Create the helper overlay
      const helper = document.createElement('div');
      helper.id = 'tesla-payment-helper';
      helper.style.cssText = `
        position: fixed;
        top: 20px; 
        left: 20px;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        width: 250px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        backdrop-filter: blur(5px);
      `;
      
      // Helper content
      helper.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <strong style="font-size: 16px;">Payment Information</strong>
          <span id="tesla-helper-close" style="cursor: pointer; font-size: 16px;">×</span>
        </div>
        <div style="margin-bottom: 15px; font-size: 12px; color: #aaa;">
          These fields are in secure iframes and must be filled manually
        </div>
        <div style="margin-bottom: 8px;">
          <div style="color: #888; font-size: 12px; margin-bottom: 2px;">Name on Card:</div>
          <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.cardName || 'Not set'}</div>
        </div>
        <div style="margin-bottom: 8px;">
          <div style="color: #888; font-size: 12px; margin-bottom: 2px;">Card Number:</div>
          <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.cardNumber || 'Not set'}</div>
        </div>
        <div style="margin-bottom: 8px;">
          <div style="color: #888; font-size: 12px; margin-bottom: 2px;">Expiration Date:</div>
          <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.cardExp || 'Not set'}</div>
        </div>
        <div style="margin-bottom: 8px;">
          <div style="color: #888; font-size: 12px; margin-bottom: 2px;">CVV/Security Code:</div>
          <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.cardCVV || 'Not set'}</div>
        </div>
        <div style="margin-bottom: 8px;">
          <div style="color: #888; font-size: 12px; margin-bottom: 2px;">Billing ZIP/Postal Code:</div>
          <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.zip || 'Not set'}</div>
        </div>
        <div style="margin-top: 15px; font-size: 12px; color: #aaa; text-align: center;">
          Click on a field to copy its value
        </div>
      `;
      
      // Add to page
      document.body.appendChild(helper);
      
      // Make the helper draggable
      this.makeElementDraggable(helper);
      
      // Add copy functionality to fields
      const fieldContainers = helper.querySelectorAll('[style*="user-select: all"]');
      fieldContainers.forEach(container => {
        container.addEventListener('click', () => {
          const text = container.textContent;
          if (text && text !== 'Not set') {
            navigator.clipboard.writeText(text)
              .then(() => {
                // Show success feedback
                const originalBackground = container.style.background;
                container.style.background = 'rgba(16, 185, 129, 0.3)';
                setTimeout(() => {
                  container.style.background = originalBackground;
                }, 1000);
              })
              .catch(err => {
                console.error('Failed to copy text: ', err);
              });
          }
        });
      });
      
      // Add close functionality
      document.getElementById('tesla-helper-close').addEventListener('click', () => {
        helper.style.opacity = '0';
        setTimeout(() => {
          helper.remove();
        }, 300);
      });
      
      // Try to highlight corresponding fields on the page
      this.highlightPaymentFields();
    });
  },
  
  /**
   * Make an element draggable
   * @param {HTMLElement} element - The element to make draggable
   */
  makeElementDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    const header = element.querySelector('strong') || element;
    header.style.cursor = 'move';
    
    header.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // Get the mouse cursor position at startup
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // Call a function whenever the cursor moves
      document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // Calculate the new cursor position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // Set the element's new position
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
      // Stop moving when mouse button is released
      document.onmouseup = null;
      document.onmousemove = null;
    }
  },
  
  /**
   * Attempt to highlight payment fields on the page
   */
  highlightPaymentFields() {
    // Try to find containers that might contain payment fields
    const possibleContainers = [
      // Card number containers
      ...Array.from(document.querySelectorAll('.card-number-frame, [data-card="number"], .CardNumberField, [id*="card-number"]')),
      // Cardholder name containers
      ...Array.from(document.querySelectorAll('.card-name-container, .CardholderField, [id*="card-name"]')),
      // Expiry containers
      ...Array.from(document.querySelectorAll('.card-expiry-frame, .ExpiryField, [id*="expiry"]')),
      // CVV containers
      ...Array.from(document.querySelectorAll('.card-cvc-frame, .CvvField, [id*="cvv"], [id*="cvc"]')),
      // ZIP code containers
      ...Array.from(document.querySelectorAll('.postal-code-container, .ZipField, [id*="postal"], [id*="zip"]'))
    ];
    
    // Add visual highlights to these containers
    possibleContainers.forEach(container => {
      const originalBoxShadow = container.style.boxShadow;
      const originalPosition = container.style.position;
      
      // Add a pulse effect
      container.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.6)';
      container.style.position = originalPosition === 'static' ? 'relative' : originalPosition;
      
      // Add transition for smooth effect
      container.style.transition = 'box-shadow 0.5s ease';
      
      // Pulse effect
      setTimeout(() => {
        container.style.boxShadow = '0 0 0 5px rgba(59, 130, 246, 0.3)';
        setTimeout(() => {
          container.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.6)';
        }, 500);
      }, 500);
    });
  },
  
  /**
   * Fill payment fields directly if possible
   * @param {Object} data - Payment data to fill
   * @returns {Object} - Result with success status and filled fields count
   */
  fillPaymentFields(data) {
    // If payment fields are in iframes, we can't directly fill them
    if (this.paymentIframes.found || !this.directFieldAccess) {
      console.log('Payment fields are in iframes, showing visual helper instead');
      this.createVisualPaymentHelper();
      return { success: false, reason: 'iframe_protected', filledCount: 0 };
    }
    
    // Count filled fields
    let filledCount = 0;
    
    // Try to fill each field
    if (this.paymentFields.cardName && data.cardName) {
      this.paymentFields.cardName.value = data.cardName;
      this.paymentFields.cardName.dispatchEvent(new Event('input', { bubbles: true }));
      this.paymentFields.cardName.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    }
    
    if (this.paymentFields.cardNumber && data.cardNumber) {
      this.paymentFields.cardNumber.value = data.cardNumber;
      this.paymentFields.cardNumber.dispatchEvent(new Event('input', { bubbles: true }));
      this.paymentFields.cardNumber.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    }
    
    if (this.paymentFields.cardExpiry && data.cardExp) {
      this.paymentFields.cardExpiry.value = data.cardExp;
      this.paymentFields.cardExpiry.dispatchEvent(new Event('input', { bubbles: true }));
      this.paymentFields.cardExpiry.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    }
    
    if (this.paymentFields.cardCvv && data.cardCVV) {
      this.paymentFields.cardCvv.value = data.cardCVV;
      this.paymentFields.cardCvv.dispatchEvent(new Event('input', { bubbles: true }));
      this.paymentFields.cardCvv.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    }
    
    if (this.paymentFields.zip && data.zip) {
      this.paymentFields.zip.value = data.zip;
      this.paymentFields.zip.dispatchEvent(new Event('input', { bubbles: true }));
      this.paymentFields.zip.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    }
    
    return {
      success: filledCount > 0,
      filledCount: filledCount
    };
  }
};

// Initialize the module
PaymentHelper.initialize();

// Export the module
window.TeslaPaymentHelper = PaymentHelper;