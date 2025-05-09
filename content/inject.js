/**
 * Tesla AutoPilot Content Script
 * 
 * This script uses a URL-based approach for filtering inventory
 * rather than manipulating Tesla's UI elements directly.
 */

// Configuration
const CONFIG = {
  PANEL_ID: 'tesla-autopilot-panel',
  URL_PARAMS: {
    PRICE: 'price',
    RANGE: 'range',
    PAYMENT_TYPE: 'PaymentType',
    ARRANGE_BY: 'arrangeby'
  },
  MODELS: {
    MODEL_3: 'm3',
    MODEL_Y: 'my',
    MODEL_S: 'ms',
    MODEL_X: 'mx'
  }
};

// Helper Functions
const Helpers = {
  /**
   * Get current URL parameters
   * @returns {URLSearchParams} The URL search params
   */
  getUrlParams() {
    return new URLSearchParams(window.location.search);
  },
  
  /**
   * Update URL with new parameters
   * @param {Object} params - Parameters to set
   */
  updateUrlParams(params) {
    const url = new URL(window.location.href);
    
    // Update existing params or add new ones
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    
    // Navigate to the new URL
    window.location.href = url.toString();
  },
  
  /**
   * Determine if we're on an order page
   * @returns {boolean} True if on order page
   */
  isOrderPage() {
    return window.location.href.includes('/order/') || 
           window.location.href.includes('/myorder/');
  },
  
  /**
   * Show a notification message
   * @param {string} message - Message to show
   * @param {boolean} isSuccess - Whether it's a success message
   */
  showNotification(message, isSuccess = true) {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.tesla-autopilot-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create a new notification
    const notification = document.createElement('div');
    notification.classList.add('tesla-autopilot-notification');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isSuccess ? 'rgba(0, 150, 0, 0.9)' : 'rgba(200, 0, 0, 0.9)'};
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      font-family: system-ui, sans-serif;
    `;
    notification.textContent = `Tesla AutoPilot: ${message}`;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => notification.remove(), 3000);
  },
  
  /**
   * Get user settings from storage
   * @returns {Promise<object>} User settings
   */
  async getUserSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get(null, data => {
        resolve(data || {});
      });
    });
  }
};

// Form Handler
const FormHandler = {
  /**
   * Get a field element by various selectors
   * @param {string} fieldName - Field identifier
   * @returns {HTMLElement|null} Field element if found
   */
  getField(fieldName) {
    // Common field selectors
    const selectors = {
      // Personal info
      tc: 'input[placeholder*="TCKN"], input[name*="tin"]',
      first: 'input[placeholder*="First"], input[name*="firstName"]',
      last: 'input[placeholder*="Last"], input[name*="lastName"]',
      email: 'input[type="email"], input[placeholder*="Email"]',
      phone: 'input[type="tel"], input[placeholder*="Phone"]',
      
      // Address
      addr1: 'input[placeholder*="Address"], input[name*="address1"]',
      addr2: 'input[placeholder*="Apt"], input[name*="address2"]',
      city: 'input[placeholder*="City"], input[name*="city"]',
      state: 'input[placeholder*="State"], select[name*="state"]',
      zip: 'input[placeholder*="ZIP"], input[name*="zip"]',
      
      // Payment
      cardName: 'input[placeholder*="Name on Card"]',
      cardNumber: 'input[placeholder*="Card Number"]',
      cardExp: 'input[placeholder*="Expiration"]',
      cardCVV: 'input[placeholder*="CVV"]'
    };
    
    const selector = selectors[fieldName];
    return selector ? document.querySelector(selector) : null;
  },
  
  /**
   * Fill a form field safely
   * @param {HTMLElement} field - Field element
   * @param {string} value - Value to set
   * @returns {boolean} Success status
   */
  fillField(field, value) {
    if (!field || !value) return false;
    
    try {
      // Set the value
      field.value = value;
      
      // Dispatch basic events
      try {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        // Ignore event errors
      }
      
      return true;
    } catch (e) {
      console.log(`Error filling field:`, e);
      return false;
    }
  },
  
  /**
   * Fill form with user data
   * @returns {Promise<number>} Number of fields filled
   */
  async fillForm() {
    let filledCount = 0;
    
    try {
      // Get user data
      const userData = await Helpers.getUserSettings();
      
      // Fields to fill
      const fieldNames = [
        'tc', 'first', 'last', 'email', 'phone',
        'addr1', 'addr2', 'city', 'state', 'zip',
        'cardName', 'cardNumber', 'cardExp', 'cardCVV'
      ];
      
      // Try to fill each field
      fieldNames.forEach(fieldName => {
        if (userData[fieldName]) {
          const field = this.getField(fieldName);
          if (field && this.fillField(field, userData[fieldName])) {
            filledCount++;
          }
        }
      });
      
      // Check any checkboxes (terms, agreements)
      document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          filledCount++;
        }
      });
      
      return filledCount;
    } catch (e) {
      console.log('Error filling form:', e);
      return filledCount;
    }
  }
};

// Panel UI
const PanelUI = {
  /**
   * Create and show the panel
   */
  createPanel() {
    // Remove existing panel if any
    const existingPanel = document.getElementById(CONFIG.PANEL_ID);
    if (existingPanel) {
      existingPanel.remove();
    }
    
    // Create panel element
    const panel = document.createElement('div');
    panel.id = CONFIG.PANEL_ID;
    
    // Add panel to the page
    document.body.appendChild(panel);
    
    // Populate the panel based on page type
    if (Helpers.isOrderPage()) {
      this.createOrderPanel(panel);
    } else {
      this.createInventoryPanel(panel);
    }
  },
  
  /**
   * Create panel for order pages
   * @param {HTMLElement} panel - Panel element
   */
  async createOrderPanel(panel) {
    // Get user settings
    const settings = await Helpers.getUserSettings();
    
    // Create panel HTML
    panel.innerHTML = `
      <div class="header">
        <h2>Tesla AutoPilot</h2>
        <button class="btn-ghost" id="tesla-panel-close">×</button>
      </div>
      
      <div class="user-info">
        <p>${settings.first || ''} ${settings.last || ''}</p>
        <p>${settings.email || ''}</p>
      </div>
      
      <button class="btn" id="fill-form-btn">Fill Form</button>
      <button class="btn" id="check-terms-btn">Check Terms</button>
      
      <div id="panel-status" class="status"></div>
    `;
    
    // Set up event handlers
    panel.querySelector('#tesla-panel-close').addEventListener('click', () => {
      panel.remove();
    });
    
    panel.querySelector('#fill-form-btn').addEventListener('click', async () => {
      const count = await FormHandler.fillForm();
      this.showStatus(panel, `${count} fields filled successfully!`, true);
    });
    
    panel.querySelector('#check-terms-btn').addEventListener('click', () => {
      // Check all checkboxes
      let count = 0;
      document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          count++;
        }
      });
      
      this.showStatus(panel, `${count} checkboxes checked`, true);
    });
  },
  
/**
 * Create panel for inventory pages with improved price filtering
 * @param {HTMLElement} panel - Panel element
 */
async createInventoryPanel(panel) {
  // Get current URL params
  const params = Helpers.getUrlParams();
  const currentPrice = params.get(CONFIG.URL_PARAMS.PRICE) || '';
  const currentRange = params.get(CONFIG.URL_PARAMS.RANGE) || '0';
  
  // Get user settings
  const settings = await Helpers.getUserSettings();
  
  // Create panel HTML
  panel.innerHTML = `
    <div class="header">
      <h2>Tesla AutoPilot</h2>
      <button class="btn-ghost" id="tesla-panel-close">×</button>
    </div>
    
    <div class="form-group">
      <label for="panel-price">Price Limit:</label>
      <input type="number" id="panel-price" value="${settings.priceFloor || currentPrice}">
    </div>
    
    <div class="form-group">
      <label for="panel-range">Range (miles):</label>
      <input type="number" id="panel-range" value="${settings.rangeMiles || currentRange}">
    </div>
    
    <div class="form-group">
      <label for="panel-payment">Payment Type:</label>
      <select id="panel-payment">
        <option value="cash" ${params.get(CONFIG.URL_PARAMS.PAYMENT_TYPE) === 'cash' ? 'selected' : ''}>Cash</option>
        <option value="loan" ${params.get(CONFIG.URL_PARAMS.PAYMENT_TYPE) === 'loan' ? 'selected' : ''}>Loan</option>
        <option value="lease" ${params.get(CONFIG.URL_PARAMS.PAYMENT_TYPE) === 'lease' ? 'selected' : ''}>Lease</option>
      </select>
    </div>
    
    <button class="btn" id="apply-filters-btn">Apply Filters</button>
    <button class="btn" id="save-settings-btn">Save Settings</button>
    
    <div id="panel-status" class="status"></div>
  `;
  
  // Set up event handlers
  panel.querySelector('#tesla-panel-close').addEventListener('click', () => {
    panel.remove();
  });
  
  // FIXED: Apply Filters button now works like the model selector
  panel.querySelector('#apply-filters-btn').addEventListener('click', async () => {
    try {
      const price = panel.querySelector('#panel-price').value;
      const range = panel.querySelector('#panel-range').value;
      const paymentType = panel.querySelector('#panel-payment').value;
      
      // Save to storage first
      await chrome.storage.sync.set({
        priceFloor: price,
        rangeMiles: range,
        paymentType: paymentType
      });
      
      // Show saving message
      this.showStatus(panel, 'Applying filters...', true);
      
      // Then update URL - same approach as the model selector
      const url = new URL(window.location.href);
      url.searchParams.set('price', price);
      url.searchParams.set('range', range || '0');
      url.searchParams.set('PaymentType', paymentType);
      url.searchParams.set('arrangeby', 'price');
      
      // Navigate to the new URL
      window.location.href = url.toString();
    } catch (error) {
      console.error("Error applying filters:", error);
      this.showStatus(panel, 'Error applying filters', false);
    }
  });
  
  panel.querySelector('#save-settings-btn').addEventListener('click', async () => {
    const price = panel.querySelector('#panel-price').value;
    const range = panel.querySelector('#panel-range').value;
    const paymentType = panel.querySelector('#panel-payment').value;
    
    // Save to storage
    chrome.storage.sync.set({
      priceFloor: price,
      rangeMiles: range,
      paymentType: paymentType
    }, () => {
      this.showStatus(panel, 'Settings saved successfully!', true);
    });
  });
},
  
  /**
   * Show a status message in the panel
   * @param {HTMLElement} panel - Panel element
   * @param {string} message - Message to show
   * @param {boolean} isSuccess - Whether it's a success message
   */
  showStatus(panel, message, isSuccess = true) {
    const statusEl = panel.querySelector('#panel-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = isSuccess ? 'status success' : 'status error';
    statusEl.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  },
  
  /**
   * Toggle panel visibility
   */
  togglePanel() {
    const panel = document.getElementById(CONFIG.PANEL_ID);
    
    if (panel) {
      panel.remove();
    } else {
      this.createPanel();
    }
  }
};

// Add styles for the panel
function addPanelStyles() {
  // Check if styles already exist
  if (document.getElementById('tesla-autopilot-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'tesla-autopilot-styles';
  style.textContent = `
    #${CONFIG.PANEL_ID} {
      position: fixed;
      top: 64px;
      right: 0;
      width: 300px;
      background: rgba(30, 30, 30, 0.9);
      color: white;
      padding: 16px;
      border-radius: 8px 0 0 8px;
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    
    #${CONFIG.PANEL_ID} .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    #${CONFIG.PANEL_ID} h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }
    
    #${CONFIG.PANEL_ID} .btn-ghost {
      background: none;
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    
    #${CONFIG.PANEL_ID} .form-group {
      margin-bottom: 12px;
    }
    
    #${CONFIG.PANEL_ID} .form-group label {
      display: block;
      margin-bottom: 5px;
      font-size: 14px;
    }
    
    #${CONFIG.PANEL_ID} .form-group input,
    #${CONFIG.PANEL_ID} .form-group select {
      width: 100%;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #444;
      background-color: #222;
      color: white;
      box-sizing: border-box;
    }
    
    #${CONFIG.PANEL_ID} .btn {
      background: #3b82f6;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      color: white;
      margin: 4px 0 8px 0;
      cursor: pointer;
      width: 100%;
      font-size: 14px;
    }
    
    #${CONFIG.PANEL_ID} .btn:hover {
      background: #2563eb;
    }
    
    #${CONFIG.PANEL_ID} .user-info {
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    #${CONFIG.PANEL_ID} .user-info p {
      margin: 5px 0;
      font-size: 14px;
    }
    
    #${CONFIG.PANEL_ID} .status {
      padding: 8px;
      border-radius: 4px;
      margin-top: 10px;
      text-align: center;
      font-size: 14px;
      display: none;
    }
    
    #${CONFIG.PANEL_ID} .status.success {
      background-color: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }
    
    #${CONFIG.PANEL_ID} .status.error {
      background-color: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    
    @media (prefers-color-scheme: light) {
      #${CONFIG.PANEL_ID} {
        background: rgba(255, 255, 255, 0.9);
        color: #333;
      }
      
      #${CONFIG.PANEL_ID} .btn-ghost {
        color: #333;
      }
      
      #${CONFIG.PANEL_ID} .form-group input,
      #${CONFIG.PANEL_ID} .form-group select {
        background-color: white;
        border: 1px solid #ddd;
        color: #333;
      }
      
      #${CONFIG.PANEL_ID} .user-info {
        border-bottom-color: rgba(0, 0, 0, 0.1);
      }
    }
  `;
  
  document.head.appendChild(style);
}

// Message Handler
function setupMessageHandler() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    // Handle ping to check if content script is active
    if (message.action === 'ping') {
      sendResponse({ status: 'pong' });
      return true;
    }
    
    // Toggle panel visibility
    if (message.cmd === 'togglePanel') {
      PanelUI.togglePanel();
      sendResponse({ status: 'Panel toggled' });
      return true;
    }
    
    // Fill form fields
    if (message.action === 'fillForm') {
      FormHandler.fillForm().then(count => {
        sendResponse({ status: 'Form filled', count });
      }).catch(err => {
        console.error('Error filling form:', err);
        sendResponse({ status: 'Error', error: err.message });
      });
      return true;
    }
    
    // Fill order form with VIN
    if (message.action === 'fillOrderForm') {
      FormHandler.fillForm().then(count => {
        sendResponse({ status: 'Form filled', count });
      }).catch(err => {
        console.error('Error filling form:', err);
        sendResponse({ status: 'Error', error: err.message });
      });
      return true;
    }
    
    return false;
  });
}

// Initialize everything
function initialize() {
  console.log('Tesla AutoPilot content script initialized on:', window.location.href);
  
  // Add styles for panel and notifications
  addPanelStyles();
  
  // Set up message handler
  setupMessageHandler();
  
  // Check if we need to auto-fill forms
  if (Helpers.isOrderPage() && window.location.href.includes('autoFill=true')) {
    // Auto-fill form after a short delay to ensure page is loaded
    setTimeout(() => {
      FormHandler.fillForm().then(count => {
        if (count > 0) {
          Helpers.showNotification(`${count} fields filled automatically`);
        }
      });
    }, 1000);
  }
}

// Start the script
initialize();