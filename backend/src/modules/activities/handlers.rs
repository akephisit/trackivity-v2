use axum::{Json, extract::{State, Path}, http::{StatusCode, HeaderMap}};
use sqlx::PgPool;
use crate::models::ActivityStatus;
use crate::modules::auth::get_claims_from_headers;
use super::models::{ActivityPublic, CreateActivityInput, CreateActivityResponse, DashboardResponse, UpdateActivityInput};
use uuid::Uuid;

const ACTIVITY_SELECT: &str = r#"
    SELECT
        a.id, a.title, a.description, a.location,
        a.activity_type::text AS activity_type,
        a.start_date, a.end_date, a.start_time_only, a.end_time_only,
        a.hours, a.max_participants, a.registration_open,
        a.status::text AS status,
        a.created_at, a.updated_at,
        a.organizer_id, o.name AS organizer_name,
        u.first_name AS creator_name,
        a.activity_level::text AS activity_level,
        a.eligible_organizations
    FROM activities a
    JOIN organizations o ON a.organizer_id = o.id
    JOIN users u ON a.created_by = u.id
"#;

pub async fn get_dashboard_activities(
    State(pool): State<PgPool>,
) -> Result<Json<DashboardResponse>, (StatusCode, String)> {
    let recent = sqlx::query_as::<_, ActivityPublic>(&format!(
        "{} WHERE a.status = 'published' AND a.created_at >= NOW() - INTERVAL '30 days' ORDER BY a.created_at DESC LIMIT 6",
        ACTIVITY_SELECT
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch recent activities: {}", e)))?;

    let upcoming = sqlx::query_as::<_, ActivityPublic>(&format!(
        "{} WHERE a.status = 'published' AND a.start_date >= CURRENT_DATE ORDER BY a.start_date ASC LIMIT 6",
        ACTIVITY_SELECT
    ))
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch upcoming activities: {}", e)))?;

    Ok(Json(DashboardResponse { recent, upcoming }))
}

pub async fn list_activities(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<Vec<ActivityPublic>>, (StatusCode, String)> {
    // Check if admin — admins see all, students see only published
    let is_admin = get_claims_from_headers(&headers)
        .map(|c| c.is_admin)
        .unwrap_or(false);

    let query = if is_admin {
        format!("{} ORDER BY a.created_at DESC", ACTIVITY_SELECT)
    } else {
        format!("{} WHERE a.status = 'published' ORDER BY a.created_at DESC", ACTIVITY_SELECT)
    };

    let activities = sqlx::query_as::<_, ActivityPublic>(&query)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch activities: {}", e)))?;

    Ok(Json(activities))
}

pub async fn get_activity(
    State(pool): State<PgPool>,
    Path(activity_id): Path<Uuid>,
) -> Result<Json<ActivityPublic>, (StatusCode, String)> {
    let activity = sqlx::query_as::<_, ActivityPublic>(&format!(
        "{} WHERE a.id = $1",
        ACTIVITY_SELECT
    ))
    .bind(activity_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch activity: {}", e)))?
    .ok_or((StatusCode::NOT_FOUND, "Activity not found".to_string()))?;

    Ok(Json(activity))
}

pub async fn create_activity(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(payload): Json<CreateActivityInput>,
) -> Result<Json<CreateActivityResponse>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    let activity_id = Uuid::new_v4();
    let now = chrono::Utc::now().format("%Y").to_string();
    let academic_year: i32 = now.parse().unwrap_or(2024);

    sqlx::query(r#"
        INSERT INTO activities (
            id, title, description, location, activity_type,
            activity_level, eligible_organizations,
            start_date, end_date, start_time_only, end_time_only,
            hours, max_participants, registration_open, status,
            organizer_id, created_by, created_at, updated_at, academic_year
        )
        VALUES ($1,$2,$3,$4,$5,$6::activity_level,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW(),$18)
    "#)
    .bind(activity_id)
    .bind(payload.title)
    .bind(payload.description.unwrap_or_default())
    .bind(payload.location.unwrap_or_default())
    .bind(payload.activity_type)
    .bind(payload.activity_level.as_deref().unwrap_or("faculty"))
    .bind(payload.eligible_organizations.unwrap_or(serde_json::json!([])))
    .bind(payload.start_date)
    .bind(payload.end_date)
    .bind(payload.start_time_only)
    .bind(payload.end_time_only)
    .bind(payload.hours)
    .bind(payload.max_participants)
    .bind(payload.registration_open.unwrap_or(false))
    .bind(ActivityStatus::Draft)
    .bind(payload.organizer_id)
    .bind(user_id)
    .bind(academic_year)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create activity: {}", e)))?;

    Ok(Json(CreateActivityResponse {
        activity_id,
        message: "Activity created successfully".to_string(),
    }))
}

pub async fn update_activity(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(activity_id): Path<Uuid>,
    Json(payload): Json<UpdateActivityInput>,
) -> Result<Json<ActivityPublic>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    // Build dynamic update
    let mut set_parts: Vec<String> = vec!["updated_at = NOW()".to_string()];
    let mut i = 1usize;

    if payload.title.is_some()                { i += 1; set_parts.push(format!("title = ${}", i)); }
    if payload.description.is_some()          { i += 1; set_parts.push(format!("description = ${}", i)); }
    if payload.location.is_some()             { i += 1; set_parts.push(format!("location = ${}", i)); }
    if payload.status.is_some()               { i += 1; set_parts.push(format!("status = ${}", i)); }
    if payload.registration_open.is_some()    { i += 1; set_parts.push(format!("registration_open = ${}", i)); }
    if payload.max_participants.is_some()     { i += 1; set_parts.push(format!("max_participants = ${}", i)); }
    if payload.organizer_id.is_some()         { i += 1; set_parts.push(format!("organizer_id = ${}", i)); }
    if payload.activity_level.is_some()       { i += 1; set_parts.push(format!("activity_level = ${}::activity_level", i)); }
    if payload.start_date.is_some()           { i += 1; set_parts.push(format!("start_date = ${}", i)); }
    if payload.end_date.is_some()             { i += 1; set_parts.push(format!("end_date = ${}", i)); }
    if payload.start_time_only.is_some()      { i += 1; set_parts.push(format!("start_time_only = ${}", i)); }
    if payload.end_time_only.is_some()        { i += 1; set_parts.push(format!("end_time_only = ${}", i)); }
    if payload.eligible_organizations.is_some() { i += 1; set_parts.push(format!("eligible_organizations = ${}", i)); }
    if payload.activity_type.is_some()        { i += 1; set_parts.push(format!("activity_type = ${}", i)); }
    if payload.hours.is_some()                { i += 1; set_parts.push(format!("hours = ${}", i)); }
    let _ = i;

    let set_clause = set_parts.join(", ");
    let update_query = format!("UPDATE activities SET {} WHERE id = $1", set_clause);

    let mut q = sqlx::query(&update_query).bind(activity_id);
    if let Some(v) = payload.title               { q = q.bind(v); }
    if let Some(v) = payload.description         { q = q.bind(v); }
    if let Some(v) = payload.location            { q = q.bind(v); }
    if let Some(v) = payload.status              { q = q.bind(v); }
    if let Some(v) = payload.registration_open   { q = q.bind(v); }
    if let Some(v) = payload.max_participants    { q = q.bind(v); }
    if let Some(v) = payload.organizer_id        { q = q.bind(v); }
    if let Some(v) = payload.activity_level      { q = q.bind(v); }
    if let Some(v) = payload.start_date          { q = q.bind(v); }
    if let Some(v) = payload.end_date            { q = q.bind(v); }
    if let Some(v) = payload.start_time_only     { q = q.bind(v); }
    if let Some(v) = payload.end_time_only       { q = q.bind(v); }
    if let Some(v) = payload.eligible_organizations { q = q.bind(v); }
    if let Some(v) = payload.activity_type       { q = q.bind(v); }
    if let Some(v) = payload.hours               { q = q.bind(v); }

    q.execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update activity: {}", e)))?;

    // Return updated activity
    let activity = sqlx::query_as::<_, ActivityPublic>(&format!("{} WHERE a.id = $1", ACTIVITY_SELECT))
        .bind(activity_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Activity not found".to_string()))?;

    Ok(Json(activity))
}

pub async fn delete_activity(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(activity_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    sqlx::query("DELETE FROM activities WHERE id = $1")
        .bind(activity_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to delete activity: {}", e)))?;

    Ok(Json(serde_json::json!({ "message": "Activity deleted successfully" })))
}

pub async fn join_activity(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(activity_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    let participation_id = Uuid::new_v4();
    let result = sqlx::query(r#"
        INSERT INTO participations (id, user_id, activity_id, status, registered_at)
        VALUES ($1, $2, $3, 'registered'::participation_status, NOW())
    "#)
    .bind(participation_id)
    .bind(user_id)
    .bind(activity_id)
    .execute(&pool)
    .await;

    match result {
        Ok(_) => Ok(Json(serde_json::json!({
            "message": "Successfully registered for activity",
            "participation_id": participation_id
        }))),
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

pub async fn get_my_participations(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID".to_string()))?;

    #[derive(sqlx::FromRow)]
    struct ParticipationRow {
        id: uuid::Uuid,
        status: String,
        registered_at: Option<chrono::DateTime<chrono::Utc>>,
        checked_in_at: Option<chrono::DateTime<chrono::Utc>>,
        checked_out_at: Option<chrono::DateTime<chrono::Utc>>,
        notes: Option<String>,
        activity_id: uuid::Uuid,
        activity_title: String,
        activity_description: Option<String>,
        activity_location: Option<String>,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
        hours: i16,
        organizer_name: String,
    }

    let rows = sqlx::query_as::<_, ParticipationRow>(r#"
        SELECT
            p.id, p.status, p.registered_at, p.checked_in_at, p.checked_out_at, p.notes,
            a.id AS activity_id,
            a.title AS activity_title,
            a.description AS activity_description,
            a.location AS activity_location,
            a.start_date,
            a.end_date,
            a.hours,
            o.name AS organizer_name
        FROM participations p
        JOIN activities a ON p.activity_id = a.id
        JOIN organizations o ON a.organizer_id = o.id
        WHERE p.user_id = $1
        ORDER BY p.registered_at DESC
    "#)
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch participations: {}", e)))?;

    let result: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "id": r.id,
            "status": r.status,
            "registered_at": r.registered_at,
            "checked_in_at": r.checked_in_at,
            "checked_out_at": r.checked_out_at,
            "notes": r.notes,
            "activity": {
                "id": r.activity_id,
                "title": r.activity_title,
                "description": r.activity_description,
                "location": r.activity_location,
                "start_date": r.start_date,
                "end_date": r.end_date,
                "hours": r.hours,
                "organizer_name": r.organizer_name
            }
        })
    }).collect();

    Ok(Json(result))
}
