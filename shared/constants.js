/**
 * Tesla Inventory Monitor - Constants
 */

export const CONFIG = {
    API: {
        TIMEOUT: 30000,
        MAX_RETRIES: 3,
        ENDPOINTS: {
            INVENTORY: 'https://www.tesla.com/inventory/api/v1/inventory-results',
            ORDER: 'https://www.tesla.com/inventory/api/v1/orders'
        }
    },
    REGIONS: {
        TR: {
            baseUrl: 'https://www.tesla.com/tr_tr',
            currency: 'TRY',
            language: 'tr',
            dateFormat: 'DD.MM.YYYY'
        },
        US: {
            baseUrl: 'https://www.tesla.com/en_us',
            currency: 'USD',
            language: 'en',
            dateFormat: 'MM/DD/YYYY'
        }
    },
    MODELS: {
        ms: 'Model S',
        m3: 'Model 3',
        mx: 'Model X',
        my: 'Model Y',
        ct: 'Cybertruck'
    },
    TRIMS: {
        PAWD: 'Performance All-Wheel Drive',
        LRAWD: 'Long Range All-Wheel Drive',
        LRRWD: 'Long Range Rear-Wheel Drive'
    },
    DEFAULT_VALUES: {
        TR: {
            zip: '34000',
            range: 100,
            priceMin: '1590000',
            priceMax: '3500000'
        },
        US: {
            zip: '94043',
            range: 200,
            priceMin: '45000',
            priceMax: '100000'
        }
    }
};

export const STORAGE_KEYS = {
    SETTINGS: 'settings',
    LAST_SEARCH: 'lastSearch',
    FORM_DATA: 'formData',
    WATCH_LIST: 'watchList'
};
