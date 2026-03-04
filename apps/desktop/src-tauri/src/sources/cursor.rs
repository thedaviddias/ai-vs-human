use super::{DailyMetricRow, SourceAdapter};
use dirs::home_dir;
use rusqlite::Connection;
use rusqlite::types::ValueRef;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;

const CURSOR_KEY_PREFIX: &str = "aiCodeTracking.dailyStats.v1.";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CursorDailyStatsRaw {
    date: Option<String>,
    tab_suggested_lines: Option<f64>,
    tab_accepted_lines: Option<f64>,
    composer_suggested_lines: Option<f64>,
    composer_accepted_lines: Option<f64>,
}

pub struct CursorAdapter;

impl CursorAdapter {
    pub fn new() -> Self {
        Self
    }

    fn cursor_db_path() -> Result<PathBuf, String> {
        if cfg!(target_os = "macos") {
            let home = home_dir().ok_or_else(|| "Unable to resolve home directory".to_string())?;
            return Ok(home
                .join("Library")
                .join("Application Support")
                .join("Cursor")
                .join("User")
                .join("globalStorage")
                .join("state.vscdb"));
        }

        if cfg!(target_os = "windows") {
            let appdata = std::env::var("APPDATA")
                .map_err(|_| "APPDATA is not available on this system".to_string())?;
            return Ok(PathBuf::from(appdata)
                .join("Cursor")
                .join("User")
                .join("globalStorage")
                .join("state.vscdb"));
        }

        let xdg_config = std::env::var("XDG_CONFIG_HOME").ok();
        let base = match xdg_config {
            Some(path) => PathBuf::from(path),
            None => home_dir()
                .ok_or_else(|| "Unable to resolve home directory".to_string())?
                .join(".config"),
        };

        Ok(base
            .join("Cursor")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"))
    }

    fn parse_rows(conn: &Connection) -> Result<Vec<DailyMetricRow>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT key, value FROM ItemTable WHERE key LIKE 'aiCodeTracking.dailyStats.%'",
            )
            .map_err(|error| format!("Failed to prepare SQLite query: {error}"))?;

        let raw_rows = stmt
            .query_map([], |row| {
                let key: String = row.get(0)?;
                let value = match row.get_ref(1)? {
                    ValueRef::Blob(bytes) => String::from_utf8_lossy(bytes).to_string(),
                    ValueRef::Text(text) => String::from_utf8_lossy(text).to_string(),
                    _ => String::new(),
                };
                Ok((key, value))
            })
            .map_err(|error| format!("Failed to execute SQLite query: {error}"))?;

        let mut rows = Vec::new();
        for entry in raw_rows {
            let (key, value_string) =
                entry.map_err(|error| format!("Failed to decode SQLite row: {error}"))?;
            if value_string.is_empty() {
                continue;
            }
            let parsed: CursorDailyStatsRaw = match serde_json::from_str(&value_string) {
                Ok(data) => data,
                Err(_) => {
                    // Skip malformed entries without failing the whole sync.
                    continue;
                }
            };

            let Some(date) = parsed
                .date
                .filter(|date| is_valid_yyyy_mm_dd(date))
                .or_else(|| extract_date_from_key(&key))
            else {
                continue;
            };

            let tab_suggested = parsed.tab_suggested_lines.unwrap_or(0.0).max(0.0);
            let tab_accepted = parsed.tab_accepted_lines.unwrap_or(0.0).max(0.0);
            let composer_suggested = parsed.composer_suggested_lines.unwrap_or(0.0).max(0.0);
            let composer_accepted = parsed.composer_accepted_lines.unwrap_or(0.0).max(0.0);

            let accepted = tab_accepted + composer_accepted;
            let suggested = tab_suggested + composer_suggested;

            let mut metrics = HashMap::new();
            metrics.insert("tabAcceptedLines".to_string(), tab_accepted);
            metrics.insert("composerAcceptedLines".to_string(), composer_accepted);
            metrics.insert("tabSuggestedLines".to_string(), tab_suggested);
            metrics.insert("composerSuggestedLines".to_string(), composer_suggested);
            metrics.insert("acceptedLines".to_string(), accepted);
            metrics.insert("suggestedLines".to_string(), suggested);
            // In Cursor terms, "AI Line Edits" usually refers to the accepted lines from AI suggestions
            metrics.insert("aiLineEdits".to_string(), accepted);

            rows.push(DailyMetricRow { date, metrics });
        }

        rows.sort_by(|a, b| a.date.cmp(&b.date));
        Ok(rows)
    }
}

impl SourceAdapter for CursorAdapter {
    fn source_id(&self) -> &'static str {
        "cursor"
    }

    fn read_daily_rows(&self) -> Result<Vec<DailyMetricRow>, String> {
        let db_path = Self::cursor_db_path()?;
        if !db_path.exists() {
            return Err(format!(
                "Cursor state database was not found at {}",
                db_path.display()
            ));
        }

        let conn = Connection::open_with_flags(
            db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY
                | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX
                | rusqlite::OpenFlags::SQLITE_OPEN_URI,
        )
        .map_err(|error| format!("Failed to open Cursor state database: {error}"))?;

        Self::parse_rows(&conn)
    }
}

fn extract_date_from_key(key: &str) -> Option<String> {
    if !key.starts_with("aiCodeTracking.dailyStats.") {
        return None;
    }

    let candidate = key.rsplit('.').next()?.to_string();
    if is_valid_yyyy_mm_dd(&candidate) {
        Some(candidate)
    } else {
        None
    }
}

fn is_valid_yyyy_mm_dd(value: &str) -> bool {
    if value.len() != 10 {
        return false;
    }

    let bytes = value.as_bytes();
    for idx in [4, 7] {
        if bytes[idx] != b'-' {
            return false;
        }
    }

    let year = value[0..4].parse::<i32>().ok();
    let month = value[5..7].parse::<u32>().ok();
    let day = value[8..10].parse::<u32>().ok();

    let (year, month, day) = match (year, month, day) {
        (Some(year), Some(month), Some(day)) => (year, month, day),
        _ => return false,
    };

    if month == 0 || month > 12 {
        return false;
    }

    if day == 0 || day > 31 {
        return false;
    }

    let Some(date) = chrono_like_validate(year, month, day) else {
        return false;
    };

    date
}

fn chrono_like_validate(year: i32, month: u32, day: u32) -> Option<bool> {
    let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap {
                29
            } else {
                28
            }
        }
        _ => return None,
    };

    Some(day <= max_day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open sqlite");
        conn.execute("CREATE TABLE ItemTable (key TEXT, value BLOB)", [])
            .expect("create table");
        conn
    }

    #[test]
    fn parses_cursor_daily_rows() {
        let conn = setup_db();
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES (?1, ?2)",
            params![
                "aiCodeTracking.dailyStats.v1.2026-03-02",
                r#"{"date":"2026-03-02","tabSuggestedLines":5,"tabAcceptedLines":2,"composerSuggestedLines":3,"composerAcceptedLines":7}"#
            ],
        )
        .expect("insert row");

        let rows = CursorAdapter::parse_rows(&conn).expect("parse rows");
        assert_eq!(rows.len(), 1);
        let row = &rows[0];
        assert_eq!(row.date, "2026-03-02");
        assert_eq!(row.metrics.get("acceptedLines").copied(), Some(9.0));
        assert_eq!(row.metrics.get("suggestedLines").copied(), Some(8.0));
    }

    #[test]
    fn skips_malformed_rows_and_unrelated_keys() {
        let conn = setup_db();
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES (?1, ?2)",
            params![
                "aiCodeTracking.dailyStats.v1.2026-03-02",
                r#"{"date":"2026-03-02","tabAcceptedLines":1,"composerAcceptedLines":2}"#
            ],
        )
        .expect("insert valid row");

        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES (?1, ?2)",
            params!["cursorAuth/accessToken", "not-json"],
        )
        .expect("insert secret row");

        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES (?1, ?2)",
            params!["aiCodeTracking.dailyStats.v1.2026-03-03", "{not-json"],
        )
        .expect("insert malformed row");

        let rows = CursorAdapter::parse_rows(&conn).expect("parse rows");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].date, "2026-03-02");
    }

    #[test]
    fn validates_date_string() {
        assert!(is_valid_yyyy_mm_dd("2026-03-02"));
        assert!(!is_valid_yyyy_mm_dd("2026-02-30"));
        assert!(!is_valid_yyyy_mm_dd("invalid"));
    }
}
