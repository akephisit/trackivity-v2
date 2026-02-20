use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::models::UserStatus;

#[derive(Debug, FromRow, Serialize)]
pub struct UserListItem {
    pub id: Uuid,
    pub student_id: String,
    pub email: String,
    pub prefix: String,
    pub first_name: String,
    pub last_name: String,
    pub status: UserStatus,
    pub department_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
    // Joined fields
    pub department_name: Option<String>,
    pub organization_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserListResponse {
    pub users: Vec<UserListItem>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileInput {
    pub prefix: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordInput {
    pub current_password: String,
    pub new_password: String,
}
