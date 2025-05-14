// ========================
// Service Manager Module
// ========================
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

// ========================
// Tesla Inventory Service
// ========================
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
   * Enhanced Tesla Inventory API Access
   * 
   * This version uses browser-like headers and follows Tesla's expected request pattern
   * to avoid 403 Forbidden errors and other API blocking mechanisms.
   */
  async  fetchInventory(filters = {}) {
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
      
      // Build inventory query using Tesla's expected structure
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
        count: 50, // Reduced count to avoid suspicion
        outsideOffset: 0,
        outsideSearch: false
      };
      
      // Add trim levels if provided
      if (options.trimLevels && Array.isArray(options.trimLevels) && options.trimLevels.length > 0) {
        queryObject.query.options.TRIM = options.trimLevels;
      }
      
      // Add autopilot filter if provided
      if (options.autopilot && Array.isArray(options.autopilot) && options.autopilot.length > 0) {
        queryObject.query.options.AUTOPILOT = options.autopilot;
      }
      
      // Create proper Tesla-like request
      const localQuery = JSON.stringify(queryObject);
      
      // Determine if we're using the TR or US endpoint
      const baseApiUrl = options.region === "TR" 
        ? "https://www.tesla.com/tr_TR/inventory/api/v1/inventory-results"
        : "https://www.tesla.com/inventory/api/v1/inventory-results";
      
      const localUrl = `${baseApiUrl}?query=${encodeURIComponent(localQuery)}`;
      
      console.log("Fetching Tesla inventory with browser-like request...");
      
      // Create proper headers to mimic a real browser
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': options.region === "TR" ? 'tr-TR,tr;q=0.9' : 'en-US,en;q=0.9',
        'Referer': options.region === "TR" 
          ? 'https://www.tesla.com/tr_TR/inventory/new/my'
          : 'https://www.tesla.com/inventory/new/my',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'DNT': '1'
      };
      
      try {
        // Use fetch with proper headers
        const response = await fetch(localUrl, {
          method: 'GET',
          headers: headers,
          credentials: 'same-origin', // Important for cookies
          cache: 'no-cache',
          redirect: 'follow'
        });
        
        // Check for error responses
        if (!response.ok) {
          // Special handling for common error codes
          if (response.status === 403) {
            throw new Error("Access denied by Tesla (403). Tesla may have updated their API or blocked automated access.");
          } else if (response.status === 429) {
            throw new Error("Rate limited by Tesla (429). Please try again later.");
          } else {
            throw new Error(`API returned status: ${response.status}`);
          }
        }
        
        // Parse the JSON response
        const localResponse = await response.json();
        
        // Process and return local results
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
        // Provide more detailed error message
        console.error("Error fetching inventory:", error);
        
        // Check if it's a network error (likely CORS related)
        if (error.message.includes("Failed to fetch") || error.name === "TypeError") {
          throw new Error("Network error accessing Tesla inventory. This may be due to CORS restrictions or Tesla blocking automated access.");
        }
        
        throw error;
      }
    } catch (error) {
      console.error("Error building inventory query:", error);
      throw error;
    }
  },

  /**
 * Open Tesla inventory in new tab as a fallback method
 * @param {Object} filters - The inventory filters
 * @returns {Promise<void>}
 */
  async openTeslaInventoryTab(filters = {}) {
    try {
      const options = {
        region: "US",
        model: "my",
        condition: "new",
        ...filters
      };
      
      // Get region configuration
      const regionConfig = this.REGION_CONFIGS[options.region] || this.REGION_CONFIGS.US;
      
      // Build the Tesla inventory URL
      let url = `${regionConfig.baseUrl}/inventory/${options.condition}/${options.model}`;
      
      // Add query parameters
      const params = new URLSearchParams();
      
      // Add price if provided
      if (options.priceMax && options.priceMax > 0) {
        params.append("price", options.priceMax);
      }
      
      // Add range if provided
      if (options.range && options.range > 0) {
        params.append("range", options.range);
      }
      
      // Add zip if provided
      if (options.zip) {
        params.append("zip", options.zip);
      }
      
      // Always sort by price
      params.append("arrangeby", "Price");
      
      // Build the full URL
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
      
      // Open the URL in a new tab
      chrome.tabs.create({ url });
      
      console.log(`Opened Tesla inventory in new tab: ${url}`);
      
      return {
        success: true,
        method: "redirect",
        url
      };
    } catch (error) {
      console.error("Error opening Tesla inventory tab:", error);
      return {
        success: false,
        error: error.message
      };
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
      // For Manifest V3 service worker, we need to send this to a content script
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: "downloadCSV", 
            csvContent: this.lastCSVExport 
          });
          return true;
        } else {
          console.error("No active tab to download CSV");
          return false;
        }
      });
      return true;
    } catch (error) {
      console.error("Error downloading CSV:", error);
      return false;
    }
  },

// Modify your getInventoryViaBrowser method like this:
getInventoryViaBrowser: async function(filters = {}) {
  try {
    console.log("Using browser-based inventory solution...");
    
    // Get region and model from filters
    const options = {
      region: filters.region || "US",
      model: filters.model || "my",
      condition: filters.condition || "new",
      priceMax: filters.priceMax || null,
      zip: filters.zip || null,
      range: filters.range || 0
    };
    
    // Get region configuration
    const regionConfig = this.REGION_CONFIGS[options.region] || this.REGION_CONFIGS.US;
    
    // Build Tesla inventory URL
    let url = `${regionConfig.baseUrl}/inventory/${options.condition}/${options.model}`;
    
    // Add query parameters
    const params = new URLSearchParams();
    
    // Add price if provided
    if (options.priceMax && options.priceMax > 0) {
      params.append("price", options.priceMax);
    }
    
    // Add range if provided
    if (options.range && options.range > 0) {
      params.append("range", options.range);
    }
    
    // Add zip if provided
    if (options.zip) {
      params.append("zip", options.zip);
    }
    
    // Always sort by price
    params.append("arrangeby", "Price");
    
    // Build the full URL
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    // Create a new tab with the Tesla inventory URL
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url, active: false }, async (tab) => {
        try {
          // Wait for the page to fully load - increase this if needed
          await new Promise(r => setTimeout(r, 7000));
          
          // Define a standalone function for page extraction
          // This is essential - it doesn't rely on TeslaInventoryService context
          const extractVehicleDataStandalone = function() {
            try {
              // Find all vehicle cards on the page
              const vehicleCards = Array.from(document.querySelectorAll('.result-list .result-tile'));
              console.log("Found vehicle cards:", vehicleCards.length);
              
              if (vehicleCards.length === 0) {
                // Try alternative selectors based on Tesla's current website
                const altCards = Array.from(document.querySelectorAll('[data-tesla-inventory]'));
                console.log("Found alternative cards:", altCards.length);
                
                if (altCards.length > 0) {
                  return altCards.map(card => {
                    try {
                      const priceEl = card.querySelector('[data-tesla-inventory-price]');
                      const price = priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) : 0;
                      
                      const vinEl = card.querySelector('[data-tesla-vin]');
                      const vin = vinEl ? vinEl.getAttribute('data-tesla-vin') : '';
                      
                      const modelEl = card.querySelector('h2, h3, [data-tesla-model]');
                      const model = modelEl ? modelEl.textContent.trim() : '';
                      
                      const trimEl = card.querySelector('[data-tesla-trim]');
                      const trim = trimEl ? trimEl.textContent.trim() : '';
                      
                      const linkEl = card.querySelector('a');
                      const inventoryUrl = linkEl ? window.location.origin + linkEl.getAttribute('href') : '';
                      
                      return {
                        price,
                        vin,
                        model,
                        trim,
                        inventoryUrl,
                        raw: card.outerHTML
                      };
                    } catch (e) {
                      console.error("Error parsing card:", e);
                      return null;
                    }
                  }).filter(item => item !== null);
                }
                
                // As a last resort, try to get any useful data from the page
                console.log("No standard card structures found, getting all possible data");
                
                // Look for any price elements
                const priceElements = document.querySelectorAll('[data-id*="price"], .price, [class*="price"]');
                const vinElements = document.querySelectorAll('[data-id*="vin"], [class*="vin"]');
                
                // Return raw page data for debugging
                return [{
                  message: "No standard structure found. Raw elements available.",
                  priceElementsFound: priceElements.length,
                  vinElementsFound: vinElements.length,
                  pageTitle: document.title,
                  url: window.location.href,
                  htmlSample: document.body.innerHTML.substring(0, 5000) // Sample of page HTML
                }];
              }
              
              // Extract data from each vehicle card
              const vehicles = vehicleCards.map(card => {
                try {
                  // Try to extract the price
                  const priceElement = card.querySelector('.result-price');
                  const price = priceElement ? 
                    parseInt(priceElement.textContent.replace(/[^0-9]/g, '')) : 0;
                  
                  // Extract VIN from link or data attribute
                  let vin = '';
                  const linkElement = card.querySelector('a');
                  if (linkElement) {
                    const href = linkElement.getAttribute('href') || '';
                    const vinMatch = href.match(/\/([A-Z0-9]{17})$/);
                    if (vinMatch) {
                      vin = vinMatch[1];
                    }
                  }
                  
                  // Get all specifications
                  const specsElements = card.querySelectorAll('.result-option');
                  const specs = {};
                  specsElements.forEach(spec => {
                    const label = spec.querySelector('.option-label');
                    const value = spec.querySelector('.option-value');
                    if (label && value) {
                      specs[label.textContent.trim()] = value.textContent.trim();
                    }
                  });
                  
                  // Extract trim level
                  const trimElement = card.querySelector('.result-subtitle');
                  const trim = trimElement ? trimElement.textContent.trim() : '';
                  
                  // Extract model
                  const modelElement = card.querySelector('.result-title');
                  const model = modelElement ? modelElement.textContent.trim() : '';
                  
                  // Add link
                  const inventoryUrl = linkElement ? window.location.origin + linkElement.getAttribute('href') : '';
                  
                  // Return the vehicle data
                  return {
                    price,
                    vin,
                    model,
                    trim,
                    inventoryUrl,
                    specs,
                    raw: card.outerHTML // Include raw HTML for debugging
                  };
                } catch (cardError) {
                  console.warn("Error extracting data from vehicle card:", cardError);
                  return null;
                }
              }).filter(vehicle => vehicle !== null);
              
              return vehicles;
            } catch (error) {
              console.error("Error extracting vehicle data from page:", error);
              return [];
            }
          };
          
          // Inject content script to extract vehicle data
          // Use the standalone function instead of this.extractVehicleData
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractVehicleDataStandalone,
          }, (results) => {
            if (chrome.runtime.lastError) {
              chrome.tabs.remove(tab.id);
              reject(chrome.runtime.lastError);
              return;
            }

            // Get the extracted data
            const vehicles = results[0].result;
            console.log("Extracted vehicles:", vehicles);
            
            // Close the tab
            chrome.tabs.remove(tab.id);
            
            // Process the extracted data
            const processedVehicles = this.processVehicleData(vehicles, options, regionConfig);
            
            resolve({
              success: true,
              method: "browser",
              results: processedVehicles
            });
          });
        } catch (error) {
          // Close the tab if there was an error
          chrome.tabs.remove(tab.id);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("Error in browser-based inventory extraction:", error);
    throw error;
  }
},
  
  /**
   * Extract vehicle data from Tesla's inventory page DOM
   * This function runs in the context of the page via chrome.scripting.executeScript
   */
  extractVehicleData: function() {
    try {
      // Find all vehicle cards on the page
      const vehicleCards = Array.from(document.querySelectorAll('.result-list .result-tile'));
      const vehicles = [];
      
      // Extract data from each vehicle card
      vehicleCards.forEach(card => {
        try {
          // Try to extract the price
          const priceElement = card.querySelector('.result-price');
          const price = priceElement ? 
            parseInt(priceElement.textContent.replace(/[^0-9]/g, '')) : 0;
          
          // Extract VIN from link or data attribute
          let vin = '';
          const linkElement = card.querySelector('a');
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            const vinMatch = href.match(/\/([A-Z0-9]{17})$/);
            if (vinMatch) {
              vin = vinMatch[1];
            }
          }
          
          // Get all specifications
          const specsElements = card.querySelectorAll('.result-option');
          const specs = {};
          specsElements.forEach(spec => {
            const label = spec.querySelector('.option-label');
            const value = spec.querySelector('.option-value');
            if (label && value) {
              specs[label.textContent.trim()] = value.textContent.trim();
            }
          });
          
          // Extract trim level
          const trimElement = card.querySelector('.result-subtitle');
          const trim = trimElement ? trimElement.textContent.trim() : '';
          
          // Extract model
          const modelElement = card.querySelector('.result-title');
          const model = modelElement ? modelElement.textContent.trim() : '';
          
          // Add link
          const inventoryUrl = linkElement ? window.location.origin + linkElement.getAttribute('href') : '';
          
          // Add to vehicles array
          vehicles.push({
            price,
            vin,
            model,
            trim,
            inventoryUrl,
            specs,
            raw: card.outerHTML // Include raw HTML for debugging
          });
        } catch (cardError) {
          console.warn("Error extracting data from vehicle card:", cardError);
        }
      });
      
      return vehicles;
    } catch (error) {
      console.error("Error extracting vehicle data from page:", error);
      return [];
    }
  },
  
  /**
   * Process extracted vehicle data to match the expected format
   */
  processVehicleData: function(vehicles, options, regionConfig) {
    try {
      // Format each vehicle to match our standard format
      return vehicles.map(vehicle => {
        // Format price for display
        const formattedPrice = `${regionConfig.currencySymbol}${vehicle.price.toLocaleString(regionConfig.numberFormat)}`;
        
        return {
          price: vehicle.price,
          formattedPrice,
          vin: vehicle.vin,
          model: vehicle.model,
          trim: vehicle.trim,
          inventoryUrl: vehicle.inventoryUrl,
          lastSeen: new Date().toISOString(),
          // Keep the raw data for debugging
          raw: vehicle
        };
      });
    } catch (error) {
      console.error("Error processing vehicle data:", error);
      return vehicles; // Return original data on error
    }
  }
};

// ========================
// Inventory Monitor
// ========================
// Default filters
const DEFAULT_FILTERS = {
  region: "US",
  model: "my",
  condition: "new",
  priceMax: 45000,
  range: 0
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

// ========================
// MAIN INITIALIZATION
// ========================

// Initialize the services
console.log("Starting Tesla AutoPilot service worker initialization...");
TeslaInventoryService.initialize();
InventoryMonitor.initialize();

// Handle messages from popup or content scripts
// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request.action);
  
  // In background.js - Update the fetchInventory message handler
  if (request.action === "fetchInventory") {
    // First try the API
    TeslaInventoryService.fetchInventory(request.filters)
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        console.error("API-based inventory retrieval failed:", error);
        
        // If API fails, try browser-based approach
        TeslaInventoryService.getInventoryViaBrowser(request.filters)
          .then(browserResults => {
            sendResponse({ 
              success: true, 
              results: browserResults.results,
              method: "browser" 
            });
          })
          .catch(browserError => {
            console.error("Browser-based inventory retrieval failed:", browserError);
            sendResponse({ 
              success: false, 
              error: `API error: ${error.message}. Browser error: ${browserError.message}` 
            });
          });
      });
    return true;
  }
  
  if (request.action === "checkInventory") {
    InventoryMonitor.checkInventory()
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        console.error("Error in checkInventory:", error);
        
        // If API access failed, use the fallback method
        if (error.message.includes("403") || 
            error.message.includes("Failed to fetch") || 
            error.message.includes("Network error")) {
          
          // For checkInventory, we'll just inform the user that automated checks
          // are not possible and suggest using the browser method
          sendResponse({ 
            success: false, 
            fallback: true,
            error: "Automated inventory checks are currently not possible. Tesla may have updated their API or is blocking automated access. Try using the 'Open Tesla Inventory' button instead." 
          });
        } else {
          sendResponse({ success: false, error: error.message || String(error) });
        }
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
  
  // Set up initial monitoring if enabled
  InventoryMonitor.initialize();
});

// Listen for alarm events
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "tesla-inventory-monitor") {
    InventoryMonitor.checkInventory().catch(error => {
      console.error("Error in global alarm handler:", error);
    });
  }
});

console.log("Tesla AutoPilot service worker fully initialized!");