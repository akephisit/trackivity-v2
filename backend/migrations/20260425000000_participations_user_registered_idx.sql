-- Composite index for the hot student-history query:
--   SELECT ... FROM participations WHERE user_id = $1 ORDER BY registered_at DESC
-- The single-column idx_participations_user_id forces a sort step. The
-- composite index lets Postgres return rows already ordered.
CREATE INDEX IF NOT EXISTS idx_participations_user_registered
    ON participations(user_id, registered_at DESC);
