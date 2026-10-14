import { Context, Next } from 'hono';
import * as jose from 'jose';
import { UserTokenPayload } from '@ero/shared';

export type AppVariables = {
  user: UserTokenPayload;
  activeBranchId?: string;
  activeWarehouseId?: string;
};

export type AppEnv = {
  Variables: AppVariables;
};

// Secreto de fallback para desarrollo si no se especifican llaves asimétricas RS256
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'ero_erp_enterprise_secret_key_2026_very_long_and_secure');

export async function authenticate(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token de autorización ausente o inválido',
      },
    }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    c.set('user', payload as unknown as UserTokenPayload);
    
    // Asignar contexto de sucursal activa desde header o default del token
    const requestedBranch = c.req.header('X-Branch-Id') || (payload as any).branchId;
    const requestedWarehouse = c.req.header('X-Warehouse-Id') || (payload as any).warehouseId;
    
    c.set('activeBranchId', requestedBranch);
    c.set('activeWarehouseId', requestedWarehouse);

    await next();
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED_OR_INVALID',
        message: 'La sesión ha expirado o el token es inválido',
      },
    }, 401);
  }
}
