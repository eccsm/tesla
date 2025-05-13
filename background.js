  // Initialize the service
  TeslaInventoryService.initialize();
  // Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request.action);
  
  if (request.action === "fetchInventory") {
    TeslaInventoryService.fetchInventory(request.filters)
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        sendResponse({ success:false, error: error.message || String(error) });

      });
    return true;
  }
  
  if (request.action === "downloadCSV") {
    const success = TeslaInventoryService.downloadCSVExport();
    sendResponse({ success });
    return true;
  }
  InventoryMonitor.initialize();
  chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed, starting monitor...");
    
  if (request.action === "startMonitoring") {
    InventoryMonitor.startMonitoring(request.filters, request.interval)
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        sendResponse({ success:false, error: error.message || String(error) });
      });
    return true;
  }
  
  if (request.action === "stopMonitoring") {
    InventoryMonitor.stopMonitoring()
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        sendResponse({ success:false, error: error.message || String(error) });

      });
    return true;
  }
  
  if (request.action === "checkInventory") {
    InventoryMonitor.checkInventory()
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        sendResponse({ success:false, error: error.message || String(error) });
      });
    return true;
  }
  
  if (request.action === "fillForm") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fillForm" }, response => {
          sendResponse(response || { status: "Message sent" });
        });
      } else {
        sendResponse({ status: "No active tab" });
      }
    });
    return true;
  }
  
  if (request.action === "fixValidation") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fixValidation" }, response => {
          sendResponse(response || { status: "Message sent" });
        });
      } else {
        sendResponse({ status: "No active tab" });
      }
    });
    return true;
  }
  
  if (request.action === "togglePanel") {
    chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
      if (tabs.length > 0) {
        await chrome.tabs.sendMessage(tabId, msg).then(sendResponse);
        return true;
        }
       else {
        sendResponse({ status: "No active tab" });
      }
    });
    return true;
  }
  
  if (request.action === "refreshData") {
    // Simple acknowledgment
    sendResponse({ status: "Refresh requested" });
    return false;
  }
});

// Initialize the extension when installed or updated
chrome.runtime.onInstalled.addListener(details => {
  console.log("Tesla AutoPilot extension installed or updated", details.reason);
  
  InventoryMonitor.startMonitoring(DEFAULT_FILTERS)
  .catch(console.error);
});

// Listen for alarm events outside the class for extra reliability
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "tesla-inventory-monitor") {
      InventoryMonitor.checkInventory().catch(error => {
        console.error("Error in global alarm handler:", error);
      });
    }
  });
}
})
