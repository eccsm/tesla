/**
 * Tesla AutoPilot Enhanced Popup Script
 * 
 * Handles all UI interactions in the extension popup, including inventory
 * monitoring, form filling, and settings management.
 */

import { CONFIG, ACTION_TYPES, STORAGE_KEYS } from '../shared/constants.js';
import { formatPrice, sendMessageToBackground, debounce } from '../shared/utils.js';

// State
let isMonitoring = false;
let currentSettings = {
  region: 'US',
  model: 'my',
  condition: 'new',
  priceMax: 45000,
  pollingInterval: 5
};

/**
 * Show a notification in the popup
 * @param {string} message - Message text
 * @param {boolean} isSuccess - Whether it's a success notification
 */
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

/**
 * Update the UI language based on the selected region
 * @param {string} region - Region code (e.g., 'US', 'TR')
 */
function updateUILanguage(region) {
  if (region === 'TR') {
    document.body.classList.add('locale-tr');
    document.body.classList.remove('locale-en');
  } else {
    document.body.classList.add('locale-en');
    document.body.classList.remove('locale-tr');
  }
  
  // Update region buttons
  const regionButtons = document.querySelectorAll('.region-btn');
  regionButtons.forEach(btn => {
    if (btn.dataset.region === region) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update currency symbol in price input placeholder
  const priceInput = document.getElementById('price-input');
  if (priceInput) {
    if (region === 'TR') {
      priceInput.placeholder = 'Maksimum fiyatı girin (₺)';
    } else {
      priceInput.placeholder = 'Enter maximum price ($)';
    }
  }
}

/**
 * Update monitoring UI
 */
function updateMonitoringUI() {
  const monitorStatus = document.getElementById('monitor-status');
  const statusIndicator = monitorStatus.querySelector('.status-indicator');
  const statusText = monitorStatus.querySelector('.status-text');
  const monitorDetails = document.getElementById('monitor-details');
  const monitorToggleBtn = document.getElementById('monitor-toggle-btn');
  
  if (isMonitoring) {
    monitorStatus.classList.add('active');
    statusIndicator.classList.remove('inactive');
    statusIndicator.classList.add('active');
    
    if (currentSettings.region === 'TR') {
      statusText.innerHTML = '<span class="locale-text-tr">İzleme: Aktif</span><span class="locale-text-en">Monitoring: Active</span>';
    } else {
      statusText.innerHTML = '<span class="locale-text-en">Monitoring: Active</span><span class="locale-text-tr">İzleme: Aktif</span>';
    }
    
    monitorDetails.style.display = 'block';
    
    if (currentSettings.region === 'TR') {
      monitorToggleBtn.innerHTML = '<span class="locale-text-tr">Durdur</span><span class="locale-text-en">Stop</span>';
    } else {
      monitorToggleBtn.innerHTML = '<span class="locale-text-en">Stop</span><span class="locale-text-tr">Durdur</span>';
    }
    
    monitorToggleBtn.classList.remove('btn-success');
    monitorToggleBtn.classList.add('btn-stop');
  } else {
    monitorStatus.classList.remove('active');
    statusIndicator.classList.remove('active');
    statusIndicator.classList.add('inactive');
    
    if (currentSettings.region === 'TR') {
      statusText.innerHTML = '<span class="locale-text-tr">İzleme: Pasif</span><span class="locale-text-en">Monitoring: Inactive</span>';
    } else {
      statusText.innerHTML = '<span class="locale-text-en">Monitoring: Inactive</span><span class="locale-text-tr">İzleme: Pasif</span>';
    }
    
    monitorDetails.style.display = 'none';
    
    if (currentSettings.region === 'TR') {
      monitorToggleBtn.innerHTML = '<span class="locale-text-tr">Başlat</span><span class="locale-text-en">Start</span>';
    } else {
      monitorToggleBtn.innerHTML = '<span class="locale-text-en">Start</span><span class="locale-text-tr">Başlat</span>';
    }
    
    monitorToggleBtn.classList.remove('btn-stop');
    monitorToggleBtn.classList.add('btn-success');
  }
  
  // Update details text
  document.getElementById('monitor-model').textContent = getModelName(currentSettings.model);
  
  // Format currency by region
  if (currentSettings.region === 'TR') {
    document.getElementById('price-threshold').textContent = '₺' + currentSettings.priceMax.toLocaleString('tr-TR');
  } else {
    document.getElementById('price-threshold').textContent = '$' + currentSettings.priceMax.toLocaleString('en-US');
  }
}

/**
 * Get full model name from model code
 * @param {string} modelCode - Model code (e.g., 'm3', 'my') 
 * @returns {string} Full model name
 */
function getModelName(modelCode) {
  const models = {
    'm3': 'Model 3',
    'my': 'Model Y',
    'ms': 'Model S',
    'mx': 'Model X'
  };
  return models[modelCode] || modelCode.toUpperCase();
}

/**
 * Update the last updated timestamp
 * @param {string} timestamp - Timestamp to display
 */
function updateLastUpdated(timestamp) {
  const lastUpdated = document.getElementById('lastUpdated');
  if (timestamp) {
    const date = new Date(timestamp);
    lastUpdated.textContent = currentSettings.region === 'TR' ? 
      'Son güncelleme: ' + date.toLocaleTimeString('tr-TR') :
      'Last updated: ' + date.toLocaleTimeString('en-US');
  } else {
    const now = new Date();
    lastUpdated.textContent = currentSettings.region === 'TR' ? 
      'Son güncelleme: ' + now.toLocaleTimeString('tr-TR') :
      'Last updated: ' + now.toLocaleTimeString('en-US');
  }
}

/**
 * Check if we're on a Tesla page
 * @returns {Promise<boolean>} Whether we're on a Tesla page
 */
async function checkIfTeslaPage() {
  try {
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    
    if (tabs.length === 0) return false;
    
    const tab = tabs[0];
    return tab.url && tab.url.includes('tesla.com');
  } catch (err) {
    console.error('Error checking if Tesla page:', err);
    return false;
  }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    // Get data from storage
    const data = await new Promise(resolve => {
      chrome.storage.sync.get([
        'region', 'model', 'condition', 'priceFloor', 'pollingInterval', 'isMonitoring', 
        'lastInventoryCheck', 'monitoringFilters', 'monitoringInterval', 'zip'
      ], resolve);
    });
    
    // Update current settings
    currentSettings.region = data.region || 'US';
    currentSettings.model = data.model || 'my';
    currentSettings.condition = data.condition || 'new';
    
    // Set default price based on region
    const defaultPrice = currentSettings.region === 'TR' ? 1590000 : 45000;
    currentSettings.priceMax = parseInt(data.priceFloor) || defaultPrice;
    currentSettings.pollingInterval = data.pollingInterval || 5;
    
    // Update UI language
    updateUILanguage(currentSettings.region);
    
    // Update UI controls
    document.getElementById('model').value = currentSettings.model;
    document.getElementById('condition').value = currentSettings.condition;
    document.getElementById('price-input').value = currentSettings.priceMax;
    document.getElementById('poll-interval-input').value = currentSettings.pollingInterval;
    
    // Set ZIP code if available
    if (data.zip) {
      document.getElementById('zip-input').value = data.zip;
    }
    
    // Check if monitoring is active
    if (data.isMonitoring) {
      isMonitoring = true;
      
      // Set polling interval from monitoring settings if available
      if (data.monitoringInterval) {
        currentSettings.pollingInterval = data.monitoringInterval;
        document.getElementById('poll-interval-input').value = data.monitoringInterval;
      }
      
      // Update monitoring filters if available
      if (data.monitoringFilters) {
        if (data.monitoringFilters.model) {
          currentSettings.model = data.monitoringFilters.model;
          document.getElementById('model').value = data.monitoringFilters.model;
        }
        
        if (data.monitoringFilters.condition) {
          currentSettings.condition = data.monitoringFilters.condition;
          document.getElementById('condition').value = data.monitoringFilters.condition;
        }
        
        if (data.monitoringFilters.priceMax) {
          currentSettings.priceMax = data.monitoringFilters.priceMax;
          document.getElementById('price-input').value = data.monitoringFilters.priceMax;
        }
        
        if (data.monitoringFilters.region) {
          currentSettings.region = data.monitoringFilters.region;
          updateUILanguage(data.monitoringFilters.region);
        }
      }
    }
    
    // Update monitoring UI
    updateMonitoringUI();
    
    // Update last check time if available
    if (data.lastInventoryCheck) {
      updateLastUpdated(data.lastInventoryCheck);
      
      // Get last check time for monitoring panel
      const date = new Date(data.lastInventoryCheck);
      document.getElementById('last-check-time').textContent = date.toLocaleTimeString(
        currentSettings.region === 'TR' ? 'tr-TR' : 'en-US'
      );
    }
  } catch (err) {
    console.error('Error loading settings:', err);
    showNotification(currentSettings.region === 'TR' ? 
      'Ayarlar yüklenirken hata oluştu' : 
      'Error loading settings', false);
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  try {
    // Get values from UI
    const model = document.getElementById('model').value;
    const condition = document.getElementById('condition').value;
    const priceMax = parseInt(document.getElementById('price-input').value) || 
                     (currentSettings.region === 'TR' ? 1590000 : 45000);
    const pollingInterval = parseInt(document.getElementById('poll-interval-input').value) || 5;
    const zip = document.getElementById('zip-input').value;
    
    // Save to storage
    await new Promise(resolve => {
      chrome.storage.sync.set({
        region: currentSettings.region,
        model: model,
        condition: condition,
        priceFloor: priceMax,
        pollingInterval: pollingInterval,
        zip: zip
      }, resolve);
    });
    
    // Update current settings
    currentSettings.model = model;
    currentSettings.condition = condition;
    currentSettings.priceMax = priceMax;
    currentSettings.pollingInterval = pollingInterval;
    
    return true;
  } catch (err) {
    console.error('Error saving settings:', err);
    return false;
  }
}

/**
 * Toggle monitoring state
 */
async function toggleMonitoring() {
  try {
    if (isMonitoring) {
      // Stop monitoring
      const message = currentSettings.region === 'TR' ? 
        'İzleme durduruluyor...' : 
        'Stopping monitoring...';
      showNotification(message, true);
      
      const response = await sendMessageToBackground({ 
        action: ACTION_TYPES.STOP_MONITORING 
      });
      
      if (response && response.success) {
        isMonitoring = false;
        updateMonitoringUI();
        
        const successMessage = currentSettings.region === 'TR' ? 
          'İzleme durduruldu' : 
          'Monitoring stopped';
        showNotification(successMessage, true);
      } else {
        const errorMessage = currentSettings.region === 'TR' ? 
          'İzleme durdurulamadı' : 
          'Failed to stop monitoring';
        showNotification(errorMessage, false);
      }
    } else {
      // Start monitoring
      const message = currentSettings.region === 'TR' ? 
        'İzleme başlatılıyor...' : 
        'Starting monitoring...';
      showNotification(message, true);
      
      // Save settings first
      await saveSettings();
      
      // Build filters
      const filters = {
        region: currentSettings.region,
        model: document.getElementById('model').value,
        condition: document.getElementById('condition').value,
        priceMax: parseInt(document.getElementById('price-input').value) || 
                  (currentSettings.region === 'TR' ? 1590000 : 45000),
        zip: document.getElementById('zip-input').value
      };
      
      // Get interval
      const interval = parseInt(document.getElementById('poll-interval-input').value) || 5;
      
      // Start monitoring
      const response = await sendMessageToBackground({
        action: ACTION_TYPES.START_MONITORING,
        filters: filters,
        interval: interval
      });
      
      if (response && response.success) {
        isMonitoring = true;
        updateMonitoringUI();
        
        const successMessage = currentSettings.region === 'TR' ? 
          'İzleme başlatıldı' : 
          'Monitoring started';
        showNotification(successMessage, true);
      } else {
        const errorMessage = currentSettings.region === 'TR' ? 
          'İzleme başlatılamadı' : 
          'Failed to start monitoring';
        showNotification(errorMessage, false);
      }
    }
  } catch (err) {
    console.error('Error toggling monitoring:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Hata: ' + err.message : 
      'Error: ' + err.message;
    showNotification(errorMessage, false);
  }
}

/**
 * Check inventory now
 */
async function checkInventoryNow() {
  try {
    const message = currentSettings.region === 'TR' ? 
      'Tesla envanteri kontrol ediliyor...' : 
      'Checking Tesla inventory...';
    showNotification(message, true);
    
    // Save settings first
    await saveSettings();
    
    // Build filters
    const filters = {
      region: currentSettings.region,
      model: document.getElementById('model').value,
      condition: document.getElementById('condition').value,
      priceMax: parseInt(document.getElementById('price-input').value) || 
                (currentSettings.region === 'TR' ? 1590000 : 45000),
      zip: document.getElementById('zip-input').value
    };
    
    // Check inventory
    const response = await sendMessageToBackground({
      action: ACTION_TYPES.CHECK_INVENTORY,
      filters: filters
    });
    
    if (response && response.success) {
      const resultCount = response.results.length;
      updateLastUpdated();
      
      if (resultCount > 0) {
        const successMessage = currentSettings.region === 'TR' ? 
          `${resultCount} araç bulundu!` : 
          `Found ${resultCount} matching vehicles!`;
        showNotification(successMessage, true);
        displayResults(response.results);
      } else {
        const emptyMessage = currentSettings.region === 'TR' ? 
          'Araç bulunamadı' : 
          'No matching vehicles found';
        showNotification(emptyMessage, true);
        hideResults();
      }
      
      // Check if browser method was used
      if (response.method === "browser") {
        const browserMessage = currentSettings.region === 'TR' ? 
          'API engellendiği için tarayıcı kullanıldı.' : 
          'Used browser method (API blocked).';
        showNotification(browserMessage, true);
      }
    } else if (response && response.fallback) {
      // API access is blocked by Tesla
      const fallbackMessage = currentSettings.region === 'TR' ? 
        'Tesla API erişimi engellendi. Tarayıcıda açılıyor.' : 
        'Tesla API blocked. Opening in browser instead.';
      showNotification(fallbackMessage, false);
      
      // Open Tesla inventory in browser
      openTeslaInventory();
    } else {
      const errorMessage = response?.error || (currentSettings.region === 'TR' ? 
        'Envanter kontrol edilemedi' : 
        'Failed to check inventory');
      showNotification(errorMessage, false);
    }
  } catch (err) {
    console.error('Error checking inventory:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Hata: ' + err.message : 
      'Error: ' + err.message;
    showNotification(errorMessage, false);
  }
}

/**
 * Display search results
 * @param {Array} results - Array of vehicle results
 */
function displayResults(results) {
  if (!results || results.length === 0) {
    hideResults();
    return;
  }
  
  const resultsCard = document.getElementById('results-card');
  const resultsContent = document.getElementById('results-content');
  
  // Clear existing content
  resultsContent.innerHTML = '';
  
  // Create results content
  const resultsList = document.createElement('div');
  resultsList.style.cssText = 'max-height: 300px; overflow-y: auto; margin-bottom: 10px;';
  
  // Add result count
  const countDiv = document.createElement('div');
  countDiv.style.cssText = 'margin-bottom: 10px; font-weight: 500;';
  countDiv.textContent = currentSettings.region === 'TR' ?
    `${results.length} araç bulundu` :
    `Found ${results.length} vehicles`;
  resultsContent.appendChild(countDiv);
  
  // Add each result
  results.slice(0, 10).forEach(vehicle => {
    const resultItem = document.createElement('div');
    resultItem.style.cssText = 'padding: 8px; margin-bottom: 6px; border-bottom: 1px solid #eee;';
    
    const modelName = document.createElement('div');
    modelName.style.cssText = 'font-weight: 500;';
    modelName.textContent = `${vehicle.model} ${vehicle.trim}`;
    
    const priceDiv = document.createElement('div');
    priceDiv.textContent = vehicle.formattedPrice;
    
    const linkDiv = document.createElement('div');
    linkDiv.style.cssText = 'margin-top: 5px;';
    
    const viewLink = document.createElement('a');
    viewLink.href = vehicle.inventoryUrl;
    viewLink.textContent = currentSettings.region === 'TR' ? 'Görüntüle' : 'View';
    viewLink.style.cssText = 'color: #3b82f6; text-decoration: none; font-size: 13px;';
    viewLink.target = '_blank';
    
    linkDiv.appendChild(viewLink);
    
    resultItem.appendChild(modelName);
    resultItem.appendChild(priceDiv);
    resultItem.appendChild(linkDiv);
    
    resultsList.appendChild(resultItem);
  });
  
  // If there are more results than we're showing
  if (results.length > 10) {
    const moreDiv = document.createElement('div');
    moreDiv.style.cssText = 'text-align: center; margin-top: 5px; font-size: 13px; color: #666;';
    moreDiv.textContent = currentSettings.region === 'TR' ?
      `+${results.length - 10} daha araç...` :
      `+${results.length - 10} more vehicles...`;
    resultsList.appendChild(moreDiv);
  }
  
  resultsContent.appendChild(resultsList);
  resultsCard.style.display = 'block';
}

/**
 * Hide search results
 */
function hideResults() {
  const resultsCard = document.getElementById('results-card');
  resultsCard.style.display = 'none';
}

/**
 * Export results to CSV
 */
async function exportToCSV() {
  try {
    const message = currentSettings.region === 'TR' ? 
      'CSV dışa aktarılıyor...' : 
      'Exporting to CSV...';
    showNotification(message, true);
    
    const response = await sendMessageToBackground({ action: ACTION_TYPES.DOWNLOAD_CSV });
    
    if (response && response.success) {
      const successMessage = currentSettings.region === 'TR' ? 
        'CSV başarıyla dışa aktarıldı' : 
        'CSV exported successfully';
      showNotification(successMessage, true);
    } else {
      const errorMessage = currentSettings.region === 'TR' ? 
        'CSV dışa aktarılamadı' : 
        'Failed to export CSV';
      showNotification(errorMessage, false);
    }
  } catch (err) {
    console.error('Error exporting to CSV:', err);
    showNotification('Error exporting CSV: ' + err.message, false);
  }
}

/**
 * Open Tesla inventory in browser with simplified URL parameters
 */
async function openTeslaInventory() {
  try {
    // Save settings first
    await saveSettings();
    
    // Get the current filter values (use minimal settings)
    const model = document.getElementById('model').value || 'my';
    const condition = document.getElementById('condition').value || 'new';
    const paymentType = document.getElementById('payment-type')?.value || 'cash';
    
    // Build a streamlined Tesla inventory URL
    const baseUrl = currentSettings.region === 'TR' ? 
      'https://www.tesla.com/tr_TR' : 
      'https://www.tesla.com';
    
    // Create URL with only essential parameters
    const url = `${baseUrl}/inventory/${condition}/${model}?range=25&PaymentType=${paymentType}`;
    
    console.log(`Opening Tesla inventory with URL: ${url}`);
    
    // Open only one tab with the simplified URL
    chrome.tabs.create({ url });
    
    // Show a success message
    showNotification(currentSettings.region === 'TR' ? 
      'Tesla envanteri açılıyor' : 
      'Opening Tesla inventory', true);
  } catch (error) {
    console.error('Error opening Tesla inventory:', error);
    showNotification('Error opening Tesla inventory', false);
  }
}

/**
 * Open options page
 */
function openOptions() {
  chrome.runtime.openOptionsPage();
}

/**
 * Change region
 * @param {string} region - Region code
 */
async function changeRegion(region) {
  if (region === currentSettings.region) return;
  
  try {
    // Update region
    currentSettings.region = region;
    
    // Update UI language
    updateUILanguage(region);
    
    // Update default price
    const defaultPrice = region === 'TR' ? 1590000 : 45000;
    if (!document.getElementById('price-input').value) {
      document.getElementById('price-input').value = defaultPrice;
    }
    
    // Save settings
    await saveSettings();
    
    // Update monitoring UI
    updateMonitoringUI();
    
    // If monitoring is active, stop it
    if (isMonitoring) {
      await toggleMonitoring();
    }
    
    const message = region === 'TR' ? 
      'Bölge Türkiye olarak değiştirildi' : 
      'Region changed to USA';
    showNotification(message, true);
  } catch (err) {
    console.error('Error changing region:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Bölge değiştirilemedi' : 
      'Failed to change region';
    showNotification(errorMessage, false);
  }
}

/**
 * Fill the form on the current page
 */
async function fillForm() {
  const isTeslaPage = await checkIfTeslaPage();
  if (!isTeslaPage) {
    const message = currentSettings.region === 'TR' ? 
      'Tesla sayfasında değilsiniz' : 
      'Not on a Tesla page';
    showNotification(message, false);
    return;
  }
  
  try {
    const message = currentSettings.region === 'TR' ? 
      'Form dolduruluyor...' : 
      'Filling form...';
    showNotification(message, true);
    
    const response = await sendMessageToBackground({ action: ACTION_TYPES.FILL_FORM });
    
    if (response && response.status === 'Form filled') {
      const successMessage = currentSettings.region === 'TR' ? 
        `${response.count || 0} alan başarıyla dolduruldu` : 
        `Successfully filled ${response.count || 0} fields`;
      showNotification(successMessage, true);
    } else {
      const errorMessage = currentSettings.region === 'TR' ? 
        'Form doldurulamadı' : 
        'Failed to fill form';
      showNotification(errorMessage, false);
    }
  } catch (err) {
    console.error('Error filling form:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Form doldurulurken hata oluştu' : 
      'Error filling form';
    showNotification(errorMessage, false);
  }
}

/**
 * Fix validation errors on the current page
 */
async function fixValidation() {
  const isTeslaPage = await checkIfTeslaPage();
  if (!isTeslaPage) {
    const message = currentSettings.region === 'TR' ? 
      'Tesla sayfasında değilsiniz' : 
      'Not on a Tesla page';
    showNotification(message, false);
    return;
  }
  
  try {
    const message = currentSettings.region === 'TR' ? 
      'Doğrulama hataları düzeltiliyor...' : 
      'Fixing validation errors...';
    showNotification(message, true);
    
    const response = await sendMessageToBackground({ action: ACTION_TYPES.FIX_VALIDATION });
    
    if (response) {
      const successMessage = currentSettings.region === 'TR' ? 
        'Doğrulama hataları düzeltildi' : 
        'Validation errors fixed';
      showNotification(successMessage, true);
    } else {
      const errorMessage = currentSettings.region === 'TR' ? 
        'Doğrulama hataları düzeltilemedi' : 
        'Failed to fix validation errors';
      showNotification(errorMessage, false);
    }
  } catch (err) {
    console.error('Error fixing validation:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Doğrulama hataları düzeltilirken hata oluştu' : 
      'Error fixing validation errors';
    showNotification(errorMessage, false);
  }
}

/**
 * Toggle the panel
 */
async function togglePanel() {
  const isTeslaPage = await checkIfTeslaPage();
  if (!isTeslaPage) {
    const message = currentSettings.region === 'TR' ? 
      'Tesla sayfasında değilsiniz' : 
      'Not on a Tesla page';
    showNotification(message, false);
    return;
  }
  
  try {
    const response = await sendMessageToBackground({ action: ACTION_TYPES.TOGGLE_PANEL });
    
    const successMessage = currentSettings.region === 'TR' ? 
      'Panel durumu değiştirildi' : 
      'Panel toggled';
    showNotification(successMessage, true);
  } catch (err) {
    console.error('Error toggling panel:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Panel açılırken hata oluştu' : 
      'Error toggling panel';
    showNotification(errorMessage, false);
  }
}


/**
 * Setup the collapsible sections
 */
function setupCollapsibles() {
  const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
  
  collapsibleHeaders.forEach(header => {
    header.addEventListener('click', () => {
      // Toggle the header's open state
      header.classList.toggle('open');
      
      // Find the content container
      const content = header.nextElementSibling;
      if (content && content.classList.contains('collapsible-content')) {
        content.classList.toggle('open');
      }
    });
  });
}
/**
 * Setup dynamic threshold checking
 */
function setupDynamicThresholdChecking() {
  const priceInput = document.getElementById('price-input');
  
  if (priceInput) {
    console.log('Setting up dynamic threshold checking');
    
    // Create debounced check function
    const debouncedCheck = debounce(async (value) => {
      try {
        if (!value || isNaN(parseInt(value))) return;
        
        // Update button state to show checking
        const checkNowBtn = document.getElementById('check-now-btn');
        if (checkNowBtn) {
          const originalText = checkNowBtn.innerHTML;
          checkNowBtn.innerHTML = `<span>Checking...</span>`;
          checkNowBtn.classList.add('checking');
          
          // Save settings first
          await saveSettings();
          
          // Get the current filters
          const filters = {
            region: currentSettings.region,
            model: document.getElementById('model').value,
            condition: document.getElementById('condition').value,
            priceMax: parseInt(value),
            zip: document.getElementById('zip-input').value,
            paymentType: document.getElementById('payment-type')?.value || 'cash'
          };
          
          // First check if we're on a Tesla inventory page
          const isTeslaPage = await checkIfTeslaInventoryPage();
          
          if (isTeslaPage) {
            try {
              // Try to apply filters directly in the page
              await applyFiltersToActiveTeslaTab(filters);
            } catch (err) {
              console.error('Error applying filters:', err);
              // Don't show notification since this is triggered by typing
            }
          }
          
          // Check inventory regardless (for popup display)
          const response = await sendMessageToBackground({
            action: ACTION_TYPES.CHECK_INVENTORY,
            filters: filters,
            silent: true
          });
          
          // Restore button state
          checkNowBtn.innerHTML = originalText;
          checkNowBtn.classList.remove('checking');
          
          // Update results if available
          if (response && response.success && response.results) {
            updateLastUpdated();
            displayResults(response.results);
          }
        }
      } catch (err) {
        console.error('Error in dynamic threshold check:', err);
        
        // Restore button state
        const checkNowBtn = document.getElementById('check-now-btn');
        if (checkNowBtn) {
          checkNowBtn.innerHTML = 'Check Now';
          checkNowBtn.classList.remove('checking');
        }
      }
    }, 1000);
    
    // Add event listeners for input and blur events
    priceInput.addEventListener('input', (e) => {
      debouncedCheck(e.target.value);
    });
    
    priceInput.addEventListener('blur', (e) => {
      if (typeof debouncedCheck.cancel === 'function') {
        debouncedCheck.cancel();
      }
      
      if (e.target.value && !isNaN(parseInt(e.target.value))) {
        debouncedCheck(e.target.value);
      }
    });
    
    console.log('Dynamic threshold checking set up');
  } else {
    console.warn('Price input not found, dynamic threshold checking disabled');
  }
}

/**
 * Check if the active tab is a Tesla inventory page
 * @returns {Promise<boolean>} Whether we're on a Tesla inventory page
 */
async function checkIfTeslaInventoryPage() {
  try {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs);
      });
    });
    
    if (!tabs || tabs.length === 0) return false;
    
    const tab = tabs[0];
    // Specifically check if it's an inventory page, not just tesla.com
    return tab.url && tab.url.includes('tesla.com') && tab.url.includes('/inventory/');
  } catch (error) {
    console.error('Error checking if Tesla inventory page:', error);
    return false;
  }
}

/**
 * Apply filters directly to the active Tesla tab
 * @param {Object} filters - Filters to apply
 * @returns {Promise<boolean>} Success status
 */
async function applyFiltersToActiveTeslaTab(filters) {
  try {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs);
      });
    });
    
    if (!tabs || tabs.length === 0) return false;
    
    const tab = tabs[0];
    
    // Create a promise with timeout for the message
    return new Promise((resolve) => {
      // Set a timeout to handle non-responsive content scripts
      const timeoutId = setTimeout(() => {
        console.warn('Message response timed out, falling back to URL update');
        applyFiltersFallback(filters);
        resolve(false);
      }, 2000); // 2 second timeout
      
      // Try to send message to content script
      chrome.tabs.sendMessage(
        tab.id, 
        {
          action: 'updateFilters',
          filters: filters
        }, 
        (response) => {
          clearTimeout(timeoutId); // Clear the timeout
          
          if (chrome.runtime.lastError) {
            console.warn('Error communicating with tab:', chrome.runtime.lastError);
            // Fall back to URL update method
            applyFiltersFallback(filters);
            resolve(false);
          } else if (response && response.success) {
            resolve(true);
          } else {
            // If response was received but unsuccessful, try fallback
            applyFiltersFallback(filters);
            resolve(false);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error applying filters to Tesla tab:', error);
    // Fall back to URL update method
    applyFiltersFallback(filters);
    return false;
  }
}

/**
 * Fallback method to apply filters by updating URL
 * @param {Object} filters - Filters to apply
 */
function applyFiltersFallback(filters) {
  try {
    console.log('Using fallback method to apply filters');
    
    // Build a URL with the parameters
    const baseUrl = filters.region === 'TR' ? 
      'https://www.tesla.com/tr_TR' : 
      'https://www.tesla.com';
      
    const url = new URL(`${baseUrl}/inventory/${filters.condition}/${filters.model}`);
    
    // Add query parameters
    url.searchParams.set('arrangeby', 'Price');
    
    if (filters.priceMax && filters.priceMax > 0) {
      url.searchParams.set('price', filters.priceMax);
    }
    
    if (filters.zip) {
      url.searchParams.set('zip', filters.zip);
    }
    
    if (filters.paymentType) {
      url.searchParams.set('PaymentType', filters.paymentType);
    }
    
    // Always set range to 25 miles for better results
    url.searchParams.set('range', '25');
    
    // Update current tab instead of opening a new one
    chrome.tabs.update({ url: url.toString() });
    
    return true;
  } catch (error) {
    console.error('Error in filter fallback:', error);
    return false;
  }
}

/**
 * Update the modified "Open Inventory" button click handler in popup.js
 * to work with both direct filtering and new tab fallback
 */
// Find the existing 'open-tesla-btn' click handler and replace it with this:
document.getElementById('open-tesla-btn').addEventListener('click', async () => {
  try {
    // First save settings
    await saveSettings();
    
    // Check if we're already on a Tesla inventory page
    const isTeslaPage = await checkIfTeslaInventoryPage();
    
    // Get the current filter values
    const filters = {
      region: currentSettings.region,
      model: document.getElementById('model').value,
      condition: document.getElementById('condition').value,
      priceMax: parseInt(document.getElementById('price-input').value) || 
                (currentSettings.region === 'TR' ? 1590000 : 45000),
      zip: document.getElementById('zip-input').value,
      paymentType: document.getElementById('payment-type') ? 
        document.getElementById('payment-type').value : 'cash'
    };
    
    if (isTeslaPage) {
      // If already on a Tesla page, try to apply filters directly
      const success = await applyFiltersToActiveTeslaTab(filters);
      
      if (success) {
        showNotification(currentSettings.region === 'TR' ? 
          'Filtreler uygulandı' : 
          'Filters applied', true);
        return;
      }
    }
    
    // If we're not on a Tesla page or direct filtering failed, 
    // fall back to opening a new tab with the filters in the URL
    const baseUrl = currentSettings.region === 'TR' ? 
      'https://www.tesla.com/tr_TR' : 
      'https://www.tesla.com';
      
    // Build the URL with all parameters
    const url = new URL(`${baseUrl}/inventory/${filters.condition}/${filters.model}`);
    const searchParams = url.searchParams;
    
    // Add common parameters
    searchParams.set('arrangeby', 'Price');
    
    if (filters.priceMax && filters.priceMax > 0) {
      searchParams.set('price', filters.priceMax);
    }
    
    if (filters.zip) {
      searchParams.set('zip', filters.zip);
    }
    
    if (filters.paymentType) {
      searchParams.set('PaymentType', filters.paymentType);
    }
    
    // Always set range to 25 miles for better results
    searchParams.set('range', '25');
    
    // Open the URL
    chrome.tabs.create({ url: url.toString() });
    
  } catch (error) {
    console.error('Error opening Tesla inventory:', error);
    showNotification('Error opening Tesla inventory', false);
  }
});
// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Set up collapsible sections
    setupCollapsibles();

    setupDynamicThresholdChecking();
    
    // Load settings
    await loadSettings();
    
    // Set up region buttons
    const regionButtons = document.querySelectorAll('.region-btn');
    regionButtons.forEach(btn => {
      btn.addEventListener('click', () => changeRegion(btn.dataset.region));
    });
    
    // Monitor toggle button
    document.getElementById('monitor-toggle-btn').addEventListener('click', toggleMonitoring);
    
    // Inventory actions
    document.getElementById('check-now-btn').addEventListener('click', checkInventoryNow);
    document.getElementById('open-tesla-btn').addEventListener('click', openTeslaInventory);
    
    // Form helper actions
    document.getElementById('fill-form-btn').addEventListener('click', fillForm);
    document.getElementById('fix-validation-btn').addEventListener('click', fixValidation);
    document.getElementById('toggle-panel-btn').addEventListener('click', togglePanel);
    
    // Settings button
    document.getElementById('settings-btn').addEventListener('click', openOptions);
    
    // Export CSV button (may not be visible initially)
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', exportToCSV);
    }
    
    // Update button states based on whether we're on a Tesla page
    const isTeslaPage = await checkIfTeslaPage();
    const teslaPageButtons = [
      'fill-form-btn', 
      'fix-validation-btn', 
      'toggle-panel-btn'
    ];
    
    if (!isTeslaPage) {
      // Disable Tesla page specific buttons if not on a Tesla page
      teslaPageButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.disabled = true;
          btn.title = currentSettings.region === 'TR' ? 
            'Tesla sayfasında olmalısınız' : 
            'Must be on a Tesla page';
          btn.style.opacity = '0.6';
          btn.style.cursor = 'not-allowed';
        }
      });
    }
    
    console.log('Popup initialized successfully');
  } catch (err) {
    console.error('Error initializing popup:', err);
    showNotification('Error initializing popup: ' + err.message, false);
  }
});
