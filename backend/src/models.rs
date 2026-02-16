use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

// Enums matching Database Types
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

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)] // Added Clone
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


#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Activity {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub activity_type: ActivityType,
    pub start_date: chrono::NaiveDate, 
    pub end_date: chrono::NaiveDate,
    pub start_time_only: Option<chrono::NaiveTime>, 
    pub end_time_only: Option<chrono::NaiveTime>,
    pub hours: i16, // smallint
    pub max_participants: Option<i32>,
    pub registration_open: Option<bool>,
    pub status: ActivityStatus,
    pub organizer_id: Uuid,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Input for creating activity
#[derive(Debug, Deserialize)]
pub struct CreateActivityInput {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub activity_type: ActivityType,
    pub start_date: chrono::NaiveDate,
    pub end_date: chrono::NaiveDate,
    pub start_time_only: Option<chrono::NaiveTime>,
    pub end_time_only: Option<chrono::NaiveTime>,
    pub hours: i16,
    pub max_participants: Option<i32>,
    pub organizer_id: Uuid,
}

// Struct specifically for public dashboard listing
#[derive(Debug, Serialize, FromRow)]
pub struct ActivityPublic {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>, 
    pub location: Option<String>,
    pub activity_type: ActivityType,
    pub start_date: chrono::NaiveDate,
    pub end_date: chrono::NaiveDate,
    pub start_time_only: Option<chrono::NaiveTime>,
    pub end_time_only: Option<chrono::NaiveTime>,
    pub hours: i16,
    pub max_participants: Option<i32>,
    pub registration_open: Option<bool>,
    pub status: ActivityStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub organizer_name: String,
    pub creator_name: String,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user_id: Uuid,
    pub device_fingerprint: Option<String>,
    pub ip_address: Option<serde_json::Value>, 
    pub user_agent: Option<String>,
    pub login_method: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthInput {
    pub email: Option<String>,
    pub student_id: Option<String>,
    pub password: String,
    pub remember_me: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterInput {
    pub student_id: String,
    pub email: String,
    pub password: String,
    pub prefix: String,
    pub first_name: String,
    pub last_name: String,
    pub phone: Option<String>, // Optional
}


#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct RegisterResponse {
    pub user_id: Uuid,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct CreateActivityResponse {
    pub activity_id: Uuid,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    #[serde(rename = "user_id")]
    pub id: Uuid,
    pub student_id: String,
    pub email: String,
    pub prefix: String,
    pub first_name: String,
    pub last_name: String,
    pub admin_role: Option<AdminRole>, // Full role object
    pub session_id: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct DashboardResponse {
    pub recent: Vec<ActivityPublic>,
    pub upcoming: Vec<ActivityPublic>,
    // pub open_registration: Vec<ActivityPublic>,
    // pub popular: Vec<ActivityPublic>,
}


#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub session_id: String, 
    pub exp: usize,  // expiration time
    pub iat: usize,  // issued at
    
    // User info
    pub student_id: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub department_id: Option<Uuid>,

    // Admin info
    pub is_admin: bool,
    pub admin_level: Option<AdminLevel>,
    pub organization_id: Option<Uuid>,
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
