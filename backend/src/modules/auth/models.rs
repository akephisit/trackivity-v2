use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::models::{AdminRole, AdminLevel};

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
    pub phone: Option<String>,
    pub organization_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
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
pub struct UserResponse {
    #[serde(rename = "user_id")]
    pub id: Uuid,
    pub student_id: String,
    pub email: String,
    pub prefix: String,
    pub first_name: String,
    pub last_name: String,
    pub admin_role: Option<AdminRole>,
    pub session_id: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub session_id: String,
    pub exp: usize,
    pub iat: usize,
    pub student_id: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub department_id: Option<Uuid>,
    pub is_admin: bool,
    pub admin_level: Option<AdminLevel>,
    pub organization_id: Option<Uuid>,
}
