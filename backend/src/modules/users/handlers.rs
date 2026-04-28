use axum::{Json, extract::{Query, State, Path}, http::{StatusCode, HeaderMap}};
use serde::Deserialize;
use sqlx::PgPool;
use crate::models::{AdminLevel, User};
use crate::modules::auth::get_claims_from_headers;
use super::models::{
    UserListItem, UserListResponse, UpdateProfileInput, ChangePasswordInput,
    AdminUpdateUserInput, AdminResetPasswordInput,
};
use uuid::Uuid;
use argon2::{Argon2, PasswordHash, PasswordVerifier, password_hash::{rand_core::OsRng, PasswordHasher, SaltString}};

/// Resolve the organization that owns the target user (via department) and
/// confirm the caller is allowed to write to it. super_admin bypasses scope;
/// organization_admin must share the org; everyone else is rejected.
async fn assert_can_manage_user(
    pool: &PgPool,
    claims: &crate::modules::auth::models::Claims,
    target_user_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    if matches!(claims.admin_level, Some(AdminLevel::SuperAdmin)) {
        return Ok(());
    }

    if !matches!(claims.admin_level, Some(AdminLevel::OrganizationAdmin)) {
        return Err((
            StatusCode::FORBIDDEN,
            "Only super_admin or organization_admin can modify users".to_string(),
        ));
    }

    let target_org: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT d.organization_id
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = $1 AND u.deleted_at IS NULL
        "#,
    )
    .bind(target_user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    if target_org != claims.organization_id {
        return Err((
            StatusCode::FORBIDDEN,
            "Cannot modify users outside your organization".to_string(),
        ));
    }

    Ok(())
}

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

// ─── Admin: edit other user ─────────────────────────────────────────────────

pub async fn admin_update_user(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<AdminUpdateUserInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    assert_can_manage_user(&pool, &claims, user_id).await?;

    if payload.email.is_none() && payload.status.is_none() {
        return Err((StatusCode::BAD_REQUEST, "No fields to update".to_string()));
    }

    let result = sqlx::query(
        r#"
        UPDATE users SET
            email = COALESCE($2, email),
            status = COALESCE($3, status),
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .bind(payload.email.as_deref())
    .bind(payload.status.as_ref())
    .execute(&pool)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error() {
            if db_err.is_unique_violation() {
                return (StatusCode::CONFLICT, "Email already in use".to_string());
            }
        }
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update user: {}", e))
    })?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "User not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "message": "User updated successfully" })))
}

pub async fn admin_reset_password(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<AdminResetPasswordInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    assert_can_manage_user(&pool, &claims, user_id).await?;

    if payload.new_password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Password must be at least 8 characters".to_string(),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(payload.new_password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {}", e)))?
        .to_string();

    let result = sqlx::query(
        "UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .bind(new_hash)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to reset password: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "User not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "message": "Password reset successfully" })))
}

/// Soft-delete: sets deleted_at = NOW() and disables any admin role they hold.
/// Hard DELETE would be blocked by activities.created_by ON DELETE RESTRICT,
/// and the rest of the codebase already filters by deleted_at IS NULL, so the
/// soft variant is what "ลบ" means in this schema.
pub async fn admin_delete_user(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    assert_can_manage_user(&pool, &claims, user_id).await?;

    // Don't let an admin delete themselves — too easy to lock yourself out.
    if claims.sub == user_id.to_string() {
        return Err((StatusCode::BAD_REQUEST, "Cannot delete your own account".to_string()));
    }

    let mut tx = pool.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query("UPDATE admin_roles SET is_enabled = false WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to disable admin role: {}", e)))?;

    let result = sqlx::query(
        "UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to delete user: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "User not found".to_string()));
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to commit: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "User deleted successfully" })))
}

/// List a user's participations with activity context — read access mirrors
/// get_user (any admin level, scoped to their organization for non-super).
pub async fn admin_get_user_participations(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let scope_org_id: Option<Uuid> = match claims.admin_level {
        Some(AdminLevel::SuperAdmin) => None,
        _ => claims.organization_id,
    };

    // Confirm the target user is visible to the caller.
    let exists: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT u.id
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = $1
          AND u.deleted_at IS NULL
          AND ($2::uuid IS NULL OR d.organization_id = $2)
        "#,
    )
    .bind(user_id)
    .bind(scope_org_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "User not found".to_string()));
    }

    #[derive(sqlx::FromRow)]
    struct Row {
        id: Uuid,
        status: String,
        registered_at: Option<chrono::DateTime<chrono::Utc>>,
        checked_in_at: Option<chrono::DateTime<chrono::Utc>>,
        checked_out_at: Option<chrono::DateTime<chrono::Utc>>,
        notes: Option<String>,
        activity_id: Uuid,
        activity_title: String,
        activity_location: Option<String>,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
        hours: i16,
        organizer_name: String,
        activity_type: String,
        activity_level: Option<String>,
    }

    let rows = sqlx::query_as::<_, Row>(
        r#"
        SELECT
            p.id, p.status::text AS status, p.registered_at, p.checked_in_at, p.checked_out_at, p.notes,
            a.id AS activity_id,
            a.title AS activity_title,
            a.location AS activity_location,
            a.start_date,
            a.end_date,
            a.hours,
            o.name AS organizer_name,
            a.activity_type::text AS activity_type,
            a.activity_level::text AS activity_level
        FROM participations p
        JOIN activities a ON p.activity_id = a.id
        JOIN organizations o ON a.organizer_id = o.id
        WHERE p.user_id = $1
        ORDER BY a.start_date DESC, p.registered_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch participations: {}", e)))?;

    // Aggregate stats so the frontend can show a one-look summary card.
    let total = rows.len();
    let mut total_hours: i32 = 0;
    let mut faculty_hours: i32 = 0;
    let mut university_hours: i32 = 0;
    let mut completed = 0;
    for r in &rows {
        if r.status == "completed" || r.status == "checked_out" {
            total_hours += r.hours as i32;
            match r.activity_level.as_deref() {
                Some("university") => university_hours += r.hours as i32,
                Some("faculty") => faculty_hours += r.hours as i32,
                _ => {}
            }
            completed += 1;
        }
    }

    let participations: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.id,
            "status": r.status,
            "registered_at": r.registered_at,
            "checked_in_at": r.checked_in_at,
            "checked_out_at": r.checked_out_at,
            "notes": r.notes,
            "activity": {
                "id": r.activity_id,
                "title": r.activity_title,
                "location": r.activity_location,
                "start_date": r.start_date,
                "end_date": r.end_date,
                "hours": r.hours,
                "organizer_name": r.organizer_name,
                "activity_type": r.activity_type,
                "activity_level": r.activity_level
            }
        })
    }).collect();

    Ok(Json(serde_json::json!({
        "stats": {
            "total": total,
            "completed": completed,
            "total_hours": total_hours,
            "faculty_hours": faculty_hours,
            "university_hours": university_hours
        },
        "participations": participations
    })))
}
