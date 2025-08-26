# Database Scripts

## Create Super Admin

Script สำหรับสร้าง super admin user สำหรับการเริ่มต้น production ใหม่

### การใช้งาน

```bash
npm run create-super-admin <studentId> <email> <password> <firstName> <lastName>
```

### ตัวอย่าง

```bash
npm run create-super-admin SA001 admin@university.ac.th MySecurePassword123! Admin User
```

### ข้อมูลที่จำเป็น

- **studentId**: รหัสนักเรียน/รหัสผู้ดูแลระบบ (เช่น SA001)
- **email**: อีเมลสำหรับเข้าสู่ระบบ
- **password**: รหัสผ่าน (ต้องมีความยาวอย่างน้อย 8 ตัวอักษร)
- **firstName**: ชื่อจริง
- **lastName**: นามสกุล

### คำเตือน

- ❗ **สำคัญ**: เปลี่ยนรหัสผ่านหลังจากเข้าสู่ระบบครั้งแรก
- Script จะตรวจสอบว่าอีเมลหรือรหัสนักเรียนไม่ซ้ำกับที่มีอยู่แล้ว
- Super admin จะมีสิทธิ์เข้าถึงทุกส่วนของระบบ (`permissions: ['*']`)

### สิทธิ์ Super Admin

- เข้าถึงและจัดการทุกส่วนของระบบ
- สร้าง/แก้ไข/ลบ Faculty Admin และ Regular Admin
- จัดการผู้ใช้ทั้งหมดในระบบ
- ดูรายงานและสถิติของระบบทั้งหมด
- จัดการกิจกรรมทุกประเภท