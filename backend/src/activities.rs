use axum::{Json, extract::{State, Path}, http::{StatusCode, HeaderMap}};
use sqlx::PgPool;
use crate::models::{DashboardResponse, ActivityPublic, ActivityType, ActivityStatus, CreateActivityInput, CreateActivityResponse};
use crate::auth::get_claims_from_headers;
use chrono::Utc;
use uuid::Uuid;

pub async fn get_dashboard_activities(
    State(pool): State<PgPool>,
) -> Result<Json<DashboardResponse>, (StatusCode, String)> {
    
    // 1. Recent Activities (Created last 30 days, Published)
    // Using query_as function (not macro) to avoid compile-time type check issues with custom enums
    let recent = sqlx::query_as::<_, ActivityPublic>(
        r#"
        SELECT 
            a.id, a.title, a.description, a.location, 
            a.activity_type as "activity_type: ActivityType", 
            a.start_date, a.end_date, a.start_time_only, a.end_time_only,
            a.hours, a.max_participants, a.registration_open,
            a.status as "status: ActivityStatus", 
            a.created_at, a.updated_at,
            o.name as organizer_name,
            u.first_name as creator_name
        FROM activities a
        JOIN organizations o ON a.organizer_id = o.id
        JOIN users u ON a.created_by = u.id
        WHERE a.status = 'published'
        AND a.created_at >= NOW() - INTERVAL '30 days'
        ORDER BY a.created_at DESC
        LIMIT 6
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch recent activities: {}", e)))?;

    // 2. Upcoming Activities (Starting >= Today, Published)
    let upcoming = sqlx::query_as::<_, ActivityPublic>(
        r#"
        SELECT 
            a.id, a.title, a.description, a.location, 
            a.activity_type as "activity_type: ActivityType", 
            a.start_date, a.end_date, a.start_time_only, a.end_time_only,
            a.hours, a.max_participants, a.registration_open,
            a.status as "status: ActivityStatus",
            a.created_at, a.updated_at,
            o.name as organizer_name,
            u.first_name as creator_name
        FROM activities a
        JOIN organizations o ON a.organizer_id = o.id
        JOIN users u ON a.created_by = u.id
        WHERE a.status = 'published'
        AND a.start_date >= CURRENT_DATE
        ORDER BY a.start_date ASC
        LIMIT 6
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch upcoming activities: {}", e)))?;

    Ok(Json(DashboardResponse {
        recent,
        upcoming,
    }))
}

pub async fn create_activity(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<CreateActivityInput>,
) -> Result<Json<CreateActivityResponse>, (StatusCode, String)> {
    // 1. Verify Auth
    let claims = get_claims_from_headers(&headers).map_err(|e| e)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    // 2. Insert Activity
    let activity_id = Uuid::new_v4();
    
    // Explicitly use query (not macro) to avoid type confusion between chrono::NaiveDate and SQL Date
    // And cast enums explicitly
    sqlx::query(
        r#"
        INSERT INTO activities (
            id, title, description, location, activity_type, 
            start_date, end_date, start_time_only, end_time_only,
            hours, max_participants, registration_open, status,
            organizer_id, created_by, created_at, updated_at, academic_year
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(), 2024)
        "#
    )
    .bind(activity_id)
    .bind(payload.title)
    .bind(payload.description)
    .bind(payload.location)
    .bind(payload.activity_type)
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(payload.start_time_only)
    .bind(payload.end_time_only)
    .bind(payload.hours)
    .bind(payload.max_participants)
    .bind(true) // registration_open
    .bind(ActivityStatus::Published) // status
    .bind(payload.organizer_id)
    .bind(user_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create activity: {}", e)))?;

    Ok(Json(CreateActivityResponse {
        activity_id,
        message: "Activity created successfully".to_string(),
    }))
}

#[derive(serde::Serialize)]
pub struct JoinResponse {
    pub message: String,
    pub participation_id: Uuid,
}

pub async fn join_activity(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(activity_id): Path<Uuid>,
) -> Result<Json<JoinResponse>, (StatusCode, String)> {
    // 1. Verify Auth
    let claims = get_claims_from_headers(&headers).map_err(|e| e)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    // 2. Insert Participation
    let participation_id = Uuid::new_v4();

    // Again, use explicit query to avoid type issues with enums
    let result = sqlx::query(
        r#"
        INSERT INTO participations (id, user_id, activity_id, status, registered_at)
        VALUES ($1, $2, $3, 'registered'::participation_status, NOW())
        "#
    )
    .bind(participation_id)
    .bind(user_id)
    .bind(activity_id)
    .execute(&pool)
    .await;

    match result {
        Ok(_) => Ok(Json(JoinResponse {
            message: "Successfully registered for activity".to_string(),
            participation_id,
        })),
        Err(sqlx::Error::Database(db_err)) => {
            if db_err.is_unique_violation() {
                 Err((StatusCode::CONFLICT, "Already registered for this activity".to_string()))
            } else {
                 Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", db_err)))
            }
        },
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to register: {}", e))),
    }
}
