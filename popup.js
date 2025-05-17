// Popup script for Tesla Inventory Monitor

// --- Notification Utility ---
const notificationElement = document.getElementById('notification');

// --- Global Variables ---
// DOM Elements
let lastUpdatedElement;

// Region
let regionButtons;
let currentRegion = 'US'; // Default region

// Monitoring Status
let monitorStatusIndicator;
let monitorStatusTextElement;
let monitorDetailsElement;
let lastCheckTimeElement;
let monitorModelElement;
let priceThresholdElement;
let monitorToggleButton;

// Search Settings Card
let modelSelect;
let conditionSelect;
let priceInput;
let advancedToggle;
let advancedContent;
let pollIntervalInput;
let zipInput;
let checkNowButton;
let openTeslaButton;

// Form Helper Card
let fillFormButton;
let settingsButton;

// Results Card
let resultsCard;
let resultsContent;
let exportCsvButton;

function showNotification(message, type) {
    notificationElement.textContent = message;
    notificationElement.className = 'notification-banner'; // Reset to a base class
    // Apply appropriate CSS class based on type
    if (type === 'success') {
        notificationElement.classList.add('success');
    } else if (type === 'error') {
        notificationElement.classList.add('error');
    } else if (type === 'warning') {
        notificationElement.style.backgroundColor = '#F59E0B'; // Amber color for warnings
        notificationElement.classList.add('warning');
    }
    notificationElement.style.display = 'block';
    // For errors and warnings, show longer
    const duration = (type === 'error' || type === 'warning') ? 5000 : 3000;
    setTimeout(() => {
        // Fade out effect
        notificationElement.style.opacity = '0';
        setTimeout(() => {
            notificationElement.style.display = 'none';
            notificationElement.style.opacity = '1';
        }, 500); // Wait for fade out to complete
    }, duration);
}

function updateMonitorStatusUI(isActive, lastCheck, model, price) {
    // Update the monitor status UI based on current monitoring state
    if (monitorStatusIndicator && monitorStatusTextElement) {
        if (isActive) {
            monitorStatusIndicator.classList.add('active');
            monitorStatusIndicator.classList.remove('inactive');
            monitorStatusTextElement.textContent = 'Active';
            monitorToggleButton.textContent = 'Stop Monitoring';
            monitorToggleButton.classList.add('btn-stop');
            monitorToggleButton.classList.remove('btn-success');
            
            // Add extra feedback about monitoring being active
            if (monitorDetailsElement) {
                monitorDetailsElement.innerHTML = `<strong>Status:</strong> Actively monitoring for ${model ? model.toUpperCase() : 'selected model'} in ${currentRegion}.<br>
                <span style="font-size: 12px; color: #059669;">✓ Background checks running</span>`;
            }
        } else {
            monitorStatusIndicator.classList.remove('active');
            monitorStatusIndicator.classList.add('inactive');
            monitorStatusTextElement.textContent = 'Inactive';
            monitorToggleButton.textContent = 'Start Monitoring';
            monitorToggleButton.classList.remove('btn-stop');
            monitorToggleButton.classList.add('btn-success');
            
            // Update inactive status with clearer message
            if (monitorDetailsElement) {
                monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring inactive.<br>
                <span style="font-size: 12px; color: #6B7280;">Click 'Start Monitoring' to begin</span>`;
            }
        }

        if (lastCheck) {
            const date = new Date(lastCheck);
            const timeString = date.toLocaleTimeString();
            const dateString = date.toLocaleDateString();
            lastCheckTimeElement.textContent = `${timeString} on ${dateString}`;
            
            // Show how long ago the check happened
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffSecs = Math.floor((diffMs % 60000) / 1000);
            
            if (diffMins > 0) {
                lastCheckTimeElement.title = `${diffMins} min ${diffSecs} sec ago`;
            } else {
                lastCheckTimeElement.title = `${diffSecs} seconds ago`;
            }
        }

        if (model) {
            monitorModelElement.textContent = model.toUpperCase();
            
            // Indicate region specific formatting
            if (currentRegion === 'TR') {
                if (price) {
                    // Format for Turkish Lira
                    const priceNum = parseInt(price.replace(/[^0-9]/g, ''), 10);
                    priceThresholdElement.textContent = new Intl.NumberFormat('tr-TR', { 
                        style: 'currency', 
                        currency: 'TRY', 
                        minimumFractionDigits: 0 
                    }).format(priceNum);
                }
            } else {
                // Format for USD
                if (price) priceThresholdElement.textContent = price;
            }
        }
    }
}

function loadUISettings() {
    chrome.storage.local.get(['searchFilters', 'monitoringSettings', 'preferredRegion', 'lastUpdatedTimestamp'], (data) => {
        // Set region first, as it might influence defaults or display (though not strictly in this version yet)
        if (data.preferredRegion) {
            // Update currentRegion global but avoid calling setRegion again to prevent loops
            currentRegion = data.preferredRegion;
            document.body.classList.remove('locale-us', 'locale-tr');
            document.body.classList.add(`locale-${currentRegion.toLowerCase()}`);
            regionButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.region === currentRegion);
            });
        } else {
            // If no preferred region, default to US (already set in variable initialization)
            document.body.classList.add('locale-us');
        }

        // Populate search filters
        const filters = data.searchFilters || {};
        if (filters.model) modelSelect.value = filters.model;
        if (filters.condition) conditionSelect.value = filters.condition;
        if (filters.maxPrice) priceInput.value = filters.maxPrice;
        if (filters.zip) zipInput.value = filters.zip;

        const monitoring = data.monitoringSettings || {};
        pollIntervalInput.value = monitoring.pollInterval || '5';
        if(monitoring.isActive) {
            updateMonitorStatusUI(true, monitoring.lastCheck, monitoring.model, monitoring.priceThreshold);
        } else {
            updateMonitorStatusUI(false);
        }

        if (data.lastUpdatedTimestamp) {
            lastUpdatedElement.textContent = `Last checked: ${new Date(data.lastUpdatedTimestamp).toLocaleString()}`;
        } else {
            lastUpdatedElement.textContent = '';
        }
    });
}

function saveSearchFiltersFromUI() {
    chrome.storage.local.set({
        searchFilters: {
            model: modelSelect.value,
            condition: conditionSelect.value,
            maxPrice: priceInput.value,
            zip: zipInput.value
        }
    });
}

function savePollIntervalFromUI() {
    chrome.storage.local.get(['monitoringSettings'], (data) => {
        const monitoring = data.monitoringSettings || {};
        monitoring.pollInterval = parseInt(pollIntervalInput.value, 10);
        chrome.storage.local.set({ monitoringSettings: monitoring });
    });
}

function setRegion(newRegion) {
    currentRegion = newRegion;
    // Update UI
    document.body.classList.remove('locale-us', 'locale-tr');
    document.body.classList.add(`locale-${currentRegion.toLowerCase()}`);
    regionButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.region === currentRegion);
    });
    
    // Save preference
    chrome.storage.local.set({ preferredRegion: currentRegion });
}

// --- Core Logic ---
function performInventoryCheck() {
    resultsContent.innerHTML = '<div>Loading results...</div>';
    resultsCard.style.display = 'block';
    showNotification('Checking inventory...', '');

    const filters = {
        model: modelSelect.value,
        condition: conditionSelect.value,
        maxPrice: priceInput.value,
        zip: zipInput.value,
        region: currentRegion
    };

    chrome.runtime.sendMessage({ action: 'fetchInventory', filters }, (response) => {
        if (chrome.runtime.lastError) {
            showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
            resultsContent.innerHTML = `<div>Error communicating with the background script.<br><code>${chrome.runtime.lastError.message}</code></div>`;
            return;
        }
        
        if (response && response.success) {
            // Clear the existing results
            resultsContent.innerHTML = '';
            
            if (response.vehicles && response.vehicles.length > 0) {
                // Display each vehicle
                response.vehicles.forEach(vehicle => {
                    const resultItem = document.createElement('div');
                    resultItem.className = 'result-item';
                    resultItem.innerHTML = `
                        <strong>${vehicle.year} ${vehicle.model} ${vehicle.trim}</strong><br>
                        <span>Price: ${vehicle.price}</span><br>
                        <span>Location: ${vehicle.location}</span><br>
                        <a href="${vehicle.url}" target="_blank">View on Tesla</a>
                    `;
                    resultsContent.appendChild(resultItem);
                });
                
                showNotification(`Found ${response.vehicles.length} vehicles!`, 'success');
            } else {
                resultsContent.innerHTML = '<div>No vehicles found matching your criteria.</div>';
                showNotification('No vehicles found.', 'warning');
            }
            
            const now = new Date().toISOString();
            lastUpdatedElement.textContent = `Last checked: ${new Date(now).toLocaleString()}`;
            chrome.storage.local.set({ lastUpdatedTimestamp: now });
        } else if (response && response.error) {
            resultsContent.innerHTML = `<div>Error: ${response.error}</div>`;
            showNotification('Error: ' + response.error, 'error');
        } else {
            resultsContent.innerHTML = '<div>Unexpected response from server.</div>';
            showNotification('Unexpected error during check.', 'error');
        }
    });
}

function startMonitoring() {
    // Disable button during processing
    monitorToggleButton.disabled = true;
    
    // Get current settings
    const model = modelSelect.value;
    const condition = conditionSelect.value;
    const maxPrice = priceInput.value;
    const zip = zipInput.value;
    const pollInterval = parseInt(pollIntervalInput.value, 10); // Minutes
    
    if (!maxPrice || isNaN(parseInt(maxPrice, 10))) {
        showNotification('Please enter a valid maximum price to monitor.', 'error');
        monitorToggleButton.disabled = false;
        return;
    }
    
    const monitoringSettings = {
        isActive: true,
        pollInterval: pollInterval, // Minutes
        model: model,
        condition: condition,
        maxPrice: maxPrice,
        zip: zip,
        region: currentRegion,
        lastCheck: new Date().toISOString()
    };
    
    // Update UI to show that we're initiating monitoring
    if (monitorDetailsElement) {
        monitorDetailsElement.innerHTML = `<strong>Status:</strong> Initiating monitoring...<br>
        <span style="font-size: 12px; color: #3B82F6;">Setting up background checks</span>`;
    }
    
    // Before sending any messages, add a flag in storage to indicate we're trying to mitigate cache errors
    const requestId = Date.now().toString() + Math.random().toString().slice(2, 8);
    
    // Save monitoring settings to storage before sending message
    // This ensures settings are saved even if message response fails
    chrome.storage.local.set({ 
        monitoringSettings, 
        monitorStartTime: Date.now(),
        nextCheckTime: Date.now() + (pollInterval * 60 * 1000),
        lastOperation: {
            action: 'startMonitoring',
            timestamp: Date.now(),
            requestId: requestId,
            status: 'pending'
        }
    }, () => {
        // Now send message to background script to start monitoring
        try {
            chrome.runtime.sendMessage({ 
                action: 'startMonitoring', 
                settings: monitoringSettings,
                requestId: requestId
            }, (response) => {
                monitorToggleButton.disabled = false;
                try {
                    if (chrome.runtime.lastError) {
                        throw new Error(chrome.runtime.lastError.message);
                    }
                    
                    if (!response) {
                        throw new Error('No response from background script');
                    }
                    
                    if (response.error) {
                        throw new Error(response.error);
                    }
                    
                    if (response.success) {
                        showNotification('Monitoring started successfully!', 'success');
                        updateMonitorStatusUI(true, monitoringSettings.lastCheck, model, maxPrice);
                        
                        // Log the start action
                        chrome.storage.local.get(['monitoringLog'], (data) => {
                            const log = data.monitoringLog || [];
                            const logEntry = {
                                timestamp: new Date().toISOString(),
                                action: 'start',
                                settings: {
                                    model: model,
                                    condition: condition,
                                    maxPrice: maxPrice,
                                    region: currentRegion,
                                    pollInterval: pollInterval
                                }
                            };
                            
                            log.push(logEntry);
                            // Keep log size reasonable
                            if (log.length > 100) log.shift();
                            chrome.storage.local.set({ monitoringLog: log });
                        });
                    } else {
                        throw new Error('Unknown error starting monitoring');
                    }
                } catch (err) {
                    console.error("Exception handling startMonitoring response:", err);
                    showNotification(`Error starting monitoring: ${err.message}`, 'error');
                    chrome.storage.local.set({ 
                        monitoringSettings: { isActive: false },
                        lastOperation: {
                            action: 'startMonitoring',
                            timestamp: Date.now(),
                            requestId: requestId,
                            status: 'error',
                            error: err.message
                        }
                    });
                    updateMonitorStatusUI(false);
                }
            });
        } catch (err) {
            monitorToggleButton.disabled = false;
            console.error("Exception sending startMonitoring message:", err);
            showNotification(`Communication error: ${err.message}`, 'error');
            chrome.storage.local.set({ 
                monitoringSettings: { isActive: false },
                lastOperation: {
                    action: 'startMonitoring',
                    timestamp: Date.now(),
                    requestId: requestId,
                    status: 'error',
                    error: err.message
                }
            });
            updateMonitorStatusUI(false);
        }
    });
}

function stopMonitoring() {
    // Update UI to show that we're stopping monitoring
    if (monitorDetailsElement) {
        monitorDetailsElement.innerHTML = `<strong>Status:</strong> Stopping monitoring...<br>
        <span style="font-size: 12px; color: #3B82F6;">Cleaning up background checks</span>`;
    }
    
    // Preemptively update state in storage to prevent orphaned monitoring state
    chrome.storage.local.get('monitoringSettings', (data) => {
        const currentMonitoring = data.monitoringSettings || {};
        chrome.storage.local.set({ 
            monitoringSettings: { 
                ...currentMonitoring,
                isActive: false
            },
            lastOperation: {
                action: 'stopMonitoring',
                timestamp: Date.now(),
                status: 'pending'
            }
        }, () => {
            // Now send message to background
            try {
                chrome.runtime.sendMessage({ action: 'stopMonitoring' }, (response) => {
                    try {
                        if (chrome.runtime.lastError) {
                            throw new Error(chrome.runtime.lastError.message);
                        }
                        
                        if (response && response.success) {
                            showNotification('Monitoring stopped successfully.', 'success');
                            updateMonitorStatusUI(false);
                            
                            // Log the stop action
                            chrome.storage.local.get(['monitoringLog'], (data) => {
                                const log = data.monitoringLog || [];
                                log.push({
                                    timestamp: new Date().toISOString(),
                                    action: 'stop'
                                });
                                if (log.length > 100) log.shift();
                                chrome.storage.local.set({ monitoringLog: log });
                            });
                        } else {
                            // Something went wrong with the response
                            showNotification('Error stopping monitoring: ' + 
                                (response && response.error ? response.error : 'Unknown error'), 'warning');
                            
                            // Still update UI to inactive since we already set storage
                            updateMonitorStatusUI(false);
                            if (monitorDetailsElement) {
                                monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring inactive.<br>
                                <span style="font-size: 12px; color: #F59E0B;">Background error: ${response ? response.error : 'Unknown'}</span>`;
                            }
                        }
                    } catch (err) {
                        console.error("Exception handling stopMonitoring response:", err);
                        showNotification('Monitoring stopped but had communication errors.', 'warning');
                        updateMonitorStatusUI(false);
                        if (monitorDetailsElement) {
                            monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring inactive.<br>
                            <span style="font-size: 12px; color: #F59E0B;">Error during communication: ${err.message}</span>`;
                        }
                    }
                });
            } catch (err) {
                console.error("Exception stopping monitoring:", err);
                showNotification('Monitoring stopped but had communication errors.', 'warning');
                updateMonitorStatusUI(false);
                if (monitorDetailsElement) {
                    monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring inactive.<br>
                    <span style="font-size: 12px; color: #F59E0B;">Error during communication: ${err.message}</span>`;
                }
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM Elements
    lastUpdatedElement = document.getElementById('lastUpdated');

    // Region
    regionButtons = document.querySelectorAll('.region-btn');

    // Monitoring Status
    monitorStatusIndicator = document.querySelector('#monitor-status .status-indicator');
    monitorStatusTextElement = document.querySelector('#monitor-status .status-text');
    monitorDetailsElement = document.getElementById('monitor-details');
    lastCheckTimeElement = document.getElementById('last-check-time');
    monitorModelElement = document.getElementById('monitor-model');
    priceThresholdElement = document.getElementById('price-threshold');
    monitorToggleButton = document.getElementById('monitor-toggle-btn');

    // Search Settings Card
    modelSelect = document.getElementById('model');
    conditionSelect = document.getElementById('condition');
    priceInput = document.getElementById('price-input');
    advancedToggle = document.getElementById('advanced-toggle');
    advancedContent = document.getElementById('advanced-content');
    pollIntervalInput = document.getElementById('poll-interval-input');
    zipInput = document.getElementById('zip-input');
    checkNowButton = document.getElementById('check-now-btn');
    openTeslaButton = document.getElementById('open-tesla-btn');

    // Form Helper Card
    fillFormButton = document.getElementById('fill-form-btn');
    settingsButton = document.getElementById('settings-btn');

    // Results Card
    resultsCard = document.getElementById('results-card');
    resultsContent = document.getElementById('results-content');
    exportCsvButton = document.getElementById('export-csv-btn');

    // Begin UI initialization

    // --- Settings Save/Load ---
    function loadUISettings() {
        chrome.storage.local.get(['searchFilters', 'monitoringSettings', 'preferredRegion', 'lastUpdatedTimestamp'], (data) => {
            // Set region first, as it might influence defaults or display (though not strictly in this version yet)
            if (data.preferredRegion) {
                // Update currentRegion global but avoid calling setRegion again to prevent loops
                currentRegion = data.preferredRegion;
                document.body.classList.remove('locale-us', 'locale-tr');
                document.body.classList.add(`locale-${currentRegion.toLowerCase()}`);
                regionButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.region === currentRegion);
                });
            } else {
                 // If no preferredRegion, initialize with default and save it
                currentRegion = 'US';
                document.body.classList.remove('locale-us', 'locale-tr');
                document.body.classList.add(`locale-${currentRegion.toLowerCase()}`);
                regionButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.region === currentRegion);
                });
                chrome.storage.local.set({ preferredRegion: currentRegion });
            }

            const filters = data.searchFilters || {};
            modelSelect.value = filters.model || 'my';
            conditionSelect.value = filters.condition || 'new';
            priceInput.value = filters.maxPrice || '';
            zipInput.value = filters.zip || '';

            const monitoring = data.monitoringSettings || {};
            pollIntervalInput.value = monitoring.pollInterval || '5';
            if(monitoring.isActive) {
                updateMonitorStatusUI(true, monitoring.lastCheck, monitoring.model, monitoring.priceThreshold);
            } else {
                updateMonitorStatusUI(false);
            }

            if (data.lastUpdatedTimestamp) {
                lastUpdatedElement.textContent = `Last checked: ${new Date(data.lastUpdatedTimestamp).toLocaleString()}`;
            } else {
                lastUpdatedElement.textContent = '';
            }
        });
    }

    function saveSearchFiltersFromUI() {
        const model = modelSelect.value;
        const condition = conditionSelect.value;
        const maxPrice = priceInput.value.trim();
        const zip = zipInput.value.trim();

        const filters = {
            model: model,
            condition: condition,
            maxPrice: maxPrice, // Stored as string, parsed in content.js/background
            zip: zip,
            region: currentRegion // Also save region with filters for context
        };

        // Save to local storage
        chrome.storage.local.set({ searchFilters: filters }, () => {
            console.log('Search filters saved to storage:', filters);
            // Feedback can be given by the calling event listener if needed.
        });
        // This function NO LONGER sends messages. Callers will do that.
    }

    function savePollIntervalFromUI() {
        chrome.storage.local.get('monitoringSettings', (data) => {
            const currentMonitoring = data.monitoringSettings || {};
            chrome.storage.local.set({
                monitoringSettings: {
                    ...currentMonitoring,
                    pollInterval: pollIntervalInput.value
                }
            }, () => {
                console.log('Poll interval saved:', pollIntervalInput.value);
            });
        });
    }
    
    function setRegion(newRegion) {
        // Gather current UI state directly to save before any UI refresh
        const currentSearchFiltersState = {
            model: modelSelect.value,
            condition: conditionSelect.value,
            maxPrice: priceInput.value, 
            zip: zipInput.value,
            region: newRegion // Critically, set the new region in the object to be saved
        };
        const currentPollIntervalState = pollIntervalInput.value;

        // Update storage with current UI state and the new region preference
        chrome.storage.local.get('monitoringSettings', (data) => {
            const currentMonitoring = data.monitoringSettings || {};
            chrome.storage.local.set({
                searchFilters: currentSearchFiltersState,
                preferredRegion: newRegion,
                monitoringSettings: { ...currentMonitoring, pollInterval: currentPollIntervalState }
            }, () => {
                // AFTER saving, update currentRegion global and UI for region display
                currentRegion = newRegion;
                document.body.classList.remove('locale-us', 'locale-tr');
                document.body.classList.add(`locale-${newRegion.toLowerCase()}`);
                regionButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.region === newRegion);
                });
                // Then, reload all UI settings. This will reflect the just-saved state.
                // If the new region had different default values (not implemented here), this is where they'd apply.
                loadUISettings(); 
            });
        });
    }

    // --- Event Listeners ---
    regionButtons.forEach(button => {
        button.addEventListener('click', () => {
            setRegion(button.dataset.region);
        });
    });

    advancedToggle.addEventListener('click', () => {
        advancedContent.classList.toggle('open');
        advancedToggle.classList.toggle('open'); // For arrow icon
    });

    checkNowButton.addEventListener('click', performInventoryCheck);

    openTeslaButton.addEventListener('click', () => {
        const model = modelSelect.value;
        const condition = conditionSelect.value;
        const zip = zipInput.value.trim();

        // Build the URL based on region
        let url;
        if (currentRegion === 'US') {
            url = `https://www.tesla.com/en_us/inventory/${condition}/${model}`;
        } else if (currentRegion === 'TR') {
            // Fixed capitalization for Turkey URL (tr_TR instead of tr_tr)
            url = `https://www.tesla.com/tr_TR/inventory/${condition}/${model}`;
        } else {
            url = `https://www.tesla.com/inventory/${condition}/${model}`;
        }

        url += '?arrangeby=Price&order=asc';

        if (zip && zip.trim() !== '') {
            url += `&zip=${zip.trim()}`;
            if (currentRegion === 'US') {
                url += '&range=200';
            } else if (currentRegion === 'TR') {
                url += '&range=100';
            }
        }

        // Log the navigation action for debugging
        console.log(`Navigating to Tesla inventory URL: ${url}`);
        
        chrome.tabs.create({ url: url });
        showNotification(`Opening Tesla inventory for ${model.toUpperCase()} (${condition}, ${currentRegion})...`, '');
        
        // Save this action to history
        const actionLog = {
            timestamp: new Date().toISOString(),
            action: 'open_inventory',
            region: currentRegion,
            model: model,
            condition: condition,
            url: url
        };
        
        chrome.storage.local.get(['actionHistory'], (result) => {
            const history = result.actionHistory || [];
            history.push(actionLog);
            // Keep only the last 50 actions
            if (history.length > 50) history.shift();
            chrome.storage.local.set({ actionHistory: history });
        });
    });

    monitorToggleButton.addEventListener('click', () => {
        // Placeholder for monitor toggle logic
        const isCurrentlyMonitoring = monitorStatusIndicator.classList.contains('active');
        if (isCurrentlyMonitoring) {
            stopMonitoring();
        } else {
            startMonitoring();
        }
    });

    // --- Core Logic ---
    function performInventoryCheck() {
        resultsContent.innerHTML = '<div>Loading results...</div>';
        resultsCard.style.display = 'block';
        showNotification('Checking inventory...', '');

        const filters = {
            model: modelSelect.value,
            condition: conditionSelect.value,
            maxPrice: priceInput.value,
            zip: zipInput.value,
            region: currentRegion
        };

        chrome.runtime.sendMessage({ action: 'fetchInventory', filters }, (response) => {
            if (chrome.runtime.lastError) {
                showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
                resultsContent.innerHTML = '<div>Error fetching results.</div>';
                return;
            }
            
            if (response && response.success && response.data && response.data.results) {
                const vehicles = response.data.results;
                if (vehicles.length > 0) {
                    resultsContent.innerHTML = ''; // Clear loading/previous
                    vehicles.forEach(vehicle => {
                        const vehicleDiv = document.createElement('div');
                        vehicleDiv.className = 'result-item'; // You might want to style this
                        vehicleDiv.innerHTML = 
                            `<strong>${vehicle.Year || ''} ${vehicle.Model || ''} ${vehicle.Trim || ''}</strong><br>` +
                            `Price: ${vehicle.Price || 'N/A'}<br>` +
                            `Location: ${vehicle.MetroName || vehicle.City || 'N/A'}<br>` +
                            (vehicle.InventoryVin ? `<a href="https://www.tesla.com/${vehicle.InventoryVin}" target="_blank">View Details</a>` : '');
                        resultsContent.appendChild(vehicleDiv);
                    });
                    showNotification(`Found ${vehicles.length} vehicles.`, 'success');
                } else {
                    resultsContent.innerHTML = '<div>No vehicles found matching your criteria.</div>';
                    showNotification('No vehicles found.', 'success');
                }
                // Update last checked timestamp
                const now = new Date().toISOString();
                lastUpdatedElement.textContent = `Last checked: ${new Date(now).toLocaleString()}`;
                chrome.storage.local.set({ lastUpdatedTimestamp: now });
            } else if (response && response.error) {
                resultsContent.innerHTML = `<div>Error: ${response.error}</div>`;
                showNotification('Error: ' + response.error, 'error');
            } else {
                resultsContent.innerHTML = '<div>Unexpected response from server.</div>';
                showNotification('Unexpected error during check.', 'error');
            }
        });
    }



    function startMonitoring() {
        // Disable button during processing
        monitorToggleButton.disabled = true;
        
        // Get current settings
        const model = modelSelect.value;
        const condition = conditionSelect.value;
        const maxPrice = priceInput.value;
        const zip = zipInput.value;
        const pollInterval = parseInt(pollIntervalInput.value, 10); // Minutes
        
        if (!maxPrice || isNaN(parseInt(maxPrice, 10))) {
            showNotification('Please enter a valid maximum price to monitor.', 'error');
            monitorToggleButton.disabled = false;
            return;
        }
        
        const monitoringSettings = {
            isActive: true,
            pollInterval: pollInterval, // Minutes
            model: model,
            condition: condition,
            maxPrice: maxPrice,
            zip: zip,
            region: currentRegion,
            lastCheck: new Date().toISOString()
        };
        
        // Update UI to show that we're initiating monitoring
        if (monitorDetailsElement) {
            monitorDetailsElement.innerHTML = `<strong>Status:</strong> Initiating monitoring...<br>
            <span style="font-size: 12px; color: #3B82F6;">Setting up background checks</span>`;
        }
        
        // Before sending any messages, add a flag in storage to indicate we're trying to mitigate cache errors
        const requestId = Date.now().toString() + Math.random().toString().slice(2, 8);
        
        // Save monitoring settings to storage before sending message
        // This ensures settings are saved even if message response fails
        chrome.storage.local.set({ 
            monitoringSettings, 
            monitorStartTime: Date.now(),
            nextCheckTime: Date.now() + (pollInterval * 60 * 1000),
            lastOperation: {
                action: 'startMonitoring',
                timestamp: Date.now(),
                requestId: requestId,
                status: 'pending'
            }
        }, () => {
            // Send message to background script to start monitoring
            try {
                chrome.runtime.sendMessage(
                    { 
                        action: 'startMonitoring', 
                        settings: monitoringSettings,
                        requestId: requestId,  // Add request ID for tracking
                        timestamp: Date.now()
                    },
                    function(response) {
                        monitorToggleButton.disabled = false;
                        // Record that we've received a response to this request
                        chrome.storage.local.set({
                            lastOperation: {
                                action: 'startMonitoring',
                                timestamp: Date.now(),
                                requestId: requestId,
                                status: 'completed',
                                response: response
                            }
                        });
                        
                        // Check for runtime errors immediately to prevent uncaught errors
                        if (chrome.runtime.lastError) {
                            const errorMessage = chrome.runtime.lastError.message;
                            console.error("Error starting monitoring:", errorMessage);
                            
                            // Special handling for back/forward cache errors
                            if (errorMessage.includes('back/forward cache') || errorMessage.includes('message channel is closed')) {
                                showNotification('Monitoring started in background (page caching issue).', 'warning');
                                if (monitorDetailsElement) {
                                    monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring active with warnings.<br>
                                    <span style="font-size: 12px; color: #F59E0B;">Communication issue due to browser caching.</span>`;
                                }
                                return;
                            }
                        }
                        
                        if (response && response.success) {
                            showNotification('Monitoring started!', 'success');
                            updateMonitorStatusUI(true, monitoringSettings.lastCheck, model, maxPrice);
                            
                            // Add entry to log
                            const logEntry = {
                                timestamp: new Date().toISOString(),
                                event: 'monitoring_started',
                                settings: {
                                    model: model,
                                    condition: condition,
                                    maxPrice: maxPrice,
                                    region: currentRegion,
                                    pollInterval: pollInterval
                                }
                            };
                            
                            chrome.storage.local.get(['monitoringLog'], (data) => {
                                const log = data.monitoringLog || [];
                                log.push(logEntry);
                                // Keep log size reasonable (last 100 entries)
                                if (log.length > 100) log.shift();
                                chrome.storage.local.set({ monitoringLog: log });
                            });
                        } else {
                            console.error("Error from background script:", response);
                            showNotification('Error: ' + (response?.error || 'Unknown error starting monitoring.'), 'error');
                            if (monitorDetailsElement) {
                                monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring failed to start.<br>
                                <span style="font-size: 12px; color: #EF4444;">Error: ${response?.error || 'Unknown error'}</span>`;
                            }
                        }
                    }
                );
            } catch (err) {
                console.error("Exception during startMonitoring:", err);
                showNotification('Error starting monitoring: ' + err.message, 'error');
                monitorToggleButton.disabled = false;
                if (monitorDetailsElement) {
                    monitorDetailsElement.innerHTML = `<strong>Status:</strong> Error starting monitoring.<br>
                    <span style="font-size: 12px; color: #EF4444;">Error: ${err.message}</span>`;
                }
                
                // Update the operation status
                chrome.storage.local.set({
                    lastOperation: {
                        action: 'startMonitoring',
                        timestamp: Date.now(),
                        requestId: requestId,
                        status: 'error',
                        error: err.message
                    }
                });
            }
        });
    }

    function stopMonitoring() {
        // Update UI to show that we're stopping monitoring
        if (monitorDetailsElement) {
            monitorDetailsElement.innerHTML = `<strong>Status:</strong> Stopping monitoring...<br>
            <span style="font-size: 12px; color: #3B82F6;">Cleaning up background checks</span>`;
        }
        
        // Preemptively update state in storage to prevent orphaned monitoring state
        chrome.storage.local.get('monitoringSettings', (data) => {
            const currentMonitoring = data.monitoringSettings || {};
            chrome.storage.local.set({ 
                monitoringSettings: { 
                    ...currentMonitoring, 
                    isActive: false 
                },
                monitorStopTime: Date.now()
            }, () => {
                // Add request tracking for this operation as well
                const stopRequestId = Date.now().toString() + Math.random().toString().slice(2, 8);
                chrome.storage.local.set({
                    lastOperation: {
                        action: 'stopMonitoring',
                        timestamp: Date.now(),
                        requestId: stopRequestId,
                        status: 'pending'
                    }
                });
                
                // Now send message to background script
                try {
                    chrome.runtime.sendMessage({ 
                        action: 'stopMonitoring',
                        requestId: stopRequestId,
                        timestamp: Date.now()
                    }, (response) => {
                        // Check for runtime errors
                        if (chrome.runtime.lastError) {
                            console.warn("Warning stopping monitoring:", chrome.runtime.lastError.message);
                            showNotification('Monitoring stopped with warning.', 'warning');
                            updateMonitorStatusUI(false);
                            if (monitorDetailsElement) {
                                monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring inactive.<br>
                                <span style="font-size: 12px; color: #F59E0B;">Communication warning: ${chrome.runtime.lastError.message}</span>`;
                            }
                            return;
                        }
                        
                        if (response && response.success) {
                            showNotification('Monitoring stopped.', 'success');
                            updateMonitorStatusUI(false);
                            
                            // Add entry to log
                            const logEntry = {
                                timestamp: new Date().toISOString(),
                                event: 'monitoring_stopped',
                                settings: currentMonitoring
                            };
                            
                            chrome.storage.local.get(['monitoringLog'], (data) => {
                                const log = data.monitoringLog || [];
                                log.push(logEntry);
                                if (log.length > 100) log.shift();
                                chrome.storage.local.set({ monitoringLog: log });
                            });
                        } else {
                            showNotification(response?.error || 'Monitoring stopped with status issues.', 'warning');
                            updateMonitorStatusUI(false);
                            if (monitorDetailsElement) {
                                monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring inactive (with warnings).<br>
                                <span style="font-size: 12px; color: #F59E0B;">Warning: ${response?.error || 'Status update issues'}</span>`;
                            }
                        }
                    });
                } catch (err) {
                    console.error("Exception stopping monitoring:", err);
                    showNotification('Monitoring stopped but had communication errors.', 'warning');
                    updateMonitorStatusUI(false);
                    if (monitorDetailsElement) {
                        monitorDetailsElement.innerHTML = `<strong>Status:</strong> Monitoring inactive.<br>
                        <span style="font-size: 12px; color: #F59E0B;">Error during communication: ${err.message}</span>`;
                    }
                }
            });
        });
    }

    // --- Event Listeners for Form Helper & Settings ---
    if (fillFormButton) {
        fillFormButton.addEventListener('click', () => {
            chrome.storage.local.get(['accountDetails'], (result) => {
                if (result.accountDetails && Object.keys(result.accountDetails).length > 0 && result.accountDetails.firstName) { 
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0] && tabs[0].id) {
                            // Show notification immediately to provide feedback
                            showNotification('Starting auto-fill process...', 'success');
                            
                            // Send message to content script
                            chrome.tabs.sendMessage(
                                tabs[0].id, 
                                { action: "autofillOrderForm", details: result.accountDetails }
                            );
                            
                            // Don't wait for a response since the content script is handling the iframe asynchronously
                            // This avoids the "message channel closed" error
                        } else {
                            showNotification('Could not find active tab to send autofill command.', 'error');
                        }
                    });
                } else {
                    showNotification('No account details saved. Please save them via the Options page.', 'error');
                }
            });
        });
    }



    if (settingsButton) {
        settingsButton.addEventListener('click', function() {
            chrome.runtime.openOptionsPage(function() {
                if (chrome.runtime.lastError) {
                    showNotification('Could not open options page.', 'error');
                    console.error("Error opening options page:", chrome.runtime.lastError.message);
                }
            });
        });
    }

    if (exportCsvButton) {
        exportCsvButton.addEventListener('click', () => {
            const rows = [];
            const headers = ["Year", "Model", "Trim", "Price", "Location", "VIN_Link"];
            rows.push(headers.join(','));

            document.querySelectorAll('#results-content .result-item').forEach(item => {
                const strongText = item.querySelector('strong')?.textContent || '';
                const parts = strongText.split(' ');
                const year = parts[0] || '';
                const modelName = parts[1] || '';
                const trim = parts.slice(2).join(' ') || '';
                
                const priceText = item.textContent.match(/Price: (.*?)(?=\n|$)/)?.[1]?.trim() || 'N/A';
                const locationText = item.textContent.match(/Location: (.*?)(?=\n|$)/)?.[1]?.trim() || 'N/A';
                const vinLink = item.querySelector('a')?.href || 'N/A';
                rows.push([year, modelName, trim, priceText, locationText, vinLink].join(','));
            });

            if (rows.length <= 1) {
                showNotification('No data to export.', 'error');
                return;
            }

            const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "tesla_inventory_results.csv");
            document.body.appendChild(link); 
            link.click();
            document.body.removeChild(link);
            showNotification('Results exported to CSV.', 'success');
        });
    }

    // --- Initialization ---
    loadUISettings(); 

    // Add listeners to save settings on change
    [modelSelect, conditionSelect, zipInput].forEach(el => {
        el.addEventListener('change', () => {
            saveSearchFiltersFromUI(); 
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id && tabs[0].url && (tabs[0].url.includes('tesla.com/inventory') || tabs[0].url.includes('tesla.com/en_us/inventory') || tabs[0].url.includes('tesla.com/tr_tr/inventory'))) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateInventoryView",
                        model: modelSelect.value,
                        condition: conditionSelect.value,
                        zip: zipInput.value.trim(),
                        region: currentRegion,
                        maxPrice: priceInput.value.trim() 
                    });
                }
            });
        });
    });

    priceInput.addEventListener('input', () => {
        saveSearchFiltersFromUI(); 
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id && tabs[0].url && (tabs[0].url.includes('tesla.com/inventory') || tabs[0].url.includes('tesla.com/en_us/inventory') || tabs[0].url.includes('tesla.com/tr_tr/inventory'))) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "filterByPrice",
                    maxPrice: priceInput.value.trim()
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("filterByPrice: Content script not responding or not on this page.", chrome.runtime.lastError.message);
                    } else if (response && response.status) {
                        console.log("filterByPrice: Content script responded:", response.status);
                    }
                });
            }
        });
    });

    pollIntervalInput.addEventListener('change', savePollIntervalFromUI);
});

// Export functions for testing or debugging
window.teslaMonitorExport = {
    showNotification,
    updateMonitorStatusUI,
    startMonitoring,
    stopMonitoring
};