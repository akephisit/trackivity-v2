use axum::{Json, extract::State, http::StatusCode};
use sqlx::PgPool;
use crate::models::{Organization, OrganizationsResponse, GroupedOrganizations, OrganizationType};

pub async fn get_all_organizations(
    State(pool): State<PgPool>,
) -> Result<Json<OrganizationsResponse>, (StatusCode, String)> {
    
    // Fetch all active organizations
    // Removed explicit type annotation in SQL alias, let sqlx map by name
    let organizations = sqlx::query_as::<_, Organization>(
        r#"
        SELECT 
            id, name, code, description, 
            organization_type,
            status, created_at, updated_at
        FROM organizations
        WHERE status = TRUE
        ORDER BY name ASC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch organizations: {}", e)))?;

    // Group them
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
        grouped: GroupedOrganizations {
            faculty: faculty_group,
            office: office_group,
        }
    }))
}
