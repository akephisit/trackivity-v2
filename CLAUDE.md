# CLAUDE.md

ไฟล์นี้เป็นแนวทางสำหรับ Claude Code (claude.ai/code) เวลาทำงานใน repository นี้

## กฎเรื่องโครงสร้าง repo

- Repo นี้เป็น monorepo สองบริการ — ไม่มี package manager ที่ระดับ root ห้ามรัน `npm`/`cargo` จาก root ของ repo
- งาน backend ทำใน `backend/` (Rust + Axum + SQLx, Neon Postgres, deploy ผ่าน Podman)
- งาน frontend ทำใน `frontend/` (SvelteKit 2 / Svelte 5, deploy บน Cloudflare Pages)
- `podman-compose.yml` และ `deploy-podman.md` ใช้สำหรับ **deploy backend เท่านั้น** ห้ามเอา frontend มาใส่ใน compose stack
- ไฟล์นี้คือแหล่งคำแนะนำเดียว ไม่มี `CLAUDE.md` แยกใน `frontend/` หรือ `backend/` อีกแล้ว ห้ามสร้างไฟล์แนวทางซ้อนกัน — ถ้ามีกฎใหม่ มาเพิ่มที่นี่

## กฎฝั่ง Backend (`cd backend`)

- รัน dev server ด้วย `cargo run` — bind ที่ `:3000` และรัน migration ตอน startup เอง ไม่มีคำสั่ง migrate แยก
- ตรวจ type ด้วย `cargo check` ก่อนบอกว่างานเสร็จ ไม่มี test suite
- หลังแก้ `sqlx::query!()` / `query_as!()` **ทุกครั้ง** ต้องรัน `cargo sqlx prepare` โดยตั้ง `DATABASE_URL` ไว้ แล้ว commit `.sqlx/` ที่อัปเดตด้วย CI build แบบ offline ถ้าข้ามขั้นนี้จะ build ไม่ผ่าน
- เพิ่ม migration เป็นไฟล์ใหม่ใน `backend/migrations/` ตั้งชื่อ `YYYYMMDDhhmmss_<name>.sql` ห้ามแก้ migration ที่ apply ลง environment ไหนแล้ว
- เพิ่ม route ใหม่ที่ `backend/src/main.rs` แต่ละ feature เป็น module ภายใต้ `src/modules/<name>/{handlers,models,mod}.rs` — ทำตามรูปแบบนี้ ห้าม flatten หรือย้ายที่
- Auth: ใช้ **cookie เป็นหลัก** สำหรับ web client (httpOnly, `SameSite=None; Secure` เพราะ frontend/backend อยู่คนละ origin) ส่วน header `Authorization: Bearer …` เก็บไว้รองรับ client ที่ไม่ใช่ browser (mobile app, integration ภายนอก, debug ด้วย curl/Postman) เท่านั้น ดึงค่าผ่าน `auth::handlers::get_claims_from_headers` ห้ามเขียน extractor ที่สอง
- การเช็ค permission อยู่ใน handler ไม่ใช่ middleware ให้เช็ค admin level (`super_admin` / `organization_admin` / `regular_admin`) ภายใน handler ที่ต้องการ
- **Config ของ Neon ใน `main.rs` สำคัญมาก ห้ามลบหรือ "ทำให้เรียบง่าย":**
  - `PgConnectOptions::statement_cache_capacity(0)` — จำเป็นเพราะใช้ pooler ของ Neon (`-pooler.neon.tech`) ถ้าลบจะเจอ error "prepared statement does not exist"
  - `min_connections(0)` + `idle_timeout` สั้น ๆ — เพื่อให้ Neon auto-suspend ได้
  - retry 5 ครั้งตอน startup — กันไม่ให้ crash-loop ตอน Neon cold-start
- Healthcheck จากภายนอก (Cockpit / Cloudflare) ต้องชี้ไปที่ `/health` (ping DB ด้วย `SELECT 1`) ห้ามใช้ `/` (เป็น string คงที่ไม่ได้ตรวจ DB)
- การ seed super-admin คนแรกใช้ `SEED_ADMIN_PASSWORD=… bash seed_admin.sh` ต้องมี `psql` และ `python3` ที่ติดตั้ง `argon2-cffi`

## กฎฝั่ง Frontend (`cd frontend`, Node ≥ 20.19)

- ใช้ Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`) ห้ามใช้ Svelte 4 reactive syntax (`$:`)
- การเรียก backend ทุกที่ต้องผ่าน `request()` ใน `src/lib/api.ts` ห้ามเรียก `fetch` ตรงไป backend จาก component หรือ route
- Base URL ของ backend มาจาก `PUBLIC_BACKEND_URL` ห้าม hardcode `http://localhost:3000` หรือ URL ของ production
- request ข้าม origin ทุกตัวต้องคง `credentials: 'include'` — เป็นเส้นทางของ cookie auth
- ถือว่า auth เป็นแบบ **client-side เท่านั้น** `src/hooks.server.ts` ไม่ได้โหลด user ห้ามเพิ่ม auth check ฝั่ง server ตรงนั้น ให้ guard route ผ่าน pattern layout/store ที่มีอยู่แล้ว
- แยก route ตามกลุ่มผู้ใช้: หน้า admin อยู่ใต้ `src/routes/admin/*` หน้านักศึกษาอยู่ใต้ `src/routes/student/*` แยกออกจากกันชัดเจน ห้ามใช้ layout ร่วมกันข้ามขอบเขตนี้
- รัน `npm run check` หลังแก้อะไรที่ไม่เล็กน้อย และรัน `npm run lint` ก่อน commit ไม่มี test runner
- Build output สำหรับ Cloudflare Pages คือ `.svelte-kit/cloudflare` ห้ามเปลี่ยน adapter

## กฎเรื่องภาษาและเนื้อหา

- ข้อความ UI ที่ผู้ใช้เห็น และ comment ที่อธิบาย domain: **ภาษาไทย**
- ชื่อตัวแปร/ฟังก์ชัน, comment ทางเทคนิค, ข้อความ commit: **ภาษาอังกฤษ**
- คำศัพท์ในระบบ: หน่วยงาน = organization, คณะ = faculty (มี department), สำนักงาน = office (ไม่มี department), กิจกรรม = activity, นักศึกษา = student

## กฎเรื่อง secret และการ deploy

- ค่าที่อยู่ใน `backend/.env` และ `frontend/.env` ตอนนี้เคยถูก commit ขึ้น git ไปแล้ว — ถือว่าหลุดทั้งหมด ต้อง rotate ก่อนนำไปใช้ใน environment ใหม่
- ห้าม commit secret ใหม่ ไฟล์ `.env*` (ยกเว้น `.env.example`/`.env.test`) อยู่ใน gitignore — รักษาให้เป็นแบบนี้ไว้
- Image ของ backend ที่ deploy คือ `ghcr.io/akephisit/trackivity-backend:latest` build จาก `backend/Dockerfile` (cargo-chef, multi-stage) ห้าม ship โดยข้าม Dockerfile
