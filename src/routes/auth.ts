import { Elysia, t } from 'elysia';
import { supabase } from '../config/supabase.ts';
import { jwtPlugin, verifyAuth } from '../middleware/auth.ts';

const FALLBACK_DEMO_ACCOUNTS = [
  {
    id: 1,
    name: 'Rangga — Admin Gudang Mugi Berkah',
    email: 'admin@mugiberkah.id',
    role: 'admin',
    supplier_id: null,
    supplier_name: 'Internal Mugi Berkah',
    supplier_category: 'Gudang & Purchasing',
  },
  {
    id: 2,
    name: 'Hendri — PT Nusantara Roastery Bandung',
    email: 'roastery@nusantara.id',
    role: 'supplier',
    supplier_id: 1,
    supplier_name: 'PT Nusantara Roastery Bandung',
    supplier_category: 'Kopi',
  },
  {
    id: 3,
    name: 'Siti — CV Lembang Dairy Fresh',
    email: 'dairy@lembangfresh.id',
    role: 'supplier',
    supplier_id: 2,
    supplier_name: 'CV Lembang Dairy Fresh',
    supplier_category: 'Dairy & Sirup',
  },
  {
    id: 4,
    name: "Budi — UD Baker's Choice Pastry Supply",
    email: 'pastry@bakerschoice.id',
    role: 'supplier',
    supplier_id: 3,
    supplier_name: "UD Baker's Choice Pastry Supply",
    supplier_category: 'Bahan Pastry',
  },
];

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(jwtPlugin)
  .get('/demo-accounts', async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, supplier_id, suppliers(name, category)')
        .order('id', { ascending: true });

      if (error || !data || data.length === 0) {
        return { accounts: FALLBACK_DEMO_ACCOUNTS };
      }

      const accounts = data.map((u: Record<string, unknown>) => {
        const sup = u.suppliers as { name?: string; category?: string } | null;
        return {
          id: Number(u.id),
          name: String(u.name),
          email: String(u.email),
          role: String(u.role),
          supplier_id: u.supplier_id ? Number(u.supplier_id) : null,
          supplier_name: sup?.name || (u.role === 'admin' ? 'Internal Mugi Berkah' : '-'),
          supplier_category: sup?.category || (u.role === 'admin' ? 'Gudang & Purchasing' : '-'),
        };
      });

      return { accounts };
    } catch {
      return { accounts: FALLBACK_DEMO_ACCOUNTS };
    }
  })
  .post(
    '/login',
    async ({ body, jwt, set }) => {
      const email = body.email.trim().toLowerCase();
      const password = body.password;

      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, password, role, supplier_id, suppliers(id, name, category)')
        .ilike('email', email)
        .maybeSingle();

      if (error) {
        set.status = 500;
        return {
          error: `Gagal menghubungi database Supabase: ${error.message}. Pastikan .env dan schema.sql sudah dijalankan.`,
        };
      }

      if (!user) {
        set.status = 401;
        return { error: 'Email atau kata sandi tidak ditemukan.' };
      }

      const storedPassword = String(user.password || '');
      let isPasswordValid = false;

      if (storedPassword.startsWith('$argon2') || storedPassword.startsWith('$2')) {
        isPasswordValid = await Bun.password.verify(password, storedPassword);
      } else {
        isPasswordValid = password === storedPassword;
      }

      if (!isPasswordValid) {
        set.status = 401;
        return { error: 'Kata sandi yang Anda masukkan salah.' };
      }

      const supplierObj = user.suppliers as unknown as {
        id?: number;
        name?: string;
        category?: string;
      } | null;

      const userPayload = {
        id: Number(user.id),
        name: String(user.name),
        email: String(user.email),
        role: (user.role === 'admin' ? 'admin' : 'supplier') as 'admin' | 'supplier',
        supplier_id: user.supplier_id ? Number(user.supplier_id) : null,
        supplier_name:
          supplierObj?.name || (user.role === 'admin' ? 'Gudang Utama Mugi Berkah' : null),
        supplier_category: supplierObj?.category || null,
      };

      const token = await jwt.sign({
        id: userPayload.id,
        name: userPayload.name,
        email: userPayload.email,
        role: userPayload.role,
        supplier_id: userPayload.supplier_id,
      });

      return {
        token,
        user: userPayload,
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
      }),
    }
  )
  .get('/me', async ({ jwt, headers, set }) => {
    const authUser = await verifyAuth(jwt, headers, set);
    if (!authUser) {
      return { error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' };
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, supplier_id, suppliers(id, name, category)')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error || !user) {
      set.status = 401;
      return { error: 'Pengguna tidak ditemukan.' };
    }

    const supplierObj = user.suppliers as unknown as {
      id?: number;
      name?: string;
      category?: string;
    } | null;

    return {
      user: {
        id: Number(user.id),
        name: String(user.name),
        email: String(user.email),
        role: user.role,
        supplier_id: user.supplier_id ? Number(user.supplier_id) : null,
        supplier_name:
          supplierObj?.name || (user.role === 'admin' ? 'Gudang Utama Mugi Berkah' : null),
        supplier_category: supplierObj?.category || null,
      },
    };
  });
