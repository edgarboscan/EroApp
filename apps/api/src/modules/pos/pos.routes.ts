import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  posSaleSubmitSchema,
  openCashShiftSchema,
  closeCashShiftSchema,
  cashMovementSchema,
  generateFiscalReportSchema,
} from '@ero/shared';
import { POSService } from './pos.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const posRouter = new Hono<AppEnv>();

// GET /api/pos/registers - Lista de cajas registradoras por sucursal
posRouter.get('/registers', authenticate, authorize('pos', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  if (!branchId) {
    return c.json({ success: false, error: { code: 'BRANCH_REQUIRED', message: 'Se requiere branchId' } }, 400);
  }

  try {
    const registers = await POSService.getCashRegisters(user.companyId, branchId);
    return c.json({ success: true, data: registers });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'REGISTERS_FETCH_FAILED', message: error.message } }, 500);
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
