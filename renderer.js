const { ipcRenderer } = require('electron');
const { formatDistanceToNow } = require('date-fns');

/**
 * ClipMaster - Renderer Process
 * 
 * This runs in the browser context (Chromium) and handles:
 * - Displaying clipboard history
 * - User interactions (clicks, keyboard)
 * - Search/filter functionality
 * - Theme switching
 * - Communication with main process via IPC
 */



// =============================================================================
// STATE MANAGEMENT
// =============================================================================

let historyData = []; // Full history array
let filteredHistory = []; // Filtered history for search
let selectedIndex = 0; // Currently selected item index
let currentTheme = 'dark'; // Current theme ('dark' or 'light')

// =============================================================================
// DOM ELEMENTS
// =============================================================================

const searchInput = document.getElementById('searchInput');
const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const closeBtn = document.getElementById('closeBtn');
const appContainer = document.getElementById('app');
const themeToggle = document.getElementById('themeToggle'); // Reference to the new theme toggle switch

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the renderer when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer process initialized');

    // Set up event listeners
    setupEventListeners();

    // The theme toggle's initial state will be set when
    // the 'update-history' IPC message is received from the main process,
    // as it provides the initial theme.

    // Focus search input when window opens
    searchInput.focus();
});

// =============================================================================
// EVENT LISTENERS
// =============================================================================

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Search input - filter history as user types
    searchInput.addEventListener('input', handleSearch);

    // Close button
    closeBtn.addEventListener('click', closeWindow);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboard);

    // Prevent default drag behavior
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

    // Theme toggle switch - send message to main process to toggle theme
    themeToggle.addEventListener('change', () => {
        console.log('Theme toggle switch changed');
        // Send an IPC message to the main process to request a theme toggle.
        // The main process will handle the actual theme change and persistence.
        ipcRenderer.send('toggle-theme');
    });
}

/**
 * Handle search input
 * Filter history based on search query
 */
function handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();

    if (query === '') {
        // Show all history
        filteredHistory = [...historyData];
    } else {
        // Filter history by content
        filteredHistory = historyData.filter(item =>
            item.content.toLowerCase().includes(query)
        );
    }

    // Reset selection to first item
    selectedIndex = 0;

    // Re-render list
    renderHistory();
}

/**
 * Handle keyboard navigation and shortcuts
 */
function handleKeyboard(event) {
    switch (event.key) {
        case 'Escape':
            // Close window
            closeWindow();
            break;

        case 'ArrowDown':
            // Move selection down
            event.preventDefault();
            if (selectedIndex < filteredHistory.length - 1) {
                selectedIndex++;
                updateSelection();
                scrollToSelected();
            }
            break;

        case 'ArrowUp':
            // Move selection up
            event.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
                updateSelection();
                scrollToSelected();
            }
            break;

        case 'Enter':
            // Paste selected item
            event.preventDefault();
            if (filteredHistory.length > 0) {
                pasteItem(filteredHistory[selectedIndex]);
            }
            break;

        case 'Delete':
            // Delete selected item
            event.preventDefault();
            if (filteredHistory.length > 0) {
                deleteItem(filteredHistory[selectedIndex]);
            }
            break;

        default:
            // Number keys 1-9, 0 for quick selection
            if (event.key >= '0' && event.key <= '9') {
                event.preventDefault();
                const index = event.key === '0' ? 9 : parseInt(event.key) - 1;
                if (index < filteredHistory.length) {
                    pasteItem(filteredHistory[index]);
                }
            }
            break;
    }
}

/**
 * Update visual selection of items
 */
function updateSelection() {
    // Remove previous selection
    const allItems = document.querySelectorAll('.history-item');
    allItems.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

/**
 * Scroll to selected item if it's out of view
 */
function scrollToSelected() {
    const selectedElement = document.querySelector('.history-item.selected');
    if (selectedElement) {
        selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}

// =============================================================================
// IPC COMMUNICATION - RECEIVING FROM MAIN PROCESS
// =============================================================================

/**
 * Receive history update from main process
 * This is called when the window opens or history changes
 */
ipcRenderer.on('update-history', (event, data) => {
    console.log('Received history update:', data.history.length, 'items');

    // Update state
    historyData = data.history;
    filteredHistory = [...historyData];
    currentTheme = data.theme;
    selectedIndex = 0;

    // Clear search input
    searchInput.value = '';

    // Apply theme
    applyTheme(currentTheme);

    // Render history
    renderHistory();

    // Focus search input
    searchInput.focus();
});

/**
 * Receive theme change from main process
 */
ipcRenderer.on('theme-changed', (event, theme) => {
    console.log('Theme changed to:', theme);
    currentTheme = theme;
    applyTheme(theme);
});

// =============================================================================
// IPC COMMUNICATION - SENDING TO MAIN PROCESS
// =============================================================================

/**
 * Send paste request to main process
 * @param {Object} item - Clipboard history item to paste
 */
function pasteItem(item) {
    console.log('Pasting item:', item.id);
    ipcRenderer.send('paste-item', item.content);
}

/**
 * Send delete request to main process
 * @param {Object} item - Clipboard history item to delete
 */
function deleteItem(item) {
    console.log('Deleting item:', item.id);
    ipcRenderer.send('delete-item', item.id);
}

/**
 * Send close window request to main process
 */
function closeWindow() {
    console.log('Closing window');
    ipcRenderer.send('close-window');
}

// =============================================================================
// RENDERING
// =============================================================================

/**
 * Render the clipboard history list
 * This is the main function that displays all items
 */
function renderHistory() {
    // Clear current list (except empty state)
    const items = historyList.querySelectorAll('.history-item');
    items.forEach(item => item.remove());

    // Check if history is empty
    if (filteredHistory.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    } else {
        emptyState.classList.add('hidden');
    }

    // Create and append history items
    filteredHistory.forEach((item, index) => {
        const itemElement = createHistoryItem(item, index);
        historyList.insertBefore(itemElement, emptyState);
    });

    // Update selection
    updateSelection();
}

/**
 * Create a single history item element
 * @param {Object} item - Clipboard history item
 * @param {number} index - Item index in the list
 * @returns {HTMLElement} The created item element
 */
function createHistoryItem(item, index) {
    // Create container
    const container = document.createElement('div');
    container.className = 'history-item';
    container.dataset.id = item.id;

    // Add selected class to first item
    if (index === selectedIndex) {
        container.classList.add('selected');
    }

    // Create index badge (only show for first 10 items)
    if (index < 10) {
        const indexBadge = document.createElement('div');
        indexBadge.className = 'item-index';
        indexBadge.textContent = index === 9 ? '0' : (index + 1).toString();
        container.appendChild(indexBadge);
    }

    // Create content preview
    const content = document.createElement('div');
    content.className = 'item-content';
    content.textContent = item.content;
    container.appendChild(content);

    // Create metadata
    const metadata = document.createElement('div');
    metadata.className = 'item-metadata';

    // Character count
    const charCount = document.createElement('span');
    charCount.innerHTML = `📝 ${item.charCount} characters`;
    metadata.appendChild(charCount);

    // Timestamp
    const timestamp = document.createElement('span');
    const timeAgo = formatDistanceToNow(item.timestamp, { addSuffix: true });
    timestamp.innerHTML = `🕒 ${timeAgo}`;
    metadata.appendChild(timestamp);

    // Truncated badge (if content was truncated)
    if (item.isTruncated) {
        const truncatedBadge = document.createElement('span');
        truncatedBadge.className = 'truncated-badge';
        truncatedBadge.textContent = 'TRUNCATED';
        metadata.appendChild(truncatedBadge);
    }

    container.appendChild(metadata);

    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete (Del key)';
    deleteBtn.innerHTML = `
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
      </path>
    </svg>
  `;

    // Delete button click handler
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent paste action
        deleteItem(item);
    });

    container.appendChild(deleteBtn);

    // Click handler - paste item
    container.addEventListener('click', () => {
        pasteItem(item);
    });

    // Hover handler - update selection
    container.addEventListener('mouseenter', () => {
        selectedIndex = index;
        updateSelection();
    });

    return container;
}

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

/**
 * Apply theme to the UI
 * @param {string} theme - Theme name ('dark' or 'light')
 */
function applyTheme(theme) {
    // Update the body class to apply the correct CSS theme variables.
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        // Set the toggle switch to be unchecked for dark theme (assuming dark is default/off state).
        themeToggle.checked = false;
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        // Set the toggle switch to be checked for light theme.
        themeToggle.checked = true;
    }

    console.log('Applied theme:', theme);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================



// =============================================================================
// LOGGING
// =============================================================================

console.log('Renderer process loaded successfully');