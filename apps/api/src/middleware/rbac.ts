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

    const targetModule = Array.isArray(moduleOrPermissions)
      ? (typeof moduleOrPermissions[0] === 'string' ? moduleOrPermissions[0].split('.')[0] : null)
      : String(moduleOrPermissions).split('.')[0];

    // Validación de licencia integral y bloqueo para usuarios no super_admin
    if (user.companyId) {
      const { LicensesService } = await import('../modules/licenses/licenses.service');
      const lic = await LicensesService.getLicense(user.companyId);

      const isLicenseOperation =
        targetModule === 'licenses' ||
        c.req.path.startsWith('/api/licenses') ||
        (targetModule === 'config' && action === 'read' && c.req.path.includes('/licenses'));

      // Regla: Cuando la licencia esté bloqueada, solo se permite abrir el módulo de licenciamiento a usuarios no superadmin
      if (!lic.isActive || lic.status !== 'ACTIVE') {
        if (!isLicenseOperation) {
          return c.json({
            success: false,
            error: {
              code: 'LICENSE_LOCKED',
              message: `El sistema se encuentra bloqueado debido a que la licencia está inactiva o expirada (Estado: ${lic.status}). Solo se permite el acceso al módulo de licenciamiento para reactivar la plataforma.`,
            },
          }, 403);
        }
      }

      // Validación de licencia por módulo del sistema
      const LICENSED_MODULES = [
        'dashboards', 'pos', 'inventory', 'pricing', 'sales', 'customers',
        'receivables', 'purchases', 'suppliers', 'payables', 'treasury',
        'taxes', 'reports', 'audit', 'restaurant', 'accounting'
      ];

      if (targetModule && LICENSED_MODULES.includes(targetModule)) {
        const isAllowed = await LicensesService.isModuleAllowed(user.companyId, targetModule);
        if (!isAllowed) {
          return c.json({
            success: false,
            error: {
              code: 'MODULE_NOT_LICENSED',
              message: `El módulo '${targetModule}' no está incluido o habilitado en la licencia activa de su empresa.`,
            },
          }, 403);
        }
      }
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
