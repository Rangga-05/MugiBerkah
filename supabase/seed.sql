-- ============================================================================
-- SEED DATA AWAL - SCM KEDAI KOPI & PASTRY "MUGI BERKAH"
-- Jalankan setelah supabase/schema.sql di Supabase SQL Editor
-- ============================================================================

TRUNCATE TABLE
    stock_movements,
    purchase_order_items,
    purchase_orders,
    raw_materials,
    users,
    suppliers
RESTART IDENTITY CASCADE;

-- 1. Seed 3 Pemasok (Suppliers)
INSERT INTO suppliers (name, category, contact_name, phone, address, lead_time_days) VALUES
    ('PT Nusantara Roastery Bandung', 'Kopi', 'Hendri Kusuma', '0812-2233-4455', 'Jl. Soekarno Hatta No. 148, Bandung', 2),
    ('CV Lembang Dairy Fresh', 'Dairy & Sirup', 'Siti Nurhaliza', '0813-9988-7766', 'Jl. Raya Lembang KM 12, Kab. Bandung Barat', 1),
    ('UD Baker''s Choice Pastry Supply', 'Bahan Pastry', 'Budi Santoso', '0811-5566-8899', 'Kawasan Niaga Kopo Permai Blok C-14, Bandung', 3);

-- 2. Seed 4 Akun Pengguna Demo (Password seragam: mugiberkah123)
INSERT INTO users (name, email, password, role, supplier_id) VALUES
    ('Rangga — Admin Gudang Mugi Berkah', 'admin@mugiberkah.id', 'mugiberkah123', 'admin', NULL),
    ('Hendri — PT Nusantara Roastery Bandung', 'roastery@nusantara.id', 'mugiberkah123', 'supplier', 1),
    ('Siti — CV Lembang Dairy Fresh', 'dairy@lembangfresh.id', 'mugiberkah123', 'supplier', 2),
    ('Budi — UD Baker''s Choice Pastry Supply', 'pastry@bakerschoice.id', 'mugiberkah123', 'supplier', 3);

-- 3. Seed 9 Bahan Baku (Raw Materials)
-- 3 item sengaja dibuat di bawah min_stock (LOW STOCK): KOP-001, DRY-001, PST-002
INSERT INTO raw_materials (sku, name, category, unit, current_stock, min_stock, unit_price, supplier_id) VALUES
    ('KOP-001', 'Biji Kopi Arabika Gayo', 'Kopi', 'kg', 3.00, 5.00, 220000, 1),
    ('KOP-002', 'House Blend Espresso Beans', 'Kopi', 'kg', 12.00, 6.00, 185000, 1),
    ('KOP-003', 'Bubuk Matcha Ceremonial', 'Kopi', 'kg', 4.00, 3.00, 310000, 1),
    ('DRY-001', 'Fresh Milk Full Cream', 'Dairy & Sirup', 'liter', 8.00, 15.00, 24000, 2),
    ('DRY-002', 'Oat Milk Barista Edition', 'Dairy & Sirup', 'liter', 14.00, 10.00, 42000, 2),
    ('DRY-003', 'Sirup Vanilla & Hazelnut', 'Dairy & Sirup', 'botol', 9.00, 5.00, 95000, 2),
    ('PST-001', 'Tepung Terigu Protein Tinggi', 'Bahan Pastry', 'kg', 25.00, 10.00, 16000, 3),
    ('PST-002', 'Unsalted Butter Anchor', 'Bahan Pastry', 'kg', 2.00, 5.00, 145000, 3),
    ('PST-003', 'Dark Compound Chocolate', 'Bahan Pastry', 'kg', 8.00, 4.00, 78000, 3);

-- 4. Seed 3 Contoh Purchase Order Awal (RECEIVED, SHIPPED, PENDING)
INSERT INTO purchase_orders (po_number, supplier_id, created_by, status, total_cost, notes, created_at, updated_at, received_at) VALUES
    (
        'PO-MB-20261120-001',
        1,
        1,
        'RECEIVED',
        2470000,
        'Restock rutin biji kopi espresso blend dan matcha mingguan',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days'
    ),
    (
        'PO-MB-20261124-002',
        2,
        1,
        'SHIPPED',
        900000,
        'Pengadaan susu segar & oat milk untuk kebutuhan akhir pekan (Siap diterima gudang)',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '6 hours',
        NULL
    ),
    (
        'PO-MB-20261125-003',
        3,
        1,
        'PENDING',
        1840000,
        'Pesanan mendesak Unsalted Butter Anchor & cokelat compound untuk produksi pastry',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day',
        NULL
    );

-- 5. Seed Detail Item untuk 3 Purchase Order
INSERT INTO purchase_order_items (po_id, material_id, quantity, unit_price, subtotal) VALUES
    -- Items untuk PO #1 (PO-MB-20261120-001 - RECEIVED)
    (1, 2, 10.00, 185000, 1850000), -- KOP-002 House Blend Espresso Beans
    (1, 3, 2.00, 310000, 620000),   -- KOP-003 Bubuk Matcha Ceremonial
    -- Items untuk PO #2 (PO-MB-20261124-002 - SHIPPED)
    (2, 4, 20.00, 24000, 480000),   -- DRY-001 Fresh Milk Full Cream
    (2, 5, 10.00, 42000, 420000),   -- DRY-002 Oat Milk Barista Edition
    -- Items untuk PO #3 (PO-MB-20261125-003 - PENDING)
    (3, 8, 10.00, 145000, 1450000), -- PST-002 Unsalted Butter Anchor
    (3, 9, 5.00, 78000, 390000);    -- PST-003 Dark Compound Chocolate

-- 6. Seed Riwayat Mutasi Stok (IN dari PO-MB-20261120-001 & beberapa OUT pemakaian harian)
INSERT INTO stock_movements (material_id, type, quantity, reference, notes, created_by, created_at) VALUES
    (2, 'IN', 10.00, 'PO-MB-20261120-001', 'Penerimaan Purchase Order', 1, NOW() - INTERVAL '3 days'),
    (3, 'IN', 2.00, 'PO-MB-20261120-001', 'Penerimaan Purchase Order', 1, NOW() - INTERVAL '3 days'),
    (1, 'OUT', 2.00, 'Pemakaian Bar Kopi Harian', 'Ekstraksi manual brew & single origin Arabika Gayo', 1, NOW() - INTERVAL '2 days'),
    (4, 'OUT', 12.00, 'Pemakaian Bar Kopi Harian', 'Pembuatan menu berbasis susu (Latte & Cappuccino) shift pagi-sore', 1, NOW() - INTERVAL '1 day'),
    (8, 'OUT', 3.00, 'Produksi Croissant & Danish Pagi', 'Laminasi adonan croissant dan puff pastry dapur utama', 1, NOW() - INTERVAL '12 hours'),
    (7, 'OUT', 5.00, 'Produksi Croissant & Danish Pagi', 'Adonan dasar pastry & roti manis harian', 1, NOW() - INTERVAL '8 hours');
