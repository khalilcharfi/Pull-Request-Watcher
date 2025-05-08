// Background script for handling communication between content script and popup

// Browser compatibility check - ensure 'browser' is available or fall back to 'chrome'
const getBrowserAPI = () => {
  return typeof browser !== 'undefined' ? browser : chrome;
};

// Get browser API reference
const browserAPI = getBrowserAPI();

browserAPI.runtime.onInstalled.addListener(() => {
  // Clean up potential duplicate entries on extension update/install
  cleanupDuplicatePRs();
  // Clean up any PRs with unknown project or repo
  cleanupUnknownPRs();
});

// Clean up PRs with unknown project or repo
function isProjectOrRepoUnknown(prInfo) {
  return (prInfo.project === 'Unknown' || prInfo.project === 'unknown-project') ||
         (prInfo.repo === 'Unknown' || prInfo.repo === 'unknown-repo');
}

function cleanupUnknownPRs() {
  browserAPI.storage.local.get(null, (result) => {
    const toRemove = [];

    Object.keys(result).forEach(key => {
      handleKey(result, key, toRemove);
    });

    removeItemsIfNeeded(toRemove);
  });
}

function handleKey(result, key, toRemove) {
  if (key.startsWith('pr-info-')) {
    const prInfo = result[key];

    if (!prInfo) return;

    if (isProjectOrRepoUnknown(prInfo)) {
      toRemove.push(key);
      addPrIdToRemove(key, result, toRemove);
    }
  }
}

function addPrIdToRemove(key, result, toRemove) {
  const prId = key.substring(8);
  if (result[prId]) {
    toRemove.push(prId);
  }
}

function removeItemsIfNeeded(toRemove) {
  if (toRemove.length > 0) {
    browserAPI.storage.local.remove(toRemove, () => {
      console.log(`Cleaned up ${toRemove.length} items with unknown project/repo`);
    });
  }
}

// Clean up duplicate PR entries by normalizing to the pr-123 format
function cleanupDuplicatePRs() {
  browserAPI.storage.local.get(null, (result) => {
    const updates = {};
    const toRemove = [];
    const prIds = new Set();
    
    // First pass: Find all PR info entries and check for duplicates using URL normalization
    Object.keys(result).forEach(key => {
      if (key.startsWith('pr-info-')) {
        const prInfo = result[key];
        
        // Skip if no URL or already processed
        if (!prInfo || !prInfo.url) return;
        
        // Use the URL utility to get the normalized PR ID
        try {
          const normalizedUrl = normalizeBitbucketPrUrl(prInfo.url);
          if (normalizedUrl) {
            const match = normalizedUrl.match(/pull-requests\/(\d+)/);
            if (match) {
              const prNumber = match[1];
              const normalizedId = `pr-${prNumber}`;
              const normalizedInfoKey = `pr-info-${normalizedId}`;
              
              // If this is a different key but same PR, consolidate
              if (key !== normalizedInfoKey) {
                updates[normalizedInfoKey] = prInfo;
                toRemove.push(key);
                
                // Also update the corresponding stats entry
                const oldPrId = key.substring(8); // Remove 'pr-info-' prefix
                if (result[oldPrId] && oldPrId !== normalizedId) {
                  updates[normalizedId] = result[oldPrId];
                  toRemove.push(oldPrId);
                }
              }
            }
          }
        } catch (e) {
          console.error("Error normalizing URL:", e);
        }
      }
    });
    
    // Second pass: Handle legacy numeric IDs or other formats
    Object.keys(result).forEach(key => {
      // Skip PR info entries (handled in first pass)
      if (key.startsWith('pr-info-')) return;
      
      // Handle legacy numeric IDs or other formats
      if (key.match(/\d+$/) || key.includes('/')) {
        const match = key.match(/\d+$/);
        if (match) {
          const prNumber = match[0];
          const normalizedId = `pr-${prNumber}`;
          
          // Save the stats under the normalized ID if not already updated
          if (!prIds.has(normalizedId) && key !== normalizedId) {
            updates[normalizedId] = result[key];
            prIds.add(normalizedId);
            toRemove.push(key);
          }
        }
      }
    });
    
    // Apply the changes if needed
    if (Object.keys(updates).length > 0) {
      browserAPI.storage.local.set(updates, () => {
        if (toRemove.length > 0) {
          browserAPI.storage.local.remove(toRemove);
        }
      });
    }
  });
}

// Include normalizing and duplicate detection functions
function normalizeBitbucketPrUrl(url) {
  try {
    const parsedUrl = new URL(url);
    
    // Extract PR number from /pull-requests/{number}
    const match = parsedUrl.pathname.match(/\/pull-requests\/(\d+)/);
    if (match) {
      return `pull-requests/${match[1]}`;
    }
  } catch (e) {
    console.error('Invalid URL:', url);
  }
  return null;
}

function isSameBitbucketPr(url1, url2) {
  const pr1 = normalizeBitbucketPrUrl(url1);
  const pr2 = normalizeBitbucketPrUrl(url2);
  return pr1 && pr2 && pr1 === pr2;
}

// Handler for all extension messages
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in background.js:", message.action);
  
  // Use message action for cleaner switch pattern
  switch (message.action) {
    case "ping":
      console.log("Ping received in background.js");
      sendResponse({ success: true, message: "Background script is running!" });
      return true;
      
    case "getPRStats":
      // Get single PR stats
      if (message.prId) {
        const prInfoKey = `pr-info-${message.prId}`;
        browserAPI.storage.local.get([message.prId, prInfoKey], (result) => {
          sendResponse({
            stats: result[message.prId] || { reviewCount: 0, approvalCount: 0 },
            info: result[prInfoKey] || {}
          });
        });
      } else {
        sendResponse({ stats: { reviewCount: 0, approvalCount: 0 }, info: {} });
      }
      return true; // Required for async sendResponse
      
    case "updatePRStats":
      const { prId, prInternalId, isApproval, shouldIncrementView } = message;
      
      // Get the PR info key that corresponds to this PR
      const prInfoKey = `pr-info-${prId}`;
      
      // Check if this is an Unknown/Unknown PR before updating stats
      browserAPI.storage.local.get([prInfoKey], (result) => {
        const prInfo = result[prInfoKey];
        
        // Skip if this PR has either Unknown project or Unknown repo
        if (prInfo && isProjectOrRepoUnknown(prInfo)) {
          console.log("Ignoring PR with unknown project or repo");
          sendResponse({ success: false, ignored: true });
          return;
        }
        
        // Continue with updating stats
        browserAPI.storage.local.get([prId, prInfoKey], (result) => {
          const stats = result[prId] || { reviewCount: 0, approvalCount: 0, lastReviewed: Date.now() };
          const prInfoData = result[prInfoKey] || {};
          
          // Only increment the review count if this is a new view and shouldIncrementView is true
          if (shouldIncrementView === true) {
            stats.reviewCount = (stats.reviewCount || 0) + 1;
            console.log(`Incrementing view count for ${prId} to ${stats.reviewCount}`);
          }
          
          // Handle approval actions
          if (isApproval) {
            stats.approvalCount = (stats.approvalCount || 0) + 1;
          }
          
          // Update the PR info with latest data
          const updatedPrInfo = {
            ...prInfoData,
            lastVisited: Date.now(),
            viewCount: stats.reviewCount,
            isApprovedByMe: isApproval || prInfoData.isApprovedByMe
          };
          
          // Store internal ID if provided for better cross-repo tracking
          if (prInternalId && !stats.internalId) {
            stats.internalId = prInternalId;
          }
          
          // Write back to storage
          browserAPI.storage.local.set({ 
            [prId]: stats,
            [prInfoKey]: updatedPrInfo
          }, () => {
            // Broadcast update to all tabs and popup
            broadcastStatsUpdate(prId);
            sendResponse({ success: true, stats });
          });
        });
      });
      return true;
      
    case "getAllPRStats":
      // Get all stored PRs for the popup
      browserAPI.storage.local.get(null, (result) => {
        const prs = {};
        
        // Process all PR info entries
        Object.keys(result).forEach(key => {
          if (key.startsWith('pr-info-')) {
            const prId = key.substring(8); // Remove 'pr-info-' prefix
            const stats = result[prId] || { reviewCount: 0, approvalCount: 0 };
            
            // Merge stats with PR info
            prs[prId] = {
              ...result[key],
              viewCount: stats.reviewCount || 0,
              approvalCount: stats.approvalCount || 0,
              lastReviewed: stats.lastReviewed || result[key].lastVisited || Date.now(),
              prNumber: prId.replace('pr-', '')
            };
          }
        });
        
        sendResponse({ success: true, prs });
      });
      return true;
      
    case "removePR":
      if (message.prId) {
        const prInfoKey = `pr-info-${message.prId}`;
        browserAPI.storage.local.remove([message.prId, prInfoKey], () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: "Invalid PR ID" });
      }
      return true;
      
    case "cleanupUnknown":
      cleanupUnknownPRs();
      sendResponse({ success: true });
      return true;
    
    case "openPopup":
      // Handle request to open popup explicitly for Firefox
      if (typeof browser !== 'undefined' && browser.browserAction) {
        try {
          browser.browserAction.openPopup().catch(err => {
            console.log("Error opening popup:", err);
            // Send response even if there's an error
            sendResponse({ success: false, error: err.message });
          });
        } catch (err) {
          console.log("Error opening popup:", err);
          sendResponse({ success: false, error: err.message });
        }
      } else {
        // If browserAction API is not available, just respond with success
        // Chrome and Edge don't need this method
        sendResponse({ success: true });
      }
      return true;
      
    default:
      sendResponse({ success: false, error: "Unknown action" });
      return true;
  }
});

// Broadcast updates to open tabs and popup
function broadcastStatsUpdate(prId) {
  const message = { action: "statsUpdated", prId };
  
  // Send to all tabs that might be interested
  try {
    browserAPI.tabs.query({ url: "*://*.bitbucket.org/*/pull-requests/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        tabs.forEach(tab => {
          browserAPI.tabs.sendMessage(tab.id, message).catch(err => {
            // Silently handle errors - tab might not have content script running
          });
        });
      }
    });
  } catch (err) {
    console.log("Error querying tabs:", err);
  }
  
  // Also notify the popup if it's open
  try {
    browserAPI.runtime.sendMessage(message).catch(err => {
      // Popup might not be open, ignore errors
    });
  } catch (err) {
    console.log("Error sending runtime message:", err);
  }
} 