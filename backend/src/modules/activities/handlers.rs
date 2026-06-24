use axum::{Json, extract::{Query, State, Path}, http::{StatusCode, HeaderMap}};
use serde::Deserialize;
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use crate::models::{ActivityStatus, AdminLevel};
use crate::modules::auth::get_claims_from_headers;
use crate::modules::notifications::service::{NotificationService, NotificationType};
use super::models::{
    ActivityPublic, CreateActivityInput, CreateActivityResponse, DashboardResponse,
    ManualCompleteParticipationResult, ManualCompleteParticipationsInput,
    ManualCompleteParticipationsResponse, ManualCompleteParticipationsSummary, UpdateActivityInput,
};
use uuid::Uuid;

const MANUAL_PARTICIPATION_NOTE: &str = "บันทึกย้อนหลังโดยแอดมิน";

#[derive(Debug, Deserialize)]
pub struct ListActivitiesQuery {
    /// Filter by status (e.g. "ongoing"). When omitted, no status filter.
    pub status: Option<String>,
}

/// Returns Ok(()) if the caller is allowed to mutate `activity_id`.
/// Super admin can touch anything; org / regular admin can only touch
/// activities organised by their own organization. The check is one
/// SELECT, so callers should run it before any UPDATE / DELETE.
async fn assert_admin_can_manage_activity(
    pool: &PgPool,
    claims: &crate::modules::auth::models::Claims,
    activity_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }
    if matches!(claims.admin_level, Some(AdminLevel::SuperAdmin)) {
        return Ok(());
    }
    let admin_org = claims.organization_id.ok_or((
        StatusCode::FORBIDDEN,
        "Admin is not assigned to any organization".to_string(),
    ))?;
    let organizer_id: Option<Uuid> =
        sqlx::query_scalar("SELECT organizer_id FROM activities WHERE id = $1")
            .bind(activity_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .ok_or((StatusCode::NOT_FOUND, "Activity not found".to_string()))?;
    if organizer_id != Some(admin_org) {
        return Err((
            StatusCode::FORBIDDEN,
            "Activity belongs to another organization".to_string(),
        ));
    }
    Ok(())
}

// Aggregates participations once via LEFT JOIN instead of running two
// correlated subqueries per row, which used to scale O(n) per result row
// against the participations table.
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
        a.eligible_organizations,
        COALESCE(pc.participant_count, 0) AS participant_count,
        COALESCE(pc.checked_in_count, 0) AS checked_in_count
    FROM activities a
    JOIN organizations o ON a.organizer_id = o.id
    JOIN users u ON a.created_by = u.id
    LEFT JOIN (
        SELECT activity_id,
               COUNT(*) AS participant_count,
               COUNT(*) FILTER (
                   WHERE status IN ('checked_in'::participation_status, 'checked_out'::participation_status)
               ) AS checked_in_count
        FROM participations
        GROUP BY activity_id
    ) pc ON pc.activity_id = a.id
"#;

pub async fn get_dashboard_activities(
    State(pool): State<PgPool>,
    headers: HeaderMap,
) -> Result<Json<DashboardResponse>, (StatusCode, String)> {
    // Try to determine user's organization from their department
    let user_org_id: Option<Uuid> = if let Ok(claims) = get_claims_from_headers(&headers) {
        if let Some(dept_id) = claims.department_id {
            // Look up which organization this department belongs to
            sqlx::query_scalar::<_, Uuid>(
                "SELECT organization_id FROM departments WHERE id = $1"
            )
            .bind(dept_id)
            .fetch_optional(&pool)
            .await
            .unwrap_or(None)
        } else {
            None
        }
    } else {
        None
    };

    // Recent: published or ongoing activities, filtered by eligibility if user org is known
    let recent = if let Some(org_id) = user_org_id {
        sqlx::query_as::<_, ActivityPublic>(&format!(
            "{} WHERE a.status IN ('published', 'ongoing') AND (a.eligible_organizations = '[]'::jsonb OR a.eligible_organizations @> $1::jsonb) ORDER BY a.start_date ASC LIMIT 10",
            ACTIVITY_SELECT
        ))
        .bind(serde_json::json!([org_id.to_string()]))
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch recent activities: {}", e)))?
    } else {
        sqlx::query_as::<_, ActivityPublic>(&format!(
            "{} WHERE a.status IN ('published', 'ongoing') ORDER BY a.start_date ASC LIMIT 10",
            ACTIVITY_SELECT
        ))
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch recent activities: {}", e)))?
    };

    // Upcoming: future start date, same eligibility filter
    let upcoming = if let Some(org_id) = user_org_id {
        sqlx::query_as::<_, ActivityPublic>(&format!(
            "{} WHERE a.status = 'published' AND a.start_date >= CURRENT_DATE AND (a.eligible_organizations = '[]'::jsonb OR a.eligible_organizations @> $1::jsonb) ORDER BY a.start_date ASC LIMIT 6",
            ACTIVITY_SELECT
        ))
        .bind(serde_json::json!([org_id.to_string()]))
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch upcoming activities: {}", e)))?
    } else {
        sqlx::query_as::<_, ActivityPublic>(&format!(
            "{} WHERE a.status = 'published' AND a.start_date >= CURRENT_DATE ORDER BY a.start_date ASC LIMIT 6",
            ACTIVITY_SELECT
        ))
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch upcoming activities: {}", e)))?
    };

    Ok(Json(DashboardResponse { recent, upcoming }))
}


pub async fn list_activities(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Query(params): Query<ListActivitiesQuery>,
) -> Result<Json<Vec<ActivityPublic>>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers);
    let is_admin = claims.as_ref().map(|c| c.is_admin).unwrap_or(false);

    if is_admin {
        // Super admin sees everything; organization/regular admin only see
        // activities organized by their own organization. The frontend QR
        // scanner used to receive every activity (including drafts and other
        // orgs') and filter client-side; this scopes server-side instead.
        let admin_org: Option<Uuid> = claims.as_ref().ok().and_then(|c| match c.admin_level {
            Some(AdminLevel::SuperAdmin) => None,
            _ => c.organization_id,
        });

        let activities = sqlx::query_as::<_, ActivityPublic>(&format!(
            r#"
            {}
            WHERE ($1::uuid IS NULL OR a.organizer_id = $1)
              AND ($2::text IS NULL OR a.status::text = $2)
            ORDER BY a.created_at DESC
            "#,
            ACTIVITY_SELECT
        ))
        .bind(admin_org)
        .bind(params.status.as_deref())
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch activities: {}", e)))?;
        return Ok(Json(activities));
    }

    // For students: determine their organization via department
    let user_org_id: Option<Uuid> = if let Ok(ref c) = claims {
        if let Some(dept_id) = c.department_id {
            sqlx::query_scalar::<_, Uuid>(
                "SELECT organization_id FROM departments WHERE id = $1"
            )
            .bind(dept_id)
            .fetch_optional(&pool)
            .await
            .unwrap_or(None)
        } else {
            None
        }
    } else {
        None
    };

    let activities = if let Some(org_id) = user_org_id {
        // Show published, ongoing + completed, filtered by eligible_organizations
        sqlx::query_as::<_, ActivityPublic>(&format!(
            "{} WHERE a.status IN ('published', 'ongoing', 'completed') AND (a.eligible_organizations = '[]'::jsonb OR a.eligible_organizations @> $1::jsonb) ORDER BY a.start_date ASC",
            ACTIVITY_SELECT
        ))
        .bind(serde_json::json!([org_id.to_string()]))
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch activities: {}", e)))?
    } else {
        // No org found — show all published, ongoing + completed
        sqlx::query_as::<_, ActivityPublic>(&format!(
            "{} WHERE a.status IN ('published', 'ongoing', 'completed') ORDER BY a.start_date ASC",
            ACTIVITY_SELECT
        ))
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch activities: {}", e)))?
    };

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

    // Org / regular admin can only create activities organised by their own
    // organization. Super admin can pick any organizer_id.
    if !matches!(claims.admin_level, Some(AdminLevel::SuperAdmin)) {
        let admin_org = claims.organization_id.ok_or((
            StatusCode::FORBIDDEN,
            "Admin is not assigned to any organization".to_string(),
        ))?;
        if payload.organizer_id != admin_org {
            return Err((
                StatusCode::FORBIDDEN,
                "Cannot create an activity for another organization".to_string(),
            ));
        }
    }

    let activity_id = Uuid::new_v4();

    sqlx::query(r#"
        INSERT INTO activities (
            id, title, description, location, activity_type,
            activity_level, eligible_organizations,
            start_date, end_date, start_time_only, end_time_only,
            hours, max_participants, registration_open, status,
            organizer_id, created_by, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6::activity_level,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
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
    assert_admin_can_manage_activity(&pool, &claims, activity_id).await?;

    // Org / regular admin can't transfer the activity to another organization.
    if !matches!(claims.admin_level, Some(AdminLevel::SuperAdmin)) {
        if let Some(new_org) = payload.organizer_id {
            if Some(new_org) != claims.organization_id {
                return Err((
                    StatusCode::FORBIDDEN,
                    "Cannot reassign activity to another organization".to_string(),
                ));
            }
        }
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

    let just_published = matches!(payload.status, Some(crate::models::ActivityStatus::Published));
    let just_opened = payload.registration_open == Some(true);

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

    // 🔔 Notify if activity is newly published or registration just opened
    if just_published || just_opened {
        let pool_for_notify = pool.clone();
        let activity_title = activity.title.clone();
        let activity_id_str = activity_id.to_string();
        let eligible = activity.eligible_organizations.clone();

        tokio::spawn(async move {
            let user_ids = sqlx::query_scalar::<_, Uuid>(
                r#"
                SELECT u.id FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE $1::jsonb = '[]'::jsonb
                   OR ($1::jsonb ? d.organization_id::text)
                "#
            )
            .bind(&eligible)
            .fetch_all(&pool_for_notify)
            .await
            .unwrap_or_default();

            if let Err(e) = crate::modules::notifications::service::NotificationService::send_bulk(
                &pool_for_notify,
                &user_ids,
                &format!("🎉 มีกิจกรรมใหม่: {}", activity_title),
                &format!("กิจกรรม '{}' เปิดรับสมัครแล้ว! เข้าร่วมได้เลย", activity_title),
                crate::modules::notifications::service::NotificationType::Info,
                Some(&format!("/student/activities/{}", activity_id_str)),
            ).await {
                tracing::error!("Failed to broadcast activity notification: {}", e);
            }
        });
    }

    Ok(Json(activity))
}

pub async fn delete_activity(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(activity_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    assert_admin_can_manage_activity(&pool, &claims, activity_id).await?;

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

    // Lock the activity row so concurrent joins serialize on capacity check.
    let mut tx = pool.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB tx error: {}", e)))?;

    #[derive(sqlx::FromRow)]
    struct ActivityCheckRow {
        status: String,
        registration_open: bool,
        max_participants: Option<i32>,
        end_date: chrono::NaiveDate,
    }

    let activity = sqlx::query_as::<_, ActivityCheckRow>(r#"
        SELECT status::text AS status, registration_open, max_participants, end_date
        FROM activities
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
    "#)
    .bind(activity_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?
    .ok_or((StatusCode::NOT_FOUND, "Activity not found".to_string()))?;

    if activity.status != "published" {
        return Err((StatusCode::CONFLICT, "ไม่สามารถลงทะเบียนได้ (กิจกรรมยังไม่เผยแพร่หรือถูกยกเลิก)".to_string()));
    }
    if !activity.registration_open {
        return Err((StatusCode::CONFLICT, "การลงทะเบียนปิดแล้ว".to_string()));
    }
    if activity.end_date < chrono::Utc::now().date_naive() {
        return Err((StatusCode::CONFLICT, "กิจกรรมสิ้นสุดแล้ว ไม่สามารถลงทะเบียนได้".to_string()));
    }
    if let Some(max) = activity.max_participants {
        let current: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM participations WHERE activity_id = $1 AND status::text != 'no_show'"
        )
        .bind(activity_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?;
        if current >= max as i64 {
            return Err((StatusCode::CONFLICT, "กิจกรรมเต็มแล้ว".to_string()));
        }
    }

    let participation_id = Uuid::new_v4();
    let result = sqlx::query(r#"
        INSERT INTO participations (id, user_id, activity_id, status, registered_at)
        VALUES ($1, $2, $3, 'registered'::participation_status, NOW())
    "#)
    .bind(participation_id)
    .bind(user_id)
    .bind(activity_id)
    .execute(&mut *tx)
    .await;

    match result {
        Ok(_) => {}
        Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => {
            return Err((StatusCode::CONFLICT, "ลงทะเบียนกิจกรรมนี้แล้ว".to_string()));
        }
        Err(e) => {
            return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to register: {}", e)));
        }
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB commit error: {}", e)))?;

    Ok(Json(serde_json::json!({
        "message": "Successfully registered for activity",
        "participation_id": participation_id
    })))
}

fn normalize_manual_student_ids(raw: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for value in raw {
        for part in value.split(|c: char| c.is_whitespace() || c == ',' || c == ';') {
            let student_id = part.trim();
            if student_id.is_empty() {
                continue;
            }
            if seen.insert(student_id.to_string()) {
                normalized.push(student_id.to_string());
            }
        }
    }

    normalized
}

fn manual_result(
    input: impl Into<String>,
    user: Option<&ManualUserRow>,
    status: &str,
    message: impl Into<String>,
) -> ManualCompleteParticipationResult {
    ManualCompleteParticipationResult {
        input: input.into(),
        user_id: user.map(|u| u.id),
        student_id: user.map(|u| u.student_id.clone()),
        user_name: user.map(|u| format!("{} {}", u.first_name, u.last_name)),
        status: status.to_string(),
        message: message.into(),
    }
}

fn summarize_manual_results(
    results: &[ManualCompleteParticipationResult],
) -> ManualCompleteParticipationsSummary {
    let mut summary = ManualCompleteParticipationsSummary {
        total: results.len(),
        ..Default::default()
    };

    for result in results {
        match result.status.as_str() {
            "completed" => summary.completed += 1,
            "updated" => summary.updated += 1,
            "already_completed" => summary.already_completed += 1,
            "not_found" => summary.not_found += 1,
            "not_allowed" => summary.not_allowed += 1,
            "inactive" => summary.inactive += 1,
            "duplicate_input" => summary.duplicate_input += 1,
            _ => summary.failed += 1,
        }
    }

    summary
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct ManualUserRow {
    id: Uuid,
    student_id: String,
    first_name: String,
    last_name: String,
    status: String,
    organization_id: Option<Uuid>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct ManualParticipationRow {
    id: Uuid,
    user_id: Uuid,
    status: String,
}

pub async fn manual_complete_participations(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Path(activity_id): Path<Uuid>,
    Json(payload): Json<ManualCompleteParticipationsInput>,
) -> Result<Json<ManualCompleteParticipationsResponse>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }
    assert_admin_can_manage_activity(&pool, &claims, activity_id).await?;

    let normalized_student_ids = normalize_manual_student_ids(&payload.student_ids);
    if payload.user_ids.is_empty() && normalized_student_ids.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "กรุณาเลือกนักศึกษาหรือกรอกรหัสนักศึกษาอย่างน้อย 1 คน".to_string(),
        ));
    }

    let scope_org_id: Option<Uuid> = match claims.admin_level {
        Some(AdminLevel::SuperAdmin) => None,
        _ => claims.organization_id,
    };
    let note = payload
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or(MANUAL_PARTICIPATION_NOTE)
        .to_string();

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB tx error: {}", e)))?;

    #[derive(sqlx::FromRow)]
    struct ManualActivityRow {
        title: String,
        status: String,
        checked_in_at: chrono::DateTime<chrono::Utc>,
        checked_out_at: chrono::DateTime<chrono::Utc>,
    }

    let activity = sqlx::query_as::<_, ManualActivityRow>(
        r#"
        SELECT
            title,
            status::text AS status,
            ((start_date + start_time_only) AT TIME ZONE 'Asia/Bangkok') AS checked_in_at,
            ((end_date + end_time_only) AT TIME ZONE 'Asia/Bangkok') AS checked_out_at
        FROM activities
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
        "#,
    )
    .bind(activity_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?
    .ok_or((StatusCode::NOT_FOUND, "Activity not found".to_string()))?;

    if !matches!(activity.status.as_str(), "published" | "ongoing" | "completed") {
        return Err((
            StatusCode::CONFLICT,
            "เพิ่มย้อนหลังได้เฉพาะกิจกรรมที่เผยแพร่ กำลังดำเนินการ หรือเสร็จสิ้นแล้ว".to_string(),
        ));
    }

    let user_rows_by_id = if payload.user_ids.is_empty() {
        HashMap::new()
    } else {
        sqlx::query_as::<_, ManualUserRow>(
            r#"
            SELECT
                u.id,
                u.student_id,
                u.first_name,
                u.last_name,
                u.status::text AS status,
                d.organization_id
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.deleted_at IS NULL
              AND u.id = ANY($1)
            "#,
        )
        .bind(&payload.user_ids)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?
        .into_iter()
        .map(|u| (u.id, u))
        .collect::<HashMap<Uuid, ManualUserRow>>()
    };

    let user_rows_by_student_id = if normalized_student_ids.is_empty() {
        HashMap::new()
    } else {
        sqlx::query_as::<_, ManualUserRow>(
            r#"
            SELECT
                u.id,
                u.student_id,
                u.first_name,
                u.last_name,
                u.status::text AS status,
                d.organization_id
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.deleted_at IS NULL
              AND u.student_id = ANY($1)
            "#,
        )
        .bind(&normalized_student_ids)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?
        .into_iter()
        .map(|u| (u.student_id.clone(), u))
        .collect::<HashMap<String, ManualUserRow>>()
    };

    let mut results = Vec::new();
    let mut candidate_users: Vec<ManualUserRow> = Vec::new();
    let mut seen_user_ids = HashSet::new();

    for user_id in payload.user_ids {
        let input = user_id.to_string();
        let Some(user) = user_rows_by_id.get(&user_id) else {
            results.push(manual_result(input, None, "not_found", "ไม่พบผู้ใช้"));
            continue;
        };
        if !seen_user_ids.insert(user.id) {
            results.push(manual_result(
                input,
                Some(user),
                "duplicate_input",
                "มีรายชื่อนี้ในชุดข้อมูลแล้ว",
            ));
            continue;
        }
        if user.status != "active" {
            results.push(manual_result(
                input,
                Some(user),
                "inactive",
                "บัญชีผู้ใช้นี้ไม่ได้เปิดใช้งาน",
            ));
            continue;
        }
        if scope_org_id.is_some() && user.organization_id != scope_org_id {
            results.push(manual_result(
                input,
                Some(user),
                "not_allowed",
                "ไม่มีสิทธิ์เพิ่มนักศึกษานอกหน่วยงาน",
            ));
            continue;
        }
        candidate_users.push(user.clone());
    }

    for student_id in normalized_student_ids {
        let Some(user) = user_rows_by_student_id.get(&student_id) else {
            results.push(manual_result(
                student_id,
                None,
                "not_found",
                "ไม่พบรหัสนักศึกษา",
            ));
            continue;
        };
        if !seen_user_ids.insert(user.id) {
            results.push(manual_result(
                student_id,
                Some(user),
                "duplicate_input",
                "มีรายชื่อนี้ในชุดข้อมูลแล้ว",
            ));
            continue;
        }
        if user.status != "active" {
            results.push(manual_result(
                student_id,
                Some(user),
                "inactive",
                "บัญชีผู้ใช้นี้ไม่ได้เปิดใช้งาน",
            ));
            continue;
        }
        if scope_org_id.is_some() && user.organization_id != scope_org_id {
            results.push(manual_result(
                student_id,
                Some(user),
                "not_allowed",
                "ไม่มีสิทธิ์เพิ่มนักศึกษานอกหน่วยงาน",
            ));
            continue;
        }
        candidate_users.push(user.clone());
    }

    let candidate_user_ids = candidate_users.iter().map(|u| u.id).collect::<Vec<_>>();
    let existing_participations = if candidate_user_ids.is_empty() {
        HashMap::new()
    } else {
        sqlx::query_as::<_, ManualParticipationRow>(
            r#"
            SELECT id, user_id, status::text AS status
            FROM participations
            WHERE activity_id = $1
              AND user_id = ANY($2)
            FOR UPDATE
            "#,
        )
        .bind(activity_id)
        .bind(&candidate_user_ids)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?
        .into_iter()
        .map(|p| (p.user_id, p))
        .collect::<HashMap<Uuid, ManualParticipationRow>>()
    };

    let mut notify_user_ids = Vec::new();
    for user in candidate_users {
        match existing_participations.get(&user.id) {
            Some(existing) if existing.status == "checked_out" || existing.status == "completed" => {
                results.push(manual_result(
                    user.student_id.clone(),
                    Some(&user),
                    "already_completed",
                    "มีประวัติเข้าร่วมเสร็จสิ้นแล้ว",
                ));
            }
            Some(existing) => {
                sqlx::query(
                    r#"
                    UPDATE participations
                    SET status = 'checked_out'::participation_status,
                        checked_in_at = COALESCE(checked_in_at, $2),
                        checked_out_at = COALESCE(checked_out_at, $3),
                        notes = $4
                    WHERE id = $1
                    "#,
                )
                .bind(existing.id)
                .bind(activity.checked_in_at)
                .bind(activity.checked_out_at)
                .bind(&note)
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?;

                notify_user_ids.push(user.id);
                results.push(manual_result(
                    user.student_id.clone(),
                    Some(&user),
                    "updated",
                    "อัปเดตเป็นเข้าร่วมเสร็จสิ้นแล้ว",
                ));
            }
            None => {
                sqlx::query(
                    r#"
                    INSERT INTO participations (
                        id, user_id, activity_id, status,
                        registered_at, checked_in_at, checked_out_at, notes
                    )
                    VALUES (
                        $1, $2, $3, 'checked_out'::participation_status,
                        NOW(), $4, $5, $6
                    )
                    "#,
                )
                .bind(Uuid::new_v4())
                .bind(user.id)
                .bind(activity_id)
                .bind(activity.checked_in_at)
                .bind(activity.checked_out_at)
                .bind(&note)
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?;

                notify_user_ids.push(user.id);
                results.push(manual_result(
                    user.student_id.clone(),
                    Some(&user),
                    "completed",
                    "เพิ่มประวัติเข้าร่วมเสร็จสิ้นแล้ว",
                ));
            }
        }
    }

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB commit error: {}", e)))?;

    let _ = NotificationService::send_bulk(
        &pool,
        &notify_user_ids,
        &format!("✅ เพิ่มประวัติกิจกรรมย้อนหลัง: {}", activity.title),
        &format!("ผู้ดูแลระบบได้เพิ่มประวัติการเข้าร่วมกิจกรรม {} ให้คุณเรียบร้อยแล้ว", activity.title),
        NotificationType::Success,
        Some(&format!("/student/activities/{}", activity_id)),
    )
    .await;

    let summary = summarize_manual_results(&results);
    Ok(Json(ManualCompleteParticipationsResponse { summary, results }))
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
        activity_type: String,
        activity_level: Option<String>,
    }

    let rows = sqlx::query_as::<_, ParticipationRow>(r#"
        SELECT
            p.id, p.status::text AS status, p.registered_at, p.checked_in_at, p.checked_out_at, p.notes,
            a.id AS activity_id,
            a.title AS activity_title,
            a.description AS activity_description,
            a.location AS activity_location,
            a.start_date,
            a.end_date,
            a.hours,
            o.name AS organizer_name,
            a.activity_type::text AS activity_type,
            a.activity_level::text AS activity_level
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
                "organizer_name": r.organizer_name,
                "activity_type": r.activity_type,
                "activity_level": r.activity_level
            }
        })
    }).collect();

    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_manual_student_ids_trims_filters_and_deduplicates() {
        let raw = vec![
            " 65010001 ".to_string(),
            "".to_string(),
            "65010002\n65010003".to_string(),
            "65010001".to_string(),
            "  \t ".to_string(),
        ];

        let normalized = normalize_manual_student_ids(&raw);

        assert_eq!(normalized, vec!["65010001", "65010002", "65010003"]);
    }
}
