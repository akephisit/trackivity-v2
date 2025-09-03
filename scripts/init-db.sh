#!/bin/sh
set -e

echo "🗄️  Initializing database..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set. Set it in your service environment."
  exit 1
fi

MAX_RETRIES=${MAX_RETRIES:-30}
COUNT=0
until bunx drizzle-kit push --force; do
  COUNT=$((COUNT+1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "❌ Failed to connect/apply schema after $MAX_RETRIES attempts."
    echo "   Check DATABASE_URL, network access, and SSL settings."
    exit 1
  fi
  echo "Database not ready, waiting 5 seconds..."
  sleep 5
done

echo "✅ Database schema created/updated successfully!"

# Create super admin if env vars are provided
echo "👤 Creating super admin user..."
  
bun run scripts/create-super-admin.ts \
  "SA001" \
  "sadmin@gmail.com" \
  "Phlslt2571@ke" \
  "Super" \
  "Admin"
    
echo "✅ Super admin created successfully!"


echo "🎉 Database initialization completed!"
