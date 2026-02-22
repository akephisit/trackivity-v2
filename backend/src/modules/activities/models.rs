use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::models::{ActivityType, ActivityStatus};

#[derive(Debug, Serialize, FromRow)]
pub struct ActivityPublic {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub activity_type: String,
    pub start_date: chrono::NaiveDate,
    pub end_date: chrono::NaiveDate,
    pub start_time_only: Option<chrono::NaiveTime>,
    pub end_time_only: Option<chrono::NaiveTime>,
    pub hours: i16,
    pub max_participants: Option<i32>,
    pub registration_open: Option<bool>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub organizer_id: Uuid,
    pub organizer_name: String,
    pub creator_name: String,
    pub activity_level: Option<String>,
    pub eligible_organizations: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateActivityInput {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub activity_type: ActivityType,
    pub activity_level: Option<String>,
    pub start_date: chrono::NaiveDate,
    pub end_date: chrono::NaiveDate,
    pub start_time_only: Option<chrono::NaiveTime>,
    pub end_time_only: Option<chrono::NaiveTime>,
    pub hours: i16,
    pub max_participants: Option<i32>,
    pub organizer_id: Uuid,
    pub registration_open: Option<bool>,
    pub eligible_organizations: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateActivityInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub status: Option<ActivityStatus>,
    pub registration_open: Option<bool>,
    pub max_participants: Option<i32>,
    pub organizer_id: Option<Uuid>,
    pub activity_level: Option<String>,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub start_time_only: Option<chrono::NaiveTime>,
    pub end_time_only: Option<chrono::NaiveTime>,
    pub eligible_organizations: Option<serde_json::Value>,
    pub activity_type: Option<ActivityType>,
    pub hours: Option<i16>,
}

#[derive(Debug, Serialize)]
pub struct CreateActivityResponse {
    pub activity_id: Uuid,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct DashboardResponse {
    pub recent: Vec<ActivityPublic>,
    pub upcoming: Vec<ActivityPublic>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct ParticipationRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub activity_id: Uuid,
    pub status: String,
    pub registered_at: Option<DateTime<Utc>>,
    pub checked_in_at: Option<DateTime<Utc>>,
    pub checked_out_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}
