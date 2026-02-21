use axum::{Json, extract::{State, Path}, http::StatusCode};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;
use argon2::{Argon2, PasswordHasher, password_hash::{rand_core::OsRng, SaltString}};
use axum::http::HeaderMap;

use crate::modules::auth::get_claims_from_headers;
use super::models::*;
use rand::Rng;

pub async fn list_admins(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<AdminsListResponse>, (StatusCode, String)> {
    let _claims = get_claims_from_headers(&headers)?;
    // Should ideally check if claims.is_admin is true
    
    let rows = sqlx::query_as::<_, AdminRoleView>(r#"
        SELECT
            ar.id, ar.user_id, ar.admin_level::text AS admin_level,
            ar.organization_id, ar.permissions, ar.is_enabled,
            ar.created_at, ar.updated_at,
            u.email AS user_email, u.prefix AS user_prefix,
            u.first_name, u.last_name, u.student_id,
            u.department_id, u.created_at AS user_created_at, u.updated_at AS user_updated_at,
            o.name AS organization_name, o.code AS organization_code, o.status AS organization_status
        FROM admin_roles ar
        INNER JOIN users u ON u.id = ar.user_id
        LEFT JOIN organizations o ON o.id = ar.organization_id
        ORDER BY ar.created_at DESC
    "#)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch admins: {}", e)))?;

    let admins = rows.into_iter().map(|r| {
        AdminResponseItem {
            id: r.id,
            user_id: r.user_id,
            admin_level: r.admin_level.unwrap_or_else(|| "regular_admin".to_string()),
            organization_id: r.organization_id,
            permissions: r.permissions.map(|p| serde_json::json!(p)).unwrap_or_else(|| serde_json::json!([])),
            is_enabled: r.is_enabled.unwrap_or(true),
            is_active: false,
            created_at: r.created_at,
            updated_at: r.updated_at,
            user: AdminUserField {
                id: r.user_id,
                student_id: r.student_id,
                email: r.user_email,
                prefix: r.user_prefix.unwrap_or_else(|| "Generic".to_string()),
                first_name: r.first_name.clone(),
                last_name: r.last_name.clone(),
                department_id: r.department_id,
                organization_id: r.organization_id,
                status: "active".to_string(),
                role: "admin".to_string(),
                created_at: r.user_created_at,
                updated_at: r.user_updated_at,
            },
            organization: r.organization_id.map(|id| AdminOrgField {
                id,
                name: r.organization_name.unwrap_or_else(|| "ไม่ระบุ".to_string()),
                code: r.organization_code.unwrap_or_default(),
                status: r.organization_status.unwrap_or(true),
                created_at: Some(Utc::now()),
                updated_at: Some(Utc::now()),
            }),
            full_name: Some(format!("{} {}", r.first_name, r.last_name)),
            created_at_formatted: Some(r.created_at.to_rfc3339()),
            permission_count: Some(0),
            days_since_last_login: None,
            assigned_departments: vec![],
            department_count: Some(0),
        }
    }).collect();

    Ok(Json(AdminsListResponse { admins }))
}

pub async fn list_organization_admins(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminResponseItem>>, (StatusCode, String)> {
    let _claims: Option<()> = None;

    let rows = sqlx::query_as::<_, AdminRoleView>(r#"
        SELECT
            ar.id, ar.user_id, ar.admin_level::text AS admin_level,
            ar.organization_id, ar.permissions, ar.is_enabled,
            ar.created_at, ar.updated_at,
            u.email AS user_email, u.prefix AS user_prefix,
            u.first_name, u.last_name, u.student_id,
            u.department_id, u.created_at AS user_created_at, u.updated_at AS user_updated_at,
            o.name AS organization_name, o.code AS organization_code, o.status AS organization_status
        FROM admin_roles ar
        INNER JOIN users u ON u.id = ar.user_id
        LEFT JOIN organizations o ON o.id = ar.organization_id
        WHERE ar.admin_level IN ('organization_admin', 'regular_admin') AND ar.is_enabled = true
        ORDER BY o.name ASC, u.first_name ASC
    "#)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch org admins: {}", e)))?;

    let admins = rows.into_iter().map(|r| {
        AdminResponseItem {
            id: r.id,
            user_id: r.user_id,
            admin_level: r.admin_level.unwrap_or_else(|| "organization_admin".to_string()),
            organization_id: r.organization_id,
            permissions: r.permissions.map(|p| serde_json::json!(p)).unwrap_or_else(|| serde_json::json!([])),
            is_enabled: r.is_enabled.unwrap_or(true),
            is_active: false,
            created_at: r.created_at,
            updated_at: r.updated_at,
            user: AdminUserField {
                id: r.user_id,
                student_id: r.student_id,
                email: r.user_email,
                prefix: r.user_prefix.unwrap_or_else(|| "Generic".to_string()),
                first_name: r.first_name.clone(),
                last_name: r.last_name.clone(),
                department_id: r.department_id,
                organization_id: r.organization_id,
                status: "active".to_string(),
                role: "organization_admin".to_string(),
                created_at: r.user_created_at,
                updated_at: r.user_updated_at,
            },
            organization: r.organization_id.map(|id| AdminOrgField {
                id,
                name: r.organization_name.unwrap_or_else(|| "ไม่ระบุ".to_string()),
                code: r.organization_code.unwrap_or_default(),
                status: r.organization_status.unwrap_or(true),
                created_at: Some(Utc::now()),
                updated_at: Some(Utc::now()),
            }),
            full_name: Some(format!("{} {}", r.first_name, r.last_name)),
            created_at_formatted: Some(r.created_at.to_rfc3339()),
            permission_count: Some(0),
            days_since_last_login: None,
            assigned_departments: vec![],
            department_count: Some(0),
        }
    }).collect();

    Ok(Json(admins))
}

pub async fn create_admin(
    State(pool): State<PgPool>,
    _headers: HeaderMap,
    Json(payload): Json<CreateAdminInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pw = payload.password.unwrap_or_else(|| "123456".to_string());
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(pw.as_bytes(), &salt)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Password hashing failed".to_string()))?
        .to_string();

    let student_id = format!("A{}", rand::random::<u32>() % 900000000 + 100000000);
    let qr_secret = uuid::Uuid::new_v4().to_string();

    let row = sqlx::query(
        "INSERT INTO users (student_id, email, password_hash, prefix, first_name, last_name, qr_secret, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id"
    )
    .bind(&student_id)
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.prefix)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&qr_secret)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    use sqlx::Row;
    let user_id: Uuid = row.try_get("id").map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let org_id: Option<Uuid> = payload.organization_id.and_then(|id| Uuid::parse_str(&id).ok());
    let permissions = payload.permissions.unwrap_or_else(|| vec!["ViewDashboard".to_string()]);

    sqlx::query(
        "INSERT INTO admin_roles (user_id, admin_level, organization_id, permissions, is_enabled)
         VALUES ($1, $2::admin_level, $3, $4, true)"
    )
    .bind(&user_id)
    .bind(&payload.admin_level)
    .bind(&org_id)
    .bind(&permissions)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true, "message": "Admin created" })))
}

pub async fn update_admin(
    State(pool): State<PgPool>,
    Path(admin_id): Path<Uuid>,
    Json(payload): Json<UpdateAdminInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let row = sqlx::query("SELECT user_id FROM admin_roles WHERE id = $1")
        .bind(admin_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Admin not found".to_string()))?;

    use sqlx::Row;
    let user_id: Uuid = row.try_get("user_id").map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "failed parsing id".to_string()))?;

    let dep_id = payload.department_id.and_then(|id| Uuid::parse_str(&id).ok());
    
    sqlx::query(
        "UPDATE users SET first_name = $1, last_name = $2, email = $3, prefix = COALESCE($4, prefix), department_id = $5, updated_at = NOW() WHERE id = $6"
    )
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&payload.email)
    .bind(&payload.prefix)
    .bind(&dep_id)
    .bind(&user_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let org_id = payload.organization_id.and_then(|id| Uuid::parse_str(&id).ok());
    if let Some(org) = org_id {
        sqlx::query("UPDATE admin_roles SET organization_id = $1, updated_at = NOW() WHERE id = $2")
            .bind(org)
            .bind(admin_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn delete_admin(
    State(pool): State<PgPool>,
    Path(admin_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let row = sqlx::query("SELECT user_id FROM admin_roles WHERE id = $1")
        .bind(admin_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Admin not found".to_string()))?;

    use sqlx::Row;
    let user_id: Uuid = row.try_get("user_id").unwrap();

    // Actually, deleting users will cascade delete admin_roles, assuming FK CASCADE
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn toggle_admin_status(
    State(pool): State<PgPool>,
    Path(admin_id): Path<Uuid>,
    Json(payload): Json<ToggleStatusInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    sqlx::query("UPDATE admin_roles SET is_enabled = $1, updated_at = NOW() WHERE id = $2")
        .bind(payload.is_active)
        .bind(admin_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}
