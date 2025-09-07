# Legacy Compatibility Guide

## ระดับความเข้ากันได้

### ✅ Fully Compatible (ไม่ต้องเปลี่ยนอะไร)
- การแสดงผลข้อมูลเดิม
- API endpoints เก่า
- Frontend components เก่า

### ⚠️ Migration Required (ต้อง migrate database)
- Schema changes (new columns)
- Index improvements
- Enum additions

### ❌ Breaking Changes (ต้องใช้ features ใหม่)
- Full-text search queries
- New database functions
- Soft delete filtering

## การ Deploy Safely

### 1. ตรวจสอบ Database Schema
```bash
# ตรวจสอบว่ามี columns ใหม่หรือยัง
psql -d trackivity -c "\d users" | grep deleted_at
psql -d trackivity -c "\d activities" | grep participant_count
```

### 2. Gradual Migration Plan
```bash
# Step 1: Schema migration (safe)
bun run db:migrate

# Step 2: Deploy server code (compatible)
# - Server จะส่งทั้งข้อมูลเก่าและใหม่
# - Frontend เก่าใช้ field เก่าได้ปกติ

# Step 3: Optional performance functions
psql -d trackivity -f database/partitioning.sql

# Step 4: Update frontend (optional)
# - Frontend ใหม่จะใช้ features เพิ่มเติม
```

### 3. Rollback Strategy
```bash
# ถ้ามีปัญหาสามารถ rollback server code ได้
# Database schema ไม่ต้อง rollback เพราะ backward compatible

# เอา new columns ออก (ถ้าจำเป็น)
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE activities DROP COLUMN IF EXISTS participant_count;
```

## Conditional Feature Detection

สามารถเพิ่ม feature detection ใน server:

```typescript
// ตรวจสอบว่ามี column ใหม่หรือไม่
async function hasDeletedAtColumn() {
    try {
        await db.execute(sql`SELECT deleted_at FROM users LIMIT 1`);
        return true;
    } catch {
        return false;
    }
}

// ใช้ conditional query
const baseConditions = [];
if (await hasDeletedAtColumn()) {
    baseConditions.push(sql`${users.deletedAt} IS NULL`);
}
```

## Production Deployment Checklist

- [ ] Backup database before migration
- [ ] Test migration on staging environment  
- [ ] Run `bun run db:migrate` on production
- [ ] Deploy server code
- [ ] Monitor for errors
- [ ] Optionally install performance functions
- [ ] Update frontend when ready

## Troubleshooting

### Error: column "deleted_at" does not exist
```bash
# รัน migration
bun run db:migrate
```

### Error: function "search_users" does not exist  
```bash
# รัน performance functions (optional)
psql -d trackivity -f database/partitioning.sql
```

### Old frontend not showing new data
```typescript
// ตรวจสอบว่า server ส่งข้อมูลทั้งแบบเก่าและใหม่
{
    name: activity.title,           // Legacy
    activity_name: activity.title,  // New
    participantCount: count,        // Legacy camelCase  
    participant_count: count        // New snake_case
}
```