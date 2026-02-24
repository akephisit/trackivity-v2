use axum::{Json, extract::{State, Path}, http::{StatusCode, HeaderMap}};
use sqlx::PgPool;
use uuid::Uuid;
use crate::modules::auth::get_claims_from_headers;

#[derive(serde::Deserialize)]
pub struct PushSubscriptionPayload {
    pub endpoint: String,
    pub keys: PushKeys,
}

#[derive(serde::Deserialize)]
pub struct PushKeys {
    pub p256dh: String,
    pub auth: String,
}

#[derive(serde::Serialize)]
pub struct NotificationPublic {
    pub id: Uuid,
    pub title: String,
    pub message: String,
    pub type_: String,
    pub link: Option<String>,
    pub read_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn subscribe_push(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<PushSubscriptionPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    sqlx::query(r#"
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (endpoint) DO UPDATE 
        SET user_id = EXCLUDED.user_id, p256dh_key = EXCLUDED.p256dh_key, auth_key = EXCLUDED.auth_key, updated_at = NOW()
    "#)
    .bind(user_id)
    .bind(&payload.endpoint)
    .bind(&payload.keys.p256dh)
    .bind(&payload.keys.auth)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to save subscription: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "Subscribed successfully" })))
}

pub async fn list_notifications(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<Vec<NotificationPublic>>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    #[derive(sqlx::FromRow)]
    struct Row {
        id: Uuid,
        title: String,
        message: String,
        type_: String,
        link: Option<String>,
        read_at: Option<chrono::DateTime<chrono::Utc>>,
        created_at: Option<chrono::DateTime<chrono::Utc>>,
    }

    let rows = sqlx::query_as::<_, Row>(r#"
        SELECT id, title, message, type::text as type_, link, read_at, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
    "#)
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch notifications: {}", e)))?;

    let notifs = rows.into_iter().map(|r| NotificationPublic {
        id: r.id,
        title: r.title,
        message: r.message,
        type_: r.type_,
        link: r.link,
        read_at: r.read_at,
        created_at: r.created_at.unwrap_or_else(|| chrono::Utc::now()),
    }).collect();

    Ok(Json(notifs))
}

pub async fn mark_read(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    sqlx::query(r#"
        UPDATE notifications 
        SET read_at = NOW() 
        WHERE id = $1 AND user_id = $2
    "#)
    .bind(id)
    .bind(user_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to mark read: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "Marked as read" })))
}

pub async fn mark_all_read(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    sqlx::query(r#"
        UPDATE notifications 
        SET read_at = NOW() 
        WHERE user_id = $1 AND read_at IS NULL
    "#)
    .bind(user_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to mark all read: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "All marked as read" })))
}
