/**
 * Tesla AutoPilot Extension - Shared Constants
 * 
 * This module provides shared constants used throughout the extension.
 * Centralizing these values ensures consistency and easier maintenance.
 */

// Extension configuration
export const CONFIG = {
    // Feature flags
    FEATURES: {
      USE_BROWSER_FALLBACK: true,
      ENABLE_FORM_HELPERS: true
    },
    
    // API configuration
    API: {
      VERSION: "v4",
      BASE_URL: "https://www.tesla.com/inventory/api/",
      TIMEOUT: 10000,
      MAX_RETRIES: 2
    },
    
    // Regional configurations
    REGIONS: {
      US: {
        baseUrl: "https://www.tesla.com",
        currencySymbol: "$",
        defaultZip: "98052", // Redmond, WA
        language: "en",
        market: "US",
        super_region: "north america",
        numberFormat: 'en-US'
      },
      TR: {
        baseUrl: "https://www.tesla.com/tr_TR",
        currencySymbol: "₺",
        defaultZip: "34000", // Istanbul
        language: "tr",
        market: "TR",
        super_region: "europe",
        numberFormat: 'tr-TR'
      }
    },
    
    // Tesla model configurations
    MODELS: {
      m3: {
        displayName: "Model 3",
        trims: [
          { code: "MRRWD", name: "RWD" },
          { code: "LRRWD", name: "Long Range RWD" },
          { code: "LRAWD", name: "Long Range AWD" },
          { code: "PERFORMANCE", name: "Performance" }
        ]
      },
      my: {
        displayName: "Model Y",
        trims: [
          { code: "MRRWD", name: "RWD" },
          { code: "LRRWD", name: "Long Range RWD" },
          { code: "LRAWD", name: "Long Range AWD" },
          { code: "PERFORMANCE", name: "Performance" }
        ]
      },
      ms: {
        displayName: "Model S",
        trims: [
          { code: "LRAWD", name: "Long Range" },
          { code: "PLAID", name: "Plaid" }
        ]
      },
      mx: {
        displayName: "Model X",
        trims: [
          { code: "LRAWD", name: "Long Range" },
          { code: "PLAID", name: "Plaid" }
        ]
      }
    },
    
    // Autopilot options
    AUTOPILOT_OPTIONS: [
      { code: "AUTOPILOT_FULL_SELF_DRIVING", name: "Full Self-Driving" },
      { code: "AUTOPILOT_ENHANCED", name: "Enhanced Autopilot" },
      { code: "AUTOPILOT_STANDARD", name: "Autopilot" }
    ],
    
    // Default form values by region
    DEFAULT_VALUES: {
      US: {
        priceFloor: "45000",
        zip: "98052",
        first: "John",
        last: "Smith",
        email: "your.email@example.com",
        phone: "4155551234",
        country: "US",
        addr1: "123 Main Street",
        addr2: "Apt 101",
        city: "San Francisco",
        state: "CA",
        condition: "new",
        pollingInterval: 5,
        autopilot: ["AUTOPILOT_FULL_SELF_DRIVING"],
        trimLevels: ["LRRWD", "LRAWD"]
      },
      TR: {
        priceFloor: "1590000",
        zip: "34000",
        tc: "12345678901",
        first: "Ahmet",
        last: "Yılmaz",
        email: "ahmet.yilmaz@example.com",
        phone: "5320651500",
        country: "TR",
        addr1: "Bağdat Caddesi No:123",
        addr2: "Daire 5",
        city: "Istanbul",
        state: "Marmara",
        condition: "new",
        pollingInterval: 5,
        autopilot: ["AUTOPILOT_FULL_SELF_DRIVING"],
        trimLevels: ["LRRWD", "LRAWD"]
      }
    },
    
    // Field selectors for form filling
    FIELD_SELECTORS: {
      firstName: [
        '#FIRST_NAME',
        'input[name="firstName"]',
        'input[data-id="first-name-textbox"]',
        'input[placeholder="First Name"]',
        'input[aria-label="First Name"]'
      ],
      lastName: [
        '#LAST_NAME',
        'input[name="lastName"]',
        'input[data-id="last-name-textbox"]',
        'input[placeholder="Last Name"]',
        'input[aria-label="Last Name"]'
      ],
      // Add more field selectors as needed
    },
    
    // URL parameters
    URL_PARAMS: {
      PRICE: 'price',
      RANGE: 'range',
      PAYMENT_TYPE: 'PaymentType',
      ARRANGE_BY: 'arrangeby'
    },
    
    // Panel configuration
    PANEL_ID: 'tesla-autopilot-panel',
    
    // Default polling intervals (in minutes)
    DEFAULT_POLL_INTERVAL: 5,
    AGGRESSIVE_POLL_INTERVAL: 1
  };
  
  // Storage keys
  export const STORAGE_KEYS = {
    REGION: 'region',
    MODEL: 'model',
    CONDITION: 'condition',
    PRICE_FLOOR: 'priceFloor',
    ZIP: 'zip',
    FIRST_NAME: 'first',
    LAST_NAME: 'last',
    EMAIL: 'email',
    PHONE: 'phone',
    COUNTRY: 'country',
    ADDRESS_1: 'addr1',
    ADDRESS_2: 'addr2',
    CITY: 'city',
    STATE: 'state',
    TRIM_LEVELS: 'trimLevels',
    AUTOPILOT: 'autopilot',
    IS_MONITORING: 'isMonitoring',
    MONITORING_FILTERS: 'monitoringFilters',
    MONITORING_INTERVAL: 'monitoringInterval',
    MONITORING_STARTED: 'monitoringStarted',
    LAST_INVENTORY_CHECK: 'lastInventoryCheck',
    LAST_INVENTORY_RESULTS: 'lastInventoryResults'
  };
  
  // Action types for consistent messaging
  export const ACTION_TYPES = {
    FETCH_INVENTORY: 'fetchInventory',
    CHECK_INVENTORY: 'checkInventory',
    START_MONITORING: 'startMonitoring',
    STOP_MONITORING: 'stopMonitoring',
    DOWNLOAD_CSV: 'downloadCSV',
    FILL_FORM: 'fillForm',
    FIX_VALIDATION: 'fixValidation',
    TOGGLE_PANEL: 'togglePanel',
    REFRESH_DATA: 'refreshData'
  };
  
  // Event names
  export const EVENTS = {
    STORAGE_CHANGED: 'storage-changed',
    INVENTORY_UPDATED: 'inventory-updated',
    MONITORING_CHANGED: 'monitoring-changed'
  };
  
  // Error messages
  export const ERROR_MESSAGES = {
    API_BLOCKED: {
      en: 'Tesla API access is blocked. Using browser-based method instead.',
      tr: 'Tesla API erişimi engellendi. Bunun yerine tarayıcı tabanlı yöntem kullanılıyor.'
    },
    NETWORK_ERROR: {
      en: 'Network error. Please check your internet connection and try again.',
      tr: 'Ağ hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.'
    },
    NOT_TESLA_PAGE: {
      en: 'This feature only works on Tesla pages.',
      tr: 'Bu özellik yalnızca Tesla sayfalarında çalışır.'
    },
    // Add more error messages as needed
  };
  
  // Success messages
  export const SUCCESS_MESSAGES = {
    FORM_FILLED: {
      en: 'Form filled successfully!',
      tr: 'Form başarıyla dolduruldu!'
    },
    ZIP_FILLED: {
      en: 'ZIP code dialog filled successfully!',
      tr: 'ZIP kodu iletişim kutusu başarıyla dolduruldu!'
    },
    // Add more success messages as needed
  };