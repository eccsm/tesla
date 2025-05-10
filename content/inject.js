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

// Complete Tesla Order Form Handler
const FormHandler = {
  /**
   * Enhanced field selector that targets all Tesla checkout fields
   * @param {string} fieldName - Field identifier
   * @returns {HTMLElement|null} Field element if found
   */
  getField(fieldName) {
    // Tesla-specific selectors based on the screenshots
    const teslaSelectors = {
      // Account Details
      first: [
        'input[aria-label="First Name"]',
        'input[placeholder="First Name"]',
        'input[name="firstName"]',
        'div:contains("First Name") input'
      ],
      last: [
        'input[aria-label="Last Name"]',
        'input[placeholder="Last Name"]',
        'input[name="lastName"]',
        'div:contains("Last Name") input'
      ],
      email: [
        'input[aria-label="Email Address"]',
        'input[placeholder="Email Address"]',
        'input[name="email"]',
        'input[type="email"]',
        'div:contains("Email Address") input'
      ],
      emailConfirm: [
        'input[aria-label="Confirm Email Address"]',
        'input[placeholder="Confirm Email Address"]',
        'input[name="confirmEmail"]',
        'div:contains("Confirm Email") input'
      ],
      phone: [
        'input[aria-label="Mobile Phone Number"]',
        'input[placeholder="Mobile Phone Number"]',
        'input[type="tel"]',
        'div:contains("Mobile Phone") input'
      ],
      
      // Shipping Address
      addr1: [
        'input[aria-label="Address"]',
        'input[placeholder="Address"]',
        'input[name="address1"]',
        'div:contains("Address") input',
        'div:contains("shipping address") input'
      ],
      addr2: [
        'input[aria-label="Apartment, Suite, etc (optional)"]',
        'input[placeholder="Apartment, Suite, etc (optional)"]',
        'input[name="address2"]',
        'div:contains("Apartment") input',
        'div:contains("Suite") input'
      ],
      
      // Payment Information
      cardName: [
        'input[aria-label="Name on Card"]',
        'input[placeholder="Name on Card"]',
        'div:contains("Name on Card") input'
      ],
      cardNumber: [
        'input[aria-label="Card Number"]',
        'input[placeholder="Card Number"]',
        'div:contains("Card Number") input'
      ],
      cardExpMonth: [
        'select[aria-label="Expiration Month"]',
        'select[name="expMonth"]',
        'div:contains("Expiration Month") select'
      ],
      cardExpYear: [
        'select[aria-label="Expiration Year"]',
        'select[name="expYear"]',
        'div:contains("Expiration Year") select'
      ],
      cardCVV: [
        'input[aria-label="Security Code"]',
        'input[placeholder="Security Code"]',
        'div:contains("Security Code") input'
      ],
      zip: [
        'input[aria-label="Billing ZIP Code"]',
        'input[placeholder="Billing ZIP Code"]',
        'div:contains("Billing ZIP") input'
      ]
    };
    
    // Try the Tesla-specific selectors first
    if (teslaSelectors[fieldName]) {
      for (const selector of teslaSelectors[fieldName]) {
        try {
          // Handle :contains pseudo-selector
          if (selector.includes(':contains(')) {
            // Extract the element type and text to match
            const match = selector.match(/([\w-]+):contains\("([^"]+)"\)(.*)/);
            if (match) {
              const [_, elementType, textToMatch, remainingSelector] = match;
              
              // Find all elements of this type
              const elements = document.querySelectorAll(elementType);
              
              // Find elements containing the text
              for (const element of elements) {
                if (element.textContent.includes(textToMatch)) {
                  // Found a match - handle remaining selector
                  if (remainingSelector.includes('input')) {
                    // Find input field
                    const inputs = element.querySelectorAll('input');
                    if (inputs.length > 0) {
                      return inputs[0]; // Return the first input
                    }
                  } else if (remainingSelector.includes('select')) {
                    // Find select field
                    const selects = element.querySelectorAll('select');
                    if (selects.length > 0) {
                      return selects[0]; // Return the first select
                    }
                  }
                }
              }
            }
          } else {
            // Standard selector
            const element = document.querySelector(selector);
            if (element) return element;
          }
        } catch (err) {
          console.warn(`Error with selector "${selector}":`, err);
        }
      }
    }
    
    // If the specific selectors failed, use a more thorough approach
    return this.findFieldByLabels(fieldName);
  },
  
  /**
   * Find a field by looking at nearby labels and text
   * @param {string} fieldName - Field to find
   * @returns {HTMLElement|null} - Field element if found
   */
  findFieldByLabels(fieldName) {
    // Labels to look for each field type
    const fieldLabels = {
      first: ['First Name', 'First'],
      last: ['Last Name', 'Last'],
      email: ['Email Address', 'Email'],
      emailConfirm: ['Confirm Email Address', 'Confirm Email'],
      phone: ['Mobile Phone Number', 'Phone Number', 'Phone'],
      addr1: ['Address', 'Street Address', 'Enter shipping address'],
      addr2: ['Apartment', 'Suite', 'Apt', 'Unit'],
      cardName: ['Name on Card'],
      cardNumber: ['Card Number'],
      cardExpMonth: ['Expiration Month'],
      cardExpYear: ['Expiration Year'],
      cardCVV: ['Security Code', 'CVV', 'CVC'],
      zip: ['Billing ZIP Code', 'ZIP Code', 'Postal Code']
    };
    
    const labelsToFind = fieldLabels[fieldName] || [];
    if (labelsToFind.length === 0) return null;
    
    // Find all visible elements containing these labels
    const allElements = document.querySelectorAll('*');
    const matchingElements = [];
    
    for (const element of allElements) {
      // Skip non-visible elements
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      
      // Skip script and style elements
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') continue;
      
      // Check if element contains the label text
      const text = element.textContent.trim();
      if (text && labelsToFind.some(label => text.includes(label))) {
        matchingElements.push(element);
      }
    }
    
    // For each matching element, look for input/select field
    for (const element of matchingElements) {
      // 1. Check for inputs directly inside
      const inputs = element.querySelectorAll('input, select');
      if (inputs.length > 0) return inputs[0];
      
      // 2. Check the next element
      let nextElement = element.nextElementSibling;
      while (nextElement) {
        const inputs = nextElement.querySelectorAll('input, select');
        if (inputs.length > 0) return inputs[0];
        nextElement = nextElement.nextElementSibling;
      }
      
      // 3. Check the parent's next children
      const parent = element.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const currentIndex = siblings.indexOf(element);
        
        for (let i = currentIndex + 1; i < siblings.length; i++) {
          const inputs = siblings[i].querySelectorAll('input, select');
          if (inputs.length > 0) return inputs[0];
        }
      }
    }
    
    // If all else fails, try some field-specific strategies
    switch (fieldName) {
      case 'first':
        // First name is often the first text input on the form
        return document.querySelector('input[type="text"]');
        
      case 'cardExpMonth':
        // First select element after "Expiration" text
        const monthLabels = document.querySelectorAll('div:contains("Expiration"), span:contains("Expiration")');
        for (const label of monthLabels) {
          const selects = document.querySelectorAll('select');
          // First select after the expiration label
          for (const select of selects) {
            if (select.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_PRECEDING) {
              return select;
            }
          }
        }
        // First select on the page as fallback
        return document.querySelector('select');
        
      case 'cardExpYear':
        // Second select element after "Expiration" text
        const yearLabels = document.querySelectorAll('div:contains("Expiration"), span:contains("Expiration")');
        for (const label of yearLabels) {
          const selects = document.querySelectorAll('select');
          // First select after the expiration label
          let found = false;
          for (const select of selects) {
            if (select.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_PRECEDING) {
              if (found) return select; // Return the second select
              found = true;
            }
          }
        }
        // Second select on the page as fallback
        const selects = document.querySelectorAll('select');
        if (selects.length > 1) return selects[1];
        break;
    }
    
    console.warn(`Could not find field: ${fieldName}`);
    return null;
  },
  
  /**
   * Fill a form field safely with enhanced event triggering
   * @param {HTMLElement} field - Field element
   * @param {string} value - Value to set
   * @returns {boolean} Success status
   */
  fillField(field, value) {
    if (!field || !value) return false;
    
    try {
      // Focus the field first
      field.focus();
      
      // For select elements, handle differently
      if (field.tagName === 'SELECT') {
        return this.fillSelectField(field, value);
      }
      
      // For input fields, set value and trigger events
      field.value = '';  // Clear first
      field.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Type the value character by character to better simulate user typing
      for (let i = 0; i < value.length; i++) {
        field.value += value.charAt(i);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Trigger final events
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('blur', { bubbles: true }));
      
      console.log(`Successfully filled field:`, field);
      return true;
    } catch (e) {
      console.error(`Error filling field:`, e);
      return false;
    }
  },
  
  /**
   * Fill a select dropdown field
   * @param {HTMLSelectElement} field - Select element 
   * @param {string} value - Value to select
   * @returns {boolean} Success status
   */
  fillSelectField(field, value) {
    try {
      const options = Array.from(field.options);
      let match = null;
      
      // Try different strategies to find the matching option
      
      // 1. Exact value match
      match = options.find(opt => opt.value === value);
      if (match) {
        field.value = match.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      
      // 2. Exact text match
      match = options.find(opt => opt.text === value);
      if (match) {
        field.value = match.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      
      // 3. Case-insensitive text partial match
      match = options.find(opt => 
        opt.text.toLowerCase().includes(value.toLowerCase())
      );
      if (match) {
        field.value = match.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      
      // 4. Numeric match (for expiration dates)
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        // Try to match by number value
        match = options.find(opt => {
          const optNum = parseInt(opt.value, 10);
          return !isNaN(optNum) && optNum === numValue;
        });
        
        if (!match) {
          // Try to match by text as number
          match = options.find(opt => {
            const optNum = parseInt(opt.text, 10);
            return !isNaN(optNum) && optNum === numValue;
          });
        }
        
        if (match) {
          field.value = match.value;
          field.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      
      // 5. Handle MM/YY format for expiration dates
      if (value.includes('/')) {
        const parts = value.split('/');
        if (field.id.toLowerCase().includes('month') || field.name.toLowerCase().includes('month')) {
          // Get month part
          const month = parseInt(parts[0], 10);
          if (!isNaN(month)) {
            match = options.find(opt => {
              const optNum = parseInt(opt.value, 10);
              return !isNaN(optNum) && optNum === month;
            });
            
            if (match) {
              field.value = match.value;
              field.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        } else if (field.id.toLowerCase().includes('year') || field.name.toLowerCase().includes('year')) {
          // Get year part
          let year = parseInt(parts[1], 10);
          if (!isNaN(year)) {
            // Convert 2-digit year to 4-digit
            if (year < 100) year += 2000;
            
            match = options.find(opt => {
              const optNum = parseInt(opt.value, 10);
              return !isNaN(optNum) && optNum === year;
            });
            
            if (match) {
              field.value = match.value;
              field.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }
      }
      
      // 6. Specific handling for expiration fields
      if (field.id.toLowerCase().includes('month') || field.name.toLowerCase().includes('month')) {
        // Try to find any valid month
        for (let month = 1; month <= 12; month++) {
          match = options.find(opt => {
            // Try both numeric value and text
            return opt.value == month || opt.text.includes(month.toString());
          });
          
          if (match) {
            field.value = match.value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      } else if (field.id.toLowerCase().includes('year') || field.name.toLowerCase().includes('year')) {
        // Find current year or next available
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year <= currentYear + 10; year++) {
          match = options.find(opt => 
            opt.value == year || opt.text.includes(year.toString())
          );
          
          if (match) {
            field.value = match.value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
      
      // 7. Last resort - select first non-empty option
      match = options.find(opt => opt.value && !opt.disabled);
      if (match) {
        field.value = match.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`Selected first available option: ${match.text}`);
        return true;
      }
      
      console.warn(`Could not find a suitable option for value: ${value}`);
      return false;
    } catch (e) {
      console.error(`Error filling select field:`, e);
      return false;
    }
  },
  
  /**
   * Parse expiration date string into separate month and year
   * @param {string} expDateValue - Expiration date string (MM/YY, MM/YYYY, etc.)
   * @returns {Object} Object with month and year properties
   */
  parseExpirationDate(expDateValue) {
    // Default values
    let month = '';
    let year = '';
    
    // Check if we have a valid format
    if (expDateValue && typeof expDateValue === 'string') {
      // Common formats: MM/YY, MM/YYYY, MM-YY
      const formats = [
        /^(\d{1,2})[\/\-](\d{2,4})$/, // MM/YY, MM/YYYY, MM-YY, MM-YYYY
        /^(\d{1,2})(\d{2})$/ // MMYY
      ];
      
      // Try each format
      for (const format of formats) {
        const match = expDateValue.match(format);
        if (match) {
          month = match[1].padStart(2, '0'); // Ensure 2-digit month
          year = match[2];
          break;
        }
      }
    }
    
    return { month, year };
  },
  
  /**
   * Fill form with user data - enhanced for Tesla's order form
   * @returns {Promise<{count: number, fields: string[]}>} Details of filled fields
   */
  async fillForm() {
    let filledCount = 0;
    const filledFields = [];
    
    try {
      // Get user data
      const userData = await new Promise(resolve => {
        chrome.storage.sync.get(null, data => {
          resolve(data || {});
        });
      });
      
      console.log('Retrieved user data for form filling:', Object.keys(userData));
      
      // Define field mapping - use emailConfirm for confirmation fields
      const fieldMapping = {
        // Account details
        'first': 'first',
        'last': 'last',
        'email': 'email',
        'emailConfirm': 'email', // Use same email for confirmation
        'phone': 'phone',
        
        // Address
        'addr1': 'addr1',
        'addr2': 'addr2',
        
        // Payment
        'cardName': 'cardName',
        'cardNumber': 'cardNumber',
        'cardCVV': 'cardCVV',
        'zip': 'zip'
      };
      
      // Fill each field with a delay between them
      for (const [fieldId, dataKey] of Object.entries(fieldMapping)) {
        if (userData[dataKey]) {
          const field = this.getField(fieldId);
          if (field && this.fillField(field, userData[dataKey])) {
            filledCount++;
            filledFields.push(fieldId);
            
            // Add delay between fields (200-300ms)
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
          }
        }
      }
      
      // Special handling for expiration date (might be one field or two separate fields)
      if (userData.cardExp) {
        const { month, year } = this.parseExpirationDate(userData.cardExp);
        
        // Try to fill month field
        if (month) {
          const monthField = this.getField('cardExpMonth');
          if (monthField && this.fillField(monthField, month)) {
            filledCount++;
            filledFields.push('cardExpMonth');
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
          }
        }
        
        // Try to fill year field
        if (year) {
          const yearField = this.getField('cardExpYear');
          if (yearField && this.fillField(yearField, year)) {
            filledCount++;
            filledFields.push('cardExpYear');
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
          }
        }
      }
      
      // Check agreement checkboxes
      const checkedCount = this.checkRelevantCheckboxes();
      if (checkedCount > 0) {
        filledCount += checkedCount;
        filledFields.push('checkboxes');
      }
      
      console.log(`Form filling complete. Filled ${filledCount} fields:`, filledFields.join(', '));
      
      return {
        count: filledCount,
        fields: filledFields
      };
    } catch (e) {
      console.error('Error filling form:', e);
      return {
        count: filledCount,
        fields: filledFields,
        error: e.message
      };
    }
  },
  
  /**
   * Check relevant agreement checkboxes
   * @returns {number} Number of checkboxes checked
   */
  checkRelevantCheckboxes() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    let checkedCount = 0;
    
    checkboxes.forEach(checkbox => {
      // Only check boxes that are likely agreement checkboxes
      // Don't check boxes that seem like product options
      if (this.isLikelyAgreementCheckbox(checkbox) && !checkbox.checked) {
        try {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          checkbox.dispatchEvent(new Event('click', { bubbles: true }));
          checkedCount++;
        } catch (e) {
          console.error(`Error checking checkbox:`, e);
        }
      }
    });
    
    return checkedCount;
  },
  
  /**
   * Determine if a checkbox is likely an agreement/terms checkbox
   * @param {HTMLInputElement} checkbox - The checkbox to evaluate
   * @returns {boolean} Whether it's likely an agreement checkbox
   */
  isLikelyAgreementCheckbox(checkbox) {
    // Get text associated with the checkbox
    let checkboxText = '';
    
    // Check if it has a label
    if (checkbox.labels && checkbox.labels.length > 0) {
      checkboxText = checkbox.labels[0].textContent;
    }
    
    // Check for nearby text nodes
    if (!checkboxText) {
      const parent = checkbox.parentElement;
      if (parent) {
        checkboxText = parent.textContent;
      }
    }
    
    // Check if it's near terms-related text
    if (!checkboxText) {
      const nextSibling = checkbox.nextElementSibling;
      if (nextSibling) {
        checkboxText = nextSibling.textContent;
      }
    }
    
    // Look for terms-related keywords
    const termsKeywords = ['agree', 'consent', 'terms', 'conditions', 'privacy', 'policy', 'subscribe', 'newsletter', 'accept'];
    
    // Check if any keyword is present
    for (const keyword of termsKeywords) {
      if (checkboxText.toLowerCase().includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    // Check the name or ID of the checkbox
    const nameOrId = checkbox.name || checkbox.id || '';
    for (const keyword of termsKeywords) {
      if (nameOrId.toLowerCase().includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    // If we couldn't determine if it's a terms checkbox, default to true if it's alone
    // or not part of a group of checkboxes (like in a product options list)
    const nearbyCheckboxCount = checkbox.parentElement ? 
      checkbox.parentElement.querySelectorAll('input[type="checkbox"]').length : 0;
      
    return nearbyCheckboxCount <= 1;
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