document.addEventListener('DOMContentLoaded', () => {
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
    loadPRStats();
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
      chrome.runtime.sendMessage({ action: "cleanupUnknown" }, () => {
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
          
          chrome.runtime.sendMessage({ 
            action: "removePR", 
            prId 
          }, () => {
            // Show status indicator
            const statusIndicator = document.getElementById('status-indicator');
            statusIndicator.textContent = 'PR removed';
            statusIndicator.classList.remove('hidden');
            
            loadPRStats(() => {
              hideLoadingOverlay();
              
              setTimeout(() => {
                statusIndicator.classList.add('hidden');
              }, 1500);
            });
          });
        }
      });
    } else if (prItem && !removeBtn) {
      // Handle PR item click - open PR
      const url = prItem.dataset.url;
      if (url) {
        // Apply visual feedback
        prItem.classList.add('pr-clicked');
        setTimeout(() => {
          chrome.tabs.create({ url });
        }, 150);
      }
    }
  }
  
  // Show confirmation dialog
  function showConfirmDialog({ message, onConfirm }) {
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'confirm-dialog';
    confirmDialog.innerHTML = `
      <div class="confirm-dialog-content">
        <p>${message}</p>
        <div class="confirm-buttons">
          <button class="btn btn-cancel">Cancel</button>
          <button class="btn btn-confirm">Remove</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(confirmDialog);
    
    // Add event listeners to dialog buttons
    confirmDialog.querySelector('.btn-cancel').addEventListener('click', () => {
      document.body.removeChild(confirmDialog);
    });
    
    confirmDialog.querySelector('.btn-confirm').addEventListener('click', () => {
      document.body.removeChild(confirmDialog);
      onConfirm();
    });
  }
  
  // Create filter function based on current state
  function filterPRs(prs) {
    return prs.filter(pr => {
      // Text search
      const searchText = state.filter.text;
      const matchesSearch = !searchText || 
        pr.info?.title?.toLowerCase().includes(searchText) ||
        pr.info?.project?.toLowerCase().includes(searchText) ||
        pr.info?.repo?.toLowerCase().includes(searchText) ||
        pr.prNumber?.toLowerCase().includes(searchText);
      
      // Approval status
      const isApproved = pr.info?.isApprovedByMe === true;
      const matchesApproval = (isApproved && state.filter.showApproved) || 
                             (!isApproved && state.filter.showPending);
      
      return matchesSearch && matchesApproval;
    });
  }
  
  // Render filtered PRs based on current state
  function renderFilteredPRs() {
    const filteredPRs = filterPRs(state.prs);
    renderPRList({ prs: filteredPRs });
    
    // Update the PR count in the stats bar
    const prCountEl = document.getElementById('pr-count');
    if (prCountEl) {
      prCountEl.textContent = `${filteredPRs.length} PR${filteredPRs.length !== 1 ? 's' : ''}`;
    }
  }
  
  // Optimized PR list rendering with loading states
  function renderPRList({ prs }) {
    // Toggle filter controls based on whether there are ANY stored PRs, not just filtered ones
    toggleFilterControls(state.prs && state.prs.length > 0);
    
    // Early return for empty data
    if (!prs || prs.length === 0) {
      // Check if we have PRs but no search results
      if (state.prs && state.prs.length > 0 && (state.filter.text || !state.filter.showApproved || !state.filter.showPending)) {
        prListElement.innerHTML = `
          <div class="empty-state">
            ${ICONS.search}
            <p>No matching PRs found</p>
            <p class="empty-state-hint">Try adjusting your search or filters</p>
          </div>
        `;
      } else {
        prListElement.innerHTML = `
          <div class="empty-state">
            ${ICONS.no_data}
            <p>No PR reviews tracked yet</p>
            <p class="empty-state-hint">Visit a Bitbucket PR to start tracking</p>
          </div>
        `;
      }
      return;
    }
    
    // Build HTML for each PR item
    let html = '<ul class="pr-items" tabindex="0" role="list">';
    prs.forEach((pr, index) => {
      // Skip if missing critical info
      if (!pr || !pr.info) return;
      
      const isApproved = pr.info.isApprovedByMe === true;
      const approvedClass = isApproved ? 'approved-by-me' : '';
      
      // Format PR status badge
      let statusBadge = '';
      if (pr.info.status) {
        const status = pr.info.status.toLowerCase();
        let badgeClass = '';
        let text = '';
        
        switch (status) {
          case 'open':
            badgeClass = 'open';
            text = 'Open';
            break;
          case 'approved':
          case 'merged':
            badgeClass = 'merged';
            text = 'Merged';
            break;
          case 'declined':
            badgeClass = 'declined';
            text = 'Declined';
            break;
          default:
            badgeClass = '';
            text = status;
        }
        
        statusBadge = `
          <div class="pr-badge ${badgeClass}">
            ${text}
          </div>
        `;
      }
      
      // Create approved badge if needed
      const approvedBadge = isApproved ? `
        <div class="pr-badge approved">
          ${ICONS.check_circle} Approved
        </div>
      ` : '';
      
      // Format project/repo info
      const repoInfo = pr.info.repo ? `
        <div class="pr-meta">
          ${ICONS.folder}
          <span>${pr.info.repo}</span>
        </div>
      ` : '';
      
      // Format date
      let dateInfo = '';
      if (pr.info.lastVisited) {
        const date = new Date(pr.info.lastVisited);
        const formattedDate = date.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        });
        
        dateInfo = `
          <div class="pr-meta">
            ${ICONS.calendar}
            <span>Visited ${formattedDate}</span>
          </div>
        `;
      }
      
      // Build the stats section
      const views = pr.info.viewCount || 0;
      const approvals = pr.info.totalApprovals || 0;
      const comments = pr.info.commentCount || 0;
      
      // Build the complete PR item with improved keyboard accessibility
      html += `
        <li class="pr-item ${approvedClass}" data-pr-id="${pr.prId}" data-url="${pr.info.url || '#'}" tabindex="0" role="button" aria-label="PR ${pr.prNumber}: ${pr.info.title || 'PR #' + pr.prNumber}">
          <div class="pr-content">
            <div class="pr-header">
              <div class="pr-title">${pr.info.title || 'PR #' + pr.prNumber}</div>
              <button class="remove-btn" data-pr-id="${pr.prId}" title="Remove from tracking" aria-label="Remove PR">
                ${ICONS.close}
              </button>
            </div>
            <div class="pr-meta-container">
              ${repoInfo}
              ${dateInfo}
              ${approvedBadge}
              ${statusBadge}
            </div>
            <div class="pr-stats">
              <div class="stat" title="Views">
                ${ICONS.visibility}
                <span class="stat-value">${views}</span>
              </div>
              <div class="stat" title="Approvals">
                ${ICONS.thumb_up}
                <span class="stat-value">${approvals}</span>
              </div>
              <div class="stat" title="Comments">
                ${ICONS.tab}
                <span class="stat-value">${comments}</span>
              </div>
            </div>
          </div>
        </li>
      `;
    });
    
    html += '</ul>';
    
    // Update the PR list content
    prListElement.innerHTML = html;
    
    // Add keyboard navigation
    setupKeyboardNavigation();
  }
  
  // Add keyboard navigation support
  function setupKeyboardNavigation() {
    const prItems = document.querySelectorAll('.pr-item');
    
    prItems.forEach(item => {
      item.addEventListener('keydown', (e) => {
        // Enter or Space to open PR
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const url = item.dataset.url;
          if (url) {
            item.classList.add('pr-clicked');
            setTimeout(() => {
              chrome.tabs.create({ url });
            }, 150);
          }
        }
        
        // Delete key to remove PR
        if (e.key === 'Delete') {
          e.preventDefault();
          const prId = item.dataset.prId;
          showConfirmDialog({
            message: 'Remove this PR from your history?',
            onConfirm: () => {
              chrome.runtime.sendMessage({ 
                action: "removePR", 
                prId 
              }, () => {
                const statusIndicator = document.getElementById('status-indicator');
                statusIndicator.textContent = 'PR removed';
                statusIndicator.classList.remove('hidden');
                
                setTimeout(() => {
                  statusIndicator.classList.add('hidden');
                  loadPRStats();
                }, 1500);
              });
            }
          });
        }
      });
    });
  }
  
  // Load PR stats from storage
  function loadPRStats(callback) {
    state.loading = true;
    
    // Request PR data from background script
    chrome.runtime.sendMessage({ action: "getAllPRStats" }, response => {
      state.loading = false;
      
      if (response && response.prs) {
        // Transform the object into an array
        const prsArray = Object.keys(response.prs).map(prId => ({
          prId,
          prNumber: response.prs[prId].prNumber || '',
          info: response.prs[prId]
        }));
        
        // Sort by last visited
        prsArray.sort((a, b) => {
          const dateA = new Date(a.info.lastVisited || 0);
          const dateB = new Date(b.info.lastVisited || 0);
          return dateB - dateA;
        });
        
        // Update state
        state.prs = prsArray;
        // Render filtered list
        renderFilteredPRs();
      } else {
        // Handle empty or error response
        renderPRList({ prs: [] });
      }
      
      // Hide loading overlay if no callback is provided
      if (!callback) {
        hideLoadingOverlay();
      }
      
      if (callback) callback();
    });
  }
  
  // Initialize the application
  initApp();
});