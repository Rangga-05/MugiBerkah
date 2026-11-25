# Sistem Manajemen Rantai Pasok Bahan Baku (SCM) — Kedai Kopi & Pastry "Mugi Berkah"

Prototipe aplikasi web **Supply Chain Management (SCM)** untuk **Kedai Kopi & Pastry "Mugi Berkah"** yang dirancang selaras dengan 4 Pilar **Enterprise Architecture (TOGAF)**:

1. **Arsitektur Bisnis:** Pemisahan peran **Admin Gudang/Purchasing** (`admin`) dan **Mitra Pemasok Eksternal** (`supplier`) dengan isolasi data pemasok serta *State Machine* Purchase Order (`PENDING` → `PROCESSING` → `SHIPPED` → `RECEIVED` / `CANCELLED`).
2. **Arsitektur Data:** 6 tabel relasional PostgreSQL di Supabase (`suppliers`, `users`, `raw_materials`, `purchase_orders`, `purchase_order_items`, `stock_movements`) dilengkapi fungsi RPC transaksi atomik `confirm_po_receipt(p_po_id, p_user_id)`.
3. **Arsitektur Aplikasi:** REST API modular (`/api/auth`, `/api/dashboard`, `/api/suppliers`, `/api/materials`, `/api/purchase-orders`, `/api/stock-movements`) dan antarmuka Single Page Application (SPA).
4. **Arsitektur Teknologi:** **Single-Server Architecture** berbasis **Bun**, **ElysiaJS (TypeScript)**, **Supabase PostgreSQL (Cloud)**, serta **HTML5 + Tailwind CSS + Lucide Icons + Vanilla JS** pada satu alamat `http://localhost:3000`.

---

## Ruang Lingkup Sistem (Strict SCM Guardrails)

* **In-Scope:**
  * Autentikasi multi-peran berbasis JWT (masa berlaku token **2 jam** + **auto-logout otomatis jika *idle* 30 menit**), lengkap dengan tombol **Isi Cepat Email/Password** dan **Akses Cepat Demo (1-Klik Login)**.
  * Dashboard KPI Pengadaan & Peringatan Stok Menipis (*Reorder Point Alert* saat `current_stock <= min_stock`) dengan tombol aksi cepat **Pesan Ulang (Buat PO)**.
  * Manajemen Master Pemasok (*Suppliers*) dan Master Bahan Baku (*Raw Materials*) kategori **Kopi**, **Dairy & Sirup**, dan **Bahan Pastry**.
  * Pencatatan Pemakaian Bahan Harian (*Stock Out*) oleh bar/dapur yang otomatis mengurangi stok dan mencatat audit log `OUT`.
  * Siklus *Purchase Order* (PO) lintas entitas serta **Penerimaan Barang Atomik (*Goods Receipt*)** via RPC PostgreSQL yang otomatis menambah stok gudang dan mencatat mutasi `IN`.
  * Riwayat Mutasi Stok (*Audit Log*) lengkap dengan filter dan fitur **Ekspor CSV**.
* **Out-of-Scope:** Tidak menyertakan modul Kasir/POS, pemesanan pelanggan, manajemen meja, resep menu, maupun HR/akuntansi agar tetap murni dalam domain **SCM**.

---

## Struktur Proyek

```text
scm-mugi-berkah/
├── .env.example              # Template variabel environment (file .env diabaikan oleh Git)
├── .gitignore                # Mengabaikan .env, node_modules, dll.
├── package.json              # Skrip: dev, start, typecheck
├── tsconfig.json
├── README.md
├── supabase/
│   ├── schema.sql            # DDL 6 tabel relasional + fungsi RPC confirm_po_receipt
│   └── seed.sql              # Data awal Kedai Kopi & Pastry Mugi Berkah
├── src/                      # Backend (ElysiaJS TypeScript)
│   ├── index.ts              # Entry point server & penyajian aset frontend
│   ├── config/
│   │   └── supabase.ts       # Inisialisasi Supabase client
│   ├── middleware/
│   │   └── auth.ts           # Verifikasi JWT (exp: 2h) & guard role
│   └── routes/
│       ├── auth.ts
│       ├── dashboard.ts
│       ├── suppliers.ts
│       ├── materials.ts
│       ├── purchaseOrders.ts
│       └── stockMovements.ts
└── public/                   # Frontend SPA (disajikan langsung oleh ElysiaJS)
    ├── index.html
    └── js/
        └── app.js
```

---

## Cara Menjalankan Aplikasi

### Prasyarat
* [Bun](https://bun.sh/) versi `>= 1.1`
* Akun & proyek [Supabase](https://supabase.com/) (database berjalan di cloud sehingga tidak perlu menjalankan PostgreSQL/XAMPP lokal)

### 1. Siapkan Database di Supabase
1. Buka proyek Anda di **Supabase Dashboard** → masuk ke menu **SQL Editor**.
2. Jalankan isi file [`supabase/schema.sql`](./supabase/schema.sql) untuk membuat 6 tabel relasional dan fungsi RPC `confirm_po_receipt`.
3. Jalankan isi file [`supabase/seed.sql`](./supabase/seed.sql) untuk mengisi data awal (3 pemasok, 4 akun demo, 9 bahan baku termasuk 3 item *Low Stock*, 3 contoh PO berbeda status, dan riwayat mutasi stok).

### 2. Konfigurasi File `.env`
Buat file `.env` di folder utama proyek (mengacu pada format di `.env.example`; file `.env` tidak di-upload ke GitHub demi keamanan kredensial) lalu isi kredensial dari **Supabase Dashboard → Project Settings → API**:

```env
SUPABASE_URL=https://<project-id-anda>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-anda>
JWT_SECRET=mugi-berkah-scm-togaf-secret-key-2026
PORT=3000
```

### 3. Instal Dependensi & Jalankan Server
```bash
bun install
bun run dev
```
Server backend sekaligus antarmuka frontend akan langsung aktif di **`http://localhost:3000`**.  
*(Gunakan `bun run start` jika ingin menjalankan server tanpa mode watch, atau `bun run typecheck` untuk memeriksa tipe TypeScript.)*

---

## Daftar Akun Demo

Seluruh akun demo menggunakan kata sandi seragam: **`mugiberkah123`**  
Di halaman login juga tersedia tombol **Isi Cepat** dan panel **Akses Cepat Demo (1-Klik Login)**.

| Peran (`role`) | Nama Pengguna | Email | Entitas / Mitra |
| :--- | :--- | :--- | :--- |
| **`admin`** | Rangga — Admin Gudang Mugi Berkah | `admin@mugiberkah.id` | Gudang & Purchasing Mugi Berkah |
| **`supplier`** | Hendri — PT Nusantara Roastery Bandung | `roastery@nusantara.id` | Pemasok **Kopi** (`supplier_id = 1`) |
| **`supplier`** | Siti — CV Lembang Dairy Fresh | `dairy@lembangfresh.id` | Pemasok **Dairy & Sirup** (`supplier_id = 2`) |
| **`supplier`** | Budi — UD Baker's Choice Pastry Supply | `pastry@bakerschoice.id` | Pemasok **Bahan Pastry** (`supplier_id = 3`) |

---

## Ringkasan Endpoint REST API

| Modul | Endpoint | Keterangan |
| :--- | :--- | :--- |
| **Health** | `GET /api/health` | Status server & koneksi konfigurasi Supabase |
| **Auth** | `GET /api/auth/demo-accounts`, `POST /api/auth/login`, `GET /api/auth/me` | Login JWT, profil aktif, & daftar akun demo |
| **Dashboard** | `GET /api/dashboard/summary` | KPI & *Low Stock Alert* (Admin) / ringkasan PO (Supplier) |
| **Suppliers** | `GET/POST /api/suppliers`, `PUT/DELETE /api/suppliers/:id` | CRUD Master Pemasok (mutasi khusus Admin) |
| **Materials** | `GET/POST /api/materials`, `PUT/DELETE /api/materials/:id`, `POST /api/materials/:id/usage` | CRUD Bahan Baku & pencatatan pemakaian harian (*Stock Out*) |
| **Purchase Orders** | `GET/POST /api/purchase-orders`, `PATCH /api/purchase-orders/:id/status`, `POST /api/purchase-orders/:id/receive` | Siklus PO lintas peran & penerimaan barang atomik via RPC |
| **Stock Movements** | `GET /api/stock-movements` | Audit log mutasi stok (`IN` / `OUT`) |
