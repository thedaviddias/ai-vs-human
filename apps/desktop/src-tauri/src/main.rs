#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sources;

use iana_time_zone::get_timezone;
use keyring::Entry;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sources::{get_adapter, DailyMetricRow};

const SERVICE_NAME: &str = "aivshuman.desktop";
const TOKEN_USERNAME: &str = "desktop_token";
const DEFAULT_BASE_URL: &str = "https://aivshuman.dev";

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

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, TOKEN_USERNAME).map_err(|error| format!("Keychain access failed: {error}"))
}

fn save_token(token: &str) -> Result<(), String> {
    let entry = keyring_entry()?;
    entry
        .set_password(token)
        .map_err(|error| format!("Failed to save desktop token: {error}"))
}

fn get_token() -> Result<Option<String>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(error) => {
            let message = error.to_string();
            if message.contains("NoEntry") || message.contains("no entry") {
                Ok(None)
            } else {
                Err(format!("Failed to read desktop token: {error}"))
            }
        }
    }
}

fn clear_token() -> Result<(), String> {
    let entry = keyring_entry()?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(error) => {
            let message = error.to_string();
            if message.contains("NoEntry") || message.contains("no entry") {
                Ok(())
            } else {
                Err(format!("Failed to clear desktop token: {error}"))
            }
        }
    }
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
fn get_saved_desktop_token() -> Result<Option<String>, String> {
    get_token()
}

#[tauri::command]
fn clear_saved_desktop_token() -> Result<(), String> {
    clear_token()
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
async fn poll_device_link(base_url: Option<String>, device_code: String) -> Result<PollResponse, String> {
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
            save_token(token)?;
        }
    }

    Ok(payload)
}

#[tauri::command]
async fn sync_now(base_url: Option<String>) -> Result<SyncResult, String> {
    let token = get_token()?.ok_or_else(|| "Desktop is not connected. Connect before syncing.".to_string())?;
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
async fn get_source_visibility(base_url: Option<String>) -> Result<bool, String> {
    let token = get_token()?.ok_or_else(|| "Desktop is not connected. Connect before syncing.".to_string())?;
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
    base_url: Option<String>,
    show_source_stats_publicly: bool,
) -> Result<bool, String> {
    let token = get_token()?.ok_or_else(|| "Desktop is not connected. Connect before syncing.".to_string())?;
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_default_base_url,
            get_saved_desktop_token,
            clear_saved_desktop_token,
            start_device_link,
            poll_device_link,
            sync_now,
            get_source_visibility,
            set_source_visibility,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
