// Tesla Inventory Monitor - Logs Page Handler

document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const logsContainer = document.getElementById('logs-container');
  const emptyState = document.getElementById('empty-state');
  const refreshBtn = document.getElementById('refresh-btn');
  const exportBtn = document.getElementById('export-btn');
  const clearRecentBtn = document.getElementById('clear-recent-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');
  const backButton = document.getElementById('back-button');
  const filterType = document.getElementById('filter-type');
  const filterDate = document.getElementById('filter-date');
  const filterLimit = document.getElementById('filter-limit');
  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  
  // Modal elements
  const logModal = document.getElementById('log-modal');
  const logDetails = document.getElementById('log-details');
  const closeModalBtn = document.querySelector('.close');
  
  // Default filter options
  let filterOptions = {
    type: '',
    startDate: '',
    limit: 100
  };
  
  // Initialize the date picker with a default date (30 days ago)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  filterDate.valueAsDate = thirtyDaysAgo;
  filterOptions.startDate = thirtyDaysAgo.toISOString();
  
  // Initial logs load
  loadLogs();
  
  // Refresh button click handler
  refreshBtn.addEventListener('click', () => {
    loadLogs();
  });
  
  // Export button click handler
  exportBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'exportMonitoringLogs' }, (response) => {
      if (response && response.success) {
        // Create a downloadable JSON file
        const blob = new Blob([response.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tesla_monitor_logs_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('Failed to export logs.');
      }
    });
  });
  
  // Clear recent button click handler
  clearRecentBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear logs older than 24 hours?')) {
      chrome.runtime.sendMessage({ action: 'clearMonitoringLogs', clearAll: false }, (response) => {
        if (response && response.success) {
          loadLogs();
        } else {
          alert('Failed to clear logs.');
        }
      });
    }
  });
  
  // Clear all button click handler
  clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear ALL logs? This action cannot be undone.')) {
      chrome.runtime.sendMessage({ action: 'clearMonitoringLogs', clearAll: true }, (response) => {
        if (response && response.success) {
          loadLogs();
        } else {
          alert('Failed to clear logs.');
        }
      });
    }
  });
  
  // Back button click handler
  backButton.addEventListener('click', () => {
    window.location.href = 'popup.html';
  });
  
  // Filter apply button click handler
  applyFiltersBtn.addEventListener('click', () => {
    filterOptions.type = filterType.value;
    filterOptions.limit = parseInt(filterLimit.value);
    
    if (filterDate.value) {
      const selectedDate = new Date(filterDate.value);
      // Ensure the date is in UTC
      filterOptions.startDate = new Date(
        selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000
      ).toISOString();
    } else {
      filterOptions.startDate = '';
    }
    
    loadLogs();
  });
  
  // Modal close button click handler
  closeModalBtn.addEventListener('click', () => {
    logModal.style.display = 'none';
  });
  
  // Close modal when clicking outside of it
  window.addEventListener('click', (event) => {
    if (event.target == logModal) {
      logModal.style.display = 'none';
    }
  });
  
  /**
   * Load logs from background script with current filter options
   */
  function loadLogs() {
    chrome.runtime.sendMessage({
      action: 'getMonitoringLogs',
      options: filterOptions
    }, (response) => {
      if (response && response.success) {
        renderLogs(response.logs);
      } else {
        console.error('Failed to load logs:', response);
      }
    });
  }
  
  /**
   * Render logs to the DOM
   * @param {Array} logs - Array of log objects
   */
  function renderLogs(logs) {
    // Clear container
    logsContainer.innerHTML = '';
    
    // Show/hide empty state
    if (logs.length === 0) {
      emptyState.style.display = 'block';
      return;
    } else {
      emptyState.style.display = 'none';
    }
    
    // Render each log
    logs.forEach(log => {
      const row = document.createElement('tr');
      
      // Format timestamp
      const date = new Date(log.timestamp);
      const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      
      // Create log type pill
      let typeClass = '';
      let typeLabel = log.eventType;
      
      if (log.eventType.startsWith('monitoring_')) {
        typeClass = 'monitoring';
        typeLabel = log.eventType.replace('monitoring_', '');
      } else if (log.eventType.startsWith('inventory_')) {
        typeClass = 'inventory';
        typeLabel = log.eventType.replace('inventory_', '');
      } else if (log.eventType.startsWith('error_') || log.eventType.includes('error')) {
        typeClass = 'error';
        typeLabel = typeLabel.includes('error') ? typeLabel : 'error: ' + typeLabel;
      }
      
      // Format details preview
      let detailsPreview = '';
      if (log.details) {
        if (typeof log.details === 'object') {
          // Extract some key info for preview
          if (log.details.error) {
            detailsPreview = `Error: ${log.details.error}`;
          } else if (log.details.totalMatches !== undefined) {
            detailsPreview = `Found ${log.details.totalMatches} matches, showing ${log.details.resultCount}`;
          } else if (log.details.filters) {
            const model = log.details.filters.model || log.details.model || 'all';
            const region = log.details.filters.region || log.details.region || 'US';
            detailsPreview = `Model: ${model.toUpperCase()}, Region: ${region}`;
          } else {
            // Fallback to first few properties
            detailsPreview = Object.entries(log.details)
              .slice(0, 3)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
          }
        } else {
          detailsPreview = String(log.details);
        }
      }
      
      // Create row content
      row.innerHTML = `
        <td class="timestamp">${formattedDate}</td>
        <td class="log-type"><span class="pill ${typeClass}">${typeLabel}</span></td>
        <td class="details-cell">${detailsPreview}</td>
        <td><button class="view-details" data-log-id="${log.id}">View</button></td>
      `;
      
      logsContainer.appendChild(row);
      
      // Add click handler for the view button
      const viewButton = row.querySelector('.view-details');
      viewButton.addEventListener('click', () => {
        // Populate and show modal
        logDetails.textContent = JSON.stringify(log, null, 2);
        logModal.style.display = 'block';
      });
    });
  }
});
