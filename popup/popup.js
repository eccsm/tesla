/**
 * Tesla AutoPilot Popup Script
 * 
 * Enhanced popup with better error handling and model selection
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
    noActiveTab: "No active tab found",
    formFillingFailed: "Form filling failed",
    tabError: "Tab communication error",
    unknownError: "Unknown error",
    errorLoading: "Error loading results. Please try again.",
    openTesla: "Opening Tesla website...",
    fieldsField: "fields filled",
    openingOrder: "Opening order page with your settings...",
    connectionError: "Could not connect to Tesla page. Opening a new tab...",
    notTeslaPage: "Not on a Tesla page. Opening Tesla website..."
  },
  TR: {
    loading: "Yükleniyor...",
    empty: "Henüz fiyat eşiğinin altında araç yok.",
    lastUpdated: "Son güncelleme:",
    fillForm: "Formu Doldur",
    showPanel: "Panel Göster",
    settings: "Ayarlar",
    noActiveTab: "Aktif sekme bulunamadı",
    formFillingFailed: "Form doldurma başarısız",
    tabError: "Sekme ile iletişim hatası",
    unknownError: "Bilinmeyen hata",
    errorLoading: "Sonuçlar yüklenirken hata oluştu.",
    openTesla: "Tesla websitesi açılıyor...",
    fieldsField: "alan dolduruldu",
    openingOrder: "Ayarlarınızla sipariş sayfası açılıyor...",
    connectionError: "Tesla sayfasına bağlanılamadı. Yeni sekme açılıyor...",
    notTeslaPage: "Tesla sayfasında değilsiniz. Tesla websitesi açılıyor..."
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
    
    // Update model selector if available
    const modelSelector = document.getElementById("model-selector");
    if (modelSelector) {
      // Get current model
      const { model = MODELS.MODEL_Y.id } = await chrome.storage.sync.get("model");
      modelSelector.value = model;
    }
    
    // Refresh results
    await ResultsManager.loadResults();
  }
};

// Results Manager - Enhanced version
const ResultsManager = {
  // Get the root element for displaying results
  getRoot() {
    return document.getElementById("list");
  },
  
  // Render loading state
  async showLoading() {
    const loadingText = await RegionManager.getString("loading");
    this.getRoot().textContent = loadingText;
  },
  
  // Render empty state
  async showEmpty() {
    const emptyText = await RegionManager.getString("empty");
    this.getRoot().textContent = emptyText;
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
  
  // Render a single car result
  async renderCarItem(car) {
    // Format price for display
    const formattedPrice = car.formattedPrice || await this.formatPrice(car.price);
    
    // Get URL for the car
    const carUrl = car.url || `https://www.tesla.com${car.VINUrl || car.VINUrlP || ''}`;
    
    // Build HTML
    return `
      <a href="${carUrl}"
         target="_blank" 
         class="row"
         data-vin="${car.vin || car.VIN || ''}"
         data-path="${car.VINUrl || car.VINUrlP || ''}">
        ${formattedPrice} – ${car.model || car.Model} ${car.trim || car.TRIM || ''}
      </a>`;
  },
  
  // Render all car results
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
    
    // Update the DOM
    this.getRoot().innerHTML = renderedItems.join("");
    
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
  
  // Open Tesla inventory page - enhanced version
  async openTeslaPage() {
    try {
      // Get current settings
      const { region, model } = await chrome.storage.sync.get(["region", "model"]);
      
      // Default to Model Y if no model specified
      const modelId = model || MODELS.MODEL_Y.id;
      
      // Build URL
      const baseUrl = "https://www.tesla.com";
      let path;
      
      if (region === "TR") {
        path = `/tr_TR/inventory/new/${modelId}`;
      } else {
        path = `/inventory/new/${modelId}`;
      }
      
      // Get other settings for URL parameters
      const { priceFloor, rangeMiles, paymentType } = await chrome.storage.sync.get([
        "priceFloor", 
        "rangeMiles", 
        "paymentType"
      ]);
      
      // Build URL with query parameters
      const url = new URL(baseUrl + path);
      
      // Add parameters if available
      if (priceFloor) url.searchParams.set('price', priceFloor);
      if (rangeMiles) url.searchParams.set('range', rangeMiles);
      if (paymentType) url.searchParams.set('PaymentType', paymentType);
      
      // Set arrangeby to price
      url.searchParams.set('arrangeby', 'price');
      
      const notificationText = await RegionManager.getString("openTesla");
      this.showMessage(notificationText, true);
      
      // Open the URL
      chrome.tabs.create({ url: url.toString() });
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
  showMessage(message, isSuccess) {
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
  // Toggle the panel in the active tab with improved error handling
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
      
      // Get current settings
      const settings = await chrome.storage.sync.get([
        "region", 
        "model", 
        "priceFloor", 
        "rangeMiles",
        "paymentType",
        "zip"
      ]);
      
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
  // Load the current region
  const region = await RegionManager.getRegion();
  document.getElementById("region").value = region;
  
  // Update UI with region-specific strings
  await RegionManager.updateUI();
  
  // Set up button handlers
  document.getElementById("toggle").addEventListener("click", PanelToggleController.togglePanel);
  document.getElementById("fillForm").addEventListener("click", () => FormController.fillForm());
  document.getElementById("openOptions").addEventListener("click", () => FormController.openOptions());
  document.getElementById("refresh-button").addEventListener("click", DataRefreshController.refreshData);
  
  // Set up region change handler
  document.getElementById("region").addEventListener("change", async (e) => {
    await RegionManager.setRegion(e.target.value);
    await RegionManager.updateUI();
    
    // Trigger a refresh with the new region
    DataRefreshController.refreshData();
  });
  
  // Set up model selector if available
  const modelSelector = document.getElementById("model-selector");
  if (modelSelector) {
    modelSelector.addEventListener("change", async (e) => {
      await chrome.storage.sync.set({ model: e.target.value });
      
      // Trigger a refresh with the new model
      DataRefreshController.refreshData();
    });
  }
  
  // Set up refresh button if available
  const refreshButton = document.getElementById("refresh-button");
  if (refreshButton) {
    refreshButton.addEventListener("click", DataRefreshController.refreshData);
  }
  
  // Initial data refresh
  DataRefreshController.refreshData();
});