import { Context, Next } from 'hono';
import { ModuleType, ActionType, isSuperAdminRole } from '@ero/shared';
import { AppEnv } from './auth';

/**
 * Middleware RBAC granular: verifica que el usuario posea el permiso requerido
 * Soporta permisos únicos (module, action) o múltiples alternativas permitidas (['inventory.read', 'pos.read'])
 * Formato del permiso: `${module}.${action}` (ej: `pricing.bulk_update`, `sales.create`)
 */
export function authorize(
  moduleOrPermissions: ModuleType | string | string[],
  action?: ActionType | string
) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Usuario no autenticado' },
      }, 401);
    }

    // Super Admin tiene bypass total
    if (isSuperAdminRole(user.role)) {
      return await next();
    }

    const userPermissions: string[] = user.permissions || [];

    if (Array.isArray(moduleOrPermissions)) {
      const hasAny = moduleOrPermissions.some((perm) => userPermissions.includes(perm));
      if (!hasAny) {
        return c.json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `No posee privilegios suficientes para realizar esta acción (requiere al menos uno de: ${moduleOrPermissions.join(', ')})`,
          },
        }, 403);
      }
    } else {
      const requiredPermission = action ? `${moduleOrPermissions}.${action}` : String(moduleOrPermissions);
      if (!userPermissions.includes(requiredPermission)) {
        return c.json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `No posee privilegios suficientes para realizar esta acción (${requiredPermission})`,
          },
        }, 403);
      }
    }

    await next();
  };
}

/**
 * Middleware ABAC para validar acceso a la sucursal activa
 */
export async function validateBranchAccess(c: Context, next: Next) {
  const user = c.get('user');
  const activeBranchId = c.get('activeBranchId');

  if (!isSuperAdminRole(user.role) && activeBranchId) {
    const userBranches: string[] = user.branches || [];
    if (!userBranches.includes(activeBranchId)) {
      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN_BRANCH',
          message: 'No tiene autorización para operar en la sucursal seleccionada',
        },
      }, 403);
    }
  }

  await next();
}
