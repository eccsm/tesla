console.log("Content.js script injected and running.");

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content.js: Received message:", message, "from sender:", sender); // Log sender object

  if (message.action === "filterByPrice" && message.maxPrice !== undefined) {
    console.log(`Content.js: Received filterByPrice, maxPrice: ${message.maxPrice}`);
    filterVehiclesByPrice(message.maxPrice.toString()); // Ensure it's a string for consistency
    sendResponse({ status: "Price filter event received by content.js" });
  } else if (message.action === "updateInventoryView") {
    const { model, condition, zip, region, maxPrice } = message;
    console.log(`Content.js: Updating inventory view with model=${model}, condition=${condition}, zip=${zip}, region=${region}, maxPrice=${maxPrice}`);

    // First try to update the model selection directly on the page
    const modelUpdated = updateModelSelectionOnPage(model);
    
    // If we successfully updated the model on the page, apply any other filters and return
    if (modelUpdated) {
      console.log(`Content.js: Successfully updated model to ${model} directly on the page`); 
      
      // If maxPrice is provided, also update the price filter
      if (maxPrice) {
        filterVehiclesByPrice(maxPrice.toString());
      }
      
      sendResponse({ success: true, message: "Model updated on page directly" });
      return;
    }
    
    // If we couldn't update the model on the page, fall back to navigation
    console.log(`Content.js: Could not update model directly on page, falling back to navigation`);
    
    let baseUrl;
    if (region === 'US') {
        baseUrl = 'https://www.tesla.com/en_us/inventory';
    } else if (region === 'TR') {
        // Fix capitalization for Turkey URL (tr_TR instead of tr_tr)
        baseUrl = 'https://www.tesla.com/tr_TR/inventory';
    } else {
        baseUrl = 'https://www.tesla.com/inventory'; // Fallback
    }
    
    // Log the Turkish URL capitalization fix
    if (region === 'TR') {
      console.log('Content.js: Using correct capitalization for Turkish URL: tr_TR');
    }

    let newUrl = `${baseUrl}/${condition}/${model}?arrangeby=Price&order=asc`;
    if (zip && zip.trim() !== '') {
        newUrl += `&zip=${zip.trim()}`;
        if (region === 'US') {
            newUrl += '&range=200'; 
        } else if (region === 'TR') {
            newUrl += '&range=100';
        }
    }
    console.log(`Content.js: Navigating to new URL: ${newUrl}`);

    // Use chrome.tabs API to get current tab ID instead of relying on sender object
    chrome.runtime.sendMessage({
        action: "getCurrentTabId"
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Content.js: Error getting current tab ID:", chrome.runtime.lastError.message);
            sendResponse({ success: false, message: `Error getting tab ID: ${chrome.runtime.lastError.message}` });
            return;
        }
        
        if (response && response.tabId) {
            const tabId = response.tabId;
            console.log(`Content.js: Got current tab ID: ${tabId}`);
            
            // Now send the navigation request with the retrieved tab ID
            chrome.runtime.sendMessage({
                action: "navigateToUrl",
                tabId: tabId,
                url: newUrl
            }, (responseFromBackground) => {
                if (chrome.runtime.lastError) {
                    console.error("Content.js: Error sending navigateToUrl to background:", chrome.runtime.lastError.message);
                    sendResponse({ success: false, message: `Error navigating: ${chrome.runtime.lastError.message}` });
                } else if (responseFromBackground && responseFromBackground.success) {
                    console.log("Content.js: Background script acknowledged navigation request.");
                    sendResponse({ success: true, message: "Navigation initiated." });
                } else {
                    console.warn("Content.js: Background script navigation issue:", responseFromBackground);
                    sendResponse({ success: false, message: (responseFromBackground && responseFromBackground.message) || 'Navigation failed or not confirmed by background.' });
                }
            });
        } else {
            console.error("Content.js: Failed to get current tab ID");
            sendResponse({ success: false, message: 'Failed to get current tab ID' });
        }
    });
    return true; // Essential: response is async due to sendMessage to background

  } else if (message.action === "autofillOrderForm" && message.details) {
    console.log("Content script: Starting autofill with details:", message.details);
    // Store card details in local variables for clipboard functionality
    const cardDetails = {
      cardNumber: message.details.cardNumber,
      expiryDate: `${message.details.expirationMonth}/${message.details.expirationYear}`,
      securityCode: message.details.securityCode,
      billingZip: message.details.billingZip
    };
    
    // Create and store the copy buttons in a hidden container
    createCopyButtonContainer(cardDetails);
    
    // First fill the main form fields
    autofillForm(message.details);
    
    // Then handle the iframe payment form with a progressive delay to better catch iframe loads
    // Set up multiple attempts to find and fill the payment iframe
    const maxAttempts = 8; // Increased from 5 to give more chances to find the iframe
    let attempt = 1;
    // Use increasing delays for more chances to catch the iframe at different load stages
    const delayTimes = [500, 800, 1200, 1500, 2000, 3000, 4000, 5000];

    function attemptPaymentFill() {
        console.log(`Content script: Payment iframe fill attempt ${attempt} of ${maxAttempts}`);
        
        // First try to find Adyen's outer container even before iframe appears
        const adyenContainers = document.querySelectorAll(
          'div[data-component="Card"], div.adyen-checkout__card, div[class*="adyen"], div[id*="adyen"], ' +
          'div[class*="card-field"], div[class*="payment"], [data-cse], form[name*="payment"], div[id*="payment"]'
        );
        
        if (adyenContainers.length > 0) {
            console.log(`Content script: Found Adyen payment container. This may require manual input due to security restrictions.`);
            // Check if there are iframes inside
            const framesinContainer = Array.from(adyenContainers).reduce((count, container) => {
                return count + container.querySelectorAll('iframe').length;
            }, 0);
            
            if (framesinContainer > 0) {
                console.log(`Content script: Found ${framesinContainer} iframes in Adyen containers`);
                // Show the copy button container when payment form is detected
                showCopyButtonContainer();
            }
            
            // Inject script into the main page to handle Adyen with a more comprehensive detection
            const scriptElement = document.createElement('script');
            scriptElement.textContent = `
                (function() {
                    console.log("Main page script: Looking for Adyen components");
                    // Track payment field status
                    let secureFieldsFound = false;
                    
                    // Function to check for Adyen fields
                    function checkForAdyenFields() {
                        // More comprehensive selectors
                        const adyenCardFields = {
                            cardNumber: document.querySelector(
                                '[data-fieldtype="encryptedCardNumber"], [data-cse="encryptedCardNumber"], ' +
                                'iframe[name="encryptedCardNumber"], .adyen-checkout__card__cardNumber__input, ' +
                                '.card-number, [id*="cardNumber"], [class*="cardNumber"]'
                            ),
                            expiryDate: document.querySelector(
                                '[data-fieldtype="encryptedExpiryDate"], [data-cse="encryptedExpiryDate"], ' +
                                'iframe[name="encryptedExpiryDate"], .adyen-checkout__card__exp-date__input, ' +
                                '.expiry-date, [id*="expiry"], [class*="expiry"]'
                            ),
                            securityCode: document.querySelector(
                                '[data-fieldtype="encryptedSecurityCode"], [data-cse="encryptedSecurityCode"], ' +
                                'iframe[name="encryptedSecurityCode"], .adyen-checkout__card__cvc__input, ' +
                                '.security-code, [id*="cvc"], [id*="cvv"], [class*="cvc"], [class*="cvv"]'
                            )
                        };
                        
                        // Also look for the form elements that might contain the fields
                        const adyenForm = document.querySelector(
                            'form.adyen-checkout__card-input, div.adyen-checkout__card, ' +
                            'div[data-component="Card"], div[class*="PaymentForm"]'
                        );
                        
                        if (adyenCardFields.cardNumber || adyenCardFields.expiryDate || adyenCardFields.securityCode || adyenForm) {
                            console.log("Found Adyen secure component fields");
                            if (!secureFieldsFound) {
                                secureFieldsFound = true;
                                window.postMessage({
                                    action: 'adyenSecureFieldsDetected',
                                    source: 'tesla-inventory-monitor'
                                }, '*');
                            }
                        }
                    }
                    
                    // Check immediately
                    checkForAdyenFields();
                    
                    // And then check every 800ms for 10 seconds to catch delayed loading
                    let checkCount = 0;
                    const maxChecks = 12; // 12 checks * 800ms = ~10 seconds
                    
                    const checkInterval = setInterval(() => {
                        checkForAdyenFields();
                        checkCount++;
                        if (checkCount >= maxChecks || secureFieldsFound) {
                            clearInterval(checkInterval);
                        }
                    }, 800);
                })();
            `;
            document.head.appendChild(scriptElement);
            document.head.removeChild(scriptElement); // Clean up
        }
        
        const result = autofillPaymentIframe(message.details);
        
        if (!result && attempt < maxAttempts) {
            // If iframe not found, try again with progressive delay
            attempt++;
            setTimeout(attemptPaymentFill, delayTimes[attempt - 1] || 1000); 
        }
    }

    attemptPaymentFill();
    
    // After a short delay, also try the direct container injection approach as backup
    setTimeout(() => {
      tryDirectPaymentContainerInjection(message.details);
    }, 2500);
    
    // Don't return true since we're not sending an asynchronous response
  } else if (message.action === "fillTeslaForm") { // Standardized to 'message.action'
    console.warn("Content.js: 'fillTeslaForm' action received. This is a placeholder response.");
    // If popup.js expects a response for this, send one. Otherwise, this can be removed.
    sendResponse({ success: false, message: "'fillTeslaForm' action handler is a placeholder." });
    // No 'return true' here as sendResponse is synchronous for this placeholder.
    // If 'fillTeslaForm' becomes async, add 'return true'.
    return false; 
  }
  // IMPORTANT: No blanket 'return true' at the end of the listener anymore.
  // If a message is received that doesn't match any known action, and the sender expects a response,
  // the "channel closed" error might still occur for *those specific unknown messages*.
  // This is generally okay, as popup.js should only expect responses for actions it knows content.js handles.
});

function autofillForm(details) {
    console.log("Content script: Starting autofillForm with details:", details);

    // Account details section
    const firstNameInput = document.querySelector('input#FIRST_NAME');
    const lastNameInput = document.querySelector('input#LAST_NAME');
    const emailInput = document.querySelector('input#EMAIL');
    const emailConfirmInput = document.querySelector('input#EMAIL_CONFIRM');
    const phoneInput = document.querySelector('input#PHONE_NUMBER'); 
    const countryDropdownTrigger = document.querySelector('div#country button.tds-dropdown-trigger');
    
    // Shipping address section
    const shippingAddressInput = document.querySelector('input[name="address"], input[placeholder*="Address"]');
    const shippingAptInput = document.querySelector('input[name="apt"], input[placeholder*="Apartment"]');
    const shippingCityInput = document.querySelector('input[name="city"], input[placeholder*="City"]');
    const shippingStateInput = document.querySelector('select[name="state"], select[aria-label*="State"]');
    const shippingZipInput = document.querySelector('input[name="zip"], input[placeholder*="ZIP"]');

    // Fill account details
    if (details.firstName) setAndDispatchInput(firstNameInput, details.firstName);
    if (details.lastName) setAndDispatchInput(lastNameInput, details.lastName);
    if (details.email) {
        setAndDispatchInput(emailInput, details.email);
        setAndDispatchInput(emailConfirmInput, details.email); // Confirm email is usually the same as email
    }

    // Handle Country Code and Phone Number
    // Check if necessary details and elements are present
    if (details.countryCode && details.phone) {
        if (countryDropdownTrigger && phoneInput) {
            console.log(`Content script: Attempting to set country code to ${details.countryCode} and phone to ${details.phone}`);
            
            countryDropdownTrigger.click(); // Open the dropdown
            console.log("Content script: Clicked country dropdown trigger.");

            setTimeout(() => {
                const countryListbox = document.querySelector('ul#country-listbox');
                if (!countryListbox) {
                    console.error("Content script: Country listbox (ul#country-listbox) not found after click. Setting phone directly.");
                    if (details.phone) setAndDispatchInput(phoneInput, details.phone);
                    return;
                }

                const countryListItems = countryListbox.querySelectorAll('li.tds-listbox-option');
                let countryFoundAndClicked = false;
                console.log(`Content script: Found ${countryListItems.length} country list items.`);

                countryListItems.forEach(item => {
                    if (countryFoundAndClicked) return; 

                    const label = item.getAttribute('data-tds-label'); 
                    // details.countryCode should be like "+1", "+90"
                    // Matching logic: label includes " " + countryCode (e.g., "US +1") or ends with countryCode
                    if (label && (label.includes(' ' + details.countryCode) || label.endsWith(details.countryCode))) { 
                        console.log(`Content script: Found matching country: ${label}. Clicking.`);
                        item.click(); 
                        countryFoundAndClicked = true;
                        
                        setTimeout(() => {
                            if (details.phone) setAndDispatchInput(phoneInput, details.phone);
                            console.log("Content script: Phone number input field populated and events dispatched after country selection.");
                        }, 300); // Delay for UI to update and phone input readiness
                    }
                });

                if (!countryFoundAndClicked) {
                    console.warn(`Content script: Country code ${details.countryCode} not found in dropdown. Setting phone directly.`);
                    if (details.phone) setAndDispatchInput(phoneInput, details.phone);
                }
            }, 700); // Delay for dropdown to open and items to render
        } else {
             if (!countryDropdownTrigger) console.warn("Content script: Country dropdown trigger not found, cannot set country code.");
             if (!phoneInput) console.warn("Content script: Phone input field not found, cannot set phone number.");
             // If critical elements for country are missing, but we have phone data and input, try to set phone.
             if (phoneInput && details.phone) setAndDispatchInput(phoneInput, details.phone);
        }
    } else if (details.phone && phoneInput) { // Only phone provided, or country code missing, but phone input exists
        console.log("Content script: Country code not provided or missing, setting phone directly as phoneInput exists.");
        setAndDispatchInput(phoneInput, details.phone);
    } else {
        if (details.phone && !phoneInput) console.warn("Content script: Phone details present, but phone input field not found.");
        if (details.countryCode && !countryDropdownTrigger) console.warn("Content script: Country code present, but country dropdown trigger not found.");
    }
    
    // Fill shipping address fields
    if (shippingAddressInput && details.shippingAddress) {
        setAndDispatchInput(shippingAddressInput, details.shippingAddress);
    }
    
    if (shippingAptInput && details.shippingApt) {
        setAndDispatchInput(shippingAptInput, details.shippingApt);
    }
    
    if (shippingCityInput && details.shippingCity) {
        setAndDispatchInput(shippingCityInput, details.shippingCity);
    }
    
    if (shippingStateInput && details.shippingState) {
        // For select elements, we need to find the option with the matching value or text
        const stateOptions = shippingStateInput.querySelectorAll('option');
        let stateFound = false;
        
        stateOptions.forEach(option => {
            if (option.value === details.shippingState || option.textContent.includes(details.shippingState)) {
                shippingStateInput.value = option.value;
                shippingStateInput.dispatchEvent(new Event('change', { bubbles: true }));
                stateFound = true;
            }
        });
        
        if (!stateFound) {
            console.warn(`Content script: State '${details.shippingState}' not found in dropdown options.`);
        }
    }
    
    if (shippingZipInput && details.shippingZip) {
        setAndDispatchInput(shippingZipInput, details.shippingZip);
    }
    
    // Payment fields are now handled in the autofillPaymentIframe function
}

/**
 * Creates a container with copy buttons for card details
 * @param {Object} cardDetails - The card details object
 */
function createCopyButtonContainer(cardDetails) {
  // First check if the container already exists
  if (document.getElementById('tesla-monitor-copy-container')) {
    // Just update the values in the existing container
    updateCopyButtonValues(cardDetails);
    return;
  }

  // Remove any existing container
  const existingContainer = document.getElementById('tesla-monitor-copy-buttons');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // Create a floating container for the copy buttons
  const container = document.createElement('div');
  container.id = 'tesla-monitor-copy-container';
  container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #fff; border: 1px solid #ccc; ' +
    'border-radius: 8px; padding: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10000; display: none; ' +
    'font-family: Arial, sans-serif; max-width: 280px;';
  
  // Add a heading
  const heading = document.createElement('h3');
  heading.textContent = 'Payment Form Helper';
  heading.style.cssText = 'margin: 0 0 10px 0; font-size: 14px; color: #333; text-align: center;';
  container.appendChild(heading);
  
  // Add info text
  const infoText = document.createElement('p');
  infoText.textContent = 'Due to security restrictions, payment details must be entered manually. Click to copy:';
  infoText.style.cssText = 'margin: 0 0 10px 0; font-size: 12px; color: #666;';
  container.appendChild(infoText);
  
  // Create field buttons
  const fields = [
    { label: 'Card Number', value: cardDetails.cardNumber, field: 'cardNumber' },
    { label: 'Expiry Date', value: cardDetails.expiryDate, field: 'cardExpiry' },
    { label: 'Security Code', value: cardDetails.securityCode, field: 'cardCvc' },
    { label: 'Billing ZIP', value: cardDetails.billingZip, field: 'cardZip' }
  ];
  
  // Create grid container for buttons
  const buttonGrid = document.createElement('div');
  buttonGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;';
  
  fields.forEach(field => {
    const button = document.createElement('button');
    button.textContent = `Copy ${field.label}`;
    button.dataset.value = field.value;
    button.dataset.field = field.field;
    button.style.cssText = 'background: #3d69e1; color: white; border: none; padding: 8px; ' +
      'border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s;';
    
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = '#2d59d1';
    });
    
    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = '#3d69e1';
    });
    
    button.addEventListener('click', () => {
      // Copy to clipboard
      navigator.clipboard.writeText(field.value).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied! ';
        button.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
          button.textContent = originalText;
          button.style.backgroundColor = '#3d69e1';
        }, 1500);
      }).catch(err => {
        console.error('Failed to copy:', err);
        button.textContent = 'Failed!';
        button.style.backgroundColor = '#dc3545';
        
        setTimeout(() => {
          button.textContent = `Copy ${field.label}`;
          button.style.backgroundColor = '#3d69e1';
        }, 1500);
      });
    });
    
    buttonGrid.appendChild(button);
  });
  
  container.appendChild(buttonGrid);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.cssText = 'background: none; border: none; color: #888; font-size: 12px; ' +
    'margin-top: 10px; cursor: pointer; width: 100%; text-align: center;';
  closeButton.addEventListener('click', () => {
    container.style.display = 'none';
  });
  container.appendChild(closeButton);
  
  // Add container to page
  document.body.appendChild(container);
}

/**
 * Function to position the copy button container near payment fields
 */
function positionCopyButtonContainer() {
  const container = document.getElementById('tesla-monitor-copy-container');
  if (container) {
    container.style.display = 'block';
    
    // Make it more visible when we specifically show it for Adyen fields
    container.classList.add('highlight-container');
    
    // Create a highlight effect
    setTimeout(() => {
      container.classList.remove('highlight-container');
    }, 2000);
    
    // Log this visibility change
    logMonitoringEvent('copy_buttons_shown');
    
    // Make sure it's positioned well (in case page layout changed)
    const paymentIframe = document.querySelector('iframe[name^="adyen"], iframe[src*="adyen"], iframe[src*="pay.tesla.com"], iframe[name*="card"], iframe[name*="payment"], iframe[title*="payment" i], iframe[title*="card" i], iframe[src*="checkout"]');
    if (paymentIframe) {
      const iframeRect = paymentIframe.getBoundingClientRect();
      container.style.top = `${iframeRect.top + window.scrollY}px`;
      container.style.left = `${iframeRect.left + window.scrollX}px`;
    }
  }
}

/**
 * Update values in copy button container
 * @param {Object} cardDetails - The card details object
 */
function updateCopyButtonValues(cardDetails) {
  const container = document.getElementById('tesla-monitor-copy-container');
  if (container && cardDetails) {
    // Update the values in the copy buttons
    const cardNumEl = container.querySelector('[data-field="cardNumber"]');
    const cardExpEl = container.querySelector('[data-field="cardExpiry"]');
    const cardCvcEl = container.querySelector('[data-field="cardCvc"]');
    const cardZipEl = container.querySelector('[data-field="cardZip"]');
    
    if (cardNumEl && cardDetails.cardNumber) {
      cardNumEl.setAttribute('data-value', cardDetails.cardNumber);
    }
    if (cardExpEl && cardDetails.expiryDate) {
      cardExpEl.setAttribute('data-value', cardDetails.expiryDate);
    }
    if (cardCvcEl && cardDetails.securityCode) {
      cardCvcEl.setAttribute('data-value', cardDetails.securityCode);
    }
    if (cardZipEl && cardDetails.billingZip) {
      cardZipEl.setAttribute('data-value', cardDetails.billingZip);
    }
  }
}

/**
 * Show the copy button container
 */
function showCopyButtonContainer() {
  const container = document.getElementById('tesla-monitor-copy-container');
  if (container) {
    container.style.display = 'block';
    
    // Make it more visible when we specifically show it for Adyen fields
    container.classList.add('highlight-container');
    
    // Create a highlight effect
    setTimeout(() => {
      container.classList.remove('highlight-container');
    }, 2000);
    
    // Log this visibility change
    logMonitoringEvent('copy_buttons_shown');
    
    // Make sure it's positioned well (in case page layout changed)
    positionCopyButtonContainer();
  }
}

/**
 * Try direct injection into payment containers when iframes aren't found
 * @param {Object} details - The card details object 
 */
function tryDirectPaymentContainerInjection(details) {
  console.log("Content script: Attempting direct payment container injection");
  
  // Look for payment containers
  const paymentContainers = document.querySelectorAll(
    'div[class*="payment"], div[id*="payment"], div[class*="checkout"], ' +
    'form[name*="payment"], div[class*="card"], div[id*="card"]'
  );
  
  if (paymentContainers.length > 0) {
    console.log(`Content script: Found ${paymentContainers.length} potential payment containers for direct injection`);
    
    // Create a script that will run in the page context
    const scriptElement = document.createElement('script');
    scriptElement.textContent = `
      (function() {
        console.log("Direct injection: Scanning for payment fields");
        
        // Detect when payment fields become available
        const observer = new MutationObserver(function(mutations) {
          const cardFields = {
            number: document.querySelector('input[name*="card"][name*="number"], input[placeholder*="card"][placeholder*="number"], input[id*="card"][id*="number"]'),
            expiry: document.querySelector('input[name*="expir"], input[placeholder*="expir"], input[id*="expir"], input[name*="exp"], input[placeholder*="exp"], input[id*="exp"]'),
            cvc: document.querySelector('input[name*="cvc"], input[placeholder*="cvc"], input[id*="cvc"], input[name*="cvv"], input[placeholder*="cvv"], input[id*="cvv"], input[name*="security"], input[placeholder*="security"], input[id*="security"]'),
            zip: document.querySelector('input[name*="zip"], input[placeholder*="zip"], input[id*="zip"], input[name*="postal"], input[placeholder*="postal"], input[id*="postal"]')
          };
          
          // Check if we found any fields
          const foundFields = Object.values(cardFields).filter(field => field !== null).length;
          if (foundFields > 0) {
            console.log("Direct injection: Found payment fields, attempting to fill them");
            window.postMessage({
              action: 'standardPaymentFieldsDetected',
              source: 'tesla-inventory-monitor'
            }, '*');
          }
        });
        
        // Start observing the document
        observer.observe(document.body, { 
          childList: true, 
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'display']
        });
        
        // Run an initial check
        setTimeout(() => {
          const evt = new Event('DOMContentLoaded');
          document.dispatchEvent(evt);
        }, 500);
      })();
    `;
    
    document.head.appendChild(scriptElement);
    document.head.removeChild(scriptElement); // Clean up
    
    // Listen for messages about standard payment fields
    window.addEventListener('message', function standardFieldsHandler(event) {
      if (event.data && event.data.action === 'standardPaymentFieldsDetected' && event.data.source === 'tesla-inventory-monitor') {
        console.log("Content script: Standard payment fields detected in page context. Showing helper.");
        showCopyButtonContainer();
        window.removeEventListener('message', standardFieldsHandler);
      }
    });
  }
}

/**
 * Autofill the payment information in the iframe
 * @param {Object} details - The account details object
 */
function autofillPaymentIframe(details) {
  console.log("Content script: Attempting to autofill payment iframe");
  
  // Debug: Log all iframes on the page
  const allIframes = document.querySelectorAll('iframe');
  console.log(`Content script: Found ${allIframes.length} iframes on the page`);
  allIframes.forEach((iframe, index) => {
    console.log(`Iframe ${index}:`, {
      class: iframe.className,
      id: iframe.id,
      title: iframe.title,
      src: iframe.src,
      role: iframe.getAttribute('role')
    });
  });
  
  // Look for Adyen specific iframes first with expanded selectors
  const adyenFrames = document.querySelectorAll(
    'iframe[name^="adyen"], iframe[src*="adyen"], iframe[src*="pay.tesla.com"], ' +
    'iframe[name*="card"], iframe[name*="payment"], iframe[title*="payment" i], ' +
    'iframe[title*="card" i], iframe[src*="checkout"]'
  );
  console.log(`Content script: Found ${adyenFrames.length} potential payment iframes`);
  
  if (adyenFrames.length > 0) {
    console.log("Content script: Detected potential payment processor iframes");
    // Handle each potential payment iframe separately
    adyenFrames.forEach((paymentFrame, index) => {
      injectIframeScript(paymentFrame, details);
    });
    return true;
  }
  
  // Try each selector individually and log the result
  const iframeByClass = document.querySelector('iframe.payment-website');
  const iframeByTitle = document.querySelector('iframe[title="Payment Form"]');
  const iframeByTitleContains = document.querySelector('iframe[title*="payment" i]');
  const iframeById = document.querySelector('iframe[id*="payment" i]');
  const iframeBySrc = document.querySelector('iframe[src*="payment" i]');
  const iframeByPayTeslaSrc = document.querySelector('iframe[src*="pay.tesla.com"]');
  const iframeByRole = document.querySelector('iframe[role="main"]');
  
  console.log('Selector results:', {
    'iframe.payment-website': !!iframeByClass,
    'iframe[title="Payment Form"]': !!iframeByTitle,
    'iframe[title*="payment" i]': !!iframeByTitleContains,
    'iframe[id*="payment" i]': !!iframeById,
    'iframe[src*="payment" i]': !!iframeBySrc,
    'iframe[src*="pay.tesla.com"]': !!iframeByPayTeslaSrc,
    'iframe[role="main"]': !!iframeByRole
  });
  
  // Find the payment iframe - using multiple selectors to ensure we find it
  const paymentIframe = iframeByClass || iframeByTitle || iframeByTitleContains || 
                       iframeById || iframeBySrc || iframeByPayTeslaSrc || iframeByRole;
  
  if (!paymentIframe) {
    console.log("Content script: Payment iframe not found using standard selectors");
    
    // Look for nested iframes that might contain payment info
    const nestedFrameContainers = document.querySelectorAll('div[id*="payment"], div[class*="payment"]');
    console.log(`Content script: Found ${nestedFrameContainers.length} potential payment containers`);
    
    if (nestedFrameContainers.length > 0) {
      // Try to find iframes inside payment containers
      for (const container of nestedFrameContainers) {
        const containerIframes = container.querySelectorAll('iframe');
        if (containerIframes.length > 0) {
          console.log(`Content script: Found ${containerIframes.length} iframes inside payment container`);
          containerIframes.forEach(iframe => injectIframeScript(iframe, details));
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Log which selector found the iframe
  if (paymentIframe === iframeByClass) console.log("Found iframe by class selector");
  else if (paymentIframe === iframeByTitle) console.log("Found iframe by title selector");
  else if (paymentIframe === iframeByTitleContains) console.log("Found iframe by title contains selector");
  else if (paymentIframe === iframeById) console.log("Found iframe by id selector");
  else if (paymentIframe === iframeBySrc) console.log("Found iframe by src selector");
  else if (paymentIframe === iframeByPayTeslaSrc) console.log("Found iframe by pay.tesla.com src selector");
  else if (paymentIframe === iframeByRole) console.log("Found iframe by role selector");
  
  console.log("Content script: Payment iframe found, attempting to access");
  
  try {
    // Try to access the iframe's document directly
    const iframeDocument = paymentIframe.contentDocument || paymentIframe.contentWindow.document;
    
    // If we can access the iframe's document, find and fill the payment fields
    if (iframeDocument) {
      console.log("Content script: Successfully accessed iframe document");
      
      // Card number
      if (details.cardNumber) {
        const cardNumberInput = iframeDocument.querySelector('input[name="cardnumber"]') || 
                              iframeDocument.querySelector('input[name="card_number"]') || 
                              iframeDocument.querySelector('input[id*="card"][id*="number"]');
        
        if (cardNumberInput) {
          setAndDispatchInputInIframe(iframeDocument, cardNumberInput, details.cardNumber);
        }
      }
      
      // Expiration month/year
      if (details.expirationMonth && details.expirationYear) {
        // Try combined expiration field first
        const expDateInput = iframeDocument.querySelector('input[name="exp-date"]') || 
                           iframeDocument.querySelector('input[name="expiry"]');
        
        if (expDateInput) {
          setAndDispatchInputInIframe(iframeDocument, expDateInput, `${details.expirationMonth}/${details.expirationYear.slice(-2)}`);
        } else {
          // Try separate month/year fields
          const expMonthInput = iframeDocument.querySelector('select[name="exp_month"]') || 
                              iframeDocument.querySelector('input[name="exp_month"]');
          
          const expYearInput = iframeDocument.querySelector('select[name="exp_year"]') || 
                             iframeDocument.querySelector('input[name="exp_year"]');
          
          if (expMonthInput) {
            setAndDispatchInputInIframe(iframeDocument, expMonthInput, details.expirationMonth);
          }
          
          if (expYearInput) {
            setAndDispatchInputInIframe(iframeDocument, expYearInput, details.expirationYear);
          }
        }
      }
      
      // Security code
      if (details.securityCode) {
        const securityCodeInput = iframeDocument.querySelector('input[name="cvc"]') || 
                                iframeDocument.querySelector('input[name="cvv"]') || 
                                iframeDocument.querySelector('input[name="security_code"]');
        
        if (securityCodeInput) {
          setAndDispatchInputInIframe(iframeDocument, securityCodeInput, details.securityCode);
        }
      }
      
      // Billing ZIP
      if (details.billingZip) {
        const zipInput = iframeDocument.querySelector('input[name="postal"]') || 
                       iframeDocument.querySelector('input[name="zip"]') || 
                       iframeDocument.querySelector('input[name="billing_zip"]');
        
        if (zipInput) {
          setAndDispatchInputInIframe(iframeDocument, zipInput, details.billingZip);
        }
      }
      
      return true;
    }
  } catch (e) {
    console.log("Content script: Cannot access iframe directly due to cross-origin restrictions:", e);
  }
  
  // If direct access fails, inject our iframe script
  injectIframeScript(paymentIframe, details);
  
  // Also listen for the Adyen secure fields detection message
  window.addEventListener('message', function adyenDetectionHandler(event) {
    if (event.data && event.data.action === 'adyenSecureFieldsDetected' && event.data.source === 'tesla-inventory-monitor') {
      console.log("Content script: Adyen secure payment fields detected. These cannot be auto-filled due to security restrictions.");
      
      // Show the copy buttons helper
      showCopyButtonContainer();
      
      // Show a notification with more helpful information
      chrome.runtime.sendMessage({
        action: "showNotification",
        message: "Secure payment form detected. Use the helper tool in the bottom-right corner to copy payment details."
      });
      
      // Remove the event listener after handling
      window.removeEventListener('message', adyenDetectionHandler);
    }
  });
  
  return true;
}

/**
 * Inject our iframe-script.js into the payment iframe
 * @param {HTMLIFrameElement} iframe - The iframe element
 * @param {Object} details - The account details object
 */
function injectIframeScript(iframe, details) {
  console.log("Content script: Injecting iframe-script.js into payment iframe");
  
  // Get the extension's iframe-script.js URL
  const scriptURL = chrome.runtime.getURL('iframe-script.js');
  
  // Track if we've successfully injected
  let injectionSuccessful = false;
  
  try {
    // First approach: Try to inject the script directly with multiple attempts
    try {
      // Try to access iframe document with a few different methods
      const iframeHead = iframe.contentDocument?.head || 
                         iframe.contentWindow?.document?.head || 
                         (iframe.contentWindow && iframe.contentWindow.document?.head);
      
      if (iframeHead) {
        const script = document.createElement('script');
        script.src = scriptURL;
        iframeHead.appendChild(script);
        console.log("Content script: Successfully injected script directly");
        injectionSuccessful = true;
        return true;
      }
    } catch (directError) {
      console.log("Content script: Direct script injection failed:", directError);
    }
    
    // Also try immediate injection before the iframe fully loads
    try {
      iframe.onload = function() {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc && doc.head && !injectionSuccessful) {
            const script = document.createElement('script');
            script.src = scriptURL;
            doc.head.appendChild(script);
            console.log("Content script: Successfully injected script via onload");
            injectionSuccessful = true;
          }
        } catch (e) {
          console.log("Content script: Iframe onload injection failed:", e);
        }
      };
    } catch (onloadError) {
      console.log("Content script: Setting onload handler failed:", onloadError);
    }
    
    // Second approach: Try to use the web_accessible_resources approach
    console.log("Content script: Trying alternative script injection method");
    
    // Create a script element in the main page
    const scriptElement = document.createElement('script');
    
    // This script will attempt to communicate with the iframe
    scriptElement.textContent = `
      (function() {
        console.log("Main page script: Setting up iframe communication");
        
        // Function to find the payment iframe
        function findPaymentIframe() {
          const iframes = document.querySelectorAll('iframe');
          for (let i = 0; i < iframes.length; i++) {
            const iframe = iframes[i];
            if (iframe.className.includes('payment-website') || 
                (iframe.title && iframe.title.includes('Payment')) ||
                (iframe.src && iframe.src.includes('pay.tesla.com'))) {
              return iframe;
            }
          }
          return null;
        }
        
        // Function to send message to iframe
        function sendMessageToIframe() {
          const iframe = findPaymentIframe();
          if (!iframe) {
            console.log("Main page script: Payment iframe not found");
            return;
          }
          
          console.log("Main page script: Found payment iframe, sending message");
          
          // Send the message to the iframe
          iframe.contentWindow.postMessage({
            action: 'fillPaymentForm',
            details: ${JSON.stringify(details)},
            source: 'tesla-inventory-monitor'
          }, '*');
        }
        
        // Try immediately and then with a delay
        sendMessageToIframe();
        setTimeout(sendMessageToIframe, 1000);
        setTimeout(sendMessageToIframe, 2000);
      })();
    `;
    
    // Add the script to the page
    document.head.appendChild(scriptElement);
    document.head.removeChild(scriptElement); // Clean up
    
    // Listen for messages from the iframe
    window.addEventListener('message', function iframeMessageHandler(event) {
      if (event.data && event.data.action === 'iframeScriptLoaded' && event.data.source === 'tesla-inventory-monitor') {
        console.log("Content script: iframe-script.js loaded in iframe");
        
        // Send payment details to the iframe
        sendPaymentDetailsToIframe(iframe, details);
      } else if (event.data && event.data.action === 'paymentFormFilled' && event.data.source === 'tesla-inventory-monitor') {
        console.log("Content script: Payment form filled in iframe:", event.data.success);
      }
    });
    
    return true;
  } catch (e) {
    console.log("Content script: Failed to inject script into iframe:", e);
    return false;
  }
}

// Send payment details to the iframe
// @param {HTMLIFrameElement} iframe - The iframe element
// @param {Object} details - The account details object
function sendPaymentDetailsToIframe(iframe, details) {
  console.log("Content script: Sending payment details to iframe");
  
  // Create a message with the payment details
  const message = {
    action: 'fillPaymentForm',
    details: {
      cardNumber: details.cardNumber,
      expirationMonth: details.expirationMonth,
      expirationYear: details.expirationYear,
      securityCode: details.securityCode,
      billingZip: details.billingZip
    },
    source: 'tesla-inventory-monitor'
  };
  
  // Send the message to the iframe
  try {
    iframe.contentWindow.postMessage(message, '*');
    console.log("Content script: Payment details sent to iframe");
    return true;
  } catch (e) {
    console.log("Content script: Failed to send payment details to iframe:", e);
    return false;
  }
}

function setAndDispatchInput(element, value) {
    if (element && value !== undefined && value !== null) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        console.log(`Filled and dispatched events for ${element.id || element.name} with value: ${value}`);
    }
}
// Add this to your window.addEventListener('message') handler:
// Track which iframes have been processed
const processedIframes = new Set();
const detectedAdyenContainers = [];

// Add a monitoring log system to track extension activity
function logMonitoringEvent(eventType, details = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    eventType,
    details,
    url: window.location.href
  };
  
  chrome.storage.local.get(['contentScriptLog'], (result) => {
    const logs = result.contentScriptLog || [];
    logs.push(event);
    // Limit log size to prevent storage issues
    if (logs.length > 200) logs.shift();
    chrome.storage.local.set({ contentScriptLog: logs });
  });
  
  // Also send to background script for centralized logging
  try {
    chrome.runtime.sendMessage({
      action: 'logEvent',
      event
    });
  } catch (e) {
    console.log('Failed to send log event to background:', e);
  }
}

window.addEventListener('message', function(event) {
    // Verify the message origin for security
    if (event.data && event.data.source === 'tesla-inventory-monitor') {
      console.log('Content script received message from iframe:', event.data);
      
      if (event.data.action === 'adyenSecureFieldsDetected') {
        console.log('Secure Adyen payment fields detected, showing helper UI');
        
        // Log this important event
        logMonitoringEvent('adyen_secure_fields_detected', {
          iframeUrl: event.origin,
          details: event.data.details || {}
        });
        
        // Show notification to the user
        showSecureFieldsNotification();
        
        // Make sure copy buttons are visible
        showCopyButtonContainer();
        
        // If we have details about the detection, store them
        if (event.data.details) {
          detectedAdyenContainers.push({
            timestamp: Date.now(),
            details: event.data.details,
            origin: event.origin
          });
        }
      }
      
      if (event.data.action === 'iframeScriptLoaded') {
        console.log('Iframe script successfully loaded');
        logMonitoringEvent('iframe_script_loaded', {
          origin: event.origin
        });
      }
      
      if (event.data.action === 'iframeUnloaded') {
        console.log('Iframe was unloaded or navigated away');
        logMonitoringEvent('iframe_unloaded', {
          origin: event.origin
        });
      }
    }
  });
  
// Add this function to show a helpful notification
function showSecureFieldsNotification() {
  // Check if a notification is already showing
  if (document.querySelector('.tesla-monitor-notification')) {
    return;
  }
  
  const notificationDiv = document.createElement('div');
  notificationDiv.className = 'tesla-monitor-notification';
  notificationDiv.innerHTML = `
    <div style="background: rgba(0, 0, 0, 0.8); color: white; padding: 15px; border-radius: 5px; 
                max-width: 400px; position: fixed; top: 20px; right: 20px; z-index: 9999; 
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); font-family: Arial, sans-serif;">
      <h3 style="margin: 0 0 10px; font-size: 16px;">Secure Payment Fields Detected</h3>
      <p style="margin: 0 0 10px; font-size: 14px;">
        These fields must be filled manually due to security restrictions.
        <br>Use the copy buttons below to easily copy your card details.
      </p>
      <button onclick="this.parentNode.parentNode.style.display='none';" 
              style="background: #3e6ae1; border: none; color: white; padding: 5px 10px; 
                    border-radius: 3px; cursor: pointer; float: right; font-size: 12px;">
        Got it
      </button>
      <div style="clear: both;"></div>
    </div>
  `;
  
  document.body.appendChild(notificationDiv);
  
  // Track this notification display
  logMonitoringEvent('notification_shown', {
    type: 'secure_fields'
  });
  
  // Auto-remove after 15 seconds
  setTimeout(() => {
    if (document.body.contains(notificationDiv)) {
      document.body.removeChild(notificationDiv);
    }
  }, 15000);
}
function filterVehiclesByPrice(maxPriceString) {
    if (!maxPriceString) {
        console.error("Content.js: Empty maxPrice received");
        return;
    }
    
    // Clean the price string - remove all non-numeric characters
    const cleanedPriceString = maxPriceString.toString().replace(/[^0-9]/g, '');
    const maxPrice = parseInt(cleanedPriceString, 10);
    
    if (isNaN(maxPrice)) {
        console.error("Content.js: Invalid maxPrice received", maxPriceString, "cleaned to", cleanedPriceString);
        return;
    }

    console.log(`Content.js: Attempting to filter by max price: ${maxPrice}`);

    // --- Attempt 1: Manipulate the official Tesla price range slider ---
    const priceSlider = document.querySelector('input.tds-form-input-range.tds-form-input-range--progress');

    if (priceSlider) {
        console.log("Content.js: Found price slider element:", priceSlider);
        const sliderMin = parseInt(priceSlider.min, 10);
        const sliderMax = parseInt(priceSlider.max, 10);
        // Round the price to the nearest 1000 to match the slider steps
        let targetValue = Math.round(maxPrice / 1000) * 1000;
        console.log(`Content.js: Maximum price rounded to nearest 1000: ${targetValue}`);

        // Ensure the target value is within the slider's bounds
        if (targetValue < sliderMin) {
            console.log(`Content.js: Target price ${targetValue} is below slider minimum ${sliderMin}, setting to minimum`);
            targetValue = sliderMin;
        }
        if (targetValue > sliderMax) {
            console.log(`Content.js: Target price ${targetValue} is above slider maximum ${sliderMax}, setting to maximum`);
            targetValue = sliderMax; 
        }
        
        // Set the slider value
        priceSlider.value = targetValue;
        console.log(`Content.js: Set slider value to: ${targetValue}`);

        // Update the visual progress of the slider (if this style is still used)
        const progressPercentage = ((targetValue - sliderMin) / (sliderMax - sliderMin)) * 100;
        priceSlider.style.setProperty('--tds-form-input-range--progress-width', `${progressPercentage}%`);
        console.log(`Content.js: Set slider progress style to: ${progressPercentage}%`);

        // Dispatch events to make the page react to the change
        priceSlider.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        priceSlider.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        priceSlider.dispatchEvent(new Event('mouseup', { bubbles: true, cancelable: true }));
        console.log("Content.js: Dispatched 'input', 'change', and 'mouseup' events on slider.");
        showTemporaryMessageOnPage(`Price filter updated to $${targetValue.toLocaleString()}`)

    } else {
        console.warn("Content.js: Tesla price range slider (input.tds-form-input-range.tds-form-input-range--progress) not found. Falling back to manual filtering if implemented, or doing nothing.");
        // --- Fallback: Manually hide/show vehicle items (existing logic) ---
        // This part still needs the correct selectors for vehicleItems and priceElement within each item.
        // const vehicleItems = document.querySelectorAll('YOUR_VEHICLE_ITEM_SELECTOR'); // Replace with correct selector
        // if (!vehicleItems.length) {
        //     console.log("Content.js: Dynamic filter: No vehicle items found with the fallback selector.");
        //     return;
        // }
        // console.log(`Content.js: Found ${vehicleItems.length} vehicle items for fallback filtering.`);
        // vehicleItems.forEach(item => {
        //     const priceElement = item.querySelector('YOUR_PRICE_ELEMENT_SELECTOR_INSIDE_ITEM'); // Replace with correct selector
        //     if (priceElement) {
        //         const priceText = priceElement.textContent.replace(/[^\d]/g, ''); // Clean price
        //         const vehiclePrice = parseInt(priceText, 10);
        //         if (!isNaN(vehiclePrice)) {
        //             if (vehiclePrice <= maxPrice) {
        //                 item.style.display = ''; // Show item
        //             } else {
        //                 item.style.display = 'none'; // Hide item
        //             }
        //         }
        //     } else {
        //          console.warn("Content.js: Price element not found in a vehicle item for fallback.", item);
        //     }
        // });
    }
}

// Function to update the model selection directly on the Tesla inventory page
function updateModelSelectionOnPage(modelCode) {
    console.log(`Content.js: Attempting to update model selection to ${modelCode} directly on page`);
    
    try {
        // Find all model radio inputs
        const modelRadios = document.querySelectorAll('input[name="Model"][type="radio"]');
        
        if (!modelRadios || modelRadios.length === 0) {
            console.log('Content.js: No model radio buttons found on page');
            return false;
        }
        
        console.log(`Content.js: Found ${modelRadios.length} model radio buttons`);
        
        // Find the radio button for the selected model
        let targetRadio = null;
        modelRadios.forEach(radio => {
            if (radio.value === modelCode) {
                targetRadio = radio;
                console.log(`Content.js: Found matching radio for model ${modelCode}:`, radio);
            }
        });
        
        if (!targetRadio) {
            console.log(`Content.js: Could not find radio button for model ${modelCode}`);
            return false;
        }
        
        // If the target radio is already checked, no need to change
        if (targetRadio.checked) {
            console.log(`Content.js: Model ${modelCode} is already selected`);
            return true;
        }
        
        // Click the radio button to select it
        targetRadio.click();
        console.log(`Content.js: Clicked radio button for model ${modelCode}`);
        
        // Also programmatically set checked and dispatch events
        targetRadio.checked = true;
        targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
        targetRadio.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Show a message to the user
        showTemporaryMessageOnPage(`Model updated to ${getModelFullName(modelCode)}`);
        
        return true;
    } catch (error) {
        console.error('Content.js: Error updating model selection:', error);
        return false;
    }
}

// Helper function to get the full model name from the model code
function getModelFullName(modelCode) {
    const modelNames = {
        'ms': 'Model S',
        'm3': 'Model 3',
        'mx': 'Model X',
        'my': 'Model Y',
        'ct': 'Cybertruck'
    };
    
    return modelNames[modelCode] || modelCode;
}

// Function to show a temporary message on the page
function showTemporaryMessageOnPage(message, duration = 3000) {
    let messageDiv = document.getElementById('extension-temp-message');
    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'extension-temp-message';
        messageDiv.style.position = 'fixed';
        messageDiv.style.bottom = '20px';
        messageDiv.style.left = '20px';
        messageDiv.style.padding = '10px 20px';
        messageDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        messageDiv.style.color = 'white';
        messageDiv.style.zIndex = '99999';
        messageDiv.style.borderRadius = '5px';
        document.body.appendChild(messageDiv);
    }
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    setTimeout(() => {
        if (messageDiv) messageDiv.style.display = 'none';
    }, duration);
}


// --- Initial Load Logic ---
function applyInitialFilters() {
    chrome.storage.local.get(['userMaxPrice', 'currentModel', 'currentCondition'], result => {
        console.log("Content.js: Initial load, fetched from storage:", result);
        if (result.userMaxPrice) {
            console.log(`Content.js: Applying initial max price from storage: ${result.userMaxPrice}`);
            filterVehiclesByPrice(result.userMaxPrice.toString());
        }
        // Potentially apply model/condition filters here if the page supports it
        // via URL or by manipulating other UI elements, though URL is preferred if possible.
    });
}

// Run initial filters when the content script is loaded and the page is ready
if (document.readyState === 'loading') { // Loading hasn't finished yet
    document.addEventListener('DOMContentLoaded', applyInitialFilters);
} else { // `DOMContentLoaded` has already fired
    applyInitialFilters();
}


// ... (rest of your existing content.js, like form filling, if any)
// Example: If you have form filling logic, it would go here.
// function fillTeslaForm(data) { ... }

// Helper to find an element and click it, with retries
async function clickElementWhenAvailable(selector, maxRetries = 10, interval = 500) {
    // ... (existing helper function)
}

// Helper to find an element and set its value, with retries
async function setElementValueWhenAvailable(selector, value, maxRetries = 10, interval = 500) {
    // ... (existing helper function)
}

// Helper to find an element, set its value, and dispatch an event, with retries
async function setElementAndDispatchEvent(selector, value, eventName = 'input', maxRetries = 10, interval = 500) {
    // ... (existing helper function)
}

console.log("Content.js: Event listeners and initial load logic set up.");


/*
Existing functions like fillTeslaForm, if they were here, would remain.
Make sure that the selectors used in those functions are also up-to-date.

Example of where old vehicle filtering logic was:
const vehicleItems = document.querySelectorAll('div.results-container--list-view div.result.list-view');

vehicleItems.forEach(item => {
    const priceElement = item.querySelector('.result-price .result-value');
    // ... etc
});

This old logic is now commented out in filterVehiclesByPrice as a fallback placeholder.
The primary approach is to manipulate the official Tesla slider.
*/

// Wait for page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on a Tesla inventory or order page
    if (window.location.href.includes('tesla.com/inventory') || 
        window.location.href.includes('tesla.com/order')) {
        initializeFormHandler();
    }
});

// Initialize form handling
function initializeFormHandler() {
    // Create observer to watch for form iframe or direct form elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                handleFormElements();
            }
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial check for form elements
    handleFormElements();
}

// Handle form elements
function handleFormElements() {
    // Check for iframe first
    const formIframe = document.querySelector('iframe[id*="form"], iframe[src*="form"]');
    if (formIframe) {
        handleIframeForm(formIframe);
        return;
    }

    // Check for direct form elements
    const formElements = document.querySelectorAll('form, .tds-form-input');
    if (formElements.length) {
        handleDirectForm(formElements);
    }
}

// Handle iframe-based form
function handleIframeForm(iframe) {
    try {
        // Try to access iframe content
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Add form event listeners
        const formInputs = iframeDoc.querySelectorAll('input, select, textarea');
        formInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                handleFormInput(e.target);
            });
        });
    } catch (e) {
        console.log('Cannot access iframe content due to same-origin policy');
        // Handle cross-origin iframe case
        injectIframeScript(iframe);
    }
}

// Handle direct form elements
function handleDirectForm(elements) {
    elements.forEach(element => {
        if (element.tagName === 'FORM') {
            // Add form submission handler
            element.addEventListener('submit', handleFormSubmit);
            
            // Add input handlers to all form fields
            const inputs = element.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    handleFormInput(e.target);
                });
            });
        } else {
            // Individual form input
            element.addEventListener('change', (e) => {
                handleFormInput(e.target);
            });
        }
    });
}

// Handle form input changes
function handleFormInput(input) {
    const data = {
        name: input.name || input.id,
        value: input.value,
        type: input.type,
        timestamp: new Date().toISOString()
    };
    
    // Store form data
    chrome.storage.local.set({ [data.name]: data }, () => {
        console.log('Form data saved:', data);
    });
}

// Handle form submission
function handleFormSubmit(e) {
    // Prevent default form submission if needed
    // e.preventDefault();
    
    // Gather all form data
    const formData = new FormData(e.target);
    const data = {};
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    // Store complete form data
    chrome.storage.local.set({ formSubmission: data }, () => {
        console.log('Form submission data saved:', data);
    });
}

// Inject script into cross-origin iframe
function injectIframeScript(iframe) {
    const script = document.createElement('script');
    script.textContent = `
        // Monitor form inputs
        document.addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'SELECT' || 
                e.target.tagName === 'TEXTAREA') {
                    
                window.parent.postMessage({
                    type: 'formInput',
                    data: {
                        name: e.target.name || e.target.id,
                        value: e.target.value,
                        type: e.target.type,
                        timestamp: new Date().toISOString()
                    }
                }, '*');
            }
        });
        
        // Monitor form submissions
        document.addEventListener('submit', (e) => {
            const formData = new FormData(e.target);
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            window.parent.postMessage({
                type: 'formSubmit',
                data: data
            }, '*');
        });
    `;
    
    try {
        iframe.contentWindow.postMessage({ type: 'injectScript', script: script.textContent }, '*');
    } catch (e) {
        console.log('Failed to inject script into iframe:', e);
    }
}

// Listen for messages from iframe
window.addEventListener('message', (event) => {
    if (event.data.type === 'formInput') {
        // Handle form input data from iframe
        chrome.storage.local.set({ [event.data.data.name]: event.data.data }, () => {
            console.log('Iframe form data saved:', event.data.data);
        });
    } else if (event.data.type === 'formSubmit') {
        // Handle form submission data from iframe
        chrome.storage.local.set({ iframeFormSubmission: event.data.data }, () => {
            console.log('Iframe form submission data saved:', event.data.data);
        });
    }
});
