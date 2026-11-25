import { Elysia } from 'elysia';
import { supabase } from '../config/supabase.ts';
import { jwtPlugin, verifyAuth } from '../middleware/auth.ts';

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard' })
  .use(jwtPlugin)
  .get('/summary', async ({ jwt, headers, set }) => {
    const user = await verifyAuth(jwt, headers, set);
    if (!user) {
      return { error: 'Akses ditolak. Silakan login terlebih dahulu.' };
    }

    if (user.role === 'admin') {
      // 1. Ambil seluruh bahan baku + supplier
      const { data: materials, error: matErr } = await supabase
        .from('raw_materials')
        .select('*, suppliers(id, name, category, lead_time_days, phone)')
        .order('id', { ascending: true });

      if (matErr) {
        set.status = 500;
        return { error: `Gagal memuat data bahan baku: ${matErr.message}` };
      }

      const mappedMaterials = (materials || []).map((m: Record<string, unknown>) => {
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
          is_low_stock: currentStock <= minStock,
        };
      });

      const lowStockItems = mappedMaterials.filter((m) => m.is_low_stock);

      // 2. Ambil seluruh Purchase Orders untuk statistik pengadaan
      const { data: pos, error: poErr } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, total_cost, created_at, received_at');

      if (poErr) {
        set.status = 500;
        return { error: `Gagal memuat data Purchase Order: ${poErr.message}` };
      }

      const allPos = pos || [];
      const activePoCount = allPos.filter((p) =>
        ['PENDING', 'PROCESSING', 'SHIPPED'].includes(String(p.status))
      ).length;

      const totalProcurementValue = allPos
        .filter((p) => p.status === 'RECEIVED')
        .reduce((sum, p) => sum + Number(p.total_cost || 0), 0);

      const poStatusBreakdown = {
        PENDING: allPos.filter((p) => p.status === 'PENDING').length,
        PROCESSING: allPos.filter((p) => p.status === 'PROCESSING').length,
        SHIPPED: allPos.filter((p) => p.status === 'SHIPPED').length,
        RECEIVED: allPos.filter((p) => p.status === 'RECEIVED').length,
        CANCELLED: allPos.filter((p) => p.status === 'CANCELLED').length,
      };

      // 3. Ambil 5 mutasi stok terbaru
      const { data: movements, error: movErr } = await supabase
        .from('stock_movements')
        .select('*, raw_materials(id, sku, name, unit, category), users(id, name)')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(5);

      if (movErr) {
        set.status = 500;
        return { error: `Gagal memuat mutasi stok: ${movErr.message}` };
      }

      const recentMovements = (movements || []).map((mv: Record<string, unknown>) => {
        const mat = mv.raw_materials as {
          id?: number;
          sku?: string;
          name?: string;
          unit?: string;
          category?: string;
        } | null;
        const usr = mv.users as { id?: number; name?: string } | null;

        return {
          id: Number(mv.id),
          material_id: Number(mv.material_id),
          material_sku: mat?.sku || '-',
          material_name: mat?.name || '-',
          material_unit: mat?.unit || '',
          material_category: mat?.category || '-',
          type: String(mv.type),
          quantity: Number(mv.quantity),
          reference: String(mv.reference),
          notes: mv.notes ? String(mv.notes) : '',
          created_by_name: usr?.name || 'Sistem',
          created_at: String(mv.created_at),
        };
      });

      return {
        role: 'admin',
        total_materials: mappedMaterials.length,
        low_stock_count: lowStockItems.length,
        active_po_count: activePoCount,
        total_procurement_value: totalProcurementValue,
        po_status_breakdown: poStatusBreakdown,
        low_stock_items: lowStockItems,
        recent_movements: recentMovements,
      };
    }

    // Ringkasan KPI untuk peran Supplier
    if (!user.supplier_id) {
      set.status = 400;
      return { error: 'Akun pemasok tidak terhubung dengan ID pemasok.' };
    }

    const { data: supplierPos, error: supPoErr } = await supabase
      .from('purchase_orders')
      .select(
        '*, suppliers(id, name, category), purchase_order_items(id, material_id, quantity, unit_price, subtotal, raw_materials(id, sku, name, unit))'
      )
      .eq('supplier_id', user.supplier_id)
      .order('created_at', { ascending: false });

    if (supPoErr) {
      set.status = 500;
      return { error: `Gagal memuat Purchase Order pemasok: ${supPoErr.message}` };
    }

    const orders = supplierPos || [];
    const pendingPoCount = orders.filter((p) => p.status === 'PENDING').length;
    const processingPoCount = orders.filter((p) => p.status === 'PROCESSING').length;
    const shippedPoCount = orders.filter((p) => p.status === 'SHIPPED').length;
    const completedPoCount = orders.filter((p) => p.status === 'RECEIVED').length;

    const totalOrderValue = orders
      .filter((p) => p.status !== 'CANCELLED')
      .reduce((sum, p) => sum + Number(p.total_cost || 0), 0);

    return {
      role: 'supplier',
      supplier_id: user.supplier_id,
      pending_po_count: pendingPoCount,
      processing_po_count: processingPoCount,
      shipped_po_count: shippedPoCount,
      completed_po_count: completedPoCount,
      total_order_value: totalOrderValue,
    };
  });
