# 📘 คู่มือ Deploy Trackivity v2 (Cloudflare Pages + Podman + Cloudflare Proxy)

**Tech Stack:** Debian/Ubuntu + Podman + Cockpit + Cloudflare (Pages + Proxy Flexible SSL)
**Backend:** Rust (Axum) บน VPS + Neon Postgres
**Frontend:** SvelteKit → deploy บน Cloudflare Pages (ใช้ `@sveltejs/adapter-cloudflare` ที่ตั้งค่าอยู่แล้ว)
**Goal:** Deploy แบบเรียบง่าย — ไม่ใช้ nginx, ไม่ใช้ Cloudflare Tunnel, ไม่ใช้ reverse proxy ใด ๆ

> **หมายเหตุ:** คู่มือนี้เขียนสำหรับ root user — คำสั่งทั้งหมดจึงไม่มี `sudo`

---

## 🗺 สถาปัตยกรรม

```
┌────────────┐          ┌──────────────────────────┐         ┌─────────────┐
│  Browser   │──HTTPS──▶│  Cloudflare              │         │             │
│            │          │  ┌──────────────────┐    │         │   Neon      │
└────────────┘          │  │ Pages (Frontend) │    │         │  Postgres   │
       │                │  └──────────────────┘    │         │             │
       │                │  ┌──────────────────┐    │         └──────▲──────┘
       │                │  │ Proxy (Backend)  │    │                │
       │                │  └────────┬─────────┘    │                │
       │                └───────────┼──────────────┘                │
       │                            │ HTTP plain                    │
       │                            ▼                               │
       │                   ┌──────────────────┐                     │
       └───────────────────│  VPS :80         │                     │
                           │  ▼               │                     │
                           │  Podman Backend  │─────────────────────┘
                           │  (Axum :3000)    │
                           └──────────────────┘
```

**Subdomain ที่จะใช้ (ตัวอย่าง):**
- Frontend: `trackivity.yourdomain.com` → Cloudflare Pages (หรือใช้ `xxx.pages.dev` เลยก็ได้)
- Backend: `api.trackivity.yourdomain.com` → Cloudflare proxy → VPS

---

## ✅ Checklist ก่อนเริ่ม

1. VPS ติดตั้ง Debian/Ubuntu แล้ว เข้า SSH เป็น root ได้
2. มี Neon Postgres project พร้อม DATABASE_URL
3. มี Cloudflare account + domain ผูกไว้ (free plan พอ — Pages + Proxy + DNS ใช้รวมในที่เดียว)
4. Rotate secrets ใน `backend/.env` ทั้งหมด (JWT/DB/VAPID ถูก commit ขึ้น git → ยังใช้ไม่ได้)

---

# 🟦 PART A — Deploy Frontend บน Cloudflare Pages

## 📌 STEP A1 — ตรวจสอบ Adapter

`frontend/svelte.config.js` ตั้ง `@sveltejs/adapter-cloudflare` อยู่แล้ว — ไม่ต้องแก้ พร้อม deploy บน Cloudflare Pages/Workers ได้ทันที

```js
// frontend/svelte.config.js (ของเดิม, ไม่ต้องแก้)
import adapter from '@sveltejs/adapter-cloudflare';
```

> **ลบ `frontend/vercel.json` ทิ้งได้** ถ้าไม่คิดจะกลับไปใช้ Vercel (ปล่อยไว้ก็ไม่มีผล แต่สร้างความสับสน)

## 📌 STEP A2 — สร้าง Pages Project

1. Push branch ล่าสุดขึ้น GitHub
2. เข้า [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git**
3. เลือก repo `trackivity-v2` → **Begin setup**
4. ตั้งค่า Build:
   | ช่อง | ค่า |
   |---|---|
   | **Project name** | `trackivity` |
   | **Production branch** | `main` |
   | **Framework preset** | `SvelteKit` |
   | **Build command** | `npm run build` |
   | **Build output directory** | `.svelte-kit/cloudflare` |
   | **Root directory** | `frontend` |

5. **Environment variables (Production):**
   ```
   PUBLIC_API_URL = https://api.trackivity.yourdomain.com
   NODE_VERSION = 20
   ```

6. **Save and Deploy** — รอประมาณ 2-3 นาที จะได้ URL `trackivity-xxx.pages.dev`

## 📌 STEP A3 — ตั้ง Custom Domain (ถ้าต้องการ)

ใน Pages project → **Custom domains → Set up a custom domain** → ใส่ `trackivity.yourdomain.com`

เพราะโดเมนอยู่ใน Cloudflare account เดียวกันอยู่แล้ว ระบบจะ:
- สร้าง CNAME ให้อัตโนมัติ (proxy orange cloud)
- ออก TLS cert ให้เอง
- ไม่ต้องทำอะไรเพิ่ม ใช้ได้เลย

---

# 🟨 PART B — Deploy Backend บน VPS

## 📌 STEP B1 — อัปเดตระบบ & ติดตั้ง Tools

SSH เข้า VPS:
```bash
apt update && apt upgrade -y
apt install -y podman podman-compose cockpit cockpit-podman curl ufw
systemctl enable --now cockpit.socket
```

## 📌 STEP B2 — สร้างโครงสร้างโฟลเดอร์

```bash
mkdir -p /opt/trackivity
cd /opt/trackivity
```

## 📌 STEP B3 — สร้างไฟล์ `.env`

```bash
nano /opt/trackivity/.env
```

```env
# ── Database (Neon) ──────────────────────────────
DATABASE_URL=postgresql://USER:PASS@HOST.neon.tech/trackivity?sslmode=require&channel_binding=require

# ── Auth ─────────────────────────────────────────
# สุ่มด้วย: openssl rand -base64 48
JWT_SECRET=<อย่างน้อย 32 ตัว>

# ── CORS ─────────────────────────────────────────
# backend/src/main.rs:60 จะอ่านค่านี้เป็น whitelist
# คั่นด้วย , ถ้ามีหลายโดเมน (เช่น preview URL ของ Vercel)
FRONTEND_URL=https://trackivity.yourdomain.com,https://trackivity-tru.vercel.app

# ── Web Push (VAPID) ─────────────────────────────
VAPID_PUBLIC_KEY=<...>
VAPID_PRIVATE_KEY=<...>
VAPID_SUBJECT=mailto:admin@trackivity.yourdomain.com

# ── Email (forgot-password) ──────────────────────
RESEND_API_KEY=<...>

# ── Logging ──────────────────────────────────────
RUST_LOG=info
```

```bash
chmod 600 /opt/trackivity/.env
```

> ⚠️ `backend/.env` ในโปรเจกต์ถูก commit ขึ้น git พร้อม secret จริง — **rotate ทั้งหมดก่อน** แล้วเพิ่ม `backend/.env` ลง `.gitignore`

## 📌 STEP B4 — สร้าง `compose.yml`

```bash
nano /opt/trackivity/compose.yml
```

```yaml
services:
  backend:
    image: ghcr.io/akephisit/trackivity-backend:latest
    container_name: trackivity-backend
    restart: unless-stopped
    ports:
      # map VPS:80 → container:3000
      # Cloudflare จะเชื่อมมาที่ port 80
      - "80:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
      - VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
      - VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
      - VAPID_SUBJECT=${VAPID_SUBJECT}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - RUST_LOG=${RUST_LOG:-info}
```

> ไฟล์ `podman-compose.yml` เดิมที่ root ของ repo ก็ใช้ pattern เดียวกัน (map 80:3000) — คู่มือนี้แค่ย้ายมาอยู่ที่ `/opt/trackivity/compose.yml` เพื่อความเป็นระเบียบบน VPS

## 📌 STEP B5 — อนุญาต Podman ใช้ port 80

Linux ปกติห้ามผู้ใช้ทั่วไปเปิด port ต่ำกว่า 1024 — เปิดให้:

```bash
echo 'net.ipv4.ip_unprivileged_port_start=80' >> /etc/sysctl.conf
sysctl -p
```

## 📌 STEP B6 — รัน Backend

```bash
cd /opt/trackivity
podman-compose up -d
podman ps
podman logs -f trackivity-backend
```

ควรเห็น:
```
✅ Connected to database successfully!
✅ Migrations executed successfully!
🚀 Listening on 0.0.0.0:3000
```

ทดสอบ local:
```bash
curl http://localhost:80/
# → "Trackivity Backend is running! 🚀"
```

---

# 🟧 PART C — ตั้งค่า Cloudflare

## 📌 STEP C1 — DNS Record

Cloudflare Dashboard → Domain `yourdomain.com` → **DNS → Records**

เพิ่ม A record:
- Type: `A`
- Name: `api.trackivity`
- IPv4: `<IP-VPS>`
- **Proxy: ON (เมฆสีส้ม)** ← สำคัญ!

## 📌 STEP C2 — SSL/TLS Mode

Dashboard → **SSL/TLS → Overview** → เลือก **Flexible**

- Browser ↔ Cloudflare = HTTPS (Cloudflare cert ฟรี)
- Cloudflare ↔ VPS = HTTP plain (port 80)

## 📌 STEP C3 — บังคับ HTTPS + HSTS

Dashboard → **SSL/TLS → Edge Certificates** → เปิด:
- ✅ **Always Use HTTPS** — redirect HTTP → HTTPS อัตโนมัติ
- ✅ **Automatic HTTPS Rewrites**
- ✅ **HSTS** (optional — ใช้เมื่อโดเมนเสถียรแล้ว)

## 📌 STEP C4 — ทดสอบจากภายนอก

```bash
curl https://api.trackivity.yourdomain.com/
# → "Trackivity Backend is running! 🚀"

curl -I https://api.trackivity.yourdomain.com/
# → server: cloudflare
```

---

# 🟩 PART D — จัดการหลัง Deploy

## 📌 STEP D1 — Cockpit UI

เปิด `https://<VPS-IP>:9090` → login ด้วย root → เมนู **Podman Containers**
ดู log / CPU / RAM / restart ได้จาก browser

> **⚠️ ปัญหา Login Cockpit ไม่ได้?**
> โดยปกติ Cockpit จะไม่อนุญาตให้ `root` ล็อกอินเพื่อความปลอดภัย
>
> **วิธีแก้ (อนุญาตให้ root เข้าใช้งาน):**
> 1. แก้ไขไฟล์ `disallowed-users`:
>    ```bash
>    nano /etc/cockpit/disallowed-users
>    ```
> 2. ลบบรรทัดที่มีคำว่า `root` ออก แล้วบันทึกไฟล์ (Ctrl+O → Enter → Ctrl+X)
> 3. จากนั้นสั่ง restart cockpit:
>    ```bash
>    systemctl restart cockpit
>    ```
> 4. ลอง login ใหม่อีกครั้งด้วย user `root` และรหัสผ่านที่ตั้งไว้

## 📌 STEP D2 — Seed Super Admin (ครั้งแรก)

```bash
apt install -y postgresql-client uuid-runtime
cd ~/github/trackivity-v2/backend   # หรือ clone repo มาที่ VPS
bash seed_admin.sh
```

> ⚠️ Default password ใน `seed_admin.sh` คือ `password123` — **เปลี่ยนทันทีหลัง login ครั้งแรก**

## 📌 STEP D3 — อัปเดต Backend เมื่อมีเวอร์ชันใหม่

```bash
cd /opt/trackivity
podman-compose pull
podman-compose up -d
podman image prune -f
```

## 📌 STEP D4 — Frontend (Cloudflare Pages) อัปเดตอัตโนมัติ

ทุกครั้งที่ push ขึ้น branch `main` บน GitHub → Cloudflare Pages build + deploy อัตโนมัติ
(Preview deployments สำหรับ branch อื่นก็ได้ URL แยกให้ทดสอบก่อน merge)

## 📌 STEP D5 — Monitoring

- **Cloudflare Dashboard**
  - **Analytics** → traffic, bot hits, cache ratio (ทั้ง Pages + Proxy)
  - **Pages → Deployments** → build log + rollback ได้ทุกเวอร์ชัน
- **Cockpit** → VPS metrics
- **Neon Dashboard** → DB connections, storage

---

## 🔒 Security Checklist

- [ ] Rotate secrets ทั้งหมดใน `backend/.env` (JWT, DB, VAPID)
- [ ] เพิ่ม `backend/.env` ลง `.gitignore`
- [ ] เปลี่ยนรหัสผ่าน super admin หลัง login ครั้งแรก
- [ ] Cloudflare → Always Use HTTPS = ON
- [ ] Cloudflare → Bot Fight Mode = ON (ตั้งใน Security menu)
- [ ] Cloudflare → SSL/TLS → Edge Certificates → Minimum TLS Version = 1.2
- [ ] (แนะนำถ้าทำได้) ตั้ง ufw allow port 80 เฉพาะ IP range ของ Cloudflare
  เพื่อกันไม่ให้คน bypass Cloudflare ด้วยการยิงตรงมาที่ VPS IP
  ดู IP list ล่าสุดที่ https://www.cloudflare.com/ips

---

## 🤔 ทำไมเลือกแบบนี้

| ประเด็น | ทางที่เลือก | เหตุผล |
|---|---|---|
| Frontend hosting | Cloudflare Pages | Free, CDN ทั่วโลก, build/deploy อัตโนมัติ, ใช้ adapter-cloudflare ที่ตั้งค่าอยู่แล้ว |
| Backend hosting | VPS + Podman | ควบคุมเอง, ใช้ image มีอยู่แล้ว (`ghcr.io/akephisit/trackivity-backend`) |
| Reverse proxy | **ไม่ใช้** | Backend ตัวเดียวบน VPS — ไม่มีปัญหา multiplex port 443 |
| TLS | Cloudflare Flexible | ไม่ต้อง cert บน origin, ไม่ต้อง certbot, CF จัดการทั้งหมด |
| CORS | Rust backend (`main.rs:60`) | Whitelist ผ่าน `FRONTEND_URL` env — ที่เดียวจบ |
| Cross-service auth | JWT cookie + CORS credentials | Same registrable domain (`*.yourdomain.com`) → cookie ส่งข้าม subdomain ได้ |

## ⚠ ข้อจำกัดของ Flexible SSL

Traffic จาก Cloudflare ไป VPS เป็น **HTTP plain** บนอินเทอร์เน็ต — ไม่ใช่ end-to-end encryption

**กรณีที่ควร upgrade เป็น Full (strict):**
- เก็บข้อมูลอ่อนไหวมาก (PII, การเงิน)
- ต้องผ่าน compliance (PCI DSS, HIPAA)

**วิธี upgrade (เมื่อพร้อม):**
1. Generate Cloudflare Origin Certificate (15 ปี ฟรี) ใน Dashboard → SSL/TLS → Origin Server
2. เพิ่ม TLS support ใน Axum (ใช้ `axum-server` + `rustls` โหลด cert)
3. เปลี่ยน port mapping เป็น `443:3000`
4. เปลี่ยน SSL mode เป็น **Full (strict)**

---

✅ **เสร็จสมบูรณ์!** Frontend เสิร์ฟจาก Cloudflare Pages edge, Backend อยู่หลัง Cloudflare proxy บน VPS — ไม่มี nginx, ไม่มี tunnel, ไม่มี certbot, ไม่มี reverse proxy
