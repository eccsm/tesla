// Enhanced Tesla AutoPilot Popup Script
// Fixed version with Turkish support and improved error handling

// State
let isMonitoring = false;
let currentSettings = {
  region: 'US',
  model: 'my',
  condition: 'new',
  priceMax: 45000,
  pollingInterval: 5
};

// Default prices by region
const DEFAULT_PRICES = {
  US: 45000,
  TR: 1500000
};

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

// Update the UI language based on the selected region
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

// Update monitoring UI
function updateMonitoringUI() {
  const monitorStats = document.getElementById('monitor-stats');
  const monitorStatus = monitorStats.querySelector('.status');
  const monitorDetails = document.getElementById('monitor-details');
  const monitorBtn = document.getElementById('monitor-btn');
  
  if (isMonitoring) {
    monitorStats.classList.add('active');
    monitorStatus.classList.remove('inactive');
    monitorStatus.classList.add('active');
    
    if (currentSettings.region === 'TR') {
      monitorStatus.innerHTML = '<span class="locale-text-tr">İzleme: Aktif</span><span class="locale-text-en">Monitoring: Active</span>';
    } else {
      monitorStatus.innerHTML = '<span class="locale-text-en">Monitoring: Active</span><span class="locale-text-tr">İzleme: Aktif</span>';
    }
    
    monitorDetails.style.display = 'block';
    
    if (currentSettings.region === 'TR') {
      monitorBtn.innerHTML = '<span class="locale-text-tr">İzlemeyi Durdur</span><span class="locale-text-en">Stop Monitoring</span>';
    } else {
      monitorBtn.innerHTML = '<span class="locale-text-en">Stop Monitoring</span><span class="locale-text-tr">İzlemeyi Durdur</span>';
    }
    
    monitorBtn.classList.remove('btn-success');
    monitorBtn.classList.add('btn-stop');
  } else {
    monitorStats.classList.remove('active');
    monitorStatus.classList.remove('active');
    monitorStatus.classList.add('inactive');
    
    if (currentSettings.region === 'TR') {
      monitorStatus.innerHTML = '<span class="locale-text-tr">İzleme: Pasif</span><span class="locale-text-en">Monitoring: Inactive</span>';
    } else {
      monitorStatus.innerHTML = '<span class="locale-text-en">Monitoring: Inactive</span><span class="locale-text-tr">İzleme: Pasif</span>';
    }
    
    monitorDetails.style.display = 'none';
    
    if (currentSettings.region === 'TR') {
      monitorBtn.innerHTML = '<span class="locale-text-tr">İzlemeyi Başlat</span><span class="locale-text-en">Start Monitoring</span>';
    } else {
      monitorBtn.innerHTML = '<span class="locale-text-en">Start Monitoring</span><span class="locale-text-tr">İzlemeyi Başlat</span>';
    }
    
    monitorBtn.classList.remove('btn-stop');
    monitorBtn.classList.add('btn-success');
  }
  
  // Update details text
  document.getElementById('poll-interval').textContent = currentSettings.pollingInterval;
  document.getElementById('monitor-model').textContent = getModelName(currentSettings.model);
  
  // Format currency by region
  if (currentSettings.region === 'TR') {
    document.getElementById('price-threshold').textContent = '₺' + currentSettings.priceMax.toLocaleString('tr-TR');
  } else {
    document.getElementById('price-threshold').textContent = '$' + currentSettings.priceMax.toLocaleString('en-US');
  }
}

// Get full model name
function getModelName(modelCode) {
  const models = {
    'm3': 'Model 3',
    'my': 'Model Y',
    'ms': 'Model S',
    'mx': 'Model X'
  };
  return models[modelCode] || modelCode.toUpperCase();
}

// Update the last updated timestamp
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

// Load settings from storage
async function loadSettings() {
  try {
    const data = await new Promise((resolve) => {
      chrome.storage.sync.get([
        'region', 'model', 'condition', 'priceFloor', 'pollingInterval', 'isMonitoring', 
        'lastInventoryCheck', 'monitoringFilters', 'monitoringInterval'
      ], (result) => {
        if (chrome.runtime.lastError) {
          console.error("Storage error:", chrome.runtime.lastError);
          resolve({});
        } else {
          resolve(result);
        }
      });
    });
    
    // Update current settings
    currentSettings.region = data.region || 'US';
    currentSettings.model = data.model || 'my';
    currentSettings.condition = data.condition || 'new';
    
    // Set default price based on region
    const defaultPrice = DEFAULT_PRICES[currentSettings.region] || 45000;
    currentSettings.priceMax = parseInt(data.priceFloor) || defaultPrice;
    currentSettings.pollingInterval = data.pollingInterval || 5;
    
    // Update UI language
    updateUILanguage(currentSettings.region);
    
    // Update UI controls
    document.getElementById('model').value = currentSettings.model;
    document.getElementById('condition').value = currentSettings.condition;
    document.getElementById('price-input').value = currentSettings.priceMax;
    document.getElementById('poll-interval-input').value = currentSettings.pollingInterval;
    
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

// Save settings to storage
async function saveSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({
      region: currentSettings.region,
      model: currentSettings.model,
      condition: currentSettings.condition,
      priceFloor: currentSettings.priceMax,
      pollingInterval: currentSettings.pollingInterval
    }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Toggle monitoring
async function toggleMonitoring() {
  try {
    if (isMonitoring) {
      // Stop monitoring
      const message = currentSettings.region === 'TR' ? 
        'İzleme durduruluyor...' : 
        'Stopping monitoring...';
      showNotification(message, true);
      
      const response = await sendMessage({ action: 'stopMonitoring' });
      
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
      
      // Get current values
      const model = document.getElementById('model').value;
      const condition = document.getElementById('condition').value;
      const priceMax = parseInt(document.getElementById('price-input').value) || DEFAULT_PRICES[currentSettings.region];
      const pollingInterval = parseInt(document.getElementById('poll-interval-input').value) || 5;
      
      // Update current settings
      currentSettings.model = model;
      currentSettings.condition = condition;
      currentSettings.priceMax = priceMax;
      currentSettings.pollingInterval = pollingInterval;
      
      // Save settings first
      await saveSettings();
      
      // Get filters from storage
      const storageData = await new Promise((resolve) => {
        chrome.storage.sync.get(['trimLevels', 'autopilot', 'zip'], resolve);
      });
      
      // Build filters
      const filters = {
        region: currentSettings.region,
        model: model,
        condition: condition,
        priceMax: priceMax,
        trimLevels: storageData.trimLevels || null,
        autopilot: storageData.autopilot || null,
        zip: storageData.zip || null
      };
      
      // Send start monitoring message
      const response = await sendMessage({
        action: 'startMonitoring',
        filters: filters,
        interval: pollingInterval
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

// Check inventory now
async function checkInventoryNow() {
  try {
    const message = currentSettings.region === 'TR' ? 
      'Tesla envanteri kontrol ediliyor...' : 
      'Checking Tesla inventory...';
    showNotification(message, true);
    
    // Get current values
    const model = document.getElementById('model').value;
    const condition = document.getElementById('condition').value;
    const priceMax = parseInt(document.getElementById('price-input').value) || DEFAULT_PRICES[currentSettings.region];
    
    // Update current settings
    currentSettings.model = model;
    currentSettings.condition = condition;
    currentSettings.priceMax = priceMax;
    
    // Save settings
    await saveSettings();
    
    // Get filters from storage
    const storageData = await new Promise((resolve) => {
      chrome.storage.sync.get(['trimLevels', 'autopilot', 'zip'], resolve);
    });
    
    // Build filters
    const filters = {
      region: currentSettings.region,
      model: model,
      condition: condition,
      priceMax: priceMax,
      trimLevels: storageData.trimLevels || null,
      autopilot: storageData.autopilot || null,
      zip: storageData.zip || null
    };
    
    // Send check inventory message
    const response = await sendMessage({
      action: 'checkInventory',
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
      } else {
        const emptyMessage = currentSettings.region === 'TR' ? 
          'Araç bulunamadı' : 
          'No matching vehicles found';
        showNotification(emptyMessage, true);
      }
    } else {
      const errorMessage = currentSettings.region === 'TR' ? 
        'Envanter kontrol edilemedi' : 
        'Failed to check inventory';
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

// Helper function to send messages to background script with error handling
async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      console.error("Send message error:", err);
      reject(err);
    }
  });
}

// Export to CSV
async function exportToCSV() {
  try {
    const message = currentSettings.region === 'TR' ? 
      'CSV dışa aktarılıyor...' : 
      'Exporting to CSV...';
    showNotification(message, true);
    
    const response = await sendMessage({ action: 'downloadCSV' });
    
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
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Hata: ' + err.message : 
      'Error: ' + err.message;
    showNotification(errorMessage, false);
  }
}

// Open Tesla inventory page
async function openTeslaInventory() {
  try {
    // Get current values
    const model = document.getElementById('model').value;
    const condition = document.getElementById('condition').value;
    
    // Update current settings
    currentSettings.model = model;
    currentSettings.condition = condition;
    
    // Save settings
    await saveSettings();
    
    // Determine base URL
    let baseUrl = 'https://www.tesla.com';
    if (currentSettings.region === 'TR') {
      baseUrl = 'https://www.tesla.com/tr_TR';
    }
    
    // Build URL
    const url = `${baseUrl}/inventory/${condition}/${model}`;
    
    // Open URL in new tab
    chrome.tabs.create({ url });
  } catch (err) {
    console.error('Error opening Tesla inventory:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Tesla envanteri açılırken hata oluştu' : 
      'Error opening Tesla inventory';
    showNotification(errorMessage, false);
  }
}

// Open options page
function openOptions() {
  chrome.runtime.openOptionsPage();
}

// Change region
async function changeRegion(region) {
  if (region === currentSettings.region) return;
  
  try {
    // Update region
    currentSettings.region = region;
    
    // Update UI language
    updateUILanguage(region);
    
    // Update default price
    const defaultPrice = DEFAULT_PRICES[region] || 45000;
    if (!document.getElementById('price-input').value) {
      currentSettings.priceMax = defaultPrice;
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

// Add this function to popup/popup.js
// Add it near the fillForm, fixValidation, and togglePanel functions

// Fill ZIP code dialog
async function fillZipDialog() {
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
      'ZIP kodu doldurulmaya çalışılıyor...' : 
      'Filling ZIP code...';
    showNotification(message, true);
    
    // Send message to content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'fillZipDialog'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            const errorMessage = currentSettings.region === 'TR' ?
              'Mesaj gönderilirken hata oluştu' :
              'Error sending message';
            showNotification(errorMessage, false);
          } else {
            console.log('Response:', response);
            const successMessage = currentSettings.region === 'TR' ?
              'ZIP kodu doldurma talimatı gönderildi' :
              'ZIP code fill attempted';
            showNotification(successMessage, true);
          }
        });
      } else {
        const errorMessage = currentSettings.region === 'TR' ?
          'Aktif sekme bulunamadı' :
          'No active tab found';
        showNotification(errorMessage, false);
      }
    });
  } catch (err) {
    console.error('Error filling ZIP dialog:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'ZIP kodu doldurulurken hata oluştu' : 
      'Error filling ZIP code dialog';
    showNotification(errorMessage, false);
  }
}

// Then add this to the DOMContentLoaded event listener:
// Add this right after adding the togglePanel event listener



// Fill the form on the current page
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
    
    // Send message to background script
    const response = await sendMessage({ action: 'fillForm' });
    
    if (response && response.status === 'Form filled') {
      const successMessage = currentSettings.region === 'TR' ? 
        `${response.count} alan başarıyla dolduruldu` : 
        `Successfully filled ${response.count} fields`;
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

// Fix validation errors on the current page
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
    
    // Send message to background script
    await sendMessage({ action: 'fixValidation' });
    
    const successMessage = currentSettings.region === 'TR' ? 
      'Doğrulama hataları düzeltildi' : 
      'Validation errors fixed';
    showNotification(successMessage, true);
  } catch (err) {
    console.error('Error fixing validation:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Doğrulama hataları düzeltilirken hata oluştu' : 
      'Error fixing validation';
    showNotification(errorMessage, false);
  }
}

// Toggle the panel
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
    // Send message to background script
    await sendMessage({ action: 'togglePanel' });
  } catch (err) {
    console.error('Error toggling panel:', err);
    
    const errorMessage = currentSettings.region === 'TR' ? 
      'Panel açılırken hata oluştu' : 
      'Error toggling panel';
    showNotification(errorMessage, false);
  }
}

// Set up tabs
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Get tab ID
      const tabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId + '-tab') {
          content.classList.add('active');
        }
      });
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Setup tabs
    setupTabs();
    
    // Load settings
    await loadSettings();
    
    // Set up region buttons
    const regionButtons = document.querySelectorAll('.region-btn');
    regionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        changeRegion(btn.dataset.region);
      });
    });
    
    // Set up event handlers
    document.getElementById('monitor-btn').addEventListener('click', toggleMonitoring);
    document.getElementById('check-now-btn').addEventListener('click', checkInventoryNow);
    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);
    document.getElementById('open-tesla-btn').addEventListener('click', openTeslaInventory);
    document.getElementById('settings-btn').addEventListener('click', openOptions);
    
    // Form tab buttons
    document.getElementById('fill-form-btn').addEventListener('click', fillForm);
    document.getElementById('fix-validation-btn').addEventListener('click', fixValidation);
    document.getElementById('toggle-panel-btn').addEventListener('click', togglePanel);
    document.getElementById('fill-zip-btn').addEventListener('click', fillZipDialog);
    
    // Update button states based on whether we're on a Tesla page
    checkIfTeslaPage().then(isTeslaPage => {
      const fillFormBtn = document.getElementById('fill-form-btn');
      const fixValidationBtn = document.getElementById('fix-validation-btn');
      const togglePanelBtn = document.getElementById('toggle-panel-btn');
      
      if (!isTeslaPage) {
        fillFormBtn.disabled = true;
        fixValidationBtn.disabled = true;
        togglePanelBtn.disabled = true;
        
        fillFormBtn.title = currentSettings.region === 'TR' ? 
          'Tesla sayfasında olmalısınız' : 
          'Must be on a Tesla page';
        fixValidationBtn.title = currentSettings.region === 'TR' ? 
          'Tesla sayfasında olmalısınız' : 
          'Must be on a Tesla page';
        togglePanelBtn.title = currentSettings.region === 'TR' ? 
          'Tesla sayfasında olmalısınız' : 
          'Must be on a Tesla page';
      }
    });
  } catch (err) {
    console.error('Error initializing popup:', err);
    showNotification('Error initializing extension', false);
  }

  // Add this to popup/popup.js
// Add this at the end of your document.addEventListener('DOMContentLoaded', async () => {...}) function

// Set up the ZIP code setting functionality
function setupZipCodeSetting() {
  const zipInput = document.getElementById('zip-code-input');
  const setZipBtn = document.getElementById('set-zip-btn');
  
  if (!zipInput || !setZipBtn) return;
  
  // Pre-fill with any existing ZIP code
  chrome.storage.sync.get(['zip'], (data) => {
    if (data && data.zip) {
      zipInput.value = data.zip;
      zipInput.placeholder = `Current: ${data.zip}`;
    }
  });
  
  // Set ZIP code button handler
  setZipBtn.addEventListener('click', () => {
    const zipCode = zipInput.value.trim();
    
    if (!zipCode) {
      const message = currentSettings.region === 'TR' ? 
        'Lütfen bir ZIP kodu girin' : 
        'Please enter a ZIP code';
      showNotification(message, false);
      return;
    }
    
    // Save to storage
    chrome.storage.sync.set({ zip: zipCode }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving ZIP code:', chrome.runtime.lastError);
        const errorMessage = currentSettings.region === 'TR' ? 
          'ZIP kodu kaydedilirken hata oluştu' : 
          'Error saving ZIP code';
        showNotification(errorMessage, false);
      } else {
        const successMessage = currentSettings.region === 'TR' ? 
          `ZIP kodu kaydedildi: ${zipCode}` : 
          `ZIP code saved: ${zipCode}`;
        showNotification(successMessage, true);
        
        // Also try to apply the ZIP code to any active tab
        applyZipCodeToActiveTab(zipCode);
      }
    });
  });
  
  // Enter key handler
  zipInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      setZipBtn.click();
      }
      });
    }

  // Apply ZIP code to the active tab
  function applyZipCodeToActiveTab(zipCode) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tab = tabs[0];
        
        // Check if the tab is a Tesla page
        if (tab.url && tab.url.includes('tesla.com')) {
          // Send message to content script
          chrome.tabs.sendMessage(tab.id, { 
            action: 'setZipCode',
            zipCode: zipCode
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message to tab:', chrome.runtime.lastError);
            } else if (response && response.success) {
              console.log('ZIP code applied to active tab:', response);
            }
          });
        }
      }
    });
  }

  // Call this setup function at the end of your DOMContentLoaded event
  setupZipCodeSetting();
});