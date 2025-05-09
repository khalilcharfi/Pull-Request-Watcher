document.addEventListener('DOMContentLoaded', () => {
  // Browser compatibility check - ensure 'browser' is available or fall back to 'chrome'
  const getBrowserAPI = () => {
    return typeof browser !== 'undefined' ? browser : chrome;
  };
  
  // Get browser API reference
  const browserAPI = getBrowserAPI();

  // Safe wrapper for browser API calls
  const safeSendMessage = (message, callback) => {
    try {
      console.log("[DEBUG] Sending message to background:", message);
      
      // Add an error handler to catch potential connection issues
      const handleError = (err) => {
        console.error("Error sending message:", err);
        if (callback && typeof callback === 'function') {
          callback({ success: false, error: err.message || "Failed to connect" });
        }
      };

      if (typeof browser !== 'undefined' && browser.runtime) {
        // Firefox uses promises
        browser.runtime.sendMessage(message)
          .then(response => {
            console.log("[DEBUG] Firefox response received:", response);
            if (callback && typeof callback === 'function') {
              callback(response);
            }
          })
          .catch(handleError);
      } else {
        // Chrome uses callbacks
        chrome.runtime.sendMessage(message, (response) => {
          // Check for runtime error
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            handleError(lastError);
          } else {
            console.log("[DEBUG] Chrome response received:", response);
            if (callback && typeof callback === 'function') {
              callback(response);
            }
          }
        });
      }
    } catch (err) {
      console.error("Exception sending message:", err);
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
      
      // Add a fallback to trigger the loading to end in case of connection failure
      const overlay = document.getElementById('loading-overlay');
      if (overlay && !overlay.classList.contains('hidden')) {
        setTimeout(() => {
          state.loading = false;
          hideLoadingOverlay();
          
          // Show error message in the list
          const prList = document.getElementById('pr-list');
          if (prList) {
            prList.innerHTML = `
              <div class="empty-state">
                ${ICONS.no_data}
                <p>Connection error</p>
                <p class="empty-subtitle">Could not connect to extension background service</p>
                <p class="empty-subtitle">Try refreshing the popup</p>
                <button id="debug-btn" style="margin-top:15px;padding:8px 15px;background-color:var(--primary-blue);color:white;border:none;border-radius:4px;cursor:pointer;">
                  Debug Storage
                </button>
              </div>
            `;
            
            // Add event listener to the debug button
            setTimeout(() => {
              const debugBtn = document.getElementById('debug-btn');
              if (debugBtn) {
                debugBtn.addEventListener('click', debugStorage);
              }
            }, 100);
          }
        }, 3000);
      }
    }
  };
  
  // Safe wrapper for creating tabs
  const safeCreateTab = (options) => {
    try {
      browserAPI.tabs.create(options).catch(err => {
        console.log("Error creating tab:", err);
      });
    } catch (err) {
      console.log("Error creating tab:", err);
    }
  };

  const prListElement = document.getElementById('pr-list');
  
  // Define optimized SVG icons with consistent sizing
  const ICONS = {
    visibility: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
    thumb_up: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>',
    check_circle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
    tab: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h10v4h8v10z"/></svg>',
    close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    refresh: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    speaker_notes_off: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-empty" aria-hidden="true"><path d="M10.54 11l-.54-.54L7.54 8 6 6.46 2.38 2.84 1.27 1.73 0 3l2.01 2.01L2 22l4-4h9l5.73 5.73L22 22.46 17.54 18l-7-7zM8 14H6v-2h2v2zm-2-3V9l2 2H6zm14-9H4.08L10 7.92V6h8v2h-7.92l1 1H18v2h-4.92l6.99 6.99C21.14 17.95 22 17.08 22 16V4c0-1.1-.9-2-2-2z"/></svg>',
    hourglass_empty: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-empty" aria-hidden="true"><path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"/></svg>',
    search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>',
    filter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon" aria-hidden="true"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>',
    logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="logo-icon" aria-hidden="true"><path d="M15 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zM3 12c0-2.61 1.67-4.83 4-5.65V4.26C3.55 5.15 1 8.27 1 12c0 3.73 2.55 6.85 6 7.74v-2.09c-2.33-.82-4-3.04-4-5.65z"/></svg>',
    no_data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-empty" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0 1 12 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0 1 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/></svg>'
  };
  
  // Initialize state management for the UI
  const state = {
    prs: [],
    filter: {
      text: '',
      showApproved: true,
      showPending: true
    },
    loading: true,
    lastUpdated: null
  };

  // Create app structure with optimized layout
  function createAppStructure() {
    const appElement = document.getElementById('app');
    
    // Create header
    const header = document.createElement('header');
    header.className = 'header';
    
    // Create logo container
    const logoContainer = document.createElement('div');
    logoContainer.className = 'logo-container';
    
    // Add logo
    const logo = document.createElement('div');
    logo.className = 'logo';
    logo.innerHTML = `${ICONS.logo} <span>PR Tracker</span>`;
    
    // Status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'status-indicator';
    statusIndicator.className = 'status-indicator hidden';
    statusIndicator.textContent = 'Updated';
    
    logoContainer.appendChild(logo);
    logoContainer.appendChild(statusIndicator);
    
    // Create search and filter section
    const searchBar = document.createElement('div');
    searchBar.className = 'search-bar';
    
    // Search input
    searchBar.innerHTML = `
      <div class="search-input">
        ${ICONS.search}
        <input type="text" id="search-input" placeholder="Search PRs..." aria-label="Search pull requests" disabled>
      </div>
      <div class="filter-controls">
        <button id="filter-button" class="filter-button" aria-label="Filter options" title="Filter options" disabled>
          ${ICONS.filter}
        </button>
        <div id="filter-dropdown" class="filter-dropdown hidden">
          <label class="filter-option">
            <input type="checkbox" id="show-approved" checked>
            <span>Show approved</span>
          </label>
          <label class="filter-option">
            <input type="checkbox" id="show-pending" checked>
            <span>Show pending</span>
          </label>
        </div>
      </div>
      <button id="refresh-button" class="refresh-button" aria-label="Refresh PR list" title="Refresh PR list">
        ${ICONS.refresh}
      </button>
    `;
    
    // Append elements to header
    header.appendChild(logoContainer);
    header.appendChild(searchBar);
    
    // Add stats counter
    const statsBar = document.createElement('div');
    statsBar.className = 'stats-bar';
    statsBar.innerHTML = '<span id="pr-count"></span>';
    header.appendChild(statsBar);
    
    // Insert header before PR list
    appElement.insertBefore(header, prListElement);
  }

  // Show loading overlay with custom message
  function showLoadingOverlay(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = overlay.querySelector('p');
    messageEl.textContent = message;
    overlay.classList.remove('hidden');
  }
  
  // Hide loading overlay
  function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
  }

  // Initialize the app
  function initApp() {
    createAppStructure();
    setupEventListeners();
    showLoadingOverlay('Loading PRs...');
    
    // Add a manual debug button to the header
    const headerEl = document.querySelector('.header');
    if (headerEl) {
      const debugButton = document.createElement('button');
      debugButton.textContent = 'Debug Storage';
      debugButton.style.marginLeft = '10px';
      debugButton.style.padding = '4px 8px';
      debugButton.style.fontSize = '10px';
      debugButton.style.backgroundColor = 'var(--primary-blue)';
      debugButton.style.color = 'white';
      debugButton.style.border = 'none';
      debugButton.style.borderRadius = '4px';
      debugButton.style.cursor = 'pointer';
      debugButton.addEventListener('click', debugStorage);
      headerEl.appendChild(debugButton);
    }
    
    // First check if the background script is alive
    pingBackgroundScript(() => {
      loadPRStats();
    });
  }
  
  // Setup all event listeners
  function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
      state.filter.text = searchInput.value.toLowerCase();
      renderFilteredPRs();
    });
    
    // Filter button toggle
    const filterButton = document.getElementById('filter-button');
    const filterDropdown = document.getElementById('filter-dropdown');
    
    filterButton.addEventListener('click', (e) => {
      if (!filterButton.disabled) {
        e.stopPropagation();
        filterDropdown.classList.toggle('hidden');
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filter-controls')) {
        filterDropdown.classList.add('hidden');
      }
    });
    
    // Filter checkboxes
    const showApproved = document.getElementById('show-approved');
    const showPending = document.getElementById('show-pending');
    
    showApproved.addEventListener('change', () => {
      state.filter.showApproved = showApproved.checked;
      renderFilteredPRs();
    });
    
    showPending.addEventListener('change', () => {
      state.filter.showPending = showPending.checked;
      renderFilteredPRs();
    });
    
    // Refresh button
    const refreshButton = document.getElementById('refresh-button');
    refreshButton.addEventListener('click', () => {
      refreshButton.classList.add('rotating');
      const statusIndicator = document.getElementById('status-indicator');
      
      // Show loading overlay
      showLoadingOverlay('Refreshing PRs...');
      
      // Request a cleanup of unknown PR entries
      safeSendMessage({ action: "cleanupUnknown" }, () => {
        state.loading = true;
        
        loadPRStats(() => {
          refreshButton.classList.remove('rotating');
          hideLoadingOverlay();
          
          // Show status indicator briefly
          statusIndicator.classList.remove('hidden');
          statusIndicator.textContent = 'Updated';
          
          // Add timestamp to status indicator
          const now = new Date();
          const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          state.lastUpdated = timeString;
          
          setTimeout(() => {
            statusIndicator.classList.add('hidden');
          }, 2000);
        });
      });
    });
    
    // PR item click events using event delegation
    prListElement.addEventListener('click', handlePRItemClick);
  }
  
  // Function to toggle filter controls based on data availability
  function toggleFilterControls(hasData) {
    const searchInput = document.getElementById('search-input');
    const filterButton = document.getElementById('filter-button');
    
    if (hasData) {
      // Enable controls
      searchInput.disabled = false;
      filterButton.disabled = false;
      
      // Remove disabled UI classes
      searchInput.classList.remove('disabled');
      filterButton.classList.remove('disabled');
    } else {
      // Disable controls
      searchInput.disabled = true;
      filterButton.disabled = true;
      
      // Add disabled UI classes
      searchInput.classList.add('disabled');
      filterButton.classList.add('disabled');
      
      // Hide dropdown if open
      document.getElementById('filter-dropdown').classList.add('hidden');
      
      // Clear search input
      searchInput.value = '';
      state.filter.text = '';
    }
  }
  
  // Handle PR item clicks
  function handlePRItemClick(e) {
    const prItem = e.target.closest('.pr-item');
    const removeBtn = e.target.closest('.remove-btn');
    
    if (removeBtn) {
      // Handle remove button click
      e.stopPropagation();
      const prId = removeBtn.dataset.prId;
      
      showConfirmDialog({
        message: 'Remove this PR from your history?',
        onConfirm: () => {
          // Show loading overlay
          showLoadingOverlay('Removing PR...');
          
          // Remove PR from storage
          safeSendMessage({
            action: "removePR",
            prId: prId
          }, () => {
            // Remove item from UI
            const prItemToRemove = document.querySelector(`.pr-item[data-pr-id="${prId}"]`);
            if (prItemToRemove) prItemToRemove.remove();
            
            // Update the PR count in the UI
            state.prs = state.prs.filter(pr => pr.id !== prId);
            renderFilteredPRs();
            
            // Hide the overlay
            hideLoadingOverlay();
          });
        }
      });
      return;
    }
    
    if (prItem) {
      // Handle PR item click (open PR)
      const url = prItem.dataset.url;
      if (url) {
        safeCreateTab({ url });
      }
    }
  }
  
  // Show a confirmation dialog
  function showConfirmDialog({ message, onConfirm }) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <p>${message}</p>
      <div class="dialog-buttons">
        <button class="cancel-btn">Cancel</button>
        <button class="confirm-btn">Remove</button>
      </div>
    `;
    
    // Add to DOM
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Setup event handlers
    const cancelBtn = dialog.querySelector('.cancel-btn');
    const confirmBtn = dialog.querySelector('.confirm-btn');
    
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    confirmBtn.addEventListener('click', () => {
      onConfirm();
      document.body.removeChild(overlay);
    });
  }

  // Filter PRs based on current filter settings
  function filterPRs(prs) {
    console.log("[DEBUG] filterPRs input:", prs);
    console.log("[DEBUG] Current filter state:", state.filter);
    
    if (!prs || prs.length === 0) {
      console.log("[DEBUG] No PRs to filter");
      return [];
    }
    
    const filtered = prs.filter(pr => {
      // Apply text search filter
      const textMatch = state.filter.text === '' || 
        pr.title?.toLowerCase().includes(state.filter.text) ||
        pr.project?.toLowerCase().includes(state.filter.text) ||
        pr.repo?.toLowerCase().includes(state.filter.text) ||
        pr.prNumber?.toString().toLowerCase().includes(state.filter.text);
      
      // Apply approval filter
      const approvalMatch = 
        (pr.isApprovedByMe && state.filter.showApproved) ||
        (!pr.isApprovedByMe && state.filter.showPending);
      
      if (!textMatch) {
        console.log("[DEBUG] PR filtered out by text search:", pr.id);
      }
      if (!approvalMatch) {
        console.log("[DEBUG] PR filtered out by approval filter:", pr.id);
      }
      
      return textMatch && approvalMatch;
    });
    
    console.log("[DEBUG] filterPRs output:", filtered);
    return filtered;
  }
  
  // Render PRs based on current filter state
  function renderFilteredPRs() {
    console.log("[DEBUG] renderFilteredPRs called, state.prs:", state.prs);
    
    const filteredPRs = filterPRs(state.prs);
    console.log("[DEBUG] filteredPRs:", filteredPRs);
    
    renderPRList({ prs: filteredPRs });
    
    // Update PR count
    const prCountEl = document.getElementById('pr-count');
    if (prCountEl) {
      prCountEl.textContent = filteredPRs.length > 0 
        ? `Showing ${filteredPRs.length} of ${state.prs.length} PRs`
        : `No PRs match your filters`;
    }
  }
  
  // Render list of PRs - fixed function to ensure items are displayed properly
  function renderPRList({ prs }) {
    console.log("[DEBUG] renderPRList called with:", prs);
    
    if (!prListElement) {
      console.error("[DEBUG] prListElement is null or undefined");
      return;
    }
    
    prListElement.innerHTML = '';
    
    if (!prs || prs.length === 0) {
      console.log("[DEBUG] No PRs to display, showing empty state");
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        ${ICONS.no_data}
        <p>No pull requests to display</p>
        <p class="empty-subtitle">Review a PR on Bitbucket to start tracking</p>
        <button id="create-test-pr" style="margin-top:15px;padding:8px 15px;background-color:var(--primary-blue);color:white;border:none;border-radius:4px;cursor:pointer;">
          Create Test PR
        </button>
      `;
      prListElement.appendChild(emptyState);
      
      // Add listener to create test PR button
      setTimeout(() => {
        const createTestBtn = document.getElementById('create-test-pr');
        if (createTestBtn) {
          createTestBtn.addEventListener('click', createTestPR);
        }
      }, 100);
      
      return;
    }
    
    // Function to create test PR data for debugging
    function createTestPR() {
      const testPR = {
        id: 'pr-123',
        prNumber: '123',
        title: 'Test Pull Request',
        project: 'test-project',
        repo: 'test-repo',
        displayProject: 'Test Project',
        displayRepo: 'Test Repo',
        url: 'https://bitbucket.org/test-project/test-repo/pull-requests/123',
        status: 'open',
        isApprovedByMe: false,
        lastVisited: Date.now(),
        viewCount: 1,
        approvalCount: 0
      };
      
      // Add test PR to state
      state.prs = [testPR];
      
      // Store in local storage for persistence
      browserAPI.storage.local.set({
        'pr-123': { reviewCount: 1, approvalCount: 0, lastReviewed: Date.now() },
        'pr-info-pr-123': testPR
      }, () => {
        console.log("[DEBUG] Test PR created successfully");
        
        // Update PR cache
        browserAPI.storage.local.set({ 
          'pr_data_cache': {
            timestamp: Date.now(),
            data: { 'pr-123': testPR }
          }
        });
        
        // Render the list with the test PR
        renderFilteredPRs();
      });
    }
    
    // Enable filter controls when we have data
    toggleFilterControls(true);
    
    // Sort PRs: First by approval status (pending first), then by last visited (recent first)
    const sortedPRs = [...prs].sort((a, b) => {
      // First sort by status: merged/declined last
      if ((a.status === 'merged' || a.status === 'declined') && 
          (b.status !== 'merged' && b.status !== 'declined')) {
        return 1;
      }
      if ((b.status === 'merged' || b.status === 'declined') && 
          (a.status !== 'merged' && a.status !== 'declined')) {
        return -1;
      }
      
      // Then sort pending before approved
      if (!a.isApprovedByMe && b.isApprovedByMe) return -1;
      if (a.isApprovedByMe && !b.isApprovedByMe) return 1;
      
      // Then by last visit time (most recent first)
      return (b.lastVisited || 0) - (a.lastVisited || 0);
    });
    
    console.log("[DEBUG] Sorted PRs to render:", sortedPRs);
    
    // Add a container for the PR items to ensure proper styling
    const prContainer = document.createElement('div');
    prContainer.className = 'pr-items';
    prListElement.appendChild(prContainer);
    
    // Create PR items
    sortedPRs.forEach((pr, index) => {
      // Skip empty or invalid PRs
      if (!pr || !pr.title) {
        console.log("[DEBUG] Skipping invalid PR:", pr);
        return;
      }
      
      try {
        console.log(`[DEBUG] Rendering PR ${index}:`, pr.title);
        
        const prItem = document.createElement('div');
        prItem.className = `pr-item ${pr.status || 'open'} ${pr.isApprovedByMe ? 'approved' : 'pending'}`;
        prItem.dataset.prId = pr.id;
        prItem.dataset.url = pr.url || '';
        
        // Add explicit styling to ensure visibility
        prItem.style.display = 'flex';
        prItem.style.padding = '10px';
        prItem.style.marginBottom = '8px';
        prItem.style.justifyContent = 'space-between';
        prItem.style.backgroundColor = 'white';
        prItem.style.border = '1px solid #e5e7eb';
        prItem.style.borderRadius = '4px';
        
        // Handle project truncation for long names
        let displayProject = pr.displayProject || pr.project || 'Unknown';
        let displayRepo = pr.displayRepo || pr.repo || 'Unknown';
        
        // Truncate long display names
        if (displayProject.length > 20) {
          displayProject = displayProject.substring(0, 18) + '...';
        }
        if (displayRepo.length > 20) {
          displayRepo = displayRepo.substring(0, 18) + '...';
        }
        
        // Format time string
        const timeAgo = getTimeAgo(pr.lastVisited || Date.now());
        
        // Build HTML with optimized rendering
        try {
          prItem.innerHTML = `
            <div class="pr-info" style="flex: 1;">
              <div class="pr-title" title="${pr.title || 'Untitled PR'}" style="font-weight: 500; margin-bottom: 4px;">${pr.title || 'Untitled PR'}</div>
              <div class="pr-project" title="${pr.project || 'Unknown'}/${pr.repo || 'Unknown'}" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">
                ${ICONS.folder} ${displayProject}/${displayRepo}
              </div>
              <div class="pr-meta" style="font-size: 10px; color: var(--text-secondary); display: flex; gap: 6px;">
                <span class="pr-number" title="PR #${pr.prNumber || 'unknown'}">
                  #${pr.prNumber || 'unknown'}
                </span>
                ${pr.status && pr.status !== 'open' ? `<span class="pr-status ${pr.status}">${pr.status}</span>` : ''}
                <span class="pr-time" title="Last visited: ${new Date(pr.lastVisited || 0).toLocaleString()}">
                  ${ICONS.calendar} ${timeAgo}
                </span>
              </div>
            </div>
            <div class="pr-stats" style="display: flex; gap: 10px; align-items: center;">
              <div class="stat" title="Views" style="display: flex; align-items: center;">
                ${ICONS.visibility}
                <span style="margin-left: 3px;">${pr.viewCount || 0}</span>
              </div>
              <div class="stat" title="Approved" style="display: flex; align-items: center;">
                ${ICONS.thumb_up}
                <span style="margin-left: 3px;">${pr.approvalCount || 0}</span>
              </div>
              <button class="remove-btn" data-pr-id="${pr.id}" title="Remove from history" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary);">${ICONS.close}</button>
            </div>
          `;
          
          console.log(`[DEBUG] PR ${index} HTML generated`);
        } catch (err) {
          console.error("[DEBUG] Error generating PR HTML:", err);
          prItem.textContent = `Error rendering PR: ${pr.title || 'Unknown'}`;
        }
        
        // Explicitly append to prContainer
        prContainer.appendChild(prItem);
        console.log(`[DEBUG] PR ${index} rendered and added to DOM`);
      } catch (err) {
        console.error("[DEBUG] Error rendering PR:", err, pr);
      }
    });
    
    console.log("[DEBUG] Final PR list HTML:", prListElement.innerHTML);
    
    // Delay to ensure DOM is updated before setting up keyboard navigation
    setTimeout(() => {
      // Setup keyboard navigation
      setupKeyboardNavigation();
      console.log("[DEBUG] Keyboard navigation setup complete");
    }, 100);
  }
  
  // Get formatted time ago string
  function getTimeAgo(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    // Less than a minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    // Less than a week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
    
    // Format as date
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  
  // Setup keyboard navigation
  function setupKeyboardNavigation() {
    const prItems = document.querySelectorAll('.pr-item');
    if (prItems.length === 0) return;
    
    // Initial focus setup
    let focusedIndex = -1;
    
    // Setup key handler
    document.addEventListener('keydown', (e) => {
      // Skip if we're in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Get fresh PR items list
      const updatedPrItems = document.querySelectorAll('.pr-item');
      if (updatedPrItems.length === 0) return;
      
      // Refresh selections
      const currentFocused = document.querySelector('.pr-item:focus');
      if (currentFocused) {
        Array.from(updatedPrItems).forEach((item, i) => {
          if (item === currentFocused) {
            focusedIndex = i;
          }
        });
      }
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusedIndex = Math.min(focusedIndex + 1, updatedPrItems.length - 1);
          updatedPrItems[focusedIndex].focus();
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          focusedIndex = Math.max(focusedIndex - 1, 0);
          updatedPrItems[focusedIndex].focus();
          break;
          
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const url = updatedPrItems[focusedIndex].dataset.url;
            if (url) {
              safeCreateTab({ url });
            }
          }
          break;
          
        default:
          break;
      }
    });
    
    // Make PR items focusable
    prItems.forEach(item => {
      item.setAttribute('tabindex', '0');
    });
  }
  
  // Function to load PR stats from storage
  function loadPRStats(callback) {
    let messageTimeout = setTimeout(() => {
      console.warn("[DEBUG] loadPRStats timed out after 5 seconds");
      // Try to use the cached data as a fallback
      tryUsingCachedData(() => {
        state.loading = false;
        hideLoadingOverlay();
        renderPRList({ prs: [] });
        
        // Show error message with debug button
        const prList = document.getElementById('pr-list');
        if (prList) {
          prList.innerHTML = `
            <div class="empty-state">
              ${ICONS.no_data}
              <p>Connection timed out</p>
              <p class="empty-subtitle">Please try again</p>
              <button id="debug-storage-btn" style="margin-top:15px;padding:8px 15px;background-color:var(--primary-blue);color:white;border:none;border-radius:4px;cursor:pointer;">
                Debug Storage
              </button>
            </div>
          `;
          
          // Add event listener to the debug button
          setTimeout(() => {
            const debugBtn = document.getElementById('debug-storage-btn');
            if (debugBtn) {
              debugBtn.addEventListener('click', debugStorage);
            }
          }, 100);
        }
        
        if (typeof callback === 'function') {
          callback();
        }
      });
    }, 5000);
    
    console.log("[DEBUG] Starting loadPRStats...");
    
    // First try to load from the cache for immediate response
    tryUsingCachedData((hasCachedData) => {
      if (hasCachedData) {
        console.log("[DEBUG] Used cached data, loading complete");
        clearTimeout(messageTimeout); 
        if (typeof callback === 'function') {
          callback();
        }
        return;
      }
      
      // If no cached data, continue with normal loading
      // Clean up undefined PRs first (defensive coding)
      safeSendMessage({
        action: "removePR",
        prId: "undefined"
      }, () => {
        console.log("[DEBUG] Removed undefined PRs, getting all PR stats...");
        
        // Get all PR stats from storage
        safeSendMessage({ action: "getAllPRStats" }, response => {
          clearTimeout(messageTimeout);
          console.log("[DEBUG] getAllPRStats response:", response);
          
          if (response && response.success && response.prs) {
            try {
              console.log("[DEBUG] PR data keys:", Object.keys(response.prs));
              
              // Transform data structure for easier rendering
              const prArray = Object.keys(response.prs || {}).map(key => {
                const pr = response.prs[key];
                if (!pr) {
                  console.log("[DEBUG] Null PR for key:", key);
                  return null;
                }
                
                console.log("[DEBUG] Processing PR:", key, pr);
                return {
                  ...pr,
                  id: key,
                  prNumber: pr.prNumber || key.replace('pr-', '')
                };
              }).filter(Boolean); // Remove null entries
              
              console.log("[DEBUG] Processed PR array:", prArray);
              
              // Update state
              state.prs = prArray;
              state.loading = false;
              
              // Render the PR list
              renderFilteredPRs();
              
              // Hide loading overlay
              hideLoadingOverlay();
              
              // Execute callback if provided
              if (typeof callback === 'function') {
                callback();
              }
            } catch (err) {
              console.error("[DEBUG] Error processing PR data:", err);
              handleLoadError();
            }
          } else {
            console.warn("[DEBUG] No PRs found or invalid response:", response);
            handleLoadError();
          }
        });
      });
    });
    
    function tryUsingCachedData(callback) {
      console.log("[DEBUG] Trying to use cached data...");
      const browserAPI = getBrowserAPI();
      
      browserAPI.storage.local.get(['pr_data_cache'], (result) => {
        if (result.pr_data_cache && result.pr_data_cache.data) {
          console.log("[DEBUG] Found cached data from:", new Date(result.pr_data_cache.timestamp));
          
          const cachedPrs = result.pr_data_cache.data;
          // Get array of PR objects from the cache
          const prArray = Object.keys(cachedPrs).map(key => {
            return {
              ...cachedPrs[key],
              id: key
            };
          }).filter(pr => pr && pr.title);
          
          if (prArray.length > 0) {
            console.log("[DEBUG] Using cached data:", prArray.length, "PRs");
            // Update state with cached data
            state.prs = prArray;
            state.loading = false;
            
            // Render the PR list
            renderFilteredPRs();
            
            // Hide loading overlay
            hideLoadingOverlay();
            
            if (callback) callback(true);
            return;
          }
        }
        console.log("[DEBUG] No usable cached data found");
        if (callback) callback(false);
      });
    }
    
    function handleLoadError() {
      console.log("[DEBUG] In handleLoadError");
      // Try to use cached data as fallback
      tryUsingCachedData((hasCachedData) => {
        if (!hasCachedData) {
          state.loading = false;
          hideLoadingOverlay();
          state.prs = [];
          renderPRList({ prs: [] });
        }
        
        if (typeof callback === 'function') {
          callback();
        }
      });
    }
  }
  
  // Function to directly debug what's in storage
  function debugStorage() {
    console.log("[DEBUG] Attempting to directly access storage...");
    
    try {
      const browserAPI = getBrowserAPI();
      browserAPI.storage.local.get(null, (items) => {
        console.log("[DEBUG] Direct storage access result:", items);
        
        if (items && Object.keys(items).length > 0) {
          // Show raw storage data
          let storageInfo = document.createElement('div');
          storageInfo.className = 'storage-debug-info';
          storageInfo.style.marginTop = '20px';
          storageInfo.style.padding = '10px';
          storageInfo.style.backgroundColor = '#f5f5f5';
          storageInfo.style.borderRadius = '4px';
          storageInfo.style.maxHeight = '300px';
          storageInfo.style.overflow = 'auto';
          storageInfo.style.textAlign = 'left';
          
          storageInfo.innerHTML = `
            <h3 style="font-size:14px;margin-bottom:10px;">Raw Storage Data:</h3>
            <pre style="font-size:11px;white-space:pre-wrap;word-break:break-all;">${JSON.stringify(items, null, 2)}</pre>
          `;
          
          // Find PR info entries
          const prInfoEntries = Object.keys(items).filter(k => k.startsWith('pr-info-'));
          console.log("[DEBUG] PR info entries:", prInfoEntries);
          
          if (prInfoEntries.length > 0) {
            // Try to manually create PR items
            const manualPrs = prInfoEntries.map(key => {
              const prId = key.substring(8); // Remove 'pr-info-' prefix
              const stats = items[prId] || { reviewCount: 0, approvalCount: 0 };
              return {
                ...items[key],
                id: prId,
                prNumber: items[key].prNumber || prId.replace('pr-', ''),
                viewCount: stats.reviewCount || 0,
                approvalCount: stats.approvalCount || 0
              };
            }).filter(p => p && p.title); // Only keep valid PRs
            
            console.log("[DEBUG] Manually created PR list:", manualPrs);
            
            if (manualPrs.length > 0) {
              // Show option to use manually created list
              const useManualBtn = document.createElement('button');
              useManualBtn.textContent = 'Use Available Data';
              useManualBtn.style.marginTop = '10px';
              useManualBtn.style.padding = '8px 15px';
              useManualBtn.style.backgroundColor = 'var(--success-green)';
              useManualBtn.style.color = 'white';
              useManualBtn.style.border = 'none';
              useManualBtn.style.borderRadius = '4px';
              useManualBtn.style.cursor = 'pointer';
              
              useManualBtn.addEventListener('click', () => {
                // Update state with manual data
                state.prs = manualPrs;
                state.loading = false;
                renderFilteredPRs();
              });
              
              storageInfo.appendChild(useManualBtn);
            } else {
              // Option to create a test PR
              const createTestBtn = document.createElement('button');
              createTestBtn.textContent = 'Create Test PR';
              createTestBtn.style.marginTop = '10px';
              createTestBtn.style.padding = '8px 15px';
              createTestBtn.style.backgroundColor = 'var(--primary-blue)';
              createTestBtn.style.color = 'white';
              createTestBtn.style.border = 'none';
              createTestBtn.style.borderRadius = '4px';
              createTestBtn.style.cursor = 'pointer';
              
              createTestBtn.addEventListener('click', function() {
                const testPR = {
                  title: 'Test Pull Request',
                  project: 'test-project',
                  repo: 'test-repo',
                  displayProject: 'Test Project',
                  displayRepo: 'Test Repo',
                  url: 'https://bitbucket.org/test-project/test-repo/pull-requests/123',
                  status: 'open',
                  isApprovedByMe: false,
                  lastVisited: Date.now(),
                  viewCount: 1,
                  approvalCount: 0
                };
                
                browserAPI.storage.local.set({
                  'pr-123': { reviewCount: 1, approvalCount: 0, lastReviewed: Date.now() },
                  'pr-info-pr-123': testPR
                }, () => {
                  alert('Test PR created! Reload the popup to see it.');
                });
              });
              
              storageInfo.appendChild(createTestBtn);
            }
          } else {
            // No PR entries found, offer to create test data
            const createTestBtn = document.createElement('button');
            createTestBtn.textContent = 'Create Test PR';
            createTestBtn.style.marginTop = '10px';
            createTestBtn.style.padding = '8px 15px';
            createTestBtn.style.backgroundColor = 'var(--primary-blue)';
            createTestBtn.style.color = 'white';
            createTestBtn.style.border = 'none';
            createTestBtn.style.borderRadius = '4px';
            createTestBtn.style.cursor = 'pointer';
            
            createTestBtn.addEventListener('click', function() {
              const testPR = {
                title: 'Test Pull Request',
                project: 'test-project',
                repo: 'test-repo',
                displayProject: 'Test Project',
                displayRepo: 'Test Repo',
                url: 'https://bitbucket.org/test-project/test-repo/pull-requests/123',
                status: 'open',
                isApprovedByMe: false,
                lastVisited: Date.now()
              };
              
              browserAPI.storage.local.set({
                'pr-123': { reviewCount: 1, approvalCount: 0, lastReviewed: Date.now() },
                'pr-info-pr-123': testPR
              }, () => {
                alert('Test PR created! Reload the popup to see it.');
              });
            });
            
            storageInfo.appendChild(createTestBtn);
          }
          
          // Get the PR list or empty state container
          const container = document.querySelector('.empty-state') || document.getElementById('pr-list');
          if (container) {
            container.appendChild(storageInfo);
          }
        } else {
          console.log("[DEBUG] No data found in storage");
          alert("No data found in storage. Want to create a test PR?");
          
          // Create test PR option
          const testPR = {
            title: 'Test Pull Request',
            project: 'test-project',
            repo: 'test-repo',
            displayProject: 'Test Project',
            displayRepo: 'Test Repo',
            url: 'https://bitbucket.org/test-project/test-repo/pull-requests/123',
            status: 'open',
            isApprovedByMe: false,
            lastVisited: Date.now()
          };
          
          if (confirm("Create a test PR for debugging?")) {
            browserAPI.storage.local.set({
              'pr-123': { reviewCount: 1, approvalCount: 0, lastReviewed: Date.now() },
              'pr-info-pr-123': testPR
            }, () => {
              alert('Test PR created! Reload the popup to see it.');
            });
          }
        }
      });
    } catch (err) {
      console.error("[DEBUG] Error accessing storage directly:", err);
      alert("Error accessing storage: " + err.message);
    }
  }
  
  // Check if the background script is responsive
  function pingBackgroundScript(callback) {
    console.log("[DEBUG] Pinging background script...");
    
    let pingTimeout = setTimeout(() => {
      console.error("[DEBUG] Background script ping timed out!");
      
      // Update the loading message to indicate the issue
      const overlay = document.getElementById('loading-overlay');
      const messageEl = overlay.querySelector('p');
      if (messageEl) {
        messageEl.textContent = "Cannot connect to extension background service. Please try reloading.";
      }
      
      // Add a reload button
      const spinner = overlay.querySelector('.spinner');
      if (spinner) {
        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'reload-btn';
        reloadBtn.textContent = 'Reload Extension';
        reloadBtn.style.marginTop = '15px';
        reloadBtn.style.padding = '8px 15px';
        reloadBtn.style.border = 'none';
        reloadBtn.style.borderRadius = '4px';
        reloadBtn.style.backgroundColor = 'var(--primary-blue)';
        reloadBtn.style.color = 'white';
        reloadBtn.style.cursor = 'pointer';
        
        reloadBtn.addEventListener('click', () => {
          location.reload();
        });
        
        spinner.after(reloadBtn);
      }
    }, 3000);
    
    safeSendMessage({ action: "ping" }, response => {
      clearTimeout(pingTimeout);
      
      if (response && response.success) {
        console.log("[DEBUG] Background script responded:", response.message);
        if (typeof callback === 'function') {
          callback();
        }
      } else {
        console.error("[DEBUG] Background script ping failed:", response);
        // Show error in overlay
        const overlay = document.getElementById('loading-overlay');
        const messageEl = overlay.querySelector('p');
        if (messageEl) {
          messageEl.textContent = "Background service error. Please reload extension.";
        }
      }
    });
  }
  
  // Initialize app on DOMContentLoaded
  initApp();
});