use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod cursor;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyMetricRow {
    pub date: String,
    pub metrics: HashMap<String, f64>,
}

pub trait SourceAdapter: Send {
    fn source_id(&self) -> &'static str;
    fn read_daily_rows(&self) -> Result<Vec<DailyMetricRow>, String>;
}

pub fn get_adapter(source_id: &str) -> Result<Box<dyn SourceAdapter>, String> {
    match source_id {
        "cursor" => Ok(Box::new(cursor::CursorAdapter::new())),
        _ => Err(format!("Unsupported source adapter: {source_id}")),
    }
}
