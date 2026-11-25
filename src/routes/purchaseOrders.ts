import { Elysia, t } from 'elysia';
import { supabase } from '../config/supabase.ts';
import { jwtPlugin, verifyAdmin, verifyAuth } from '../middleware/auth.ts';

function formatPoRow(po: Record<string, unknown>) {
  const sup = po.suppliers as {
    id?: number;
    name?: string;
    category?: string;
    contact_name?: string;
    phone?: string;
    lead_time_days?: number;
  } | null;

  const creator = po.users as { id?: number; name?: string } | null;
  const rawItems = (po.purchase_order_items as Array<Record<string, unknown>>) || [];

  const items = rawItems.map((item) => {
    const mat = item.raw_materials as {
      id?: number;
      sku?: string;
      name?: string;
      unit?: string;
      category?: string;
    } | null;

    return {
      id: Number(item.id),
      material_id: Number(item.material_id),
      sku: mat?.sku || '-',
      material_name: mat?.name || '-',
      unit: mat?.unit || '',
      category: mat?.category || '-',
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
    };
  });

  return {
    id: Number(po.id),
    po_number: String(po.po_number),
    supplier_id: Number(po.supplier_id),
    supplier_name: sup?.name || '-',
    supplier_category: sup?.category || '-',
    supplier_contact: sup?.contact_name || '-',
    supplier_phone: sup?.phone || '-',
    supplier_lead_time: sup?.lead_time_days ?? 2,
    created_by: po.created_by ? Number(po.created_by) : null,
    created_by_name: creator?.name || 'Admin Gudang',
    status: String(po.status),
    total_cost: Number(po.total_cost),
    notes: po.notes ? String(po.notes) : '',
    created_at: String(po.created_at),
    updated_at: String(po.updated_at),
    received_at: po.received_at ? String(po.received_at) : null,
    items,
  };
}

async function generatePoNumber(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;

  const { count } = await supabase
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true });

  const nextSeq = (count ?? 0) + 1;
  const seqStr = String(nextSeq).padStart(3, '0');
  const candidate = `PO-MB-${datePart}-${seqStr}`;

  // Pastikan unik jika terjadi penghapusan sebelumnya
  const { data: existing } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('po_number', candidate)
    .maybeSingle();

  if (!existing) {
    return candidate;
  }

  const randomSuffix = String(Math.floor(100 + Math.random() * 900));
  return `PO-MB-${datePart}-${randomSuffix}`;
}

const PO_SELECT_QUERY = `
  *,
  suppliers(id, name, category, contact_name, phone, lead_time_days),
  users(id, name),
  purchase_order_items(
    id,
    material_id,
    quantity,
    unit_price,
    subtotal,
    raw_materials(id, sku, name, unit, category)
  )
`;

export const purchaseOrdersRoutes = new Elysia({ prefix: '/api/purchase-orders' })
  .use(jwtPlugin)
  .get('/', async ({ query, jwt, headers, set }) => {
    const user = await verifyAuth(jwt, headers, set);
    if (!user) {
      return { error: 'Akses ditolak. Silakan login terlebih dahulu.' };
    }

    let dbQuery = supabase
      .from('purchase_orders')
      .select(PO_SELECT_QUERY)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    // Isolasi data WAJIB untuk peran supplier
    if (user.role === 'supplier') {
      if (!user.supplier_id) {
        set.status = 403;
        return { error: 'Akun pemasok tidak memiliki supplier_id yang valid.' };
      }
      dbQuery = dbQuery.eq('supplier_id', user.supplier_id);
    }

    if (query.status && query.status !== 'ALL' && query.status !== 'Semua') {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const { data, error } = await dbQuery;
    if (error) {
      set.status = 500;
      return { error: `Gagal memuat daftar Purchase Order: ${error.message}` };
    }

    const purchaseOrders = (data || []).map((row) =>
      formatPoRow(row as unknown as Record<string, unknown>)
    );

    return { purchase_orders: purchaseOrders };
  })
  .post(
    '/',
    async ({ body, jwt, headers, set }) => {
      const admin = await verifyAdmin(jwt, headers, set);
      if (!admin) {
        return { error: 'Hanya Admin Gudang Mugi Berkah yang dapat membuat Purchase Order baru.' };
      }

      if (!body.items || body.items.length === 0) {
        set.status = 400;
        return { error: 'Purchase Order harus memiliki minimal 1 item bahan baku.' };
      }

      for (const item of body.items) {
        if (Number(item.quantity) <= 0) {
          set.status = 400;
          return { error: 'Kuantitas setiap item bahan baku harus lebih dari 0.' };
        }
      }

      const materialIds = body.items.map((i) => Number(i.material_id));
      const { data: dbMaterials, error: matErr } = await supabase
        .from('raw_materials')
        .select('id, sku, name, unit_price, supplier_id')
        .in('id', materialIds);

      if (matErr || !dbMaterials || dbMaterials.length === 0) {
        set.status = 400;
        return { error: 'Gagal memverifikasi bahan baku yang dipilih.' };
      }

      const materialMap = new Map<
        number,
        { id: number; sku: string; name: string; unit_price: number; supplier_id: number }
      >();
      for (const m of dbMaterials) {
        materialMap.set(Number(m.id), {
          id: Number(m.id),
          sku: String(m.sku),
          name: String(m.name),
          unit_price: Number(m.unit_price),
          supplier_id: Number(m.supplier_id),
        });
      }

      // Gabungkan item jika ada material_id yang sama dan hitung subtotal dari harga master
      const aggregatedItems = new Map<number, number>();
      for (const item of body.items) {
        const matId = Number(item.material_id);
        const mat = materialMap.get(matId);
        if (!mat) {
          set.status = 400;
          return { error: `Bahan baku dengan ID ${matId} tidak ditemukan.` };
        }
        if (mat.supplier_id !== Number(body.supplier_id)) {
          set.status = 400;
          return {
            error: `Bahan baku "${mat.name}" tidak berasal dari pemasok yang dipilih.`,
          };
        }
        aggregatedItems.set(matId, (aggregatedItems.get(matId) || 0) + Number(item.quantity));
      }

      let totalCost = 0;
      const preparedItems: Array<{
        material_id: number;
        quantity: number;
        unit_price: number;
        subtotal: number;
      }> = [];

      for (const [materialId, quantity] of aggregatedItems.entries()) {
        const mat = materialMap.get(materialId)!;
        const subtotal = Math.round(quantity * mat.unit_price);
        totalCost += subtotal;
        preparedItems.push({
          material_id: materialId,
          quantity: Number(quantity.toFixed(2)),
          unit_price: mat.unit_price,
          subtotal,
        });
      }

      const poNumber = await generatePoNumber();

      // 1. Simpan header Purchase Order
      const { data: createdPo, error: createPoErr } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: Number(body.supplier_id),
          created_by: admin.id,
          status: 'PENDING',
          total_cost: totalCost,
          notes: body.notes?.trim() || null,
        })
        .select('id')
        .single();

      if (createPoErr || !createdPo) {
        set.status = 500;
        return { error: `Gagal membuat Purchase Order: ${createPoErr?.message}` };
      }

      // 2. Simpan seluruh detail item Purchase Order
      const poItemsPayload = preparedItems.map((item) => ({
        po_id: Number(createdPo.id),
        ...item,
      }));

      const { error: itemsErr } = await supabase
        .from('purchase_order_items')
        .insert(poItemsPayload);

      if (itemsErr) {
        // Rollback header jika gagal insert item
        await supabase.from('purchase_orders').delete().eq('id', createdPo.id);
        set.status = 500;
        return { error: `Gagal menyimpan item Purchase Order: ${itemsErr.message}` };
      }

      // 3. Ambil kembali data PO lengkap
      const { data: fullPo } = await supabase
        .from('purchase_orders')
        .select(PO_SELECT_QUERY)
        .eq('id', createdPo.id)
        .single();

      set.status = 201;
      return {
        message: `Purchase Order ${poNumber} berhasil dibuat dengan status PENDING.`,
        purchase_order: fullPo
          ? formatPoRow(fullPo as unknown as Record<string, unknown>)
          : null,
      };
    },
    {
      body: t.Object({
        supplier_id: t.Number(),
        notes: t.Optional(t.Nullable(t.String())),
        items: t.Array(
          t.Object({
            material_id: t.Number(),
            quantity: t.Number({ exclusiveMinimum: 0 }),
          })
        ),
      }),
    }
  )
  .patch(
    '/:id/status',
    async ({ params, body, jwt, headers, set }) => {
      const user = await verifyAuth(jwt, headers, set);
      if (!user) {
        return { error: 'Akses ditolak. Silakan login terlebih dahulu.' };
      }

      const poId = Number(params.id);
      const nextStatus = body.status.trim().toUpperCase();

      const { data: po, error: fetchErr } = await supabase
        .from('purchase_orders')
        .select('id, po_number, supplier_id, status')
        .eq('id', poId)
        .maybeSingle();

      if (fetchErr || !po) {
        set.status = 404;
        return { error: 'Purchase Order tidak ditemukan.' };
      }

      const currentStatus = String(po.status);

      // Validasi State Machine berdasarkan peran (Pilar 1 TOGAF)
      if (user.role === 'supplier') {
        if (Number(po.supplier_id) !== Number(user.supplier_id)) {
          set.status = 403;
          return {
            error: 'Anda tidak memiliki hak akses untuk mengubah Purchase Order milik pemasok lain.',
          };
        }

        const isValidSupplierTransition =
          (currentStatus === 'PENDING' && nextStatus === 'PROCESSING') ||
          (currentStatus === 'PROCESSING' && nextStatus === 'SHIPPED');

        if (!isValidSupplierTransition) {
          set.status = 400;
          return {
            error: `Transisi status tidak diizinkan untuk Pemasok (${currentStatus} -> ${nextStatus}). Alur yang diizinkan: PENDING -> PROCESSING -> SHIPPED.`,
          };
        }
      } else if (user.role === 'admin') {
        const isValidAdminTransition =
          currentStatus === 'PENDING' && nextStatus === 'CANCELLED';

        if (!isValidAdminTransition) {
          set.status = 400;
          return {
            error: `Transisi status tidak diizinkan (${currentStatus} -> ${nextStatus}). Admin hanya dapat membatalkan PO yang masih berstatus PENDING.`,
          };
        }
      }

      const { error: updateErr } = await supabase
        .from('purchase_orders')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', poId);

      if (updateErr) {
        set.status = 500;
        return { error: `Gagal memperbarui status Purchase Order: ${updateErr.message}` };
      }

      const { data: updatedPo } = await supabase
        .from('purchase_orders')
        .select(PO_SELECT_QUERY)
        .eq('id', poId)
        .single();

      return {
        message: `Status Purchase Order ${po.po_number} berhasil diperbarui menjadi ${nextStatus}.`,
        purchase_order: updatedPo
          ? formatPoRow(updatedPo as unknown as Record<string, unknown>)
          : null,
      };
    },
    {
      body: t.Object({
        status: t.String(),
      }),
    }
  )
  .post('/:id/receive', async ({ params, jwt, headers, set }) => {
    const admin = await verifyAdmin(jwt, headers, set);
    if (!admin) {
      return {
        error: 'Hanya Admin Gudang Mugi Berkah yang dapat mengonfirmasi penerimaan barang.',
      };
    }

    const poId = Number(params.id);

    // Panggil fungsi RPC PostgreSQL confirm_po_receipt untuk transaksi atomik
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('confirm_po_receipt', {
      p_po_id: poId,
      p_user_id: admin.id,
    });

    if (rpcErr) {
      set.status = 400;
      return {
        error: `Gagal mengonfirmasi penerimaan barang: ${rpcErr.message}`,
      };
    }

    // Ambil detail PO terbaru yang sudah berstatus RECEIVED
    const { data: receivedPo, error: fetchErr } = await supabase
      .from('purchase_orders')
      .select(PO_SELECT_QUERY)
      .eq('id', poId)
      .single();

    if (fetchErr || !receivedPo) {
      set.status = 500;
      return { error: 'Barang berhasil diterima namun gagal memuat ulang detail Purchase Order.' };
    }

    const formattedPo = formatPoRow(receivedPo as unknown as Record<string, unknown>);

    return {
      message: `Penerimaan barang untuk ${formattedPo.po_number} berhasil dikonfirmasi! Stok gudang dan riwayat mutasi (IN) telah diperbarui secara otomatis.`,
      rpc_summary: rpcResult,
      purchase_order: formattedPo,
    };
  });
