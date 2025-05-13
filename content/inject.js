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
   * Fill form with user data - enhanced with validation fixing and better field targeting
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
      
      // Special handling for expiration date
      if (userData.cardExp) {
        const { month, year } = this.parseExpirationDate(userData.cardExp);
        
        // Try to fill month field
        if (month) {
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
          const monthField = await waitFor('select[name="ccExpMonth"]');

          if (monthField && this.fillField(monthField, month)) {
            filledCount++;
            filledFields.push('cardExpMonth');
          } else {
            failedFields.push('cardExpMonth');
          }
        }
        
        // Try to fill year field
        if (year) {
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
          const yearField = this.getField('cardExpYear');
          if (yearField && this.fillField(yearField, year)) {
            filledCount++;
            filledFields.push('cardExpYear');
          } else {
            failedFields.push('cardExpYear');
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
      console.log(`Failed to fill ${failedFields.length} fields:`, failedFields.join(', '));
      
      // If some fields failed, attempt to explain why
      if (failedFields.length > 0) {
        // Check if payment fields failed - these are likely in an iframe
        const paymentFields = ['cardName', 'cardNumber', 'cardCVV', 'cardExpMonth', 'cardExpYear'];
        const failedPaymentFields = failedFields.filter(f => paymentFields.includes(f));
        
        if (failedPaymentFields.length > 0) {
          console.log('Note: Payment fields are likely in a secure iframe and cannot be accessed directly.');
        }
      }
      
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
    if (message.cmd === 'togglePanel' || message.action === 'togglePanel') {
      PanelUI.togglePanel();
      sendResponse({ status: 'Panel toggled' });
      return true;
    }
    
    // Fill form fields
    if (message.action === 'fillForm') {
      FormHandler.fillForm().then(result => {
        sendResponse({ status: 'Form filled', count: result.count });
      }).catch(err => {
        console.error('Error filling form:', err);
        sendResponse({ status: 'Error', error: err.message });
      });
      return true;
    }
    
    // Handle fix validation errors
    if (message.action === 'fixValidation') {
      FormHandler.fixValidationErrors();
      sendResponse({ status: 'Validation fixed' });
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

// Tesla Payment Helper
// Add this to the end of your inject.js file

// Add a helper to directly assist with payment input since it's in an iframe
(function() {
  console.log("Loading Tesla payment helper...");
  
  // Wait for FormHandler to be defined
  const checkInterval = setInterval(() => {
    if (typeof FormHandler !== 'undefined') {
      clearInterval(checkInterval);
      extendFormHandlerWithPaymentHelp();
    }
  }, 100);
  
  function extendFormHandlerWithPaymentHelp() {
    // Create a simple helper to show payment info to the user
    FormHandler.showPaymentHelper = function() {
      // Get user data
      chrome.storage.sync.get(null, data => {
        // Create payment helper dialog
        const helperDialog = document.createElement('div');
        helperDialog.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          padding: 20px;
          width: 350px;
          max-width: 90vw;
          z-index: 99999;
          font-family: system-ui, sans-serif;
          color: #333;
        `;
        
        // Get payment info
        const cardName = data.cardName || '';
        const cardNumber = data.cardNumber || '';
        const cardExp = data.cardExp || '';
        const cardCVV = data.cardCVV || '';
        const zip = data.zip || '';
        
        // Create dialog content
        helperDialog.innerHTML = `
          <h3 style="margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; font-size: 16px;">
            Payment Information Helper
          </h3>
          <p style="font-size: 14px; color: #666;">
            Payment fields are inside a secure iframe and cannot be filled automatically.
            Copy these values to manually fill the payment form:
          </p>
          <div style="margin: 15px 0;">
            <div style="margin-bottom: 10px;">
              <div style="font-weight: bold; font-size: 13px; margin-bottom: 3px;">Name on Card:</div>
              <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace;">${cardName}</div>
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-weight: bold; font-size: 13px; margin-bottom: 3px;">Card Number:</div>
              <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace;">${cardNumber}</div>
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-weight: bold; font-size: 13px; margin-bottom: 3px;">Expiration:</div>
              <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace;">${cardExp}</div>
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-weight: bold; font-size: 13px; margin-bottom: 3px;">Security Code (CVV):</div>
              <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace;">${cardCVV}</div>
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-weight: bold; font-size: 13px; margin-bottom: 3px;">Billing ZIP:</div>
              <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace;">${zip}</div>
            </div>
          </div>
          <div style="text-align: right; margin-top: 15px;">
            <button id="payment-helper-close" style="background: #3b82f6; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
              Close
            </button>
          </div>
        `;
        
        // Add to page
        document.body.appendChild(helperDialog);
        
        // Set up close button
        document.getElementById('payment-helper-close').addEventListener('click', () => {
          helperDialog.remove();
        });
        
        // Auto-close after 1 minute
        setTimeout(() => {
          if (document.body.contains(helperDialog)) {
            helperDialog.remove();
          }
        }, 60000);
      });
    };
    
    // Add a button to the panel to show payment helper
    const originalCreateOrderPanel = PanelUI.createOrderPanel;
    
    PanelUI.createOrderPanel = async function(panel) {
      // Call original method
      await originalCreateOrderPanel.call(this, panel);
      
      // Add payment helper button to panel
      const filledFormBtn = panel.querySelector('#fill-form-btn');
      if (filledFormBtn) {
        const paymentHelperBtn = document.createElement('button');
        paymentHelperBtn.className = 'btn';
        paymentHelperBtn.textContent = 'Show Payment Info';
        paymentHelperBtn.id = 'payment-helper-btn';
        paymentHelperBtn.style.background = '#3b82f6';
        
        filledFormBtn.parentNode.insertBefore(paymentHelperBtn, filledFormBtn.nextSibling);
        
        paymentHelperBtn.addEventListener('click', () => {
          FormHandler.showPaymentHelper();
          this.showStatus(panel, 'Payment helper shown', true);
        });
      }
    };
    
    // Enhance fill form to automatically show payment helper
    const originalFillForm = FormHandler.fillForm;
    
    FormHandler.fillForm = async function() {
      const result = await originalFillForm.call(this);
      
      // Check if we failed to fill payment fields
      const paymentFields = ['cardName', 'cardNumber', 'cardCVV', 'cardExpMonth', 'cardExpYear', 'billingZip'];
      const missingPaymentFields = result.failedFields?.filter(f => paymentFields.includes(f)) || [];
      
      if (missingPaymentFields.length > 0) {
        // Wait a moment before showing the helper
        setTimeout(() => {
          FormHandler.showPaymentHelper();
        }, 1000);
      }
      
      return result;
    };
    
    // Add a keyboard shortcut to trigger the payment helper
    document.addEventListener('keydown', (e) => {
      // Alt+P to show payment helper
      if (e.altKey && e.key === 'p') {
        FormHandler.showPaymentHelper();
      }
    });
    
    console.log("Tesla payment helper loaded successfully!");
  }
})();

// Tesla Shipping Address Enhancement
// Add this to the end of your inject.js file

// Add a shipping address helper to fill in missing shipping fields
(function() {
  console.log("Loading Tesla shipping address helper...");
  
  // Wait for FormHandler to be defined
  const checkInterval = setInterval(() => {
    if (typeof FormHandler !== 'undefined') {
      clearInterval(checkInterval);
      extendFormHandlerWithShippingHelp();
    }
  }, 100);
  
  function extendFormHandlerWithShippingHelp() {
    // Create a method to handle shipping fields specifically
    FormHandler.fillShippingFields = async function() {
      try {
        // Get user data
        const userData = await new Promise(resolve => {
          chrome.storage.sync.get(null, data => {
            resolve(data || {});
          });
        });
        
        console.log('Filling shipping fields with user data:', userData);
        
        let filledCount = 0;
        const filledFields = [];
        
        // Try to find the shipping sections
        const shippingSection = document.querySelector('h4.text-loader--subtitle, .accessories-shipping-form');
        
        if (!shippingSection) {
          console.log('Shipping section not found');
          return { count: 0, fields: [] };
        }
        
        // When filling specific section, try more aggressively with generic selectors
        // Address field
        const addressField = document.querySelector(
          'input[placeholder*="shipping address"], input[placeholder*="Address"], input[name*="shipping"], input[id*="shipping"]'
        );
        
        if (addressField && userData.addr1) {
          await new Promise(resolve => setTimeout(resolve, 200));
          if (this.fillField(addressField, userData.addr1)) {
            filledCount++;
            filledFields.push('shipping-address');
          }
        }
        
        // Address line 2
        const address2Field = document.querySelector(
          'input[placeholder*="Apartment"], input[placeholder*="Suite"], input[id*="line-2"], input[name*="line2"]'
        );
        
        if (address2Field && userData.addr2) {
          await new Promise(resolve => setTimeout(resolve, 200));
          if (this.fillField(address2Field, userData.addr2)) {
            filledCount++;
            filledFields.push('shipping-address2');
          }
        }
        
        // City
        const cityField = document.querySelector(
          'input[placeholder*="City"], input[name*="city"], input[id*="city"]'
        );
        
        if (cityField && userData.city) {
          await new Promise(resolve => setTimeout(resolve, 200));
          if (this.fillField(cityField, userData.city)) {
            filledCount++;
            filledFields.push('shipping-city');
          }
        }
        
        // ZIP
        const zipField = document.querySelector(
          'input[placeholder*="ZIP"], input[placeholder*="Zip"], input[placeholder*="Postal"], input[name*="zip"], input[name*="postal"]'
        );
        
        if (zipField && userData.zip) {
          await new Promise(resolve => setTimeout(resolve, 200));
          if (this.fillField(zipField, userData.zip)) {
            filledCount++;
            filledFields.push('shipping-zip');
          }
        }
        
        // State - can be dropdown or input
        const stateField = document.querySelector(
          'select[name*="state"], select[id*="state"], input[name*="state"], input[id*="state"]'
        );
        
        if (stateField && userData.state) {
          await new Promise(resolve => setTimeout(resolve, 200));
          if (this.fillField(stateField, userData.state)) {
            filledCount++;
            filledFields.push('shipping-state');
          }
        }
        
        console.log(`Shipping section: filled ${filledCount} fields:`, filledFields.join(', '));
        
        return {
          count: filledCount,
          fields: filledFields
        };
      } catch (e) {
        console.error('Error filling shipping fields:', e);
        return { count: 0, fields: [] };
      }
    };
    
    // Extension points for original fillForm
    const originalFillForm = FormHandler.fillForm;
    
    FormHandler.fillForm = async function() {
      // Call original method
      const result = await originalFillForm.call(this);
      
      // Add extra attempt for shipping fields
      const shippingResult = await this.fillShippingFields();
      
      // Combine results
      return {
        count: result.count + shippingResult.count,
        fields: [...result.fields, ...shippingResult.fields],
        failedFields: result.failedFields || []
      };
    };
    
    console.log("Tesla shipping address helper loaded successfully!");
  }
})();


(function() {
  console.log('Enhanced Tesla ZIP Code Dialog Filler initializing...');
  
  // Store a local copy of the ZIP code for fallback
  let cachedZipCode = null;
  
  // Try to pre-load the ZIP code
  chrome.storage.sync.get(['zip'], function(data) {
    if (data && data.zip) {
      cachedZipCode = data.zip;
      console.log(`Loaded ZIP code from storage: ${cachedZipCode}`);
    } else {
      console.log('No ZIP code found in storage, will prompt user on first run');
    }
  });

  /**
   * Function to check for and fill ZIP code dialog with better error handling
   */
  function detectAndFillZipDialog() {
    console.log('Checking for ZIP code dialog...');
    
    try {
      // First look for the specific Tesla ZIP code dialog
      const zipDialog = document.querySelector('dialog.postal-search-modal--container, .tds-modal.postal-search-modal--container');
      
      if (zipDialog) {
        console.log('Found ZIP code dialog:', zipDialog);
        
        // Find the ZIP input directly in the dialog
        const zipInput = zipDialog.querySelector('input[name="zip"], input[data-id="registration-postal-code-textbox"]');
        
        if (zipInput) {
          console.log('Found ZIP input field:', zipInput);
          fillZipField(zipInput, zipDialog);
          return;
        }
      }
      
      // Fallback: Look for any dialog with ZIP input
      const allDialogs = document.querySelectorAll('dialog, .tds-modal');
      
      for (const dialog of allDialogs) {
        const zipInput = dialog.querySelector('input[name="zip"], input[data-id="registration-postal-code-textbox"], input[placeholder*="Zip"], input[placeholder*="ZIP"]');
        
        if (zipInput) {
          console.log('Found ZIP input in dialog:', zipInput);
          fillZipField(zipInput, dialog);
          return;
        }
      }
      
      // Last resort: Look for any ZIP input on the page
      const zipInputs = document.querySelectorAll('input[name="zip"], input[data-id="registration-postal-code-textbox"], input[placeholder*="Zip"], input[placeholder*="ZIP"]');
      
      if (zipInputs.length > 0) {
        console.log('Found ZIP input on page:', zipInputs[0]);
        fillZipField(zipInputs[0]);
        return;
      }
      
      console.log('No ZIP input field found');
    } catch (error) {
      console.error('Error in detectAndFillZipDialog:', error);
    }
  }
  
  /**
   * Fill a ZIP code field and submit it
   * @param {HTMLInputElement} zipInput - The ZIP input field
   * @param {HTMLElement} container - Optional parent container
   */
  function fillZipField(zipInput, container = null) {
    // Get ZIP code from storage or cached value
    getZipCode().then(zipCode => {
      if (!zipCode) {
        console.log('No ZIP code available, prompting user');
        promptForZipCode(zipInput, container);
        return;
      }
      
      try {
        console.log(`Filling ZIP field with: ${zipCode}`);
        
        // Focus the field
        zipInput.focus();
        
        // Clear existing value
        zipInput.value = '';
        zipInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Set the new value
        zipInput.value = zipCode;
        zipInput.dispatchEvent(new Event('input', { bubbles: true }));
        zipInput.dispatchEvent(new Event('change', { bubbles: true }));
        zipInput.dispatchEvent(new Event('blur', { bubbles: true }));
        
        // Verify field was filled
        console.log(`Field value after filling: "${zipInput.value}"`);
        
        if (zipInput.value !== zipCode) {
          // Try alternative method for stubborn fields
          console.log('Direct value setting failed, trying property descriptor method');
          const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          if (descriptor && descriptor.set) {
            descriptor.set.call(zipInput, zipCode);
          }
          
          // Try setting via JavaScript directly
          setTimeout(() => {
            zipInput.value = zipCode;
            zipInput.dispatchEvent(new Event('input', { bubbles: true }));
            zipInput.dispatchEvent(new Event('change', { bubbles: true }));
          }, 50);
        }
        
        // Show notification
        showZipFilledNotification(zipCode);
        
        // Click submit button or submit form after a short delay
        setTimeout(() => submitZipCode(zipInput, container), 300);
      } catch (error) {
        console.error('Error filling ZIP field:', error);
      }
    }).catch(error => {
      console.error('Error getting ZIP code:', error);
      promptForZipCode(zipInput, container);
    });
  }
  
  /**
   * Prompt user for ZIP code if none is found
   */
  function promptForZipCode(zipInput, container) {
    // Create a simple dialog to ask for ZIP code
    const promptDialog = document.createElement('div');
    promptDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0,0,0,0.3);
      z-index: 100000;
      width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    promptDialog.innerHTML = `
      <h3 style="margin-top:0;">Enter ZIP Code</h3>
      <p>No ZIP code found in storage. Please enter your ZIP code:</p>
      <input type="text" id="tesla-zip-prompt" style="width:100%;padding:8px;margin:10px 0;box-sizing:border-box;" placeholder="Enter ZIP code">
      <div style="display:flex;justify-content:space-between;margin-top:15px;">
        <button id="tesla-zip-cancel" style="padding:8px 15px;background:#eee;border:none;border-radius:4px;cursor:pointer;">Cancel</button>
        <button id="tesla-zip-save" style="padding:8px 15px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;">Save & Apply</button>
      </div>
      <label style="display:block;margin-top:15px;">
        <input type="checkbox" id="tesla-zip-remember" checked> Remember this ZIP code
      </label>
    `;
    
    document.body.appendChild(promptDialog);
    
    // Focus the input
    setTimeout(() => document.getElementById('tesla-zip-prompt').focus(), 100);
    
    // Handle save button
    document.getElementById('tesla-zip-save').addEventListener('click', () => {
      const newZip = document.getElementById('tesla-zip-prompt').value.trim();
      const remember = document.getElementById('tesla-zip-remember').checked;
      
      if (newZip) {
        // Remove prompt
        promptDialog.remove();
        
        // Save ZIP if requested
        if (remember) {
          saveZipCode(newZip);
        } else {
          // Just cache it for this session
          cachedZipCode = newZip;
        }
        
        // Fill the field
        zipInput.value = newZip;
        zipInput.dispatchEvent(new Event('input', { bubbles: true }));
        zipInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Submit after a short delay
        setTimeout(() => submitZipCode(zipInput, container), 300);
      }
    });
    
    // Handle cancel button
    document.getElementById('tesla-zip-cancel').addEventListener('click', () => {
      promptDialog.remove();
    });
    
    // Handle Enter key
    document.getElementById('tesla-zip-prompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('tesla-zip-save').click();
      }
    });
  }
  
  /**
   * Submit the ZIP code form or click appropriate button
   */
  function submitZipCode(zipInput, container) {
    try {
      // First try to find and click a submit button
      let submitButton = findSubmitButton(container || document);
      
      if (submitButton) {
        console.log('Clicking submit button:', submitButton);
        submitButton.click();
        return;
      }
      
      // If no button found, try to submit the form
      const form = zipInput.closest('form');
      if (form) {
        console.log('Submitting parent form');
        form.dispatchEvent(new Event('submit', { bubbles: true }));
        return;
      }
      
      // Last resort: press Enter on the input
      console.log('Trying Enter key on input');
      zipInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
    } catch (error) {
      console.error('Error submitting ZIP code:', error);
    }
  }
  
  /**
   * Find a submit button within a container
   */
  function findSubmitButton(container) {
    // List of button selectors in order of preference
    const buttonSelectors = [
      // By text content
      'button:not([aria-label*="Close"]):not(.tds-modal-close)',
      // By common Tesla class
      'button.tds-btn',
      // Footer buttons (usually submits)
      '.tds-modal-footer button:not([aria-label*="Close"])',
      // By position
      'form button:last-child'
    ];
    
    // Try each selector
    for (const selector of buttonSelectors) {
      const buttons = container.querySelectorAll(selector);
      
      if (buttons.length > 0) {
        // Look for buttons with submit-like text first
        for (const button of buttons) {
          const text = button.textContent.toLowerCase();
          if (text.includes('search') || 
              text.includes('submit') || 
              text.includes('apply') || 
              text.includes('save') ||
              text.includes('continue') ||
              text.includes('ok') ||
              text.includes('update')) {
            return button;
          }
        }
        
        // If no submit-like text button found, return the last button
        return buttons[buttons.length - 1];
      }
    }
    
    return null;
  }

  /**
   * Get the ZIP code from storage or cache
   */
  async function getZipCode() {
    // First check our cache
    if (cachedZipCode) {
      return cachedZipCode;
    }
    
    // Try to get from storage
    try {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['zip'], (data) => {
          if (chrome.runtime.lastError) {
            console.warn('Error accessing storage:', chrome.runtime.lastError);
            resolve(null);
          } else if (data && data.zip) {
            // Cache for future use
            cachedZipCode = data.zip;
            resolve(data.zip);
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Error getting ZIP from storage:', error);
      return null;
    }
  }
  
  /**
   * Save ZIP code to storage and cache
   */
  function saveZipCode(zipCode) {
    // Update cache
    cachedZipCode = zipCode;
    
    // Save to storage
    try {
      chrome.storage.sync.set({ zip: zipCode }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Error saving to storage:', chrome.runtime.lastError);
        } else {
          console.log(`Saved ZIP code to storage: ${zipCode}`);
        }
      });
    } catch (error) {
      console.error('Error saving ZIP to storage:', error);
    }
  }
  
  /**
   * Show a notification that ZIP was filled
   */
  function showZipFilledNotification(zipCode) {
    // Create notification if it doesn't exist
    let notification = document.querySelector('.tesla-zip-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'tesla-zip-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        z-index: 99999;
        font-family: system-ui, sans-serif;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: opacity 0.3s ease;
        font-size: 14px;
        opacity: 1;
      `;
      document.body.appendChild(notification);
    }
    
    // Update notification text
    notification.textContent = `Tesla AutoPilot: ZIP code ${zipCode} filled automatically`;
    notification.style.opacity = '1';
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  // Set up mutation observer to detect dialog appearance
  const observer = new MutationObserver((mutations) => {
    let dialogDetected = false;
    
    for (const mutation of mutations) {
      // Check for added nodes
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if it's a dialog or contains dialog-like elements
            if (node.tagName === 'DIALOG' || 
                node.querySelector('dialog') ||
                (node.classList && (
                  node.classList.contains('tds-modal') ||
                  node.classList.contains('postal-search-modal--container')
                ))) {
              console.log('Dialog detected in DOM changes');
              dialogDetected = true;
              break;
            }
          }
        }
      }
      
      // Check for attribute changes
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        
        // Check if a dialog or modal appeared/changed
        if ((target.tagName === 'DIALOG' && mutation.attributeName === 'open') || 
            (target.classList && target.classList.contains('tds-modal') && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'class'))) {
          dialogDetected = true;
          break;
        }
      }
      
      if (dialogDetected) break;
    }
    
    if (dialogDetected) {
      setTimeout(detectAndFillZipDialog, 300);
    }
  });
  
  // Configure the observer
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'style', 'class']
  });
  
  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fillZipDialog') {
      console.log('Manual ZIP dialog fill triggered via message');
      try {
        detectAndFillZipDialog();
        sendResponse({ status: 'ZIP dialog fill attempted', success: true });
      } catch (error) {
        console.error('Error in ZIP dialog fill handler:', error);
        sendResponse({ status: 'Error filling ZIP dialog', success: false, error: error.message });
      }
      return true;
    }
    
    // New message handler for setting ZIP code directly
    if (message.action === 'setZipCode' && message.zipCode) {
      console.log(`Received new ZIP code: ${message.zipCode}`);
      try {
        // Save the new ZIP code
        saveZipCode(message.zipCode);
        
        // Try to fill any open dialog
        detectAndFillZipDialog();
        
        sendResponse({ status: 'ZIP code set and applied', success: true });
      } catch (error) {
        console.error('Error setting ZIP code:', error);
        sendResponse({ status: 'Error setting ZIP code', success: false, error: error.message });
      }
      return true;
    }
  });
  
  // Check for dialog on page load
  window.addEventListener('load', () => {
    console.log('Page loaded, checking for ZIP dialog');
    setTimeout(detectAndFillZipDialog, 1000);
  });
  
  // Also check on initial run after a short delay
  setTimeout(detectAndFillZipDialog, 1000);
  
  console.log('Enhanced Tesla ZIP Code Dialog Filler initialized');
})();