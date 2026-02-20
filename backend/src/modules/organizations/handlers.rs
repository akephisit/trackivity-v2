use axum::{Json, extract::{State, Path}, http::{StatusCode, HeaderMap}};
use sqlx::PgPool;
use crate::models::{Organization, OrganizationType};
use crate::modules::auth::get_claims_from_headers;
use super::models::{Department, OrganizationsResponse, GroupedOrganizations, CreateOrganizationInput, UpdateOrganizationInput};
use uuid::Uuid;

pub async fn get_all_organizations(
    State(pool): State<PgPool>,
) -> Result<Json<OrganizationsResponse>, (StatusCode, String)> {
    let organizations = sqlx::query_as::<_, Organization>(r#"
        SELECT id, name, code, description, organization_type, status, created_at, updated_at
        FROM organizations
        WHERE status = TRUE
        ORDER BY name ASC
    "#)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch organizations: {}", e)))?;

    let faculty_group: Vec<Organization> = organizations.iter()
        .filter(|o| o.organization_type == OrganizationType::Faculty)
        .cloned()
        .collect();
    let office_group: Vec<Organization> = organizations.iter()
        .filter(|o| o.organization_type == OrganizationType::Office)
        .cloned()
        .collect();

    Ok(Json(OrganizationsResponse {
        all: organizations,
        grouped: GroupedOrganizations { faculty: faculty_group, office: office_group },
    }))
}

pub async fn list_all_organizations_admin(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<Vec<Organization>>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let organizations = sqlx::query_as::<_, Organization>(r#"
        SELECT id, name, code, description, organization_type, status, created_at, updated_at
        FROM organizations
        ORDER BY name ASC
    "#)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch organizations: {}", e)))?;

    Ok(Json(organizations))
}

pub async fn create_organization(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<CreateOrganizationInput>,
) -> Result<Json<Organization>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let org_id = Uuid::new_v4();
    let status = payload.status.unwrap_or(true);

    sqlx::query(r#"
        INSERT INTO organizations (id, name, code, description, organization_type, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    "#)
    .bind(org_id)
    .bind(&payload.name)
    .bind(&payload.code)
    .bind(&payload.description)
    .bind(&payload.organization_type)
    .bind(status)
    .execute(&pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.is_unique_violation() {
                return (StatusCode::CONFLICT, "Organization code already exists".to_string());
            }
        }
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create organization: {}", e))
    })?;

    let org = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(org))
}

pub async fn update_organization(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(org_id): Path<Uuid>,
    Json(payload): Json<UpdateOrganizationInput>,
) -> Result<Json<Organization>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    sqlx::query(r#"
        UPDATE organizations SET
            name = COALESCE($2, name),
            code = COALESCE($3, code),
            description = COALESCE($4, description),
            organization_type = COALESCE($5, organization_type),
            status = COALESCE($6, status),
            updated_at = NOW()
        WHERE id = $1
    "#)
    .bind(org_id)
    .bind(payload.name)
    .bind(payload.code)
    .bind(payload.description)
    .bind(payload.organization_type)
    .bind(payload.status)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update organization: {}", e)))?;

    let org = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Organization not found".to_string()))?;

    Ok(Json(org))
}

pub async fn delete_organization(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(org_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    sqlx::query("DELETE FROM organizations WHERE id = $1")
        .bind(org_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to delete organization: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "Organization deleted successfully" })))
}

pub async fn toggle_organization_status(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(org_id): Path<Uuid>,
) -> Result<Json<Organization>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    sqlx::query("UPDATE organizations SET status = NOT status, updated_at = NOW() WHERE id = $1")
        .bind(org_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to toggle status: {}", e)))?;

    let org = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Organization not found".to_string()))?;

    Ok(Json(org))
}

pub async fn get_departments(
    State(pool): State<PgPool>,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<Vec<Department>>, (StatusCode, String)> {
    let departments = sqlx::query_as::<_, Department>(r#"
        SELECT id, name, code, description, organization_id, status, created_at, updated_at
        FROM departments
        WHERE organization_id = $1 AND status = TRUE
        ORDER BY name ASC
    "#)
    .bind(organization_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch departments: {}", e)))?;

    Ok(Json(departments))
}
