// Offscreen script for Tesla Inventory Monitor
console.log("Offscreen document script loaded");

// Function to fetch Tesla inventory data using the v4 API endpoint
async function fetchTeslaInventory(query) {
  try {
    // Extract parameters from the query
    const model = query.query.model || 'my';
    const condition = query.query.condition || 'new';
    const marketFromPopup = query.query.region || 'US'; // Default to 'US' market

    let apiMarket = marketFromPopup;
    let apiLanguage = 'en';
    let apiSuperRegion = 'north america';
    let pathPrefix = '';
    let acceptLanguageHeader = 'en-US,en;q=0.9'; // Default
    let effectiveZip = query.query.zip; // Get zip from query input
    let effectiveRange = query.query.range; // Get range from query input

    if (marketFromPopup.toUpperCase() === 'TR') {
      apiLanguage = 'tr';
      apiSuperRegion = 'europe'; 
      pathPrefix = 'tr_TR/';
      acceptLanguageHeader = 'tr-TR,tr;q=0.9,en;q=0.8'; // Turkish preferred, then English
      
      // If no zip provided for TR, or if it's the generic US default, use a TR default
      if (!effectiveZip || effectiveZip === '90001') {
        effectiveZip = '34000'; // Example Istanbul postal code
      }
      // If no range provided for TR, or if it's the generic default, use TR specific default
      if (effectiveRange === undefined || effectiveRange === null || effectiveRange === 200) {
        effectiveRange = 100;
      }
    } else {
      // For other markets (e.g., US), apply general defaults if not provided
      if (!effectiveZip) {
        effectiveZip = '90001';
      }
      if (effectiveRange === undefined || effectiveRange === null) {
        effectiveRange = 200;
      }
    }
    
    // Construct dynamic Referer and x-tesla-user-agent headers
    const refererHeader = `https://www.tesla.com/${pathPrefix}inventory/${condition}/${model}`;
    const xTeslaUserAgentHeader = 'tesla-web/1.2.3'; // Placeholder, adjust if known specific value
    
    // Construct the API URL dynamically
    const apiUrl = `https://www.tesla.com/${pathPrefix}inventory/api/v4/inventory-results`;
    const fallbackApiUrl = `https://www.tesla.com/${pathPrefix}inventory/api/v3/inventory-results`;

    // Create the query object with the required parameters for v4 API
    const queryObj = {
      query: {
        model: model,
        condition: condition,
        options: {}, // Reinstated from live site observation
        arrangeby: "Price",
        order: "asc",
        market: apiMarket,
        language: apiLanguage,
        super_region: apiSuperRegion,
        zip: effectiveZip, // Use the determined effective zip
        range: effectiveRange, // Use the determined effective range
        isFalconDeliverySelectionEnabled: false
      },
      count: 50,
      offset: 0,
      outsideOffset: 0,
      outsideSearch: false
    };
    
    console.log(`Fetching Tesla inventory. Market: ${apiMarket}, Zip: ${effectiveZip}, Range: ${effectiveRange}`);
    console.log(`Using API URL: ${apiUrl}`);
    console.log(`Using Referer: ${refererHeader}`);
    console.log(`Using x-tesla-user-agent: ${xTeslaUserAgentHeader}`);
    console.log('Query Payload:', JSON.stringify(queryObj, null, 2));
    
    // Make the API request as a POST with JSON body
    let v4Response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': acceptLanguageHeader,
        'Referer': refererHeader,
        'x-tesla-user-agent': xTeslaUserAgentHeader
        // User-Agent and other sec-* headers are now set by declarativeNetRequest
      },
      body: JSON.stringify(queryObj)
    });
    
    let responseToProcess; // This will hold the successful response (either v4 or v3)

    // Check if the response is successful
    if (!v4Response.ok) {
      const v4Status = v4Response.status; // Capture v4 status
      console.error(`API (v4) returned status ${v4Status} for ${apiUrl}`);
      console.log(`Trying fallback API (v3): ${fallbackApiUrl}...`);
      
      let v3Response = await fetch(fallbackApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': acceptLanguageHeader,
          'Referer': refererHeader,
          'x-tesla-user-agent': xTeslaUserAgentHeader
          // User-Agent and other sec-* headers are now set by declarativeNetRequest
        },
        body: JSON.stringify(queryObj)
      });

      if (!v3Response.ok) {
        const v3Status = v3Response.status; // Capture v3 status
        const errorText = await v3Response.text();
        console.error(`Fallback API (v3) also failed with status ${v3Status} for ${fallbackApiUrl}. Response: ${errorText}`);
        throw new Error(`Both API endpoints failed: v4 returned ${v4Status}, v3 returned ${v3Status}`);
      }
      console.log('Successfully fetched inventory data from fallback API (v3)');
      responseToProcess = v3Response; // Use v3 response
    } else {
      console.log('Successfully fetched inventory data from primary API (v4)');
      responseToProcess = v4Response; // Use v4 response
    }
    
    const data = await responseToProcess.json();
    return data;

  } catch (error) {
    console.error("Error in fetchTeslaInventory:", error.message, error.stack);
    // Propagate a more specific error or the original error for the caller to handle
    // For example, if the error is a TypeError due to network failure, it might already be descriptive.
    // If it's our custom error from above, it's also descriptive.
    throw error; 
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Offscreen document received message:", message);
  if (message.target === 'offscreen' && message.action === 'fetchInventory') {
    fetchTeslaInventory(message.query)
      .then(data => {
        console.log("Offscreen fetch successful, sending data to background");
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error("Offscreen fetch failed:", error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates that the response will be sent asynchronously
  }
  return false; // No asynchronous response for other messages
});
