# Sistem Manajemen Rantai Pasok Bahan Baku (SCM) — Kedai Kopi & Pastry "Mugi Berkah"

Aplikasi web prototipe **Supply Chain Management (SCM)** untuk **Kedai Kopi & Pastry "Mugi Berkah"** yang dirancang selaras dengan 4 Pilar **Enterprise Architecture (TOGAF)**:
1. **Arsitektur Bisnis:** Pemisahan hak akses multi-peran (*Admin Gudang/Purchasing* & *Mitra Pemasok Eksternal*) beserta *State Machine* Purchase Order (`PENDING` → `PROCESSING` → `SHIPPED` → `RECEIVED` / `CANCELLED`).
2. **Arsitektur Data:** 6 tabel relasional PostgreSQL di Supabase beserta fungsi RPC transaksi atomik `confirm_po_receipt(p_po_id, p_user_id)`.
3. **Arsitektur Aplikasi:** Modul REST API terstruktur (`/api/auth`, `/api/dashboard`, `/api/suppliers`, `/api/materials`, `/api/purchase-orders`, `/api/stock-movements`).
4. **Arsitektur Teknologi:** Single-server runtime berbasis **Bun**, **ElysiaJS (TypeScript)**, **Supabase PostgreSQL**, dan **HTML5 + Tailwind CSS + Vanilla JS**.

---

## Ruang Lingkup Sistem (Strict SCM Guardrails)
- **In-Scope:** Autentikasi multi-peran (`admin` & `supplier`), Dashboard KPI Pengadaan & *Reorder Point Alert* (*Low Stock*), Master Pemasok, Master Bahan Baku (*Kopi*, *Dairy & Sirup*, *Bahan Pastry*), Pencatatan Pemakaian Harian (*Stock Out*), Siklus Purchase Order lintas entitas, Penerimaan Barang Atomik (*Goods Receipt*), dan Audit Log Mutasi Stok + Ekspor CSV.
- **Out-of-Scope:** Tanpa modul Kasir/POS, pemesanan pelanggan, atau manajemen menu.

---

## Langkah Persiapan & Menjalankan Aplikasi

### 1. Jalankan Skema & Seed SQL di Supabase
1. Buka proyek Anda di [Supabase Dashboard](https://supabase.com/dashboard) lalu masuk ke menu **SQL Editor**.
2. Salin seluruh isi file [`supabase/schema.sql`](./supabase/schema.sql), tempelkan ke SQL Editor, lalu klik **Run** (ini akan membuat 6 tabel relasional dan fungsi RPC `confirm_po_receipt`).
3. Buat query baru di SQL Editor, salin seluruh isi file [`supabase/seed.sql`](./supabase/seed.sql), lalu klik **Run** (ini akan mengisi 3 pemasok, 4 akun demo, 9 bahan baku termasuk 3 item *Low Stock*, 3 Purchase Order contoh, dan riwayat mutasi awal).

### 2. Konfigurasi File `.env`
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi variabel berikut di dalam `.env` menggunakan kredensial dari **Supabase Dashboard → Project Settings → API**:
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
Buka **`http://localhost:3000`** di peramban Anda.

---

## Daftar Akun Demo (1-Klik Login Tersedia di Halaman Login)

Seluruh akun demo menggunakan kata sandi seragam: **`mugiberkah123`**

| Peran (`role`) | Nama Pengguna | Email | Entitas / Mitra |
| :--- | :--- | :--- | :--- |
| **`admin`** | Rangga — Admin Gudang Mugi Berkah | `admin@mugiberkah.id` | Gudang & Purchasing Mugi Berkah |
| **`supplier`** | Hendri — PT Nusantara Roastery Bandung | `roastery@nusantara.id` | Pemasok Kategori **Kopi** (`supplier_id = 1`) |
| **`supplier`** | Siti — CV Lembang Dairy Fresh | `dairy@lembangfresh.id` | Pemasok Kategori **Dairy & Sirup** (`supplier_id = 2`) |
| **`supplier`** | Budi — UD Baker's Choice Pastry Supply | `pastry@bakerschoice.id` | Pemasok Kategori **Bahan Pastry** (`supplier_id = 3`) |
