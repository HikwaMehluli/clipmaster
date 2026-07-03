use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
// autostart methods provided via ManagerExt trait on AppHandle
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HistoryItem {
    id: String,
    content: String,
    timestamp: i64,
    char_count: usize,
    is_truncated: bool,
}

fn generate_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:x}", nanos)
}

fn format_relative_time(timestamp: i64) -> String {
    let diff = Utc::now().timestamp_millis() - timestamp;
    if diff < 0 {
        return "just now".to_string();
    }
    let seconds = diff / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;

    if seconds < 10 {
        "just now".to_string()
    } else if seconds < 60 {
        format!("{}s ago", seconds)
    } else if minutes < 60 {
        if minutes == 1 {
            "1m ago".to_string()
        } else {
            format!("{}m ago", minutes)
        }
    } else if hours < 24 {
        if hours == 1 {
            "1h ago".to_string()
        } else {
            format!("{}h ago", hours)
        }
    } else if days < 7 {
        if days == 1 {
            "1d ago".to_string()
        } else {
            format!("{}d ago", days)
        }
    } else {
        let weeks = days / 7;
        if weeks == 1 {
            "1w ago".to_string()
        } else {
            format!("{}w ago", weeks)
        }
    }
}

fn load_history(app: &AppHandle) -> Vec<HistoryItem> {
    if let Ok(store) = app.store("clipmaster.json") {
        if let Some(value) = store.get("history") {
            if let Ok(history) = serde_json::from_value(value) {
                return history;
            }
        }
    }
    Vec::new()
}

fn save_history(app: &AppHandle, history: &[HistoryItem]) {
    if let Ok(store) = app.store("clipmaster.json") {
        store.set(
            "history",
            serde_json::to_value(history).unwrap_or(serde_json::Value::Null),
        );
        let _ = store.save();
    }
}

fn get_theme(app: &AppHandle) -> String {
    if let Ok(store) = app.store("clipmaster.json") {
        if let Some(value) = store.get("theme") {
            if let Some(theme) = value.as_str() {
                return theme.to_string();
            }
        }
    }
    "dark".to_string()
}

fn get_max_history(app: &AppHandle) -> usize {
    if let Ok(store) = app.store("clipmaster.json") {
        if let Some(value) = store.get("maxHistory") {
            if let Some(n) = value.as_u64() {
                return n as usize;
            }
        }
    }
    50
}

fn get_max_characters(app: &AppHandle) -> usize {
    if let Ok(store) = app.store("clipmaster.json") {
        if let Some(value) = store.get("maxCharacters") {
            if let Some(n) = value.as_u64() {
                return n as usize;
            }
        }
    }
    5000
}

fn emit_history_update(app: &AppHandle) {
    let history = load_history(app);
    let theme = get_theme(app);
    let max_history = get_max_history(app);
    let max_characters = get_max_characters(app);

    let enriched: Vec<serde_json::Value> = history
        .into_iter()
        .map(|item| {
            serde_json::json!({
                "id": item.id,
                "content": item.content,
                "timestamp": item.timestamp,
                "charCount": item.char_count,
                "isTruncated": item.is_truncated,
                "timeAgo": format_relative_time(item.timestamp),
            })
        })
        .collect();

    let payload = serde_json::json!({
        "history": enriched,
        "theme": theme,
        "maxHistory": max_history,
        "maxCharacters": max_characters,
    });

    let _ = app.emit("update-history", payload);
}

fn show_history_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.unminimize();
    }
    emit_history_update(app);
}

fn start_clipboard_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_content = String::new();
        loop {
            std::thread::sleep(Duration::from_millis(300));
            let content = match app.clipboard().read_text() {
                Ok(c) => c,
                Err(_) => continue,
            };
            if content.is_empty() || content == last_content {
                continue;
            }
            last_content = content.clone();

            let mut history = load_history(&app);
            if let Some(first) = history.first() {
                if first.content == content {
                    continue;
                }
            }

            let max_chars = get_max_characters(&app);
            let (truncated, is_truncated) = if content.len() > max_chars {
                (content[..max_chars].to_string(), true)
            } else {
                (content.clone(), false)
            };

            let max_history = get_max_history(&app);
            let item = HistoryItem {
                id: generate_id(),
                content: truncated.clone(),
                timestamp: Utc::now().timestamp_millis(),
                char_count: truncated.len(),
                is_truncated,
            };

            history.insert(0, item);
            history.truncate(max_history);
            save_history(&app, &history);

            emit_history_update(&app);
        }
    });
}

#[tauri::command]
fn paste_item(app: AppHandle, content: String) {
    let _ = app.clipboard().write_text(content.clone());
    let _ = app
        .notification()
        .builder()
        .title("ClipMaster")
        .body("Selected text, you can now paste it manually.")
        .show();
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn delete_item(app: AppHandle, id: String) {
    let mut history = load_history(&app);
    history.retain(|item| item.id != id);
    save_history(&app, &history);
    emit_history_update(&app);
}

#[tauri::command]
fn toggle_theme(app: AppHandle) {
    let current = get_theme(&app);
    let new = if current == "dark" { "light" } else { "dark" };
    if let Ok(store) = app.store("clipmaster.json") {
        store.set("theme", serde_json::Value::String(new.to_string()));
        let _ = store.save();
    }
    let _ = app.emit("theme-changed", new);
}

#[tauri::command]
fn clear_history(app: AppHandle) {
    save_history(&app, &[]);
    emit_history_update(&app);
}

#[tauri::command]
fn update_settings(app: AppHandle, max_history: Option<usize>, max_characters: Option<usize>) {
    if let Ok(store) = app.store("clipmaster.json") {
        if let Some(mh) = max_history {
            store.set("maxHistory", serde_json::json!(mh));
            let mut history = load_history(&app);
            history.truncate(mh);
            save_history(&app, &history);
        }
        if let Some(mc) = max_characters {
            store.set("maxCharacters", serde_json::json!(mc));
        }
        let _ = store.save();
    }
    emit_history_update(&app);
}

#[tauri::command]
fn get_initial_data(app: AppHandle) -> serde_json::Value {
    let history = load_history(&app);
    let theme = get_theme(&app);
    let max_history = get_max_history(&app);
    let max_characters = get_max_characters(&app);

    let enriched: Vec<serde_json::Value> = history
        .into_iter()
        .map(|item| {
            serde_json::json!({
                "id": item.id,
                "content": item.content,
                "timestamp": item.timestamp,
                "charCount": item.char_count,
                "isTruncated": item.is_truncated,
                "timeAgo": format_relative_time(item.timestamp),
            })
        })
        .collect();

    serde_json::json!({
        "history": enriched,
        "theme": theme,
        "maxHistory": max_history,
        "maxCharacters": max_characters,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize store with defaults
            if let Ok(store) = app.store("clipmaster.json") {
                if store.get("theme").is_none() {
                    store.set("theme", serde_json::json!("dark"));
                }
                if store.get("maxHistory").is_none() {
                    store.set("maxHistory", serde_json::json!(50));
                }
                if store.get("maxCharacters").is_none() {
                    store.set("maxCharacters", serde_json::json!(5000));
                }
                if store.get("history").is_none() {
                    store.set("history", serde_json::json!([]));
                }
            }

            // Single instance (must be first)
            #[cfg(desktop)]
            app.handle().plugin(
                tauri_plugin_single_instance::init(|app, _args, _cwd| {
                    show_history_window(app);
                }),
            )?;

            // Autostart
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec![]),
            ))?;

            // Global shortcuts
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };

                let show_key = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyV);
                let theme_key = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyT);

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                if shortcut == &show_key {
                                    show_history_window(app);
                                } else if shortcut == &theme_key {
                                    toggle_theme(app.clone());
                                }
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(show_key)?;
                app.global_shortcut().register(theme_key)?;
            }

            // System tray
            #[cfg(desktop)]
            {
                let show_item =
                    MenuItem::with_id(app, "show", "Show History", true, None::<&str>)?;
                let toggle_item =
                    MenuItem::with_id(app, "toggle", "Toggle Theme", true, None::<&str>)?;
                let clear_item =
                    MenuItem::with_id(app, "clear", "Clear History", true, None::<&str>)?;
                let autostart_item =
                    MenuItem::with_id(app, "autostart", "Launch at Startup", true, None::<&str>)?;
                let quit_item =
                    MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

                let menu = Menu::with_items(
                    app,
                    &[
                        &show_item,
                        &PredefinedMenuItem::separator(app)?,
                        &toggle_item,
                        &clear_item,
                        &PredefinedMenuItem::separator(app)?,
                        &autostart_item,
                        &PredefinedMenuItem::separator(app)?,
                        &quit_item,
                    ],
                )?;

                TrayIconBuilder::new()
                    .icon(Image::from_bytes(include_bytes!("../icons/32x32.png")).unwrap())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .tooltip("ClipMaster - Clipboard Manager")
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => show_history_window(app),
                        "toggle" => toggle_theme(app.clone()),
                        "clear" => {
                            save_history(app, &[]);
                            emit_history_update(app);
                        }
                        "autostart" => {
                            println!("Autostart toggle - feature available");
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_history_window(tray.app_handle());
                        }
                    })
                    .build(app)?;
            }

            // Start clipboard monitoring
            start_clipboard_listener(handle);

            println!("ClipMaster ready!");
            println!("Press Ctrl+Shift+V to open history");

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();
                api.prevent_close();
            }
            WindowEvent::Focused(false) => {
                let _ = window.hide();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            paste_item,
            delete_item,
            toggle_theme,
            clear_history,
            update_settings,
            get_initial_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
