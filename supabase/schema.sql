-- ============================================================================
-- SISTEM MANAJEMEN RANTAI PASOK BAHAN BAKU (SCM) - KEDAI KOPI & PASTRY "MUGI BERKAH"
-- Pilar 2 TOGAF: Arsitektur Data (Supabase PostgreSQL Schema & Atomic RPC)
-- ============================================================================

-- Bersihkan tabel jika skrip dijalankan ulang (Idempotent Reset)
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS raw_materials CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- 1. Tabel Master Pemasok (suppliers)
CREATE TABLE suppliers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    lead_time_days INTEGER NOT NULL DEFAULT 2 CHECK (lead_time_days >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Pengguna Multi-Peran (users)
-- Catatan: Password dapat berupa hash (Bun.password) maupun teks demo ('mugiberkah123')
-- untuk kemudahan pengujian langsung dari Supabase SQL Editor.
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'supplier')),
    supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Master Bahan Baku (raw_materials)
CREATE TABLE raw_materials (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Kopi', 'Dairy & Sirup', 'Bahan Pastry')),
    unit TEXT NOT NULL,
    current_stock NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock NUMERIC(10,2) NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
    unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Header Purchase Order (purchase_orders)
CREATE TABLE purchase_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_number TEXT UNIQUE NOT NULL,
    supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SHIPPED', 'RECEIVED', 'CANCELLED')),
    total_cost INTEGER NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    received_at TIMESTAMPTZ
);

-- 5. Tabel Detail Item Purchase Order (purchase_order_items)
CREATE TABLE purchase_order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    material_id BIGINT NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
    subtotal INTEGER NOT NULL CHECK (subtotal >= 0)
);

-- 6. Tabel Riwayat Mutasi Stok / Audit Log (stock_movements)
CREATE TABLE stock_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_id BIGINT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    reference TEXT NOT NULL,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks untuk optimasi query dashboard & filter
CREATE INDEX idx_raw_materials_supplier ON raw_materials(supplier_id);
CREATE INDEX idx_raw_materials_category ON raw_materials(category);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_po_items_po_id ON purchase_order_items(po_id);
CREATE INDEX idx_stock_movements_material ON stock_movements(material_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- ============================================================================
-- FUNGSI RPC POSTGRESQL: Penerimaan Barang Atomik (Goods Receipt Transaction)
-- ============================================================================
CREATE OR REPLACE FUNCTION confirm_po_receipt(p_po_id BIGINT, p_user_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_po RECORD;
    v_item RECORD;
    v_items_processed INTEGER := 0;
BEGIN
    -- 1. Kunci baris Purchase Order (FOR UPDATE) untuk mencegah race condition
    SELECT * INTO v_po
    FROM purchase_orders
    WHERE id = p_po_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase Order dengan ID % tidak ditemukan.', p_po_id;
    END IF;

    -- 2. Validasi state machine: hanya status SHIPPED yang boleh diterima
    IF v_po.status <> 'SHIPPED' THEN
        RAISE EXCEPTION 'Purchase Order % tidak dapat diterima karena berstatus % (harus SHIPPED).', v_po.po_number, v_po.status;
    END IF;

    -- 3. Ubah status PO menjadi RECEIVED
    UPDATE purchase_orders
    SET status = 'RECEIVED',
        received_at = NOW(),
        updated_at = NOW()
    WHERE id = p_po_id;

    -- 4. Loop setiap item dalam PO untuk menambah stok dan mencatat mutasi IN
    FOR v_item IN
        SELECT material_id, quantity
        FROM purchase_order_items
        WHERE po_id = p_po_id
    LOOP
        UPDATE raw_materials
        SET current_stock = current_stock + v_item.quantity,
            updated_at = NOW()
        WHERE id = v_item.material_id;

        INSERT INTO stock_movements (
            material_id,
            type,
            quantity,
            reference,
            notes,
            created_by,
            created_at
        ) VALUES (
            v_item.material_id,
            'IN',
            v_item.quantity,
            v_po.po_number,
            'Penerimaan Purchase Order',
            p_user_id,
            NOW()
        );

        v_items_processed := v_items_processed + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'po_id', p_po_id,
        'po_number', v_po.po_number,
        'status', 'RECEIVED',
        'items_processed', v_items_processed,
        'received_at', NOW()
    );
END;
$$;
