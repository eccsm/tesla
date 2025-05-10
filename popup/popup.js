/**
 * Tesla AutoPilot Popup Script
 * 
 * Enhanced with Tesla-specific filters and direct price input
 */

// Language strings for localization
const i18n = {
  US: {
    loading: "Loading...",
    empty: "No cars under your price threshold yet.",
    lastUpdated: "Last updated:",
    fillForm: "Fill Form",
    showPanel: "Show Panel",
    settings: "Settings",
    applyFilters: "Apply Filters",
    noActiveTab: "No active tab found",
    formFillingFailed: "Form filling failed",
    tabError: "Tab communication error",
    unknownError: "Unknown error",
    errorLoading: "Error loading results. Please try again.",
    openTesla: "Opening Tesla website...",
    fieldsField: "fields filled",
    openingOrder: "Opening order page with your settings...",
    connectionError: "Could not connect to Tesla page. Opening a new tab...",
    notTeslaPage: "Not on a Tesla page. Opening Tesla website...",
    filtersApplied: "Filters applied successfully",
    refreshing: "Refreshing results..."
  },
  TR: {
    loading: "Yükleniyor...",
    empty: "Henüz fiyat eşiğinin altında araç yok.",
    lastUpdated: "Son güncelleme:",
    fillForm: "Formu Doldur",
    showPanel: "Panel Göster",
    settings: "Ayarlar",
    applyFilters: "Filtreleri Uygula",
    noActiveTab: "Aktif sekme bulunamadı",
    formFillingFailed: "Form doldurma başarısız",
    tabError: "Sekme ile iletişim hatası",
    unknownError: "Bilinmeyen hata",
    errorLoading: "Sonuçlar yüklenirken hata oluştu.",
    openTesla: "Tesla websitesi açılıyor...",
    fieldsField: "alan dolduruldu",
    openingOrder: "Ayarlarınızla sipariş sayfası açılıyor...",
    connectionError: "Tesla sayfasına bağlanılamadı. Yeni sekme açılıyor...",
    notTeslaPage: "Tesla sayfasında değilsiniz. Tesla websitesi açılıyor...",
    filtersApplied: "Filtreler başarıyla uygulandı",
    refreshing: "Sonuçlar yenileniyor..."
  }
};

// Model configuration
const MODELS = {
  MODEL_Y: {
    id: "my",
    name: "Model Y"
  },
  MODEL_3: {
    id: "m3",
    name: "Model 3"
  },
  MODEL_S: {
    id: "ms",
    name: "Model S"
  },
  MODEL_X: {
    id: "mx",
    name: "Model X"
  },
  CYBERTRUCK: {
    id: "ct",
    name: "Cybertruck"
  }
};

// Payment Types
const PAYMENT_TYPES = {
  CASH: "cash",
  LEASE: "lease",
  FINANCE: "finance"
};

// Region-specific defaults
const REGION_DEFAULTS = {
  US: {
    priceFloor: 60000,
    zip: "94401"
  },
  TR: {
    priceFloor: 1590000,
    zip: "06000"
  }
};

// Region Manager
const RegionManager = {
  // Get current region
  async getRegion() {
    try {
      const { region = "US" } = await chrome.storage.sync.get("region");
      return region;
    } catch (error) {
      console.error("Error getting region:", error);
      return "US";
    }
  },
  
  // Set region
  async setRegion(region) {
    try {
      await chrome.storage.sync.set({ region });
      return true;
    } catch (error) {
      console.error("Error setting region:", error);
      return false;
    }
  },
  
  // Get localized string
  async getString(key) {
    const region = await this.getRegion();
    const strings = i18n[region] || i18n.US;
    return strings[key] || key;
  },
  
  // Update UI based on current region
  async updateUI() {
    const region = await this.getRegion();
    
    // Update region selector
    document.getElementById("region").value = region;
    
    // Update buttons text
    document.querySelectorAll("[data-i18n]").forEach(async (el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = await this.getString(key);
    });
    
    // Update apply filters button
    document.getElementById("apply-filters").textContent = await this.getString("applyFilters");
    
    // Update placeholders for price input with currency symbol
    const priceInput = document.getElementById("price-input");
    const currencySymbol = region === "TR" ? "₺" : "$";
    priceInput.placeholder = `Enter maximum price (${currencySymbol})`;
    
    // Refresh results
    await ResultsManager.loadResults();
  }
};

// Filter Manager - Fixed with correct parameter names
const FilterManager = {
  // Initialize filters from storage
  async initializeFilters() {
    // Get region for defaults
    const region = await RegionManager.getRegion();
    const defaults = REGION_DEFAULTS[region] || REGION_DEFAULTS.US;
    
    // Get saved filters
    const {
      model = "my",
      paymentType = "cash",
      priceMax = defaults.priceMax,  // FIXED: Changed from priceFloor to priceMax
      zip = defaults.zip,
      includeTaxCredit = true
    } = await chrome.storage.sync.get([
      "model", 
      "paymentType", 
      "priceMax",  // FIXED: Changed from priceFloor to priceMax
      "zip",
      "includeTaxCredit"
    ]);
    
    // Update model radio buttons
    const modelRadios = document.querySelectorAll('input[name="model"]');
    modelRadios.forEach(radio => {
      radio.checked = radio.value === model;
    });
    
    // Update payment type radio buttons
    const paymentRadios = document.querySelectorAll('input[name="payment"]');
    paymentRadios.forEach(radio => {
      radio.checked = radio.value === paymentType;
    });
    
    // Update price input
    const priceInput = document.getElementById("price-input");
    priceInput.value = priceMax;  // FIXED: Changed from priceFloor to priceMax
    
    // Update ZIP code
    document.getElementById("zip").value = zip;
    
    // Update tax credit checkbox
    document.getElementById("tax-credit").checked = includeTaxCredit;
  },
  
  // Get current filter values from UI
  getFiltersFromUI() {
    // Get selected model
    const modelRadios = document.querySelectorAll('input[name="model"]');
    let selectedModel = "my"; // Default to Model Y
    modelRadios.forEach(radio => {
      if (radio.checked) {
        selectedModel = radio.value;
      }
    });
    
    // Get selected payment type
    const paymentRadios = document.querySelectorAll('input[name="payment"]');
    let selectedPayment = "cash"; // Default to Cash
    paymentRadios.forEach(radio => {
      if (radio.checked) {
        selectedPayment = radio.value;
      }
    });
    
    // Get price from input
    const priceInput = document.getElementById("price-input");
    let priceMax = 0;  // FIXED: Changed from priceFloor to priceMax
    
    // Validate price input
    if (priceInput.value && !isNaN(priceInput.value)) {
      priceMax = parseInt(priceInput.value);  // FIXED: Changed from priceFloor to priceMax
    } else {
      // Use region-specific default if invalid
      const region = RegionManager.getRegion();
      const defaults = REGION_DEFAULTS[region] || REGION_DEFAULTS.US;
      priceMax = defaults.priceMax;  // FIXED: Changed from priceFloor to priceMax
    }
    
    // Get ZIP code
    const zip = document.getElementById("zip").value.trim();
    
    // Get tax credit inclusion
    const includeTaxCredit = document.getElementById("tax-credit").checked;
    
    return {
      model: selectedModel,
      paymentType: selectedPayment,
      priceMax: priceMax,  // FIXED: Changed from priceFloor to priceMax
      zip,
      includeTaxCredit
    };
  },
  
  // Save filters to storage
  async saveFilters() {
    const filters = this.getFiltersFromUI();
    await chrome.storage.sync.set(filters);
    return filters;
  }
};

// Results Manager - Enhanced version
const ResultsManager = {
  // Get the root element for displaying results
  getRoot() {
    return document.getElementById("list");
  },
  
  // Updated loading and empty state renderers
  async showLoading() {
    const loadingText = await RegionManager.getString("loading");
    this.getRoot().className = "loading";
    this.getRoot().innerHTML = `
      <div class="loading-spinner"></div>
      ${loadingText}
    `;
  },

  async showEmpty() {Frenderre
    const emptyText = await RegionManager.getString("empty");
    this.getRoot().className = "empty";
    this.getRoot().innerHTML = emptyText;
  },
  
  
  // Format price for display
  async formatPrice(price) {
    const region = await RegionManager.getRegion();
    const regionConfig = {
      US: { symbol: "$", locale: "en-US" },
      TR: { symbol: "₺", locale: "tr-TR" }
    }[region] || { symbol: "$", locale: "en-US" };
    
    return regionConfig.symbol + price.toLocaleString(regionConfig.locale);
  },
  
// Updated vehicle item renderer with improved HTML structure
async renderCarItem(car) {
  // Format price for display
  const formattedPrice = car.formattedPrice || await this.formatPrice(car.price);
  
  // Get URL for the car
  const carUrl = car.url || `https://www.tesla.com${car.VINUrl || car.VINUrlP || ''}`;
  
  // Get model and trim
  const model = car.model || car.Model || 'Tesla';
  const trim = car.trim || car.TRIM || '';
  
  // Get VIN if available (shortened for display)
  const vin = car.vin || car.VIN || '';
  const displayVin = vin ? `VIN: ${vin.substring(vin.length - 6)}` : '';
  
  // Build HTML with better structure and styling classes
  return `
    <a href="${carUrl}"
       target="_blank" 
       class="row"
       data-vin="${vin}"
       data-path="${car.VINUrl || car.VINUrlP || ''}">
      <div class="vehicle-info">
        <span class="vehicle-model">${model}</span>
        <span class="vehicle-trim">${trim}</span>
        ${displayVin ? `<span class="vehicle-vin">${displayVin}</span>` : ''}
      </div>
      <span class="vehicle-price">${formattedPrice}</span>
    </a>`;
},
  
  // Updated renderResults method with class restoration
  async renderResults(cars) {
    if (!cars || cars.length === 0) {
      await this.showEmpty();
      return;
    }
    
    // Sort by price ascending
    const sortedCars = [...cars].sort((a, b) => {
      const priceA = a.price || a.PurchasePrice || 0;
      const priceB = b.price || b.PurchasePrice || 0;
      return priceA - priceB;
    });
    
    // Take the first 5 results
    const topCars = sortedCars.slice(0, 5);
    
    // Render each car
    const renderedItems = await Promise.all(topCars.map(car => this.renderCarItem(car)));
    
    // Get the root element
    const rootElement = this.getRoot();
    
    // Reset the element class to default (remove loading/empty classes)
    rootElement.className = "";
    
    // Update the DOM
    rootElement.innerHTML = renderedItems.join("");
    
    // Add click handlers
    this.attachClickHandlers();
  },
  
  // Attach click handlers to car items for direct order filling
  attachClickHandlers() {
    const items = document.querySelectorAll("#list .row");
    
    items.forEach(item => {
      item.addEventListener("click", async (e) => {
        // If Ctrl/Cmd key is pressed, let the default browser behavior work
        if (e.ctrlKey || e.metaKey) return;
        
        // Otherwise, prevent default and handle it ourselves
        e.preventDefault();
        
        const path = item.getAttribute("data-path");
        const vin = item.getAttribute("data-vin");
        
        if (path) {
          await FormController.openOrderPage(path, vin);
        }
      });
    });
  },
  
  // Load and display results
  async loadResults() {
    await this.showLoading();
    
    try {
      const { lastResults = [], lastUpdated } = await chrome.storage.local.get(["lastResults", "lastUpdated"]);
      
      // Show timestamp if available
      if (lastUpdated) {
        const region = await RegionManager.getRegion();
        const locale = region === "TR" ? "tr-TR" : "en-US";
        const timeStr = new Date(lastUpdated).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        const lastUpdatedText = await RegionManager.getString("lastUpdated");
        document.getElementById("lastUpdated").textContent = `${lastUpdatedText} ${timeStr}`;
      }
      
      await this.renderResults(lastResults);
    } catch (error) {
      console.error("Error loading results:", error);
      const errorText = await RegionManager.getString("errorLoading");
      this.getRoot().textContent = errorText;
    }
  }
};

// Form Controller - Enhanced version
const FormController = {
  // Check if a tab is a Tesla page
  isTeslaPage(url) {
    return url && url.includes('tesla.com');
  },
  
  // Check if the content script is ready on a given tab
  async isContentScriptReady(tabId) {
    try {
      // Send a simple ping message to check if the content script is loaded
      const response = await chrome.tabs.sendMessage(tabId, { action: "ping" });
      return response && response.status === "pong";
    } catch (error) {
      console.log("Content script not ready:", error);
      return false;
    }
  },
  
  // Fill form in active tab with better error handling
  async fillForm() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error("No active tab found");
        const errorText = await RegionManager.getString("noActiveTab");
        return this.showMessage(errorText, false);
      }
      
      // Check if we're on a Tesla page
      if (!this.isTeslaPage(tab.url)) {
        const notTeslaText = await RegionManager.getString("notTeslaPage");
        this.showMessage(notTeslaText, false);
        return this.openTeslaPage();
      }
      
      // Check if content script is ready
      const isReady = await this.isContentScriptReady(tab.id).catch(() => false);
      
      if (isReady) {
        // Content script is ready, send the fill form message
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: "fillForm" });
          
          if (response && response.status === "Form filled") {
            const successText = await RegionManager.getString("fieldsField");
            this.showMessage(`${response.count} ${successText}`, true);
          } else {
            const errorText = await RegionManager.getString("formFillingFailed");
            this.showMessage(errorText, false);
          }
        } catch (error) {
          console.error("Error sending message to content script:", error);
          
          // The connection error often means content script isn't properly injected
          // Try reloading the page and then opening it again
          const connectionError = await RegionManager.getString("connectionError");
          this.showMessage(connectionError, false);
          
          // Open a new Tesla tab
          this.openTeslaPage();
        }
      } else {
        // Content script isn't ready or couldn't be detected
        // Let's refresh the page to ensure content script loads properly
        chrome.tabs.reload(tab.id, {}, () => {
          // Wait for the page to reload and then try to fill the form again
          setTimeout(() => {
            try {
              chrome.tabs.sendMessage(tab.id, { action: "fillForm" })
                .catch(err => {
                  console.error("Still error after reload:", err);
                  this.openTeslaPage();
                });
            } catch (err) {
              console.error("Error after page reload:", err);
              this.openTeslaPage();
            }
          }, 3000); // Wait 3 seconds for the page to reload
        });
      }
    } catch (error) {
      console.error("Error in fillForm:", error);
      const errorText = await RegionManager.getString("unknownError");
      this.showMessage(errorText, false);
      
      // Fall back to opening a new Tesla page
      this.openTeslaPage();
    }
  },
  
// Open Tesla inventory page with correct approach
async openTeslaPage() {
  try {
    // Get current filter settings
    const filters = FilterManager.getFiltersFromUI();
    
    // Get current region
    const region = await RegionManager.getRegion();
    const regionDefaults = REGION_DEFAULTS[region] || REGION_DEFAULTS.US;
    
    // Construct the URL for browser navigation
    const baseUrl = "https://www.tesla.com";
    let path;
    
    if (region === "TR") {
      path = `/tr_TR/inventory/new/${filters.model}`;
    } else {
      path = `/inventory/new/${filters.model}`;
    }
    
    // Simple URL for browser navigation - using LET instead of CONST
    let browserUrl = `${baseUrl}${path}?arrangeby=price`;
    
    // Add parameters one by one
    if (filters.zip) {
      browserUrl += `&zip=${filters.zip}`;
    }
    
    // Include price as a regular parameter for the browser URL
    if (filters.priceMax && filters.priceMax > 0) {
      browserUrl += `&price=${filters.priceMax}`;
    }
    
    // Include payment type if specified
    if (filters.paymentType) {
      browserUrl += `&PaymentType=${filters.paymentType}`;
    }
    
    // Notify user
    const notificationText = await RegionManager.getString("openTesla");
    this.showMessage(notificationText, true);
    
    // Open the URL - using the simpler URL for browser navigation
    chrome.tabs.create({ url: browserUrl });
  } catch (error) {
    console.error("Error opening Tesla page:", error);
    
    // Fallback to basic URL
    chrome.tabs.create({ url: "https://www.tesla.com/inventory/new/my" });
  }
},
  
  // Open order page with car details and fill form
  async openOrderPage(path, vin) {
    try {
      const region = await RegionManager.getRegion();
      const baseUrl = "https://www.tesla.com";
      
      // Convert inventory URL to order URL
      const orderPath = path.replace("/inventory/", "/myorder/");
      
      // Add autoFill parameter to trigger auto-filling
      const url = new URL(baseUrl + orderPath);
      url.searchParams.set('autoFill', 'true');
      
      const notificationText = await RegionManager.getString("openingOrder");
      this.showMessage(notificationText, true);
      
      // Create a new tab with the order page
      chrome.tabs.create({ url: url.toString() });
    } catch (error) {
      console.error("Error opening order page:", error);
      
      // Fallback to basic URL
      const notificationText = await RegionManager.getString("openingOrder");
      this.showMessage(notificationText, true);
      chrome.tabs.create({ url: "https://www.tesla.com" + path });
    }
  },
  
  // Show popup notification
  async showMessage(message, isSuccess) {
    const notif = document.getElementById("notification");
    
    if (notif) {
      notif.textContent = message;
      notif.className = isSuccess ? "success" : "error";
      notif.style.display = "block";
      
      // Hide after 3 seconds
      setTimeout(() => {
        notif.style.display = "none";
      }, 3000);
    }
  },
  
  // Open options page
  openOptions() {
    chrome.runtime.openOptionsPage();
  }
};

// Panel Toggle Controller
const PanelToggleController = {
  // Toggle the panel in the active tab
  togglePanel: async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error("No active tab found");
        const errorText = await RegionManager.getString("noActiveTab");
        return FormController.showMessage(errorText, false);
      }
      
      // Check if we're on a Tesla page
      if (!FormController.isTeslaPage(tab.url)) {
        const notTeslaText = await RegionManager.getString("notTeslaPage");
        FormController.showMessage(notTeslaText, false);
        return FormController.openTeslaPage();
      }
      
      // Try to check if content script is ready
      const isReady = await FormController.isContentScriptReady(tab.id).catch(() => false);
      
      if (isReady) {
        // Try to send the toggle panel message
        try {
          await chrome.tabs.sendMessage(tab.id, { cmd: "togglePanel" });
        } catch (err) {
          console.log("Error sending toggle message, opening Tesla page instead:", err);
          FormController.openTeslaPage();
        }
      } else {
        // Content script isn't ready, open a new Tesla page
        FormController.openTeslaPage();
      }
    } catch (error) {
      console.error("Error in toggle panel:", error);
      const errorText = await RegionManager.getString("unknownError");
      FormController.showMessage(errorText, false);
      
      // Fall back to opening Tesla page
      FormController.openTeslaPage();
    }
  }
};

// Refresh data handler
const DataRefreshController = {
  // Trigger a refresh with current settings
  refreshData: async () => {
    try {
      // Show loading state
      ResultsManager.showLoading();
      
      // Get current settings from UI
      const settings = FilterManager.getFiltersFromUI();
      
      // Get region
      const region = await RegionManager.getRegion();
      settings.region = region;
      
      const refreshText = await RegionManager.getString("refreshing");
      FormController.showMessage(refreshText, true);
      
      // Trigger background refresh
      chrome.runtime.sendMessage({ 
        action: "refreshData",
        settings
      }).then(response => {
        if (response && response.status === "success") {
          // Reload results after a short delay
          setTimeout(() => {
            ResultsManager.loadResults();
          }, 500);
        } else {
          throw new Error(response?.message || "Unknown error");
        }
      }).catch(err => {
        console.error("Error refreshing data:", err);
        FormController.showMessage("Error refreshing data", false);
      });
    } catch (error) {
      console.error("Error in refreshData:", error);
      FormController.showMessage("Error refreshing data", false);
    }
  }
};

// Initialize the popup
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize filters from storage
  await FilterManager.initializeFilters();
  
  // Load the current region
  const region = await RegionManager.getRegion();
  document.getElementById("region").value = region;
  
  // Update UI with region-specific strings
  await RegionManager.updateUI();
  
  // Set up button handlers
  document.getElementById("toggle").addEventListener("click", PanelToggleController.togglePanel);
  document.getElementById("openOptions").addEventListener("click", () => FormController.openOptions());
  document.getElementById("refresh-button").addEventListener("click", DataRefreshController.refreshData);
  
  // Set up apply filters button
  document.getElementById("apply-filters").addEventListener("click", async () => {
    // Save filters
    await FilterManager.saveFilters();
    
    // Show success message
    const filtersAppliedText = await RegionManager.getString("filtersApplied");
    FormController.showMessage(filtersAppliedText, true);
    
    // Refresh data
    await DataRefreshController.refreshData();
  });
  
  // Set up region change handler
  document.getElementById("region").addEventListener("change", async (e) => {
    await RegionManager.setRegion(e.target.value);
    await RegionManager.updateUI();
    
    // Trigger a refresh with the new region
    DataRefreshController.refreshData();
  });
  
  // Initial data refresh
  DataRefreshController.refreshData();
});