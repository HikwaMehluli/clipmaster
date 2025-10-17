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
        maxHistory: 15,
        maxCharacters: 5000
    }
});

// Global variables
let historyWindow = null;
let tray = null;
let lastClipboardContent = '';
let clipboardCheckInterval = null;
let isQuitting = false;

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

    // Show notification that text was copied
    if (Notification.isSupported()) {
        new Notification({
            title: 'Text Copied to History',
            icon: path.join(__dirname, 'assets', 'icon.ico')
        }).show();
    }

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
 * Adjust the clipboard polling rate.
 * @param {number} interval - The polling interval in milliseconds.
 */
function adjustPollingRate(interval) {
    // Clear any existing interval
    if (clipboardCheckInterval) {
        clearInterval(clipboardCheckInterval);
    }

    // Set a new interval
    clipboardCheckInterval = setInterval(() => {
        const currentContent = clipboard.readText();
        if (currentContent !== lastClipboardContent) {
            lastClipboardContent = currentContent;
            addToHistory(currentContent);
        }
    }, interval);

    console.log(`Clipboard polling interval set to ${interval}ms`);
}

/**
 * Start monitoring clipboard for changes with an initial polling rate.
 */
function startClipboardMonitoring() {
    lastClipboardContent = clipboard.readText();
    // Start with the idle polling rate
    adjustPollingRate(5000);
    console.log('Adaptive clipboard monitoring started');
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
        frame: false, // No title bar = false, Show Title bar = true
        transparent: false,
        resizable: false,
        alwaysOnTop: true, // Stay on top of other windows
        skipTaskbar: false, // Don't show in taskbar = true, Show in taskbar = false 
        show: true, // Start hidden = false, Start Showing = true. show when ready
        icon: path.join(__dirname, 'assets', 'icon.ico'), // Set the window icon
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

    // Adjust polling rate on show/hide
    historyWindow.on('show', () => adjustPollingRate(200));
    historyWindow.on('hide', () => adjustPollingRate(5000));

    // Hide window instead of closing (faster to reopen)
    historyWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            historyWindow.hide();

            // Notify the user that the app is still running in the background.
            if (Notification.isSupported()) {
                new Notification({
                    title: 'ClipMaster is Still Running',
                    body: 'The app is running in the system tray. Right-click the icon to quit.',
                    icon: path.join(__dirname, 'assets', 'icon.png')
                }).show();
            }
        }
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
    tray = new Tray(path.join(__dirname, 'assets', 'icon.ico'));

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
            icon: path.join(__dirname, 'assets', 'icon.ico') // Optional: An icon to display with the notification
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
// SINGLE INSTANCE LOCK
// =============================================================================

// Ensure only one instance of the app can run at a time.
const isFirstInstance = app.requestSingleInstanceLock();

if (!isFirstInstance) {
    // If this is a second instance, quit it. The first instance will be notified.
    app.quit();
} else {
    // This is the first instance. Set up a handler for when a second instance is launched.
    app.on('second-instance', () => {
        // A second instance was started. Show a notification and focus the existing window.
        if (Notification.isSupported()) {
            new Notification({
                title: 'ClipMaster is Already Running',
                body: 'You can access it from the system tray or with the shortcut.',
                icon: path.join(__dirname, 'assets', 'icon.ico')
            }).show();
        }

        // Focus the existing window.
        if (historyWindow) {
            if (historyWindow.isMinimized()) historyWindow.restore();
            historyWindow.show();
            historyWindow.focus();
        } else {
            showHistoryWindow();
        }
    });
}

// =============================================================================
// APP LIFECYCLE
// =============================================================================

app.on('before-quit', () => {
    isQuitting = true;
});

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