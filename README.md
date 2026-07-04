# ClipMaster 📋

A powerful desktop clipboard manager built with Tauri v2 and Rust — enhancing your copy-paste workflow with searchable history and quick access shortcuts.

> **Previously built on Electron. Now faster, smaller, and more efficient with Tauri v2.**

## Features ✨

- **📋 Clipboard History**: Stores clipboard entries automatically with smart dedup.
- **😊 Emoji Picker**: Built-in emoji picker with 10 categories, skin tone selector, 195 country flags, and search.
- **📝 Character Limit**: Configurable per-item character limit (default 5,000).
- **🔍 Smart Search**: Instant filtering through your clipboard history and emojis.
- **⌨️ Keyboard Shortcuts**: Global shortcuts for fast access and navigation.
- **🎨 Dark/Light Themes**: Eye-friendly themes that adapt to your preference.
- **💾 Persistent Storage**: Your history survives app and system restarts.
- **🔒 Privacy First**: All data stays local on your device.
- **🖥️ Cross-Platform**: Works on Windows, macOS, and Linux.
- **⚡️ Blazing Fast**: Native Rust backend, ~5MB binary, <50MB RAM idle.
- **⚠️ History Counter**: Shows usage count when nearing capacity (80%+).
- **⚙️ Clear History**: One-click clear from the settings panel.

## Installation 🚀

### Prerequisites

- **Rust** (1.77.2+) — [Install from rustup](https://rustup.rs/)
- **Node.js** (v18+) — [Download here](https://nodejs.org/)
- **Microsoft C++ Build Tools** (Windows) — required by Tauri

### Step 1: Clone or Download

```bash
git clone <repository-url>
cd clipmaster
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Run in Development Mode

```bash
npm run dev
```

### Step 4: Build for Production

```bash
npm run build
```

Installers will be in `src-tauri/target/release/bundle/`.

## Usage Guide 📖

### Basic Workflow

1.  **Copy anything** as you normally would (`Ctrl+C` / `Cmd+C`).
2.  **Open history** using the global shortcut: `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (macOS).
3.  **Select an item** to copy it back to your clipboard.
4.  **Paste it manually** (`Ctrl+V` / `Cmd+V`) into any application.

### Emoji Picker

Switch to the **Emojis** tab to access the built-in emoji picker:
- **10 categories**: Joyous 🎉, Smileys 😊, People 👋, Animals 🐶, Food 🍔, Travel ✈️, Activities ⚽, Objects 💡, Symbols 💬, Flags 🇺🇳
- **Skin tones**: 6-level selector (default, light, medium-light, medium, medium-dark, dark) — applies to skin-tone-supporting emojis
- **All 195 UN country flags** — searchable by country name
- **Search**: Filter emojis by name or keyword across all categories
- Click an emoji or press `Enter` to copy it to clipboard (notification: "Emoji copied!")

### Settings Panel

Click the gear icon (⚙️) in the footer to open the settings panel with animated slide-in:
- **Max History Items**: Adjust the number of stored items (5–50).
- **Max Characters**: Set the per-item character limit (500–10,000).
- **Clear All History**: Removes all entries directly.

### History Counter

When your history exceeds 80% capacity, a counter (e.g., `42/50`) appears in amber in the footer.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` (Win/Linux)<br>`Cmd+Shift+V` (Mac) | Open clipboard history window |
| `Ctrl+Shift+T` (Win/Linux)<br>`Cmd+Shift+T` (Mac) | Toggle dark/light theme |
| `↑` / `↓` (History tab) | Navigate history items |
| `↑↓←→` (Emojis tab) | Navigate emoji grid |
| `Enter` | Copy selected item / emoji |
| `Delete` | Delete selected history item |
| `Esc` | Close window |
| `1-9, 0` | Quick copy items 1-10 |
| Type to search | Filter history or emojis by content |

### System Tray

Right-click the tray icon for: **Show History**, **Toggle Theme**, **Clear History**, **Launch at Startup**, **Quit**.

## Project Structure 📁

```
clipmaster/
├── index.html              # Vite entry point (UI shell)
├── src/
│   ├── main.js             # Frontend logic (Tauri IPC client)
│   ├── styles.css          # Application styling
│   └── emoji-data.js       # Emoji dataset (~600 emojis, 10 categories, flags, skin tones)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Rust binary entry point
│   │   └── lib.rs          # Rust backend (clipboard, tray, shortcuts, persistence, IPC commands)
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Tauri configuration
│   ├── capabilities/       # Security permissions
│   └── icons/              # Generated app icons
├── public/
│   └── emojis/             # 643 SVG emoji files (downloaded from emojiapi.dev)
├── assets/                 # Source icons
├── package.json            # npm scripts & JS dependencies
└── vite.config.js          # Vite bundler config
```

## Configuration ⚙️

Data is stored via `tauri-plugin-store` at the platform config directory:
- **Windows**: `%APPDATA%/com.clipmaster.desktop/clipmaster.json`
- **macOS**: `~/Library/Application Support/com.clipmaster.desktop/clipmaster.json`
- **Linux**: `~/.config/com.clipmaster.desktop/clipmaster.json`

### Default Settings
```json
{ "theme": "dark", "maxHistory": 50, "maxCharacters": 5000 }
```

Adjust from within the app via the gear icon in the footer.

## Technology Stack 🛠️

| Component | Technology |
|-----------|-----------|
| **Desktop Framework** | [Tauri v2](https://v2.tauri.app) |
| **Backend** | Rust (native, no GC) |
| **Frontend** | Vanilla JS (ES modules) |
| **Bundler** | Vite 6 |
| **Emojis** | 643 SVG files (static, local) with system-text fallback for missing ones |
| **Persistence** | tauri-plugin-store |
| **Clipboard** | tauri-plugin-clipboard-manager |
| **Shortcuts** | tauri-plugin-global-shortcut |
| **Notifications** | tauri-plugin-notification |
| **Time Formatting** | chrono (Rust) |
| **Window** | System WebView (WebView2 on Windows) |
| **Tray Icon** | Embedded 32×32 PNG (decoded at compile time) |

### Why Tauri?

- **~5MB** binary vs Electron's ~150MB
- **~40MB** RAM idle vs Electron's ~150MB
- **Native performance** from Rust backend
- **Better security** via Rust's memory safety and Tauri's permission model

## Known Limitations ⚠️

- Text-only clipboard items (images/files not yet supported)
- Requires the app to be running to capture clipboard changes

## Credits 👏

### [**Made with ❤️ by Hikwa Mehluli (thatAfro)**](https://thatafro.netlify.app)
