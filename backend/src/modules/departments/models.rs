use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct DepartmentFull {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub organization_id: Uuid,
    pub status: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    // Joined
    pub organization_name: Option<String>,
    #[sqlx(default)]
    pub students_count: Option<i64>,
    #[sqlx(default)]
    pub admins_count: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDepartmentInput {
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub organization_id: Uuid,
    pub status: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDepartmentInput {
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub status: Option<bool>,
}
