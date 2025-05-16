/**
 * Tesla AutoPilot Content Script - Fixed Version
 * 
 * This script uses an improved field detection system to properly
 * fill out Tesla order forms despite their complex structure.
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
    MODEL_X: 'mx',
    CYBERTRUCK: 'ct'
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

// Improved Tesla Order Form Handler
const FormHandler = {
  /**
   * Enhanced field selector with adaptive detection for Tesla's forms
   * @param {string} fieldName - Field identifier
   * @returns {HTMLElement|null} Field element if found
   */
  getField(fieldName) {
    // Specific selectors for the Tesla order page structure
    const teslaSelectors = {
      // Account Details
      first: [
        '#FIRST_NAME',
        'input[name="firstName"]',
        'input[data-id="first-name-textbox"]',
        'input[placeholder="First Name"]',
        'input[aria-label="First Name"]'
      ],
      last: [
        '#LAST_NAME',
        'input[name="lastName"]',
        'input[data-id="last-name-textbox"]',
        'input[placeholder="Last Name"]',
        'input[aria-label="Last Name"]'
      ],
      email: [
        '#EMAIL',
        'input[name="email"]',
        'input[data-id="email-textbox"]',
        'input[type="email"]',
        'input[placeholder*="Email"]',
        'input[aria-label*="Email"]'
      ],
      emailConfirm: [
        '#EMAIL_CONFIRM',
        'input[name="emailConfirm"]',
        'input[data-id="confirm-email-textbox"]',
        'input[placeholder*="Confirm Email"]',
        'input[aria-label*="Confirm Email"]'
      ],
      phone: [
        '#PHONE_NUMBER',
        'input[name="phoneNumber"]',
        'input[data-id="phone-number-textbox"]',
        'input[type="tel"]',
        'input[inputmode="tel"]',
        'input[placeholder*="Phone"]',
        'input[aria-label*="Phone"]'
      ],
      
      // Shipping Address
      addr1: [
        '#accessories-shipping',
        'input[name="shipping-address"]',
        'input[name="address1"]',
        'input[name="addressLine1"]',
        'input[placeholder*="Enter shipping address"]',
        'input[placeholder*="Address"]',
        'input[aria-label*="Address"]'
      ],
      addr2: [
        '#accessories-line-2',
        'input[name="address2"]',
        'input[name="addressLine2"]',
        'input[placeholder*="Apartment"]',
        'input[placeholder*="Suite"]',
        'input[aria-label*="Apartment"]'
      ],
      
      // Payment Information - Note: These likely won't work due to iframe
      cardName: [
        'input[name="ccName"]',
        'input[name="nameOnCard"]',
        'input[placeholder*="Name on Card"]',
        'input[aria-label*="Name on Card"]'
      ],
      cardNumber: [
        'input[name="ccNumber"]',
        'input[name="cardNumber"]',
        'input[placeholder*="Card Number"]',
        'input[aria-label*="Card Number"]'
      ],
      cardExpMonth: [
        'select[name="ccExpMonth"]',
        'select[aria-label*="Month"]',
        'select[id*="month"]'
      ],
      cardExpYear: [
        'select[name="ccExpYear"]',
        'select[aria-label*="Year"]',
        'select[id*="year"]'
      ],
      cardCVV: [
        'input[name="ccCvv"]',
        'input[name="cvv"]',
        'input[placeholder*="Security Code"]',
        'input[placeholder*="CVV"]',
        'input[aria-label*="Security Code"]'
      ],
      zip: [
        'input[name="billingZip"]',
        'input[name="postalCode"]',
        'input[placeholder*="ZIP"]',
        'input[placeholder*="Postal"]',
        'input[aria-label*="ZIP"]'
      ]
    };
    
    // Try each selector for the field
    if (teslaSelectors[fieldName]) {
      for (const selector of teslaSelectors[fieldName]) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            console.log(`Found field '${fieldName}' with selector: ${selector}`);
            return element;
          }
        } catch (err) {
          console.log(`Error with selector "${selector}":`, err);
        }
      }
    }
    
    // If specific selectors failed, use a more general approach
    return this.findFieldByLabels(fieldName);
  },
  
  /**
   * Advanced method to find fields by looking for text labels near them
   * @param {string} fieldName - Field to find
   * @returns {HTMLElement|null} - Field element if found
   */
  findFieldByLabels(fieldName) {
    // Labels to look for each field type in multiple languages
    const fieldLabels = {
      first: ['First Name', 'First', 'Ad', 'İsim'],
      last: ['Last Name', 'Last', 'Soyad', 'Soyadı'],
      email: ['Email Address', 'Email', 'E-posta', 'E-mail'],
      emailConfirm: ['Confirm Email Address', 'Confirm Email', 'E-posta Doğrulama'],
      phone: ['Mobile Phone Number', 'Phone Number', 'Phone', 'Telefon', 'Cep Telefonu'],
      addr1: ['Address', 'Street Address', 'Adres', 'Sokak Adresi', 'Shipping'],
      addr2: ['Apartment', 'Suite', 'Apt', 'Unit', 'Daire', 'optional'],
      cardName: ['Name on Card', 'Kart Üzerindeki İsim'],
      cardNumber: ['Card Number', 'Kart Numarası'],
      cardExpMonth: ['Expiration Month', 'Son Kullanma Ay'],
      cardExpYear: ['Expiration Year', 'Son Kullanma Yıl'],
      cardCVV: ['Security Code', 'CVV', 'CVC', 'Güvenlik Kodu'],
      zip: ['ZIP Code', 'Postal Code', 'Posta Kodu']
    };
    
    const labelsToFind = fieldLabels[fieldName] || [];
    if (labelsToFind.length === 0) return null;
    
    // Method 1: Find based on standard label elements
    for (const labelText of labelsToFind) {
      // Find all label elements
      const labels = Array.from(document.querySelectorAll('label'));
      
      for (const label of labels) {
        if (label.textContent.includes(labelText)) {
          // If the label has a 'for' attribute, use it
          if (label.htmlFor) {
            const field = document.getElementById(label.htmlFor);
            if (field) return field;
          }
          
          // Look for input inside the label or in siblings
          const input = label.querySelector('input, select') || 
                       label.nextElementSibling?.querySelector('input, select');
          if (input) return input;
        }
      }
    }
    
    // Method 2: Find based on text near inputs
    for (const labelText of labelsToFind) {
      // Get all elements with text matching our label
      const allTextElements = Array.from(document.querySelectorAll('*'));
      const elementsWithText = allTextElements.filter(el => 
        el.childNodes.length === 1 && 
        el.childNodes[0].nodeType === Node.TEXT_NODE && 
        el.textContent.includes(labelText)
      );
      
      // For each element with matching text, look for nearby inputs
      for (const element of elementsWithText) {
        // First, check siblings
        let sibling = element.nextElementSibling;
        while (sibling) {
          const input = sibling.querySelector('input, select');
          if (input) return input;
          sibling = sibling.nextElementSibling;
        }
        
        // Check parent's children
        const parent = element.parentElement;
        if (parent) {
          const inputs = parent.querySelectorAll('input, select');
          if (inputs.length > 0) return inputs[0];
        }
        
        // Check grandparent's children
        const grandparent = parent?.parentElement;
        if (grandparent) {
          const inputs = grandparent.querySelectorAll('input, select');
          if (inputs.length > 0) return inputs[0];
        }
      }
    }
    
    // Method 3: Look for inputs of the expected type
    switch (fieldName) {
      case 'email':
        return document.querySelector('input[type="email"]');
      case 'phone':
        return document.querySelector('input[type="tel"]');
      case 'cardNumber':
        return document.querySelector('input[pattern*="[0-9]"]');
    }
    
    console.log(`Could not find field: ${fieldName}`);
    return null;
  },
  
  /**
   * Improved field filling with retry logic
   * @param {HTMLElement} field - Field element
   * @param {string} value - Value to set
   * @returns {boolean} Success status
   */
  fillField(field, value) {
    if (!field || !value) return false;
    
    try {
      // For select elements, handle differently
      if (field.tagName === 'SELECT') {
        return this.fillSelectField(field, value);
      }
      
      // Clear the field first - very important for validation
      field.value = '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      
      // For text inputs, set value and trigger events
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // Verify the value was set
      if (field.value !== value) {
        console.log(`Value not set for field, trying alternate method`);
        
        // Try an alternate approach with Object.getOwnPropertyDescriptor
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(field, value);
        }
        
        // Trigger events again
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      console.log(`Successfully filled field:`, field);
      return true;
    } catch (e) {
      console.error(`Error filling field:`, e);
      return false;
    }
  },
  
  /**
   * Improved select field filling with better option matching
   * @param {HTMLSelectElement} field - Select element 
   * @param {string} value - Value to select
   * @returns {boolean} Success status
   */
  fillSelectField(field, value) {
    try {
      const options = Array.from(field.options);
      let match = null;
      
      // Strategy 1: Direct value match
      match = options.find(opt => opt.value === value);
      if (match) {
        field.value = match.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      
      // Strategy 2: Text content match
      match = options.find(opt => opt.text === value || opt.text.includes(value));
      if (match) {
        field.value = match.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      
      // Strategy 3: Numeric match for expiration dates
      if (!isNaN(parseInt(value))) {
        const numValue = parseInt(value);
        match = options.find(opt => {
          const optNum = parseInt(opt.value);
          return !isNaN(optNum) && optNum === numValue;
        });
        
        if (match) {
          field.value = match.value;
          field.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      
      // Strategy 4: MM/YY format handling
      if (value.includes('/')) {
        const [month, year] = value.split('/');
        
        if (field.id.toLowerCase().includes('month') || field.name.toLowerCase().includes('month')) {
          // Try to set month
          const monthOptions = options.find(opt => {
            const monthNum = parseInt(month);
            if (isNaN(monthNum)) return false;
            return opt.value == monthNum || opt.text.includes(monthNum.toString());
          });
          
          if (monthOptions) {
            field.value = monthOptions.value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        
        if (field.id.toLowerCase().includes('year') || field.name.toLowerCase().includes('year')) {
          // Try to set year (handle 2-digit vs 4-digit)
          let fullYear = parseInt(year);
          if (fullYear < 100) fullYear += 2000;
          
          const yearOption = options.find(opt => {
            return opt.value == fullYear || 
                  opt.value == year || 
                  opt.text.includes(fullYear.toString()) || 
                  opt.text.includes(year);
          });
          
          if (yearOption) {
            field.value = yearOption.value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
      
      // Strategy 5: Select first non-empty option as fallback
      const firstOption = options.find(opt => opt.value && !opt.disabled);
      if (firstOption) {
        field.value = firstOption.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`Selected first available option: ${firstOption.text}`);
        return true;
      }
      
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
   * Fix validation errors in form fields to prevent failures
   */
  fixValidationErrors() {
    try {
      // Fix email field if it contains address data
      const emailField = document.querySelector('#EMAIL, input[name="email"], input[data-id="email-textbox"]');
      if (emailField && !emailField.value.includes('@')) {
        console.log('Fixing invalid email field with value:', emailField.value);
        emailField.value = '';
        emailField.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Fix other potential validation issues
      const phoneField = document.querySelector('#PHONE_NUMBER, input[name="phoneNumber"], input[data-id="phone-number-textbox"]');
      if (phoneField && phoneField.value && phoneField.value.length < 3) {
        console.log('Fixing potentially invalid phone field');
        phoneField.value = '';
        phoneField.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (e) {
      console.error('Error fixing validation errors:', e);
    }
  },
  
  
  /**
   * Fill form with user data - enhanced with payment field handling
   * @returns {Promise<{count: number, fields: string[]}>} Details of filled fields
   */
  async fillForm() {
    let filledCount = 0;
    const filledFields = [];
    const failedFields = [];
    
    try {
      // First fix any validation errors
      this.fixValidationErrors();
      
      // Get user data
      const userData = await new Promise(resolve => {
        chrome.storage.sync.get(null, data => {
          resolve(data || {});
        });
      });
      
      console.log('Retrieved user data for form filling:', Object.keys(userData));
      
      // Define field mapping
      const fieldMapping = {
        'first': 'first',
        'last': 'last',
        'email': 'email',
        'emailConfirm': 'email',
        'phone': 'phone',
      };
      
      // Get current region for regional adaptations
      const { region = "US" } = await chrome.storage.sync.get(["region"]);
      
      // Fill each field with a delay between them
      for (const [fieldId, dataKey] of Object.entries(fieldMapping)) {
        if (userData[dataKey] != null && userData[dataKey] !== '') {
          // Add a random delay to seem more human-like
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
          
          const field = this.getField(fieldId);
          if (field) {
            if (this.fillField(field, userData[dataKey])) {
              filledCount++;
              filledFields.push(fieldId);
            } else {
              failedFields.push(fieldId);
              console.log(`Failed to fill field: ${fieldId}`);
            }
          } else {
            failedFields.push(fieldId);
            console.log(`Field not found: ${fieldId}`);
          }
        }
      }
      
      // Handle payment fields separately with enhanced iframe handling
      const paymentResult = await fillPaymentFields();
      if (paymentResult.count > 0) {
        filledCount += paymentResult.count;
        filledFields.push('payment-fields');
      }
      
      // Check agreement checkboxes
      const checkedCount = this.checkRelevantCheckboxes();
      if (checkedCount > 0) {
        filledCount += checkedCount;
        filledFields.push('checkboxes');
      }
      
      console.log(`Form filling complete. Filled ${filledCount} fields:`, filledFields.join(', '));
      console.log(`Failed to fill ${failedFields.length} fields:`, failedFields.join(', '));
      
      return {
        count: filledCount,
        fields: filledFields,
        failedFields: failedFields
      };
    } catch (e) {
      console.error('Error filling form:', e);
      return {
        count: filledCount,
        fields: filledFields,
        failedFields: failedFields,
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
      if (this.isLikelyAgreementCheckbox(checkbox) && !checkbox.checked) {
        try {
          // Try clicking the checkbox directly (more reliable than setting .checked)
          checkbox.click();
          checkedCount++;
          console.log("Checked agreement checkbox");
        } catch (e) {
          console.error(`Error clicking checkbox:`, e);
          
          // Fallback to programmatic setting
          try {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            checkbox.dispatchEvent(new Event('click', { bubbles: true }));
            checkedCount++;
          } catch (e2) {
            console.error(`Fallback checkbox checking failed:`, e2);
          }
        }
      }
    });
    
    return checkedCount;
  },
  
  /**
   * Improved checkbox detection that handles multiple languages
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
    
    // Check for nearby text nodes in parent elements (up to 3 levels)
    if (!checkboxText) {
      let element = checkbox.parentElement;
      for (let i = 0; i < 3 && element; i++) {
        checkboxText = element.textContent;
        if (checkboxText) break;
        element = element.parentElement;
      }
    }
    
    // Check for terms-related keywords in multiple languages
    const termsKeywords = [
      'agree', 'consent', 'terms', 'conditions', 'privacy', 'policy', 
      'subscribe', 'newsletter', 'accept', 'update', 'purchase', 
      'kabul', 'onay', 'şartlar', 'koşullar', 'gizlilik', 'abone'
    ];
    
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
    
    return false;
  }
};

async function waitFor(selector, timeout = 7000) {
  const poll = 150;
  const max  = timeout / poll;
  let el, n = 0;
  while (!el && n++ < max) {
    el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, poll));
  }
  return null;
}


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
   * Enhanced order panel with debugging options
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
      <button class="btn" id="fix-validation-btn">Fix Validation Errors</button>
      <button class="btn" id="check-terms-btn">Check Terms</button>
      
      <div id="panel-status" class="status"></div>
    `;
    
    // Set up event handlers
    panel.querySelector('#tesla-panel-close').addEventListener('click', () => {
      panel.remove();
    });
    
    panel.querySelector('#fill-form-btn').addEventListener('click', async () => {
      const result = await FormHandler.fillForm();
      this.showStatus(panel, `${result.count} fields filled successfully!`, true);
      
      // Show info about failed fields if any
      if (result.failedFields && result.failedFields.length > 0) {
        setTimeout(() => {
          const paymentFields = ['cardName', 'cardNumber', 'cardCVV', 'cardExpMonth', 'cardExpYear'];
          const failedPaymentFields = result.failedFields.filter(f => paymentFields.includes(f));
          
          if (failedPaymentFields.length > 0) {
            this.showStatus(panel, `Payment fields are in a secure iframe - fill manually`, false);
          } else {
            this.showStatus(panel, `Some fields not found: ${result.failedFields.join(', ')}`, false);
          }
        }, 3000);
      }
    });
    
    panel.querySelector('#fix-validation-btn').addEventListener('click', () => {
      FormHandler.fixValidationErrors();
      this.showStatus(panel, `Fixed validation errors`, true);
    });
    
    panel.querySelector('#check-terms-btn').addEventListener('click', () => {
      // Check all checkboxes
      let count = FormHandler.checkRelevantCheckboxes();
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

// Update your message handler in inject.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  // For simple requests that don't need async, respond immediately
  if (message.action === 'ping') {
    sendResponse({ status: 'pong' });
    return false; // No async response needed
  }
  
  // For async operations, use a Promise with timeout
  if (['togglePanel', 'fillForm', 'fixValidation', 'updateFilters', 'updateInventoryResults'].includes(message.action)) {
    // Create a response timeout to ensure we always respond
    const responseTimeout = setTimeout(() => {
      console.warn(`Message handler for ${message.action} timed out after 5 seconds`);
      sendResponse({ success: false, error: 'Operation timed out' });
    }, 5000);
    
    // Handle each action type
    handleAsyncMessage(message, sendResponse, responseTimeout);
    
    return true; // Signal that we'll respond asynchronously
  }
  
  // If action not recognized, respond with error
  sendResponse({ success: false, error: 'Unknown action' });
  return false; // No async response needed
});

/**
 * Handle async messages with proper timeout and error handling
 */
async function handleAsyncMessage(message, sendResponse, responseTimeout) {
  try {
    switch (message.action) {
      case 'togglePanel':
        PanelUI.togglePanel();
        clearTimeout(responseTimeout);
        sendResponse({ success: true, status: 'Panel toggled' });
        break;
        
      case 'fillForm':
        const fillResult = await FormHandler.fillForm();
        clearTimeout(responseTimeout);
        sendResponse({ success: true, status: 'Form filled', count: fillResult.count });
        break;
        
      case 'fixValidation':
        FormHandler.fixValidationErrors();
        clearTimeout(responseTimeout);
        sendResponse({ success: true, status: 'Validation fixed' });
        break;
        
      case 'updateFilters':
        console.log('Applying filters to page:', message.filters);
        // Handle filters update without navigation if possible
        const filtersResult = await applyFiltersWithoutNavigation(message.filters);
        clearTimeout(responseTimeout);
        sendResponse({ success: filtersResult, status: filtersResult ? 'Filters applied' : 'Failed to apply filters' });
        break;
        
      case 'updateInventoryResults':
        // Handle inventory results update
        console.log('Received inventory results:', message.vehicles.length);
        // Store results in a variable that can be accessed by the page
        window.teslaAutopilotInventoryResults = message.vehicles;
        // Maybe update UI if needed
        clearTimeout(responseTimeout);
        sendResponse({ success: true, status: 'Inventory results updated' });
        break;
        
      default:
        clearTimeout(responseTimeout);
        sendResponse({ success: false, error: 'Unhandled action type' });
    }
  } catch (error) {
    console.error(`Error handling async message for action ${message.action}:`, error);
    clearTimeout(responseTimeout);
    sendResponse({ success: false, error: error.message || 'Unknown error' });
  }
}

/**
 * Apply filters without navigating away from the page if possible
 */
async function applyFiltersWithoutNavigation(filters) {
  try {
    // Find price input
    const priceInputs = findPriceRangeInputs();
    if (!priceInputs || priceInputs.length === 0) {
      console.warn('No price inputs found');
      return false;
    }
    
    const priceInput = priceInputs[0];
    const currentValue = parseInt(priceInput.value) || 0;
    const targetValue = parseInt(filters.priceMax) || 0;
    
    console.log(`Trying to update price from ${currentValue} to ${targetValue}`);
    
    if (targetValue > 0) {
      // Set the value
      priceInput.value = targetValue;
      
      // Dispatch events
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Wait a bit for UI to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Try to find and click apply button
      return await findAndClickApplyButton();
    }
    
    return false;
  } catch (error) {
    console.error('Error applying filters without navigation:', error);
    return false;
  }
}

/**
 * Find price range inputs on the page
 */
function findPriceRangeInputs() {
  const inputs = [];
  
  // Look for price inputs using various selectors
  const selectors = [
    'input[type="range"][name*="price"]',
    'input[type="range"][id*="price"]',
    'input[type="range"][aria-label*="price"]',
    'input[type="range"]' // fallback
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach(el => inputs.push(el));
    }
  }
  
  console.log(`Found possible price range inputs: ${inputs.length}`);
  return inputs;
}

/**
 * Find and click the Apply button
 * @returns {Promise<boolean>} Success status
 */
async function findAndClickApplyButton() {
  try {
    // Get all buttons on the page
    const allButtons = Array.from(document.querySelectorAll('button'));
    
    // Try to find an apply button by text content
    const applyButtons = allButtons.filter(btn => {
      const text = btn.textContent.trim().toLowerCase();
      return text === 'apply' || text.includes('apply');
    });
    
    // Try to find form submit buttons
    const submitButtons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'));
    
    // Try specific Tesla selectors
    const teslaButtons = Array.from(document.querySelectorAll('.tds-btn--primary, .tds-btn--secondary'));
    
    // Combine all possible buttons, prioritizing explicit apply buttons
    const possibleButtons = [
      ...applyButtons,
      ...submitButtons,
      ...teslaButtons,
      ...allButtons.filter(btn => btn.className.includes('submit') || btn.className.includes('apply'))
    ];
    
    // Try clicking the first available button
    for (const button of possibleButtons) {
      if (button && !button.disabled) {
        console.log('Clicking button:', button);
        button.click();
        return true;
      }
    }
    
    // If no button found, try to find and submit a form
    const forms = document.querySelectorAll('form');
    if (forms.length > 0) {
      console.log('No button found, submitting form directly');
      forms[0].submit();
      return true;
    }
    
    console.warn('Could not find any apply button or form');
    return false;
  } catch (error) {
    console.error('Error finding/clicking apply button:', error);
    return false;
  }
}

// Initialize everything
function initialize() {
  console.log('Tesla AutoPilot content script initialized on:', window.location.href);
  
  // Add styles for panel and notifications
  addPanelStyles();
  
  // Check if we need to auto-fill forms
  if (Helpers.isOrderPage() && window.location.href.includes('autoFill=true')) {
    // Auto-fill form after a short delay to ensure page is loaded
    setTimeout(() => {
      FormHandler.fillForm().then(result => {
        if (result.count > 0) {
          Helpers.showNotification(`${result.count} fields filled automatically`);
        }
      });
    }, 1000);
  }
}

// Start the script
initialize();


async function fillPaymentFields() {
    console.log("Posting autoFillPayment into payment iframes…");
    // target only Tesla payment iframes, adjust selector if yours differs
    const frames = document.querySelectorAll('iframe.payment-website, iframe[src*="static-assets-pay.tesla.com"]');
    frames.forEach(frame => {
          // 1) Immediately post a ping (in case the iframe and listener are already up)
          if (frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'autoFillPayment' }, '*');
            console.log("→ initial ping to iframe for autofill");
          }
      
          // 2) Also listen for its load event, then ping again
          frame.addEventListener('load', () => {
            if (frame.contentWindow) {
              frame.contentWindow.postMessage({ type: 'autoFillPayment' }, '*');
              console.log("→ load-event ping to iframe for autofill");
            }
          });
        });
    // we don't know how many fields the iframe itself will fill, so just return count = number of frames
    return { success: true, count: frames.length };
  }

/**
 * Find all form fields on the page including those in accessible iframes
 * @returns {Array} Array of form field elements
 */
function findAllFormFields() {
  const fields = [];
  
  // First, get all inputs, selects on the main document
  const mainFields = document.querySelectorAll('input, select');
  mainFields.forEach(field => fields.push(field));
  
  // Try to access same-origin iframes (may not work with cross-origin iframes)
  try {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        if (iframe.contentDocument) {
          const iframeFields = iframe.contentDocument.querySelectorAll('input, select');
          iframeFields.forEach(field => fields.push(field));
        }
      } catch (e) {
        // Ignore cross-origin iframe errors
      }
    });
  } catch (e) {
    // Ignore errors from accessing iframes
  }
  
  return fields;
}

/**
 * Determine the type of field based on its attributes
 * @param {HTMLElement} field - The field to analyze
 * @returns {string|null} The field type or null if unknown
 */
function determineFieldType(field) {
  // Get all available attributes
  const id = field.id?.toLowerCase() || '';
  const name = field.name?.toLowerCase() || '';
  const placeholder = field.placeholder?.toLowerCase() || '';
  const ariaLabel = field.getAttribute('aria-label')?.toLowerCase() || '';
  const type = field.type?.toLowerCase() || '';
  const className = field.className?.toLowerCase() || '';
  
  // Check for credit card name
  if (id.includes('card') && id.includes('name') || 
      name.includes('card') && name.includes('name') ||
      name.includes('cardholder') ||
      placeholder.includes('name on card') ||
      ariaLabel.includes('name on card')) {
    return 'cardName';
  }
  
  // Check for credit card number
  if (id.includes('card') && id.includes('number') || 
      name.includes('card') && name.includes('number') ||
      name.includes('cardnumber') ||
      placeholder.includes('card number') ||
      ariaLabel.includes('card number')) {
    return 'cardNumber';
  }
  
  // Check for CVV
  if (id.includes('cvv') || id.includes('cvc') || id.includes('security') ||
      name.includes('cvv') || name.includes('cvc') || name.includes('security') ||
      placeholder.includes('cvv') || placeholder.includes('security code') ||
      ariaLabel.includes('cvv') || ariaLabel.includes('security code')) {
    return 'cardCVV';
  }
  
  // Check for expiration month
  if ((id.includes('expir') || name.includes('expir')) && 
      (id.includes('month') || name.includes('month'))) {
    return 'cardExpMonth';
  }
  
  // Check for expiration year
  if ((id.includes('expir') || name.includes('expir')) && 
      (id.includes('year') || name.includes('year'))) {
    return 'cardExpYear';
  }
  
  // Check for ZIP/postal code
  if (id.includes('zip') || id.includes('postal') ||
      name.includes('zip') || name.includes('postal') ||
      placeholder.includes('zip') || placeholder.includes('postal') ||
      ariaLabel.includes('zip') || ariaLabel.includes('postal')) {
    return 'zip';
  }
  
  return null;
}

/**
 * More aggressive approach to fill a field
 * @param {HTMLElement} field - The field to fill
 * @param {string} value - The value to fill
 * @returns {boolean} Whether filling was successful
 */
function attemptFieldFill(field, value) {
  try {
    // First try normal value setting
    const originalValue = field.value;
    field.value = value;
    
    // Dispatch input and change events
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    
    // If that didn't work (value didn't change), try more aggressive approaches
    if (field.value !== value && field.value === originalValue) {
      // Try using property descriptor if available
      try {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(field, value);
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (e) {
        // Ignore errors with property descriptor approach
      }
      
      // Try focus and keyboard simulation approach
      try {
        field.focus();
        field.select();
        
        // For each character in the value, simulate keypress
        for (const char of value) {
          field.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          field.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
          field.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        }
        
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        // Ignore errors with keyboard simulation
      }
    }
    
    // Return success if value was set
    return field.value === value;
  } catch (error) {
    console.warn(`Field fill attempt failed: ${error.message}`);
    return false;
  }
}

/**
 * Parse expiration date string into month and year
 * @param {string} expDate - Expiration date string (e.g., "MM/YY")
 * @returns {Object} Object with month and year
 */
function parseExpirationDate(expDate) {
  if (!expDate) {
    return { month: '', year: '' };
  }
  
  // Handle various formats
  const match = expDate.match(/(\d{1,2})[\/\-\s]?(\d{2,4})/);
  if (match) {
    const month = match[1].padStart(2, '0');
    let year = match[2];
    
    // Convert 2-digit year to 4-digit
    if (year.length === 2) {
      year = '20' + year;
    }
    
    return { month, year };
  }
  
  return { month: '', year: '' };
}

/**
 * Fill a form field with the given value
 * @param {HTMLElement} field - The field to fill
 * @param {string} value - The value to fill
 * @returns {boolean} Whether filling was successful
 */
function fillField(field, value) {
  if (!field || !value) return false;
  
  try {
    // Handle select elements differently
    if (field.tagName === 'SELECT') {
      return fillSelectField(field, value);
    }
    
    // For text inputs, set value and trigger events
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    
    return true;
  } catch (error) {
    console.error(`Error filling field:`, error);
    return false;
  }
}

/**
 * Fill a select field with the given value
 * @param {HTMLSelectElement} field - The select field to fill
 * @param {string} value - The value to select
 * @returns {boolean} Whether filling was successful
 */
function fillSelectField(field, value) {
  try {
    // Get all options
    const options = Array.from(field.options);
    
    // Try direct value match
    let match = options.find(opt => opt.value === value);
    
    // If no match, try text content match
    if (!match) {
      match = options.find(opt => opt.text === value || opt.text.includes(value));
    }
    
    // If still no match, try numeric match
    if (!match && !isNaN(parseInt(value))) {
      const numValue = parseInt(value);
      match = options.find(opt => {
        const optNum = parseInt(opt.value);
        return !isNaN(optNum) && optNum === numValue;
      });
    }
    
    // Set the value if found
    if (match) {
      field.value = match.value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error filling select field:`, error);
    return false;
  }
}

/**
 * Make an element draggable
 * @param {HTMLElement} element - The element to make draggable
 */
function makeElementDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  const header = element.querySelector('strong') || element;
  header.style.cursor = 'move';
  
  header.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
}