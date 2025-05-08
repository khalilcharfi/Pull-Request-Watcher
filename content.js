// PR Tracker content script for Bitbucket PR pages
(() => {
  // Browser compatibility check - ensure 'browser' is available or fall back to 'chrome'
  const getBrowserAPI = () => {
    return typeof browser !== 'undefined' ? browser : chrome;
  };
  
  // Get browser API reference
  const browserAPI = getBrowserAPI();

  // Safe wrapper for browser API calls that might fail
  const safeSendMessage = (message, callback) => {
    try {
      const sendPromise = browserAPI.runtime.sendMessage(message);
      if (sendPromise && typeof sendPromise.then === 'function') {
        // Handle promise-based API (Firefox)
        sendPromise
          .then(response => {
            if (callback && typeof callback === 'function') {
              callback(response);
            }
          })
          .catch(err => {
            console.log("Error sending message:", err);
            if (callback && typeof callback === 'function') {
              callback({ success: false, error: err.message });
            }
          });
      } else {
        // Handle callback-based API (Chrome)
        // Chrome's sendMessage uses callbacks, not promises
      }
    } catch (err) {
      console.log("Error sending message:", err);
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  };

  // --- State and Constants ---
  let isProcessed = false;
  let currentPrId = null;
  let badgeRefreshInterval = null;
  let initRetryCount = 0;
  const MAX_RETRIES = 5;
  const REFRESH_INTERVAL = 60000; // Increased from 30s to 60s to reduce overhead

  // Cache DOM elements to avoid repeated queries
  let cachedElements = {};
  
  // Performance tracking
  let lastUpdateTime = 0;
  const MIN_UPDATE_INTERVAL = 1000; // Minimum time between updates (ms)

  // --- Utility Functions ---
  const normalizePath = (pathPart) => decodeURIComponent(pathPart).replace(/[{}]/g, '');

  // --- PR Info Extraction ---
  const getPRInfo = () => {
    // Use the comprehensive PR info extraction function
    const detailedInfo = extractBitbucketPrInfo();
    if (!detailedInfo || !detailedInfo.pullRequestId) return null;
    
    // Get PR number
    const prNumber = detailedInfo.pullRequestId;
    
    // Get current tab view for additional context
    const currentTab = getBitbucketPrTab(window.location.href);
    
    // Use extracted workspace and repository info
    const project = detailedInfo.workspace || 'unknown-project';
    const repo = detailedInfo.repository || 'unknown-repo';
    
    // Get PR title if available - use cached element if possible
    let title = null;
    if (!cachedElements.titleEl) {
      cachedElements.titleEl = document.querySelector('h1[data-qa="pr-header-title"], .css-1yc0im5, [data-test-id="pull-request-title"]');
    }
    if (cachedElements.titleEl) title = cachedElements.titleEl.textContent.trim();
    
    // Extract PR status
    let status = 'open';
    if (detailedInfo.merged) status = 'merged';
    else if (detailedInfo.declined) status = 'declined';
    else if (detailedInfo.approved) status = 'approved';
    
    // Check for status using the specific span element (more reliable)
    if (!cachedElements.statusSpans) {
      cachedElements.statusSpans = document.querySelectorAll('span.css-1r98t');
    }
    
    for (const span of cachedElements.statusSpans) {
      const spanText = span.textContent.trim().toLowerCase();
      if (spanText === 'declined') {
        status = 'declined';
        break;
      } else if (spanText === 'merged') {
        status = 'merged';
        break;
      } else if (spanText === 'open') {
        status = 'open';
        break;
      }
    }
    
    // Create base PR info - viewCount will be retrieved from storage later if available
    return {
      prNumber, 
      project, 
      repo,
      displayProject: project, 
      displayRepo: repo, 
      title,
      storageKey: `pr-${prNumber}`,
      internalId: `${project}/${repo}/${prNumber}`.toLowerCase(),
      url: window.location.href,
      currentTab,
      isApprovedByMe: detailedInfo.isApprovedByMe,
      currentUser: detailedInfo.currentUser,
      status,
      lastVisited: Date.now(),
      viewCount: 0, // This will be updated with the stored value if available
      commentCount: getCommentCount(),
      totalApprovals: getTotalApprovals()
    };
  };
  
  // Get the total number of comments on the PR
  const getCommentCount = () => {
    if (!cachedElements.commentCountEl) {
      cachedElements.commentCountEl = document.querySelector('[data-test-id="comment-count"]');
    }
    const commentCountText = cachedElements.commentCountEl?.textContent || '';
    const count = parseInt(commentCountText.match(/\d+/)?.[0] || '0', 10);
    return isNaN(count) ? 0 : count;
  };
  
  // Get the total number of approvals on the PR
  const getTotalApprovals = () => {
    if (!cachedElements.approveCountEl) {
      cachedElements.approveCountEl = document.querySelector('[data-test-id="approve-count"]');
    }
    
    if (cachedElements.approveCountEl) {
      const count = parseInt(cachedElements.approveCountEl.textContent.match(/\d+/)?.[0] || '0', 10);
      return isNaN(count) ? 0 : count;
    }
    
    // Fallback method: Count approval badges or approver avatars
    if (!cachedElements.approvalBadges) {
      cachedElements.approvalBadges = document.querySelectorAll('.approved, [data-test-id="approved-badge"]');
    }
    if (cachedElements.approvalBadges.length > 0) return cachedElements.approvalBadges.length;
    
    if (!cachedElements.approverAvatars) {
      cachedElements.approverAvatars = document.querySelectorAll('[data-testid="approvers-avatar-list"] img');
    }
    if (cachedElements.approverAvatars.length > 0) return cachedElements.approverAvatars.length;
    
    return 0;
  };

  // --- Badge Management ---
  const removeExistingBadge = () => {
    const existingBadge = document.getElementById('pr-tracker-container');
    if (existingBadge) existingBadge.remove();
  };

  // Get the background color of the status element
  const getDeclinedBgColor = () => {
    // Look for any status span with the appropriate class
    if (!cachedElements.statusSpans) {
      cachedElements.statusSpans = document.querySelectorAll('span.css-1r98t');
    }
    let targetSpan = null;
    
    // First look for declined status specifically
    for (const span of cachedElements.statusSpans) {
      if (span.textContent.trim().toLowerCase() === 'declined') {
        targetSpan = span;
        break;
      }
    }
    
    // If we found a status span, get its color
    if (targetSpan) {
      const computedStyle = window.getComputedStyle(targetSpan);
      return computedStyle.backgroundColor || '#002c64';
    }
    
    // Fallback to original search
    if (!cachedElements.fallbackElement) {
      cachedElements.fallbackElement = document.querySelector('.css-1i12gbl');
    }
    if (cachedElements.fallbackElement) {
      const computedStyle = window.getComputedStyle(cachedElements.fallbackElement);
      return computedStyle.backgroundColor || '#002c64';
    }
    
    return '#002c64'; // Default fallback color
  };

  const createStatsBadge = () => {
    if (!currentPrId) return null;
    removeExistingBadge();
    const badgeContainer = document.createElement('div');
    badgeContainer.id = 'pr-tracker-container';
    badgeContainer.style.position = 'fixed';
    badgeContainer.style.top = '16px';
    badgeContainer.style.right = '16px';
    badgeContainer.style.zIndex = '9999';
    
    // Save badge position in local storage if available
    const loadSavedPosition = () => {
      try {
        const savedPosition = localStorage.getItem('pr-tracker-position');
        if (savedPosition) {
          const { top, left } = JSON.parse(savedPosition);
          badgeContainer.style.top = top + 'px';
          badgeContainer.style.left = left + 'px';
          badgeContainer.style.right = 'auto'; // Clear right positioning when using left
        }
      } catch (e) {
        console.error("Error loading saved position:", e);
      }
    };
    
    // Load saved position if available
    loadSavedPosition();
    
    try {
      const shadow = badgeContainer.attachShadow({mode: 'open'});

      const style = document.createElement('style');
      style.textContent = `
        * {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        .badge { 
          display: flex; 
          align-items: center; 
          padding: 10px 14px; 
          background: #0c66e4; /* Default color - Bitbucket blue for open PRs */
          color: white; 
          border-radius: 8px; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          font-size: 13px; 
          font-weight: 500; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.15); 
          transition: all 0.2s ease; 
          will-change: transform, background-color; 
          cursor: pointer; 
          letter-spacing: 0.2px;
          line-height: 1.3;
          border: 1px solid rgba(255,255,255,0.1);
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        .badge:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 4px 12px rgba(0,0,0,0.2); 
          filter: brightness(1.05); 
        }
        .badge.dragging {
          transform: none;
          transition: none;
          cursor: move;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        }
        .badge.approved { 
          background: #1f845a; /* Green for approved */
        }
        .badge.merged {
          background: #1f845a; /* Green for merged now uses the same color as approved */
        }
        .badge.declined {
          background: #c9372c; /* Red for declined */
        }
        .badge.open {
          background: #0c66e4; /* Blue for open */
        }
        .stats { 
          display: flex; 
          align-items: center; 
        }
        .stat { 
          display: flex; 
          align-items: center; 
          margin-left: 12px; 
          white-space: nowrap;
          position: relative;
        }
        .stat:first-child { 
          margin-left: 0; 
        }
        .stat svg {
          vertical-align: middle;
          margin-right: 5px;
          flex-shrink: 0;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1));
        }
        .stat span {
          font-weight: 600;
          display: inline-flex;
          text-shadow: 0 1px 1px rgba(0,0,0,0.1);
        }
        .badge-icon {
          margin-right: 6px;
          min-width: 16px;
          vertical-align: middle;
          flex-shrink: 0;
        }
        .logo {
          display: flex;
          align-items: center;
          margin-right: 10px;
          border-right: 1px solid rgba(255,255,255,0.2);
          padding-right: 10px;
        }
        .logo svg, .logo img {
          height: 20px;
          width: auto;
        }
        .divider {
          width: 1px;
          height: 16px;
          background: rgba(255,255,255,0.2);
          margin: 0 8px;
        }
        .status {
          font-weight: 600;
          display: flex;
          align-items: center;
          margin-left: 8px;
        }
        @media (max-width: 768px) {
          .badge {
            padding: 8px 12px;
            font-size: 12px;
            bottom: 16px;
            top: auto;
            border-radius: 30px;
          }
          .logo {
            display: none;
          }
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .loading {
          animation: pulse 1.5s infinite;
        }
        
        /* New reactive animations */
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        
        @keyframes highlight {
          0% { background-color: rgba(255,255,255,0.3); }
          100% { background-color: transparent; }
        }
        
        .stat.updated {
          animation: pop 0.5s ease-out;
        }
        
        .stat.updated span {
          position: relative;
        }
        
        .stat.updated span::after {
          content: '';
          position: absolute;
          top: -4px;
          right: -4px;
          bottom: -4px;
          left: -4px;
          border-radius: 4px;
          background-color: rgba(255,255,255,0.3);
          animation: highlight 1s ease-out forwards;
          z-index: -1;
        }
        
        .badge.updating {
          position: relative;
          overflow: hidden;
        }
        
        .badge.updating::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.2) 50%,
            rgba(255,255,255,0) 100%
          );
          animation: shimmer 1.5s infinite;
        }
        
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }
      `;
      shadow.appendChild(style);

      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.innerHTML = `
        <div class="logo">
          <img src="${browserAPI.runtime.getURL('images/logo_icon.png')}" alt="Logo">
        </div>
        <div class="stats loading">Loading stats...</div>
      `;
      
      // Make the badge draggable
      let isDragging = false;
      let startX, startY, startLeft, startTop;
      
      // Handle drag start
      const handleMouseDown = (e) => {
        // Only handle left mouse button (button 0)
        if (e.button !== 0) return;
        
        // Get the actual event (accounting for shadow DOM)
        const event = e.composedPath ? e.composedPath()[0] : e.target;
        
        // Prevent default to avoid text selection during drag
        e.preventDefault();
        
        // Start dragging
        isDragging = true;
        badge.classList.add('dragging');
        
        // Calculate initial position
        const rect = badgeContainer.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        
        // Get current position (convert any 'auto' values to pixels)
        const computedStyle = window.getComputedStyle(badgeContainer);
        startLeft = parseInt(computedStyle.left) || 0;
        startTop = parseInt(computedStyle.top) || 0;
        
        // Add event listeners for drag and end
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      };
      
      // Handle dragging
      const handleMouseMove = (e) => {
        if (!isDragging) return;
        
        // Calculate new position
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        // Apply new position
        badgeContainer.style.left = (startLeft + dx) + 'px';
        badgeContainer.style.top = (startTop + dy) + 'px';
        badgeContainer.style.right = 'auto'; // Clear right positioning when using left
      };
      
      // Handle drag end
      const handleMouseUp = (e) => {
        if (!isDragging) return;
        
        // Stop dragging
        isDragging = false;
        badge.classList.remove('dragging');
        
        // Remove event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Save position to localStorage
        try {
          const position = {
            top: parseInt(badgeContainer.style.top),
            left: parseInt(badgeContainer.style.left)
          };
          localStorage.setItem('pr-tracker-position', JSON.stringify(position));
        } catch (e) {
          console.error("Error saving position:", e);
        }
      };
      
      // Add event listeners
      badge.addEventListener('mousedown', handleMouseDown);
      
      // Preserve the click functionality
      badge.addEventListener('click', (e) => {
        // Only trigger click if we didn't just finish dragging
        if (!isDragging) {
          // Use safe message sending
          try {
            browserAPI.runtime.sendMessage({ action: "openPopup" }).catch(err => {
              console.log("Error opening popup:", err);
            });
          } catch (err) {
            console.log("Error sending openPopup message:", err);
          }
        }
      });
      
      shadow.appendChild(badge);
      document.body.appendChild(badgeContainer);
      return badge;
    } catch (e) {
      console.error("Error creating PR Tracker badge:", e);
      if (badgeContainer.parentNode) badgeContainer.parentNode.removeChild(badgeContainer);
      return null;
    }
  };

  const updateStatsBadge = () => {
    if (!currentPrId) return false;
    
    // Performance optimization: don't update too frequently
    const now = Date.now();
    if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) return false;
    lastUpdateTime = now;
    
    // Create badge if it doesn't exist yet and return
    const badgeContainer = document.getElementById('pr-tracker-container');
    if (!badgeContainer || !badgeContainer.shadowRoot) { 
      createStatsBadge(); 
      return false; 
    }
    
    const badge = badgeContainer.shadowRoot.querySelector('.badge');
    if (!badge) return false;
    
    // Add updating class only if not already updating
    if (!badge.classList.contains('updating')) {
      badge.classList.add('updating');
    }
    
    // Get fresh PR info - use cached values where possible
    const prInfo = getPRInfo();
    if (!prInfo) {
      badge.classList.remove('updating');
      return false;
    }
    
    // Store current values to detect changes - avoid unnecessary DOM lookups
    let currentStats = {
      reviewCount: 0,
      approvalCount: 0
    };
    
    // Cache DOM nodes for performance
    const viewsSpan = badge.querySelector('.stat[title="Views"] span');
    const approvalsSpan = badge.querySelector('.stat[title="Approvals"] span');
    
    if (viewsSpan) currentStats.reviewCount = parseInt(viewsSpan.textContent || '0');
    if (approvalsSpan) currentStats.approvalCount = parseInt(approvalsSpan.textContent || '0');
    
    // Use sessionStorage as a cache to reduce Chrome API calls
    const sessionData = sessionStorage.getItem(`pr-info-${currentPrId}`);
    let statsPromise;
    
    if (sessionData) {
      try {
        const cachedInfo = JSON.parse(sessionData);
        // If we have very recent data (less than 10 seconds old)
        if (cachedInfo && (Date.now() - cachedInfo.lastVisited < 10000)) {
          statsPromise = Promise.resolve({
            stats: { reviewCount: cachedInfo.viewCount || 0, approvalCount: 0 },
            info: cachedInfo
          });
        } else {
          // Get PR stats from storage if cache is older
          statsPromise = new Promise(resolve => {
            browserAPI.runtime.sendMessage({ action: "getPRStats", prId: currentPrId }, (response) => {
              if (!response || !response.stats) {
                response = { stats: { reviewCount: 0, approvalCount: 0 }, info: {} };
              }
              resolve(response);
            });
          });
        }
      } catch (e) {
        // Fallback to Chrome storage if parsing fails
        statsPromise = new Promise(resolve => {
          browserAPI.runtime.sendMessage({ action: "getPRStats", prId: currentPrId }, (response) => {
            if (!response || !response.stats) {
              response = { stats: { reviewCount: 0, approvalCount: 0 }, info: {} };
            }
            resolve(response);
          });
        });
      }
    } else {
      // No session data, use Chrome storage
      statsPromise = new Promise(resolve => {
        browserAPI.runtime.sendMessage({ action: "getPRStats", prId: currentPrId }, (response) => {
          if (!response || !response.stats) {
            response = { stats: { reviewCount: 0, approvalCount: 0 }, info: {} };
          }
          resolve(response);
        });
      });
    }
    
    statsPromise.then(response => {
      const stats = response.stats;
      const storedInfo = response.info || {};
      
      // Use the actual view count from stats
      const viewCount = stats.reviewCount || storedInfo.viewCount || 0;
      
      try {
        const approved = isCurrentUserApproved();
        
        // Set badge styling based on PR status - use class toggling for better performance
        // Priority: merged > declined > open > approved
        const currentStatus = badge.className.match(/\b(merged|declined|open|approved)\b/)?.[0] || '';
        let newStatus = '';
        
        if (prInfo.status === 'merged') {
          newStatus = 'merged';
        } else if (prInfo.status === 'declined') {
          newStatus = 'declined';
        } else if (prInfo.status === 'open') {
          newStatus = 'open';
        } else if (approved) {
          newStatus = 'approved';
        }
        
        // Only update class if status changed - reduces reflows
        if (currentStatus !== newStatus) {
          badge.classList.remove('approved', 'merged', 'declined', 'open');
          if (newStatus) badge.classList.add(newStatus);
        }
        
        // Remove updating class
        badge.classList.remove('updating');
        
        // Use SVG icons with CSS classes - reuse if possible
        const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" class="badge-icon eye-icon"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
        
        const thumbUpIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" class="badge-icon thumbup-icon"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>`;
        
        const checkCircleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" class="badge-icon check-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
        
        // Get the status label - fixed the merged line
        let statusLabel = '';
        if (approved) statusLabel = '<div class="status">Approved</div>';
        else if (prInfo.status === 'merged') statusLabel = '<div class="status">Merged</div>';
        else if (prInfo.status === 'declined') statusLabel = '<div class="status">Declined</div>';
        
        // Check if we need to update the content
        const statsHtml = `
          <div class="logo">
            ${prInfo.status === 'merged' ? '<span style="font-size: 20px; padding: 0 4px;">🎉</span>' : `<img src="${browserAPI.runtime.getURL('images/logo_icon.png')}" alt="Logo">`}
          </div>
          <div class="stats">
            <div class="stat" title="Views">
              ${eyeIcon}
              <span>${viewCount}</span>
            </div>
            <div class="stat" title="Approvals">
              ${thumbUpIcon}
              <span>${prInfo.totalApprovals || 0}</span>
            </div>
            ${approved ? `<div class="divider"></div>${checkCircleIcon}` : ''}
            ${statusLabel}
          </div>
        `;
        
        // Only update DOM if content changed - reduces reflows
        if (badge.innerHTML.trim() !== statsHtml.trim()) {
          badge.innerHTML = statsHtml;
          
          // Get fresh references after DOM update
          const viewsStat = badge.querySelector('.stat[title="Views"]');
          const approvalsStat = badge.querySelector('.stat[title="Approvals"]');
          
          // Highlight changed values with animation
          if (viewsStat && viewCount !== currentStats.reviewCount) {
            viewsStat.classList.add('updated');
            setTimeout(() => {
              if (viewsStat.classList) viewsStat.classList.remove('updated');
            }, 1000);
          }
          
          if (approvalsStat && prInfo.totalApprovals !== currentStats.approvalCount) {
            approvalsStat.classList.add('updated');
            setTimeout(() => {
              if (approvalsStat.classList) approvalsStat.classList.remove('updated');
            }, 1000);
          }
        }
        
        return true;
      } catch (e) {
        console.error("Error updating PR Tracker badge:", e);
        badge.classList.remove('updating');
        return false;
      }
    });
  };

  // --- PR State/Stats Tracking ---
  const trackPRView = () => {
    // Minimize debug logging in production
    const DEBUG = false;
    
    const prInfo = getPRInfo();
    if (!prInfo) {
      if (DEBUG) console.log("PR Tracker: Failed to get PR info");
      return false;
    }
    
    if (DEBUG) console.log("PR Tracker: Detected PR", {
      workspace: prInfo.displayProject,
      repository: prInfo.displayRepo,
      pullRequestId: prInfo.prNumber
    });
    
    // If the PR is already processed in this session, don't count it as a new view
    if (isProcessed) return true;
    
    // Skip processing if PR number is missing
    if (!prInfo.prNumber) {
      if (DEBUG) console.log("PR Tracker: Ignoring PR with missing PR number");
      return false;
    }
    
    // Skip processing if either project or repo is unknown
    if (prInfo.displayProject === 'unknown-project' || prInfo.displayRepo === 'unknown-repo') {
      if (DEBUG) console.log("PR Tracker: Ignoring PR with unknown project or repo");
      return false;
    }
    
    isProcessed = true;
    currentPrId = prInfo.storageKey;
    
    // Use promise-based storage to prevent callback hell and improve consistency
    const storagePromise = new Promise((resolve) => {
      // First check session storage as a cache to avoid unnecessary Chrome storage calls
      const sessionData = sessionStorage.getItem(`pr-info-${prInfo.storageKey}`);
      
      if (sessionData) {
        try {
          const cachedInfo = JSON.parse(sessionData);
          // If we have recent data in session storage (less than 5 minutes old)
          if (cachedInfo && (Date.now() - cachedInfo.lastVisited < 300000)) {
            resolve({
              existingInfo: cachedInfo,
              existingStats: { reviewCount: cachedInfo.viewCount || 0, approvalCount: 0 },
              fromCache: true
            });
            return;
          }
        } catch (e) {
          // If session storage parse fails, continue to Chrome storage
          console.error("Error parsing session storage:", e);
        }
      }
      
      // Fall back to Chrome storage
      browserAPI.storage.local.get([`pr-info-${prInfo.storageKey}`, prInfo.storageKey], (result) => {
        resolve({
          existingInfo: result[`pr-info-${prInfo.storageKey}`] || {},
          existingStats: result[prInfo.storageKey] || { reviewCount: 0, approvalCount: 0 },
          fromCache: false
        });
      });
    });
    
    storagePromise.then(({ existingInfo, existingStats, fromCache }) => {
      // Use existing view count if available, otherwise start at 0
      const viewCount = existingStats.reviewCount || existingInfo.viewCount || 0;
      
      if (DEBUG) console.log("PR Tracker: Existing view count", viewCount, fromCache ? "(from cache)" : "");
      
      // Create updated PR info object with preserved viewCount
      const prInfoObj = {
        project: prInfo.displayProject, 
        repo: prInfo.displayRepo, 
        id: prInfo.prNumber,
        internalId: prInfo.internalId, 
        url: prInfo.url, 
        title: prInfo.title,
        currentTab: prInfo.currentTab,
        isApprovedByMe: prInfo.isApprovedByMe,
        status: prInfo.status,
        lastVisited: Date.now(),
        commentCount: prInfo.commentCount,
        totalApprovals: prInfo.totalApprovals,
        viewCount: viewCount // Use the existing view count from storage
      };
      
      if (DEBUG) console.log("PR Tracker: Processing PR", prInfoObj);
      
      // Store updated info in session storage for quick access
      sessionStorage.setItem(`pr-info-${prInfo.storageKey}`, JSON.stringify(prInfoObj));
      
      // Update PR info in local storage
      browserAPI.storage.local.set({ [`pr-info-${prInfo.storageKey}`]: prInfoObj });
      
      // Only increment view if coming from user navigation, not from cache refresh
      if (!fromCache) {
        // Send message to increment view count
        browserAPI.runtime.sendMessage({
          action: "updatePRStats",
          prId: prInfo.storageKey,
          prInternalId: prInfo.internalId,
          isApproval: prInfo.isApprovedByMe,
          shouldIncrementView: true // Explicitly indicate this should count as a view
        }, (response) => { 
          if (response && response.success) {
            updateStatsBadge();
            if (DEBUG) console.log("PR Tracker: Successfully updated PR stats", response.stats);
          } else {
            if (DEBUG) console.log("PR Tracker: Failed to update PR stats", response);
          }
        });
      } else {
        // Just update the badge without incrementing the view count
        updateStatsBadge();
      }
    });
    
    return true;
  };

  // --- Approval Detection ---
  const isCurrentUserApproved = (skipPrInfoCheck = false) => {
    // Enable for debugging
    const DEBUG = false;
    const logCheck = (method, result) => {
      if (DEBUG) console.log(`PR Tracker: Approval check [${method}] = ${result}`);
      return result;
    };

    // STAGE 1: Try to get approval status from our detailed extractor
    // Skip this check when called from extractBitbucketPrInfo to avoid infinite recursion
    if (!skipPrInfoCheck) {
      const prInfo = getPRInfo();
      if (prInfo && prInfo.isApprovedByMe !== undefined) {
        return logCheck('Detailed Extractor', prInfo.isApprovedByMe);
      }
    }

    // STAGE 2: Button UI Detection
    // --------------------

    // 2.1: Look for "Unapprove" button with aria-pressed="true"
    const unapproveButton = document.querySelector("button[aria-pressed='true'][aria-label*='Unapprove']");
    if (unapproveButton) return logCheck('Aria Button', true);
    
    // 2.2: Look for the specific classes for approved buttons
    const unapproveClassButton = document.querySelector("button.css-1fkk2d2, button[class*='approved']");
    if (unapproveClassButton && unapproveClassButton.textContent.toLowerCase().includes('unapprove')) 
      return logCheck('Class Button', true);
    
    // STAGE 3: Look for self-approval indicator
    // --------------------
    
    // 3.1: Look for active state in approval button menus
    const activeApprovals = document.querySelectorAll('[data-testid="approval-active"]');
    for (const approval of activeApprovals) {
      if (approval.textContent.toLowerCase().includes('approved')) return logCheck('Active Approval', true);
    }
    
    // 3.2: Look for text in the current user avatar
    const currentUserElements = document.querySelectorAll('[data-testid="current-user"]');
    for (const element of currentUserElements) {
      const parent = element.closest('.css-1itvj1y, .css-1e5n3rj, [data-testid="approval-participant"]');
      if (parent && parent.textContent.toLowerCase().includes('approve')) return logCheck('User Approval', true);
    }
    
    // Fallback: Approve button is not visible or has Approve text instead of Unapprove
    const approveButton = document.querySelector('button[data-testid="approval-button"]');
    if (approveButton && approveButton.getAttribute('aria-label')?.includes('Unapprove')) {
      return logCheck('Aria Label', true);
    }
    
    return logCheck('Default', false);
  };

  // --- Bitbucket Specific Extractors ---
  const extractBitbucketPrInfo = () => {
    try {
      // Method 1: Modern Bitbucket UI with window.BITBUCKET object
      if (window.BITBUCKET && window.BITBUCKET.reactContext) {
        return extractFromBitbucketReactContext();
      }
      
      // Method 2: Try to find PR info in the URL - standard pattern
      let urlPath = window.location.pathname;
      // Normalize URL path by removing trailing slashes
      urlPath = urlPath.replace(/\/+$/, '');
      
      // Try multiple URL patterns to increase detection reliability
      // Standard pattern: /workspace/repository/pull-requests/123
      let match = urlPath.match(/\/([^\/]+)\/([^\/]+)\/pull-requests\/(\d+)/);
      if (match) {
        return {
          workspace: normalizePath(match[1]),
          repository: normalizePath(match[2]),
          pullRequestId: match[3],
          isApprovedByMe: isCurrentUserApproved(true) // Pass true to avoid infinite recursion
        };
      }
      
      // Alternative pattern: /projects/workspace/repos/repository/pull-requests/123
      match = urlPath.match(/\/projects\/([^\/]+)\/repos\/([^\/]+)\/pull-requests\/(\d+)/);
      if (match) {
        return {
          workspace: normalizePath(match[1]),
          repository: normalizePath(match[2]),
          pullRequestId: match[3],
          isApprovedByMe: isCurrentUserApproved(true) // Pass true to avoid infinite recursion
        };
      }
      
      // Alternative pattern for some Bitbucket versions: /workspace/repository/-/pull/123
      match = urlPath.match(/\/([^\/]+)\/([^\/]+)\/-\/pull\/(\d+)/);
      if (match) {
        return {
          workspace: normalizePath(match[1]),
          repository: normalizePath(match[2]),
          pullRequestId: match[3],
          isApprovedByMe: isCurrentUserApproved(true) // Pass true to avoid infinite recursion
        };
      }
      
      // Check if we're on a PR page by looking for PR-specific elements in the DOM
      if (urlPath.includes('/pull-requests/') || urlPath.includes('/pull/')) {
        const prIdElement = document.querySelector('[data-qa="pr-header-id"], [data-test-id="pull-request-id"], .css-1yc0im5 span');
        if (prIdElement) {
          const prIdMatch = prIdElement.textContent.match(/#(\d+)/);
          if (prIdMatch) {
            // Extract workspace and repo from URL parts
            const urlParts = urlPath.split('/').filter(Boolean);
            if (urlParts.length >= 2) {
              return {
                workspace: normalizePath(urlParts[0]),
                repository: normalizePath(urlParts[1]),
                pullRequestId: prIdMatch[1],
                isApprovedByMe: isCurrentUserApproved(true) // Pass true to avoid infinite recursion
              };
            }
          }
        }
      }
    } catch (e) {
      console.error('Error extracting PR info:', e);
    }
    
    return null;
  };

  const extractFromBitbucketReactContext = () => {
    try {
      const context = window.BITBUCKET.reactContext;
      
      // Extract current user info
      const currentUser = context.current_user?.username;
      
      // Extract PR info from different possible locations
      // New PR UI
      if (context.pull_request) {
        const pr = context.pull_request;
        const workspace = context.workspace?.slug || extractFromUrl(1);
        const repository = context.repository?.slug || extractFromUrl(2);
        
        // Check if this user has approved the PR
        let isApprovedByMe = false;
        const participants = pr.participants || [];
        
        for (const participant of participants) {
          if (participant.user?.username === currentUser && participant.approved) {
            isApprovedByMe = true;
            break;
          }
        }
        
        return {
          workspace,
          repository,
          pullRequestId: pr.id.toString(),
          isApprovedByMe,
          currentUser,
          approved: pr.state === 'APPROVED',
          merged: pr.state === 'MERGED',
          declined: pr.state === 'DECLINED'
        };
      }
      
      // Older PR UI
      if (context.pullrequest) {
        const pr = context.pullrequest;
        
        // Check if this user has approved the PR
        let isApprovedByMe = false;
        const participants = pr.participants || [];
        
        for (const participant of participants) {
          if (participant.user?.username === currentUser && participant.approved) {
            isApprovedByMe = true;
            break;
          }
        }
        
        return {
          workspace: context.workspacedirectory || extractFromUrl(1),
          repository: context.repositorydirectory || extractFromUrl(2),
          pullRequestId: pr.id.toString(),
          isApprovedByMe,
          currentUser,
          approved: pr.state === 'APPROVED',
          merged: pr.state === 'MERGED',
          declined: pr.state === 'DECLINED'
        };
      }
    } catch (e) {
      console.error('Error extracting from Bitbucket React context:', e);
    }
    
    return null;
  };

  const extractFromUrl = (position) => {
    try {
      const urlPath = window.location.pathname;
      const parts = urlPath.split('/').filter(Boolean);
      return parts[position - 1] || '';
    } catch (e) {
      return '';
    }
  };

  const getBitbucketPrTab = (url) => {
    try {
      const tabMatches = [
        { pattern: /\/diff($|\?)/, name: 'Diff' },
        { pattern: /\/commits($|\?)/, name: 'Commits' },
        { pattern: /\/activity($|\?)/, name: 'Activity' },
        { pattern: /\/requests-changes($|\?)/, name: 'Changes Requested' },
        { pattern: /\/reviews($|\?)/, name: 'Approve/Request Changes' },
      ];
      
      for (const { pattern, name } of tabMatches) {
        if (pattern.test(url)) return name;
      }
      
      return 'Overview'; // Default tab
    } catch (e) {
      return 'Unknown';
    }
  };

  // --- Event Monitoring ---
  const setupPRStateMutationObserver = () => {
    // Create a mutation observer to detect changes in PR state (comments, approvals, etc.)
    // OPTIMIZATION: Instead of observing the entire document body, observe only relevant containers
    const prStateObserver = new MutationObserver((mutations) => {
      // Throttle updates to prevent excessive CPU usage
      const now = Date.now();
      if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) return;
      
      // Check if we should update based on relevant DOM changes
      let shouldUpdate = false;
      
      for (const mutation of mutations) {
        // Check if the mutation is in a relevant part of the DOM
        const isRelevantTarget = 
          mutation.target.nodeType === Node.ELEMENT_NODE && (
            mutation.target.closest('[data-test-id="comment-content"]') || 
            mutation.target.closest('[data-testid="approval-participant"]') ||
            mutation.target.closest('[data-testid="approvers-avatar-list"]') ||
            mutation.target.closest('[data-test-id="pr-header-title"]') ||
            mutation.target.closest('[class*="status-badge"]') ||
            mutation.target.closest('[data-test-id="pull-request-state"]') ||
            mutation.target.closest('[data-testid="pr-header-wrapper"]')
          );
        
        if (isRelevantTarget) {
          shouldUpdate = true;
          break;
        }
        
        // Optimize node checking with early returns
        if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
          const relevantNodeFound = [...mutation.addedNodes, ...mutation.removedNodes].some(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            
            return node.querySelector('[data-test-id="comment-content"]') ||
                   node.querySelector('[data-testid="approval-participant"]') ||
                   node.matches('[data-test-id="comment-content"]') ||
                   node.matches('[data-testid="approval-participant"]') ||
                   node.matches('[data-test-id="approve-count"]') ||
                   node.matches('[data-test-id="comment-count"]');
          });
          
          if (relevantNodeFound) {
            shouldUpdate = true;
            break;
          }
        }
      }
      
      // Update the badge if relevant changes were detected
      if (shouldUpdate && currentPrId) {
        // Debounce updates to avoid too many updates at once
        clearTimeout(window._prTrackerUpdateTimeout);
        window._prTrackerUpdateTimeout = setTimeout(() => {
          // Get fresh PR info and update badge
          updatePRInfoAndBadge();
          lastUpdateTime = Date.now();
        }, 500);
      }
    });
    
    // OPTIMIZATION: Observe only specific containers that contain relevant PR info
    // instead of the entire document body
    const relevantContainers = [
      document.querySelector('[data-testid="pr-header-wrapper"]'),
      document.querySelector('[data-test-id="pull-request-header"]'),
      document.querySelector('[data-test-id="comments-container"]'),
      document.querySelector('[data-testid="approval-participants"]'),
      document.querySelector('[data-test-id="pull-request-state"]'),
    ].filter(Boolean); // Filter out null elements
    
    if (relevantContainers.length === 0) {
      // Fallback to body if no specific containers found
      prStateObserver.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: false, // Reduced scope - only watch for structural changes
        characterData: false // Don't observe text changes
      });
    } else {
      // Observe each relevant container
      relevantContainers.forEach(container => {
        prStateObserver.observe(container, { 
          childList: true, 
          subtree: true,
          attributes: false, // Only watch for structural changes
          characterData: false // Don't observe text changes
        });
      });
    }
    
    // Store the observer for later cleanup
    window._prStateObserver = prStateObserver;
    return prStateObserver;
  };

  // Updated function to get fresh PR info and update the badge
  const updatePRInfoAndBadge = () => {
    if (!currentPrId) return;
    
    // Get fresh PR info
    const prInfo = getPRInfo();
    if (!prInfo) return;
    
    // Retrieve the most up-to-date PR stats from storage
    browserAPI.storage.local.get([`pr-info-${currentPrId}`, currentPrId], (result) => {
      const existingInfo = result[`pr-info-${currentPrId}`] || {};
      const existingStats = result[currentPrId] || { reviewCount: 0, approvalCount: 0 };
      
      // Use correct view count from storage
      const viewCount = existingStats.reviewCount || existingInfo.viewCount || 0;
      
      // Update internal PR info with correct view count
      const prInfoObj = {
        project: prInfo.displayProject,
        repo: prInfo.displayRepo,
        id: prInfo.prNumber,
        internalId: prInfo.internalId,
        url: prInfo.url,
        title: prInfo.title,
        currentTab: prInfo.currentTab,
        isApprovedByMe: prInfo.isApprovedByMe,
        status: prInfo.status,
        lastVisited: Date.now(),
        commentCount: getCommentCount(),
        totalApprovals: getTotalApprovals(),
        viewCount: viewCount // Use the retrieved view count
      };
      
      // Update storage with fresh data
      browserAPI.storage.local.set({ [`pr-info-${currentPrId}`]: prInfoObj });
      
      // Update the badge with the correct stats
      updateStatsBadge();
      
      // Send updated stats to background - don't increment view count here (shouldIncrementView: false)
      browserAPI.runtime.sendMessage({
        action: "updatePRStats",
        prId: currentPrId,
        prInternalId: prInfo.internalId,
        isApproval: prInfo.isApprovedByMe,
        shouldIncrementView: false // Don't increment on updates, only on first visit
      });
    });
  };

  const setupReactiveListeners = () => {
    // Set up event listeners for various PR actions
    
    // 1. Comment actions
    document.addEventListener('click', (e) => {
      const commentButton = e.target.closest('[data-testid="create-comment"], [data-testid="edit-comment"]');
      if (commentButton) {
        // Wait for comment to be saved
        setTimeout(updatePRInfoAndBadge, 1000);
      }
    }, { passive: true });
    
    // 2. React to form submissions (comment forms, etc.)
    document.addEventListener('submit', () => {
      setTimeout(updatePRInfoAndBadge, 1000);
    }, { passive: true });
    
    // 3. PR state changes (merged, declined, etc.)
    document.addEventListener('click', (e) => {
      const stateChangeButton = e.target.closest('[data-testid="merge-button"], [data-testid="decline-button"]');
      if (stateChangeButton) {
        // Wait for state change to complete
        setTimeout(updatePRInfoAndBadge, 1500);
      }
    }, { passive: true });
  };

  const setupApprovalMonitoring = () => {
    // Monitor clicks on the Approve button
    document.addEventListener('click', (e) => {
      // Only monitor specific approve/unapprove buttons
      const button = e.target.closest('button[data-testid="approval-button"], [class*="approve-button"]');
      if (!button) return;
      
      // Wait a moment for the UI to update
      setTimeout(() => {
        const isApproved = isCurrentUserApproved();
        
        // Update PR info with new approval status
        if (currentPrId) {
          const prInfo = getPRInfo();
          if (prInfo) {
            prInfo.isApprovedByMe = isApproved;
            browserAPI.storage.local.get([`pr-info-${currentPrId}`], (result) => {
              const existingInfo = result[`pr-info-${currentPrId}`] || {};
              browserAPI.storage.local.set({ 
                [`pr-info-${currentPrId}`]: {
                  ...existingInfo,
                  isApprovedByMe: isApproved
                }
              });
            });
          }
          
          // Get fresh total approvals count
          const totalApprovals = getTotalApprovals();
          
          // If the user has approved the PR, update the stats with an approval count increment
          if (isApproved) {
            browserAPI.runtime.sendMessage({
              action: "updatePRStats",
              prId: currentPrId,
              isApproval: true,
              totalApprovals
            }, () => updateStatsBadge());
          } else {
            // Update with new approval count even if unapproved
            browserAPI.runtime.sendMessage({
              action: "updatePRStats",
              prId: currentPrId,
              isApproval: false,
              totalApprovals
            }, () => updateStatsBadge());
          }
        }
      }, 750); // Reduced wait time for more responsive updates
    }, { passive: true });
  };

  const setupMessageListener = () => {
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "updateBadge" && message.prId === currentPrId) {
        updateStatsBadge();
      }
      sendResponse({ success: true });
    });
  };

  const setupNavigationObserver = () => {
    // Track the last processed URL to avoid duplicate processing
    let lastUrl = window.location.href;
    let urlObserver = null;
    let navigationTimeout = null;
    
    // Function to process URL changes - debounced to prevent multiple rapid calls
    const processUrlChange = (newUrl) => {
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
      
      navigationTimeout = setTimeout(() => {
        if (newUrl !== lastUrl) {
          // Check if we're navigating to or within a PR page - use regex test for efficiency
          const isPrUrl = /\/pull-requests\/|\/pull\/|\/repos\/.*\/pull-requests\//.test(newUrl);
          
          if (isPrUrl) {
            // We switched to a new PR or PR tab, reinitialize
            isProcessed = false;
            lastUrl = newUrl;
            
            // Wait a bit for the page to stabilize
            setTimeout(() => {
              init(true);
            }, 750);
          } else {
            // We navigated away from a PR
            lastUrl = newUrl;
            isProcessed = false;
            currentPrId = null;
            removeExistingBadge();
            
            // Clean up observers and listeners to prevent memory leaks
            if (window._prStateObserver) {
              window._prStateObserver.disconnect();
              window._prStateObserver = null;
            }
            
            if (badgeRefreshInterval) {
              clearInterval(badgeRefreshInterval);
              badgeRefreshInterval = null;
            }
            
            // Clean up user presence tracking if cleanup function exists
            if (typeof window._userPresenceCleanup === 'function') {
              window._userPresenceCleanup();
              window._userPresenceCleanup = null;
            }
          }
        }
      }, 100); // Short debounce to handle rapid navigation
    };
    
    // Setup a more efficient event-based approach instead of observing the DOM
    const handleLocationChange = () => {
      const currentUrl = document.location.href;
      processUrlChange(currentUrl);
    };
    
    // Set up history API interceptors
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
    };
    
    // Listen for our custom locationchange event and popstate
    window.addEventListener('locationchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    
    // Observe the document title for changes, but only if not already monitoring
    if (!urlObserver) {
      const titleElement = document.querySelector('title');
      if (titleElement) {
        urlObserver = new MutationObserver(() => {
          const currentUrl = document.location.href;
          processUrlChange(currentUrl);
        });
        
        urlObserver.observe(titleElement, { 
          subtree: true, 
          childList: true, 
          characterData: true 
        });
      }
    }
    
    // Return cleanup function
    return () => {
      if (urlObserver) {
        urlObserver.disconnect();
      }
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
      window.removeEventListener('locationchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
      
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  };

  const setupAjaxMonitoring = () => {
    // Create a proxy for the XMLHttpRequest to monitor AJAX requests
    const originalXhrProto = XMLHttpRequest.prototype;
    const originalOpen = originalXhrProto.open;
    const originalSend = originalXhrProto.send;
    
    // Monitor only PR-related API requests - use more efficient regex patterns
    const prRelatedPattern = /\/(pull-requests|pullrequests)\/|\/(approval|comments\/add)/;
    
    // Throttle updates to prevent excessive processing
    const throttleUpdate = (() => {
      let timeout = null;
      let lastUpdateTime = 0;
      const THROTTLE_DELAY = 1000; // 1 second between updates
      
      return () => {
        const now = Date.now();
        if (now - lastUpdateTime < THROTTLE_DELAY) {
          // If we updated recently, schedule an update for later
          if (!timeout) {
            timeout = setTimeout(() => {
              if (currentPrId) {
                updatePRInfoAndBadge();
              }
              lastUpdateTime = Date.now();
              timeout = null;
            }, THROTTLE_DELAY);
          }
          return;
        }
        
        // Otherwise update immediately
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        
        if (currentPrId) {
          updatePRInfoAndBadge();
        }
        lastUpdateTime = now;
      };
    })();
    
    // Replace the open method to track the URL
    originalXhrProto.open = function(method, url) {
      // Store URL only if it matches our pattern (reduces memory usage)
      if (typeof url === 'string' && prRelatedPattern.test(url)) {
        this._prTrackerUrl = url;
      }
      return originalOpen.apply(this, arguments);
    };
    
    // Replace the send method to monitor load events
    originalXhrProto.send = function() {
      // Only modify XHR objects with tracked URLs
      if (this._prTrackerUrl) {
        if (this.onreadystatechange) {
          this._prTrackerOnReadyStateChange = this.onreadystatechange;
        }
        
        this.onreadystatechange = function() {
          // Call original callback if it exists
          if (this._prTrackerOnReadyStateChange) {
            this._prTrackerOnReadyStateChange.apply(this, arguments);
          }
          
          if (this.readyState === 4 && this.status >= 200 && this.status < 300) {
            // Successful response for a PR-related request
            throttleUpdate();
          }
        };
      }
      
      return originalSend.apply(this, arguments);
    };
    
    // Similarly monitor fetch API - but with optimized handling
    const originalFetch = window.fetch;
    window.fetch = function(resource, init) {
      const url = (typeof resource === 'string') ? resource : resource.url;
      
      // Only monitor PR-related requests
      const isPrRequest = typeof url === 'string' && prRelatedPattern.test(url);
      
      if (!isPrRequest) {
        // Pass through unmodified for non-PR requests
        return originalFetch.apply(this, arguments);
      }
      
      return originalFetch.apply(this, arguments).then(response => {
        // If it's a successful PR-related request, throttle update
        if (response.ok) {
          throttleUpdate();
        }
        return response;
      });
    };
    
    // Return a function to restore original behavior
    return () => {
      XMLHttpRequest.prototype.open = originalOpen;
      XMLHttpRequest.prototype.send = originalSend;
      window.fetch = originalFetch;
    };
  };

  // --- Additional Reactive Features ---
  const setupKeyboardShortcuts = () => {
    // Helper function to check if element is an input field
    const isInputField = (element) => {
      return element.tagName === 'INPUT' || 
             element.tagName === 'TEXTAREA' || 
             element.isContentEditable;
    };
    
    // Set up keyboard shortcuts for common PR actions
    document.addEventListener('keydown', (e) => {
      // Only handle keyboard shortcuts if we're not in an input field
      if (isInputField(e.target)) {
        return;
      }
      
      // Alt+A: Toggle Approve/Unapprove (common shortcut in many PR systems)
      if (e.altKey && e.key === 'a') {
        const approveButton = document.querySelector('button[data-testid="approval-button"], [class*="approve-button"]');
        if (approveButton) {
          console.log('PR Tracker: Triggering approval button via keyboard shortcut');
          approveButton.click();
          
          // Update immediately after click
          setTimeout(updatePRInfoAndBadge, 750);
        }
      }
      
      // Alt+M: Merge PR (if available)
      if (e.altKey && e.key === 'm') {
        const mergeButton = document.querySelector('[data-testid="merge-button"]');
        if (mergeButton) {
          console.log('PR Tracker: Triggering merge button via keyboard shortcut');
          mergeButton.click();
          
          // Update after state changes
          setTimeout(updatePRInfoAndBadge, 1500);
        }
      }
      
      // Alt+R: Refresh PR info
      if (e.altKey && e.key === 'r') {
        console.log('PR Tracker: Manual refresh via keyboard shortcut');
        updatePRInfoAndBadge();
      }
    });
  };
  
  // Set up user presence awareness to optimize updates
  const setupUserPresenceAwareness = () => {
    let userActive = true;
    let lastActivity = Date.now();
    let activityTimeout = null;
    let backgroundRefreshTimeout = null;
    
    // Use throttled activity tracking to reduce event overhead
    const throttleActivity = (() => {
      let lastCall = 0;
      const throttleTime = 1000; // 1 second throttle
      
      return () => {
        const now = Date.now();
        if (now - lastCall >= throttleTime) {
          lastCall = now;
          trackActivity();
        }
      };
    })();
    
    // Track user activity
    const trackActivity = () => {
      userActive = true;
      lastActivity = Date.now();
      
      // Clear existing timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      // Schedule inactivity check
      activityTimeout = setTimeout(checkInactivity, 120000); // 2 minutes
      
      // If the user becomes active after being inactive, refresh
      if (window._wasInactive && currentPrId) {
        window._wasInactive = false;
        updatePRInfoAndBadge();
      }
    };
    
    // Handle inactivity detection
    const checkInactivity = () => {
      userActive = false;
      window._wasInactive = true;
    };
    
    // Perform background refresh if conditions are met
    const performBackgroundRefresh = () => {
      if (!userActive || !currentPrId || document.visibilityState !== 'visible') return;
      
      const badgeContainer = document.getElementById('pr-tracker-container');
      if (!badgeContainer) return;
      
      const now = Date.now();
      if (!window._lastBackgroundRefresh || (now - window._lastBackgroundRefresh > 120000)) { // Increased to 2 minutes
        window._lastBackgroundRefresh = now;
        updatePRInfoAndBadge();
      }
    };
    
    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentPrId) {
        trackActivity();
        updatePRInfoAndBadge();
      }
    };
    
    // Set up activity listeners - use capturing and passive flags for better performance
    // Use event delegation pattern to reduce number of listeners
    document.addEventListener('mousemove', throttleActivity, { passive: true, capture: true });
    document.addEventListener('keydown', throttleActivity, { passive: true, capture: true });
    document.addEventListener('click', throttleActivity, { passive: true, capture: true });
    
    // Set up periodic background refresh on a timer rather than interval
    const scheduleBackgroundRefresh = () => {
      if (backgroundRefreshTimeout) {
        clearTimeout(backgroundRefreshTimeout);
      }
      
      backgroundRefreshTimeout = setTimeout(() => {
        performBackgroundRefresh();
        scheduleBackgroundRefresh();
      }, 120000); // 2 minutes
    };
    
    scheduleBackgroundRefresh();
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start with an activity check
    trackActivity();
    
    // Return a cleanup function
    return () => {
      if (activityTimeout) clearTimeout(activityTimeout);
      if (backgroundRefreshTimeout) clearTimeout(backgroundRefreshTimeout);
      document.removeEventListener('mousemove', throttleActivity, { capture: true });
      document.removeEventListener('keydown', throttleActivity, { capture: true });
      document.removeEventListener('click', throttleActivity, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  };

  // --- Initialization ---
  const init = (isNavigation = false) => {
    // Enable debugging
    const DEBUG = false; // Turn off verbose logging in production
    
    // Reset retry count for new initialization
    initRetryCount = 0;
    
    // Reset DOM element cache
    cachedElements = {};
    
    // Cleanup previous observers and timers to prevent memory leaks
    cleanup();
    
    // Check if we're on a Bitbucket PR page before proceeding
    const isBitbucketPrPage = window.location.href.includes('/pull-requests/') || 
                              window.location.href.includes('/pull/') ||
                              document.querySelector('[data-qa="pr-header-title"], [data-test-id="pull-request-title"]');
    
    if (!isBitbucketPrPage) {
      if (DEBUG) console.log("PR Tracker: Not on a Bitbucket PR page, skipping initialization");
      return;
    }
    
    // Log that we're starting initialization
    if (DEBUG) console.log(`PR Tracker: Initializing on ${window.location.href}`);
    
    const initializePR = async () => {
      try {
        // Wait for page to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to track PR view
        const success = trackPRView();
        
        if (success) {
          if (DEBUG) console.log('PR Tracker initialized successfully');
          
          // Set up all event handlers
          createStatsBadge();
          setupApprovalMonitoring();
          setupReactiveListeners();
          
          // Set up PR state observer
          window._prStateObserver = setupPRStateMutationObserver();
          
          // Only set up these once and store cleanup functions
          if (!window._ajaxMonitoringCleanup) {
            window._ajaxMonitoringCleanup = setupAjaxMonitoring();
          }
          
          if (!window._keyboardShortcutsSetup) {
            setupKeyboardShortcuts();
            window._keyboardShortcutsSetup = true;
          }
          
          if (!window._userPresenceCleanup) {
            window._userPresenceCleanup = setupUserPresenceAwareness();
          }
          
          // Set up regular badge refresh for dynamic data (less frequent)
          if (badgeRefreshInterval) clearInterval(badgeRefreshInterval);
          badgeRefreshInterval = setInterval(updatePRInfoAndBadge, REFRESH_INTERVAL);
          
          // Only set up these once
          if (!isNavigation) {
            setupMessageListener();
            window._navigationObserverCleanup = setupNavigationObserver();
          }
        } else {
          // Retry a few times with increasing delays
          if (initRetryCount < MAX_RETRIES) {
            initRetryCount++;
            if (DEBUG) console.log(`PR Tracker initialization retry ${initRetryCount}/${MAX_RETRIES}`);
            setTimeout(initializePR, 1000 * initRetryCount);
          } else {
            if (DEBUG) console.log('PR Tracker initialization failed after max retries');
            
            // Even if we failed to detect PR info, still set up navigation observer
            if (!isNavigation && !window._navigationObserverCleanup) {
              window._navigationObserverCleanup = setupNavigationObserver();
            }
          }
        }
      } catch (error) {
        console.error('PR Tracker initialization error:', error);
        
        // Retry on error
        if (initRetryCount < MAX_RETRIES) {
          initRetryCount++;
          if (DEBUG) console.log(`PR Tracker initialization retry ${initRetryCount}/${MAX_RETRIES} after error`);
          setTimeout(initializePR, 1000 * initRetryCount);
        }
      }
    };
    
    // Start initialization
    initializePR();
  };

  // Centralized cleanup function to prevent memory leaks
  const cleanup = () => {
    // Clean up observers
    if (window._prStateObserver) {
      window._prStateObserver.disconnect();
      window._prStateObserver = null;
    }
    
    // Clean up intervals
    if (badgeRefreshInterval) {
      clearInterval(badgeRefreshInterval);
      badgeRefreshInterval = null;
    }
    
    // Clear any pending timeouts
    if (window._prTrackerUpdateTimeout) {
      clearTimeout(window._prTrackerUpdateTimeout);
      window._prTrackerUpdateTimeout = null;
    }
    
    if (window._prTrackerAjaxTimeout) {
      clearTimeout(window._prTrackerAjaxTimeout);
      window._prTrackerAjaxTimeout = null;
    }
    
    if (window._prTrackerFetchTimeout) {
      clearTimeout(window._prTrackerFetchTimeout);
      window._prTrackerFetchTimeout = null;
    }
    
    // Clean up AJAX monitoring
    if (typeof window._ajaxMonitoringCleanup === 'function') {
      window._ajaxMonitoringCleanup();
      window._ajaxMonitoringCleanup = null;
    }
    
    // Clean up user presence tracking
    if (typeof window._userPresenceCleanup === 'function') {
      window._userPresenceCleanup();
      window._userPresenceCleanup = null;
    }
    
    // Clean up navigation observer
    if (typeof window._navigationObserverCleanup === 'function') {
      window._navigationObserverCleanup();
      window._navigationObserverCleanup = null;
    }
  };

  // Handle page unload to clean up resources
  window.addEventListener('beforeunload', cleanup);

  // Start loading the extension
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Delay initialization to ensure the page is fully loaded
    setTimeout(init, 100);
  }
})(); 