import { jwt } from '@elysiajs/jwt';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'supplier';
  supplier_id: number | null;
}

export const jwtPlugin = jwt({
  name: 'jwt',
  secret: process.env.JWT_SECRET || 'mugi-berkah-scm-togaf-secret-key-2026',
  exp: '2h',
});

export interface JwtVerifier {
  verify: (token?: string) => Promise<Record<string, unknown> | false>;
  sign: (payload: Record<string, string | number | null>) => Promise<string>;
}

/**
 * Mengekstrak dan memverifikasi token JWT dari header Authorization: Bearer <token>
 */
export async function verifyAuth(
  jwtInstance: JwtVerifier,
  headers: Record<string, string | undefined>,
  set: { status?: number | string }
): Promise<AuthUser | null> {
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    set.status = 401;
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    set.status = 401;
    return null;
  }

  const payload = await jwtInstance.verify(token);
  if (!payload || typeof payload !== 'object' || !payload.id || !payload.role) {
    set.status = 401;
    return null;
  }

  return {
    id: Number(payload.id),
    name: String(payload.name || ''),
    email: String(payload.email || ''),
    role: payload.role === 'admin' ? 'admin' : 'supplier',
    supplier_id:
      payload.supplier_id !== null && payload.supplier_id !== undefined
        ? Number(payload.supplier_id)
        : null,
  };
}

/**
 * Memastikan pengguna terautentikasi dan memiliki peran 'admin'
 */
export async function verifyAdmin(
  jwtInstance: JwtVerifier,
  headers: Record<string, string | undefined>,
  set: { status?: number | string }
): Promise<AuthUser | null> {
  const user = await verifyAuth(jwtInstance, headers, set);
  if (!user) return null;

  if (user.role !== 'admin') {
    set.status = 403;
    return null;
  }

  return user;
}
