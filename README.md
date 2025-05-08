# Pull Request Watcher

<div align="center">

<img src="icon-banner.png" alt="Pull Request Watcher Banner" width="200"/>

A browser extension for tracking and managing Bitbucket pull request reviews with optimized performance.

</div>

## Features

| Feature | Description |
|---------|-------------|
| **Modern UI** | Clean, intuitive interface that shows your PR history |
| **Real-time tracking** | Tracks when you view and approve PRs |
| **Status indicators** | Shows PR status (open, approved, merged, declined) |
| **Filtering** | Filter and search through your PR history |
| **Statistics** | View review count, approval stats, and comment counts |
| **Responsive design** | Works well on different screen sizes |
| **Performance optimized** | Reduced memory usage and CPU impact |
| **Offline support** | View your PR history without internet connection |
| **Cross-browser compatibility** | Works on Chrome, Firefox, Edge, and Safari |

## Performance Optimizations

This extension has been optimized to reduce browser impact:

- **DOM Caching** - Reduces repeated DOM queries
- **Efficient Event Handling** - Uses event delegation and throttling
- **Targeted Observers** - MutationObservers focus on relevant elements
- **Memory Management** - Cleanup of listeners and observers
- **Storage Optimization** - Session storage for frequently accessed data
- **Reduced Network Calls** - Caching of PR information
- **Throttled Updates** - Controlled updates during rapid changes
- **Selective Rendering** - Updates only changed DOM elements

## How it Works

### Content Script

1. Detects when you visit a Bitbucket pull request page
2. Extracts PR information such as workspace, repository, PR number, and approval status
3. Displays a tracking badge in the top right corner with statistics
4. Monitors PR state changes (comments, approvals) using optimized observers
5. Updates badge stats when relevant changes are detected
6. Marks PRs as approved in your tracking history when you approve them

### Background Service

1. Manages storage operations
2. Handles communication between content script and popup
3. Normalizes PR information for consistent tracking
4. Provides data to the popup when requested

### Popup Interface

1. Displays tracked PRs with filtering and search capabilities
2. Shows statistics about your PR review activity
3. Allows you to manage your PR history
4. Provides links to return to PR pages

## Technical Architecture

### Files and Components

```
extension/
├── manifest.json      # Extension configuration and permissions
├── content.js         # Runs on Bitbucket PR pages to track activity
├── background.js      # Background service worker for storage & communication
├── browser-polyfill.js # Cross-browser compatibility layer
├── popup.html         # User interface HTML
├── popup.js           # Popup functionality
├── utils.js           # Shared utility functions
└── images/            # Extension icons and graphics
```

### Storage Strategy

| Storage Type | Purpose | Benefits |
|--------------|---------|----------|
| **Browser Storage** | Persistent storage for PR information | Data persists between sessions |
| **Session Storage** | Cache for frequently accessed data | Reduces overhead for active sessions |
| **Memory Cache** | DOM element cache | Improves performance by avoiding repeated queries |

## Installation

### Chrome & Edge

1. Download the extension files
2. Go to Chrome's extension management page (`chrome://extensions/`) or Edge's (`edge://extensions/`)
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed and ready to use

### Firefox

1. Download the extension files
2. Go to Firefox's debugging page (`about:debugging#/runtime/this-firefox`)
3. Click "Load Temporary Add-on..."
4. Select the manifest.json file from the extension directory
5. For permanent installation, submit to Firefox Add-ons store

### Safari

1. The extension can be built for Safari using the Safari Web Extension converter tool in Xcode
2. Follow Apple's documentation for converting and distributing web extensions
3. Safari 14+ is required for extension support

## Usage Guide

### Tracking PRs

- The extension tracks when you visit Bitbucket PR pages
- A badge appears in the top-right corner showing view count and approval stats
- Badge colors indicate PR status:
  - Blue - Open PR
  - Green - Approved/Merged PR
  - Red - Declined PR

### Viewing Your PR History

1. Click the extension icon in your browser toolbar
2. See a list of all tracked PRs with their status and details
3. PRs are sorted with most recently visited at the top

### Searching and Filtering

- **Search Box**: Filter PRs by title, repository, or workspace
- **Filter Button**: Toggle between showing all PRs, only approved PRs, or only pending PRs
- **Status Badges**: Identify PR status with color-coded badges

### Managing PR History

- **Remove Individual PRs**: Click the "x" button on any PR card to remove it
- **Refresh Data**: Click the refresh button to update your PR stats
- **View Original PR**: Click on any PR card to open it in a new tab

## Browser Support and Compatibility

| Browser | Support Level | Notes |
|---------|---------------|-------|
| **Chrome** | Fully supported | Primary development platform |
| **Edge** | Fully supported | Uses Chromium-based compatibility |
| **Firefox** | Fully supported | Uses browser-polyfill.js for APIs |
| **Safari** | Supported (v14+) | May require additional permissions |

### Browser-Specific Considerations

#### Chrome/Edge
- Works out of the box with the standard Manifest V3 implementation
- Offers the best performance due to native API support

#### Firefox
- Uses Mozilla's browser-polyfill.js to standardize WebExtension APIs
- Requires a browser_specific_settings section in manifest.json
- Some API limitations with browser.storage event handling

#### Safari
- May require additional permissions for badge display
- Storage limitations compared to other browsers
- Performance may vary due to Apple's extension sandboxing

## Cross-Browser Implementation

The extension is built with browser compatibility in mind using the following patterns:

1. **Unified API Access**: Using a browser detection system to access the appropriate API:
   ```javascript
   const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
   ```

2. **Browser-Polyfill**: Including Mozilla's browser-polyfill.js to standardize WebExtension APIs across browsers

3. **Browser-Specific Manifest Settings**: Including appropriate configuration for each browser:
   ```json
   "browser_specific_settings": {
     "gecko": {
       "id": "{extension-id}",
       "strict_min_version": "109.0"
     },
     "edge": {
       "browser_action_next_to_address_bar": true
     }
   }
   ```

4. **Resource URL Handling**: Using browser API methods to generate extension URLs:
   ```javascript
   browserAPI.runtime.getURL('path/to/resource')
   ```

## Privacy

This extension is designed with privacy in mind:

- All data is stored locally on your device
- No tracking or analytics are implemented
- No data is sent to external servers
- No personal information is collected
- Permissions are limited to only what's necessary

## Performance Considerations

The extension is designed to minimize browser impact:

- Memory usage is optimized through caching and cleanup routines
- CPU usage is reduced through throttling and selective updates
- For large PR pages, the extension adjusts update frequency
- Background processing is minimized when the page is not active

## Troubleshooting

<details>
<summary><b>Badge Not Appearing</b></summary>

- Ensure you're on a valid Bitbucket pull request page
- Try refreshing the page
- Check if you have other extensions that might be conflicting
- Verify that the extension is enabled in your browser's extension management page
- For Firefox: Check that host permissions are granted

</details>

<details>
<summary><b>PR Not Being Tracked</b></summary>

- Verify that the PR URL follows the expected Bitbucket format
- Check that the PR has loaded completely before tracking occurs
- Try manually refreshing the popup
- Check that you have permissions to view the PR

</details>

<details>
<summary><b>Extension Performance Issues</b></summary>

- Consider clearing your extension storage if you have many PRs tracked
- Disable other extensions that might be competing for resources
- Ensure your browser is updated to the latest version
- Check for console errors by opening developer tools

</details>

<details>
<summary><b>"Could not find an active browser window" Error</b></summary>

This error typically occurs in Firefox when the extension tries to access browser windows but can't locate any active ones.

Possible solutions:
- Make sure you have at least one browser window open when using the extension
- Try restarting your browser
- In Firefox, check the extension permissions in about:addons
- Temporarily disable and re-enable the extension
- If you encounter this error in the badge click, try clicking the extension icon in the toolbar instead

Technical explanation: This is usually caused by Firefox's stricter security model regarding window/tab access.

</details>

<details>
<summary><b>Browser-Specific Issues</b></summary>

#### Firefox
- If extension doesn't work, check that you've granted the required permissions
- For storage issues, try uninstalling and reinstalling the extension
- If you see Promise-related errors, this is usually related to API compatibility differences

#### Safari
- For display issues, check Safari's extension settings for display permissions
- If badge doesn't appear, try reloading the extension

</details>

## Development

If you'd like to contribute or modify the extension:

1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/pull-request-watcher.git
   ```

2. Make your changes, following the established code patterns

3. Test thoroughly on various Bitbucket PR pages and across different browsers

4. Load the unpacked extension for testing:
   - Chrome/Edge: Use `chrome://extensions/` or `edge://extensions/` with Developer mode
   - Firefox: Use `about:debugging#/runtime/this-firefox`
   - Safari: Use Xcode's Safari Web Extension development tools

5. Submit a pull request with your improvements

### Development Guidelines

- Follow the established code style and patterns
- Add comments for complex logic
- Write clean, maintainable code
- Test with various Bitbucket PR layouts
- Consider performance implications of new features
- Test across all supported browsers

## Acknowledgements

- Thanks to all contributors who have helped improve this extension
- Icons provided by Material Design icons
- Mozilla's browser-polyfill.js for cross-browser compatibility
- Built for the Bitbucket community

<div align="center">
  <p>
    <a href="https://github.com/khalilcharfi/Pull-Request-Watcher/issues">Report Bug</a> •
    <a href="https://github.com/khalilcharfi/Pull-Request-Watcher/issues">Request Feature</a>
  </p>
</div>