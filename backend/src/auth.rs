use axum::{Json, extract::State, http::StatusCode, http::HeaderMap};
use sqlx::PgPool;
use crate::models::{
    AuthInput, AuthResponse, RegisterInput, RegisterResponse,
    User, AdminRole, UserResponse, Claims, UserStatus, AdminLevel
};
use argon2::{
    Argon2, PasswordHash, PasswordVerifier,
    password_hash::{
        rand_core::OsRng,
        PasswordHasher, SaltString
    }
};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use chrono::{Utc, Duration};
use uuid::Uuid;

// Public helper to check auth
pub fn verify_token(token: &str) -> Result<Claims, StatusCode> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let validation = Validation::default();
    
    let token_data = decode::<Claims>(
        token, 
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    Ok(token_data.claims)
}

// Extractor helper (manual for now, can be axum middleware later)
pub fn get_claims_from_headers(headers: &HeaderMap) -> Result<Claims, (StatusCode, String)> {
    let auth_header = headers.get("Authorization")
        .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header".to_string()))?
        .to_str()
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid Authorization header".to_string()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err((StatusCode::UNAUTHORIZED, "Invalid bearer token".to_string()));
    }

    let token = auth_header.trim_start_matches("Bearer ");
    verify_token(token).map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid or expired token".to_string()))
}


pub async fn login_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthInput>,
) ->  Result<Json<AuthResponse>, (StatusCode, String)> {
    // 1. Find user by email or student_id
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

    let user = user_query_result.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;

    // Check if user is active
    match user.status {
        UserStatus::Active => {},
        _ => return Err((StatusCode::FORBIDDEN, "Account is not active".to_string())),
    }

    // 2. Verify password
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid password hash stored".to_string()))?;
    
    if Argon2::default().verify_password(payload.password.as_bytes(), &parsed_hash).is_err() {
         return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }

    // 3. Get admin role and permissions
    let admin_role = sqlx::query_as::<_, AdminRole>("SELECT * FROM admin_roles WHERE user_id = $1")
        .bind(user.id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let admin_level = admin_role.as_ref().map(|r| r.admin_level.clone());
    // let permissions = admin_role.as_ref().map(|r| r.permissions.clone()).unwrap_or_default();

    // 4. Create Session in DB
    let session_id = Uuid::new_v4().to_string(); // Simple UUID as session ID string
    
    let remember_me = payload.remember_me.unwrap_or(false);
    let expiration_duration = if remember_me { Duration::days(30) } else { Duration::days(7) };
    let expires_at = Utc::now()
        .checked_add_signed(expiration_duration)
        .expect("valid timestamp");

    // Insert session
    sqlx::query("INSERT INTO sessions (id, user_id, expires_at, created_at, last_accessed, is_active, login_method) VALUES ($1, $2, $3, NOW(), NOW(), TRUE, 'password')")
        .bind(&session_id)
        .bind(user.id)
        .bind(expires_at)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create session: {}", e)))?;

    // Update last login
    sqlx::query("UPDATE users SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1")
        .bind(user.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to update user stats: {}", e)))?;

    // 5. Create JWT
    let secret = std::env::var("JWT_SECRET").map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "JWT_SECRET not set".to_string()))?;
    
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

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            student_id: user.student_id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            prefix: user.prefix,
            admin_role: admin_role,
            session_id,
            expires_at,
        }
    }))
}

pub async fn register_handler(
    State(pool): State<PgPool>,
    Json(payload): Json<RegisterInput>,
) -> Result<Json<RegisterResponse>, (StatusCode, String)> {
    // 1. Hash Password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {}", e)))?
        .to_string();

    // 2. Generate QR Secret
    let qr_secret = Uuid::new_v4().to_string();

    // 3. Create User
    // Default department_id is null for now. 
    // Default status is 'active' per Schema default
    let user_id = Uuid::new_v4();

    let result = sqlx::query!(
        r#"
        INSERT INTO users (id, student_id, email, password_hash, prefix, first_name, last_name, phone, qr_secret, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active'::user_status)
        "#,
        user_id,
        payload.student_id,
        payload.email,
        password_hash,
        payload.prefix,
        payload.first_name,
        payload.last_name,
        payload.phone,
        qr_secret
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
