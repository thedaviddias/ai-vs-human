#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sources;

use iana_time_zone::get_timezone;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sources::{get_adapter, DailyMetricRow};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_store::StoreBuilder;

const DEFAULT_BASE_URL: &str = "https://aivshuman.dev";
const STORE_FILENAME: &str = "auth_token.json";
const TOKEN_KEY: &str = "desktop_token";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DeviceStartResponse {
    device_code: String,
    verification_url: String,
    expires_at: i64,
    poll_interval_sec: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PollResponse {
    status: String,
    token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SyncResult {
    source_id: String,
    row_count: i64,
    uploaded_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SourceVisibilityResponse {
    show_source_stats_publicly: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PollRequest {
    device_code: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadPayload {
    source_id: String,
    schema_version: i64,
    is_full_snapshot: bool,
    timezone: String,
    rows: Vec<DailyMetricRow>,
    client: UploadClient,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadClient {
    app_version: String,
    platform: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceVisibilityRequest {
    show_source_stats_publicly: bool,
}

fn normalize_base_url(base_url: Option<String>) -> String {
    let input = base_url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| std::env::var("AIVSHUMAN_DESKTOP_BASE_URL").ok())
        .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());

    input.trim_end_matches('/').to_string()
}

fn save_token(app: &tauri::AppHandle, token: &str) -> Result<(), String> {
    let store = StoreBuilder::new(app, STORE_FILENAME)
        .build()
        .map_err(|e| format!("Store init error: {e}"))?;
    store.set(
        TOKEN_KEY.to_string(),
        serde_json::Value::String(token.to_string()),
    );
    store.save().map_err(|e| format!("Store save error: {e}"))
}

fn get_token(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let store = StoreBuilder::new(app, STORE_FILENAME)
        .build()
        .map_err(|e| format!("Store init error: {e}"))?;
    let token = store
        .get(TOKEN_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()));
    Ok(token)
}

fn clear_token(app: &tauri::AppHandle) -> Result<(), String> {
    let store = StoreBuilder::new(app, STORE_FILENAME)
        .build()
        .map_err(|e| format!("Store init error: {e}"))?;
    store.delete(TOKEN_KEY);
    store.save().map_err(|e| format!("Store save error: {e}"))
}

fn current_platform() -> String {
    match std::env::consts::OS {
        "macos" => "macos".to_string(),
        "windows" => "windows".to_string(),
        "linux" => "linux".to_string(),
        _ => "linux".to_string(),
    }
}

#[tauri::command]
fn get_default_base_url() -> String {
    normalize_base_url(None)
}

#[tauri::command]
fn get_saved_desktop_token(app: tauri::AppHandle) -> Result<Option<String>, String> {
    get_token(&app)
}

#[tauri::command]
fn clear_saved_desktop_token(app: tauri::AppHandle) -> Result<(), String> {
    clear_token(&app)
}

#[tauri::command]
async fn start_device_link(base_url: Option<String>) -> Result<DeviceStartResponse, String> {
    let base_url = normalize_base_url(base_url);
    let endpoint = format!("{base_url}/api/desktop/device/start");

    let client = Client::new();
    let response = client
        .post(endpoint)
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|error| format!("Failed to start device link: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read error response".to_string());
        return Err(format!("Device link start failed ({status}): {body}"));
    }

    response
        .json::<DeviceStartResponse>()
        .await
        .map_err(|error| format!("Invalid device link response: {error}"))
}

#[tauri::command]
async fn poll_device_link(
    app: tauri::AppHandle,
    base_url: Option<String>,
    device_code: String,
) -> Result<PollResponse, String> {
    let base_url = normalize_base_url(base_url);
    let endpoint = format!("{base_url}/api/desktop/device/poll");

    let client = Client::new();
    let response = client
        .post(endpoint)
        .json(&PollRequest { device_code })
        .send()
        .await
        .map_err(|error| format!("Failed to poll device link: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read error response".to_string());
        return Err(format!("Device link poll failed ({status}): {body}"));
    }

    let payload = response
        .json::<PollResponse>()
        .await
        .map_err(|error| format!("Invalid poll response: {error}"))?;

    if payload.status == "approved" {
        if let Some(token) = payload.token.as_ref() {
            save_token(&app, token)?;
        }
    }

    Ok(payload)
}

#[tauri::command]
async fn sync_now(app: tauri::AppHandle, base_url: Option<String>) -> Result<SyncResult, String> {
    let token = get_token(&app)?.ok_or_else(|| {
        "Desktop is not connected. Connect before syncing.".to_string()
    })?;
    let base_url = normalize_base_url(base_url);
    let endpoint = format!("{base_url}/api/desktop/upload/daily-stats");

    let (source_id, rows) = {
        let adapter = get_adapter("cursor")?;
        let rows = adapter.read_daily_rows()?;
        (adapter.source_id().to_string(), rows)
    };

    let timezone = get_timezone().unwrap_or_else(|_| "UTC".to_string());
    let payload = UploadPayload {
        source_id,
        schema_version: 1,
        is_full_snapshot: true,
        timezone,
        rows,
        client: UploadClient {
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            platform: current_platform(),
        },
    };

    let client = Client::new();
    let response = client
        .post(endpoint)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Failed to upload source stats: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read error response".to_string());
        return Err(format!("Upload failed ({status}): {body}"));
    }

    response
        .json::<SyncResult>()
        .await
        .map_err(|error| format!("Invalid upload response: {error}"))
}

#[tauri::command]
async fn get_source_visibility(
    app: tauri::AppHandle,
    base_url: Option<String>,
) -> Result<bool, String> {
    let token = get_token(&app)?.ok_or_else(|| {
        "Desktop is not connected. Connect before syncing.".to_string()
    })?;
    let base_url = normalize_base_url(base_url);
    let endpoint = format!("{base_url}/api/desktop/upload/source-visibility");

    let client = Client::new();
    let response = client
        .get(endpoint)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| format!("Failed to fetch source visibility: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read error response".to_string());
        return Err(format!("Source visibility fetch failed ({status}): {body}"));
    }

    let payload = response
        .json::<SourceVisibilityResponse>()
        .await
        .map_err(|error| format!("Invalid source visibility response: {error}"))?;

    Ok(payload.show_source_stats_publicly)
}

#[tauri::command]
async fn set_source_visibility(
    app: tauri::AppHandle,
    base_url: Option<String>,
    show_source_stats_publicly: bool,
) -> Result<bool, String> {
    let token = get_token(&app)?.ok_or_else(|| {
        "Desktop is not connected. Connect before syncing.".to_string()
    })?;
    let base_url = normalize_base_url(base_url);
    let endpoint = format!("{base_url}/api/desktop/upload/source-visibility");

    let client = Client::new();
    let response = client
        .post(endpoint)
        .bearer_auth(token)
        .json(&SourceVisibilityRequest {
            show_source_stats_publicly,
        })
        .send()
        .await
        .map_err(|error| format!("Failed to update source visibility: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read error response".to_string());
        return Err(format!("Source visibility update failed ({status}): {body}"));
    }

    let payload = response
        .json::<SourceVisibilityResponse>()
        .await
        .map_err(|error| format!("Invalid source visibility response: {error}"))?;

    Ok(payload.show_source_stats_publicly)
}

#[tauri::command]
async fn get_user_stats(
    app: tauri::AppHandle,
    base_url: Option<String>,
) -> Result<serde_json::Value, String> {
    let token = get_token(&app)?.ok_or_else(|| {
        "Desktop is not connected. Connect before syncing.".to_string()
    })?;
    let base_url = normalize_base_url(base_url);
    let endpoint = format!("{base_url}/api/desktop/user-stats");

    let client = Client::new();
    let response = client
        .get(endpoint)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| format!("Failed to fetch user stats: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read error response".to_string());
        return Err(format!("User stats fetch failed ({status}): {body}"));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("Invalid user stats response: {error}"))
}

#[tauri::command]
async fn get_local_cursor_stats() -> Result<Vec<DailyMetricRow>, String> {
    let adapter = get_adapter("cursor")?;
    adapter.read_daily_rows()
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|error| format!("Failed to open URL: {error}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app: &tauri::AppHandle, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_default_base_url,
            get_saved_desktop_token,
            clear_saved_desktop_token,
            start_device_link,
            poll_device_link,
            sync_now,
            get_source_visibility,
            set_source_visibility,
            open_url,
            get_user_stats,
            get_local_cursor_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

