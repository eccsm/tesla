// Enhanced options.js file for Tesla AutoPilot
// Updated to support script.py functionality

// Default values for regions
const DEFAULT_VALUES = {
  US: {
    priceFloor: "45000",
    zip: "98052", // Updated to match script.py (Redmond, WA)
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
    cardCVV: "123",
    condition: "new",
    autopilot: ["AUTOPILOT_FULL_SELF_DRIVING"], // Default to FSD like script.py
    trimLevels: ["LRRWD", "LRAWD"] // Match script.py defaults
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
    cardCVV: "123",
    condition: "new",
    autopilot: ["AUTOPILOT_FULL_SELF_DRIVING"],
    trimLevels: ["LRRWD", "LRAWD"]
  }
};

// Model configurations 
const MODELS = {
  m3: {
    displayName: "Model 3",
    trims: [
      { value: "MRRWD", label: "Model 3 RWD" },
      { value: "LRRWD", label: "Model 3 Long Range RWD" },
      { value: "LRAWD", label: "Model 3 Long Range AWD" },
      { value: "PERFORMANCE", label: "Model 3 Performance" }
    ]
  },
  my: {
    displayName: "Model Y",
    trims: [
      { value: "MRRWD", label: "Model Y RWD" },
      { value: "LRRWD", label: "Model Y Long Range RWD" },
      { value: "LRAWD", label: "Model Y Long Range AWD" },
      { value: "PERFORMANCE", label: "Model Y Performance" }
    ]
  },
  ms: {
    displayName: "Model S",
    trims: [
      { value: "LRAWD", label: "Model S Long Range" },
      { value: "PLAID", label: "Model S Plaid" }
    ]
  },
  mx: {
    displayName: "Model X",
    trims: [
      { value: "LRAWD", label: "Model X Long Range" },
      { value: "PLAID", label: "Model X Plaid" }
    ]
  }
};

// Autopilot options
const AUTOPILOT_OPTIONS = [
  { value: "AUTOPILOT_FULL_SELF_DRIVING", label: "Full Self-Driving" },
  { value: "AUTOPILOT_ENHANCED", label: "Enhanced Autopilot" },
  { value: "AUTOPILOT_STANDARD", label: "Autopilot" }
];

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

// Get current model
async function getModel() {
  try {
    const { model = "my" } = await chrome.storage.sync.get("model");
    return model;
  } catch (error) {
    console.error("Error getting model:", error);
    return "my";
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
  
  // Get current model
  const model = await getModel();
  
  // Update trim levels for the model
  updateTrimOptions(model);
}

// Update trim options based on selected model
function updateTrimOptions(modelCode) {
  const trimContainer = $("trim-levels-container");
  if (!trimContainer) return;
  
  // Clear existing options
  trimContainer.innerHTML = "";
  
  // Get trims for the model
  const trims = MODELS[modelCode]?.trims || [];
  
  // Add checkboxes for each trim
  trims.forEach(trim => {
    const checkboxId = `trim-${trim.value}`;
    
    const checkboxDiv = document.createElement("div");
    checkboxDiv.className = "checkbox-option";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = checkboxId;
    checkbox.value = trim.value;
    checkbox.className = "trim-checkbox";
    
    const label = document.createElement("label");
    label.htmlFor = checkboxId;
    label.textContent = trim.label;
    
    checkboxDiv.appendChild(checkbox);
    checkboxDiv.appendChild(label);
    trimContainer.appendChild(checkboxDiv);
  });
}

// Update autopilot options
function updateAutopilotOptions() {
  const autopilotContainer = $("autopilot-container");
  if (!autopilotContainer) return;
  
  // Clear existing options
  autopilotContainer.innerHTML = "";
  
  // Add checkboxes for each autopilot option
  AUTOPILOT_OPTIONS.forEach(option => {
    const checkboxId = `autopilot-${option.value}`;
    
    const checkboxDiv = document.createElement("div");
    checkboxDiv.className = "checkbox-option";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = checkboxId;
    checkbox.value = option.value;
    checkbox.className = "autopilot-checkbox";
    
    const label = document.createElement("label");
    label.htmlFor = checkboxId;
    label.textContent = option.label;
    
    checkboxDiv.appendChild(checkbox);
    checkboxDiv.appendChild(label);
    autopilotContainer.appendChild(checkboxDiv);
  });
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
    
    // Handle model selection
    if ($("model")) {
      $("model").value = data.model || "my";
    }
    
    // Handle condition selection
    if ($("condition")) {
      $("condition").value = data.condition || "new";
    }
    
    // Update trim options
    updateTrimOptions(data.model || "my");
    
    // Check appropriate trim checkboxes
    const savedTrimLevels = data.trimLevels || defaults.trimLevels || [];
    document.querySelectorAll(".trim-checkbox").forEach(checkbox => {
      checkbox.checked = savedTrimLevels.includes(checkbox.value);
    });
    
    // Update autopilot options
    updateAutopilotOptions();
    
    // Check appropriate autopilot checkboxes
    const savedAutopilot = data.autopilot || defaults.autopilot || [];
    document.querySelectorAll(".autopilot-checkbox").forEach(checkbox => {
      checkbox.checked = savedAutopilot.includes(checkbox.value);
    });
  } catch (error) {
    console.error("Error loading values:", error);
    showStatus("Error loading settings", false);
  }
}

// Save all values to storage
async function saveValues() {
  try {
    // Get all basic field IDs
    const fields = [
      "priceFloor", "zip", "tc", "first", "last", "email", "phone",
      "country", "addr1", "addr2", "city", "state",
      "cardName", "cardNumber", "cardExp", "cardCVV"
    ];
    
    // Create object with field values
    const data = {
      region: $("region").value
    };
    
    // Save basic fields
    fields.forEach(fieldId => {
      const field = $(fieldId);
      if (field) {
        data[fieldId] = field.value.trim();
      }
    });
    
    // Save model if it exists
    if ($("model")) {
      data.model = $("model").value;
    }
    
    // Save condition if it exists
    if ($("condition")) {
      data.condition = $("condition").value;
    }
    
    // Save trim levels
    const trimLevels = [];
    document.querySelectorAll(".trim-checkbox:checked").forEach(checkbox => {
      trimLevels.push(checkbox.value);
    });
    data.trimLevels = trimLevels;
    
    // Save autopilot options
    const autopilot = [];
    document.querySelectorAll(".autopilot-checkbox:checked").forEach(checkbox => {
      autopilot.push(checkbox.value);
    });
    data.autopilot = autopilot;
    
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
    
    // Handle checkboxes
    const trimLevels = [];
    document.querySelectorAll(".trim-checkbox:checked").forEach(checkbox => {
      trimLevels.push(checkbox.value);
    });
    data.trimLevels = trimLevels;
    
    const autopilot = [];
    document.querySelectorAll(".autopilot-checkbox:checked").forEach(checkbox => {
      autopilot.push(checkbox.value);
    });
    data.autopilot = autopilot;
    
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

// Export data to CSV
function exportToCSV() {
  chrome.runtime.sendMessage({ action: "downloadCSV" }, response => {
    if (response && response.success) {
      showStatus("CSV exported successfully!");
    } else {
      showStatus("Error exporting CSV", false);
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
  
  // Set up model change handler
  if ($("model")) {
    $("model").addEventListener("change", (e) => {
      updateTrimOptions(e.target.value);
    });
  }
  
  // Set up export button if it exists
  if ($("export-csv")) {
    $("export-csv").addEventListener("click", exportToCSV);
  }
  
  // Add the debug section
  addDebugSection();
});