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
  
  // Fill ZIP code dialog
  if (request.action === "fillZipDialog") {
    try {
      zipHelper.detectAndFillZipDialog();
      sendResponse({ success: true, message: "ZIP dialog fill attempted" });
    } catch (error) {
      console.error('Error filling ZIP dialog:', error);
      sendResponse({ success: false, error: error.message || String(error) });
    }
    return true;
  }
  
  // Set ZIP code directly
  if (request.action === "setZipCode" && request.zipCode) {
    try {
      zipHelper.setZipCode(request.zipCode);
      sendResponse({ success: true, message: "ZIP code set" });
    } catch (error) {
      console.error('Error setting ZIP code:', error);
      sendResponse({ success: false, error: error.message || String(error) });
    }
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
  }
};

  
  // Also look for payment form sections based on text content
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
  
  // Add pulse effect to containers
  possibleContainers.forEach(container => {
    try {
      const originalBoxShadow = container.style.boxShadow;
      const originalPosition = container.style.position;
      const originalZIndex = container.style.zIndex;
      
      // Add a pulse effect
      container.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.6)';
      container.style.position = originalPosition === 'static' ? 'relative' : originalPosition;
      container.style.zIndex = '9000';
      
      // Add transition for smooth effect
      container.style.transition = 'box-shadow 0.5s ease';
      
      // Pulse effect
      let pulseCount = 0;
      const pulseInterval = setInterval(() => {
        if (pulseCount % 2 === 0) {
          container.style.boxShadow = '0 0 0 5px rgba(59, 130, 246, 0.3)';
        } else {
          container.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.6)';
        }
        
        pulseCount++;
        if (pulseCount >= 6) {
          clearInterval(pulseInterval);
          
          // Reset styles after a while
          setTimeout(() => {
            container.style.boxShadow = originalBoxShadow;
            container.style.zIndex = originalZIndex;
          }, 5000);
        }
      }, 500);
    } catch (e) {
      // Ignore styling errors
    }
  });
  