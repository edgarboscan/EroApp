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
  verifyCashShiftSchema,
  depositCashShiftSchema,
  resolveDiscrepancySchema,
  isSuperAdminRole,
  isSupervisorOrAdminRole,
} from '@ero/shared';
import { POSService } from './pos.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { query } from '../../db';
import { generateCashShiftVoucherPDF } from '../reports/reports-pdf';
import { ReportsService } from '../reports/reports.service';

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

  const id = c.req.param('id')!;
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

  const id = c.req.param('id')!;
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
  const branchId = c.req.query('branchId') || c.req.query('branch_id') || undefined;
  const acceptsOrdersOnly = c.req.query('acceptsOrders') === 'true' || c.req.query('accepts_orders') === 'true';

  try {
    const registers = await POSService.getCashRegisters(user.companyId, branchId, acceptsOrdersOnly);
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
    const result = await POSService.deleteCashRegister(user.companyId, id);
    return c.json(result);
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

// GET /api/pos/shifts/audit - Lista de turnos cerrados para auditoría y verificación
posRouter.get('/shifts/audit', authenticate, async (c) => {
  const user = c.get('user');
  const canAudit = user.permissions.includes('pos.audit_shifts') || isSupervisorOrAdminRole(user.role) || isSuperAdminRole(user.role);
  if (!canAudit) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para auditar turnos de caja' } }, 403);
  }

  const branchId = c.req.query('branchId') || undefined;
  const verificationStatus = c.req.query('verificationStatus') || undefined;
  const hasDiscrepancy = c.req.query('hasDiscrepancy');
  const startDate = c.req.query('startDate') || undefined;
  const endDate = c.req.query('endDate') || undefined;

  try {
    const shifts = await POSService.getShiftsForAudit(user.companyId, {
      branchId,
      verificationStatus,
      hasDiscrepancy: hasDiscrepancy !== undefined ? hasDiscrepancy === 'true' : undefined,
      startDate,
      endDate,
    });
    return c.json({ success: true, data: shifts });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'AUDIT_SHIFTS_FETCH_FAILED', message: error.message } }, 500);
  }
});

// GET /api/pos/audit-notifications - Alertas y notificaciones de discrepancias en cierres
posRouter.get('/audit-notifications', authenticate, async (c) => {
  const user = c.get('user');
  const canAudit = user.permissions.includes('pos.audit_shifts') || isSupervisorOrAdminRole(user.role) || isSuperAdminRole(user.role);
  if (!canAudit) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para consultar alertas de auditoría' } }, 403);
  }

  const onlyUnresolved = c.req.query('all') !== 'true';

  try {
    const notifications = await POSService.getCashAuditNotifications(user.companyId, onlyUnresolved);
    return c.json({ success: true, data: notifications });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'AUDIT_NOTIFICATIONS_FETCH_FAILED', message: error.message } }, 500);
  }
});

// POST /api/pos/audit-notifications/:id/resolve - Resolver alerta de discrepancia
posRouter.post(
  '/audit-notifications/:id/resolve',
  authenticate,
  zValidator('json', resolveDiscrepancySchema, validationHook),
  async (c) => {
    const user = c.get('user');
    const canAudit = user.permissions.includes('pos.audit_shifts') || isSupervisorOrAdminRole(user.role) || isSuperAdminRole(user.role);
    if (!canAudit) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para resolver alertas de auditoría' } }, 403);
    }

    const id = c.req.param('id')!;
    const body = c.req.valid('json');

    try {
      const result = await POSService.resolveDiscrepancyNotification(id, user.companyId, user.sub, body.resolutionNotes);
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'RESOLVE_NOTIFICATION_FAILED', message: error.message } }, 400);
    }
  }
);

// GET /api/pos/shifts/:id/audit-details - Detalle completo de auditoría para un turno
posRouter.get('/shifts/:id/audit-details', authenticate, async (c) => {
  const user = c.get('user');
  const canAudit = user.permissions.includes('pos.audit_shifts') || isSupervisorOrAdminRole(user.role) || isSuperAdminRole(user.role);
  if (!canAudit) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para auditar turnos de caja' } }, 403);
  }

  const shiftId = c.req.param('id')!;

  try {
    const details = await POSService.getShiftAuditDetails(shiftId, user.companyId);
    return c.json({ success: true, data: details });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'SHIFT_AUDIT_DETAILS_FAILED', message: error.message } }, 400);
  }
});

// POST /api/pos/shifts/:id/verify - Dictamen y verificación del arqueo por supervisor
posRouter.post(
  '/shifts/:id/verify',
  authenticate,
  zValidator('json', verifyCashShiftSchema, validationHook),
  async (c) => {
    const user = c.get('user');
    const canAudit = user.permissions.includes('pos.audit_shifts') || isSupervisorOrAdminRole(user.role) || isSuperAdminRole(user.role);
    if (!canAudit) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para verificar turnos de caja' } }, 403);
    }

    const shiftId = c.req.param('id')!;
    const body = c.req.valid('json');

    try {
      const result = await POSService.verifyShift(shiftId, user.companyId, user.sub, body);
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'VERIFY_SHIFT_FAILED', message: error.message } }, 400);
    }
  }
);

// POST /api/pos/shifts/:id/deposits - Registrar depósitos bancarios del turno (efectivo y transacciones electrónicas)
posRouter.post(
  '/shifts/:id/deposits',
  authenticate,
  zValidator('json', depositCashShiftSchema, validationHook),
  async (c) => {
    const user = c.get('user');
    const canAudit = user.permissions.includes('pos.audit_shifts') || isSupervisorOrAdminRole(user.role) || isSuperAdminRole(user.role);
    if (!canAudit) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No cuenta con permisos para registrar depósitos bancarios de turnos' } }, 403);
    }

    const shiftId = c.req.param('id')!;
    const body = c.req.valid('json');

    try {
      const result = await POSService.registerShiftDeposits(shiftId, user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'REGISTER_DEPOSITS_FAILED', message: error.message } }, 400);
    }
  }
);

// GET /api/pos/shifts/:id/pdf - Descarga / Visualización de comprobante y acta de cierre de caja
posRouter.get('/shifts/:id/pdf', authenticate, authorize('pos', 'read'), async (c) => {
  const user = c.get('user');
  const shiftId = c.req.param('id')!;

  try {
    const shift = await POSService.getShiftById(user.companyId, shiftId);
    if (!shift) {
      return c.json({ success: false, error: { code: 'SHIFT_NOT_FOUND', message: 'Turno de caja no encontrado' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateCashShiftVoucherPDF({
      company,
      shift,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="cierre_caja_${shift.cashRegisterCode || '01'}_${shift.id.slice(0, 8)}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[POS Shift PDF Error]', error);
    return c.json({ success: false, error: { code: 'SHIFT_PDF_FAILED', message: error.message } }, 500);
  }
});

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

// POST /api/pos/authorize-supervisor - Autorización de supervisor para operaciones especiales (ej. stock negativo)
posRouter.post('/authorize-supervisor', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const body = await c.req.json();
    const result = await POSService.authorizeSupervisor(user.companyId, user.sub, body);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'SUPERVISOR_AUTH_FAILED', message: error.message } }, 400);
  }
});

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
