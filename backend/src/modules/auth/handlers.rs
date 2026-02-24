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

    sqlx::query("INSERT INTO sessions (id, user_id, expires_at, created_at, last_accessed, is_active, login_method) VALUES ($1, $2, $3, NOW(), NOW(), TRUE, 'password')")
        .bind(&session_id)
        .bind(user.id)
        .bind(expires_at)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create session: {}", e)))?;

    sqlx::query("UPDATE users SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1")
        .bind(user.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update user stats: {}", e)))?;

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

pub async fn me_handler(
    headers: HeaderMap,
    State(pool): State<PgPool>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    let claims = get_claims_from_headers(&headers)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user ID in token".to_string()))?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let admin_role = sqlx::query_as::<_, AdminRole>("SELECT * FROM admin_roles WHERE user_id = $1 AND is_enabled = TRUE")
        .bind(user.id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Fetch organization_name from admin_role's organization_id
    let (organization_id, organization_name): (Option<Uuid>, Option<String>) = if let Some(ref role) = admin_role {
        if let Some(org_id) = role.organization_id {
            let name = sqlx::query_scalar::<_, String>("SELECT name FROM organizations WHERE id = $1")
                .bind(org_id)
                .fetch_optional(&pool)
                .await
                .unwrap_or(None);
            (Some(org_id), name)
        } else {
            (None, None)
        }
    } else if let Some(dept_id) = user.department_id {
        let org_details = sqlx::query_as::<_, (Uuid, String)>("
            SELECT o.id, o.name 
            FROM organizations o
            JOIN departments d ON o.id = d.organization_id
            WHERE d.id = $1
        ")
        .bind(dept_id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None);
        
        if let Some((org_id, name)) = org_details {
            (Some(org_id), Some(name))
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    // Fetch department_name from user's department_id
    let department_name: Option<String> = if let Some(dept_id) = user.department_id {
        sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
            .bind(dept_id)
            .fetch_optional(&pool)
            .await
            .unwrap_or(None)
    } else {
        None
    };

    let expires_at = chrono::DateTime::from_timestamp(claims.exp as i64, 0)
        .unwrap_or_else(Utc::now);

    Ok(Json(UserResponse {
        id: user.id,
        student_id: user.student_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        prefix: user.prefix,
        admin_role,
        organization_id,
        organization_name,
        department_id: user.department_id,
        department_name,
        session_id: claims.session_id,
        expires_at,
    }))
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

    let qr_secret = Uuid::new_v4().to_string();
    let user_id = Uuid::new_v4();

    let result = sqlx::query!(
        r#"
        INSERT INTO users (id, student_id, email, password_hash, prefix, first_name, last_name, phone, qr_secret, status, department_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active'::user_status, $10)
        "#,
        user_id,
        payload.student_id,
        payload.email,
        password_hash,
        payload.prefix,
        payload.first_name,
        payload.last_name,
        payload.phone,
        qr_secret,
        payload.department_id,
    )
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
    
    if !resend_api_key.is_empty() {
        let reset_link = format!("{}/reset-password?token={}", frontend_url, token);
        let client = reqwest::Client::new();
        
        let html_content = format!(
            r#"<h2>Reset Your Password</h2>
            <p>You requested a password reset. Click the link below to set a new password:</p>
            <p><a href="{}">Reset Password</a></p>
            <p>This link will expire in 30 minutes. If you did not request this, please ignore this email.</p>"#,
            reset_link
        );

        let payload = serde_json::json!({
            "from": "Trackivity <onboarding@resend.dev>",
            "to": [email],
            "subject": "Trackivity - Password Reset",
            "html": html_content
        });

        let _ = client.post("https://api.resend.com/emails")
            .bearer_auth(resend_api_key)
            .json(&payload)
            .send()
            .await;
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

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(password_hash)
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = sqlx::query("DELETE FROM password_reset_tokens WHERE token = $1")
        .bind(&payload.token)
        .execute(&pool)
        .await;

    let _ = sqlx::query("UPDATE sessions SET is_active = FALSE WHERE user_id = $1")
        .bind(user_id)
        .execute(&pool)
        .await;

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "Password successfully reset" }))).into_response())
}
