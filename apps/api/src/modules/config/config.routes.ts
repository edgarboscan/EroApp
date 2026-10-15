import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  updateCompanySchema,
  branchSchema,
  warehouseSchema,
  updateBusinessRulesSchema,
  isSuperAdminRole,
} from '@ero/shared';
import { ConfigService } from './config.service';
import { BcvService } from './bcv.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const configRouter = new Hono<AppEnv>();

// ==========================================
// 1. Perfil de Empresa
// ==========================================
configRouter.get('/company', authenticate, authorize('config', 'read'), async (c) => {
  const user = c.get('user');
  try {
    const company = await ConfigService.getCompany(user.companyId);
    return c.json({ success: true, data: company });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'COMPANY_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.put(
  '/company',
  authenticate,
  authorize('config', 'update'),
  zValidator('json', updateCompanySchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const updated = await ConfigService.updateCompany(user.companyId, input);
      return c.json({ success: true, data: updated });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'COMPANY_UPDATE_ERROR', message: error.message } }, 500);
    }
  }
);

// ==========================================
// 2. Sucursales
// ==========================================
configRouter.get('/branches', authenticate, authorize('config', 'read'), async (c) => {
  const user = c.get('user');
  try {
    const branches = await ConfigService.getBranches(user.companyId);
    return c.json({ success: true, data: branches });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'BRANCHES_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.post(
  '/branches',
  authenticate,
  authorize('config', 'create'),
  zValidator('json', branchSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const branch = await ConfigService.createBranch(user.companyId, input);
      return c.json({ success: true, data: branch }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'BRANCH_CREATE_ERROR', message: error.message } }, 500);
    }
  }
);

// ==========================================
// 3. Depósitos / Almacenes
// ==========================================
configRouter.get('/warehouses', authenticate, authorize('config', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId');
  try {
    const warehouses = await ConfigService.getWarehouses(user.companyId, branchId);
    return c.json({ success: true, data: warehouses });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'WAREHOUSES_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.post(
  '/warehouses',
  authenticate,
  authorize('config', 'create'),
  zValidator('json', warehouseSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const warehouse = await ConfigService.createWarehouse(user.companyId, input);
      return c.json({ success: true, data: warehouse }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'WAREHOUSE_CREATE_ERROR', message: error.message } }, 500);
    }
  }
);

// ==========================================
// 4. Reglas de Negocio
// ==========================================
configRouter.get('/business-rules', authenticate, authorize('config', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId');
  try {
    const rules = await ConfigService.getBusinessRules(user.companyId, branchId);
    return c.json({ success: true, data: rules });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'BUSINESS_RULES_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.put(
  '/business-rules',
  authenticate,
  authorize('config', 'update'),
  zValidator('json', updateBusinessRulesSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const rules = await ConfigService.updateBusinessRules(user.companyId, input);
      return c.json({ success: true, data: rules });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'BUSINESS_RULES_UPDATE_ERROR', message: error.message } }, 500);
    }
  }
);

// ==========================================
// 5. Usuarios y Roles
// ==========================================
configRouter.get('/users', authenticate, authorize('config', 'read'), async (c) => {
  const user = c.get('user');
  try {
    const users = await ConfigService.getUsers(user.companyId);
    return c.json({ success: true, data: users });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'USERS_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.post('/users', authenticate, authorize('config', 'write'), async (c) => {
  const user = c.get('user');
  try {
    const body = await c.req.json();
    const newUser = await ConfigService.createUser(user.companyId, body);
    return c.json({ success: true, data: newUser }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'USER_CREATE_ERROR', message: error.message } }, 400);
  }
});

configRouter.put('/users/:id', authenticate, authorize('config', 'write'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const body = await c.req.json();
    const updated = await ConfigService.updateUser(id, user.companyId, body);
    return c.json({ success: true, data: updated });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'USER_UPDATE_ERROR', message: error.message } }, 400);
  }
});

configRouter.patch('/users/:id/status', authenticate, authorize('config', 'write'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const body = await c.req.json();
    const result = await ConfigService.toggleUserStatus(id, user.companyId, body.isActive);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'USER_STATUS_ERROR', message: error.message } }, 400);
  }
});

configRouter.get('/roles', authenticate, authorize('config', 'read'), async (c) => {
  const user = c.get('user');
  try {
    const roles = await ConfigService.getRoles(user.companyId);
    return c.json({ success: true, data: roles });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ROLES_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.get('/permissions', authenticate, authorize('config', 'read'), async (c) => {
  try {
    const permissions = await ConfigService.getPermissions();
    return c.json({ success: true, data: permissions });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PERMISSIONS_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.post('/roles', authenticate, authorize('config', 'write'), async (c) => {
  const user = c.get('user');
  try {
    const body = await c.req.json();
    const newRole = await ConfigService.createRole(user.companyId, body);
    return c.json({ success: true, data: newRole }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ROLE_CREATE_ERROR', message: error.message } }, 400);
  }
});

configRouter.put('/roles/:id', authenticate, authorize('config', 'write'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const body = await c.req.json();
    const updated = await ConfigService.updateRole(id, user.companyId, body);
    return c.json({ success: true, data: updated });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ROLE_UPDATE_ERROR', message: error.message } }, 400);
  }
});

// ==========================================
// 6. Tasa de Cambio Oficial (BCV / Sistema)
// ==========================================
configRouter.get('/exchange-rate', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const rateData = await ConfigService.getExchangeRate(user.companyId);
    return c.json({ success: true, data: rateData });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'RATE_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.get('/exchange-rate/history', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const limit = Number(c.req.query('limit')) || 50;
    const history = await ConfigService.getExchangeRateHistory(user.companyId, limit);
    return c.json({ success: true, data: history });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'RATE_HISTORY_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.get('/exchange-rate/by-date', authenticate, async (c) => {
  const user = c.get('user');
  const targetDate = c.req.query('date') || new Date().toISOString().split('T')[0];
  try {
    const rate = await ConfigService.getExchangeRateForDate(user.companyId, targetDate);
    return c.json({ success: true, data: { rate, targetDate } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'RATE_BY_DATE_FETCH_ERROR', message: error.message } }, 500);
  }
});

configRouter.put('/exchange-rate', authenticate, async (c) => {
  const user = c.get('user');
  // Validar permisos: solo usuarios autorizados pueden modificar la tasa oficial
  const isSuperAdmin = isSuperAdminRole(user.role);
  const hasRatePerm = user.permissions.includes('pricing.exchange_rate') ||
                      user.permissions.includes('pricing.bulk_update') ||
                      user.permissions.includes('config.write');

  if (!isSuperAdmin && !hasRatePerm) {
    return c.json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'No cuenta con permisos autorizados para modificar la tasa de cambio oficial' }
    }, 403);
  }

  try {
    const body = await c.req.json();
    const result = await ConfigService.updateExchangeRate(
      user.companyId,
      body,
      user.sub,
      user.username
    );
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'RATE_UPDATE_ERROR', message: error.message } }, 400);
  }
});

// ==========================================
// 6.1 Consulta y Sincronización en Vivo del BCV
// ==========================================
configRouter.get('/exchange-rate/bcv-live', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const bcvData = await BcvService.getOfficialRate();
    const currentRateData = await ConfigService.getExchangeRate(user.companyId);

    const difference = Number((bcvData.rate - currentRateData.rate).toFixed(4));
    const needsUpdate = Math.abs(difference) > 0.0001;

    return c.json({
      success: true,
      data: {
        bcvRate: bcvData.rate,
        bcvEffectiveDate: bcvData.effectiveDate,
        bcvFormattedDate: bcvData.formattedDate,
        currentSystemRate: currentRateData.rate,
        difference,
        needsUpdate,
        source: bcvData.source,
        fetchedAt: bcvData.fetchedAt,
      },
    });
  } catch (error: any) {
    return c.json(
      { success: false, error: { code: 'BCV_FETCH_ERROR', message: error.message } },
      502
    );
  }
});

configRouter.post('/exchange-rate/sync-bcv', authenticate, async (c) => {
  const user = c.get('user');
  const isSuperAdmin = isSuperAdminRole(user.role);
  const hasRatePerm =
    user.permissions.includes('pricing.exchange_rate') ||
    user.permissions.includes('pricing.bulk_update') ||
    user.permissions.includes('config.write');

  if (!isSuperAdmin && !hasRatePerm) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No cuenta con permisos autorizados para sincronizar la tasa de cambio oficial',
        },
      },
      403
    );
  }

  try {
    const bcvData = await BcvService.getOfficialRate();
    const notes = 'Sincronización automática desde la página oficial del Banco Central de Venezuela (BCV)';

    const result = await ConfigService.updateExchangeRate(
      user.companyId,
      {
        rate: bcvData.rate,
        source: bcvData.source,
        effectiveDate: bcvData.effectiveDate,
        notes,
      },
      user.sub,
      user.username
    );

    return c.json({
      success: true,
      data: {
        ...result,
        bcvFormattedDate: bcvData.formattedDate,
        notes,
      },
    });
  } catch (error: any) {
    return c.json(
      { success: false, error: { code: 'BCV_SYNC_ERROR', message: error.message } },
      500
    );
  }
});
