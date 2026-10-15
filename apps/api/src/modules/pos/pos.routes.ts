import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  posSaleSubmitSchema,
  openCashShiftSchema,
  closeCashShiftSchema,
  cashMovementSchema,
  generateFiscalReportSchema,
  cashRegisterSchema,
  paymentMethodSchema,
  isSuperAdminRole,
} from '@ero/shared';
import { POSService } from './pos.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const posRouter = new Hono<AppEnv>();

// GET /api/pos/payment-methods - Métodos de pago configurados
posRouter.get('/payment-methods', authenticate, async (c) => {
  const user = c.get('user');
  const all = c.req.query('all') === 'true';

  try {
    const methods = await POSService.getPaymentMethods(user.companyId, !all);
    return c.json({ success: true, data: methods });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PAYMENT_METHODS_FETCH_FAILED', message: error.message } }, 500);
  }
});

// POST /api/pos/payment-methods - Crear nuevo método de pago
posRouter.post('/payment-methods', authenticate, async (c) => {
  const user = c.get('user');
  const isSuper = isSuperAdminRole(user.role);
  const canConfig = user.permissions.includes('config.write') || user.permissions.includes('pos.create') || isSuper;
  if (!canConfig) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para crear métodos de pago' } }, 403);
  }

  try {
    const body = await c.req.json();
    const parsed = paymentMethodSchema.parse(body);
    const method = await POSService.createPaymentMethod(user.companyId, parsed);
    return c.json({ success: true, data: method }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PAYMENT_METHOD_CREATE_FAILED', message: error.message } }, 400);
  }
});

// PUT /api/pos/payment-methods/:id - Actualizar método de pago
posRouter.put('/payment-methods/:id', authenticate, async (c) => {
  const user = c.get('user');
  const isSuper = isSuperAdminRole(user.role);
  const canConfig = user.permissions.includes('config.write') || user.permissions.includes('pos.update') || isSuper;
  if (!canConfig) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para editar métodos de pago' } }, 403);
  }

  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const method = await POSService.updatePaymentMethod(id, user.companyId, body);
    return c.json({ success: true, data: method });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PAYMENT_METHOD_UPDATE_FAILED', message: error.message } }, 400);
  }
});

// DELETE /api/pos/payment-methods/:id - Desactivar método de pago
posRouter.delete('/payment-methods/:id', authenticate, async (c) => {
  const user = c.get('user');
  const isSuper = isSuperAdminRole(user.role);
  const canConfig = user.permissions.includes('config.write') || user.permissions.includes('pos.delete') || isSuper;
  if (!canConfig) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para eliminar métodos de pago' } }, 403);
  }

  const id = c.req.param('id');
  try {
    await POSService.deletePaymentMethod(id, user.companyId);
    return c.json({ success: true, message: 'Método de pago desactivado' });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PAYMENT_METHOD_DELETE_FAILED', message: error.message } }, 400);
  }
});

// GET /api/pos/registers - Lista de cajas registradoras (por sucursal o toda la empresa)
posRouter.get('/registers', authenticate, authorize('pos', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || undefined;

  try {
    const registers = await POSService.getCashRegisters(user.companyId, branchId);
    return c.json({ success: true, data: registers });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'REGISTERS_FETCH_FAILED', message: error.message } }, 500);
  }
});

// POST /api/pos/registers - Crear nueva caja registradora
posRouter.post('/registers', authenticate, async (c) => {
  const user = c.get('user');
  const isSuper = isSuperAdminRole(user.role);
  const canConfig = user.permissions.includes('config.write') || user.permissions.includes('pos.create') || isSuper;
  if (!canConfig) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para crear cajas registradoras' } }, 403);
  }

  try {
    const body = await c.req.json();
    const parsed = cashRegisterSchema.parse(body);
    const register = await POSService.createCashRegister(user.companyId, parsed);
    return c.json({ success: true, data: register }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'REGISTER_CREATE_FAILED', message: error.message } }, 400);
  }
});

// PUT /api/pos/registers/:id - Actualizar caja registradora
posRouter.put('/registers/:id', authenticate, async (c) => {
  const user = c.get('user');
  const isSuper = isSuperAdminRole(user.role);
  const canConfig = user.permissions.includes('config.write') || user.permissions.includes('pos.update') || isSuper;
  if (!canConfig) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para editar cajas registradoras' } }, 403);
  }

  const id = c.req.param('id');
  if (!id) {
    return c.json({ success: false, error: { code: 'ID_REQUIRED', message: 'El identificador de la caja es requerido' } }, 400);
  }

  try {
    const body = await c.req.json();
    const updated = await POSService.updateCashRegister(user.companyId, id, body);
    return c.json({ success: true, data: updated });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'REGISTER_UPDATE_FAILED', message: error.message } }, 400);
  }
});

// DELETE /api/pos/registers/:id - Desactivar caja registradora
posRouter.delete('/registers/:id', authenticate, async (c) => {
  const user = c.get('user');
  const isSuper = isSuperAdminRole(user.role);
  const canConfig = user.permissions.includes('config.write') || user.permissions.includes('pos.delete') || isSuper;
  if (!canConfig) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para desactivar cajas registradoras' } }, 403);
  }

  const id = c.req.param('id');
  if (!id) {
    return c.json({ success: false, error: { code: 'ID_REQUIRED', message: 'El identificador de la caja es requerido' } }, 400);
  }

  try {
    await POSService.deleteCashRegister(user.companyId, id);
    return c.json({ success: true, message: 'Caja registradora desactivada exitosamente' });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'REGISTER_DELETE_FAILED', message: error.message } }, 400);
  }
});

// GET /api/pos/shifts/current - Turno actualmente abierto del cajero en la sucursal
posRouter.get('/shifts/current', authenticate, authorize('pos', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  if (!branchId) {
    return c.json({ success: false, error: { code: 'BRANCH_REQUIRED', message: 'Se requiere branchId' } }, 400);
  }

  try {
    const shift = await POSService.getCurrentShift(user.companyId, user.sub, branchId);
    return c.json({ success: true, data: shift });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'SHIFT_FETCH_FAILED', message: error.message } }, 500);
  }
});

const validationHook = (result: any, c: any) => {
  if (!result.success) {
    const errorMsg = result.error.errors.map((e: any) => `${e.path.join('.') || 'body'}: ${e.message}`).join(', ');
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMsg } }, 400);
  }
};

// POST /api/pos/shifts/open - Apertura de turno de caja
posRouter.post(
  '/shifts/open',
  authenticate,
  authorize('pos', 'read'),
  zValidator('json', openCashShiftSchema, validationHook),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await POSService.openShift(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'OPEN_SHIFT_FAILED', message: error.message } }, 400);
    }
  }
);

// POST /api/pos/shifts/close - Cierre y arqueo de turno de caja
posRouter.post(
  '/shifts/close',
  authenticate,
  authorize('pos', 'close_register'),
  zValidator('json', closeCashShiftSchema, validationHook),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await POSService.closeShift(user.companyId, user.sub, body);
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CLOSE_SHIFT_FAILED', message: error.message } }, 400);
    }
  }
);

// POST /api/pos/shifts/movements - Registrar entrada / salida de efectivo
posRouter.post(
  '/shifts/movements',
  authenticate,
  authorize('pos', 'read'),
  zValidator('json', cashMovementSchema, validationHook),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await POSService.registerCashMovement(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CASH_MOVEMENT_FAILED', message: error.message } }, 400);
    }
  }
);

// POST /api/pos/sales - Procesa una venta en caja
posRouter.post(
  '/sales',
  authenticate,
  authorize('pos', 'read'),
  zValidator('json', posSaleSubmitSchema, validationHook),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    try {
      const result = await POSService.processSale(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'SALE_FAILED', message: error.message } }, 400);
    }
  }
);

// POST /api/pos/fiscal-reports - Emisión de Reporte Fiscal X o Z
posRouter.post(
  '/fiscal-reports',
  authenticate,
  authorize('pos', 'close_register'),
  zValidator('json', generateFiscalReportSchema, validationHook),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await POSService.generateFiscalReport(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'FISCAL_REPORT_FAILED', message: error.message } }, 400);
    }
  }
);

// GET /api/pos/fiscal-reports - Historial de Reportes Fiscales emitidos
posRouter.get('/fiscal-reports', authenticate, authorize('pos', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  if (!branchId) {
    return c.json({ success: false, error: { code: 'BRANCH_REQUIRED', message: 'Se requiere branchId' } }, 400);
  }

  try {
    const reports = await POSService.getFiscalReportsHistory(user.companyId, branchId);
    return c.json({ success: true, data: reports });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'FISCAL_REPORTS_FETCH_FAILED', message: error.message } }, 500);
  }
});
