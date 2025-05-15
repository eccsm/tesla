/**
 * Tesla AutoPilot Payment Frames Script
 * 
 * This script runs inside the payment iframes on Tesla's checkout pages to help
 * with filling payment information. Since these are secure iframes, we need
 * special handling to interact with them.
 */

console.log('Tesla AutoPilot payment frames script loaded');

// Let the parent window know we're loaded
window.parent.postMessage({ type: 'TESLA_AUTOPILOT_FRAME_LOADED', frameUrl: window.location.href }, '*');

/**
 * Helper to find payment fields in the iframe
 */
const PaymentFrameHelper = {
  /**
   * Field types that we look for
   */
  FIELD_TYPES: {
    CARD_NUMBER: 'cardNumber',
    CARD_NAME: 'cardName',
    CARD_EXP: 'cardExp',
    CARD_CVV: 'cardCVV',
    ZIP: 'zip'
  },
  
  /**
   * Initialize the helper
   */
  initialize() {
    console.log('Initializing payment frame helper in:', window.location.href);
    
    // Set up message listener to receive commands from parent
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Analyze this iframe to find payment fields
    this.identifyPaymentFields();
    
    // Send identification to parent
    this.sendFieldIdentification();
  },
  
  /**
   * Handle messages from parent window
   * @param {MessageEvent} event - Message event
   */
  handleMessage(event) {
    // Verify it's from our parent
    if (event.source !== window.parent) return;
    
    const { type, action, data } = event.data || {};
    
    // Only process our own messages
    if (!type || !type.startsWith('TESLA_AUTOPILOT_')) return;
    
    console.log('Payment frame received message:', event.data);
    
    // Handle fill request
    if (action === 'fillField' && data) {
      this.fillField(data.fieldType, data.value);
    }
    
    // Handle highlight request
    if (action === 'highlightFields') {
      this.highlightFields();
    }
  },
  
  /**
   * Identify payment fields in this iframe
   * @returns {Object} Field elements by type
   */
  identifyPaymentFields() {
    const fields = {};
    
    // Common selectors for card fields
    const selectors = {
      [this.FIELD_TYPES.CARD_NUMBER]: [
        'input[name*="number"], input[id*="number"], input[placeholder*="number"]',
        'input[name*="card"], input[id*="card"], input[data-elements-stable-field-name*="cardNumber"]',
        'input[autocomplete="cc-number"]',
        'input[id*="credit-card-number"]',
        'input[data-tid*="card-number"]'
      ],
      [this.FIELD_TYPES.CARD_NAME]: [
        'input[name*="name"], input[id*="name"], input[placeholder*="name"]',
        'input[autocomplete="cc-name"]',
        'input[data-tid*="name"]'
      ],
      [this.FIELD_TYPES.CARD_EXP]: [
        'input[name*="expir"], input[id*="expir"], input[placeholder*="expir"]',
        'input[name*="exp"], input[id*="exp"], input[placeholder*="exp"]',
        'input[autocomplete="cc-exp"]',
        'input[data-tid*="expiry"]'
      ],
      [this.FIELD_TYPES.CARD_CVV]: [
        'input[name*="cvv"], input[id*="cvv"], input[placeholder*="cvv"]',
        'input[name*="cvc"], input[id*="cvc"], input[placeholder*="cvc"]',
        'input[name*="security"], input[id*="security"], input[placeholder*="security"]',
        'input[autocomplete="cc-csc"]',
        'input[data-tid*="cvc"]'
      ],
      [this.FIELD_TYPES.ZIP]: [
        'input[name*="zip"], input[id*="zip"], input[placeholder*="zip"]',
        'input[name*="postal"], input[id*="postal"], input[placeholder*="postal"]',
        'input[autocomplete="postal-code"]',
        'input[data-tid*="postal"]'
      ]
    };
    
    // Try to find each field type
    Object.entries(selectors).forEach(([fieldType, selectorList]) => {
      for (const selector of selectorList) {
        try {
          const fieldElement = document.querySelector(selector);
          if (fieldElement) {
            fields[fieldType] = fieldElement;
            console.log(`Found ${fieldType} field:`, fieldElement);
            break;
          }
        } catch (e) {
          // Ignore selector errors
        }
      }
    });
    
    // Save identified fields
    this.fields = fields;
    return fields;
  },
  
  /**
   * Send field identification to parent window
   */
  sendFieldIdentification() {
    const fieldTypes = {};
    
    // Collect the field types present in this iframe
    Object.entries(this.fields || {}).forEach(([type, element]) => {
      fieldTypes[type] = true;
    });
    
    // Send to parent
    window.parent.postMessage({
      type: 'TESLA_AUTOPILOT_FRAME_FIELDS',
      frameUrl: window.location.href,
      fieldTypes
    }, '*');
  },
  
  /**
   * Fill a field with a value
   * @param {string} fieldType - Field type to fill
   * @param {string} value - Value to fill
   * @returns {boolean} Success status
   */
  fillField(fieldType, value) {
    const field = this.fields[fieldType];
    
    if (!field || !value) {
      console.log(`Cannot fill ${fieldType}: field not found or no value`);
      return false;
    }
    
    try {
      console.log(`Filling ${fieldType} with:`, value);
      
      // Focus the field
      field.focus();
      
      // Clear existing value
      field.value = '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Set the new value
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // For stubborn fields, simulate typing
      if (field.value !== value) {
        setTimeout(() => {
          // Focus and clear
          field.focus();
          field.select();
          field.value = '';
          
          // Type the value character by character
          for (const char of value) {
            field.value += char;
            field.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          field.dispatchEvent(new Event('change', { bubbles: true }));
          field.dispatchEvent(new Event('blur', { bubbles: true }));
        }, 50);
      }
      
      return true;
    } catch (e) {
      console.error(`Error filling ${fieldType}:`, e);
      return false;
    }
  },
  
  /**
   * Highlight fields in this iframe
   */
  highlightFields() {
    Object.entries(this.fields || {}).forEach(([type, field]) => {
      try {
        // Save original styles
        const originalOutline = field.style.outline;
        const originalBoxShadow = field.style.boxShadow;
        const originalTransition = field.style.transition;
        
        // Apply highlight
        field.style.outline = 'none';
        field.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.8), 0 0 0 4px rgba(59, 130, 246, 0.3)';
        field.style.transition = 'box-shadow 0.3s ease';
        
        // Pulse effect
        let pulseCount = 0;
        const pulseInterval = setInterval(() => {
          if (pulseCount % 2 === 0) {
            field.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.8), 0 0 0 6px rgba(59, 130, 246, 0.3)';
          } else {
            field.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.8), 0 0 0 4px rgba(59, 130, 246, 0.3)';
          }
          
          pulseCount++;
          if (pulseCount >= 6) {
            clearInterval(pulseInterval);
            
            // Reset styles after a delay
            setTimeout(() => {
              field.style.outline = originalOutline;
              field.style.boxShadow = originalBoxShadow;
              field.style.transition = originalTransition;
            }, 2000);
          }
        }, 400);
      } catch (e) {
        console.error(`Error highlighting ${type}:`, e);
      }
    });
  }
};

// Initialize the helper
PaymentFrameHelper.initialize();

// Also look for common form fields regardless of selectors
document.addEventListener('focus', event => {
  // If a field is focused, try to determine its type
  const target = event.target;
  
  if (target.tagName === 'INPUT') {
    const fieldDetails = {
      type: target.type,
      name: target.name,
      id: target.id,
      placeholder: target.placeholder,
      autocomplete: target.autocomplete,
      maxLength: target.maxLength
    };
    
    // Send field details to parent
    window.parent.postMessage({
      type: 'TESLA_AUTOPILOT_FIELD_FOCUS',
      fieldDetails
    }, '*');
  }
}, true);