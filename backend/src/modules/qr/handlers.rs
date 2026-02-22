use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Json,
};
use sqlx::PgPool;
use chrono::Utc;
use uuid::Uuid;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::modules::auth::handlers::get_claims_from_headers;
use super::models::{QRDataPayload, QRGenerateResponse};

#[derive(Debug, Serialize, Deserialize)]
struct QRTokenClaims {
    pub sub: String,
    pub session_id: String,
    pub iat: usize,
    pub exp: usize,
    pub jti: String,
}

pub async fn generate_qr_handler(
    headers: HeaderMap,
    State(_pool): State<PgPool>,
) -> Result<Json<QRGenerateResponse>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Unauthorized: {}", e.1)))?;

    let now_ts = Utc::now().timestamp();
    // 3 minutes validity
    let expires_ts = now_ts + (3 * 60);

    let jti = Uuid::new_v4().to_string();

    let qr_claims = QRTokenClaims {
        sub: claims.sub.clone(),
        session_id: claims.session_id.clone(),
        iat: now_ts as usize,
        exp: expires_ts as usize,
        jti: jti.clone(),
    };

    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    
    let token = encode(
        &Header::default(),
        &qr_claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to generate QR token: {}", e)))?;

    Ok(Json(QRGenerateResponse {
        id: jti.clone(),
        user_id: claims.sub.clone(),
        qr_data: token,
        expires_at: expires_ts,
    }))
}
