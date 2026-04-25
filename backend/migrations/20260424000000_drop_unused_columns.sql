-- Drop columns that are never read anywhere in the codebase.
-- See commit message / docs for rationale.

-- admin_roles.last_session_id: never written or read
DROP INDEX IF EXISTS idx_admin_roles_last_session;
ALTER TABLE admin_roles DROP COLUMN IF EXISTS last_session_id;

-- activities.academic_year: written at create, never queried
DROP INDEX IF EXISTS idx_activities_academic_year;
ALTER TABLE activities DROP COLUMN IF EXISTS academic_year;

-- users.qr_secret: legacy from pre-JWT QR system, replaced by token-based QR
ALTER TABLE users DROP COLUMN IF EXISTS qr_secret;

-- users.login_count: incremented on login but never read
ALTER TABLE users DROP COLUMN IF EXISTS login_count;
