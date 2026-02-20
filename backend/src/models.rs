/// Shared database models used across multiple modules
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

// ─── Enums ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[sqlx(type_name = "user_status", rename_all = "snake_case")]
pub enum UserStatus {
    Active,
    Inactive,
    Suspended,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[sqlx(type_name = "admin_level", rename_all = "snake_case")]
pub enum AdminLevel {
    SuperAdmin,
    OrganizationAdmin,
    RegularAdmin,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone)]
#[sqlx(type_name = "activity_type", rename_all = "snake_case")]
pub enum ActivityType {
    Academic,
    Sports,
    Cultural,
    Social,
    Other,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone)]
#[sqlx(type_name = "activity_status", rename_all = "snake_case")]
pub enum ActivityStatus {
    Draft,
    Published,
    Ongoing,
    Completed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[sqlx(type_name = "organization_type", rename_all = "snake_case")]
pub enum OrganizationType {
    Faculty,
    Office,
}

// ─── Core Structs ──────────────────────────────────────────────────────────

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub organization_type: OrganizationType,
    pub status: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub student_id: String,
    pub email: String,
    pub password_hash: String,
    pub prefix: String,
    pub first_name: String,
    pub last_name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub qr_secret: String,
    pub status: UserStatus,
    pub department_id: Option<Uuid>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub login_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct AdminRole {
    pub id: Uuid,
    pub user_id: Uuid,
    pub admin_level: AdminLevel,
    pub organization_id: Option<Uuid>,
    pub permissions: Vec<String>,
    pub is_enabled: bool,
    pub last_session_id: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}
