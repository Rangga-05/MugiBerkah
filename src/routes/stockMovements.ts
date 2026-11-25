import { Elysia } from 'elysia';
import { supabase } from '../config/supabase.ts';
import { jwtPlugin, verifyAuth } from '../middleware/auth.ts';

export const stockMovementsRoutes = new Elysia({ prefix: '/api/stock-movements' })
  .use(jwtPlugin)
  .get('/', async ({ query, jwt, headers, set }) => {
    const user = await verifyAuth(jwt, headers, set);
    if (!user) {
      return { error: 'Akses ditolak. Silakan login terlebih dahulu.' };
    }

    let dbQuery = supabase
      .from('stock_movements')
      .select('*, raw_materials(id, sku, name, category, unit), users(id, name)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (query.type && (query.type === 'IN' || query.type === 'OUT')) {
      dbQuery = dbQuery.eq('type', query.type);
    }

    if (query.material_id) {
      dbQuery = dbQuery.eq('material_id', Number(query.material_id));
    }

    const { data, error } = await dbQuery;
    if (error) {
      set.status = 500;
      return { error: `Gagal memuat riwayat mutasi stok: ${error.message}` };
    }

    const movements = (data || []).map((mv: Record<string, unknown>) => {
      const mat = mv.raw_materials as {
        id?: number;
        sku?: string;
        name?: string;
        category?: string;
        unit?: string;
      } | null;
      const usr = mv.users as { id?: number; name?: string } | null;

      return {
        id: Number(mv.id),
        material_id: Number(mv.material_id),
        sku: mat?.sku || '-',
        material_name: mat?.name || '-',
        category: mat?.category || '-',
        unit: mat?.unit || '',
        type: String(mv.type),
        quantity: Number(mv.quantity),
        reference: String(mv.reference),
        notes: mv.notes ? String(mv.notes) : '',
        created_by: mv.created_by ? Number(mv.created_by) : null,
        created_by_name: usr?.name || 'Sistem',
        created_at: String(mv.created_at),
      };
    });

    return { movements };
  });
