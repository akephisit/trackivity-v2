use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct QRDataPayload {
    pub user_id: String,
    pub session_id: String,
    pub timestamp: i64,
}

#[derive(Debug, Serialize)]
pub struct QRGenerateResponse {
    pub id: String,
    pub user_id: String,
    pub qr_data: String,
    pub expires_at: i64,
}
