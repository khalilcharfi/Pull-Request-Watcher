/**
 * Utility functions for handling Bitbucket PR URLs
 */

/**
 * Normalizes a Bitbucket PR URL to a standard format for comparison
 * @param {string} url - The full Bitbucket PR URL
 * @returns {string|null} - Normalized PR identifier or null if invalid
 */
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

/**
 * Compares two Bitbucket PR URLs to check if they refer to the same PR
 * @param {string} url1 - First PR URL
 * @param {string} url2 - Second PR URL
 * @returns {boolean} - True if URLs refer to the same PR
 */
function isSameBitbucketPr(url1, url2) {
  const pr1 = normalizeBitbucketPrUrl(url1);
  const pr2 = normalizeBitbucketPrUrl(url2);
  return pr1 && pr2 && pr1 === pr2;
}

/**
 * Extracts the current tab/view from a Bitbucket PR URL
 * @param {string} url - The full Bitbucket PR URL
 * @returns {string} - The tab name or 'overview' as default
 */
function getBitbucketPrTab(url) {
  try {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(/\/pull-requests\/\d+\/(\w+)/);
    return match ? match[1] : 'overview';
  } catch (e) {
    console.error('Invalid URL:', url);
    return 'overview';
  }
}

/**
 * Extracts comprehensive information about a Bitbucket pull request
 * @returns {Object} - Detailed PR information including workspace, repository, PR ID, and approval status
 */
function extractBitbucketPrInfo() {
  const info = {
    workspace: null,
    repository: null,
    pullRequestId: null,
    isApprovedByMe: false, // Default to false
    currentUser: {
      displayName: null,
      uuid: null
    },
    source: [] // To track all sources that contributed
  };

  function addSource(sourceName) {
    if (!info.source.includes(sourceName)) {
      info.source.push(sourceName);
    }
  }

  // --- Get Current User Information ---
  try {
    const metaBootstrap = document.getElementById('bb-bootstrap');
    if (metaBootstrap && metaBootstrap.dataset.currentUser) {
      const currentUserData = JSON.parse(metaBootstrap.dataset.currentUser);
      info.currentUser.displayName = currentUserData.displayName;
      info.currentUser.uuid = currentUserData.uuid;
      addSource("meta#bb-bootstrap[data-current-user]");
    } else if (window.__app_data__ && window.__app_data__.user) {
      // Fallback to __app_data__ if meta tag is not structured as expected
      info.currentUser.uuid = window.__app_data__.user.uuid;
      // Attempt to get displayName from various possible locations in Bitbucket's JS objects
      if (window.__app_data__.user.displayName) {
        info.currentUser.displayName = window.__app_data__.user.displayName;
      } else if (window.__app_data__.initialContext && window.__app_data__.initialContext.user && window.__app_data__.initialContext.user.display_name) {
        info.currentUser.displayName = window.__app_data__.initialContext.user.display_name;
      } else if (window.__initial_state__ && window.__initial_state__.global && window.__initial_state__.global.currentUser && window.__initial_state__.global.currentUser.display_name) {
        info.currentUser.displayName = window.__initial_state__.global.currentUser.display_name;
      }
      addSource("window.__app_data__.user or fallbacks");
    }
    if (!info.currentUser.displayName && info.currentUser.uuid) {
        console.warn("Current user UUID found, but displayName is missing. Approval check might be less reliable if names vary slightly.");
    }
  } catch (e) {
    console.warn("Error extracting current user info:", e);
  }

  // --- Method 1: Try Bitbucket's internal __initial_state__ (often most reliable for URL context & PR ID) ---
  try {
    if (window.__initial_state__ && window.__initial_state__.global && window.__initial_state__.global.path) {
      const path = window.__initial_state__.global.path;
      const pathParts = path.split('/');
      // Expected path: /<workspace>/<repository>/pull-requests/<pr_id>/...
      if (pathParts.length >= 5 && pathParts[3] === 'pull-requests') {
        info.workspace = pathParts[1];
        info.repository = pathParts[2];
        info.pullRequestId = pathParts[4];
        addSource("window.__initial_state__.global.path");
      }
    }
  } catch (e) {
    console.warn("Error accessing window.__initial_state__:", e);
  }

  // --- Method 2: Try Bitbucket's internal __app_data__ (good for explicit workspace/repo info) ---
  try {
    if (window.__app_data__ && window.__app_data__.initialContext) {
      if (window.__app_data__.initialContext.workspace && window.__app_data__.initialContext.workspace.slug) {
        if (!info.workspace) info.workspace = window.__app_data__.initialContext.workspace.slug;
        addSource("window.__app_data__.initialContext.workspace");
      }
      if (window.__app_data__.initialContext.repository && window.__app_data__.initialContext.repository.slug) {
        if (!info.repository) info.repository = window.__app_data__.initialContext.repository.slug;
        addSource("window.__app_data__.initialContext.repository");
      }
      // __app_data__ might not have PR ID directly in initialContext for PR page.
    }
  } catch (e) {
    console.warn("Error accessing window.__app_data__:", e);
  }

  // --- Method 3: Parse the current URL (window.location.pathname) ---
  if (!info.workspace || !info.repository || !info.pullRequestId) {
    try {
      const path = window.location.pathname;
      const prPathMatch = path.match(/^\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/);
      if (prPathMatch) {
        if (!info.workspace) info.workspace = prPathMatch[1];
        if (!info.repository) info.repository = prPathMatch[2];
        if (!info.pullRequestId) info.pullRequestId = prPathMatch[3];
        addSource("window.location.pathname");
      }
    } catch (e) {
      console.warn("Error parsing window.location.pathname:", e);
    }
  }

  // --- Method 4: Parse the <title> tag ---
  if (!info.workspace || !info.repository || !info.pullRequestId) {
    try {
      const title = document.title;
      // Example: "check24 / fvk-core Pull Request #2733: [FFMFVK-2450]..."
      const titleMatch = title.match(/^([^\/]+)\s*\/\s*([^\s]+)\s+Pull Request\s+#(\d+)/);
      if (titleMatch) {
        if (!info.workspace) info.workspace = titleMatch[1].trim();
        if (!info.repository) info.repository = titleMatch[2].trim();
        if (!info.pullRequestId) info.pullRequestId = titleMatch[3].trim();
        addSource("document.title");
      }
    } catch (e) {
      console.warn("Error parsing document.title:", e);
    }
  }

  // --- Method 5: DOM Parsing for PR ID (more robust selectors) ---
  if (!info.pullRequestId) {
    try {
      // Try to find the PR ID in the header activity string.
      // This string usually sits near elements with 'data-qa' attributes related to PR header.
      const prHeaderElement = document.querySelector('[data-testid="pr-header"]');
      if (prHeaderElement) {
        // The PR ID line (e.g., "#2733 • Created...") is often a sibling or near sibling of branch display
        const activityElements = Array.from(prHeaderElement.querySelectorAll('span, div')); // Get potential text containers
        for (const el of activityElements) {
          if (el.textContent.includes('• Created') && el.textContent.includes('#')) {
            const match = el.textContent.match(/#(\d+)/);
            if (match && match[1]) {
              info.pullRequestId = match[1];
              addSource("DOM (PR Header Activity Text)");
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error parsing PR ID from DOM (Header Activity Text):", e);
    }
  }

  // --- Method 6: DOM Parsing for Workspace & Repository from breadcrumbs (more robust selectors) ---
  if (!info.workspace || !info.repository) {
    try {
      const breadcrumbNav = document.querySelector('nav[aria-label="Breadcrumbs"]');
      if (breadcrumbNav) {
        const breadcrumbLinks = breadcrumbNav.querySelectorAll('ol li a');
        if (breadcrumbLinks.length > 0) {
          // Workspace is usually the first link that goes to /<workspace_slug>/
          // It might also contain an avatar for the workspace.
          const workspaceLink = breadcrumbLinks[0];
          if (workspaceLink && workspaceLink.href.includes(window.location.origin)) {
            const hrefParts = new URL(workspaceLink.href).pathname.split('/').filter(p => p);
            if (hrefParts.length === 1 && !info.workspace) { // e.g., /check24/
              info.workspace = hrefParts[0];
              addSource("DOM (Breadcrumbs - Workspace)");
            }
          }
        }
        if (breadcrumbLinks.length >= 2) { // Need at least workspace and repo/project
          // Repository is often the link before "Pull requests" or the one with /src
          for (let i = 0; i < breadcrumbLinks.length; i++) {
            const link = breadcrumbLinks[i];
            const linkText = link.textContent.trim();
            const href = link.getAttribute('href');

            if (href && href.includes('/src') && !href.endsWith('/src')) { // e.g. /workspace/repo/src
                const parts = href.split('/');
                const repoIndex = parts.indexOf('src') - 1;
                if (repoIndex > 0 && !info.repository) {
                    info.repository = parts[repoIndex];
                    if (!info.workspace && repoIndex > 0) info.workspace = parts[repoIndex-1];
                    addSource("DOM (Breadcrumbs - Repo via /src)");
                    break;
                }
            }
            // If the next breadcrumb is "Pull requests", this one is likely the repo
            if (breadcrumbLinks[i+1] && breadcrumbLinks[i+1].textContent.trim().toLowerCase() === "pull requests" && !info.repository) {
                 info.repository = linkText;
                 addSource("DOM (Breadcrumbs - Repo before PRs)");
                 // Try to infer workspace from its href if not found
                 if (!info.workspace && href) {
                    const parts = href.split('/');
                    if (parts.length >= 3) info.workspace = parts[1]; // e.g., /check24/fvk-core
                 }
                 break;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error parsing Workspace/Repo from Breadcrumbs DOM:", e);
    }
  }

  // --- Method 7: DOM Parsing for Repository from Left Sidebar (more robust selector) ---
  if (!info.repository) {
    try {
      // Look for the main repository link in the sidebar header
      const sidebarHeaderLink = document.querySelector('div[data-navheader="true"] a[href*="/src"]'); // Link usually points to /<workspace>/<repo>/src
      if (sidebarHeaderLink) {
        const repoNameElement = sidebarHeaderLink.querySelector('h2[data-item-title="true"]');
        if (repoNameElement) {
          info.repository = repoNameElement.textContent.trim();
          addSource("DOM (Sidebar Repo Name)");
          if (!info.workspace) { // Attempt to get workspace from the href of this link
            const hrefParts = sidebarHeaderLink.getAttribute('href').split('/');
            if (hrefParts.length > 2) {
              info.workspace = hrefParts[1]; // path is like /workspace/repo/src
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error parsing Repo from Sidebar DOM:", e);
    }
  }

  // --- Method 8: Check if current user has approved ---
  // This relies on the "Review status" section being present in the DOM.
  if (info.currentUser && info.currentUser.displayName) {
    try {
      const reviewStatusSection = document.querySelector('section[aria-label="Review status"]');
      if (reviewStatusSection) {
        const reviewerItems = reviewStatusSection.querySelectorAll('div[tabindex="0"][class*="e17nk92o2"]'); // A common wrapper for reviewer items
        let foundReviewer = false;
        for (const item of reviewerItems) {
          const profileTrigger = item.querySelector('span[data-testid="profileCardTrigger"][aria-label*="More information about"]');
          const statusIconElement = item.querySelector('span[data-testid="reviewer-status-icon"]');

          if (profileTrigger && statusIconElement) {
            const ariaLabel = profileTrigger.getAttribute('aria-label');
            const nameMatch = ariaLabel.match(/More information about (.*)/);
            if (nameMatch && nameMatch[1]) {
              const reviewerName = nameMatch[1].trim();
              if (reviewerName === info.currentUser.displayName) {
                foundReviewer = true;
                const approvalStatus = statusIconElement.getAttribute('aria-label');
                if (approvalStatus === "Approved") {
                  info.isApprovedByMe = true;
                }
                addSource("DOM (Reviewer List)");
                break; // Found the current user, no need to check further reviewers
              }
            }
          }
        }
        // If the user is in the reviewer list but their status was not "Approved", isApprovedByMe remains false.
        // If the user is not in the reviewer list at all, isApprovedByMe also remains false.
      } else {
        console.warn("Review status section not found. Cannot determine approval by current user.");
      }
    } catch (e) {
      console.warn("Error checking approval status from DOM:", e);
    }
  } else {
    console.warn("Current user display name not found. Cannot reliably check approval status.");
  }

  // Final cleanup for textContent artifacts
  if (info.workspace && typeof info.workspace === 'string') {
    info.workspace = info.workspace.split("\n")[0].trim();
  }
  if (info.repository && typeof info.repository === 'string') {
    info.repository = info.repository.split("\n")[0].trim();
  }

  // Source tracking checks
  if (info.source.length === 0 && !info.workspace && !info.repository && !info.pullRequestId) {
    info.source.push("No PR/Workspace/Repo data found through any method.");
  } else if (info.source.length === 0 && (info.workspace || info.repository || info.pullRequestId)) {
    info.source.push("Data found, but source tracking missed (edge case).");
  }

  return info;
} 