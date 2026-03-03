import { invoke } from "@tauri-apps/api/core";

export interface DeviceStartResponse {
  deviceCode: string;
  verificationUrl: string;
  expiresAt: number;
  pollIntervalSec: number;
}

export interface PollResponse {
  status: "pending" | "approved" | "expired" | "invalid";
  token?: string;
}

export interface SyncResult {
  sourceId: string;
  rowCount: number;
  uploadedAt: number;
}

export async function getDefaultBaseUrl(): Promise<string> {
  return invoke("get_default_base_url");
}

export async function startDeviceLink(baseUrl: string): Promise<DeviceStartResponse> {
  return invoke("start_device_link", { baseUrl });
}

export async function pollDeviceLink(baseUrl: string, deviceCode: string): Promise<PollResponse> {
  return invoke("poll_device_link", { baseUrl, deviceCode });
}

export async function getSavedDesktopToken(): Promise<string | null> {
  return invoke("get_saved_desktop_token");
}

export async function clearSavedDesktopToken(): Promise<void> {
  return invoke("clear_saved_desktop_token");
}

export async function syncNow(baseUrl: string): Promise<SyncResult> {
  return invoke("sync_now", { baseUrl });
}

export async function getSourceVisibility(baseUrl: string): Promise<boolean> {
  return invoke("get_source_visibility", { baseUrl });
}

export async function setSourceVisibility(
  baseUrl: string,
  showSourceStatsPublicly: boolean
): Promise<boolean> {
  return invoke("set_source_visibility", { baseUrl, showSourceStatsPublicly });
}
