#!/bin/bash
export DATABASE_URL=$(grep DATABASE_URL .env | cut -d '=' -f2-)
DUMMY_EMAIL="sadmin@gmail.com"

# password123 hashed by argon2 (using existing test hash or dummy)
DUMMY_HASH="\$argon2id\$v=19\$m=65536,t=3,p=4\$vXKGGiaJZOlF6oDQl6Sy7A\$WMbs9CzorsE28ClWY1we1bBIIHYPMI8e/rhrAwwDe1E"
NEW_USER_ID=$(uuidgen)

echo "Adding admin user to database..."
psql "$DATABASE_URL" -c "
INSERT INTO users (id, student_id, email, password_hash, prefix, first_name, last_name, phone, qr_secret, status)
VALUES ('$NEW_USER_ID', 'ADMIN001', '$DUMMY_EMAIL', '$DUMMY_HASH', 'Admin', 'Super', 'Administrator', '0123456789', '$(openssl rand -hex 32)', 'active')
ON CONFLICT (email) DO NOTHING;
"

# Get the UUID (either new or existing)
ADMIN_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users WHERE email='$DUMMY_EMAIL'" | xargs)

# Add admin role
psql "$DATABASE_URL" -c "
INSERT INTO admin_roles (user_id, admin_level, is_enabled)
VALUES ('$ADMIN_ID', 'super_admin', true)
ON CONFLICT (user_id) DO NOTHING;
"

echo "Admin user created!"
echo "Email: $DUMMY_EMAIL"
echo "Password: password123"
