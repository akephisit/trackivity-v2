use axum::{
    extract::{State, Path},
    http::{HeaderMap, StatusCode},
    response::Json,
};
use sqlx::PgPool;
use chrono::Utc;
use uuid::Uuid;
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::modules::auth::handlers::get_claims_from_headers;
use super::models::{QRDataPayload, QRGenerateResponse};
use crate::modules::notifications::service::{NotificationService, NotificationType};

// ─── QR Token Claims (embedded in QR code) ────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct QRTokenClaims {
    pub sub: String,       // user_id
    pub session_id: String,
    pub iat: usize,
    pub exp: usize,
    pub jti: String,       // unique token id
}

// ─── Scan Request / Response ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ScanQRRequest {
    pub qr_data: String,
}

#[derive(Debug, Serialize)]
pub struct ScanQRResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<ScanQRData>,
    pub error: Option<ScanQRError>,
}

#[derive(Debug, Serialize)]
pub struct ScanQRData {
    pub user_name: String,
    pub student_id: String,
    pub participation_status: String,
    pub checked_in_at: Option<chrono::DateTime<Utc>>,
    pub checked_out_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ScanQRError {
    pub code: String,
    pub message: String,
    pub category: String,
}

// ─── Generate QR Handler ───────────────────────────────────────────────────────

pub async fn generate_qr_handler(
    headers: HeaderMap,
    State(_pool): State<PgPool>,
) -> Result<Json<QRGenerateResponse>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Unauthorized: {}", e.1)))?;

    let now_ts = Utc::now().timestamp();
    let expires_ts = now_ts + (3 * 60); // 3 minutes

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
        id: jti,
        user_id: claims.sub,
        qr_data: token,
        expires_at: expires_ts,
    }))
}

// ─── Check-in Handler ─────────────────────────────────────────────────────────

pub async fn checkin_handler(
    headers: HeaderMap,
    State(pool): State<PgPool>,
    Path(activity_id): Path<Uuid>,
    Json(payload): Json<ScanQRRequest>,
) -> Result<Json<ScanQRResponse>, (StatusCode, String)> {
    // Must be admin to scan
    let _claims = get_claims_from_headers(&headers)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()))?;

    scan_qr(&pool, activity_id, &payload.qr_data, "checkin").await
}

// ─── Check-out Handler ────────────────────────────────────────────────────────

pub async fn checkout_handler(
    headers: HeaderMap,
    State(pool): State<PgPool>,
    Path(activity_id): Path<Uuid>,
    Json(payload): Json<ScanQRRequest>,
) -> Result<Json<ScanQRResponse>, (StatusCode, String)> {
    let _claims = get_claims_from_headers(&headers)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()))?;

    scan_qr(&pool, activity_id, &payload.qr_data, "checkout").await
}

// ─── Core Scan Logic ──────────────────────────────────────────────────────────

async fn scan_qr(
    pool: &PgPool,
    activity_id: Uuid,
    qr_data: &str,
    mode: &str,
) -> Result<Json<ScanQRResponse>, (StatusCode, String)> {
    // 1. Verify QR JWT token
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    let token_data = decode::<QRTokenClaims>(
        qr_data,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    );

    let qr_claims = match token_data {
        Ok(data) => data.claims,
        Err(e) => {
            let code = match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => "QR_EXPIRED",
                _ => "QR_INVALID",
            };
            return Ok(Json(ScanQRResponse {
                success: false,
                message: if code == "QR_EXPIRED" {
                    "QR Code หมดอายุแล้ว กรุณาสร้างใหม่".to_string()
                } else {
                    "QR Code ไม่ถูกต้อง".to_string()
                },
                data: None,
                error: Some(ScanQRError {
                    code: code.to_string(),
                    message: e.to_string(),
                    category: "error".to_string(),
                }),
            }));
        }
    };

    // 2. Parse student user_id from QR
    let student_id = Uuid::parse_str(&qr_claims.sub)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid user ID in QR".to_string()))?;

    // 3. Fetch student info
    #[derive(sqlx::FromRow)]
    struct UserRow {
        first_name: String,
        last_name: String,
        student_id: String,
    }

    let user = sqlx::query_as::<_, UserRow>(
        "SELECT first_name, last_name, student_id FROM users WHERE id = $1"
    )
    .bind(student_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = match user {
        Some(u) => u,
        None => {
            return Ok(Json(ScanQRResponse {
                success: false,
                message: "ไม่พบข้อมูลผู้ใช้ในระบบ".to_string(),
                data: None,
                error: Some(ScanQRError {
                    code: "STUDENT_NOT_FOUND".to_string(),
                    message: "User not found".to_string(),
                    category: "error".to_string(),
                }),
            }));
        }
    };

    let user_name = format!("{} {}", user.first_name, user.last_name);

    // 4. Check activity exists and is ongoing
    let activity_info: Option<(String, String)> = sqlx::query_as(
        "SELECT status::text, title FROM activities WHERE id = $1"
    )
    .bind(activity_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (activity_status, activity_title) = match activity_info {
        None => {
            return Ok(Json(ScanQRResponse {
                success: false,
                message: "ไม่พบกิจกรรมนี้ในระบบ".to_string(),
                data: None,
                error: Some(ScanQRError {
                    code: "ACTIVITY_NOT_FOUND".to_string(),
                    message: "Activity not found".to_string(),
                    category: "error".to_string(),
                }),
            }));
        }
        Some((status, title)) => {
            if status == "completed" || status == "cancelled" {
                return Ok(Json(ScanQRResponse {
                    success: false,
                    message: "กิจกรรมนี้สิ้นสุดแล้ว".to_string(),
                    data: None,
                    error: Some(ScanQRError {
                        code: "ACTIVITY_EXPIRED".to_string(),
                        message: "Activity is no longer ongoing".to_string(),
                        category: "error".to_string(),
                    }),
                }));
            } else if status == "draft" || status == "published" {
                return Ok(Json(ScanQRResponse {
                    success: false,
                    message: "กิจกรรมยังไม่เปิดให้เช็คอิน".to_string(),
                    data: None,
                    error: Some(ScanQRError {
                        code: "ACTIVITY_NOT_ONGOING".to_string(),
                        message: "Activity is not ongoing yet".to_string(),
                        category: "error".to_string(),
                    }),
                }));
            }
            (Some(status), title)
        }
    };

    // 5. Check participation record
    #[derive(sqlx::FromRow)]
    struct ParticipationRow {
        id: Uuid,
        status: String,
        checked_in_at: Option<chrono::DateTime<Utc>>,
        checked_out_at: Option<chrono::DateTime<Utc>>,
    }

    let participation = sqlx::query_as::<_, ParticipationRow>(
        "SELECT id, status::text AS status, checked_in_at, checked_out_at FROM participations WHERE user_id = $1 AND activity_id = $2"
    )
    .bind(student_id)
    .bind(activity_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match mode {
        "checkin" => {
            match participation {
                None => {
                    // Auto-register + check-in (walk-in)
                    let participation_id = Uuid::new_v4();
                    let now = Utc::now();
                    sqlx::query(r#"
                        INSERT INTO participations (id, user_id, activity_id, status, registered_at, checked_in_at)
                        VALUES ($1, $2, $3, 'checked_in'::participation_status, NOW(), NOW())
                    "#)
                    .bind(participation_id)
                    .bind(student_id)
                    .bind(activity_id)
                    .execute(pool)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                    // 🔔 Notify user that they checked in
                    let _ = NotificationService::send(
                        pool,
                        student_id,
                        &format!("✅ เช็คอินสำเร็จ: {}", activity_title),
                        &format!("คุณได้เช็คอินเข้าร่วมกิจกรรม {}", activity_title),
                        NotificationType::Success,
                        Some(&format!("/student/activities/{}", activity_id)),
                    ).await;

                    Ok(Json(ScanQRResponse {
                        success: true,
                        message: format!("เช็คอินสำเร็จ! ยินดีต้อนรับ {}", user_name),
                        data: Some(ScanQRData {
                            user_name,
                            student_id: user.student_id,
                            participation_status: "checked_in".to_string(),
                            checked_in_at: Some(now),
                            checked_out_at: None,
                        }),
                        error: None,
                    }))
                }
                Some(p) if p.status == "checked_in" => {
                    Ok(Json(ScanQRResponse {
                        success: false,
                        message: format!("{} เช็คอินไปแล้ว", user_name),
                        data: Some(ScanQRData {
                            user_name,
                            student_id: user.student_id,
                            participation_status: p.status,
                            checked_in_at: p.checked_in_at,
                            checked_out_at: p.checked_out_at,
                        }),
                        error: Some(ScanQRError {
                            code: "ALREADY_CHECKED_IN".to_string(),
                            message: "Already checked in".to_string(),
                            category: "warning".to_string(),
                        }),
                    }))
                }
                Some(p) if p.status == "checked_out" => {
                    Ok(Json(ScanQRResponse {
                        success: false,
                        message: format!("{} เช็คเอาท์ไปแล้ว ไม่สามารถเช็คอินซ้ำได้", user_name),
                        data: Some(ScanQRData {
                            user_name,
                            student_id: user.student_id,
                            participation_status: p.status,
                            checked_in_at: p.checked_in_at,
                            checked_out_at: p.checked_out_at,
                        }),
                        error: Some(ScanQRError {
                            code: "ALREADY_COMPLETED".to_string(),
                            message: "Already checked out".to_string(),
                            category: "flow_violation".to_string(),
                        }),
                    }))
                }
                Some(p) => {
                    // registered or other — do check-in
                    let now = Utc::now();
                    sqlx::query(
                        "UPDATE participations SET status = 'checked_in'::participation_status, checked_in_at = NOW() WHERE id = $1"
                    )
                    .bind(p.id)
                    .execute(pool)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                    // 🔔 Notify user that they checked in
                    let _ = NotificationService::send(
                        pool,
                        student_id,
                        &format!("✅ เช็คอินสำเร็จ: {}", activity_title),
                        &format!("คุณได้เช็คอินเข้าร่วมกิจกรรม {}", activity_title),
                        NotificationType::Success,
                        Some(&format!("/student/activities/{}", activity_id)),
                    ).await;

                    Ok(Json(ScanQRResponse {
                        success: true,
                        message: format!("เช็คอินสำเร็จ! ยินดีต้อนรับ {}", user_name),
                        data: Some(ScanQRData {
                            user_name,
                            student_id: user.student_id,
                            participation_status: "checked_in".to_string(),
                            checked_in_at: Some(now),
                            checked_out_at: None,
                        }),
                        error: None,
                    }))
                }
            }
        }
        "checkout" => {
            match participation {
                None => {
                    Ok(Json(ScanQRResponse {
                        success: false,
                        message: format!("{} ยังไม่ได้เช็คอิน", user_name),
                        data: None,
                        error: Some(ScanQRError {
                            code: "NOT_CHECKED_IN".to_string(),
                            message: "Not checked in yet".to_string(),
                            category: "error".to_string(),
                        }),
                    }))
                }
                Some(p) if p.status != "checked_in" => {
                    let code = if p.status == "checked_out" { "ALREADY_CHECKED_OUT" } else { "NOT_CHECKED_IN_YET" };
                    Ok(Json(ScanQRResponse {
                        success: false,
                        message: if p.status == "checked_out" {
                            format!("{} เช็คเอาท์ไปแล้ว", user_name)
                        } else {
                            format!("{} ยังไม่ได้เช็คอิน", user_name)
                        },
                        data: Some(ScanQRData {
                            user_name,
                            student_id: user.student_id,
                            participation_status: p.status,
                            checked_in_at: p.checked_in_at,
                            checked_out_at: p.checked_out_at,
                        }),
                        error: Some(ScanQRError {
                            code: code.to_string(),
                            message: "Cannot check out".to_string(),
                            category: "error".to_string(),
                        }),
                    }))
                }
                Some(p) => {
                    // checked_in → check out
                    let now = Utc::now();
                    sqlx::query(
                        "UPDATE participations SET status = 'checked_out'::participation_status, checked_out_at = NOW() WHERE id = $1"
                    )
                    .bind(p.id)
                    .execute(pool)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                    // 🔔 Notify user that they checked out
                    let _ = NotificationService::send(
                        pool,
                        student_id,
                        &format!("✅ เช็คเอาท์สำเร็จ: {}", activity_title),
                        &format!("คุณได้เช็คเอาท์กิจกรรม {} เรียบร้อยแล้ว ขอบคุณที่เข้าร่วม!", activity_title),
                        NotificationType::Success,
                        Some(&format!("/student/activities/{}", activity_id)),
                    ).await;

                    Ok(Json(ScanQRResponse {
                        success: true,
                        message: format!("เช็คเอาท์สำเร็จ! ขอบคุณ {} ที่เข้าร่วมกิจกรรม", user_name),
                        data: Some(ScanQRData {
                            user_name,
                            student_id: user.student_id,
                            participation_status: "checked_out".to_string(),
                            checked_in_at: p.checked_in_at,
                            checked_out_at: Some(now),
                        }),
                        error: None,
                    }))
                }
            }
        }
        _ => Err((StatusCode::BAD_REQUEST, "Invalid mode".to_string())),
    }
}
