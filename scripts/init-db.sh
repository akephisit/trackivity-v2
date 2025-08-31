#!/bin/bash
set -e

echo "🗄️  Initializing database..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL server..."
until pg_isready -h 167.172.70.206 -p 5432 -U postgres 2>/dev/null; do
  echo "PostgreSQL not ready, waiting 5 seconds..."
  sleep 5
done

# Create database if it doesn't exist
echo "🏗️  Creating database if not exists..."
PGPASSWORD=Phlslt2571Ake psql -h 167.172.70.206 -p 5432 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'trackivity'" | grep -q 1 || PGPASSWORD=Phlslt2571Ake psql -h 167.172.70.206 -p 5432 -U postgres -c "CREATE DATABASE trackivity"

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
until bun run drizzle-kit push --force 2>/dev/null; do
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