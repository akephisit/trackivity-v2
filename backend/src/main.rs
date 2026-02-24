use axum::{
    routing::{get, post, put},
    Router,
};
use sqlx::postgres::{PgPoolOptions, PgConnectOptions};
use std::net::SocketAddr;
use std::str::FromStr;
use std::time::Duration;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use axum::http::{HeaderValue, Method, header};

mod models;
mod modules;

use modules::auth;
use modules::activities;
use modules::organizations;
use modules::users;
use modules::departments;
use modules::admins;
use modules::qr;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let connect_options = PgConnectOptions::from_str(&database_url)
        .expect("Invalid DATABASE_URL format")
        // Essential for Neon's connection pooler (-pooler.neon.tech)
        // to prevent "prepared statement does not exist" errors:
        .statement_cache_capacity(0);

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(0) // Let pool scale down completely to allow Neon to sleep
        .idle_timeout(Duration::from_secs(30)) // Close idle connections quickly
        .max_lifetime(Duration::from_secs(1800)) // 30 mins max lifetime
        .connect_with(connect_options)
        .await
        .expect("Failed to connect to database");

    tracing::info!("✅ Connected to database successfully!");

    tracing::info!("🔄 Running migrations...");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");
    tracing::info!("✅ Migrations executed successfully!");

    let frontend_urls = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());
    
    let allowed_origins: Vec<HeaderValue> = frontend_urls
        .split(',')
        .map(|s| s.trim().parse::<HeaderValue>().expect("Invalid FRONTEND_URL"))
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::PATCH, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::COOKIE,
        ])
        .allow_credentials(true);

    let app = Router::new()
        .route("/", get(|| async { "Trackivity Backend is running! 🚀" }))
        // ─── Auth ─────────────────────────────────────────
        .route("/auth/login", post(auth::login_handler))
        .route("/auth/register", post(auth::register_handler))
        .route("/auth/logout", post(auth::logout_handler))
        .route("/auth/me", get(auth::me_handler))
        // ─── Activities ───────────────────────────────────
        .route("/activities/dashboard", get(activities::get_dashboard_activities))
        .route("/activities", get(activities::list_activities).post(activities::create_activity))
        .route("/activities/:id", get(activities::get_activity).put(activities::update_activity).delete(activities::delete_activity))
        .route("/activities/:id/join", post(activities::join_activity))
        .route("/activities/my/participations", get(activities::get_my_participations))
        // ─── Organizations ────────────────────────────────
        .route("/organizations", get(organizations::get_all_organizations))
        .route("/organizations/admin", get(organizations::list_all_organizations_admin).post(organizations::create_organization))
        .route("/organizations/:id", put(organizations::update_organization).delete(organizations::delete_organization))
        .route("/organizations/:id/toggle-status", post(organizations::toggle_organization_status))
        .route("/organizations/:id/requirements", get(organizations::get_activity_requirements).put(organizations::update_activity_requirements))
        .route("/organizations/:id/departments", get(organizations::get_departments))
        // ─── Departments ──────────────────────────────────
        .route("/departments", get(departments::list_departments).post(departments::create_department))
        .route("/departments/:id", put(departments::update_department).delete(departments::delete_department))
        .route("/departments/:id/toggle-status", post(departments::toggle_department_status))
        // ─── Users ────────────────────────────────────────
        .route("/users", get(users::list_users))
        .route("/users/:id", get(users::get_user))
        .route("/users/me/profile", put(users::update_profile))
        .route("/users/me/password", post(users::change_password))
        // ─── QR Code ──────────────────────────────────────────
        .route("/qr/generate", post(qr::handlers::generate_qr_handler))
        .route("/activities/:id/checkin", post(qr::handlers::checkin_handler))
        .route("/activities/:id/checkout", post(qr::handlers::checkout_handler))
        // ─── Admins ───────────────────────────────────────
        .route("/admins", get(admins::handlers::list_admins).post(admins::handlers::create_admin))
        .route("/admins/:id", put(admins::handlers::update_admin).delete(admins::handlers::delete_admin))
        .route("/admins/:id/toggle-status", post(admins::handlers::toggle_admin_status))
        // ─── Organization Admins ──────────────────────────
        .route("/organization-admins", get(admins::handlers::list_organization_admins))
        // ─── Notifications ────────────────────────────────
        .route("/notifications", get(modules::notifications::handlers::list_notifications))
        .route("/notifications/subscribe", post(modules::notifications::handlers::subscribe_push))
        .route("/notifications/read-all", put(modules::notifications::handlers::mark_all_read))
        .route("/notifications/:id/read", put(modules::notifications::handlers::mark_read))
        .route("/notifications/test", post(modules::notifications::handlers::test_push))
        // ─── Middleware ───────────────────────────────────
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("🚀 Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
