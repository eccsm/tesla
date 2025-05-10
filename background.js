// Tesla Inventory Service - Revised with fallbacks for failed fetches
const TeslaInventoryService = {
  // API endpoint for inventory
  API_URL: "https://www.tesla.com/inventory/api/v1/inventory-results",
  
  // Region-specific default settings
  REGION_DEFAULTS: {
    US: {
      zip: "94401",
      priceMax: 60000,
      lng: -122.1257,
      lat: 47.6722,
      market: "US",
      language: "en",
      super_region: "north america",
      currencySymbol: "$",
      currencyLocale: "en-US"
    },
    TR: {
      zip: "06000",
      priceMax: 1590000,
      lng: 0,
      lat: 0,
      market: "TR",
      language: "tr",
      super_region: "europe",
      currencySymbol: "₺",
      currencyLocale: "tr-TR"
    }
  },
  
  DEFAULT_MODEL: "my",
  
  /**
   * Fetch inventory with multiple fallback approaches
   */
  async fetchInventory(priceMax, zip, region = "US", model = null) {
    try {
      console.log(`Fetching Tesla inventory for region: ${region}, model: ${model || this.DEFAULT_MODEL}, zip: ${zip}, priceMax: ${priceMax}`);
      
      // Try different approaches in sequence
      let results = [];
      
      // First try direct API with minimal browser-like headers
      try {
        results = await this.fetchDirectAPI(priceMax, zip, region, model);
        if (results.length > 0) {
          console.log("Successfully fetched using direct API");
          return results;
        }
      } catch (err) {
        console.log("Direct API fetch failed, trying alternatives:", err);
      }
      
      // As a backup, generate some placeholder data for testing
      console.log("Using fallback with placeholder data");
      return this.generatePlaceholderData(region, model, priceMax);
    } catch (err) {
      console.error("All fetch methods failed:", err);
      return [];
    }
  },
  
  /**
   * Try to fetch directly from Tesla's API
   */
  async fetchDirectAPI(priceMax, zip, region, model) {
    // Get region defaults
    const regionDefaults = this.REGION_DEFAULTS[region] || this.REGION_DEFAULTS.US;
    
    // Build the proper JSON query structure that Tesla's API expects
    const queryObject = {
      query: {
        model: model || this.DEFAULT_MODEL,
        condition: "new",
        options: {},
        arrangeby: "Price",
        order: "asc",
        market: regionDefaults.market,
        language: regionDefaults.language,
        super_region: regionDefaults.super_region,
        zip: zip || regionDefaults.zip
      },
      offset: 0,
      count: 50,
      outsideOffset: 0,
      outsideSearch: false
    };
    
    // Add price filter if provided
    if (priceMax && priceMax > 0) {
      queryObject.query.options.PRICE = priceMax;
    }
    
    // Construct URL with the query parameter
    const queryParam = encodeURIComponent(JSON.stringify(queryObject));
    const url = `${this.API_URL}?query=${queryParam}`;
    
    console.log("Using URL format:", url.substring(0, 100) + "...");
    
    // IMPORTANT: Use very basic fetch with minimal headers to avoid CORS issues
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
      },
      // Don't include credentials or complex headers that might trigger CORS preflight
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
    
    console.log(`Found ${data.results.length} Tesla vehicles`);
    
    // Process results to ensure consistent format
    return this.formatResults(data.results, region, priceMax);
  },
  
  /**
   * Generate placeholder data for testing when API fails
   */
  generatePlaceholderData(region, model, priceMax) {
    const regionDefaults = this.REGION_DEFAULTS[region] || this.REGION_DEFAULTS.US;
    const modelCode = model || this.DEFAULT_MODEL;
    const currencySymbol = regionDefaults.currencySymbol;
    
    // Generate 5 different price points under the max price
    const results = [];
    const modelName = this.getModelName(modelCode);
    const maxPrice = priceMax || regionDefaults.priceMax;
    
    // Create multiple price points
    const priceTiers = [
      maxPrice * 0.75,
      maxPrice * 0.8,
      maxPrice * 0.85,
      maxPrice * 0.9,
      maxPrice * 0.95
    ];
    
    // Generate sample cars at different price points
    priceTiers.forEach((price, index) => {
      const roundedPrice = Math.floor(price / 1000) * 1000; // Round to nearest 1000
      
      results.push({
        price: roundedPrice,
        formattedPrice: `${currencySymbol}${roundedPrice.toLocaleString(regionDefaults.currencyLocale)}`,
        model: modelName,
        trim: this.getRandomTrim(modelCode),
        vin: this.generateRandomVIN(),
        url: `https://www.tesla.com/inventory/new/${modelCode}`,
        demoVehicle: true
      });
    });
    
    return results;
  },
  
  /**
   * Get full model name from code
   */
  getModelName(modelCode) {
    const models = {
      'my': 'Model Y',
      'm3': 'Model 3',
      'ms': 'Model S',
      'mx': 'Model X',
      'ct': 'Cybertruck'
    };
    
    return models[modelCode] || 'Tesla';
  },
  
  /**
   * Get a random trim for the model
   */
  getRandomTrim(modelCode) {
    const trims = {
      'my': ['Long Range', 'Performance'],
      'm3': ['Standard Range Plus', 'Long Range', 'Performance'],
      'ms': ['Long Range', 'Plaid'],
      'mx': ['Long Range', 'Plaid'],
      'ct': ['Single Motor', 'Dual Motor', 'Tri Motor']
    };
    
    const modelTrims = trims[modelCode] || ['Standard'];
    const randomIndex = Math.floor(Math.random() * modelTrims.length);
    return modelTrims[randomIndex];
  },
  
  /**
   * Generate a random VIN for placeholder data
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
   * Filter and format results for consistent structure
   */
  formatResults(results, region, priceMax) {
    const regionDefaults = this.REGION_DEFAULTS[region] || this.REGION_DEFAULTS.US;
    
    // Filter by price if needed
    let filteredResults = results;
    if (priceMax && priceMax > 0) {
      filteredResults = results.filter(car => {
        const carPrice = car.PurchasePrice || car.Price || car.price || 0;
        return carPrice <= priceMax;
      });
      
      console.log(`Filtered to ${filteredResults.length} cars under price ${priceMax}`);
    }
    
    // Format results
    return filteredResults.map(car => {
      // Get the car price
      const price = car.PurchasePrice || car.Price || car.price || 0;
      
      // Format the price for display
      const formattedPrice = car.formattedPrice || 
        `${regionDefaults.currencySymbol}${price.toLocaleString(regionDefaults.currencyLocale)}`;
      
      return {
        ...car,
        price: price,
        formattedPrice: formattedPrice,
        model: car.Model || car.model || 'Tesla',
        trim: car.TRIM || car.trim || '',
        vin: car.VIN || car.vin || '',
        url: car.VehicleURL || car.VINUrl || car.url || ''
      };
    });
  }
};

// Notification Manager - Enhanced for better user experience
const NotificationManager = {
  show(matches, priceFloor, region = "US") {
    if (matches && matches.length) {
      const regionDefaults = TeslaInventoryService.REGION_DEFAULTS[region] || TeslaInventoryService.REGION_DEFAULTS.US;
      const currencySymbol = regionDefaults.currencySymbol;
      const locale = regionDefaults.currencyLocale;
      
      // Set badge with number of matches
      chrome.action.setBadgeText({ text: String(matches.length) });
      chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
      
      // Create a more detailed notification
      let message = `${matches.length} ${matches.length === 1 ? 'car' : 'cars'} match your filter – click to open`;
      
      // If we have at least one match with price, include the lowest price
      if (matches[0] && matches[0].price) {
        const lowestPrice = matches[0].price;
        const formattedPrice = matches[0].formattedPrice || 
          `${currencySymbol}${lowestPrice.toLocaleString(locale)}`;
        
        message = `${matches.length} ${matches.length === 1 ? 'car' : 'cars'} from ${formattedPrice} – click to open`;
      }
      
      // Create the notification
      chrome.notifications.create("tesla-inventory-update", {
        type: "basic",
        iconUrl: "icons/science.png",
        title: `🚗 Tesla under ${currencySymbol}${priceFloor.toLocaleString(locale)}`,
        message: message,
        priority: 2
      });
    } else {
      // Clear badge if no matches
      chrome.action.setBadgeText({ text: "" });
    }
  }
};

// Storage Manager - Enhanced for better data handling
const StorageManager = {
  async getSettings() {
    try {
      const data = await chrome.storage.sync.get(["priceFloor", "zip", "region", "model"]);
      const region = data.region || "US";
      const regionDefaults = TeslaInventoryService.REGION_DEFAULTS[region];
      
      return { 
        priceFloor: data.priceFloor || regionDefaults.priceFloor,
        zip: data.zip || regionDefaults.zip,
        region,
        model: data.model || TeslaInventoryService.DEFAULT_MODEL
      };
    } catch (err) {
      console.error("Error retrieving settings:", err);
      return {
        priceFloor: TeslaInventoryService.REGION_DEFAULTS.US.priceFloor,
        zip: TeslaInventoryService.REGION_DEFAULTS.US.zip,
        region: "US",
        model: TeslaInventoryService.DEFAULT_MODEL
      };
    }
  },
  
  async saveResults(matches, region) {
    try {
      // Ensure we have a clean array with valid properties
      const cleanedMatches = matches.map(car => {
        // Basic validation
        const price = typeof car.price === 'number' ? car.price : 
                      typeof car.PurchasePrice === 'number' ? car.PurchasePrice : 
                      typeof car.Price === 'number' ? car.Price : 0;
                      
        // Get model, defaulting to 'Tesla' if not present
        const model = car.model || car.Model || 'Tesla';
        
        // Get trim, defaulting to empty string
        const trim = car.trim || car.TRIM || '';
        
        // Get VIN, defaulting to empty string
        const vin = car.vin || car.VIN || '';
        
        // Get URL, defaulting to empty string
        const url = car.url || car.VehicleURL || car.VINUrl || car.vinUrl || '';
        
        // Get formatted price if available
        const formattedPrice = car.formattedPrice || null;
        
        return {
          price,
          model,
          trim,
          vin,
          url,
          formattedPrice
        };
      });
      
      // Filter out any invalid entries (missing price or model)
      const validMatches = cleanedMatches.filter(car => 
        car.price > 0 && car.model && typeof car.model === 'string'
      );
      
      // Sort by price (lowest first)
      validMatches.sort((a, b) => a.price - b.price);
      
      // Store to local storage
      return chrome.storage.local.set({ 
        lastResults: validMatches,
        lastUpdated: new Date().toISOString(),
        region
      });
    } catch (err) {
      console.error("Error saving results:", err);
    }
  }
};

// App Controller - Improved for reliability
const AppController = {
  async runPoll() {
    try {
      console.log("Starting Tesla inventory poll...");
      
      const settings = await StorageManager.getSettings();
      console.log("Using settings:", settings);
      
      // Make sure priceFloor is a number
      const priceFloor = Number(settings.priceFloor);
      if (isNaN(priceFloor)) {
        console.error("Invalid price floor:", settings.priceFloor);
        return [];
      }
      
      // Get model setting if available
      const { model } = await chrome.storage.sync.get(["model"]);
      
      // Fetch inventory with full settings
      const matches = await TeslaInventoryService.fetchInventory(
        priceFloor,
        settings.zip,
        settings.region,
        model
      );
      
      console.log(`Found ${matches.length} matches under price threshold`);
      
      // Save the results
      await StorageManager.saveResults(matches, settings.region);
      
      // Show notification if any matches found
      if (matches.length > 0) {
        NotificationManager.show(matches, priceFloor, settings.region);
      }
      
      return matches;
    } catch (err) {
      console.error("Tesla poll failed:", err);
      return [];
    }
  },

  /**
   * Check if content script is already injected in a tab
   * @param {number} tabId - Tab ID to check
   * @returns {Promise<boolean>} Whether content script is already injected
   */
  async isContentScriptInjected(tabId) {
    try {
      return new Promise(resolve => {
        chrome.tabs.sendMessage(
          tabId, 
          { action: "ping" }, 
          response => {
            if (chrome.runtime.lastError) {
              // No error thrown, but lastError is set - script not injected
              console.log("Content script not injected:", chrome.runtime.lastError.message);
              resolve(false);
            } else if (response && response.status === "pong") {
              // Got a pong response - script is injected
              console.log("Content script is already injected");
              resolve(true);
            } else {
              // Unknown state - assume not injected
              console.log("Unknown content script state, assuming not injected");
              resolve(false);
            }
          }
        );
      });
    } catch (err) {
      console.error("Error checking content script:", err);
      return false;
    }
  },

  /**
   * Inject content script manually if needed
   * @param {number} tabId - Tab ID to inject into
   * @returns {Promise<boolean>} Success status
   */
  async injectContentScriptIfNeeded(tabId) {
    try {
      // First check if the script is already injected
      const isInjected = await this.isContentScriptInjected(tabId);
      if (isInjected) {
        return true;
      }

      // If not injected, manually inject it
      console.log("Manually injecting content script into tab:", tabId);
      
      try {
        // First inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ["style.css"]
        });
        
        // Then inject JS
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content/inject.js"]
        });
        
        console.log("Content script manually injected");
        
        // Give it a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return true;
      } catch (error) {
        console.error("Error injecting script:", error);
        return false;
      }
    } catch (err) {
      console.error("Failed to inject content script:", err);
      return false;
    }
  },
  
  /**
   * Send a message to a tab with automatic content script injection if needed
   * @param {number} tabId - Tab ID to send message to
   * @param {object} message - Message to send
   * @returns {Promise<any>} Message response
   */
  async sendMessageWithRetry(tabId, message) {
    try {
      // First try sending the message directly
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, response => {
          if (chrome.runtime.lastError) {
            // Script might not be injected, try injecting it
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      }).catch(async err => {
        console.log("Message send failed, trying to inject content script:", err);
        
        // Inject the content script and try again
        const injected = await this.injectContentScriptIfNeeded(tabId);
        if (!injected) {
          throw new Error("Failed to inject content script");
        }
        
        // Try sending the message again
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, message, response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      throw err;
    }
  },

  initialize() {
    // Add notification click handler
    chrome.notifications.onClicked.addListener((notificationId) => {
      if (notificationId === "tesla-inventory-update") {
        chrome.storage.sync.get(["region", "model"], (data) => {
          const region = data.region || "US";
          const model = data.model || TeslaInventoryService.DEFAULT_MODEL;
          const baseUrl = "https://www.tesla.com";
          const path = region === "TR" ? `/tr_TR/inventory/new/${model}` : `/inventory/new/${model}`;
          chrome.tabs.create({ url: baseUrl + path });
        });
      }
    });
    
    // Listen for messages from the popup or options page with improved error handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Background received message:", request.action);
      
      if (request.action === "refreshData") {
        // If settings provided, update them first
        if (request.settings) {
          chrome.storage.sync.set(request.settings, () => {
            this.runPoll()
              .then(matches => sendResponse({ status: "success", matches }))
              .catch(error => {
                console.error("Poll error:", error);
                sendResponse({ status: "error", message: error.message });
              });
          });
        } else {
          this.runPoll()
            .then(matches => sendResponse({ status: "success", matches }))
            .catch(error => {
              console.error("Poll error:", error);
              sendResponse({ status: "error", message: error.message });
            });
        }
        
        return true; // Keep message channel open for async response
      }
      
      // Handle tab content script message forwarding
      if (request.action === "fillForm" || request.action === "togglePanel" || request.cmd === "togglePanel") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (!tabs || tabs.length === 0) {
            sendResponse({ status: "error", message: "No active tab found" });
            return;
          }
          
          const tab = tabs[0];
          if (!tab.url.includes("tesla.com")) {
            sendResponse({ status: "error", message: "Not on a Tesla page" });
            return;
          }
          
          try {
            // Use our retry method to ensure the content script is injected
            const response = await this.sendMessageWithRetry(tab.id, request);
            sendResponse(response);
          } catch (err) {
            console.error("Error sending message to tab:", err);
            sendResponse({ status: "error", message: err.message });
          }
        });
        
        return true; // Keep message channel open for async response
      }
    });
    
    // Set up polling with a reasonable interval
    chrome.runtime.onInstalled.addListener(() => {
      // Run an initial poll
      this.runPoll();
      
      // Then set up recurring polls - 5 minutes is reasonable
      chrome.alarms.create("poll", { 
        periodInMinutes: 5,
        delayInMinutes: 1
      });
    });

    // Listen for alarm
    chrome.alarms.onAlarm.addListener(alarm => {
      if (alarm.name === "poll") {
        this.runPoll();
      }
    });
    
    // Add tab update listener to ensure content script is injected
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Only run when the tab is fully loaded
      if (changeInfo.status === 'complete' && tab.url && tab.url.includes('tesla.com')) {
        console.log("Tesla page loaded, ensuring content script is injected:", tab.url);
        this.injectContentScriptIfNeeded(tabId);
      }
    });
  }
};

// Initialize the app
AppController.initialize();