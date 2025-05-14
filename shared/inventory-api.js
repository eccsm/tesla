/**
 * Tesla AutoPilot Extension - Inventory API Service
 * 
 * Handles all API calls to Tesla's inventory service with fallback options,
 * error handling, and data processing.
 */

import { CONFIG, STORAGE_KEYS } from './constants.js';
import { storageService } from './storage.js';
import { formatPrice, withRetry, executeInTab } from './utils.js';

class InventoryApiService {
  constructor() {
    this.lastSearchResults = {
      totalLocalMatches: 0,
      totalOutsideMatches: 0,
      totalFiltered: 0,
      searchDate: null,
      results: []
    };
    
    this.lastCSVExport = '';
    this.lastExportTime = null;
  }
  
  /**
   * Initialize the API service
   */
  initialize() {
    console.log('Tesla Inventory API Service initialized');
    
    // Set up headers when extension is installed
    chrome.runtime.onInstalled.addListener(() => {
      this.setupApiHeaders();
    });
    
    return this;
  }
  
  /**
   * Set up headers for Tesla API requests
   */
  setupApiHeaders() {
    try {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001],
        addRules: [{
          id: 1001,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "Origin", operation: "set", value: "https://www.tesla.com" },
              { header: "Referer", operation: "set", value: "https://www.tesla.com/inventory" },
              { header: "sec-ch-ua", operation: "set", value: "\"Google Chrome\";v=\"124\", \"Chromium\";v=\"124\", \"Not A(Brand\";v=\"99\"" },
              { header: "sec-ch-ua-mobile", operation: "set", value: "?0" },
              { header: "sec-ch-ua-platform", operation: "set", value: "\"Windows\"" },
              { header: "Sec-Fetch-Site", operation: "set", value: "same-origin" },
              { header: "Sec-Fetch-Mode", operation: "set", value: "cors" },
              { header: "Sec-Fetch-Dest", operation: "set", value: "empty" }
            ]
          },
          condition: {
            urlFilter: "tesla.com/inventory/api/",
            resourceTypes: ["xmlhttprequest"] // Fixed: Removed "fetch" as it's not a valid resource type
          }
        }]
      });
      console.log('Tesla API headers setup complete');
    } catch (error) {
      console.error('Error setting up Tesla API headers:', error);
    }
  }
  
  /**
   * Create a safe fetch function with timeout and retry capability
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @param {number} retries - Number of retries
   * @returns {Promise<Response>} Fetch response
   */
  async safeFetch(url, options = {}, timeout = CONFIG.API.TIMEOUT, retries = CONFIG.API.MAX_RETRIES) {
    return withRetry(
      async () => {
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
          
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      { maxRetries: retries, baseDelay: 500, maxDelay: 5000 }
    );
  }
  
  /**
   * Fetch inventory from Tesla API
   * @param {Object} filters - Inventory filters
   * @returns {Promise<Array>} Array of inventory items
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
      const regionConfig = CONFIG.REGIONS[options.region] || CONFIG.REGIONS.US;
      
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
        outsideSearch: false,
        isFalconDeliverySelectionEnabled: false,
        version: CONFIG.API.VERSION
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
        ? `${regionConfig.baseUrl}/inventory/api/${CONFIG.API.VERSION}/inventory-results`
        : `https://www.tesla.com/inventory/api/${CONFIG.API.VERSION}/inventory-results`;
      
      const localUrl = `${baseApiUrl}?query=${encodeURIComponent(localQuery)}`;
      
      console.log("Fetching Tesla inventory with browser-like request...");
      
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': options.region === "TR"
          ? 'tr-TR,tr;q=0.9'
          : 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
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
        
        return {
          success: true,
          method: "api",
          results: results
        };
      } catch (error) {
        // If we get a specific error that suggests API blocking, try browser method
        if (
          error.message.includes("403") ||
          error.message.includes("blocked") ||
          error.message.includes("Failed to fetch") ||
          error.name === "TypeError"
        ) {
          console.log("API method failed, trying browser-based fallback...");
          return this.getInventoryViaBrowser(options);
        }
        
        // Provide more detailed error message
        console.error("Error fetching inventory:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error building inventory query:", error);
      
      // Try browser fallback for any error if feature flag enabled
      if (CONFIG.FEATURES.USE_BROWSER_FALLBACK) {
        console.log("Falling back to browser method after error");
        return this.getInventoryViaBrowser(filters);
      }
      
      throw error;
    }
  }
  
  /**
   * Get inventory using browser-based extraction (fallback method)
   * @param {Object} filters - Inventory filters
   * @returns {Promise<Object>} Results and metadata
   */
  async getInventoryViaBrowser(filters = {}) {
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
      const regionConfig = CONFIG.REGIONS[options.region] || CONFIG.REGIONS.US;
      
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
            
            // Execute the extraction function in the tab
            const vehicles = await executeInTab(tab.id, extractVehicleDataStandalone);
            console.log("Extracted vehicles:", vehicles);
            
            // Close the tab
            chrome.tabs.remove(tab.id);
            
            // Process the extracted data
            const processedVehicles = this.processVehicleData(vehicles, options, regionConfig);
            
            // Save for download
            this.lastSearchResults = {
              totalLocalMatches: processedVehicles.length,
              totalOutsideMatches: "0",
              totalFiltered: processedVehicles.length,
              searchDate: new Date().toISOString(),
              results: processedVehicles
            };
            
            // Prepare CSV data
            this.prepareCSVExport(processedVehicles);
            
            resolve({
              success: true,
              method: "browser",
              results: processedVehicles
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
  }
  
  /**
   * Format a vehicle object for consistent output
   * @param {Object} vehicle - Raw vehicle data
   * @param {Object} options - Inventory options
   * @param {Object} regionConfig - Region configuration
   * @returns {Object} Formatted vehicle object
   */
  formatVehicle(vehicle, options, regionConfig) {
    try {
      // Extract key information with null/undefined handling
      const price = parseInt(vehicle.Price) || 0;
      const vin = vehicle.VIN || '';
      const model = CONFIG.MODELS[options.model]?.displayName || 'Tesla';
      const trim = vehicle.TRIM || '';
      
      // Format price for display
      const formattedPrice = formatPrice(price, options.region);
      
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
  }
  
  /**
   * Process extracted vehicle data to match the expected format
   * @param {Array} vehicles - Extracted vehicle data
   * @param {Object} options - Inventory options
   * @param {Object} regionConfig - Region configuration
   * @returns {Array} Processed vehicle data
   */
  processVehicleData(vehicles, options, regionConfig) {
    try {
      // Format each vehicle to match our standard format
      return vehicles.map(vehicle => {
        // Format price for display
        const formattedPrice = formatPrice(vehicle.price, options.region);
        
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
  
  /**
   * Prepare CSV export data
   * @param {Array} vehicles - Vehicle data
   * @returns {string} CSV content
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
  }
  
  /**
   * Download the last CSV export
   * @returns {Promise<boolean>} Success status
   */
  async downloadCSV() {
    if (!this.lastCSVExport) {
      console.error("No CSV data available for download");
      return false;
    }
    
    try {
      // For Manifest V3 service worker, we need to send this to a content script
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: "downloadCSV", 
              csvContent: this.lastCSVExport 
            }, (response) => {
              resolve(response?.success || false);
            });
          } else {
            console.error("No active tab to download CSV");
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error("Error downloading CSV:", error);
      return false;
    }
  }
  
  /**
   * Open Tesla inventory in browser
   * @param {Object} filters - Inventory filters
   * @returns {Promise<Object>} Result with URL
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
      const regionConfig = CONFIG.REGIONS[options.region] || CONFIG.REGIONS.US;
      
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
  }
}

// Export a singleton instance
export const inventoryApiService = new InventoryApiService();