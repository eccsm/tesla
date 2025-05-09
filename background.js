// Tesla Inventory Service - Simple Version
const TeslaInventoryService = {
  // Based on your original code but with CORS fixes
  API_URL: "https://www.tesla.com/inventory/api/v1/inventory-results",
  
  // Region-specific default settings (keeping your original configuration)
  REGION_DEFAULTS: {
    US: {
      zip: "94401",
      priceFloor: 45000,
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
      priceFloor: 1590000,
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
  
  // Simplified fetch that focuses on avoiding CORS issues
  async fetchInventory(priceFloor, zip, region = "US") {
    // Get region defaults
    const regionDefaults = this.REGION_DEFAULTS[region] || this.REGION_DEFAULTS.US;
    
    // Build query - simpler approach
    const query = {
      model: this.DEFAULT_MODEL.toUpperCase(),
      condition: "new",
      zip: zip || regionDefaults.zip,
      arrangeby: "Price",
      order: "asc",
      market: regionDefaults.market,
      language: regionDefaults.language,
      super_region: regionDefaults.super_region,
      options: {}
    };
    
    try {
      console.log(`Fetching Tesla inventory for region: ${region}`);
      
      // Build URL directly with query parameters instead of complex payload
      const url = new URL(this.API_URL);
      
      // Simplified approach - use a single query parameter with the stringified query
      url.searchParams.set('query', JSON.stringify(query));
      url.searchParams.set('count', '50');
      url.searchParams.set('offset', '0');
      url.searchParams.set('outsideOffset', '0');
      url.searchParams.set('outsideSearch', 'false');
      
      console.log("Using URL:", url.toString());
      
      // Basic fetch with minimal headers to avoid CORS issues
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // No credentials or complex headers that might trigger CORS preflight
      });
      
      if (!response.ok) {
        console.error(`API returned status: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      
      // Check if the response has the expected structure
      if (!data.results || !Array.isArray(data.results)) {
        console.error("Unexpected API response format:", data);
        return [];
      }
      
      // Filter cars by price
      const matches = data.results.filter(car => car.PurchasePrice <= priceFloor);
      console.log(`Found ${matches.length} cars under price ${priceFloor}`);
      
      return matches;
    } catch (err) {
      console.error("Tesla inventory fetch failed:", err);
      return [];
    }
  }
};

// Notification Manager - Unchanged
const NotificationManager = {
  show(matches, priceFloor, region = "US") {
    if (matches.length) {
      const regionDefaults = TeslaInventoryService.REGION_DEFAULTS[region] || TeslaInventoryService.REGION_DEFAULTS.US;
      const currencySymbol = regionDefaults.currencySymbol;
      const locale = regionDefaults.currencyLocale;
      
      chrome.action.setBadgeText({ text: String(matches.length) });
      
      chrome.notifications.create("tesla-inventory-update", {
        type: "basic",
        iconUrl: "icons/science.png",
        title: `🚗 Tesla under ${currencySymbol}${priceFloor.toLocaleString(locale)}`,
        message: `${matches.length} car(s) match your filter – click to open`,
        priority: 2
      });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }
};

// Storage Manager - Unchanged
const StorageManager = {
  async getSettings() {
    try {
      const data = await chrome.storage.sync.get(["priceFloor", "zip", "region"]);
      const region = data.region || "US";
      const regionDefaults = TeslaInventoryService.REGION_DEFAULTS[region];
      
      return { 
        priceFloor: data.priceFloor || regionDefaults.priceFloor,
        zip: data.zip || regionDefaults.zip,
        region
      };
    } catch (err) {
      console.error("Error retrieving settings:", err);
      return {
        priceFloor: TeslaInventoryService.REGION_DEFAULTS.US.priceFloor,
        zip: TeslaInventoryService.REGION_DEFAULTS.US.zip,
        region: "US"
      };
    }
  },
  
  async saveResults(matches, region) {
    try {
      return chrome.storage.local.set({ 
        lastResults: matches,
        lastUpdated: new Date().toISOString(),
        region
      });
    } catch (err) {
      console.error("Error saving results:", err);
    }
  }
};

// App Controller - Simplified for reliability
const AppController = {
  async runPoll() {
    try {
      console.log("Starting Tesla inventory poll...");
      
      const settings = await StorageManager.getSettings();
      console.log("Using settings:", settings);
      
      const matches = await TeslaInventoryService.fetchInventory(
        settings.priceFloor,
        settings.zip,
        settings.region
      );
      
      console.log(`Found ${matches.length} matches under price threshold`);
      
      await StorageManager.saveResults(matches, settings.region);
      NotificationManager.show(matches, settings.priceFloor, settings.region);
      
      return matches;
    } catch (err) {
      console.error("Tesla poll failed:", err);
      return [];
    }
  },

  initialize() {
    // Add notification click handler
    chrome.notifications.onClicked.addListener((notificationId) => {
      if (notificationId === "tesla-inventory-update") {
        chrome.storage.sync.get("region", (data) => {
          const region = data.region || "US";
          const baseUrl = "https://www.tesla.com";
          const path = region === "TR" ? "/tr_TR/inventory/new/my" : "/inventory/new/my";
          chrome.tabs.create({ url: baseUrl + path });
        });
      }
    });
    
    // Listen for messages from the popup or options page
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "refreshData") {
        // If settings provided, update them first
        if (request.settings) {
          chrome.storage.sync.set(request.settings, () => {
            this.runPoll()
              .then(matches => sendResponse({ status: "success", matches }))
              .catch(error => sendResponse({ status: "error", message: error.message }));
          });
        } else {
          this.runPoll()
            .then(matches => sendResponse({ status: "success", matches }))
            .catch(error => sendResponse({ status: "error", message: error.message }));
        }
        
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
  }
};

// Initialize the app
AppController.initialize();