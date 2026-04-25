use axum::{Json, extract::{Query, State, Path}, http::{StatusCode, HeaderMap}};
use serde::Deserialize;
use sqlx::PgPool;
use crate::models::{AdminLevel, User};
use crate::modules::auth::get_claims_from_headers;
use super::models::{UserListItem, UserListResponse, UpdateProfileInput, ChangePasswordInput};
use uuid::Uuid;
use argon2::{Argon2, PasswordHash, PasswordVerifier, password_hash::{rand_core::OsRng, PasswordHasher, SaltString}};

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    /// Free-text match against first_name, last_name, email, student_id (ILIKE).
    pub search: Option<String>,
    /// Filter by user status (active / inactive / suspended).
    pub status: Option<String>,
}

pub async fn list_users(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Query(params): Query<ListUsersQuery>,
) -> Result<Json<UserListResponse>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    // Super admin sees all users; org / regular admin only sees users
    // whose department belongs to their own organization. The $1::uuid
    // IS NULL trick lets one query handle both cases.
    let scope_org_id: Option<Uuid> = match claims.admin_level {
        Some(AdminLevel::SuperAdmin) => None,
        _ => claims.organization_id,
    };

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * per_page;

    // Normalise filters: empty string → None so SQL can short-circuit.
    let search_pattern = params
        .search
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{}%", s));
    let status_filter = params
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != "all");

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.deleted_at IS NULL
          AND ($1::uuid IS NULL OR d.organization_id = $1)
          AND ($2::text IS NULL OR u.status::text = $2)
          AND ($3::text IS NULL OR (
              u.first_name ILIKE $3
              OR u.last_name ILIKE $3
              OR u.email ILIKE $3
              OR u.student_id ILIKE $3
          ))
        "#,
    )
    .bind(scope_org_id)
    .bind(status_filter)
    .bind(search_pattern.as_deref())
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to count users: {}", e)))?;

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
          AND ($1::uuid IS NULL OR d.organization_id = $1)
          AND ($2::text IS NULL OR u.status::text = $2)
          AND ($3::text IS NULL OR (
              u.first_name ILIKE $3
              OR u.last_name ILIKE $3
              OR u.email ILIKE $3
              OR u.student_id ILIKE $3
          ))
        ORDER BY u.created_at DESC
        LIMIT $4 OFFSET $5
    "#)
    .bind(scope_org_id)
    .bind(status_filter)
    .bind(search_pattern.as_deref())
    .bind(per_page)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch users: {}", e)))?;

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

    let scope_org_id: Option<Uuid> = match claims.admin_level {
        Some(AdminLevel::SuperAdmin) => None,
        _ => claims.organization_id,
    };

    let user = sqlx::query_as::<_, UserListItem>(r#"
        SELECT
            u.id, u.student_id, u.email, u.prefix, u.first_name, u.last_name,
            u.status, u.department_id, u.created_at, u.last_login_at,
            d.name AS department_name,
            o.name AS organization_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN organizations o ON d.organization_id = o.id
        WHERE u.id = $1
          AND u.deleted_at IS NULL
          AND ($2::uuid IS NULL OR d.organization_id = $2)
    "#)
    .bind(user_id)
    .bind(scope_org_id)
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
