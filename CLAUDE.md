# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## Project Overview

**SIAKAD MBS Poncowati** — a school academic information system (Sistem Informasi
Akademik) for **SMP & SMA MBS Poncowati**, an Islamic boarding school (pondok
pesantren). It combines conventional school administration with pesantren-specific
management: teaching journals (jurnal mengajar), Quran memorization (tahfidz), and
dormitory room assignment (kamar asrama).

The UI and all domain terminology are in **Indonesian**. Keep new user-facing
strings, comments, flash messages, and identifiers consistent with the existing
Indonesian conventions (e.g. `siswa` = student/santri, `guru` = teacher, `musyrif`
= dorm supervisor, `kelas` = class, `asrama` = dormitory, `kamar` = room,
`jurnal` = teaching journal, `presensi` = staff attendance, `absensi` = student
attendance, `pendaftar` = registrant/PSB applicant, `berita` = news).

## Tech Stack

- **Node.js** (>= 18) with **Express 4** — CommonJS modules (`require`, not ESM).
- **better-sqlite3** — synchronous SQLite driver; no separate DB server. Prepared
  statements are used everywhere (`db.prepare(...).get/all/run(...)`).
- **EJS** — server-side HTML templating.
- **express-session** — cookie session auth (in-memory store; no persistence).
- **bcryptjs** — password hashing.
- **method-override** — enables `PUT`/`DELETE` from HTML forms via `?_method=PUT`.
- **qrcode** + **jsqr** — QR generation for student cards and browser-side QR scanning.

There is **no build step, no TypeScript, no test framework, and no linter** configured.
The app is plain JavaScript served directly by `node server.js`.

## Commands

```bash
npm install      # install dependencies
npm run seed     # (optional) explicitly run seeding — data is also seeded on first start
npm start        # run server on http://localhost:3000 (or $PORT)
npm run dev      # run with node --watch for auto-restart on file changes
```

There are no lint/test/typecheck commands. To verify a change, run `npm start`
(or `npm run dev`) and exercise the affected routes in the browser.

## Architecture

Request flow: `server.js` wires middleware and mounts one router per feature module
from `src/routes/`. Each router owns its URL prefix, queries `src/db.js` directly with
prepared statements, and renders an EJS view from `views/`.

```
server.js              # Express entry point: middleware, session, route mounting, error handlers
src/
  db.js                # SQLite connection + full schema (migrate()) — single source of truth for tables
  seed.js              # idempotent seed data (users, guru, kelas, siswa, berita, jadwal, lokasi presensi)
  middleware/auth.js   # requireLogin, requireRole(...roles), and the `staff` role array
  routes/              # one file per feature; each exports an express.Router()
views/                 # EJS templates, grouped by feature (views/<feature>/<action>.ejs)
  partials/            # shared admin-panel chrome: header.ejs (sidebar+topbar), footer.ejs, exportbar.ejs
  public/              # public-facing site (landing, berita, PSB) with its own partials/
public/
  css/                 # style.css (admin panel), landing.css (public site)
  js/jsqr.js           # vendored QR-decoding library for the scan station
Dockerfile             # Cloud Run image (writes DB to /tmp/data, PORT 8080)
render.yaml            # Render.com deployment (generates SESSION_SECRET)
```

### Route modules (`src/routes/`)

| Prefix           | File           | Purpose |
|------------------|----------------|---------|
| `/` (public)     | `public.js`    | Landing page, public news, PSB registration form + status check |
| `/` (auth)       | `auth.js`      | Login / logout |
| `/dashboard`     | `dashboard.js` | Stats, recent activity, occupancy, 7-day attendance chart |
| `/pendaftar`     | `pendaftar.js` | Admin management of PSB applicants (accept → creates siswa) |
| `/kelola-berita` | `berita.js`    | Admin CRUD for public news |
| `/siswa`         | `siswa.js`     | Student/santri CRUD + detail (with tahfidz history) |
| `/guru`          | `guru.js`      | Teacher & musyrif data |
| `/kelas`         | `kelas.js`     | Classes / rombel |
| `/mapel`         | `mapel.js`     | Subjects (Umum / Kepesantrenan) |
| `/asrama`, `/kamar` | `asrama.js`, `kamar.js` | Dormitories, rooms, and room placement with gender+capacity validation |
| `/presensi`      | `presensi.js`  | Staff geolocation+selfie clock-in/out (haversine radius check) |
| `/absensi`       | `absensi.js`   | Daily student attendance + recap |
| `/jurnal`        | `jurnal.js`    | Teaching journals |
| `/tahfidz`       | `tahfidz.js`   | Ziyadah/Murojaah memorization entries + recap |
| `/jadwal`        | `jadwal.js`    | Class timetables |
| `/kartu`, `/scan`| `kartu.js`, `scan.js` | Student QR/RFID cards; scan station writes attendance |
| `/ekspor`, `/impor` | `ekspor.js`, `impor.js` | CSV/print export of datasets; CSV import of siswa/guru |
| `/users`         | `users.js`     | Account management (create, reset password, activate/deactivate) |

## Data Model

All tables are defined in `src/db.js`'s `migrate()`, run on every startup
(`CREATE TABLE IF NOT EXISTS`). Key points:

- **`users`** authenticate; `role` is one of `admin`, `guru`, `musyrif`, `siswa`
  (enforced by a `CHECK` constraint). `ref_id` links a user to its domain row —
  a `guru`/`musyrif` user's `ref_id` points at `guru.id`, a `siswa` user's at
  `siswa.id`. This link drives per-role data scoping (see below).
- Core domain tables: `guru`, `kelas`, `mapel`, `siswa`, `asrama`, `kamar`,
  `jurnal`, `tahfidz`, `jadwal`, `absensi` (student), `presensi` (staff),
  `pendaftar` (PSB), `berita`, `lokasi_presensi`, `tahun_ajaran`.
- Gender is stored as `'L'`/`'P'` on people; dormitories use `'Putra'`/`'Putri'`.
- Timestamps use SQLite `datetime('now','localtime')` and are stored as TEXT.
- WAL mode and `foreign_keys = ON` are enabled.
- **Additive migrations** for existing databases use the `tryExec(...)` helper
  (wraps `ALTER TABLE ... ADD COLUMN` in a try/catch that ignores "column exists").
  When adding a column to an existing table, follow this pattern — do not assume a
  fresh DB.

The SQLite file lives at `${DATA_DIR}/siakad.db` (default `src/data/`, overridable
via the `DATA_DIR` env var). `data/` is gitignored, so the database is never committed.

## Conventions & Patterns

Follow the existing style closely — the codebase is small and highly consistent.

- **Router file shape**: `require` express + `../db` + auth middleware → create
  `const router = express.Router()` → often a local
  `const flash = (req, type, msg) => { req.session.flash = { type, msg }; };`
  helper → route handlers → `module.exports = router;`.
- **Flash messages**: set `req.session.flash = { type, msg }` (types `'success'` /
  `'error'`), then redirect. The global middleware in `server.js` exposes it once as
  `res.locals.flash` and deletes it (one-shot). `header.ejs` renders it.
- **CRUD + method-override**: forms POST to the collection; edit/delete use hidden
  `_method` (`action="/siswa/:id?_method=PUT"`, `?_method=DELETE`). A shared
  `payload(body)` / `data(body)` helper builds the parameter array for both
  INSERT and UPDATE so the two stay in sync.
- **Always use prepared statements** with `?` placeholders — never string-interpolate
  user input into SQL. Dynamic filters are built by appending `AND col = ?` and
  pushing onto a `params` array (see `siswa.js`, `jurnal.js`, `tahfidz.js`).
- **Input normalization**: trim required strings (`b.nama.trim()`), coerce optionals
  to `null` (`b.nis || null`), and parse numbers with `parseInt(x, 10) || null`.
- **View render contract**: handlers pass a `title`, the data, and often a
  `filter` object (echoing query params back to the form) and a `canManage`
  boolean (`staff.includes(user.role)`) so templates can hide edit controls.

### Authorization & data scoping

- Every authenticated route group is mounted behind `requireLogin` in `server.js`.
- `requireRole(...roles)` guards write actions inside handlers; it renders a 403
  `error` view for logged-in users lacking the role.
- `staff = ['admin', 'guru', 'musyrif']` (from `middleware/auth.js`) is the common
  "can manage" set; `siswa` is read-only and scoped to their own data.
- **Per-role query scoping** is done in the handler, keyed off `user.role` and
  `user.ref_id`: e.g. a `siswa` only sees their own `tahfidz` rows; a `guru`/`musyrif`
  only sees their own `jurnal`; `admin` sees everything. Preserve this pattern when
  adding list endpoints — check `req.session.user.role`/`ref_id` before returning data.
- Some routers apply a blanket `router.use(requireRole('admin','guru','musyrif'))`
  or `router.use(requireRole('admin'))` at the top (e.g. `presensi.js`, `kartu.js`,
  `scan.js`, `impor.js`).

### Views

- Admin pages start with `<%- include('../partials/header') %>` and end with
  `include('../partials/footer')`; the sidebar/topbar and nav-active logic live in
  `header.ejs` and are driven by `currentUser.role` and `path`.
- Public pages use `views/public/partials/head.ejs` + `foot.ejs` instead.
- `currentUser`, `path`, and `flash` are always available as `res.locals`
  (set in `server.js`).

## Domain Rules to Preserve

These business rules are implemented in handlers and are easy to break:

- **Room placement** (`kamar.js`): a santri can only be placed in a room whose
  dormitory `gender` matches the santri's `jk`, and only if current occupancy
  (`status='Aktif'`) is below `kapasitas`.
- **Staff attendance** (`presensi.js`): clock-in/out requires a GPS fix within an
  active location's `radius_m` (haversine distance) **and** a base64 selfie
  (`data:image/...`). One `presensi` row per `(user_id, tanggal)`; late after
  `07:30` is marked `Terlambat`. Selfie photos are stored inline as base64 in the
  DB and served back via `/presensi/foto/:id/:jenis` (owner-or-admin only).
- **Scan station** (`scan.js`): `POST /scan/api` looks a student up by `kartu_id`
  or `nis`, then writes one `absensi` row per `(tanggal, siswa_id)` with
  keterangan `'Scan kartu'`. Returns JSON — it's called via fetch from the browser.
- **PSB flow** (`public.js` → `pendaftar.js`): public applicants get a generated
  `no_reg` (`PSB<year><seq>`); an admin accepting a pendaftar creates a `siswa`.
- The large `express.urlencoded` limit (`8mb`) in `server.js` exists to accept
  base64 selfie uploads — don't lower it.

## Environment & Deployment

- **`PORT`** — server port (default 3000; Cloud Run/Render inject their own).
- **`SESSION_SECRET`** — set in production (falls back to a hardcoded dev default).
  `render.yaml` auto-generates one.
- **`DATA_DIR`** — where `siakad.db` is written (default `src/data/`). The Dockerfile
  sets it to `/tmp/data` because Cloud Run's filesystem is read-only except `/tmp`.
- **`NODE_ENV=production`** — hides raw error messages in the 500 handler.
- Deploy targets: **Docker/Cloud Run** (`Dockerfile`, needs build tools for the
  native `better-sqlite3` module) and **Render.com** (`render.yaml`).

> Note: SQLite on an ephemeral filesystem (Cloud Run `/tmp`, Render free tier) is
> **not durable** — data resets when the instance recycles. Fine for demo, not for
> real production without a persistent volume.

## Security Notes

- The seeded demo accounts (`admin/admin123`, `guru/guru123`, `musyrif/musyrif123`,
  `siswa/siswa123`) are for development only. Do not treat them as safe for
  production; change all passwords and set `SESSION_SECRET`.
- Seeding is **idempotent** — each `seed*()` function checks `COUNT(*) > 0` and
  skips if data already exists, so it's safe to run repeatedly.

## When Making Changes

- Adding a feature usually means: extend the schema in `db.js` (with a `tryExec`
  additive migration if the table exists), add a router in `src/routes/`, mount it
  in `server.js` behind `requireLogin`, add EJS views under `views/<feature>/`, and
  add a sidebar link (with role gating) in `views/partials/header.ejs`.
- Match the surrounding code's Indonesian naming, prepared-statement style, flash +
  redirect pattern, and role-scoping conventions.
- Keep the README's feature list and demo-account table in sync if user-facing
  behavior changes.
- Commit work on the designated feature branch and push there; do not open a PR
  unless explicitly asked.
</content>
</invoke>
