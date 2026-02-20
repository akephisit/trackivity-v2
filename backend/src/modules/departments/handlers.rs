use axum::{Json, extract::{State, Path}, http::{StatusCode, HeaderMap}};
use sqlx::PgPool;
use crate::modules::auth::get_claims_from_headers;
use super::models::{DepartmentFull, CreateDepartmentInput, UpdateDepartmentInput};
use uuid::Uuid;

pub async fn list_departments(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<Vec<DepartmentFull>>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let departments = sqlx::query_as::<_, DepartmentFull>(r#"
        SELECT
            d.id, d.name, d.code, d.description, d.organization_id, d.status, d.created_at, d.updated_at,
            o.name AS organization_name,
            (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.deleted_at IS NULL) AS students_count,
            (SELECT COUNT(*) FROM admin_roles ar WHERE ar.organization_id = d.organization_id) AS admins_count
        FROM departments d
        JOIN organizations o ON d.organization_id = o.id
        ORDER BY o.name ASC, d.name ASC
    "#)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch departments: {}", e)))?;

    Ok(Json(departments))
}

pub async fn create_department(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<CreateDepartmentInput>,
) -> Result<Json<DepartmentFull>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let dept_id = Uuid::new_v4();
    let status = payload.status.unwrap_or(true);

    sqlx::query(r#"
        INSERT INTO departments (id, name, code, description, organization_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    "#)
    .bind(dept_id)
    .bind(&payload.name)
    .bind(&payload.code)
    .bind(&payload.description)
    .bind(payload.organization_id)
    .bind(status)
    .execute(&pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.is_unique_violation() {
                return (StatusCode::CONFLICT, "Department code already exists in this organization".to_string());
            }
        }
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create department: {}", e))
    })?;

    let dept = sqlx::query_as::<_, DepartmentFull>(r#"
        SELECT d.*, o.name AS organization_name,
            (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.deleted_at IS NULL) AS students_count,
            0::bigint AS admins_count
        FROM departments d JOIN organizations o ON d.organization_id = o.id
        WHERE d.id = $1
    "#)
    .bind(dept_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(dept))
}

pub async fn update_department(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(dept_id): Path<Uuid>,
    Json(payload): Json<UpdateDepartmentInput>,
) -> Result<Json<DepartmentFull>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    sqlx::query(r#"
        UPDATE departments SET
            name = COALESCE($2, name),
            code = COALESCE($3, code),
            description = COALESCE($4, description),
            status = COALESCE($5, status),
            updated_at = NOW()
        WHERE id = $1
    "#)
    .bind(dept_id)
    .bind(payload.name)
    .bind(payload.code)
    .bind(payload.description)
    .bind(payload.status)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update department: {}", e)))?;

    let dept = sqlx::query_as::<_, DepartmentFull>(r#"
        SELECT d.*, o.name AS organization_name,
            (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.deleted_at IS NULL) AS students_count,
            0::bigint AS admins_count
        FROM departments d JOIN organizations o ON d.organization_id = o.id
        WHERE d.id = $1
    "#)
    .bind(dept_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Department not found".to_string()))?;

    Ok(Json(dept))
}

pub async fn delete_department(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(dept_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    sqlx::query("DELETE FROM departments WHERE id = $1")
        .bind(dept_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to delete department: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "Department deleted successfully" })))
}

pub async fn toggle_department_status(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(dept_id): Path<Uuid>,
) -> Result<Json<DepartmentFull>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    sqlx::query("UPDATE departments SET status = NOT status, updated_at = NOW() WHERE id = $1")
        .bind(dept_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to toggle status: {}", e)))?;

    let dept = sqlx::query_as::<_, DepartmentFull>(r#"
        SELECT d.*, o.name AS organization_name,
            (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.deleted_at IS NULL) AS students_count,
            0::bigint AS admins_count
        FROM departments d JOIN organizations o ON d.organization_id = o.id
        WHERE d.id = $1
    "#)
    .bind(dept_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Department not found".to_string()))?;

    Ok(Json(dept))
}
