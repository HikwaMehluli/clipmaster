/**
 * ClipMaster - Main Process
 * 
 * This is the main Electron process that runs in Node.js.
 * Responsibilities:
 * - Initialize the application
 * - Register global keyboard shortcuts
 * - Monitor clipboard changes
 * - Manage clipboard history
 * - Create and manage windows
 * - Handle data persistence
 * - Manage system tray
 */

const { app, BrowserWindow, globalShortcut, clipboard, Tray, Menu, ipcMain, Notification } = require('electron'); // Added Notification for native desktop alerts
const path = require('path');
const Store = require('electron-store');
const { formatDistanceToNow } = require('date-fns');

// =============================================================================
// CONFIGURATION & INITIALIZATION
// =============================================================================

/**
 * Initialize persistent storage
 * electron-store automatically saves to:
 * - Windows: %APPDATA%/clipmaster/
 * - macOS: ~/Library/Application Support/clipmaster/
 * - Linux: ~/.config/clipmaster/
 */
const store = new Store({
    defaults: {
        history: [],
        theme: 'dark',
        maxHistory: 30,
        maxCharacters: 5000
    }
});

// Global variables
let historyWindow = null;
let tray = null;
let lastClipboardContent = '';
let clipboardCheckInterval = null;

// =============================================================================
// CLIPBOARD HISTORY MANAGEMENT
// =============================================================================

/**
 * Get clipboard history from persistent storage
 * @returns {Array} Array of clipboard items
 */
function getHistory() {
    return store.get('history', []);
}

/**
 * Save clipboard history to persistent storage
 * @param {Array} history - Array of clipboard items
 */
function saveHistory(history) {
    store.set('history', history);
}

/**
 * Add new item to clipboard history
 * Implements FIFO (First In, First Out) when limit is reached
 * 
 * @param {string} content - The clipboard content to save
 */
function addToHistory(content) {
    // Validate content
    if (!content || typeof content !== 'string') {
        return;
    }

    // Trim whitespace
    content = content.trim();

    // Check if content is empty after trimming
    if (content.length === 0) {
        return;
    }

    // Get current history
    let history = getHistory();

    // Check if content already exists at the top (avoid duplicates)
    if (history.length > 0 && history[0].content === content) {
        return;
    }

    // Get max character limit from config
    const maxCharacters = store.get('maxCharacters', 5000);

    // Check if content needs to be truncated
    const isTruncated = content.length > maxCharacters;
    if (isTruncated) {
        content = content.substring(0, maxCharacters);
    }

    // Create new history item
    const newItem = {
        id: generateId(),
        content: content,
        timestamp: Date.now(),
        charCount: content.length,
        isTruncated: isTruncated
    };

    // Add to beginning of history array
    history.unshift(newItem);

    // Enforce maximum history limit (FIFO - remove oldest)
    const maxHistory = store.get('maxHistory', 30);
    if (history.length > maxHistory) {
        history = history.slice(0, maxHistory);
    }

    // Save updated history
    saveHistory(history);

    console.log(`Added to history: ${content.substring(0, 50)}... (${content.length} chars)`);
}

/**
 * Generate unique ID for clipboard items
 * @returns {string} Unique identifier
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clear all clipboard history
 */
function clearHistory() {
    saveHistory([]);
    console.log('Clipboard history cleared');
}

// =============================================================================
// CLIPBOARD MONITORING
// =============================================================================

/**
 * Start monitoring clipboard for changes
 * Uses polling strategy (checks every 500ms)
 */
function startClipboardMonitoring() {
    // Initialize with current clipboard content
    lastClipboardContent = clipboard.readText();

    // Poll clipboard every 500ms
    clipboardCheckInterval = setInterval(() => {
        const currentContent = clipboard.readText();

        // Check if clipboard content has changed
        if (currentContent !== lastClipboardContent) {
            lastClipboardContent = currentContent;

            // Add to history
            addToHistory(currentContent);
        }
    }, 500);

    console.log('Clipboard monitoring started');
}

/**
 * Stop monitoring clipboard
 */
function stopClipboardMonitoring() {
    if (clipboardCheckInterval) {
        clearInterval(clipboardCheckInterval);
        clipboardCheckInterval = null;
        console.log('Clipboard monitoring stopped');
    }
}

// =============================================================================
// WINDOW MANAGEMENT
// =============================================================================

/**
 * Create the history window
 * This window displays the clipboard history and allows selection
 */
function createHistoryWindow() {
    // If window already exists, just show it
    if (historyWindow) {
        historyWindow.show();
        historyWindow.focus();
        return;
    }

    // Create new frameless window
    historyWindow = new BrowserWindow({
        width: 600,
        height: 500,
        frame: false, // No title bar
        transparent: false,
        resizable: false,
        alwaysOnTop: true, // Stay on top of other windows
        skipTaskbar: true, // Don't show in taskbar
        show: false, // Start hidden, show when ready
        webPreferences: {
            nodeIntegration: true, // Allow Node.js in renderer
            contextIsolation: false, // Required for nodeIntegration
            enableRemoteModule: false
        }
    });

    // Load the HTML file
    historyWindow.loadFile('index.html');

    // Show window when ready
    historyWindow.once('ready-to-show', () => {
        historyWindow.show();
        historyWindow.focus();
    });

    // Hide window instead of closing (faster to reopen)
    historyWindow.on('close', (event) => {
        event.preventDefault();
        historyWindow.hide();
    });

    // Handle window blur (lost focus) - hide window
    historyWindow.on('blur', () => {
        historyWindow.hide();
    });

    console.log('History window created');
}

/**
 * Show the history window
 * Sends updated history data to renderer
 */
function showHistoryWindow() {
    if (!historyWindow) {
        createHistoryWindow();
    } else {
        historyWindow.show();
        historyWindow.focus();
    }

    // Send current history to renderer
    const history = getHistory();
    const theme = store.get('theme', 'dark');

    historyWindow.webContents.send('update-history', {
        history,
        theme
    });
}

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================

/**
 * Register global keyboard shortcuts
 * These work even when the app is not focused
 */
function registerShortcuts() {
    // Ctrl+Shift+V (Cmd+Shift+V on macOS) - Show history
    const historyShortcut = globalShortcut.register('CommandOrControl+Shift+V', () => {
        console.log('History shortcut triggered');
        showHistoryWindow();
    });

    if (!historyShortcut) {
        console.error('Failed to register history shortcut');
    }

    // Ctrl+Shift+T (Cmd+Shift+T on macOS) - Toggle theme
    const themeShortcut = globalShortcut.register('CommandOrControl+Shift+T', () => {
        console.log('Theme toggle triggered');
        toggleTheme();
    });

    if (!themeShortcut) {
        console.error('Failed to register theme shortcut');
    }

    console.log('Global shortcuts registered');
}

/**
 * Unregister all global shortcuts
 */
function unregisterShortcuts() {
    globalShortcut.unregisterAll();
    console.log('Global shortcuts unregistered');
}

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

/**
 * Toggle between dark and light theme
 */
function toggleTheme() {
    const currentTheme = store.get('theme', 'dark');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    store.set('theme', newTheme);

    // Update history window if it exists
    if (historyWindow) {
        historyWindow.webContents.send('theme-changed', newTheme);
    }

    console.log(`Theme changed to: ${newTheme}`);
}

// =============================================================================
// SYSTEM TRAY
// =============================================================================

/**
 * Create system tray icon and menu
 */
function createTray() {
    // Create tray icon (you'll need to add an icon file)
    // For now, we'll use a placeholder
    tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show History',
            click: () => {
                showHistoryWindow();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Toggle Theme',
            click: () => {
                toggleTheme();
            }
        },
        {
            label: 'Clear History',
            click: () => {
                clearHistory();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    // Set tooltip
    tray.setToolTip('ClipMaster - Clipboard Manager');

    // Set context menu
    tray.setContextMenu(contextMenu);

    // Double click to show history
    tray.on('double-click', () => {
        showHistoryWindow();
    });

    console.log('System tray created');
}

// =============================================================================
// IPC COMMUNICATION (Inter-Process Communication)
// =============================================================================

/**
 * Handle paste request from renderer process
 * When user selects an item from history
 */
ipcMain.on('paste-item', (event, content) => {
    // Copy selected content to system clipboard
    clipboard.writeText(content);

    // Update last known clipboard content to avoid re-adding
    lastClipboardContent = content;

    // Hide history window
    if (historyWindow) {
        historyWindow.hide();
    }

    // Native Notification - this checks if notifications are supported on the current system. This is important because not all operating systems or environments might fully support native notifications.
    if (Notification.isSupported()) {
        // Create a new native desktop notification.
        new Notification({
            title: 'ClipMaster', // The title of the notification
            body: 'Text copied to clipboard! You can now paste it manually.', // The main text content of the notification
            icon: path.join(__dirname, 'assets', 'icon.png') // Optional: An icon to display with the notification
        }).show();
    } else {
        // If notifications are not supported, log a message to the console.
        console.log('Notifications are not supported on this system.');
    }

    console.log(`Pasted: ${content.substring(0, 50)}...`);
});

/**
 * Handle request from renderer process to toggle the theme.
 * This IPC message is sent when the user interacts with the theme toggle switch.
 */
ipcMain.on('toggle-theme', () => {
    console.log('Received request to toggle theme from renderer.');
    toggleTheme(); // Call the existing theme toggling logic
});

/**
 * Handle delete request from renderer process
 */
ipcMain.on('delete-item', (event, itemId) => {
    let history = getHistory();
    history = history.filter(item => item.id !== itemId);
    saveHistory(history);

    // Send updated history back
    event.reply('update-history', {
        history: getHistory(),
        theme: store.get('theme', 'dark')
    });

    console.log(`Deleted item: ${itemId}`);
});

/**
 * Handle close window request from renderer
 */
ipcMain.on('close-window', () => {
    if (historyWindow) {
        historyWindow.hide();
    }
});

// =============================================================================
// APP LIFECYCLE
// =============================================================================

/**
 * App ready event - Initialize everything
 */
app.whenReady().then(() => {
    console.log('ClipMaster starting...');

    // Register global shortcuts
    registerShortcuts();

    // Start clipboard monitoring
    startClipboardMonitoring();

    // Create system tray
    createTray();

    // Don't create history window yet - only when needed
    console.log('ClipMaster ready!');
    console.log('Press Ctrl+Shift+V (Cmd+Shift+V) to open history');
});

/**
 * App activate event (macOS)
 * On macOS, re-create window when dock icon is clicked
 */
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createHistoryWindow();
    }
});

/**
 * App will quit event
 * Clean up before quitting
 */
app.on('will-quit', () => {
    // Unregister all shortcuts
    unregisterShortcuts();

    // Stop clipboard monitoring
    stopClipboardMonitoring();

    console.log('ClipMaster shutting down...');
});

/**
 * All windows closed event
 * On non-macOS, don't quit - keep running in tray
 */
app.on('window-all-closed', () => {
    // On macOS, apps typically stay active until user quits explicitly
    // For this app, we want to keep running in the tray on all platforms
    // So we don't quit here
});

console.log('Main process loaded');