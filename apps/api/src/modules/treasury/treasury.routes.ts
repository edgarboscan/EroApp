import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  bankAccountSchema,
  bankMovementSchema,
  transferBetweenAccountsSchema,
  reconcileStatementSchema,
  bulkReconcileMovementsSchema,
} from '@ero/shared';
import { TreasuryService } from './treasury.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const treasuryRouter = new Hono<AppEnv>();

// GET /api/treasury/banks - Catálogo de bancos nacionales
treasuryRouter.get('/banks', authenticate, async (c) => {
  const data = await TreasuryService.getBanks();
  return c.json({ success: true, data });
});

// GET /api/treasury/accounts - Listado de cuentas bancarias de la empresa (con soporte de sucursal)
treasuryRouter.get('/accounts', authenticate, authorize('treasury', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId');
  const data = await TreasuryService.getBankAccounts(user.companyId, branchId);
  return c.json({ success: true, data });
});

// GET /api/treasury/accounts/:id - Detalle de cuenta bancaria con saldos real y libros
treasuryRouter.get('/accounts/:id', authenticate, authorize('treasury', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await TreasuryService.getAccountById(id!, user.companyId);
  return c.json({ success: true, data });
});

// POST /api/treasury/accounts - Registrar nueva cuenta bancaria
treasuryRouter.post('/accounts', authenticate, authorize('treasury', 'create'), zValidator('json', bankAccountSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await TreasuryService.createBankAccount(user.companyId, body);
  return c.json({ success: true, data }, 201);
});

// GET /api/treasury/accounts/:id/movements - Libro de movimientos con filtros avanzados
treasuryRouter.get('/accounts/:id/movements', authenticate, authorize('treasury', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const isReconciled = c.req.query('isReconciled') !== undefined ? c.req.query('isReconciled') === 'true' : undefined;
  const movementType = c.req.query('movementType');
  const direction = c.req.query('direction') as 'INFLOW' | 'OUTFLOW' | undefined;
  const search = c.req.query('search');
  const minAmount = c.req.query('minAmount') ? Number(c.req.query('minAmount')) : undefined;
  const maxAmount = c.req.query('maxAmount') ? Number(c.req.query('maxAmount')) : undefined;

  const data = await TreasuryService.getAccountMovements(id!, user.companyId, {
    fromDate,
    toDate,
    isReconciled,
    movementType,
    direction,
    search,
    minAmount,
    maxAmount,
  });
  return c.json({ success: true, data });
});

// POST /api/treasury/movements - Registrar movimiento manual (depósito, retiro, comisión)
treasuryRouter.post('/movements', authenticate, authorize('treasury', 'create'), zValidator('json', bankMovementSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await TreasuryService.registerMovement(user.companyId, user.sub, body);
  return c.json({ success: true, data }, 201);
});

// PATCH /api/treasury/movements/:id/toggle-reconcile - Conciliar o desconciliar movimiento individual
treasuryRouter.patch('/movements/:id/toggle-reconcile', authenticate, authorize('treasury', 'reconcile'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const isReconciledTarget = body.isReconciled !== undefined ? Boolean(body.isReconciled) : undefined;
  const data = await TreasuryService.toggleMovementReconciled(user.companyId, id!, isReconciledTarget);
  return c.json({ success: true, data });
});

// POST /api/treasury/movements/bulk-reconcile - Conciliación en lote de movimientos seleccionados
treasuryRouter.post('/movements/bulk-reconcile', authenticate, authorize('treasury', 'reconcile'), zValidator('json', bulkReconcileMovementsSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await TreasuryService.bulkReconcileMovements(user.companyId, body);
  return c.json({ success: true, data });
});

// POST /api/treasury/transfers - Transferencia entre cuentas bancarias
treasuryRouter.post('/transfers', authenticate, authorize('treasury', 'create'), zValidator('json', transferBetweenAccountsSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await TreasuryService.transferBetweenAccounts(user.companyId, user.sub, body);
  return c.json({ success: true, data }, 201);
});

// POST /api/treasury/reconcile - Conciliar extracto bancario
treasuryRouter.post('/reconcile', authenticate, authorize('treasury', 'reconcile'), zValidator('json', reconcileStatementSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await TreasuryService.reconcileStatement(user.companyId, user.sub, body);
  return c.json({ success: true, data });
});

// GET /api/treasury/accounts/:id/reconciliations - Historial de conciliaciones bancarias de la cuenta
treasuryRouter.get('/accounts/:id/reconciliations', authenticate, authorize('treasury', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await TreasuryService.getAccountReconciliations(user.companyId, id!);
  return c.json({ success: true, data });
});

// GET /api/treasury/summary - Resumen general de liquidez y saldos (con soporte de sucursal)
treasuryRouter.get('/summary', authenticate, authorize('treasury', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId');
  const data = await TreasuryService.getTreasurySummary(user.companyId, branchId);
  return c.json({ success: true, data });
});
