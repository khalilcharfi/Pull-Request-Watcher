// Background wrapper for Manifest V3
// This imports the browser polyfill first, then the main background script
try {
  console.log("Background wrapper initializing...");
  importScripts('browser-polyfill.js');
  console.log("Browser polyfill loaded");
  importScripts('background.js');
  console.log("Background script loaded");
  
  // Add a simple ping handler to test connectivity
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  
  // Direct ping handler for faster response
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "ping") {
      console.log("Ping received in background wrapper");
      sendResponse({ success: true, message: "Background script is running!" });
      return true;
    }
  });
  
  // Keep service worker alive with an alarm
  browserAPI.alarms.create('keepAlive', { periodInMinutes: 1 });
  
  // Handle the keep-alive alarm
  browserAPI.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
      console.log("Background service worker kept alive");
      
      // Refresh cache periodically
      refreshDataCache();
    }
  });
  
  // Create a special cached version of PR data for faster popup loading
  function refreshDataCache() {
    browserAPI.storage.local.get(null, (result) => {
      // Process all PR info entries to create a cache
      const prs = {};
      
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
      
      // Store the processed data in a cache
      browserAPI.storage.local.set({ 
        'pr_data_cache': {
          timestamp: Date.now(),
          data: prs
        }
      }, () => {
        console.log("PR data cache refreshed");
      });
    });
  }
  
  // Create initial cache
  setTimeout(refreshDataCache, 1000);
  
  console.log("Background wrapper initialized successfully");
} catch (error) {
  console.error("Error initializing background wrapper:", error);
} 