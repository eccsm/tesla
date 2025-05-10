// Tesla AutoPilot Popup Script

// Show a notification in the popup
function showNotification(message, isSuccess = true) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = isSuccess ? 'success' : 'error';
  notification.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

// Check if we're on a Tesla page
async function checkIfTeslaPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab && tab.url && tab.url.includes('tesla.com');
  } catch (err) {
    console.error('Error checking if Tesla page:', err);
    return false;
  }
}

// Fill the form on the current page
async function fillForm() {
  const isTeslaPage = await checkIfTeslaPage();
  if (!isTeslaPage) {
    showNotification('Not on a Tesla page', false);
    return;
  }
  
  try {
    showNotification('Filling form...', true);
    
    // Send message to background script
    const response = await chrome.runtime.sendMessage({ action: 'fillForm' });
    
    if (response && response.status === 'Form filled') {
      showNotification(`Successfully filled ${response.count} fields`, true);
    } else {
      showNotification('Failed to fill form', false);
    }
  } catch (err) {
    console.error('Error filling form:', err);
    showNotification('Error filling form', false);
  }
}

// Fix validation errors on the current page
async function fixValidation() {
  const isTeslaPage = await checkIfTeslaPage();
  if (!isTeslaPage) {
    showNotification('Not on a Tesla page', false);
    return;
  }
  
  try {
    showNotification('Fixing validation errors...', true);
    
    // Send message to background script
    await chrome.runtime.sendMessage({ action: 'fixValidation' });
    
    showNotification('Validation errors fixed', true);
  } catch (err) {
    console.error('Error fixing validation:', err);
    showNotification('Error fixing validation', false);
  }
}

// Toggle the panel
async function togglePanel() {
  const isTeslaPage = await checkIfTeslaPage();
  if (!isTeslaPage) {
    showNotification('Not on a Tesla page', false);
    return;
  }
  
  try {
    // Send message to background script
    await chrome.runtime.sendMessage({ action: 'togglePanel' });
  } catch (err) {
    console.error('Error toggling panel:', err);
    showNotification('Error toggling panel', false);
  }
}

// Open options page
function openOptions() {
  chrome.runtime.openOptionsPage();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Update button states based on whether we're on a Tesla page
  checkIfTeslaPage().then(isTeslaPage => {
    const fillFormBtn = document.getElementById('fill-form-btn');
    const fixValidationBtn = document.getElementById('fix-validation-btn');
    const togglePanelBtn = document.getElementById('toggle-panel-btn');
    
    if (!isTeslaPage) {
      fillFormBtn.disabled = true;
      fixValidationBtn.disabled = true;
      togglePanelBtn.disabled = true;
      
      fillFormBtn.title = 'Must be on a Tesla page';
      fixValidationBtn.title = 'Must be on a Tesla page';
      togglePanelBtn.title = 'Must be on a Tesla page';
    }
  });
  
  // Set up button event handlers
  document.getElementById('fill-form-btn').addEventListener('click', fillForm);
  document.getElementById('fix-validation-btn').addEventListener('click', fixValidation);
  document.getElementById('toggle-panel-btn').addEventListener('click', togglePanel);
  document.getElementById('settings-btn').addEventListener('click', openOptions);
});