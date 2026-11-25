import { Elysia, t } from 'elysia';
import { supabase } from '../config/supabase.ts';
import { jwtPlugin, verifyAdmin, verifyAuth } from '../middleware/auth.ts';

export const suppliersRoutes = new Elysia({ prefix: '/api/suppliers' })
  .use(jwtPlugin)
  .get('/', async ({ jwt, headers, set }) => {
    const user = await verifyAuth(jwt, headers, set);
    if (!user) {
      return { error: 'Akses ditolak. Silakan login terlebih dahulu.' };
    }

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      set.status = 500;
      return { error: `Gagal memuat daftar pemasok: ${error.message}` };
    }

    return { suppliers: data || [] };
  })
  .post(
    '/',
    async ({ body, jwt, headers, set }) => {
      const admin = await verifyAdmin(jwt, headers, set);
      if (!admin) {
        return { error: 'Hanya Admin Gudang Mugi Berkah yang dapat menambah pemasok.' };
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: body.name.trim(),
          category: body.category.trim(),
          contact_name: body.contact_name.trim(),
          phone: body.phone.trim(),
          address: body.address ? body.address.trim() : null,
          lead_time_days: Number(body.lead_time_days ?? 2),
        })
        .select('*')
        .single();

      if (error) {
        set.status = 400;
        return { error: `Gagal menambah pemasok: ${error.message}` };
      }

      set.status = 201;
      return {
        message: 'Pemasok baru berhasil ditambahkan.',
        supplier: data,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        category: t.String({ minLength: 2 }),
        contact_name: t.String({ minLength: 2 }),
        phone: t.String({ minLength: 4 }),
        address: t.Optional(t.Nullable(t.String())),
        lead_time_days: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  )
  .put(
    '/:id',
    async ({ params, body, jwt, headers, set }) => {
      const admin = await verifyAdmin(jwt, headers, set);
      if (!admin) {
        return { error: 'Hanya Admin Gudang Mugi Berkah yang dapat mengubah data pemasok.' };
      }

      const supplierId = Number(params.id);
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          name: body.name.trim(),
          category: body.category.trim(),
          contact_name: body.contact_name.trim(),
          phone: body.phone.trim(),
          address: body.address ? body.address.trim() : null,
          lead_time_days: Number(body.lead_time_days ?? 2),
        })
        .eq('id', supplierId)
        .select('*')
        .single();

      if (error) {
        set.status = 400;
        return { error: `Gagal memperbarui pemasok: ${error.message}` };
      }

      return {
        message: 'Data pemasok berhasil diperbarui.',
        supplier: data,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        category: t.String({ minLength: 2 }),
        contact_name: t.String({ minLength: 2 }),
        phone: t.String({ minLength: 4 }),
        address: t.Optional(t.Nullable(t.String())),
        lead_time_days: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  )
  .delete('/:id', async ({ params, jwt, headers, set }) => {
    const admin = await verifyAdmin(jwt, headers, set);
    if (!admin) {
      return { error: 'Hanya Admin Gudang Mugi Berkah yang dapat menghapus pemasok.' };
    }

    const supplierId = Number(params.id);
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);

    if (error) {
      set.status = 400;
      if (error.code === '23503' || error.message.toLowerCase().includes('foreign key')) {
        return {
          error:
            'Pemasok tidak dapat dihapus karena masih terkait dengan Bahan Baku atau Purchase Order aktif.',
        };
      }
      return { error: `Gagal menghapus pemasok: ${error.message}` };
    }

    return { message: 'Pemasok berhasil dihapus.' };
  });
