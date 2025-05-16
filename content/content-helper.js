/**
 * Tesla AutoPilot Enhanced Content Helper
 * 
 * This script handles operations that require DOM access that
 * the service worker background script cannot perform.
 * Updated to support the new Tesla order form structure.
 */

console.log('Tesla AutoPilot enhanced content helper loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content helper received message:', request.action);
  
  // Handle CSV download request
  if (request.action === "downloadCSV" && request.csvContent) {
    try {
      // Create a download link
      const blob = new Blob([request.csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      // Format date for filename
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Create a link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `tesla-inventory-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      // Send success response
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error downloading CSV:', error);
      sendResponse({ success: false, error: error.message || String(error) });
    }
    return true;
  }
  
  // Form filling request from popup or background
  if (request.action === "fillForm") {
    try {
      console.log('Starting form fill process...');
      formHelper.fillForm().then(result => {
        sendResponse({ success: true, count: result.count, fields: result.fields });
      }).catch(error => {
        console.error('Error filling form:', error);
        sendResponse({ success: false, error: error.message || String(error) });
      });
    } catch (error) {
      console.error('Error in fill form handler:', error);
      sendResponse({ success: false, error: error.message || String(error) });
    }
    return true;
  }
  
  // Fix validation errors request
  if (request.action === "fixValidation") {
    try {
      const result = formHelper.fixValidationErrors();
      sendResponse({ success: true, message: "Validation errors fixed" });
    } catch (error) {
      console.error('Error fixing validation:', error);
      sendResponse({ success: false, error: error.message || String(error) });
    }
    return true;
  }
  
  // Toggle panel visibility request
  if (request.action === "togglePanel") {
    try {
      formHelper.togglePanel();
      sendResponse({ success: true, message: "Panel toggled" });
    } catch (error) {
      console.error('Error toggling panel:', error);
      sendResponse({ success: false, error: error.message || String(error) });
    }
    return true;
  }
  
  // Payment Helper integration
  if (request.action === "showPaymentHelper") {
    try {
      createPaymentHelper(request.paymentData);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error showing payment helper:', error);
      sendResponse({ success: false, error: error.message || String(error) });
    }
    return true;
  }
  
  // Handle filter updates when threshold changes
  if (request.action === "updateFilters" && request.filters) {
    const success = applyFiltersToPage(request.filters);
    
    if (success) {
      const priceMax = request.filters.priceMax;
      const formattedPrice = priceMax ? 
        `$${parseInt(priceMax).toLocaleString()}` : '';
        
      showFilterUpdateNotification(`Price threshold updated to ${formattedPrice}`);
    }
    
    sendResponse({ success });
    return true;
  }
  
  // Handle inventory results display
  if (request.action === "updateInventoryResults" && request.vehicles) {
    updateInventoryResults(request.vehicles, request.filters);
    sendResponse({ success: true });
    return true;
  }
  
  // Return true to keep the message channel open for async responses
  return true;
});

/**
 * Enhanced form helper object that handles the new Tesla form structure
 */
const formHelper = {
  /**
   * Panel ID for the Tesla helper panel
   */
  PANEL_ID: 'tesla-autopilot-panel',
  
  /**
   * Find a field in the form based on various selectors
   * @param {string} fieldName - Field identifier
   * @returns {HTMLElement|null} - The field element if found
   */
  getField(fieldName) {
    // Updated selectors for the new Tesla form structure
    const selectors = {
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
    };
    
    // Try each selector for the field
    if (selectors[fieldName]) {
      for (const selector of selectors[fieldName]) {
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
    
    // If not found with direct selectors, look more broadly
    return this.findFieldByLabels(fieldName);
  },
  
  /**
   * Find a field by looking for text labels near inputs
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
    
    // Method 2: Find based on text elements near inputs
    for (const labelText of labelsToFind) {
      // Find text elements that match our label text
      const textElements = Array.from(document.querySelectorAll('*')).filter(el => {
        // Filter for elements with just text content (no child elements)
        const hasOnlyText = el.children.length === 0 && el.textContent.trim() !== '';
        return hasOnlyText && el.textContent.includes(labelText);
      });
      
      for (const textEl of textElements) {
        // Look for inputs nearby this text element
        
        // 1. Check parent's descendants
        const parent = textEl.parentElement;
        if (parent) {
          const inputs = parent.querySelectorAll('input, select, button');
          if (inputs.length > 0) return inputs[0];
          
          // 2. Check siblings after this text element
          let sibling = textEl.nextElementSibling;
          while (sibling) {
            const input = sibling.querySelector('input, select, button');
            if (input) return input;
            
            // Check if sibling itself is an input
            if (sibling.tagName === 'INPUT' || sibling.tagName === 'SELECT' || sibling.tagName === 'BUTTON') {
              return sibling;
            }
            
            sibling = sibling.nextElementSibling;
          }
          
          // 3. Check grandparent's descendants
          const grandparent = parent.parentElement;
          if (grandparent) {
            const inputs = grandparent.querySelectorAll('input, select, button');
            if (inputs.length > 0) {
              // Find the closest input to our text element
              let closestInput = null;
              let minDistance = Infinity;
              
              inputs.forEach(input => {
                const distance = Math.abs(
                  textEl.getBoundingClientRect().bottom - 
                  input.getBoundingClientRect().top
                );
                
                if (distance < minDistance) {
                  minDistance = distance;
                  closestInput = input;
                }
              });
              
              if (closestInput && minDistance < 50) {
                return closestInput;
              }
            }
          }
        }
      }
    }
    
    // Method 3: Look for inputs of the expected type
    switch (fieldName) {
      case 'email':
        return document.querySelector('input[type="email"]');
      case 'phone':
        return document.querySelector('input[type="tel"]');
      case 'country':
        // Look for country dropdown with flags
        const countryButton = document.querySelector('button[aria-haspopup="listbox"]');
        if (countryButton && countryButton.querySelector('.tds-country-code')) {
          return countryButton;
        }
        break;
    }
    
    console.log(`Could not find field: ${fieldName}`);
    return null;
  },
  
  /**
   * Fill a field with a value
   * @param {HTMLElement} field - Field to fill
   * @param {string} value - Value to set
   * @returns {boolean} - Success status
   */
  fillField(field, value) {
    if (!field || !value) return false;
    
    try {
      // Handle different field types
      if (field.tagName === 'SELECT') {
        return this.fillSelectField(field, value);
      }
      
      // Handle country dropdown button (special case)
      if (field.tagName === 'BUTTON' && field.getAttribute('aria-haspopup') === 'listbox') {
        return this.fillCountryDropdown(field, value);
      }
      
      // For text inputs, set value and trigger events
      field.focus();
      
      // Clear the field first
      field.value = '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Set the new value
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // Verify value was set
      if (field.value !== value) {
        console.log(`Value not set for field, trying alternate method`);
        
        // Try alternative approaches
        try {
          // Method 1: Property descriptor
          const descriptor = Object.getOwnPropertyDescriptor(field.constructor.prototype, 'value');
          if (descriptor && descriptor.set) {
            descriptor.set.call(field, value);
          }
          
          // Method 2: Try setting via JavaScript
          setTimeout(() => {
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
          }, 50);
          
          // Method 3: Try keyboard simulation
          setTimeout(() => {
            field.focus();
            
            // Clear field via keystrokes
            for (let i = 0; i < field.value.length; i++) {
              field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
            }
            
            // Type the value
            for (const char of value) {
              field.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
              field.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
              field.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
            }
            
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.dispatchEvent(new Event('blur', { bubbles: true }));
          }, 100);
        } catch (e) {
          console.warn('Alternative field fill methods failed:', e);
        }
      }
      
      return true;
    } catch (e) {
      console.error(`Error filling field:`, e);
      return false;
    }
  },
  
  /**
   * Fill a select dropdown field
   * @param {HTMLSelectElement} field - Select element to fill
   * @param {string} value - Value to select
   * @returns {boolean} - Success status
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
      
      // Strategy 4: Select first non-empty option as fallback
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
   * Fill form with user data
   * @returns {Promise<Object>} - Form filling results
   */
  async fillForm() {
    let filledCount = 0;
    const filledFields = [];
    const failedFields = [];
    
    try {
      // Fix any validation errors first
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
      
      // Fill each field with a delay between them
      for (const [fieldId, dataKey] of Object.entries(fieldMapping)) {
        if (userData[dataKey] != null && userData[dataKey] !== '') {
          // Add a small random delay to seem more human-like
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
      
      // Check agreement checkboxes
      const checkedCount = this.checkRelevantCheckboxes();
      if (checkedCount > 0) {
        filledCount += checkedCount;
        filledFields.push('checkboxes');
      }
      
      // Show payment helper for manual entry of secure fields
      setTimeout(() => {
        createPaymentHelper(userData);
      }, 1000);
      
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
   * @returns {number} - Number of checkboxes checked
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
   * Determine if a checkbox is likely an agreement checkbox
   * @param {HTMLInputElement} checkbox - Checkbox to check
   * @returns {boolean} - Whether it's likely an agreement checkbox
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
  },
  
  /**
   * Create and show the helper panel
   */
  createPanel() {
    // Remove existing panel if any
    const existingPanel = document.getElementById(this.PANEL_ID);
    if (existingPanel) {
      existingPanel.remove();
    }
    
    // Create panel element
    const panel = document.createElement('div');
    panel.id = this.PANEL_ID;
    
    // Create panel HTML for order page
    this.createOrderPanel(panel);
    
    // Add panel to the page
    document.body.appendChild(panel);
  },
  
  /**
   * Create panel for order pages
   * @param {HTMLElement} panel - Panel element
   */
  async createOrderPanel(panel) {
    // Get user settings
    const settings = await new Promise(resolve => {
      chrome.storage.sync.get(null, data => {
        resolve(data || {});
      });
    });
    
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
      <button class="btn" id="payment-helper-btn">Show Payment Info</button>
      
      <div id="panel-status" class="status"></div>
    `;
    
    // Set up event handlers
    panel.querySelector('#tesla-panel-close').addEventListener('click', () => {
      panel.remove();
    });
    
    panel.querySelector('#fill-form-btn').addEventListener('click', async () => {
      const result = await this.fillForm();
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
      this.fixValidationErrors();
      this.showStatus(panel, `Fixed validation errors`, true);
    });
    
    panel.querySelector('#check-terms-btn').addEventListener('click', () => {
      // Check all checkboxes
      let count = this.checkRelevantCheckboxes();
      this.showStatus(panel, `${count} checkboxes checked`, true);
    });
    
    panel.querySelector('#payment-helper-btn').addEventListener('click', () => {
      // Show payment helper
      createPaymentHelper(settings);
      this.showStatus(panel, `Payment helper shown`, true);
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
    const panel = document.getElementById(this.PANEL_ID);
    
    if (panel) {
      panel.remove();
    } else {
      this.createPanel();
    }
  },

  /**
   * Fix validation errors in form fields
   * @returns {boolean} Success status
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
      
      return true;
    } catch (e) {
      console.error('Error fixing validation errors:', e);
      return false;
    }
  },
};


// In content-helper.js, around line 779-1033
// Find possible price range input elements
function findPriceRangeInput() {
  // Look for range inputs that might control price
  const possibleContainers = Array.from(document.querySelectorAll('input[type="range"], .payment-slider-container input'));
  
  console.log("Found possible price range inputs:", possibleContainers.length);
  
  // Return the first matched element or null
  return possibleContainers.length > 0 ? possibleContainers[0] : null;
}

// In your content script message handler
if (message.action === 'updateFilters') {
  console.log('Received updateFilters message with filters:', message.filters);
  
  try {
    // Apply filters to the page
    const success = await applyFiltersToPage(message.filters);
    
    // Send back the result
    sendResponse({ success: success });
  } catch (error) {
    console.error('Error applying filters to page:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the message channel open for the async response
}

// Function to apply filters to the current page
async function applyFiltersToPage(filters) {
  try {
    // First find the price slider
    const priceInputs = findPriceRangeInputs();
    
    if (priceInputs.length === 0) {
      console.warn('No price range inputs found on the page');
      return false;
    }
    
    const priceInput = priceInputs[0];
    
    // Get current value before changing
    const currentValue = parseInt(priceInput.value) || 0;
    const targetValue = parseInt(filters.priceMax) || 0;
    
    if (targetValue > 0 && currentValue !== targetValue) {
      console.log(`Updating price slider from ${currentValue} to ${targetValue}`);
      
      // Set value and trigger events
      priceInput.value = targetValue;
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Give the page time to update internal state
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Find and click the Apply button
    const buttonClicked = await findAndClickApplyButton();
    
    return buttonClicked;
  } catch (error) {
    console.error('Error applying filters to page:', error);
    return false;
  }
}

/**
 * Update price labels on the page
 * @param {number} price - The new price value
 * @param {string} region - Region code (e.g., 'US', 'TR')
 */
function updatePriceLabels(price, region = 'US') {
  try {
    const currencySymbol = region === 'TR' ? '₺' : '$';
    const formattedPrice = `${currencySymbol}${parseInt(price).toLocaleString()}`;
    
    // Update any price labels
    const priceLabels = [
      ...document.querySelectorAll('.tds-form-label-text'),
      ...document.querySelectorAll('[data-id*="price-label"]'),
      ...document.querySelectorAll('[class*="price-label"]')
    ];
    
    priceLabels.forEach(label => {
      if (label.textContent.includes('$') || label.textContent.includes('₺')) {
        label.textContent = `Up to ${formattedPrice}`;
      }
    });
  } catch (e) {
    console.error("Error updating price labels:", e);
  }
}
/**
 * Create a floating panel to show when filters have been updated
 * @param {string} message - The message to display
 */
function showFilterUpdateNotification(message) {
  try {
    // Create or update notification element
    let notification = document.getElementById('tesla-filter-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'tesla-filter-notification';
      notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(30, 30, 30, 0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-family: system-ui, sans-serif;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s, transform 0.3s;
      `;
      document.body.appendChild(notification);
      
      // Force reflow
      notification.offsetHeight;
    }
    
    // Update content
    notification.textContent = message;
    
    // Show notification
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
    
    // Hide after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(10px)';
      
      // Remove after animation completes
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  } catch (error) {
    console.error("Error showing filter notification:", error);
  }
}

// Fix for the possibleContainers undefined reference
try {
  const priceInput = findPriceRangeInput();
  if (priceInput) {
    const originalBoxShadow = priceInput.style.boxShadow;
    const originalPosition = priceInput.style.position;
    const originalZIndex = priceInput.style.zIndex;
    
    // Add a pulse effect
    priceInput.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.6)';
    priceInput.style.position = originalPosition === 'static' ? 'relative' : originalPosition;
    priceInput.style.zIndex = '9000';
    
    // Add transition for smooth effect
    priceInput.style.transition = 'box-shadow 0.5s ease';
    
    // Pulse effect
    let pulseCount = 0;
    const pulseInterval = setInterval(() => {
      if (pulseCount % 2 === 0) {
        priceInput.style.boxShadow = '0 0 0 5px rgba(59, 130, 246, 0.3)';
      } else {
        priceInput.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.6)';
      }
      
      pulseCount++;
      if (pulseCount >= 6) {
        clearInterval(pulseInterval);
        
        // Reset styles after a while
        setTimeout(() => {
          priceInput.style.boxShadow = originalBoxShadow;
          priceInput.style.zIndex = originalZIndex;
        }, 5000);
      }
    }, 500);
  }
} catch (e) {
  // Ignore styling errors
  console.error("Error styling price input:", e);
}

// Look for payment form sections based on text content
const possiblePaymentSections = [];
['Payment', 'Credit Card', 'Billing', 'Payment Method', 'Account Details'].forEach(text => {
  const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, legend, .tds-text--h4'));
  
  elements.forEach(el => {
    if (el.textContent.includes(text)) {
      // Get parent section
      let section = el;
      for (let i = 0; i < 3; i++) {
        if (section.parentElement) {
          section = section.parentElement;
        }
      }
      possiblePaymentSections.push(section);
    }
  });
});

/**
 * Update UI with inventory check results
 * @param {Array} vehicles - Found vehicles
 * @param {Object} filters - Search filters used
 */
function updateInventoryResults(vehicles, filters) {
  try {
    // Find or create a results container
    let resultsContainer = document.getElementById('tesla-inventory-results');
    
    if (!resultsContainer) {
      // Create the container if it doesn't exist
      resultsContainer = document.createElement('div');
      resultsContainer.id = 'tesla-inventory-results';
      resultsContainer.className = 'inventory-results';
      
      // Add styles
      resultsContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(30, 30, 30, 0.8);
        color: #fff;
        backdrop-filter: blur(5px);
        padding: 15px;
        border-radius: 8px;
        width: 300px;
        max-height: 400px;
        overflow-y: auto;
        z-index: 9998;
        font-family: system-ui, sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: transform 0.3s, opacity 0.3s;
      `;
      
      // Add to the page
      document.body.appendChild(resultsContainer);
    }
    
    // Clear existing content
    resultsContainer.innerHTML = '';
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    const title = document.createElement('h3');
    title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 500;';
    title.textContent = vehicles.length > 0 
      ? `Found ${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`
      : 'No matching vehicles';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      margin: 0;
    `;
    closeBtn.addEventListener('click', () => {
      resultsContainer.style.transform = 'translateY(20px)';
      resultsContainer.style.opacity = '0';
      setTimeout(() => resultsContainer.remove(), 300);
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    resultsContainer.appendChild(header);
    
    // If we have vehicles, show them
    if (vehicles.length > 0) {
      // Price filter info
      if (filters && filters.priceMax) {
        const priceInfo = document.createElement('div');
        priceInfo.style.cssText = 'margin-bottom: 10px; font-size: 14px;';
        
        // Format price based on region
        const currencySymbol = filters.region === 'TR' ? '₺' : '$';
        const formattedPrice = `${currencySymbol}${parseInt(filters.priceMax).toLocaleString()}`;
        
        priceInfo.textContent = `Filtered by price: Under ${formattedPrice}`;
        resultsContainer.appendChild(priceInfo);
      }
      
      // Create scrollable container for vehicles
      const vehicleList = document.createElement('div');
      vehicleList.style.cssText = 'max-height: 300px; overflow-y: auto;';
      
      // Show up to 10 vehicles
      const displayLimit = Math.min(10, vehicles.length);
      
      for (let i = 0; i < displayLimit; i++) {
        const vehicle = vehicles[i];
        
        const vehicleItem = document.createElement('div');
        vehicleItem.style.cssText = `
          padding: 8px;
          margin-bottom: 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.1);
        `;
        
        // Vehicle model and trim
        const modelInfo = document.createElement('div');
        modelInfo.style.fontWeight = 'bold';
        modelInfo.textContent = `${vehicle.model} ${vehicle.trim || ''}`;
        
        // Vehicle price
        const priceInfo = document.createElement('div');
        priceInfo.textContent = vehicle.formattedPrice || `$${vehicle.price.toLocaleString()}`;
        
        // View button
        const viewLink = document.createElement('a');
        viewLink.href = vehicle.inventoryUrl;
        viewLink.textContent = 'View vehicle';
        viewLink.style.cssText = `
          display: inline-block;
          margin-top: 5px;
          color: #3b82f6;
          text-decoration: none;
          font-size: 13px;
        `;
        viewLink.target = '_blank';
        
        // Add to item
        vehicleItem.appendChild(modelInfo);
        vehicleItem.appendChild(priceInfo);
        vehicleItem.appendChild(viewLink);
        
        // Add to list
        vehicleList.appendChild(vehicleItem);
      }
      
      // If there are more vehicles than display limit, show count
      if (vehicles.length > displayLimit) {
        const moreInfo = document.createElement('div');
        moreInfo.style.cssText = 'text-align: center; margin-top: 10px; font-size: 13px;';
        moreInfo.textContent = `+ ${vehicles.length - displayLimit} more vehicles`;
        vehicleList.appendChild(moreInfo);
      }
      
      resultsContainer.appendChild(vehicleList);
      
      // Add action buttons
      const actionsDiv = document.createElement('div');
      actionsDiv.style.cssText = 'margin-top: 15px; display: flex; gap: 10px;';
      
      // Open all button
      const openAllBtn = document.createElement('button');
      openAllBtn.textContent = 'Open All';
      openAllBtn.style.cssText = `
        background: #3b82f6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        flex: 1;
      `;
      openAllBtn.addEventListener('click', () => {
        // Open first 5 vehicles max to avoid popup blocking
        const openLimit = Math.min(5, vehicles.length);
        for (let i = 0; i < openLimit; i++) {
          window.open(vehicles[i].inventoryUrl, '_blank');
        }
      });
      
      // Refresh button
      const refreshBtn = document.createElement('button');
      refreshBtn.textContent = 'Refresh';
      refreshBtn.style.cssText = `
        background: #64748b;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        flex: 1;
      `;
      refreshBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ 
          action: "checkInventory",
          filters: filters
        });
      });
      
      actionsDiv.appendChild(openAllBtn);
      actionsDiv.appendChild(refreshBtn);
      resultsContainer.appendChild(actionsDiv);
      
      // Animate in
      resultsContainer.style.transform = 'translateY(20px)';
      resultsContainer.style.opacity = '0';
      
      // Force reflow
      resultsContainer.offsetHeight;
      
      // Animate to final position
      resultsContainer.style.transform = 'translateY(0)';
      resultsContainer.style.opacity = '1';
    } else {
      // No vehicles found
      const noResults = document.createElement('div');
      noResults.style.cssText = 'text-align: center; margin: 20px 0;';
      noResults.textContent = 'No vehicles matching your criteria found.';
      
      resultsContainer.appendChild(noResults);
    }
  } catch (error) {
    console.error('Error updating inventory results:', error);
  }
  /**
 * Check if an element contains text (for jQuery-like selectors)
 * @param {string} text - Text to search for
 * @returns {Function} Selector function
 */
Element.prototype.contains = function(text) {
  return Array.from(document.querySelectorAll(this)).filter(el => 
    el.textContent.includes(text)
  );
};
}