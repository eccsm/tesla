const InventoryMonitor = {
    // Default polling intervals (in minutes)
    DEFAULT_POLL_INTERVAL: 5,
    AGGRESSIVE_POLL_INTERVAL: 1,
    
    // Active polling state
    activeAlarm: null,
    isMonitoring: false,
    
    /**
     * Start monitoring for vehicles matching filters
     * @param {Object} filters - Filtering options
     * @param {number} intervalMinutes - Polling interval in minutes
     * @returns {Promise<boolean>} - Success status
     */
    async startMonitoring(filters, intervalMinutes = this.DEFAULT_POLL_INTERVAL) {
      try {
        // Stop any existing monitoring
        await this.stopMonitoring();
        
        // Save the filters
        await StorageManager.saveData({ monitoringFilters: filters });
        
        // Make sure chrome.alarms is available
        if (!chrome.alarms) {
          throw new Error("Chrome alarms API not available. Check manifest permissions.");
        }
        
        // Set up polling with Chrome alarms
        this.activeAlarm = "tesla-inventory-monitor";
        
        chrome.alarms.create(this.activeAlarm, {
          periodInMinutes: intervalMinutes,
          delayInMinutes: 0.1 // Start almost immediately
        });
        
        this.isMonitoring = true;
        
        // Set monitoring state
        await StorageManager.saveData({
          isMonitoring: true,
          monitoringInterval: intervalMinutes,
          monitoringStarted: new Date().toISOString()
        });
        
        console.log(`Inventory monitoring started with interval: ${intervalMinutes} minutes`);
        
        // Check inventory immediately
        this.checkInventory();
        
        return true;
      } catch (error) {
        console.error("Error starting inventory monitoring:", error);
        return false;
      }
    },
    
    /**
     * Stop monitoring for vehicles
     * @returns {Promise<boolean>} - Success status
     */
    async stopMonitoring() {
      try {
        // Verify chrome.alarms is available
        if (!chrome.alarms) {
          console.warn("Chrome alarms API not available, but continuing with cleanup");
        } else {
          // Clear the alarm if one is active
          if (this.activeAlarm) {
            try {
              await new Promise((resolve) => {
                chrome.alarms.clear(this.activeAlarm, (wasCleared) => {
                  resolve(wasCleared);
                });
              });
            } catch (alarmError) {
              console.warn("Error clearing alarm:", alarmError);
            }
            this.activeAlarm = null;
          }
        }
        
        this.isMonitoring = false;
        
        // Update monitoring state
        await StorageManager.saveData({
          isMonitoring: false
        });
        
        console.log("Inventory monitoring stopped");
        return true;
      } catch (error) {
        console.error("Error stopping inventory monitoring:", error);
        return false;
      }
    },
    
    /**
     * Check inventory for matches
     * @returns {Promise<Array>} - Matching vehicles
     */
    async checkInventory() {
      try {
        console.log("Running inventory check...");
        
        // Get monitoring filters
        const data = await StorageManager.getData("monitoringFilters");
        const monitoringFilters = data.monitoringFilters;
        
        if (!monitoringFilters) {
          console.error("No monitoring filters defined");
          return [];
        }
        
        // Fetch inventory with filters
        const vehicles = await TeslaInventoryService.fetchInventory(monitoringFilters);
        
        // Get previously seen vehicles
        const knownVehiclesData = await StorageManager.getData("knownVehicles");
        const knownVehicles = knownVehiclesData.knownVehicles || {};
        
        // Find new vehicles
        const newVehicles = vehicles.filter(vehicle => !knownVehicles[vehicle.vin]);
        
        // Update known vehicles
        const updatedKnownVehicles = { ...knownVehicles };
        vehicles.forEach(vehicle => {
          updatedKnownVehicles[vehicle.vin] = {
            lastSeen: new Date().toISOString(),
            price: vehicle.price,
            trim: vehicle.trim
          };
        });
        
        // Save updated known vehicles
        await StorageManager.saveData({ knownVehicles: updatedKnownVehicles });
        
        // Save most recent results
        await StorageManager.saveData({
          lastInventoryCheck: new Date().toISOString(),
          lastInventoryResults: vehicles
        });
        
        // Show notification if new vehicles found
        if (newVehicles.length > 0) {
          this.showNotification(newVehicles, monitoringFilters);
        }
        
        return vehicles;
      } catch (error) {
        console.error("Error checking inventory:", error);
        return [];
      }
    },
    
    /**
     * Show a notification for new vehicles
     * @param {Array} vehicles - New vehicles
     * @param {Object} filters - Applied filters
     */
    showNotification(vehicles, filters) {
      if (!vehicles || vehicles.length === 0) return;
      
      try {
        // Make sure chrome.notifications is available
        if (!chrome.notifications) {
          console.warn("Chrome notifications API not available. Check manifest permissions.");
          return;
        }
        
        // Get region configuration
        const regionConfig = TeslaInventoryService.REGION_CONFIGS[filters.region] || TeslaInventoryService.REGION_CONFIGS.US;
        
        // Format a nice notification
        const lowestPrice = vehicles.reduce((min, v) => Math.min(min, v.price), Infinity);
        const formattedPrice = `${regionConfig.currencySymbol}${lowestPrice.toLocaleString(
          filters.region === 'TR' ? 'tr-TR' : 'en-US'
        )}`;
        
        const modelName = TeslaInventoryService.MODELS[filters.model]?.displayName || 'Tesla';
        
        // Customize message based on region
        let title, message;
        if (filters.region === 'TR') {
          title = `${vehicles.length} ${modelName} bulundu!`;
          message = `Fiyatlar ${formattedPrice}'dan başlıyor - Görmek için tıklayın`;
        } else {
          title = `${vehicles.length} ${modelName}${vehicles.length > 1 ? 's' : ''} found!`;
          message = `Starting at ${formattedPrice} - Click to view`;
        }
        
        // Create Chrome notification
        chrome.notifications.create("tesla-inventory-find", {
          type: "basic",
          iconUrl: "/icons/science.png",
          title,
          message,
          priority: 2
        });
        
        // Set badge with number of matches
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({ text: String(vehicles.length) });
          chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
        }
      } catch (error) {
        console.error("Error showing notification:", error);
      }
    },
    
    /**
     * Initialize the monitor
     */
    initialize() {
      try {
        console.log("Initializing inventory monitor...");
        
        // Check required permissions
        if (!chrome.alarms) {
          console.error("Chrome alarms API not available. Check manifest permissions.");
        }
        
        if (!chrome.notifications) {
          console.warn("Chrome notifications API not available. Check manifest permissions.");
        }
        
        // Listen for alarm events
        if (chrome.alarms) {
          chrome.alarms.onAlarm.addListener(alarm => {
            if (alarm.name === this.activeAlarm) {
              this.checkInventory().catch(err => {
                console.error("Error in alarm handler:", err);
              });
            }
          });
        }
        
        // Listen for notification clicks
        if (chrome.notifications) {
          chrome.notifications.onClicked.addListener(notificationId => {
            if (notificationId === "tesla-inventory-find") {
              this.openInventoryPage().catch(err => {
                console.error("Error opening inventory page:", err);
              });
            }
          });
        }
        
        // Restore monitoring state if active
        StorageManager.getData(["isMonitoring", "monitoringFilters", "monitoringInterval"])
          .then(data => {
            if (data.isMonitoring && data.monitoringFilters) {
              this.startMonitoring(
                data.monitoringFilters, 
                data.monitoringInterval || this.DEFAULT_POLL_INTERVAL
              ).catch(err => {
                console.error("Error restoring monitoring:", err);
              });
            }
          })
          .catch(err => {
            console.error("Error retrieving monitoring state:", err);
          });
        
        console.log("Inventory monitor initialized");
      } catch (error) {
        console.error("Error initializing inventory monitor:", error);
      }
    },
    
    /**
     * Open the inventory page
     */
    async openInventoryPage() {
      try {
        // Get monitoring filters
        const data = await StorageManager.getData("monitoringFilters");
        const monitoringFilters = data.monitoringFilters;
        
        if (!monitoringFilters) {
          console.error("No monitoring filters defined");
          return;
        }
        
        // Get region and model
        const region = monitoringFilters.region || "US";
        const model = monitoringFilters.model || "my";
        const condition = monitoringFilters.condition || "new";
        
        // Get region configuration
        const regionConfig = TeslaInventoryService.REGION_CONFIGS[region] || TeslaInventoryService.REGION_CONFIGS.US;
        
        // Construct the URL
        let url = `${regionConfig.baseUrl}/inventory/${condition}/${model}`;
        
        // Add parameters
        const params = new URLSearchParams();
        
        if (monitoringFilters.priceMax) {
          params.append("price", monitoringFilters.priceMax);
        }
        
        if (monitoringFilters.zip) {
          params.append("zip", monitoringFilters.zip);
        }
        
        if (monitoringFilters.range) {
          params.append("range", monitoringFilters.range);
        }
        
        // Add parameters to URL if any exist
        const paramsString = params.toString();
        if (paramsString) {
          url += `?${paramsString}`;
        }
        
        // Open the URL in a new tab
        if (chrome.tabs) {
          chrome.tabs.create({ url });
        }
        
        // Clear the badge
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({ text: "" });
        }
      } catch (error) {
        console.error("Error opening inventory page:", error);
      }
    }
  };