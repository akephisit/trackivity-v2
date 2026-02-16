-- ===== DATABASE PARTITIONING SETUP =====
-- Run these commands after initial schema migration
-- This optimizes performance for time-series data

-- 1. Create partitions for audit_logs table (by month)
-- Example: Partition for 2024
CREATE TABLE IF NOT EXISTS audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
    
CREATE TABLE IF NOT EXISTS audit_logs_2024_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add more partitions as needed
-- Consider creating partitions dynamically using pg_partman extension

-- 2. Set up automatic partition creation (requires pg_partman extension)
-- Install: CREATE EXTENSION IF NOT EXISTS pg_partman;

-- For audit_logs
-- SELECT partman.create_parent(
--     p_parent_table => 'public.audit_logs',
--     p_control => 'log_date',
--     p_type => 'range',
--     p_interval => 'monthly',
--     p_premake => 6
-- );

-- 3. Create materialized views for common analytics queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_organization_stats AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) as active_users,
    COUNT(DISTINCT a.id) as total_activities,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_activities,
    ROUND(
        COALESCE(
            (COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) * 100.0) / 
            NULLIF(COUNT(DISTINCT a.id), 0), 
            0
        ), 2
    ) as completion_rate
FROM organizations o
LEFT JOIN departments d ON o.id = d.organization_id
LEFT JOIN users u ON d.id = u.department_id AND u.deleted_at IS NULL
LEFT JOIN activities a ON o.id = a.organizer_id AND a.deleted_at IS NULL
WHERE o.status = true
GROUP BY o.id, o.name;

-- Refresh schedule (run via cron or pg_cron)
-- SELECT cron.schedule('refresh-org-stats', '0 1 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_organization_stats');

-- 5. Create indexes on partitions (automatically inherited)
-- No additional work needed - indexes from parent table are inherited

-- 6. Set up automatic cleanup for old partitions
-- Example: Drop partitions older than 2 years
-- SELECT partman.drop_partition_time(
--     p_parent_table => 'public.audit_logs',
--     p_retention_schema => 'public',
--     p_retention => '2 years'
-- );

-- 7. Performance optimization settings
-- Add to postgresql.conf:
-- shared_preload_libraries = 'pg_partman_bgw'
-- pg_partman_bgw.interval = 3600  -- Run every hour
-- pg_partman_bgw.role = 'postgres'
-- pg_partman_bgw.dbname = 'trackivity'

-- 8. Create function for efficient user search with full-text
CREATE OR REPLACE FUNCTION search_users(search_term TEXT)
RETURNS TABLE(
    id UUID,
    student_id VARCHAR,
    email VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.student_id,
        u.email,
        u.first_name,
        u.last_name,
        ts_rank(to_tsvector('thai', u.first_name || ' ' || u.last_name), plainto_tsquery('thai', search_term)) as rank
    FROM users u
    WHERE 
        u.deleted_at IS NULL
        AND u.status = 'active'
        AND (
            to_tsvector('thai', u.first_name || ' ' || u.last_name) @@ plainto_tsquery('thai', search_term)
            OR u.student_id ILIKE '%' || search_term || '%'
            OR u.email ILIKE '%' || search_term || '%'
        )
    ORDER BY rank DESC, u.first_name, u.last_name
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- 9. Create efficient activity search function
CREATE OR REPLACE FUNCTION search_activities(
    search_term TEXT,
    org_id UUID DEFAULT NULL,
    academic_year SMALLINT DEFAULT NULL,
    activity_status TEXT DEFAULT 'published'
)
RETURNS TABLE(
    id UUID,
    title VARCHAR,
    description TEXT,
    start_date DATE,
    organizer_name VARCHAR,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.description,
        a.start_date,
        o.name as organizer_name,
        ts_rank(to_tsvector('thai', a.title || ' ' || a.description), plainto_tsquery('thai', search_term)) as rank
    FROM activities a
    JOIN organizations o ON a.organizer_id = o.id
    WHERE 
        a.deleted_at IS NULL
        AND a.status = activity_status::activity_status
        AND (org_id IS NULL OR a.organizer_id = org_id)
        AND (academic_year IS NULL OR a.academic_year = academic_year)
        AND to_tsvector('thai', a.title || ' ' || a.description) @@ plainto_tsquery('thai', search_term)
    ORDER BY rank DESC, a.start_date DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- 10. Create triggers for maintaining counters
CREATE OR REPLACE FUNCTION update_activity_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE activities 
        SET participant_count = participant_count + 1,
            updated_at = NOW()
        WHERE id = NEW.activity_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE activities 
        SET participant_count = GREATEST(0, participant_count - 1),
            updated_at = NOW()
        WHERE id = OLD.activity_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_activity_participant_count
    AFTER INSERT OR DELETE ON participations
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_participant_count();

-- 11. Create function for activity view tracking
CREATE OR REPLACE FUNCTION log_activity_view(
    p_activity_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_session_id VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Insert view log (ignore duplicates for same user on same day)
    INSERT INTO activity_views (activity_id, user_id, ip_address, session_id)
    VALUES (p_activity_id, p_user_id, p_ip_address, p_session_id)
    ON CONFLICT DO NOTHING;
    
    -- Update view counter on activity
    UPDATE activities 
    SET view_count = view_count + 1,
        updated_at = NOW()
    WHERE id = p_activity_id;
END;
$$ LANGUAGE plpgsql;