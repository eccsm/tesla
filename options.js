// Tesla Inventory Monitor - Options Page Logic

document.addEventListener('DOMContentLoaded', () => {
    const regionInput = document.getElementById('region');
    const modelInput = document.getElementById('model');
    const conditionInput = document.getElementById('condition');
    const priceMinInput = document.getElementById('priceMin');
    const priceMaxInput = document.getElementById('priceMax');
    const zipInput = document.getElementById('zip');
    const rangeInput = document.getElementById('range');
    const notification = document.getElementById('notification');
    const optionsForm = document.getElementById('optionsForm');

    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const countryCodeInput = document.getElementById('countryCode');
    
    // Shipping address fields
    const shippingAddressInput = document.getElementById('shippingAddress');
    const shippingAptInput = document.getElementById('shippingApt');
    const shippingCityInput = document.getElementById('shippingCity');
    const shippingStateInput = document.getElementById('shippingState');
    const shippingZipInput = document.getElementById('shippingZip');
    
    // Payment information fields
    const cardNumberInput = document.getElementById('cardNumber');
    const expirationMonthInput = document.getElementById('expirationMonth');
    const expirationYearInput = document.getElementById('expirationYear');
    const securityCodeInput = document.getElementById('securityCode');
    const billingZipInput = document.getElementById('billingZip');
    
    const saveAccountDetailsButton = document.getElementById('saveAccountDetailsButton');
    const accountDetailsNotification = document.getElementById('accountDetailsNotification');

    // Load settings from storage
    chrome.storage.local.get('settings', (data) => {
        const settings = data.settings || {};
        if (settings.region) regionInput.value = settings.region;
        if (settings.model) modelInput.value = settings.model;
        if (settings.condition) conditionInput.value = settings.condition;
        if (settings.priceMin) priceMinInput.value = settings.priceMin;
        if (settings.priceMax) priceMaxInput.value = settings.priceMax;
        if (settings.zip) zipInput.value = settings.zip;
        if (settings.range) rangeInput.value = settings.range;
    });

    // Load saved account details
    chrome.storage.local.get('accountDetails', (data) => {
        if (data.accountDetails) {
            // Basic account details
            firstNameInput.value = data.accountDetails.firstName || '';
            lastNameInput.value = data.accountDetails.lastName || '';
            emailInput.value = data.accountDetails.email || '';
            phoneInput.value = data.accountDetails.phone || '';
            countryCodeInput.value = data.accountDetails.countryCode || '';
            
            // Shipping address
            if (shippingAddressInput) shippingAddressInput.value = data.accountDetails.shippingAddress || '';
            if (shippingAptInput) shippingAptInput.value = data.accountDetails.shippingApt || '';
            if (shippingCityInput) shippingCityInput.value = data.accountDetails.shippingCity || '';
            if (shippingStateInput) shippingStateInput.value = data.accountDetails.shippingState || '';
            if (shippingZipInput) shippingZipInput.value = data.accountDetails.shippingZip || '';
            
            // Payment information
            if (cardNumberInput) cardNumberInput.value = data.accountDetails.cardNumber || '';
            if (expirationMonthInput) expirationMonthInput.value = data.accountDetails.expirationMonth || '';
            if (expirationYearInput) expirationYearInput.value = data.accountDetails.expirationYear || '';
            if (securityCodeInput) securityCodeInput.value = data.accountDetails.securityCode || '';
            if (billingZipInput) billingZipInput.value = data.accountDetails.billingZip || '';
        }
    });

    // Save settings
    optionsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const settings = {
            region: regionInput.value,
            model: modelInput.value,
            condition: conditionInput.value,
            priceMin: priceMinInput.value,
            priceMax: priceMaxInput.value,
            zip: zipInput.value,
            range: rangeInput.value
        };
        chrome.storage.local.set({ settings }, () => {
            notification.textContent = 'Settings saved!';
            setTimeout(() => notification.textContent = '', 2000);
        });
    });

    // Save account details
    if (saveAccountDetailsButton) {
        saveAccountDetailsButton.addEventListener('click', () => {
            const accountDetails = {
                // Basic account details
                firstName: firstNameInput.value.trim(),
                lastName: lastNameInput.value.trim(),
                email: emailInput.value.trim(),
                phone: phoneInput.value.trim(),
                countryCode: countryCodeInput.value.trim(),
                
                // Shipping address
                shippingAddress: shippingAddressInput ? shippingAddressInput.value.trim() : '',
                shippingApt: shippingAptInput ? shippingAptInput.value.trim() : '',
                shippingCity: shippingCityInput ? shippingCityInput.value.trim() : '',
                shippingState: shippingStateInput ? shippingStateInput.value.trim() : '',
                shippingZip: shippingZipInput ? shippingZipInput.value.trim() : '',
                
                // Payment information
                cardNumber: cardNumberInput ? cardNumberInput.value.trim() : '',
                expirationMonth: expirationMonthInput ? expirationMonthInput.value : '',
                expirationYear: expirationYearInput ? expirationYearInput.value : '',
                securityCode: securityCodeInput ? securityCodeInput.value.trim() : '',
                billingZip: billingZipInput ? billingZipInput.value.trim() : ''
            };
            chrome.storage.local.set({ accountDetails }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving account details:", chrome.runtime.lastError.message);
                    accountDetailsNotification.textContent = 'Error saving details: ' + chrome.runtime.lastError.message;
                    accountDetailsNotification.className = 'notification error';
                } else {
                    accountDetailsNotification.textContent = 'Account details saved successfully!';
                    accountDetailsNotification.className = 'notification success';
                }
                accountDetailsNotification.style.display = 'block';
                setTimeout(() => { accountDetailsNotification.style.display = 'none'; }, 3000);
            });
        });
    }
});
