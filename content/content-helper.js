/**
 * Tesla AutoPilot Content Helper
 * 
 * This script handles operations that require DOM access that
 * the service worker background script cannot perform.
 */

console.log('Tesla AutoPilot content helper loaded');

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
      sendResponse({ success:false, error: error.message || String(error) });
    }
    return true;
  }
  
  // Payment Helper integration (simplified version)
  if (request.action === "showPaymentHelper") {
    try {
      createPaymentHelper(request.paymentData);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error showing payment helper:', error);
      sendResponse({ success:false, error: error.message || String(error) });
    }
    return true;
  }
  
  // Return true to keep the message channel open for async responses
  return true;
});

/**
 * Create a visual helper for payment information
 * @param {Object} data - Payment data
 */
function createPaymentHelper(data = {}) {
  // First check if we already have a helper
  if (document.getElementById('tesla-payment-helper')) {
    console.log('Payment helper already exists');
    return;
  }
  
  // Create the helper overlay
  const helper = document.createElement('div');
  helper.id = 'tesla-payment-helper';
  helper.style.cssText = `
    position: fixed;
    top: 20px; 
    left: 20px;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 15px;
    border-radius: 8px;
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    width: 250px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    backdrop-filter: blur(5px);
  `;
  
  // Helper content
  helper.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
      <strong style="font-size: 16px;">Payment Information</strong>
      <span id="tesla-helper-close" style="cursor: pointer; font-size: 16px;">×</span>
    </div>
    <div style="margin-bottom: 15px; font-size: 12px; color: #aaa;">
      These fields are in secure iframes and must be filled manually
    </div>
    <div style="margin-bottom: 8px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 2px;">Name on Card:</div>
      <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.cardName || 'Not set'}</div>
    </div>
    <div style="margin-bottom: 8px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 2px;">Card Number:</div>
      <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.cardNumber || 'Not set'}</div>
    </div>
    <div style="margin-bottom: 8px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 2px;">Expiration Date:</div>
      <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.cardExp || 'Not set'}</div>
    </div>
    <div style="margin-bottom: 8px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 2px;">CVV/Security Code:</div>
      <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.cardCVV || 'Not set'}</div>
    </div>
    <div style="margin-bottom: 8px;">
      <div style="color: #888; font-size: 12px; margin-bottom: 2px;">Billing ZIP/Postal Code:</div>
      <div style="padding: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; user-select: all;">${data.zip || 'Not set'}</div>
    </div>
    <div style="margin-top: 15px; font-size: 12px; color: #aaa; text-align: center;">
      Click on a field to copy its value
    </div>
  `;
  
  // Add to page
  document.body.appendChild(helper);
  
  // Make the helper draggable
  makeElementDraggable(helper);
  
  // Add copy functionality to fields
  const fieldContainers = helper.querySelectorAll('[style*="user-select: all"]');
  fieldContainers.forEach(container => {
    container.addEventListener('click', () => {
      const text = container.textContent;
      if (text && text !== 'Not set') {
        navigator.clipboard.writeText(text)
          .then(() => {
            // Show success feedback
            const originalBackground = container.style.background;
            container.style.background = 'rgba(16, 185, 129, 0.3)';
            setTimeout(() => {
              container.style.background = originalBackground;
            }, 1000);
          })
          .catch(err => {
            console.error('Failed to copy text: ', err);
          });
      }
    });
  });
  
  // Add close functionality
  document.getElementById('tesla-helper-close').addEventListener('click', () => {
    helper.style.opacity = '0';
    setTimeout(() => {
      helper.remove();
    }, 300);
  });
  
  // Try to highlight corresponding fields on the page
  highlightPaymentFields();
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

/**
 * Highlight payment fields on the page
 */
function highlightPaymentFields() {
  // Define field selectors for common payment providers
  const fieldSelectors = [
    // Card number containers
    '.card-number-frame', '[data-card="number"]', '.CardNumberField', '[id*="card-number"]',
    // Cardholder name containers
    '.card-name-container', '.CardholderField', '[id*="card-name"]',
    // Expiry containers
    '.card-expiry-frame', '.ExpiryField', '[id*="expiry"]',
    // CVV containers
    '.card-cvc-frame', '.CvvField', '[id*="cvv"]', '[id*="cvc"]',
    // ZIP code containers
    '.postal-code-container', '.ZipField', '[id*="postal"]', '[id*="zip"]'
  ];
  
  // Try to find all possible payment fields
  const possibleContainers = [];
  fieldSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => possibleContainers.push(el));
    } catch (e) {
      // Ignore selector errors
    }
  });
  
  // Add visual highlights to these containers
  possibleContainers.forEach(container => {
    try {
      const originalBoxShadow = container.style.boxShadow;
      const originalPosition = container.style.position;
      
      // Add a pulse effect
      container.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.6)';
      container.style.position = originalPosition === 'static' ? 'relative' : originalPosition;
      
      // Add transition for smooth effect
      container.style.transition = 'box-shadow 0.5s ease';
      
      // Pulse effect
      setTimeout(() => {
        container.style.boxShadow = '0 0 0 5px rgba(59, 130, 246, 0.3)';
        setTimeout(() => {
          container.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.6)';
        }, 500);
      }, 500);
    } catch (e) {
      // Ignore styling errors
    }
  });
  
  console.log(`Highlighted ${possibleContainers.length} potential payment fields`);
}

// Check if we're on a payment page and maybe get payment data
if (window.location.href.includes('checkout') || 
    window.location.href.includes('payment') || 
    document.querySelector('[id*="payment"], [class*="payment"], [id*="checkout"], [class*="checkout"]')) {
  
  // If this looks like a payment page, we can ask for payment data
  console.log('Detected potential payment page, requesting payment data');
  
  // Ask for user's payment data from storage
  chrome.storage.sync.get(['cardName', 'cardNumber', 'cardExp', 'cardCVV', 'zip'], (data) => {
    if (data.cardName || data.cardNumber) {
      // Wait a bit for the page to fully load
      setTimeout(() => {
        // Show payment helper if we have data
        createPaymentHelper(data);
      }, 2000);
    }
  });
}