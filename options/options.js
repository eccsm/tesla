// options.js - Enhanced Settings Management with Default Values for Both Regions

// Default values for each region
const DEFAULT_VALUES = {
  US: {
    priceFloor: "45000",
    zip: "94401",
    first: "John",
    last: "Smith",
    email: "john.smith@example.com",
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
    first: "Ahmet",
    last: "Yılmaz",
    email: "ahmet.yilmaz@example.com",
    phone: "5551234567",
    country: "TR",
    addr1: "Atatürk Bulvarı No: 123",
    addr2: "Daire 5",
    city: "Ankara",
    state: "Çankaya",
    cardName: "Ahmet Yılmaz",
    cardNumber: "4111111111111111",
    cardExp: "12/27",
    cardCVV: "123"
  }
};

// Language strings for localization
const i18n = {
  US: {
    title: "Tesla AutoPilot Settings",
    regionSelector: "Select Region",
    priceThreshold: "Price Threshold ($):",
    zipCode: "ZIP Code:",
    zipPlaceholder: "e.g., 94401",
    accountDetails: "Account Details",
    firstName: "First Name:",
    lastName: "Last Name:",
    email: "Email:",
    emailPlaceholder: "Your email address",
    phone: "Phone:",
    phonePlaceholder: "Your phone number",
    billingAddress: "Billing Address",
    country: "Country Code:",
    address1: "Address Line 1:",
    address1Placeholder: "Street address",
    address2: "Address Line 2 (Optional):",
    address2Placeholder: "Apt, Suite, etc.",
    city: "City:",
    state: "State:",
    payment: "Payment Information (Optional)",
    paymentNote: "Note: This information is stored locally on your device only.",
    cardName: "Name on Card:",
    cardNamePlaceholder: "Name as it appears on card",
    cardNumber: "Card Number:",
    cardNumberPlaceholder: "Card number",
    cardExp: "Expiration Date:",
    cardExpPlaceholder: "MM/YY",
    cardCVV: "CVV:",
    cardCVVPlaceholder: "Security code",
    save: "Save",
    saveSuccess: "Your settings have been saved successfully! ✅",
    saveError: "Error saving settings!"
  },
  TR: {
    title: "Tesla OtoPilot Ayarları",
    regionSelector: "Bölge Seçin",
    priceThreshold: "Fiyat Eşiği (₺):",
    zipCode: "Posta Kodu:",
    zipPlaceholder: "örn: 06000",
    accountDetails: "Hesap Detayları",
    tckn: "TCKN:",
    tcknPlaceholder: "TC Kimlik Numarası",
    firstName: "Ad:",
    lastName: "Soyad:",
    email: "E-posta:",
    emailPlaceholder: "E-posta adresiniz",
    phone: "Telefon:",
    phonePlaceholder: "Telefon numaranız",
    billingAddress: "Fatura Adresi",
    country: "Ülke Kodu:",
    address1: "Adres Satırı 1:",
    address1Placeholder: "Cadde, sokak",
    address2: "Adres Satırı 2 (Opsiyonel):",
    address2Placeholder: "Apt, Daire, vs.",
    city: "Şehir:",
    state: "İlçe/Semt:",
    payment: "Ödeme Bilgileri (Opsiyonel)",
    paymentNote: "Not: Bu bilgiler yalnızca yerel olarak cihazınızda saklanır.",
    cardName: "Kart Sahibinin Adı:",
    cardNamePlaceholder: "Kart üzerindeki isim",
    cardNumber: "Kart Numarası:",
    cardNumberPlaceholder: "Kart numarası",
    cardExp: "Son Kullanma Tarihi:",
    cardExpPlaceholder: "AA/YY",
    cardCVV: "CVV:",
    cardCVVPlaceholder: "Güvenlik kodu",
    save: "Kaydet",
    saveSuccess: "Ayarlarınız başarıyla kaydedildi! ✅",
    saveError: "Ayarlar kaydedilirken bir hata oluştu!"
  }
};

// Fields Manager
const FieldsManager = {
  // All fields that can be saved
  FIELDS: [
    "priceFloor", "zip", 
    "tc", "first", "last", "email", "phone",
    "country", "addr1", "addr2", "city", "state",
    "cardName", "cardNumber", "cardExp", "cardCVV"
  ],
  
  // Get element by ID
  $(id) {
    return document.getElementById(id);
  },
  
  // Get current region
  async getRegion() {
    try {
      const { region = "US" } = await chrome.storage.sync.get("region");
      return region;
    } catch (error) {
      console.error("Error getting region:", error);
      return "US";
    }
  },
  
  // Set region
  async setRegion(region) {
    try {
      await chrome.storage.sync.set({ region });
      return true;
    } catch (error) {
      console.error("Error setting region:", error);
      return false;
    }
  },
  
  // Update UI based on region
  async updateUIForRegion(region) {
    // Update region selector
    this.$("region").value = region;
    
    // Get strings for current region
    const strings = i18n[region] || i18n.US;
    
    // Update page title
    document.title = strings.title;
    document.querySelector("h1").textContent = strings.title;
    
    // Update region selector title
    document.querySelector(".region-selector h2").textContent = strings.regionSelector;
    
    // Update price field
    this.$("price-label").textContent = strings.priceThreshold;
    
    // Update ZIP field
    this.$("zip-label").textContent = strings.zipCode;
    this.$("zip").placeholder = strings.zipPlaceholder;
    
    // Update account details section
    this.$("account-details-heading").textContent = strings.accountDetails;
    
    // Show/hide TC field based on region
    if (region === "TR") {
      document.querySelector(".tc-field").style.display = "block";
      document.querySelector(".tc-field label").textContent = strings.tckn;
      this.$("tc").placeholder = strings.tcknPlaceholder;
    } else {
      document.querySelector(".tc-field").style.display = "none";
    }
    
    // Update name fields
    this.$("first-name-label").textContent = strings.firstName;
    this.$("last-name-label").textContent = strings.lastName;
    
    // Update email field
    this.$("email-label").textContent = strings.email;
    this.$("email").placeholder = strings.emailPlaceholder;
    
    // Update phone field
    this.$("phone-label").textContent = strings.phone;
    this.$("phone").placeholder = strings.phonePlaceholder;
    
    // Update billing address section
    this.$("billing-address-heading").textContent = strings.billingAddress;
    this.$("country-label").textContent = strings.country;
    this.$("addr1-label").textContent = strings.address1;
    this.$("addr1").placeholder = strings.address1Placeholder;
    this.$("addr2-label").textContent = strings.address2;
    this.$("addr2").placeholder = strings.address2Placeholder;
    this.$("city-label").textContent = strings.city;
    this.$("state-label").textContent = strings.state;
    
    // Update payment section
    this.$("payment-heading").textContent = strings.payment;
    this.$("payment-note").textContent = strings.paymentNote;
    this.$("card-name-label").textContent = strings.cardName;
    this.$("cardName").placeholder = strings.cardNamePlaceholder;
    this.$("card-number-label").textContent = strings.cardNumber;
    this.$("cardNumber").placeholder = strings.cardNumberPlaceholder;
    this.$("card-exp-label").textContent = strings.cardExp;
    this.$("cardExp").placeholder = strings.cardExpPlaceholder;
    this.$("card-cvv-label").textContent = strings.cardCVV;
    this.$("cardCVV").placeholder = strings.cardCVVPlaceholder;
    
    // Update save button
    this.$("save").textContent = strings.save;
  },
  
  // Initialize default values if not already set
  async initializeDefaultValues() {
    // Get current saved values
    const savedValues = await chrome.storage.sync.get(this.FIELDS.concat(['region', 'defaultsInitialized']));
    
    // If defaults are already initialized, exit
    if (savedValues.defaultsInitialized) {
      return;
    }
    
    // Get current region (or default to US)
    const region = savedValues.region || "US";
    
    // Get default values for the region
    const defaults = DEFAULT_VALUES[region];
    
    // Merge saved values with defaults (saved values take precedence)
    const mergedValues = { ...defaults };
    this.FIELDS.forEach(field => {
      if (savedValues[field]) {
        mergedValues[field] = savedValues[field];
      }
    });
    
    // Add the initialized flag
    mergedValues.defaultsInitialized = true;
    
    // Save the merged values
    await chrome.storage.sync.set(mergedValues);
    console.log("Default values initialized for region:", region);
  },
  
  // Load all field values from storage
  async loadFieldValues() {
    try {
      // Initialize default values if needed
      await this.initializeDefaultValues();
      
      // Get current region
      const region = await this.getRegion();
      
      // Update UI for current region
      await this.updateUIForRegion(region);
      
      // Get saved values
      const data = await chrome.storage.sync.get(this.FIELDS);
      
      // Get default values for the region
      const defaults = DEFAULT_VALUES[region];
      
      // Fill in fields
      this.FIELDS.forEach(fieldId => {
        const field = this.$(fieldId);
        if (field) {
          // Use saved value if exists, otherwise use default
          if (data[fieldId] !== undefined) {
            field.value = data[fieldId];
          } else if (defaults[fieldId] !== undefined) {
            field.value = defaults[fieldId];
          }
        }
      });
      
      console.log("Loaded saved settings for region:", region);
    } catch (error) {
      console.error("Error loading field values:", error);
      this.showMessage("Error loading settings!", false);
    }
  },
  
  // Save all field values to storage
  async saveFieldValues() {
    try {
      const payload = { defaultsInitialized: true };
      
      // Get current region
      const region = await this.getRegion();
      payload.region = region;
      
      // Get values from form fields
      this.FIELDS.forEach(fieldId => {
        const field = this.$(fieldId);
        if (field) {
          payload[fieldId] = field.value.trim();
        }
      });
      
      // Save to storage
      await chrome.storage.sync.set(payload);
      
      // Get localized success message
      const strings = i18n[region] || i18n.US;
      this.showMessage(strings.saveSuccess, true);
      
      // Trigger a background update
      this.triggerBackgroundUpdate();
      
      return true;
    } catch (error) {
      console.error("Error saving field values:", error);
      
      // Get localized error message
      const region = await this.getRegion();
      const strings = i18n[region] || i18n.US;
      this.showMessage(strings.saveError, false);
      
      return false;
    }
  },
  
  // Show a status message to the user
  showMessage(message, isSuccess) {
    const statusEl = this.$("saveStatus");
    
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.display = "block";
      statusEl.style.color = isSuccess ? "green" : "red";
      statusEl.style.background = isSuccess ? "#f0fff4" : "#fff0f0";
      
      // Hide the message after 3 seconds
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 3000);
    }
  },
  
  // Trigger a background update to refresh data
  triggerBackgroundUpdate() {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "refreshData" })
        .catch(err => console.log("Background may not be ready yet:", err));
    }
  }
};

// Form Validation
const FormValidator = {
  // Validate price floor (must be a positive number)
  validatePriceFloor(value) {
    const price = Number(value);
    return !isNaN(price) && price > 0;
  },
  
  // Validate email address
  validateEmail(email) {
    return email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
  
  // Validate phone number (simple check)
  validatePhone(phone) {
    return phone === "" || /^\d{10,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''));
  },
  
  // Validate ZIP code
  validateZIP(zip, region) {
    if (zip === "") return true;
    
    if (region === "US") {
      return /^\d{5}(-\d{4})?$/.test(zip);
    } else if (region === "TR") {
      return /^\d{5}$/.test(zip);
    }
    
    return true;
  },
  
  // Validate Turkish ID (TC)
  validateTC(tc) {
    return tc === "" || (/^\d{11}$/.test(tc) && tc.charAt(0) !== '0');
  },
  
  // Validate card number (simple Luhn check)
  validateCardNumber(cardNumber) {
    if (cardNumber === "") return true;
    
    // Remove spaces and dashes
    const normalized = cardNumber.replace(/[\s-]/g, '');
    
    // Must be digits only
    if (!/^\d+$/.test(normalized)) return false;
    
    // Must be between 13-19 digits
    if (normalized.length < 13 || normalized.length > 19) return false;
    
    // Simple Luhn check
    let sum = 0;
    let double = false;
    
    for (let i = normalized.length - 1; i >= 0; i--) {
      let digit = parseInt(normalized.charAt(i), 10);
      
      if (double) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      double = !double;
    }
    
    return sum % 10 === 0;
  },
  
  // Validate expiration date (MM/YY format)
  validateExpDate(exp) {
    if (exp === "") return true;
    
    // Check format
    if (!/^\d{2}\/\d{2}$/.test(exp)) return false;
    
    const [month, year] = exp.split('/').map(part => parseInt(part, 10));
    
    // Check month range
    if (month < 1 || month > 12) return false;
    
    // Get current year and month
    const now = new Date();
    const currentYear = now.getFullYear() % 100; // Get last 2 digits
    const currentMonth = now.getMonth() + 1; // January is 0
    
    // Check if expired
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return false;
    }
    
    return true;
  },
  
  // Validate CVV (3-4 digits)
  validateCVV(cvv) {
    return cvv === "" || /^\d{3,4}$/.test(cvv);
  },
  
  // Validate all form fields
  async validateForm() {
    // Get current region
    const region = await FieldsManager.getRegion();
    const strings = i18n[region] || i18n.US;
    
    // Required fields
    const priceFloor = FieldsManager.$("priceFloor").value;
    
    if (!this.validatePriceFloor(priceFloor)) {
      FieldsManager.showMessage(region === "US" ? 
        "Please enter a valid price threshold." :
        "Lütfen geçerli bir fiyat eşiği giriniz.", false);
      return false;
    }
    
    // Optional fields
    const email = FieldsManager.$("email").value;
    const phone = FieldsManager.$("phone").value;
    const zip = FieldsManager.$("zip").value;
    const cardNumber = FieldsManager.$("cardNumber").value;
    const cardExp = FieldsManager.$("cardExp").value;
    const cardCVV = FieldsManager.$("cardCVV").value;
    
    // Validate email
    if (email && !this.validateEmail(email)) {
      FieldsManager.showMessage(region === "US" ? 
        "Please enter a valid email address." :
        "Lütfen geçerli bir e-posta adresi giriniz.", false);
      return false;
    }
    
    // Validate phone
    if (phone && !this.validatePhone(phone)) {
      FieldsManager.showMessage(region === "US" ? 
        "Please enter a valid phone number." :
        "Lütfen geçerli bir telefon numarası giriniz.", false);
      return false;
    }
    
    // Validate ZIP
    if (zip && !this.validateZIP(zip, region)) {
      FieldsManager.showMessage(region === "US" ? 
        "Please enter a valid ZIP code." :
        "Lütfen geçerli bir posta kodu giriniz.", false);
      return false;
    }
    
    // Validate TC for TR region
    if (region === "TR") {
      const tc = FieldsManager.$("tc").value;
      if (tc && !this.validateTC(tc)) {
        FieldsManager.showMessage("Lütfen geçerli bir TC kimlik numarası giriniz.", false);
        return false;
      }
    }
    
    // Validate payment details if provided
    if (cardNumber && !this.validateCardNumber(cardNumber)) {
      FieldsManager.showMessage(region === "US" ? 
        "Please enter a valid card number." :
        "Lütfen geçerli bir kart numarası giriniz.", false);
      return false;
    }
    
    if (cardExp && !this.validateExpDate(cardExp)) {
      FieldsManager.showMessage(region === "US" ? 
        "Please enter a valid expiration date (MM/YY)." :
        "Lütfen geçerli bir son kullanma tarihi giriniz (AA/YY).", false);
      return false;
    }
    
    if (cardCVV && !this.validateCVV(cardCVV)) {
      FieldsManager.showMessage(region === "US" ? 
        "Please enter a valid CVV code (3-4 digits)." :
        "Lütfen geçerli bir CVV kodu giriniz (3-4 rakam).", false);
      return false;
    }
    
    return true;
  }
};

// Settings Controller
const SettingsController = {
  // Initialize the settings page
  initialize() {
    // Load saved values
    FieldsManager.loadFieldValues();
    
    // Set up the save button
    FieldsManager.$("save").addEventListener("click", this.saveSettings);
    
    // Set up region change handler
    FieldsManager.$("region").addEventListener("change", this.changeRegion);
    
    // Set up form field validation on input
    this.setupFormValidation();
  },
  
  // Change region handler
  changeRegion: async (e) => {
    const newRegion = e.target.value;
    
    // Update region in storage
    await FieldsManager.setRegion(newRegion);
    
    // Update UI for new region
    await FieldsManager.updateUIForRegion(newRegion);
    
    // Load field values for new region
    await FieldsManager.loadFieldValues();
  },
  
  // Set up real-time validation for form fields
  setupFormValidation() {
    // Email validation
    const emailField = FieldsManager.$("email");
    if (emailField) {
      emailField.addEventListener("blur", () => {
        if (emailField.value && !FormValidator.validateEmail(emailField.value)) {
          emailField.style.borderColor = "red";
        } else {
          emailField.style.borderColor = "";
        }
      });
    }
    
    // Phone validation
    const phoneField = FieldsManager.$("phone");
    if (phoneField) {
      phoneField.addEventListener("blur", async () => {
        if (phoneField.value && !FormValidator.validatePhone(phoneField.value)) {
          phoneField.style.borderColor = "red";
        } else {
          phoneField.style.borderColor = "";
        }
      });
    }
    
    // ZIP validation
    const zipField = FieldsManager.$("zip");
    if (zipField) {
      zipField.addEventListener("blur", async () => {
        const region = await FieldsManager.getRegion();
        if (zipField.value && !FormValidator.validateZIP(zipField.value, region)) {
          zipField.style.borderColor = "red";
        } else {
          zipField.style.borderColor = "";
        }
      });
    }
    
    // TC validation
    const tcField = FieldsManager.$("tc");
    if (tcField) {
      tcField.addEventListener("blur", () => {
        if (tcField.value && !FormValidator.validateTC(tcField.value)) {
          tcField.style.borderColor = "red";
        } else {
          tcField.style.borderColor = "";
        }
      });
    }
    
    // Card number validation
    const cardNumberField = FieldsManager.$("cardNumber");
    if (cardNumberField) {
      cardNumberField.addEventListener("blur", () => {
        if (cardNumberField.value && !FormValidator.validateCardNumber(cardNumberField.value)) {
          cardNumberField.style.borderColor = "red";
        } else {
          cardNumberField.style.borderColor = "";
        }
      });
    }
    
    // Card expiration validation
    const cardExpField = FieldsManager.$("cardExp");
    if (cardExpField) {
      cardExpField.addEventListener("blur", () => {
        if (cardExpField.value && !FormValidator.validateExpDate(cardExpField.value)) {
          cardExpField.style.borderColor = "red";
        } else {
          cardExpField.style.borderColor = "";
        }
      });
    }
    
    // CVV validation
    const cardCVVField = FieldsManager.$("cardCVV");
    if (cardCVVField) {
      cardCVVField.addEventListener("blur", () => {
        if (cardCVVField.value && !FormValidator.validateCVV(cardCVVField.value)) {
          cardCVVField.style.borderColor = "red";
        } else {
          cardCVVField.style.borderColor = "";
        }
      });
    }
  },
  
  // Save settings handler
  saveSettings: async () => {
    if (await FormValidator.validateForm()) {
      const saved = await FieldsManager.saveFieldValues();
      
      if (saved) {
        // Automatically fill form if on Tesla page
        if (window.opener && window.opener.location.href.includes("tesla.com")) {
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0] && tabs[0].url.includes("tesla.com")) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "fillForm" });
            }
          });
        }
      }
    }
  }
};

// Initialize on DOM content loaded
document.addEventListener("DOMContentLoaded", () => {
  SettingsController.initialize();
});