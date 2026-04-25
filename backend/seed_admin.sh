#!/bin/bash
set -e

# Usage:
#   SEED_ADMIN_PASSWORD='…' bash seed_admin.sh
#   bash seed_admin.sh '…'
#
# Requires: psql, uuidgen, and a Rust toolchain with `cargo run --example hash`
# (or substitute your own Argon2 hash via SEED_ADMIN_HASH env var).

DUMMY_EMAIL="${SEED_ADMIN_EMAIL:-sadmin@gmail.com}"
PASSWORD="${SEED_ADMIN_PASSWORD:-$1}"
PRECOMPUTED_HASH="${SEED_ADMIN_HASH:-}"

if [ -z "$PASSWORD" ] && [ -z "$PRECOMPUTED_HASH" ]; then
  echo "❌ Missing password. Provide one of:"
  echo "   SEED_ADMIN_PASSWORD=<password> bash seed_admin.sh"
  echo "   bash seed_admin.sh <password>"
  echo "   SEED_ADMIN_HASH=<argon2-hash> bash seed_admin.sh   # skip hashing"
  exit 1
fi

export DATABASE_URL=$(grep ^DATABASE_URL .env | cut -d '=' -f2-)
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not found in .env"
  exit 1
fi

if [ -n "$PRECOMPUTED_HASH" ]; then
  HASH="$PRECOMPUTED_HASH"
else
  # Hash via Python if available; fall back to requiring SEED_ADMIN_HASH
  if command -v python3 >/dev/null 2>&1 && python3 -c "import argon2" 2>/dev/null; then
    HASH=$(python3 -c "import argon2,sys; print(argon2.PasswordHasher().hash(sys.argv[1]))" "$PASSWORD")
  else
    echo "❌ Need python3 with argon2-cffi installed, or pass SEED_ADMIN_HASH env var."
    echo "   pip install argon2-cffi"
    exit 1
  fi
fi

NEW_USER_ID=$(uuidgen)

echo "➕ Inserting admin user ($DUMMY_EMAIL)..."
psql "$DATABASE_URL" -c "
INSERT INTO users (id, student_id, email, password_hash, prefix, first_name, last_name, phone, qr_secret, status)
VALUES ('$NEW_USER_ID', 'ADMIN001', '$DUMMY_EMAIL', '$HASH', 'Admin', 'Super', 'Administrator', '0123456789', '$(openssl rand -hex 32)', 'active')
ON CONFLICT (email) DO NOTHING;
"

ADMIN_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users WHERE email='$DUMMY_EMAIL'" | xargs)

psql "$DATABASE_URL" -c "
INSERT INTO admin_roles (user_id, admin_level, is_enabled)
VALUES ('$ADMIN_ID', 'super_admin', true)
ON CONFLICT (user_id) DO NOTHING;
"

echo "✅ Admin user ready."
echo "   Email:    $DUMMY_EMAIL"
echo "   Password: (as provided — change it after first login)"
