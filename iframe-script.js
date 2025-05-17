// iframe-script.js - Script to be injected into payment iframe
// This script handles filling in payment form fields inside Tesla's payment iframe

(function() {
    console.log('Tesla Inventory Monitor: Payment iframe script starting');
    // Track if we're already running to prevent multiple executions
    window._teslaMonitorRunning = window._teslaMonitorRunning || false;
    
    // If already running, don't execute again
    if (window._teslaMonitorRunning) {
        console.log('Tesla Inventory Monitor: Script already running, aborting duplicate execution');
        return;
    }
    
    window._teslaMonitorRunning = true;
    
    // Set a global flag that this frame has been processed by our extension
    window._teslaMonitorInjected = true;
    
    // Log the frame context to help with debugging
    try {
        console.log('Tesla Inventory Monitor: Script running in iframe with:', {
            location: window.location.href,
            referrer: document.referrer,
            frameElement: window.frameElement ? {
                id: window.frameElement.id,
                name: window.frameElement.name,
                src: window.frameElement.src
            } : 'No direct frame access'
        });
    } catch (e) {
        console.log('Tesla Inventory Monitor: Cannot access frame details due to security restrictions');
    }
    
    // Debug: Log all form elements in the iframe
    function logFormElements() {
        console.log('Logging all form elements in payment iframe:');
        
        // Log all forms
        const forms = document.querySelectorAll('form');
        console.log(`Found ${forms.length} forms`);
        
        // Check for Adyen-specific elements
        const adyenFrames = document.querySelectorAll('iframe[name^="adyen"]');
        console.log(`Found ${adyenFrames.length} Adyen iframes`);
        adyenFrames.forEach((frame, i) => {
            console.log(`Adyen iframe ${i}:`, {
                name: frame.name,
                id: frame.id,
                src: frame.src
            });
        });
        
        // Check for Adyen div containers
        const adyenDivs = document.querySelectorAll('div[class*="adyen"]');
        console.log(`Found ${adyenDivs.length} Adyen divs`);
        
        // Log all inputs
        const inputs = document.querySelectorAll('input');
        console.log(`Found ${inputs.length} input elements`);
        inputs.forEach((input, i) => {
            console.log(`Input ${i}:`, {
                type: input.type,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder,
                'data-attributes': Array.from(input.attributes)
                    .filter(attr => attr.name.startsWith('data-'))
                    .map(attr => ({ name: attr.name, value: attr.value }))
            });
        });
        
        // Log all selects
        const selects = document.querySelectorAll('select');
        console.log(`Found ${selects.length} select elements`);
        selects.forEach((select, i) => {
            console.log(`Select ${i}:`, {
                name: select.name,
                id: select.id,
                options: Array.from(select.options).map(opt => opt.value)
            });
        });
        
        // Look for Adyen specific elements
        const adyenContainers = document.querySelectorAll('[data-cse="encryptedCardNumber"], [data-cse="encryptedExpiryDate"], [data-cse="encryptedSecurityCode"]');
        console.log(`Found ${adyenContainers.length} Adyen CSE elements`);
        adyenContainers.forEach((el, i) => {
            console.log(`Adyen CSE element ${i}:`, {
                'data-cse': el.getAttribute('data-cse'),
                id: el.id,
                className: el.className
            });
        });
    }
    
    // Run initial logging
    setTimeout(logFormElements, 1000);
    
    // Setup an interval to periodically scan for payment fields
    // This helps with forms that load incrementally or after user interaction
    const scanInterval = setInterval(() => {
        console.log('Tesla Inventory Monitor: Scanning for payment fields...');
        logFormElements();
        
        // Check if we're in an Adyen iframe
        const isAdyenFrame = document.querySelector('[data-cse], [data-component="Card"], .adyen-checkout__card') || 
                             window.name.includes('adyen') || 
                             (document.body && document.body.className.includes('adyen'));
        
        if (isAdyenFrame) {
            console.log('Tesla Inventory Monitor: Detected we are in an Adyen frame, notifying parent');
            window.parent.postMessage({
                action: 'adyenSecureFieldsDetected',
                source: 'tesla-inventory-monitor'
            }, '*');
            
            // Clear the interval after we've detected Adyen to avoid repeated messages
            clearInterval(scanInterval);
        }
    }, 2000); // Check every 2 seconds
    
    // Stop checking after 30 seconds to avoid unnecessary processing
    setTimeout(() => {
        clearInterval(scanInterval);
        console.log('Tesla Inventory Monitor: Stopped periodic scanning for payment fields');
    }, 30000);
    
    // Function to fill in a field with proper events
    function fillField(selector, value) {
        console.log(`Attempting to fill field with selector: ${selector}`);
        const field = document.querySelector(selector);
        if (field) {
            console.log(`Found field: ${selector}`, field);
            field.focus();
            field.value = value;
            
            // Dispatch events to trigger validation
            field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            field.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            field.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
            
            // For Adyen fields, try to simulate user typing
            if (field.getAttribute('data-cse') || field.closest('[data-cse]')) {
                console.log('Adyen field detected, simulating keystrokes');
                // Simulate typing character by character
                field.value = '';
                for (let i = 0; i < value.length; i++) {
                    field.value += value[i];
                    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                }
            }
            return true;
        }
        console.log(`Field not found: ${selector}`);
        return false;
    }
    
    // Try to fill a field with multiple possible selectors
    function tryFillField(selectors, value) {
        console.log(`Trying to fill field with value: ${value}`);
        console.log(`Trying selectors:`, selectors);
        
        for (const selector of selectors) {
            if (fillField(selector, value)) {
                console.log(`Successfully filled field with selector: ${selector}`);
                return true;
            }
        }
        
        // Try Adyen-specific approach if normal selectors failed
        try {
            const adyenFields = {
                cardNumber: document.querySelector('[data-cse="encryptedCardNumber"]'),
                expiryDate: document.querySelector('[data-cse="encryptedExpiryDate"]'),
                securityCode: document.querySelector('[data-cse="encryptedSecurityCode"]'),
                postalCode: document.querySelector('input[name="postalCode"], input[name="postal"], input[name="zip"]')
            };
            
            // Try by field type based on value format
            if (/^\d{13,19}$/.test(value) && adyenFields.cardNumber) {
                console.log('Trying Adyen card number field');
                simulateUserInput(adyenFields.cardNumber, value);
                return true;
            } else if (/^\d{2}\/\d{2}$/.test(value) && adyenFields.expiryDate) {
                console.log('Trying Adyen expiry date field');
                simulateUserInput(adyenFields.expiryDate, value);
                return true;
            } else if (/^\d{3,4}$/.test(value) && adyenFields.securityCode) {
                console.log('Trying Adyen security code field');
                simulateUserInput(adyenFields.securityCode, value);
                return true;
            } else if (/^\d{5}$/.test(value) && adyenFields.postalCode) {
                console.log('Trying postal code field');
                simulateUserInput(adyenFields.postalCode, value);
                return true;
            }
        } catch (e) {
            console.log('Error with Adyen approach:', e);
        }
        
        console.log(`Failed to fill field with any selector`);
        return false;
    }
    
    // Function to simulate actual user input in Adyen iframe fields
    function simulateUserInput(element, value) {
        console.log('Simulating user input on element:', element);
        // Focus the element
        element.focus();
        element.click();
        
        // Clear existing value if possible
        element.value = '';
        
        // Store the original getter and setter
        let originalSetter, originalGetter;
        try {
            const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            if (descriptor) {
                originalSetter = descriptor.set;
                originalGetter = descriptor.get;
                
                // Try to override the setter to bypass potential Adyen protection
                Object.defineProperty(element, 'value', {
                    get: function() {
                        return originalGetter.call(this);
                    },
                    set: function(val) {
                        originalSetter.call(this, val);
                        // Dispatch events to bypass validation
                        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    },
                    configurable: true
                });
                console.log('Tesla Inventory Monitor: Successfully overrode input value setter');
            }
        } catch (e) {
            console.log('Tesla Inventory Monitor: Cannot override input value setter:', e);
        }
        
        // Try multiple methods to input the value
        const methods = [
            // Method 1: Direct value assignment with events
            () => {
                try {
                    element.value = value;
                    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    return true;
                } catch (e) {
                    console.log('Method 1 failed:', e);
                    return false;
                }
            },
            
            // Method 2: Character by character simulation
            () => {
                try {
                    // For each character, simulate keydown, keypress, and input events
                    for (let i = 0; i < value.length; i++) {
                        const char = value[i];
                        const keyCode = char.charCodeAt(0);
                        
                        // Create and dispatch keyboard events
                        const keydownEvent = new KeyboardEvent('keydown', {
                            key: char,
                            code: `Digit${char}`,
                            keyCode: keyCode,
                            which: keyCode,
                            bubbles: true,
                            composed: true,
                            cancelable: true
                        });
                        
                        const keypressEvent = new KeyboardEvent('keypress', {
                            key: char,
                            code: `Digit${char}`,
                            keyCode: keyCode,
                            which: keyCode,
                            bubbles: true,
                            composed: true,
                            cancelable: true
                        });
                        
                        element.dispatchEvent(keydownEvent);
                        element.dispatchEvent(keypressEvent);
                        
                        // Update the value and dispatch input event
                        if (element.value !== undefined) {
                            element.value += char;
                        }
                        
                        const inputEvent = new Event('input', {
                            bubbles: true,
                            composed: true,
                            cancelable: true
                        });
                        
                        element.dispatchEvent(inputEvent);
                        
                        // Dispatch keyup event
                        const keyupEvent = new KeyboardEvent('keyup', {
                            key: char,
                            code: `Digit${char}`,
                            keyCode: keyCode,
                            which: keyCode,
                            bubbles: true,
                            composed: true,
                            cancelable: true
                        });
                        
                        element.dispatchEvent(keyupEvent);
                    }
                    return true;
                } catch (e) {
                    console.log('Method 2 failed:', e);
                    return false;
                }
            },
            
            // Method 3: Using execCommand
            () => {
                try {
                    element.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, value);
                    return true;
                } catch (e) {
                    console.log('Method 3 failed:', e);
                    return false;
                }
            },
            
            // Method 4: Using clipboard API if available
            () => {
                try {
                    const originalValue = element.value;
                    navigator.clipboard.writeText(value).then(() => {
                        element.focus();
                        document.execCommand('selectAll', false, null);
                        document.execCommand('paste', false, null);
                    }).catch(() => {
                        element.value = value; // Fallback
                    });
                    return true;
                } catch (e) {
                    console.log('Method 4 failed:', e);
                    return false;
                }
            }
        ];
        
        // Try each method until one succeeds
        let success = false;
        for (let i = 0; i < methods.length && !success; i++) {
            console.log(`Tesla Inventory Monitor: Trying input method ${i+1}`);
            success = methods[i]();
            if (success) {
                console.log(`Tesla Inventory Monitor: Method ${i+1} succeeded`);
            }
        }
        
        // Restore original getter/setter if we modified them
        if (originalSetter && originalGetter) {
            try {
                Object.defineProperty(element, 'value', {
                    get: originalGetter,
                    set: originalSetter,
                    configurable: true
                });
            } catch (e) {
                console.log('Tesla Inventory Monitor: Error restoring original setter:', e);
            }
        }
        
        // Blur the element
        const blurEvent = new Event('blur', {
            bubbles: true,
            composed: true,
            cancelable: true
        });
        
        element.dispatchEvent(blurEvent);
        return success;
    }
    
    // Listen for messages from the parent window (content.js)
    window.addEventListener('message', function(event) {
        // Make sure the message is from our extension
        if (event.data && event.data.action === 'fillPaymentForm' && event.data.details) {
            console.log('Payment iframe received fillPaymentForm message', event.data);
            
            try {
                const details = event.data.details;
                
                // Wait for the form to be fully loaded
                setTimeout(() => {
                    // Log all form elements again when trying to fill
                    logFormElements();
                    
                    // Check if we're in Adyen's secured environment
                    const isAdyenSecured = document.querySelector('[data-cse], .adyen-checkout__card') || 
                                          window.name.includes('adyen') || 
                                          document.querySelector('iframe[name*="adyen"]') ||
                                          (typeof window.adyen !== 'undefined');
                    
                    if (isAdyenSecured) {
                        console.log('Tesla Inventory Monitor: Detected Adyen secure environment, notifying parent');
                        window.parent.postMessage({
                            action: 'adyenSecureFieldsDetected',
                            source: 'tesla-inventory-monitor'
                        }, '*');
                    }
                    
                    // Fill in payment details
                    let success = true;
                    
                    // Credit card number
                    if (details.cardNumber) {
                        const cardNumberSelectors = [
                            'input[name="cardnumber"]',
                            'input[name="card_number"]',
                            'input[id*="card"][id*="number"]',
                            // Adyen specific selectors
                            '[data-cse="encryptedCardNumber"]',
                            'input[data-fieldtype="encryptedCardNumber"]',
                            '.adyen-checkout__card__cardNumber__input',
                            'input[data-cy="card-number"]',
                            'input[placeholder*="card" i][placeholder*="number" i]',
                            'input[aria-label*="card" i][aria-label*="number" i]',
                            // Tesla-specific selectors
                            'input.tds-form-input[name="cardnumber"]',
                            '#cardnumber',
                            'input[data-testid="cardnumber"]'
                        ];
                        
                        const cardNumberFilled = tryFillField(cardNumberSelectors, details.cardNumber);
                        success = success && cardNumberFilled;
                    }
                    
                    // Expiration date
                    if (details.expirationMonth && details.expirationYear) {
                        // Format for combined field: MM/YY
                        const expValue = `${details.expirationMonth.padStart(2, '0')}/${details.expirationYear.slice(-2)}`;
                        
                        // Try combined expiration field first
                        const expDateSelectors = [
                            'input[name="exp-date"]',
                            'input[name="expiry"]',
                            // Adyen specific selectors
                            '[data-cse="encryptedExpiryDate"]',
                            'input[data-fieldtype="encryptedExpiryDate"]',
                            '.adyen-checkout__card__exp-date__input',
                            'input[data-cy="exp-date"]',
                            'input[placeholder*="expir" i]',
                            'input[aria-label*="expir" i]',
                            // Tesla-specific selectors
                            'input.tds-form-input[name="exp-date"]',
                            '#exp-date',
                            'input[data-testid="exp-date"]'
                        ];
                        
                        const expDateFilled = tryFillField(expDateSelectors, expValue);
                        
                        // If combined field didn't work, try separate month/year fields
                        if (!expDateFilled) {
                            const monthSelectors = [
                                'select[name="exp_month"]',
                                'input[name="exp_month"]',
                                'select[data-cy="exp-month"]',
                                'select[aria-label*="month" i]',
                                // Tesla-specific selectors
                                'select.tds-select[name="exp_month"]',
                                '#exp_month',
                                'select[data-testid="exp_month"]'
                            ];
                            
                            const yearSelectors = [
                                'select[name="exp_year"]',
                                'input[name="exp_year"]',
                                'select[data-cy="exp-year"]',
                                'select[aria-label*="year" i]',
                                // Tesla-specific selectors
                                'select.tds-select[name="exp_year"]',
                                '#exp_year',
                                'select[data-testid="exp_year"]'
                            ];
                            
                            const monthFilled = tryFillField(monthSelectors, details.expirationMonth);
                            const yearFilled = tryFillField(yearSelectors, details.expirationYear);
                            
                            success = success && monthFilled && yearFilled;
                        } else {
                            success = success && expDateFilled;
                        }
                    }
                    
                    // Security code / CVV
                    if (details.securityCode) {
                        const cvvSelectors = [
                            'input[name="cvc"]',
                            'input[name="cvv"]',
                            'input[name="security_code"]',
                            // Adyen specific selectors
                            '[data-cse="encryptedSecurityCode"]',
                            'input[data-fieldtype="encryptedSecurityCode"]',
                            '.adyen-checkout__card__cvc__input',
                            'input[data-cy="cvv"]',
                            'input[placeholder*="security" i]',
                            'input[placeholder*="cvv" i]',
                            'input[placeholder*="cvc" i]',
                            'input[aria-label*="security" i]',
                            'input[aria-label*="cvv" i]',
                            // Tesla-specific selectors
                            'input.tds-form-input[name="cvc"]',
                            '#cvc',
                            'input[data-testid="cvc"]'
                        ];
                        
                        const cvvFilled = tryFillField(cvvSelectors, details.securityCode);
                        success = success && cvvFilled;
                    }
                    
                    // Billing ZIP code
                    if (details.billingZip) {
                        const zipSelectors = [
                            'input[name="postal"]',
                            'input[name="zip"]',
                            'input[name="billing_zip"]',
                            'input[data-cy="postal-code"]',
                            'input[placeholder*="zip" i]',
                            'input[placeholder*="postal" i]',
                            'input[aria-label*="zip" i]',
                            'input[aria-label*="postal" i]',
                            // Tesla-specific selectors
                            'input.tds-form-input[name="postal"]',
                            '#postal',
                            'input[data-testid="postal"]'
                        ];
                        
                        const zipFilled = tryFillField(zipSelectors, details.billingZip);
                        success = success && zipFilled;
                    }
                    
                    // Send response back to the parent window
                    window.parent.postMessage({
                        action: 'paymentFormFilled',
                        success: success,
                        source: 'tesla-inventory-monitor'
                    }, '*');
                    
                    
                    // Try again after a delay to handle delayed field loading
                    setTimeout(() => {
                        console.log('Secondary attempt to fill payment fields after delay');
                        logFormElements();
                        
                        // More comprehensive detection for Adyen frames and elements
                        const adyenFrames = {
                            number: document.querySelector('iframe[name="encryptedCardNumber"], iframe[title*="Card Number"], iframe[src*="card"][src*="number"]'),
                            expiry: document.querySelector('iframe[name="encryptedExpiryDate"], iframe[title*="Expiration"], iframe[src*="expir"]'),
                            cvc: document.querySelector('iframe[name="encryptedSecurityCode"], iframe[title*="Security Code"], iframe[src*="cvc"], iframe[src*="cvv"]')
                        };
                        
                        const adyenContainers = document.querySelectorAll('[data-cse], [data-component="Card"], .adyen-checkout__card');
                        
                        // Try to detect if we're on the payment page but not in a specific payment iframe
                        const isPaymentPage = document.querySelector('[class*="payment"], [id*="payment"], form[name*="checkout"], [class*="checkout"]') !== null;
                        
                        if (adyenFrames.number || adyenFrames.expiry || adyenFrames.cvc || adyenContainers.length > 0 || isPaymentPage) {
                            console.log('Found Adyen components or payment page elements, alerting parent for helper tools');
                            
                            // We can't auto-fill these secure elements, so inform the user and provide assistance
                            window.parent.postMessage({
                                action: 'adyenSecureFieldsDetected',
                                source: 'tesla-inventory-monitor',
                                details: {
                                    foundAdyenFrames: !!(adyenFrames.number || adyenFrames.expiry || adyenFrames.cvc),
                                    foundAdyenContainers: adyenContainers.length > 0,
                                    isPaymentPage: isPaymentPage
                                }
                            }, '*');
                            
                            // Also scan for any standard input fields we might be able to fill
                            const standardFields = {
                                cardNumber: document.querySelector('input[name*="card"][name*="number"], input[placeholder*="card"][placeholder*="number"]'),
                                expiryDate: document.querySelector('input[name*="expiry"], input[placeholder*="expiry"]'),
                                securityCode: document.querySelector('input[name*="cvv"], input[placeholder*="cvv"], input[name*="cvc"], input[placeholder*="cvc"]'),
                                postalCode: document.querySelector('input[name*="zip"], input[placeholder*="zip"], input[name*="postal"], input[placeholder*="postal"]')
                            };
                            
                            const foundStandardFields = Object.values(standardFields).filter(f => f !== null).length;
                            if (foundStandardFields > 0) {
                                console.log(`Found ${foundStandardFields} standard payment fields that might be fillable`);
                                // Try to fill these standard fields
                                if (standardFields.cardNumber && details.cardNumber) {
                                    fillField(standardFields.cardNumber, details.cardNumber);
                                }
                                if (standardFields.expiryDate && details.expirationMonth && details.expirationYear) {
                                    fillField(standardFields.expiryDate, `${details.expirationMonth}/${details.expirationYear.slice(-2)}`);
                                }
                                if (standardFields.securityCode && details.securityCode) {
                                    fillField(standardFields.securityCode, details.securityCode);
                                }
                                if (standardFields.postalCode && details.billingZip) {
                                    fillField(standardFields.postalCode, details.billingZip);
                                }
                            }
                        }
                    }, 2000);
                    
                    // One final attempt after a longer delay for very slow-loading forms
                    setTimeout(() => {
                        console.log('Final attempt to find payment fields');
                        logFormElements();
                    }, 4000);
                    
                }, 1000); // Wait 1000ms for form to be fully interactive
                
            } catch (error) {
                console.error('Error filling payment form:', error);
                window.parent.postMessage({
                    action: 'paymentFormFilled',
                    success: false,
                    error: error.message,
                    source: 'tesla-inventory-monitor'
                }, '*');
            }
        }
    });
    
    // Notify the parent window that the iframe script is loaded and ready
    window.parent.postMessage({
        action: 'iframeScriptLoaded',
        source: 'tesla-inventory-monitor'
    }, '*');
    
    // Add a small indicator to show the script is injected (helps with debugging)
    try {
        const indicator = document.createElement('div');
        indicator.style.cssText = 'position: fixed; bottom: 5px; right: 5px; background: rgba(0,0,255,0.2); ' +
                                'color: white; font-size: 8px; padding: 2px 5px; border-radius: 3px; ' +
                                'z-index: 9999; pointer-events: none; opacity: 0.5;';
        indicator.textContent = 'TIM';
        document.body.appendChild(indicator);
        
        // Remove it after 3 seconds
        setTimeout(() => {
            if (document.body.contains(indicator)) {
                document.body.removeChild(indicator);
            }
        }, 3000);
    } catch (e) {
        // Ignore errors here, it's just for debugging
    }
    
    console.log('Tesla Inventory Monitor: Payment iframe script loaded');
    
    // Add unload handler to help with iframe tracking
    window.addEventListener('unload', function() {
        try {
            window.parent.postMessage({
                action: 'iframeUnloaded',
                source: 'tesla-inventory-monitor'
            }, '*');
        } catch (e) {
            // Ignore errors during unload
        }
    });
})();
