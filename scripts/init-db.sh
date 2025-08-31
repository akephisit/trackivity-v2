#!/bin/bash
set -e

echo "🗄️  Initializing database..."

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