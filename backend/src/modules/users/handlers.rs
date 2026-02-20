use axum::{Json, extract::{State, Path}, http::{StatusCode, HeaderMap}};
use sqlx::PgPool;
use crate::models::User;
use crate::modules::auth::get_claims_from_headers;
use super::models::{UserListItem, UserListResponse, UpdateProfileInput, ChangePasswordInput};
use uuid::Uuid;
use argon2::{Argon2, PasswordHash, PasswordVerifier, password_hash::{rand_core::OsRng, PasswordHasher, SaltString}};

pub async fn list_users(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<UserListResponse>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let users = sqlx::query_as::<_, UserListItem>(r#"
        SELECT
            u.id, u.student_id, u.email, u.prefix, u.first_name, u.last_name,
            u.status, u.department_id, u.created_at, u.last_login_at,
            d.name AS department_name,
            o.name AS organization_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN organizations o ON d.organization_id = o.id
        WHERE u.deleted_at IS NULL
        ORDER BY u.created_at DESC
        LIMIT 500
    "#)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch users: {}", e)))?;

    let total = users.len() as i64;
    Ok(Json(UserListResponse { users, total }))
}

pub async fn get_user(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> Result<Json<UserListItem>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let user = sqlx::query_as::<_, UserListItem>(r#"
        SELECT
            u.id, u.student_id, u.email, u.prefix, u.first_name, u.last_name,
            u.status, u.department_id, u.created_at, u.last_login_at,
            d.name AS department_name,
            o.name AS organization_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN organizations o ON d.organization_id = o.id
        WHERE u.id = $1 AND u.deleted_at IS NULL
    "#)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    Ok(Json(user))
}

pub async fn update_profile(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<UpdateProfileInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    sqlx::query(r#"
        UPDATE users SET
            prefix = COALESCE($2, prefix),
            first_name = COALESCE($3, first_name),
            last_name = COALESCE($4, last_name),
            phone = COALESCE($5, phone),
            address = COALESCE($6, address),
            updated_at = NOW()
        WHERE id = $1
    "#)
    .bind(user_id)
    .bind(payload.prefix)
    .bind(payload.first_name)
    .bind(payload.last_name)
    .bind(payload.phone)
    .bind(payload.address)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update profile: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "Profile updated successfully" })))
}

pub async fn change_password(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<ChangePasswordInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid password hash stored".to_string()))?;
    if Argon2::default().verify_password(payload.current_password.as_bytes(), &parsed_hash).is_err() {
        return Err((StatusCode::UNAUTHORIZED, "Current password is incorrect".to_string()));
    }

    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(payload.new_password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {}", e)))?
        .to_string();

    sqlx::query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1")
        .bind(user_id)
        .bind(new_hash)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update password: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "Password changed successfully" })))
}
