import { Elysia, t } from 'elysia';
import { supabase } from '../config/supabase.ts';
import { jwtPlugin, verifyAdmin, verifyAuth } from '../middleware/auth.ts';

const VALID_CATEGORIES = ['Kopi', 'Dairy & Sirup', 'Bahan Pastry'];

export const materialsRoutes = new Elysia({ prefix: '/api/materials' })
  .use(jwtPlugin)
  .get('/', async ({ query, jwt, headers, set }) => {
    const user = await verifyAuth(jwt, headers, set);
    if (!user) {
      return { error: 'Akses ditolak. Silakan login terlebih dahulu.' };
    }

    let dbQuery = supabase
      .from('raw_materials')
      .select('*, suppliers(id, name, category, lead_time_days, phone)')
      .order('id', { ascending: true });

    if (query.category && query.category !== 'ALL' && query.category !== 'Semua') {
      dbQuery = dbQuery.eq('category', query.category);
    }

    const { data, error } = await dbQuery;
    if (error) {
      set.status = 500;
      return { error: `Gagal memuat daftar bahan baku: ${error.message}` };
    }

    let materials = (data || []).map((m: Record<string, unknown>) => {
      const currentStock = Number(m.current_stock);
      const minStock = Number(m.min_stock);
      const sup = m.suppliers as {
        id?: number;
        name?: string;
        category?: string;
        lead_time_days?: number;
        phone?: string;
      } | null;

      return {
        id: Number(m.id),
        sku: String(m.sku),
        name: String(m.name),
        category: String(m.category),
        unit: String(m.unit),
        current_stock: currentStock,
        min_stock: minStock,
        unit_price: Number(m.unit_price),
        supplier_id: Number(m.supplier_id),
        supplier_name: sup?.name || '-',
        supplier_lead_time: sup?.lead_time_days ?? 2,
        updated_at: String(m.updated_at),
        is_low_stock: currentStock <= minStock,
      };
    });

    if (query.lowStock === 'true') {
      materials = materials.filter((m) => m.is_low_stock);
    }

    return { materials };
  })
  .post(
    '/',
    async ({ body, jwt, headers, set }) => {
      const admin = await verifyAdmin(jwt, headers, set);
      if (!admin) {
        return { error: 'Hanya Admin Gudang yang dapat menambah bahan baku.' };
      }

      if (!VALID_CATEGORIES.includes(body.category)) {
        set.status = 400;
        return {
          error: `Kategori tidak valid. Pilih salah satu: ${VALID_CATEGORIES.join(', ')}`,
        };
      }

      const { data, error } = await supabase
        .from('raw_materials')
        .insert({
          sku: body.sku.trim().toUpperCase(),
          name: body.name.trim(),
          category: body.category,
          unit: body.unit.trim(),
          current_stock: Number(body.current_stock ?? 0),
          min_stock: Number(body.min_stock ?? 5),
          unit_price: Math.round(Number(body.unit_price)),
          supplier_id: Number(body.supplier_id),
          updated_at: new Date().toISOString(),
        })
        .select('*, suppliers(id, name, category)')
        .single();

      if (error) {
        set.status = 400;
        if (error.code === '23505') {
          return { error: `SKU '${body.sku.toUpperCase()}' sudah digunakan oleh bahan baku lain.` };
        }
        return { error: `Gagal menambah bahan baku: ${error.message}` };
      }

      set.status = 201;
      return {
        message: 'Bahan baku baru berhasil ditambahkan.',
        material: {
          ...data,
          current_stock: Number(data.current_stock),
          min_stock: Number(data.min_stock),
          is_low_stock: Number(data.current_stock) <= Number(data.min_stock),
        },
      };
    },
    {
      body: t.Object({
        sku: t.String({ minLength: 2 }),
        name: t.String({ minLength: 2 }),
        category: t.String(),
        unit: t.String({ minLength: 1 }),
        current_stock: t.Optional(t.Number({ minimum: 0 })),
        min_stock: t.Number({ minimum: 0 }),
        unit_price: t.Number({ minimum: 0 }),
        supplier_id: t.Number(),
      }),
    }
  )
  .put(
    '/:id',
    async ({ params, body, jwt, headers, set }) => {
      const admin = await verifyAdmin(jwt, headers, set);
      if (!admin) {
        return { error: 'Hanya Admin Gudang yang dapat mengubah data bahan baku.' };
      }

      if (!VALID_CATEGORIES.includes(body.category)) {
        set.status = 400;
        return {
          error: `Kategori tidak valid. Pilih salah satu: ${VALID_CATEGORIES.join(', ')}`,
        };
      }

      const materialId = Number(params.id);
      const { data, error } = await supabase
        .from('raw_materials')
        .update({
          sku: body.sku.trim().toUpperCase(),
          name: body.name.trim(),
          category: body.category,
          unit: body.unit.trim(),
          min_stock: Number(body.min_stock),
          unit_price: Math.round(Number(body.unit_price)),
          supplier_id: Number(body.supplier_id),
          updated_at: new Date().toISOString(),
        })
        .eq('id', materialId)
        .select('*, suppliers(id, name, category)')
        .single();

      if (error) {
        set.status = 400;
        return { error: `Gagal memperbarui bahan baku: ${error.message}` };
      }

      return {
        message: 'Data master bahan baku berhasil diperbarui.',
        material: {
          ...data,
          current_stock: Number(data.current_stock),
          min_stock: Number(data.min_stock),
          is_low_stock: Number(data.current_stock) <= Number(data.min_stock),
        },
      };
    },
    {
      body: t.Object({
        sku: t.String({ minLength: 2 }),
        name: t.String({ minLength: 2 }),
        category: t.String(),
        unit: t.String({ minLength: 1 }),
        min_stock: t.Number({ minimum: 0 }),
        unit_price: t.Number({ minimum: 0 }),
        supplier_id: t.Number(),
      }),
    }
  )
  .delete('/:id', async ({ params, jwt, headers, set }) => {
    const admin = await verifyAdmin(jwt, headers, set);
    if (!admin) {
      return { error: 'Hanya Admin Gudang yang dapat menghapus bahan baku.' };
    }

    const materialId = Number(params.id);
    const { error } = await supabase.from('raw_materials').delete().eq('id', materialId);

    if (error) {
      set.status = 400;
      if (error.code === '23503' || error.message.toLowerCase().includes('foreign key')) {
        return {
          error:
            'Bahan baku tidak dapat dihapus karena sudah tercatat dalam riwayat Purchase Order.',
        };
      }
      return { error: `Gagal menghapus bahan baku: ${error.message}` };
    }

    return { message: 'Bahan baku berhasil dihapus.' };
  })
  .post(
    '/:id/usage',
    async ({ params, body, jwt, headers, set }) => {
      const admin = await verifyAdmin(jwt, headers, set);
      if (!admin) {
        return { error: 'Hanya Admin Gudang yang dapat mencatat pemakaian bahan baku (Stock Out).' };
      }

      const materialId = Number(params.id);
      const quantity = Number(body.quantity);

      if (isNaN(quantity) || quantity <= 0) {
        set.status = 400;
        return { error: 'Jumlah pemakaian harus lebih dari 0.' };
      }

      // 1. Cek stok bahan baku saat ini
      const { data: material, error: fetchErr } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('id', materialId)
        .maybeSingle();

      if (fetchErr || !material) {
        set.status = 404;
        return { error: 'Bahan baku tidak ditemukan.' };
      }

      const currentStock = Number(material.current_stock);
      if (quantity > currentStock) {
        set.status = 400;
        return {
          error: `Stok tidak mencukupi untuk pemakaian ini. Stok tersedia: ${currentStock} ${material.unit}.`,
        };
      }

      const newStock = Number((currentStock - quantity).toFixed(2));
      const minStock = Number(material.min_stock);

      // 2. Kurangi current_stock di raw_materials
      const { data: updatedMaterial, error: updateErr } = await supabase
        .from('raw_materials')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', materialId)
        .select('*')
        .single();

      if (updateErr) {
        set.status = 500;
        return { error: `Gagal memperbarui stok bahan baku: ${updateErr.message}` };
      }

      // 3. Catat log OUT ke stock_movements
      const referenceText = body.reference?.trim() || 'Pemakaian Bar & Dapur Harian';
      const notesText = body.notes?.trim() || null;

      const { data: movement, error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          material_id: materialId,
          type: 'OUT',
          quantity,
          reference: referenceText,
          notes: notesText,
          created_by: admin.id,
        })
        .select('*')
        .single();

      if (movErr) {
        set.status = 500;
        return { error: `Stok berkurang namun gagal mencatat log mutasi: ${movErr.message}` };
      }

      const isLowStock = newStock <= minStock;

      return {
        message: isLowStock
          ? `Pemakaian ${quantity} ${material.unit} ${material.name} tercatat. PERINGATAN: Stok kini menipis (${newStock} ${material.unit} <= batas minimum ${minStock} ${material.unit})!`
          : `Pemakaian ${quantity} ${material.unit} ${material.name} berhasil dicatat. Sisa stok: ${newStock} ${material.unit}.`,
        material: {
          ...updatedMaterial,
          current_stock: newStock,
          min_stock: minStock,
          is_low_stock: isLowStock,
        },
        movement,
      };
    },
    {
      body: t.Object({
        quantity: t.Number({ exclusiveMinimum: 0 }),
        reference: t.String({ minLength: 2 }),
        notes: t.Optional(t.Nullable(t.String())),
      }),
    }
  );
