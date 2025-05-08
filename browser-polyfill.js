/**
 * Browser API Compatibility Layer
 * This script provides a unified API for Chrome and Firefox extensions
 */

(function() {
  // Check if we're in a browser extension context
  // Use self instead of window for service worker compatibility
  const globalScope = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this);
  
  if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    // We're in Chrome, create a browser namespace that maps to chrome
    globalScope.browser = {
      // Storage
      storage: {
        local: {
          get: function(keys, callback) {
            return chrome.storage.local.get(keys, callback);
          },
          set: function(keys, callback) {
            return chrome.storage.local.set(keys, callback);
          },
          remove: function(keys, callback) {
            return chrome.storage.local.remove(keys, callback);
          }
        }
      },
      
      // Runtime
      runtime: {
        getManifest: function() {
          return chrome.runtime.getManifest();
        },
        getURL: function(path) {
          return chrome.runtime.getURL(path);
        },
        sendMessage: function(message, responseCallback) {
          return chrome.runtime.sendMessage(message, responseCallback);
        },
        onMessage: {
          addListener: function(callback) {
            return chrome.runtime.onMessage.addListener(callback);
          },
          removeListener: function(callback) {
            return chrome.runtime.onMessage.removeListener(callback);
          }
        },
        onInstalled: {
          addListener: function(callback) {
            return chrome.runtime.onInstalled.addListener(callback);
          }
        }
      },
      
      // Tabs
      tabs: {
        query: function(queryInfo, callback) {
          return chrome.tabs.query(queryInfo, callback);
        },
        sendMessage: function(tabId, message, responseCallback) {
          return chrome.tabs.sendMessage(tabId, message, responseCallback);
        },
        create: function(createProperties, callback) {
          return chrome.tabs.create(createProperties, callback);
        },
        update: function(tabId, updateProperties, callback) {
          return chrome.tabs.update(tabId, updateProperties, callback);
        }
      },
      
      // Add alarms API which is used in background-wrapper.js
      alarms: {
        create: function(name, alarmInfo) {
          return chrome.alarms.create(name, alarmInfo);
        },
        onAlarm: {
          addListener: function(callback) {
            return chrome.alarms.onAlarm.addListener(callback);
          }
        }
      }
    };
  } else if (typeof browser !== 'undefined') {
    // We're in Firefox, which already has a browser namespace
    // We might need to add some missing properties or methods
    
    // Fix potentially missing callbacks for promises
    const originalSendMessage = browser.runtime.sendMessage;
    browser.runtime.sendMessage = function(message, responseCallback) {
      if (responseCallback) {
        originalSendMessage(message).then(responseCallback, (error) => {
          console.error("Error in browser.runtime.sendMessage:", error);
        });
        return true; // Return true for Firefox when using callbacks
      }
      return originalSendMessage(message);
    };
    
    // Similar fixes for storage operations if needed
    const originalGet = browser.storage.local.get;
    browser.storage.local.get = function(keys, callback) {
      if (callback) {
        originalGet(keys).then(callback, (error) => {
          console.error("Error in browser.storage.local.get:", error);
        });
        return true;
      }
      return originalGet(keys);
    };
    
    const originalSet = browser.storage.local.set;
    browser.storage.local.set = function(keys, callback) {
      if (callback) {
        originalSet(keys).then(callback, (error) => {
          console.error("Error in browser.storage.local.set:", error);
        });
        return true;
      }
      return originalSet(keys);
    };
    
    const originalRemove = browser.storage.local.remove;
    browser.storage.local.remove = function(keys, callback) {
      if (callback) {
        originalRemove(keys).then(callback, (error) => {
          console.error("Error in browser.storage.local.remove:", error);
        });
        return true;
      }
      return originalRemove(keys);
    };
    
    // Ensure alarms API is available in Firefox
    if (!browser.alarms) {
      browser.alarms = {
        create: function(name, alarmInfo) {
          // Fallback implementation if needed
          console.warn("browser.alarms.create not implemented in this browser");
        },
        onAlarm: {
          addListener: function(callback) {
            console.warn("browser.alarms.onAlarm not implemented in this browser");
          }
        }
      };
    }
  }
})(); 