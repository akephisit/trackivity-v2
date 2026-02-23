use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::models::{Organization, OrganizationType};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Department {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub organization_id: Uuid,
    pub status: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct OrganizationsResponse {
    pub all: Vec<Organization>,
    pub grouped: GroupedOrganizations,
}

#[derive(Debug, Serialize)]
pub struct GroupedOrganizations {
    pub faculty: Vec<Organization>,
    pub office: Vec<Organization>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrganizationInput {
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub organization_type: OrganizationType,
    pub status: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrganizationInput {
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub organization_type: Option<OrganizationType>,
    pub status: Option<bool>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct OrganizationWithStats {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub organization_type: OrganizationType,
    pub status: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[sqlx(default)]
    pub departments_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct OrgActivityRequirements {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub required_faculty_hours: i32,
    pub required_university_hours: i32,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub created_by: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrgActivityRequirementsInput {
    pub required_faculty_hours: i32,
    pub required_university_hours: i32,
}
