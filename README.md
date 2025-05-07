# Pull Request Watcher

<div align="center">

<img src="icon-banner.png" alt="Pull Request Watcher Banner" width="200"/>

A Chrome extension for tracking and managing Bitbucket pull request reviews with optimized performance.

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
├── popup.html         # User interface HTML
├── popup.js           # Popup functionality
├── utils.js           # Shared utility functions
└── images/            # Extension icons and graphics
```

### Storage Strategy

| Storage Type | Purpose | Benefits |
|--------------|---------|----------|
| **Chrome Storage** | Persistent storage for PR information | Data persists between sessions |
| **Session Storage** | Cache for frequently accessed data | Reduces overhead for active sessions |
| **Memory Cache** | DOM element cache | Improves performance by avoiding repeated queries |

## Installation

1. Download the extension files
2. Go to Chrome's extension management page (`chrome://extensions/`)
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed and ready to use

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

## Browser Support

| Browser | Support Level |
|---------|---------------|
| **Chrome** | Fully supported |
| **Edge** | Compatible (Chromium-based) |
| **Firefox** | Currently not supported |
| **Safari** | Currently not supported |

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
- Verify that the extension is enabled in chrome://extensions/

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
- Ensure your Chrome is updated to the latest version
- Check for console errors by opening developer tools

</details>

## Development

If you'd like to contribute or modify the extension:

1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/pull-request-watcher.git
   ```

2. Make your changes, following the established code patterns

3. Test thoroughly on various Bitbucket PR pages

4. Load the unpacked extension in Chrome for testing:
   - Open `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select your project folder

5. Submit a pull request with your improvements

### Development Guidelines

- Follow the established code style and patterns
- Add comments for complex logic
- Write clean, maintainable code
- Test with various Bitbucket PR layouts
- Consider performance implications of new features

## License

[MIT License](LICENSE)

## Acknowledgements

- Thanks to all contributors who have helped improve this extension
- Icons provided by Material Design icons
- Built for the Bitbucket community

<div align="center">
  <p>
    <a href="https://github.com/yourusername/pull-request-watcher/issues">Report Bug</a> •
    <a href="https://github.com/yourusername/pull-request-watcher/issues">Request Feature</a>
  </p>
</div>