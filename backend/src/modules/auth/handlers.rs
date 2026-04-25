use axum::{Json, extract::State, http::StatusCode, http::HeaderMap};
use axum::response::{IntoResponse, Response};
use axum::http::header::{SET_COOKIE, COOKIE};
use sqlx::PgPool;
use crate::models::{User, AdminRole, UserStatus};
use super::models::{AuthInput, AuthResponse, RegisterInput, RegisterResponse, UserResponse, Claims, ForgotPasswordInput, ResetPasswordInput};
use argon2::{
    Argon2, PasswordHash, PasswordVerifier,
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString}
};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use chrono::{Utc, Duration};
use uuid::Uuid;

// ─── Helpers ───────────────────────────────────────────────────────────────

pub fn verify_token(token: &str) -> Result<Claims, StatusCode> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let validation = Validation::default();
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;
    Ok(token_data.claims)
}

pub fn get_claims_from_headers(headers: &HeaderMap) -> Result<Claims, (StatusCode, String)> {
    if let Some(auth_header) = headers.get("Authorization") {
        let auth_str = auth_header.to_str()
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid Authorization header".to_string()))?;
        if auth_str.starts_with("Bearer ") {
            let token = auth_str.trim_start_matches("Bearer ");
            return verify_token(token)
                .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid or expired token".to_string()));
        }
    }

    if let Some(cookie_header) = headers.get(COOKIE) {
        let cookie_str = cookie_header.to_str()
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid cookie".to_string()))?;
        for part in cookie_str.split(';') {
            let part = part.trim();
            if let Some(value) = part.strip_prefix("session_token=") {
                return verify_token(value)
                    .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid or expired session".to_string()));
            }
        }
    }

    Err((StatusCode::UNAUTHORIZED, "Missing authentication".to_string()))
}

fn build_cookie(token: &str, remember_me: bool, is_production: bool) -> String {
    let max_age = if remember_me { 30 * 24 * 60 * 60 } else { 7 * 24 * 60 * 60 };
    let secure = if is_production { "; Secure" } else { "" };
    let domain = std::env::var("COOKIE_DOMAIN").unwrap_or_default();
    let domain_part = if domain.is_empty() { String::new() } else { format!("; Domain={}", domain) };
    format!(
        "session_token={}; HttpOnly{}; SameSite=Lax; Path=/; Max-Age={}{}",
        token, secure, max_age, domain_part
    )
}

// ─── Handlers ──────────────────────────────────────────────────────────────

pub async fn login_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthInput>,
) -> Result<Response, (StatusCode, String)> {
    let user_query_result = if let Some(email) = &payload.email {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(&pool)
            .await
    } else if let Some(student_id) = &payload.student_id {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE student_id = $1")
            .bind(student_id)
            .fetch_optional(&pool)
            .await
    } else {
        return Err((StatusCode::BAD_REQUEST, "Email or Student ID required".to_string()));
    };

    let user = user_query_result
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;

    match user.status {
        UserStatus::Active => {},
        _ => return Err((StatusCode::FORBIDDEN, "Account is not active".to_string())),
    }

    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid password hash stored".to_string()))?;
    if Argon2::default().verify_password(payload.password.as_bytes(), &parsed_hash).is_err() {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }

    let admin_role = sqlx::query_as::<_, AdminRole>("SELECT * FROM admin_roles WHERE user_id = $1 AND is_enabled = TRUE")
        .bind(user.id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let admin_level = admin_role.as_ref().map(|r| r.admin_level.clone());
    let session_id = Uuid::new_v4().to_string();
    let remember_me = payload.remember_me.unwrap_or(false);
    let expiration_duration = if remember_me { Duration::days(30) } else { Duration::days(7) };
    let expires_at = Utc::now().checked_add_signed(expiration_duration).expect("valid timestamp");

    // Session insert and last_login update are independent — run them
    // concurrently to save one round-trip on every login.
    let session_insert = sqlx::query(
        "INSERT INTO sessions (id, user_id, expires_at, created_at, last_accessed, is_active, login_method) VALUES ($1, $2, $3, NOW(), NOW(), TRUE, 'password')",
    )
    .bind(&session_id)
    .bind(user.id)
    .bind(expires_at)
    .execute(&pool);

    let last_login_update = sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&pool);

    let (session_res, last_login_res) = tokio::join!(session_insert, last_login_update);
    session_res.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create session: {}", e)))?;
    last_login_res.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update user stats: {}", e)))?;

    let secret = std::env::var("JWT_SECRET")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "JWT_SECRET not set".to_string()))?;

    let is_admin = admin_role.is_some();
    let organization_id = admin_role.as_ref().and_then(|r| r.organization_id);

    let claims = Claims {
        sub: user.id.to_string(),
        student_id: user.student_id.clone(),
        email: user.email.clone(),
        admin_level: admin_level.clone(),
        session_id: session_id.clone(),
        exp: expires_at.timestamp() as usize,
        iat: Utc::now().timestamp() as usize,
        first_name: user.first_name.clone(),
        last_name: user.last_name.clone(),
        department_id: user.department_id,
        is_admin,
        organization_id,
    };

    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Token creation failed: {}", e)))?;

    let is_production = std::env::var("NODE_ENV").unwrap_or_default() == "production";
    let cookie = build_cookie(&token, remember_me, is_production);

    let body = AuthResponse {
        token: token.clone(),
        user: UserResponse {
            id: user.id,
            student_id: user.student_id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            prefix: user.prefix,
            admin_role,
            organization_id: None,
            organization_name: None,
            department_id: user.department_id,
            department_name: None,
            session_id,
            expires_at,
        }
    };

    let response = (StatusCode::OK, [(SET_COOKIE, cookie)], Json(body)).into_response();
    Ok(response)
}

pub async fn logout_handler(
    headers: HeaderMap,
    State(pool): State<PgPool>,
) -> Result<Response, (StatusCode, String)> {
    if let Ok(claims) = get_claims_from_headers(&headers) {
        let _ = sqlx::query("UPDATE sessions SET is_active = FALSE WHERE id = $1")
            .bind(&claims.session_id)
            .execute(&pool)
            .await;
    }
    let clear_cookie = "session_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
    let response = (
        StatusCode::OK,
        [(SET_COOKIE, clear_cookie)],
        Json(serde_json::json!({ "message": "Logged out successfully" })),
    ).into_response();
    Ok(response)
}

/// Flat row produced by the single LEFT-JOIN query in `me_handler`.
/// Admin-role columns are all Option because the join may not match.
/// `organization_id` / `organization_name` come from a CASE WHEN that
/// preserves the old precedence: admin_role.organization_id wins; if
/// the user has no admin_role, fall back to their department's org.
#[derive(sqlx::FromRow, Debug)]
struct MeRow {
    id: Uuid,
    student_id: String,
    email: String,
    first_name: String,
    last_name: String,
    prefix: String,
    department_id: Option<Uuid>,
    ar_id: Option<Uuid>,
    ar_user_id: Option<Uuid>,
    ar_admin_level: Option<crate::models::AdminLevel>,
    ar_organization_id: Option<Uuid>,
    ar_permissions: Option<Vec<String>>,
    ar_is_enabled: Option<bool>,
    ar_created_at: Option<chrono::DateTime<chrono::Utc>>,
    ar_updated_at: Option<chrono::DateTime<chrono::Utc>>,
    organization_id: Option<Uuid>,
    organization_name: Option<String>,
    department_name: Option<String>,
}

/// Pure transformation. Kept pure so the four user-shape branches
/// (super admin, org admin, student-with-dept, student-no-dept) can
/// be unit-tested without a DB.
fn me_row_to_response(row: MeRow, session_id: String, expires_at: chrono::DateTime<chrono::Utc>) -> UserResponse {
    let admin_role = row.ar_id.map(|id| AdminRole {
        id,
        // The columns below are NOT NULL in the schema, so when ar_id
        // is Some they are guaranteed Some too. Use unwrap_or_default
        // / unwrap_or to avoid panicking on unexpected NULL — the
        // semantics match a row that exists but is empty/disabled.
        user_id: row.ar_user_id.unwrap_or(Uuid::nil()),
        admin_level: row.ar_admin_level.unwrap_or(crate::models::AdminLevel::RegularAdmin),
        organization_id: row.ar_organization_id,
        permissions: row.ar_permissions.unwrap_or_default(),
        is_enabled: row.ar_is_enabled.unwrap_or(false),
        created_at: row.ar_created_at,
        updated_at: row.ar_updated_at,
    });

    UserResponse {
        id: row.id,
        student_id: row.student_id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        prefix: row.prefix,
        admin_role,
        organization_id: row.organization_id,
        organization_name: row.organization_name,
        department_id: row.department_id,
        department_name: row.department_name,
        session_id,
        expires_at,
    }
}

pub async fn me_handler(
    headers: HeaderMap,
    State(pool): State<PgPool>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID in token".to_string()))?;

    // Single JOIN replaces the previous 3-4 sequential queries.
    // Precedence rule for organization is encoded in CASE WHEN:
    //   - if user has an enabled admin_role  -> use admin_role.organization_id (may be NULL for super admin)
    //   - else                               -> fall back to department's organization
    let row = sqlx::query_as::<_, MeRow>(r#"
        SELECT
            u.id, u.student_id, u.email, u.first_name, u.last_name, u.prefix, u.department_id,
            ar.id              AS ar_id,
            ar.user_id         AS ar_user_id,
            ar.admin_level     AS ar_admin_level,
            ar.organization_id AS ar_organization_id,
            ar.permissions     AS ar_permissions,
            ar.is_enabled      AS ar_is_enabled,
            ar.created_at      AS ar_created_at,
            ar.updated_at      AS ar_updated_at,
            CASE WHEN ar.id IS NOT NULL THEN ao.id   ELSE dept_org.id   END AS organization_id,
            CASE WHEN ar.id IS NOT NULL THEN ao.name ELSE dept_org.name END AS organization_name,
            d.name AS department_name
        FROM users u
        LEFT JOIN admin_roles  ar       ON ar.user_id = u.id AND ar.is_enabled = TRUE
        LEFT JOIN organizations ao      ON ao.id = ar.organization_id
        LEFT JOIN departments   d       ON d.id  = u.department_id
        LEFT JOIN organizations dept_org ON dept_org.id = d.organization_id
        WHERE u.id = $1
    "#)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let expires_at = chrono::DateTime::from_timestamp(claims.exp as i64, 0)
        .unwrap_or_else(Utc::now);

    Ok(Json(me_row_to_response(row, claims.session_id, expires_at)))
}

pub async fn register_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<RegisterInput>,
) -> Result<Json<RegisterResponse>, (StatusCode, String)> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {}", e)))?
        .to_string();

    let user_id = Uuid::new_v4();

    let result = sqlx::query(
        r#"
        INSERT INTO users (id, student_id, email, password_hash, prefix, first_name, last_name, phone, status, department_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active'::user_status, $9)
        "#,
    )
    .bind(user_id)
    .bind(&payload.student_id)
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.prefix)
    .bind(&payload.first_name)
    .bind(&payload.last_name)
    .bind(&payload.phone)
    .bind(payload.department_id)
    .execute(&pool)
    .await;

    match result {
        Ok(_) => Ok(Json(RegisterResponse {
            user_id,
            message: "User registered successfully".to_string(),
        })),
        Err(sqlx::Error::Database(db_err)) => {
            if db_err.is_unique_violation() {
                Err((StatusCode::CONFLICT, "Student ID or Email already exists".to_string()))
            } else {
                Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", db_err)))
            }
        },
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to register: {}", e))),
    }
}

pub async fn forgot_password_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<ForgotPasswordInput>,
) -> Result<Response, (StatusCode, String)> {
    let email = payload.email.to_lowercase();
    
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = match user {
        Some(u) => u,
        None => return Ok((StatusCode::OK, Json(serde_json::json!({ "message": "If this email exists, a password reset link has been sent." }))).into_response()),
    };

    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::minutes(30);

    sqlx::query("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)")
        .bind(user.id)
        .bind(&token)
        .bind(expires_at)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let resend_api_key = std::env::var("RESEND_API_KEY").unwrap_or_default();
    let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".to_string());

    if resend_api_key.is_empty() {
        tracing::warn!(
            "RESEND_API_KEY is not set — skipping password reset email for {}",
            email
        );
    } else {
        let reset_link = format!("{}/reset-password?token={}", frontend_url, token);
        let client = reqwest::Client::new();

        let html_content = format!(
            r#"<h2>คุณได้ขอรีเซ็ตรหัสผ่าน</h2>
            <p>กรุณาคลิกที่ลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่สำหรับบัญชี Trackivity ของคุณ:</p>
            <p><a href="{}">เปลี่ยนรหัสผ่าน</a></p>
            <p>ลิงก์นี้จะหมดอายุภายใน 30 นาที หากคุณไม่ได้ส่งคำขอนี้ หรือเป็นความผิดพลาด คุณสามารถเพิกเฉยต่ออีเมลฉบับนี้ได้เลย</p>"#,
            reset_link
        );

        let payload = serde_json::json!({
            "from": "Trackivity <admin@utrackivity.com>",
            "to": [&email],
            "subject": "Trackivity - คำขอตั้งรหัสผ่านใหม่",
            "html": html_content
        });

        match client
            .post("https://api.resend.com/emails")
            .bearer_auth(&resend_api_key)
            .json(&payload)
            .send()
            .await
        {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    tracing::info!("Password reset email queued for {}", email);
                } else {
                    let body = resp.text().await.unwrap_or_default();
                    tracing::error!(
                        "Resend API returned {} for {}: {}",
                        status,
                        email,
                        body
                    );
                }
            }
            Err(e) => {
                tracing::error!("Resend network error for {}: {}", email, e);
            }
        }
    }

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "If this email exists, a password reset link has been sent." }))).into_response())
}

pub async fn reset_password_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<ResetPasswordInput>,
) -> Result<Response, (StatusCode, String)> {
    let record = sqlx::query_as::<_, (Uuid, chrono::DateTime<Utc>)>(
        "SELECT user_id, expires_at FROM password_reset_tokens WHERE token = $1"
    )
    .bind(&payload.token)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (user_id, expires_at) = match record {
        Some(r) => r,
        None => return Err((StatusCode::BAD_REQUEST, "Invalid or expired token".to_string())),
    };

    if Utc::now() > expires_at {
        let _ = sqlx::query("DELETE FROM password_reset_tokens WHERE token = $1")
            .bind(&payload.token)
            .execute(&pool)
            .await;
        return Err((StatusCode::BAD_REQUEST, "Token has expired".to_string()));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(payload.new_password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {}", e)))?
        .to_string();

    // Update password, consume token, and invalidate sessions atomically.
    // If any step fails, the whole reset rolls back so the token remains
    // usable (or, conversely, can never be silently consumed without a
    // password change).
    let mut tx = pool.begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(password_hash)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query("DELETE FROM password_reset_tokens WHERE token = $1")
        .bind(&payload.token)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query("UPDATE sessions SET is_active = FALSE WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "Password successfully reset" }))).into_response())
}

#[cfg(test)]
mod me_handler_tests {
    use super::*;
    use crate::models::AdminLevel;
    use chrono::TimeZone;

    fn fixture_row() -> MeRow {
        MeRow {
            id: Uuid::nil(),
            student_id: "6500001".into(),
            email: "u@example.com".into(),
            first_name: "U".into(),
            last_name: "Test".into(),
            prefix: "Mr.".into(),
            department_id: None,
            ar_id: None,
            ar_user_id: None,
            ar_admin_level: None,
            ar_organization_id: None,
            ar_permissions: None,
            ar_is_enabled: None,
            ar_created_at: None,
            ar_updated_at: None,
            organization_id: None,
            organization_name: None,
            department_name: None,
        }
    }

    fn ts() -> chrono::DateTime<chrono::Utc> {
        chrono::Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap()
    }

    /// Super admin: admin_role exists, organization_id NULL → org info should be None
    /// (matches old behaviour where the inner `if let Some(org_id)` branch returned None.)
    #[test]
    fn super_admin_no_org() {
        let row = MeRow {
            ar_id: Some(Uuid::nil()),
            ar_user_id: Some(Uuid::nil()),
            ar_admin_level: Some(AdminLevel::SuperAdmin),
            ar_organization_id: None,
            ar_permissions: Some(vec![]),
            ar_is_enabled: Some(true),
            ar_created_at: Some(ts()),
            ar_updated_at: Some(ts()),
            organization_id: None,
            organization_name: None,
            ..fixture_row()
        };
        let r = me_row_to_response(row, "s".into(), ts());
        assert!(r.admin_role.is_some());
        assert_eq!(r.admin_role.as_ref().unwrap().admin_level, AdminLevel::SuperAdmin);
        assert_eq!(r.organization_id, None);
        assert_eq!(r.organization_name, None);
    }

    /// Org admin with department: admin_role.organization_id wins over department's org.
    #[test]
    fn org_admin_uses_admin_org_not_dept_org() {
        let admin_org = Uuid::new_v4();
        let dept = Uuid::new_v4();
        let row = MeRow {
            department_id: Some(dept),
            department_name: Some("CS".into()),
            ar_id: Some(Uuid::nil()),
            ar_user_id: Some(Uuid::nil()),
            ar_admin_level: Some(AdminLevel::OrganizationAdmin),
            ar_organization_id: Some(admin_org),
            ar_permissions: Some(vec![]),
            ar_is_enabled: Some(true),
            ar_created_at: Some(ts()),
            ar_updated_at: Some(ts()),
            // SQL CASE WHEN ar.id IS NOT NULL → uses admin_role's org, not dept_org
            organization_id: Some(admin_org),
            organization_name: Some("Admin Org".into()),
            ..fixture_row()
        };
        let r = me_row_to_response(row, "s".into(), ts());
        assert_eq!(r.organization_id, Some(admin_org));
        assert_eq!(r.organization_name.as_deref(), Some("Admin Org"));
        assert_eq!(r.department_id, Some(dept));
        assert_eq!(r.department_name.as_deref(), Some("CS"));
    }

    /// Student with department: no admin_role → org derived from department's org.
    #[test]
    fn student_with_dept_uses_dept_org() {
        let dept_org = Uuid::new_v4();
        let dept = Uuid::new_v4();
        let row = MeRow {
            department_id: Some(dept),
            department_name: Some("CS".into()),
            organization_id: Some(dept_org),
            organization_name: Some("Faculty of Science".into()),
            ..fixture_row()
        };
        let r = me_row_to_response(row, "s".into(), ts());
        assert!(r.admin_role.is_none());
        assert_eq!(r.organization_id, Some(dept_org));
        assert_eq!(r.organization_name.as_deref(), Some("Faculty of Science"));
        assert_eq!(r.department_name.as_deref(), Some("CS"));
    }

    /// Student with no department, no admin_role → all org/dept fields None.
    #[test]
    fn student_no_dept_returns_nulls() {
        let r = me_row_to_response(fixture_row(), "s".into(), ts());
        assert!(r.admin_role.is_none());
        assert_eq!(r.organization_id, None);
        assert_eq!(r.organization_name, None);
        assert_eq!(r.department_id, None);
        assert_eq!(r.department_name, None);
    }
}
