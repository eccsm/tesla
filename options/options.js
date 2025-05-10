// Fixed options.js file for Tesla AutoPilot
// Replace your entire options/options.js file with this code

// Default values for regions
const DEFAULT_VALUES = {
  US: {
    priceFloor: "45000",
    zip: "94401",
    first: "John",
    last: "Smith",
    email: "your.email@example.com",
    phone: "4155551234",
    country: "US",
    addr1: "123 Main Street",
    addr2: "Apt 101",
    city: "San Francisco",
    state: "CA",
    cardName: "John Smith",
    cardNumber: "4111111111111111",
    cardExp: "12/27",
    cardCVV: "123"
  },
  TR: {
    priceFloor: "1590000",
    zip: "06000",
    tc: "12345678901",
    first: "Ekincan",
    last: "Casim",
    email: "eccasim@icloud.com",
    phone: "5320651500",
    country: "TR",
    addr1: "123 Main Street",
    addr2: "Apt 101",
    city: "Istanbul",
    state: "Marmara",
    cardName: "John Smith",
    cardNumber: "4111111111111111",
    cardExp: "12/27",
    cardCVV: "123"
  }
};

// Helper functions
function $(id) {
  return document.getElementById(id);
}

// Show a status message
function showStatus(message, isSuccess = true) {
  const statusEl = $("saveStatus");
  
  statusEl.textContent = message;
  statusEl.style.display = "block";
  statusEl.style.color = isSuccess ? "green" : "red";
  statusEl.style.background = isSuccess ? "#f0fff4" : "#fff0f0";
  
  // Hide after 3 seconds
  setTimeout(() => {
    statusEl.style.display = "none";
  }, 3000);
}

// Get current region
async function getRegion() {
  try {
    const { region = "US" } = await chrome.storage.sync.get("region");
    return region;
  } catch (error) {
    console.error("Error getting region:", error);
    return "US";
  }
}

// Update UI for region
async function updateUIForRegion(region) {
  // Update region selector
  $("region").value = region;
  
  // Update price label with correct currency
  if (region === "TR") {
    $("price-label").textContent = "Price Threshold (₺):";
    $('.tc-field').style.display = "block";
  } else {
    $("price-label").textContent = "Price Threshold ($):";
    $('.tc-field').style.display = "none";
  }
}

// Load all values from storage
async function loadValues() {
  try {
    // Get current region
    const region = await getRegion();
    
    // Update UI for region
    await updateUIForRegion(region);
    
    // Get all saved fields
    const data = await chrome.storage.sync.get(null);
    console.log("Loaded data from storage:", data);
    
    // Get default values
    const defaults = DEFAULT_VALUES[region];
    
    // All field IDs
    const fields = [
      "priceFloor", "zip", "tc", "first", "last", "email", "phone",
      "country", "addr1", "addr2", "city", "state",
      "cardName", "cardNumber", "cardExp", "cardCVV"
    ];
    
    // Fill fields with saved or default values
    fields.forEach(fieldId => {
      const field = $(fieldId);
      if (field) {
        // Use saved value if exists, otherwise use default
        const value = data[fieldId] !== undefined ? data[fieldId] : (defaults[fieldId] || "");
        field.value = value;
        console.log(`Set field ${fieldId} to value:`, value);
      }
    });
  } catch (error) {
    console.error("Error loading values:", error);
    showStatus("Error loading settings", false);
  }
}

// Save all values to storage
async function saveValues() {
  try {
    // Get all field IDs
    const fields = [
      "priceFloor", "zip", "tc", "first", "last", "email", "phone",
      "country", "addr1", "addr2", "city", "state",
      "cardName", "cardNumber", "cardExp", "cardCVV"
    ];
    
    // Create object with field values
    const data = {
      region: $("region").value
    };
    
    fields.forEach(fieldId => {
      const field = $(fieldId);
      if (field) {
        data[fieldId] = field.value.trim();
      }
    });
    
    console.log("Saving data to storage:", data);
    
    // Save to storage - using multiple calls for reliability
    await Promise.all([
      chrome.storage.sync.set(data),
      chrome.storage.local.set(data)
    ]);
    
    showStatus("Settings saved successfully!");
    
    // Try to trigger a background refresh
    try {
      chrome.runtime.sendMessage({ action: "refreshData" });
    } catch (e) {
      console.log("Optional refresh failed:", e);
    }
    
    return true;
  } catch (error) {
    console.error("Error saving values:", error);
    showStatus("Error saving settings", false);
    return false;
  }
}

// Add a debugging section to fix issues
function addDebugSection() {
  const debugSection = document.createElement('div');
  debugSection.className = 'section';
  debugSection.innerHTML = `
    <h2>Debug & Advanced Options</h2>
    <p>If you're having trouble with settings not saving, try the options below:</p>
    <button id="debug-save" class="btn">Force Save All Settings</button>
    <button id="debug-clear" class="btn" style="background-color: #ef4444; margin-top: 10px;">Clear All Settings</button>
    <div id="debug-status" style="margin-top: 10px; font-size: 14px;"></div>
  `;
  
  document.body.appendChild(debugSection);
  
  $("debug-save").addEventListener("click", async () => {
    // Get all input fields
    const inputs = document.querySelectorAll('input, select');
    const data = {region: $("region").value};
    
    // Add all input values to data
    inputs.forEach(input => {
      if (input.id) {
        data[input.id] = input.value;
      }
    });
    
    // Add default initialized flag
    data.defaultsInitialized = true;
    
    try {
      // Use both storage types for maximum reliability
      await chrome.storage.sync.set(data);
      await chrome.storage.local.set(data);
      $("debug-status").textContent = "Force save successful! Data saved to both sync and local storage.";
      $("debug-status").style.color = "green";
    } catch (e) {
      $("debug-status").textContent = "Error: " + e.message;
      $("debug-status").style.color = "red";
    }
  });
  
  $("debug-clear").addEventListener("click", async () => {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      $("debug-status").textContent = "All settings cleared. Refresh the page to load defaults.";
      $("debug-status").style.color = "orange";
    } catch (e) {
      $("debug-status").textContent = "Error clearing: " + e.message;
      $("debug-status").style.color = "red";
    }
  });
}

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  console.log("Options page loaded");
  
  // Load saved values
  loadValues();
  
  // Set up save button
  $("save").addEventListener("click", saveValues);
  
  // Set up region change handler
  $("region").addEventListener("change", () => {
    loadValues();
  });
  
  // Add the debug section
  addDebugSection();
});