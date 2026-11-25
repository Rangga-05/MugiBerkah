import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseServiceKey &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseServiceKey.includes('your-supabase-service-role-key')
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️  [PERINGATAN] SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi dengan benar di file .env'
  );
}

// Gunakan fallback URL dummy saat variabel belum diisi agar proses import tidak crash saat typecheck
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseServiceKey || 'placeholder-service-role-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
