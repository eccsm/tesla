// Enhanced Tesla Inventory Service
// Add this to your background.js file or as a new service file

const TeslaInventoryService = {
  // Base API URL for inventory
  API_URL: "https://www.tesla.com/inventory/api/v1/inventory-results",
  
  // Region-specific configurations
  REGION_CONFIGS: {
    US: {
      baseUrl: "https://www.tesla.com",
      currencySymbol: "$",
      defaultZip: "90001",
      language: "en",
      market: "US",
      super_region: "north america"
    },
    TR: {
      baseUrl: "https://www.tesla.com/tr_TR",
      currencySymbol: "₺",
      defaultZip: "34000",
      language: "tr",
      market: "TR",
      super_region: "europe"
    }
  },
  
  // Model configurations
  MODELS: {
    m3: {
      displayName: "Model 3",
      trims: ["RWD", "Long Range", "Performance"]
    },
    my: {
      displayName: "Model Y",
      trims: ["RWD", "Long Range", "Performance"]
    },
    ms: {
      displayName: "Model S",
      trims: ["Long Range", "Plaid"]
    },
    mx: {
      displayName: "Model X",
      trims: ["Long Range", "Plaid"]
    },
    ct: {
      displayName: "Cybertruck",
      trims: ["Single Motor", "Dual Motor", "Tri Motor"]
    }
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
        priceMax: null,
        priceMin: null,
        zip: null,
        range: null,
        trimLevel: null
      };
      
      // Merge with provided filters
      const options = { ...defaultFilters, ...filters };
      
      // Get region configuration
      const regionConfig = this.REGION_CONFIGS[options.region] || this.REGION_CONFIGS.US;
      
      // Build the proper query structure that Tesla's API expects
      const queryObject = {
        query: {
          model: options.model,
          condition: "new",
          options: {},
          arrangeby: "Price",
          order: "asc",
          market: regionConfig.market,
          language: regionConfig.language,
          super_region: regionConfig.super_region,
          zip: options.zip || regionConfig.defaultZip
        },
        offset: 0,
        count: 50,
        outsideOffset: 0,
        outsideSearch: false
      };
      
      // Add price filter if provided
      if (options.priceMax && options.priceMax > 0) {
        queryObject.query.options.PRICE = options.priceMax;
      }
      
      // Add range filter if provided
      if (options.range && options.range > 0) {
        queryObject.query.options.RANGE = options.range;
      }
      
      // Add trim level filter if provided
      if (options.trimLevel) {
        queryObject.query.options.TRIM = options.trimLevel;
      }
      
      // Construct URL with the query parameter
      const queryParam = encodeURIComponent(JSON.stringify(queryObject));
      const url = `${this.API_URL}?query=${queryParam}`;
      
      console.log("Fetching Tesla inventory with URL:", url.substring(0, 100) + "...");
      
      // Fetch the data
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`API returned status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if the response has the expected structure
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error("Unexpected API response format");
      }
      
      // Process and filter results
      let results = this.processResults(data.results, options);
      
      // Apply additional filtering for min price if needed
      if (options.priceMin && options.priceMin > 0) {
        results = results.filter(vehicle => vehicle.price >= options.priceMin);
      }
      
      console.log(`Found ${results.length} matching vehicles after filtering`);
      
      return results;
    } catch (error) {
      console.error("Error fetching Tesla inventory:", error);
      
      // Generate placeholder data if in development/testing
      if (process.env.NODE_ENV === 'development') {
        return this.generatePlaceholderData(options);
      }
      
      return [];
    }
  },
  
  /**
   * Process and format inventory results
   * @param {Array} results - Raw results from API
   * @param {Object} options - Filter options
   * @returns {Array} - Processed results
   */
  processResults(results, options) {
    // Get region configuration
    const regionConfig = this.REGION_CONFIGS[options.region] || this.REGION_CONFIGS.US;
    
    // Format each vehicle
    return results.map(vehicle => {
      // Extract key information
      const price = vehicle.PurchasePrice || vehicle.Price || 0;
      const vin = vehicle.VIN || '';
      const model = this.MODELS[options.model]?.displayName || 'Tesla';
      const trim = vehicle.TRIM || '';
      const range = vehicle.RANGE || '';
      const color = vehicle.PAINT || '';
      const wheels = vehicle.WHEELS || '';
      const interior = vehicle.INTERIOR || '';
      
      // Format price for display
      const formattedPrice = `${regionConfig.currencySymbol}${price.toLocaleString()}`;
      
      // Create inventory URL
      const inventoryPath = vehicle.VINurl || `/inventory/new/${options.model}/${vin}`;
      const inventoryUrl = `${regionConfig.baseUrl}${inventoryPath}`;
      
      // Create order URL
      const orderPath = vehicle.VINurl?.replace('/inventory/', '/myorder/') || `/myorder/${options.model}/${vin}`;
      const orderUrl = `${regionConfig.baseUrl}${orderPath}`;
      
      // Return formatted vehicle object
      return {
        price,
        formattedPrice,
        vin,
        model,
        trim,
        range,
        color,
        wheels,
        interior,
        inventoryUrl,
        orderUrl,
        lastSeen: new Date().toISOString()
      };
    });
  },
  
  /**
   * Generate placeholder data for testing
   * @param {Object} options - Filter options
   * @returns {Array} - Placeholder vehicle data
   */
  generatePlaceholderData(options) {
    const regionConfig = this.REGION_CONFIGS[options.region] || this.REGION_CONFIGS.US;
    const modelInfo = this.MODELS[options.model] || this.MODELS.my;
    
    // Generate 5 different price points
    const results = [];
    const maxPrice = options.priceMax || 60000;
    const minPrice = options.priceMin || maxPrice * 0.85;
    
    // Create price points between min and max
    const priceStep = (maxPrice - minPrice) / 4;
    const priceTiers = [
      minPrice,
      minPrice + priceStep,
      minPrice + priceStep * 2,
      minPrice + priceStep * 3,
      maxPrice
    ];
    
    // Color options
    const colors = ['Pearl White', 'Solid Black', 'Deep Blue Metallic', 'Red Multi-Coat', 'Silver Metallic'];
    
    // Wheel options
    const wheels = ['19" Sport', '20" Induction', '21" Überturbine'];
    
    // Interior options
    const interiors = ['All Black', 'Black and White', 'Cream'];
    
    // Generate sample cars at different price points
    priceTiers.forEach((price, index) => {
      const roundedPrice = Math.floor(price / 1000) * 1000;
      const colorIndex = index % colors.length;
      const wheelIndex = index % wheels.length;
      const interiorIndex = index % interiors.length;
      const trimIndex = index % modelInfo.trims.length;
      
      // Generate a random VIN
      const vin = this.generateRandomVIN();
      
      results.push({
        price: roundedPrice,
        formattedPrice: `${regionConfig.currencySymbol}${roundedPrice.toLocaleString()}`,
        vin,
        model: modelInfo.displayName,
        trim: modelInfo.trims[trimIndex],
        range: `${300 + index * 10} mi`,
        color: colors[colorIndex],
        wheels: wheels[wheelIndex],
        interior: interiors[interiorIndex],
        inventoryUrl: `${regionConfig.baseUrl}/inventory/new/${options.model}/${vin}`,
        orderUrl: `${regionConfig.baseUrl}/myorder/${options.model}/${vin}`,
        lastSeen: new Date().toISOString(),
        isPlaceholder: true
      });
    });
    
    return results;
  },
  
  /**
   * Generate a random VIN for placeholder data
   * @returns {string} - Random VIN
   */
  generateRandomVIN() {
    const characters = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    let vin = '5YJ';
    
    for (let i = 0; i < 14; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      vin += characters[randomIndex];
    }
    
    return vin;
  },
  
  /**
   * Get available models for a region
   * @param {string} region - Region code (e.g., 'US', 'TR')
   * @returns {Array} - Array of available models
   */
  getAvailableModels(region) {
    // In a real implementation, this might vary by region
    return Object.keys(this.MODELS).map(code => ({
      code,
      displayName: this.MODELS[code].displayName
    }));
  },
  
  /**
   * Get available trims for a model
   * @param {string} modelCode - Model code (e.g., 'my', 'm3')
   * @returns {Array} - Array of available trims
   */
  getAvailableTrims(modelCode) {
    const model = this.MODELS[modelCode];
    if (!model) return [];
    
    return model.trims;
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
      this.stopMonitoring();
      
      // Save the filters
      await chrome.storage.sync.set({ monitoringFilters: filters });
      
      // Set up polling with Chrome alarms
      this.activeAlarm = "tesla-inventory-monitor";
      
      chrome.alarms.create(this.activeAlarm, {
        periodInMinutes: intervalMinutes,
        delayInMinutes: 0.1 // Start almost immediately
      });
      
      this.isMonitoring = true;
      
      // Set monitoring state
      await chrome.storage.sync.set({
        isMonitoring: true,
        monitoringInterval: intervalMinutes,
        monitoringStarted: new Date().toISOString()
      });
      
      console.log(`Inventory monitoring started with interval: ${intervalMinutes} minutes`);
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
      // Clear the alarm if one is active
      if (this.activeAlarm) {
        await chrome.alarms.clear(this.activeAlarm);
        this.activeAlarm = null;
      }
      
      this.isMonitoring = false;
      
      // Update monitoring state
      await chrome.storage.sync.set({
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
      const { monitoringFilters } = await chrome.storage.sync.get("monitoringFilters");
      
      if (!monitoringFilters) {
        console.error("No monitoring filters defined");
        return [];
      }
      
      // Fetch inventory with filters
      const vehicles = await TeslaInventoryService.fetchInventory(monitoringFilters);
      
      // Get previously seen vehicles
      const { knownVehicles = {} } = await chrome.storage.local.get("knownVehicles");
      
      // Find new vehicles
      const newVehicles = vehicles.filter(vehicle => !knownVehicles[vehicle.vin]);
      
      // Update known vehicles
      vehicles.forEach(vehicle => {
        knownVehicles[vehicle.vin] = {
          lastSeen: new Date().toISOString(),
          price: vehicle.price,
          trim: vehicle.trim
        };
      });
      
      // Save updated known vehicles
      await chrome.storage.local.set({ knownVehicles });
      
      // Save most recent results
      await chrome.storage.local.set({
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
    
    // Get region configuration
    const regionConfig = TeslaInventoryService.REGION_CONFIGS[filters.region] || TeslaInventoryService.REGION_CONFIGS.US;
    
    // Format a nice notification
    const lowestPrice = vehicles.reduce((min, v) => Math.min(min, v.price), Infinity);
    const formattedPrice = `${regionConfig.currencySymbol}${lowestPrice.toLocaleString()}`;
    
    const modelName = TeslaInventoryService.MODELS[filters.model]?.displayName || 'Tesla';
    const title = `${vehicles.length} ${modelName}${vehicles.length > 1 ? 's' : ''} found!`;
    const message = `Starting at ${formattedPrice} - Click to view`;
    
    // Create Chrome notification
    chrome.notifications.create("tesla-inventory-find", {
      type: "basic",
      iconUrl: "/icons/tesla.png",
      title,
      message,
      priority: 2
    });
    
    // Set badge with number of matches
    chrome.action.setBadgeText({ text: String(vehicles.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
    
    // Play a notification sound if possible
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.play();
      } catch (e) {
        // Sound playback failed - no problem
      }
    }
  },
  
  /**
   * Initialize the monitor
   */
  initialize() {
    // Listen for alarm events
    chrome.alarms.onAlarm.addListener(alarm => {
      if (alarm.name === this.activeAlarm) {
        this.checkInventory();
      }
    });
    
    // Listen for notification clicks
    chrome.notifications.onClicked.addListener(notificationId => {
      if (notificationId === "tesla-inventory-find") {
        this.openInventoryPage();
      }
    });
    
    // Restore monitoring state if active
    chrome.storage.sync.get(["isMonitoring", "monitoringFilters", "monitoringInterval"], data => {
      if (data.isMonitoring && data.monitoringFilters) {
        this.startMonitoring(data.monitoringFilters, data.monitoringInterval || this.DEFAULT_POLL_INTERVAL);
      }
    });
  },
  
  /**
   * Open the inventory page
   */
  async openInventoryPage() {
    try {
      // Get monitoring filters
      const { monitoringFilters } = await chrome.storage.sync.get("monitoringFilters");
      
      if (!monitoringFilters) {
        console.error("No monitoring filters defined");
        return;
      }
      
      // Get region and model
      const region = monitoringFilters.region || "US";
      const model = monitoringFilters.model || "my";
      
      // Get region configuration
      const regionConfig = TeslaInventoryService.REGION_CONFIGS[region] || TeslaInventoryService.REGION_CONFIGS.US;
      
      // Construct the URL
      let url = `${regionConfig.baseUrl}/inventory/new/${model}`;
      
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
      chrome.tabs.create({ url });
      
      // Clear the badge
      chrome.action.setBadgeText({ text: "" });
    } catch (error) {
      console.error("Error opening inventory page:", error);
    }
  }
};

// Initialize the inventory monitor
InventoryMonitor.initialize();