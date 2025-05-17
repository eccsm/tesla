/**
 * Tesla Inventory Monitor - Inventory API Service
 */

import { CONFIG, STORAGE_KEYS } from './constants.js';
import { formatPrice, withRetry, executeInTab } from './utils.js';

class InventoryApiService {
    constructor() {
        this.lastSearchResults = {
            totalMatches: 0,
            searchDate: null,
            results: []
        };
    }

    /**
     * Initialize the API service
     */
    async initialize() {
        console.log('Tesla Inventory API Service initializing...');
        await this.setupApiHeaders();
        return this;
    }

    /**
     * Set up headers for Tesla API requests
     */
    async setupApiHeaders() {
        try {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [1001],
                addRules: [{
                    id: 1001,
                    priority: 1,
                    action: {
                        type: "modifyHeaders",
                        requestHeaders: [
                            { header: "Origin", operation: "set", value: "https://www.tesla.com" },
                            { header: "Referer", operation: "set", value: "https://www.tesla.com/inventory" },
                            { header: "sec-ch-ua-mobile", operation: "set", value: "?0" },
                            { header: "sec-ch-ua-platform", operation: "set", value: "\"Windows\"" },
                            { header: "Sec-Fetch-Site", operation: "set", value: "same-origin" },
                            { header: "Sec-Fetch-Mode", operation: "set", value: "cors" },
                            { header: "Sec-Fetch-Dest", operation: "set", value: "empty" }
                        ]
                    },
                    condition: {
                        urlFilter: "tesla.com/inventory/api/",
                        resourceTypes: ["xmlhttprequest"]
                    }
                }]
            });
            console.log('Tesla API headers setup complete');
        } catch (error) {
            console.error('Error setting up Tesla API headers:', error);
            throw error;
        }
    }

    /**
     * Fetch inventory from Tesla API
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Inventory results
     */
    async fetchInventory(filters = {}) {
        try {
            const options = {
                query: {
                    model: filters.model || 'my',
                    condition: filters.condition || 'new',
                    arrangeby: 'Price',
                    order: 'asc',
                    market: filters.region || 'US',
                    language: filters.language || 'en',
                    super_region: filters.region === 'TR' ? 'Europe' : 'North America',
                    zip: filters.zip || '94043',
                    range: filters.range || 200,
                    price_from: filters.priceMin || '',
                    price_to: filters.priceMax || '',
                    version: filters.trim || '',
                    options: filters.options || {}
                }
            };

            // Build URL with query parameters
            const url = new URL(CONFIG.API.ENDPOINTS.INVENTORY);
            Object.entries(options.query).forEach(([key, value]) => {
                if (value) url.searchParams.append(key, value);
            });

            // Fetch inventory data
            const response = await this.safeFetch(url.toString());
            const data = await response.json();

            // Process and store results
            this.lastSearchResults = {
                totalMatches: data.total_matches_found || 0,
                searchDate: new Date().toISOString(),
                results: this.processInventoryResults(data.results || [], filters)
            };

            return this.lastSearchResults;
        } catch (error) {
            console.error('Error fetching inventory:', error);
            
            // Try fallback method
            return this.getInventoryViaBrowser(filters);
        }
    }

    /**
     * Get inventory using browser-based extraction (fallback method)
     * @param {Object} filters - Search filters
     * @returns {Promise<Object>} Results and metadata
     */
    async getInventoryViaBrowser(filters = {}) {
        try {
            // Create Tesla inventory URL
            const url = this.buildInventoryUrl(filters);
            
            // Open tab and inject extraction script
            const tab = await chrome.tabs.create({ url, active: false });
            
            // Wait for page load
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Extract data
            const results = await executeInTab(tab.id, this.extractInventoryData);
            
            // Close tab
            chrome.tabs.remove(tab.id);
            
            // Process results
            this.lastSearchResults = {
                totalMatches: results.length,
                searchDate: new Date().toISOString(),
                results: this.processInventoryResults(results, filters)
            };
            
            return this.lastSearchResults;
        } catch (error) {
            console.error('Error getting inventory via browser:', error);
            throw error;
        }
    }

    /**
     * Extract inventory data from page
     * @returns {Array} Extracted vehicle data
     */
    extractInventoryData() {
        const vehicles = [];
        const cards = document.querySelectorAll('[data-tesla-inventory-card]');
        
        cards.forEach(card => {
            try {
                const data = {
                    vin: card.getAttribute('data-vin'),
                    model: card.querySelector('[data-tesla-model]')?.textContent,
                    trim: card.querySelector('[data-tesla-trim]')?.textContent,
                    price: card.querySelector('[data-tesla-price]')?.textContent,
                    range: card.querySelector('[data-tesla-range]')?.textContent,
                    acceleration: card.querySelector('[data-tesla-acceleration]')?.textContent,
                    color: card.querySelector('[data-tesla-color]')?.textContent,
                    wheels: card.querySelector('[data-tesla-wheels]')?.textContent,
                    interior: card.querySelector('[data-tesla-interior]')?.textContent
                };
                
                vehicles.push(data);
            } catch (error) {
                console.error('Error extracting vehicle data:', error);
            }
        });
        
        return vehicles;
    }

    /**
     * Process inventory results
     * @param {Array} results - Raw inventory results
     * @param {Object} filters - Search filters
     * @returns {Array} Processed results
     */
    processInventoryResults(results, filters = {}) {
        return results.map(vehicle => {
            const regionConfig = CONFIG.REGIONS[filters.region || 'US'];
            
            return {
                vin: vehicle.vin,
                model: CONFIG.MODELS[vehicle.model] || vehicle.model,
                trim: CONFIG.TRIMS[vehicle.trim] || vehicle.trim,
                price: formatPrice(vehicle.price, regionConfig.currency),
                range: vehicle.range,
                acceleration: vehicle.acceleration,
                color: vehicle.color,
                wheels: vehicle.wheels,
                interior: vehicle.interior,
                lastSeen: new Date().toISOString()
            };
        });
    }

    /**
     * Build Tesla inventory URL
     * @param {Object} filters - Search filters
     * @returns {string} Inventory URL
     */
    buildInventoryUrl(filters = {}) {
        const regionConfig = CONFIG.REGIONS[filters.region || 'US'];
        const baseUrl = regionConfig.baseUrl;
        
        const url = new URL(`${baseUrl}/inventory/${filters.condition || 'new'}/${filters.model || 'my'}`);
        
        const params = new URLSearchParams();
        if (filters.zip) params.append('zip', filters.zip);
        if (filters.range) params.append('range', filters.range);
        if (filters.priceMax) params.append('price', filters.priceMax);
        params.append('arrangeby', 'Price');
        
        const queryString = params.toString();
        if (queryString) url.search = `?${queryString}`;
        
        return url.toString();
    }

    /**
     * Safe fetch with timeout and retry
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async safeFetch(url, options = {}) {
        return withRetry(
            async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);
                
                try {
                    const response = await fetch(url, {
                        ...options,
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            ...(options.headers || {})
                        }
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`API returned status: ${response.status}`);
                    }
                    
                    return response;
                } catch (error) {
                    clearTimeout(timeoutId);
                    throw error;
                }
            },
            {
                maxRetries: CONFIG.API.MAX_RETRIES,
                baseDelay: 1000,
                maxDelay: 5000
            }
        );
    }
}

// Export singleton instance
export const inventoryApiService = new InventoryApiService();
