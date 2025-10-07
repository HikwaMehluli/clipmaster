# ClipMaster 📋

A powerful desktop clipboard manager that enhances your copy-paste workflow with searchable history and quick access shortcuts.

![ClipMaster Demo](https://github.com/HikwaMehluli/clipmaster/blob/master/img/ClipMaster-Demo.png)

## Features ✨

- **📋 Clipboard History**: Stores up to 30 clipboard entries automatically.
- **🔍 Smart Search**: Quickly filter through your clipboard history with instant results.
- **⌨️ Keyboard Shortcuts**: Lightning-fast navigation and pasting for an efficient workflow.
- **🎨 Dark/Light Themes**: Eye-friendly themes that adapt to your preference.
- **💾 Persistent Storage**: Your history survives app and system restarts.
- **🔒 Privacy First**: All data stays local on your device, with no cloud sync or external connections.
- **🖥️ Cross-Platform**: Works seamlessly on Windows, macOS, and Linux.
- **⚡️ Low CPU Usage**: Efficient clipboard monitoring with adaptive polling, significantly reducing resource consumption when idle.

## Installation 🚀

### Prerequisites

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes bundled with Node.js)

### Step 1: Clone or Download

```bash
# Clone the repository (if using Git)
git clone https://github.com/HikwaMehluli/clipmaster.git
cd clipmaster

# OR download and extract the ZIP file, then navigate to the folder
# cd clipmaster
```

### Step 2: Install Dependencies

```bash
npm install
```

This command will install all necessary project dependencies, including:
- **Electron**: The framework for building cross-platform desktop apps.
- **electron-store**: For simple, cross-platform data persistence.
- **date-fns**: A modern JavaScript date utility library.

### Step 3: Create Icon Assets

ClipMaster requires an `icon.png` for its system tray and window icons.

```bash
mkdir assets
```

**For development, you can:**
- Place any PNG image (256x256px recommended) as `assets/icon.png`.
- Find suitable icons on platforms like [Icons8](https://icons8.com/icons/set/clipboard) or [Flaticon](https://www.flaticon.com/).

**For production builds**, you'll typically need:
- `icon.ico` for Windows
- `icon.icns` for macOS
- `icon.png` for Linux

### Step 4: Run the Application

```bash
npm start
```

The application will launch and reside in your system tray! 🎉

## Usage Guide 📖

### Basic Workflow

1.  **Copy anything** as you normally would (`Ctrl+C` / `Cmd+C`).
2.  **Open history** using the global shortcut: `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (macOS).
3.  **Select an item** from the history window to copy it back to your system clipboard.
4.  **Paste it manually** (`Ctrl+V` / `Cmd+V`) into any application.

### Keyboard Shortcuts

#### Global Shortcuts (Work anywhere, even when ClipMaster is in the background)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` (Win/Linux)<br>`Cmd+Shift+V` (Mac) | Open clipboard history window |
| `Ctrl+Shift+T` (Win/Linux)<br>`Cmd+Shift+T` (Mac) | Toggle dark/light theme |

#### History Window Shortcuts (Active when the history window is open)

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate up/down through history items |
| `Enter` | Copy selected item to clipboard |
| `Delete` | Delete selected item from history |
| `Esc` | Close history window |
| `1-9, 0` | Quick paste (copies the 1st-10th item to clipboard) |
| Type to search | Instantly filter history by content |

### System Tray Menu

Right-click the ClipMaster icon in your system tray (or menu bar on macOS) to access:
-   **Show History**: Opens the clipboard history window.
-   **Toggle Theme**: Switches between dark and light themes.
-   **Clear History**: Removes all clipboard entries.
-   **Quit**: Exits the ClipMaster application.

## File Structure 📁

```
clipmaster/
├── main.js              # Main process (Electron backend, handles core logic, clipboard monitoring, windows)
├── renderer.js          # Renderer process (Frontend logic, UI display, user interactions)
├── index.html           # The main user interface for the history window
├── styles.css           # Custom styling for the application
├── package.json         # Project configuration and dependencies
├── assets/              # Contains application icons and other static assets
│   └── icon.png
└── README.md           # This comprehensive guide
```

## Configuration ⚙️

ClipMaster uses `electron-store` for persistent data storage. Configuration and history data are stored locally on your system in the following directories:

-   **Windows**: `%APPDATA%/clipmaster/`
-   **macOS**: `~/Library/Application Support/clipmaster/`
-   **Linux**: `~/.config/clipmaster/`

### Configuration Files

-   `config.json`: Stores user preferences like theme and limits.
-   `history.json`: Contains your clipboard history data.

### Default Settings

```json
{
  "theme": "dark",
  "maxHistory": 30,
  "maxCharacters": 5000
}
```

You can manually edit `config.json` to customize these values, though it's generally recommended to use the in-app settings if available (or future planned features).

## Building for Production 🏗️

To package ClipMaster into a distributable application for various platforms:

### Build for Current Platform

```bash
npm run build
```

### Build for Specific Platforms

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Generated installers and executables will be found in the `dist/` folder.

## Troubleshooting 🔧

### App doesn't start

**Solution**: Ensure all dependencies are correctly installed. Try reinstalling:
```bash
npm install
# If issues persist, try a clean reinstall:
rm -rf node_modules
npm install
```

### Global Shortcuts don't work

**Issue**: Another application might be using the same global keyboard shortcuts.

**Solution**:
1.  Identify and close conflicting applications.
2.  Restart ClipMaster.

### History window doesn't appear

**Solution**:
1.  Verify that ClipMaster is running (check for its icon in the system tray/menu bar).
2.  Try clicking the tray icon and selecting "Show History".
3.  Restart the application.

### Data not persisting

**Solution**: Check file system permissions for the configuration directories listed in the [Configuration](#configuration-) section.

## Development 🛠️

### Project Architecture

ClipMaster follows a standard Electron architecture:

-   **Main Process (`main.js`)**:
    *   Runs in a Node.js environment.
    *   Manages core application logic, including window creation, system tray, global shortcuts, and data persistence.
    *   **Adaptive Clipboard Monitoring**: Instead of constant polling, ClipMaster intelligently adjusts its clipboard monitoring frequency. It polls more frequently (every 200ms) when the application is active or the history window is open, and less frequently (every 5000ms) when the application is in the background, significantly reducing CPU usage. This is achieved by dynamically adjusting the `setTimeout` interval based on `app` and `historyWindow` focus/visibility events.

-   **Renderer Process (`renderer.js`)**:
    *   Runs in a Chromium browser environment.
    *   Handles the user interface (UI) display and all user interactions within the history window.
    *   Communicates with the Main Process via Electron's Inter-Process Communication (IPC) module.

### Key Technologies

-   **Electron**: The powerful framework for building native desktop applications with web technologies.
-   **electron-store**: A simple solution for saving and loading user preferences and application state.
-   **date-fns**: A lightweight and comprehensive JavaScript date utility library.

### Adding Features

1.  **Backend Logic**: Modify `main.js` for any core application functionality, system interactions, or data management.
2.  **UI/Frontend**: Update `renderer.js` for user interface logic and `index.html` for structural changes.
3.  **Styling**: Adjust `styles.css` to customize the application's appearance.

## Privacy & Security 🔒

ClipMaster is designed with privacy in mind:

-   ✅ All data stays **local** on your device.
-   ✅ No cloud synchronization or external network connections.
-   ✅ No analytics, telemetry, or user tracking.
-   ✅ Open source – you can audit the code yourself for transparency.

### Security Notes

-   Be aware that any sensitive information (e.g., passwords) copied to the clipboard will be stored in your local history.
-   Consider using the "Clear History" feature regularly for sensitive data.
-   For enhanced security, advanced users could implement encryption within `main.js` for stored history.

## Known Limitations ⚠️

-   Currently supports **text-only** clipboard items (images, files, and other rich content are not yet supported).
-   Maximum of 30 items stored in the history.
-   Each history item is truncated to a maximum of 5,000 characters.
-   The application must be running to capture clipboard changes.

## Future Enhancements 🚀

**Planned Features:**
-   [ ] Image and file support for clipboard history.
-   [ ] Cloud synchronization across multiple devices.
-   [ ] Customizable keyboard shortcuts.
-   [ ] Ability to pin favorite items for quick access.
-   [ ] Tags and categories for better organization.
-   [ ] Export history to various file formats.
-   [ ] A dashboard for clipboard usage statistics.
-   [ ] Clipboard templates for frequently used snippets.

## Contributing 🤝

Contributions are highly welcome! If you'd like to contribute to ClipMaster:

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b feature/your-awesome-feature`).
3.  Commit your changes (`git commit -m 'feat: Add your awesome feature'`).
4.  Push to the branch (`git push origin feature/your-awesome-feature`).
5.  Open a Pull Request with a clear description of your changes.

Please ensure your code adheres to the existing style and conventions.

## License 📄

ClipMaster is released under the [MIT License](https://opensource.org/licenses/MIT). Feel free to use this project for personal or commercial purposes.

## Support 💬

If you encounter any issues or have questions:
-   Refer to the [Troubleshooting](#troubleshooting-) section.
-   Open an issue on the [GitHub repository](https://github.com/HikwaMehluli/clipmaster/issues).
-   Review the well-commented source code for deeper understanding.

## Credits 👏

Built with passion and powered by:
-   [Electron](https://www.electronjs.org/)
-   [date-fns](https://date-fns.org/)
-   [electron-store](https://github.com/sindresorhus/electron-store)

---

**Made with ❤️ for productivity enthusiasts**

*Version 1.0.0*
