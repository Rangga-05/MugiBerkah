import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { isSupabaseConfigured } from './config/supabase.ts';
import { authRoutes } from './routes/auth.ts';
import { dashboardRoutes } from './routes/dashboard.ts';
import { suppliersRoutes } from './routes/suppliers.ts';
import { materialsRoutes } from './routes/materials.ts';
import { purchaseOrdersRoutes } from './routes/purchaseOrders.ts';
import { stockMovementsRoutes } from './routes/stockMovements.ts';

const PORT = Number(process.env.PORT || 3000);

const app = new Elysia()
  // Endpoint kesehatan sistem & status konfigurasi
  .get('/api/health', () => ({
    status: 'ok',
    service: 'SCM Kedai Kopi & Pastry Mugi Berkah',
    architecture: 'TOGAF 4 Pillars (Business, Data, Application, Technology)',
    supabase_configured: isSupabaseConfigured,
    timestamp: new Date().toISOString(),
  }))
  // Registrasi seluruh modul REST API (Pilar 3 TOGAF)
  .use(authRoutes)
  .use(dashboardRoutes)
  .use(suppliersRoutes)
  .use(materialsRoutes)
  .use(purchaseOrdersRoutes)
  .use(stockMovementsRoutes)
  // Route utama menyajikan SPA public/index.html secara langsung (selalu baca file terbaru tanpa cache)
  .get('/', ({ set }) => {
    set.headers['cache-control'] = 'no-store';
    return Bun.file('public/index.html');
  })
  .get('/js/app.js', ({ set }) => {
    set.headers['cache-control'] = 'no-store';
    return Bun.file('public/js/app.js');
  })
  // Sajikan aset statis lain dari folder public/ tanpa static pre-cache
  .use(
    staticPlugin({
      assets: 'public',
      prefix: '/',
      alwaysStatic: false,
    })
  )
  .listen(PORT);

console.log(`
========================================================================
☕  SCM KEDAI KOPI & PASTRY "MUGI BERKAH" (TOGAF Enterprise Architecture)
========================================================================
🚀  Server berjalan di : http://localhost:${app.server?.port || PORT}
🗄️  Status Supabase    : ${isSupabaseConfigured ? 'TERKONFIGURASI ✅' : 'BELUM DIKONFIGURASI (.env) ⚠️'}
========================================================================
`);

export type App = typeof app;
