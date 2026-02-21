use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde_json::Value;

#[derive(Debug, Serialize, FromRow)]
pub struct AdminRoleView {
    pub id: Uuid,
    pub user_id: Uuid,
    pub admin_level: Option<String>, // String mapped from DB enum 'super_admin', etc.
    pub organization_id: Option<Uuid>,
    pub permissions: Option<Vec<String>>, // TEXT[] array of permissions
    pub is_enabled: Option<bool>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    
    // User fields joined
    pub user_email: String,
    pub user_prefix: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub student_id: Option<String>,
    pub department_id: Option<Uuid>,
    pub user_created_at: DateTime<Utc>,
    pub user_updated_at: DateTime<Utc>,

    // Org fields joined
    pub organization_name: Option<String>,
    pub organization_code: Option<String>,
    pub organization_status: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct AdminUserField {
    pub id: Uuid,
    pub student_id: Option<String>,
    pub email: String,
    pub prefix: String,
    pub first_name: String,
    pub last_name: String,
    pub department_id: Option<Uuid>,
    pub organization_id: Option<Uuid>,
    pub status: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AdminOrgField {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub status: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct AdminResponseItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub admin_level: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<Uuid>,
    pub permissions: serde_json::Value,
    pub is_enabled: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user: AdminUserField,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization: Option<AdminOrgField>,
    
    // Additional fields for organization admins dashboard
    pub full_name: Option<String>,
    pub created_at_formatted: Option<String>,
    pub permission_count: Option<usize>,
    pub days_since_last_login: Option<i64>,
    pub assigned_departments: Vec<Value>,
    pub department_count: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct AdminsListResponse {
    pub admins: Vec<AdminResponseItem>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAdminInput {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub prefix: Option<String>,
    pub password: Option<String>,
    pub admin_level: String,
    pub organization_id: Option<String>,
    pub permissions: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAdminInput {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub prefix: Option<String>,
    pub department_id: Option<String>,
    pub organization_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToggleStatusInput {
    pub is_active: bool,
}
