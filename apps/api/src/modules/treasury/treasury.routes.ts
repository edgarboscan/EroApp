import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  bankAccountSchema,
  bankMovementSchema,
  transferBetweenAccountsSchema,
  reconcileStatementSchema,
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

// GET /api/treasury/accounts - Listado de cuentas bancarias de la empresa
treasuryRouter.get('/accounts', authenticate, authorize('treasury', 'read'), async (c) => {
  const user = c.get('user');
  const data = await TreasuryService.getBankAccounts(user.companyId);
  return c.json({ success: true, data });
});

// POST /api/treasury/accounts - Registrar nueva cuenta bancaria
treasuryRouter.post('/accounts', authenticate, authorize('treasury', 'create'), zValidator('json', bankAccountSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await TreasuryService.createBankAccount(user.companyId, body);
  return c.json({ success: true, data }, 201);
});

// GET /api/treasury/accounts/:id/movements - Libro de movimientos de una cuenta
treasuryRouter.get('/accounts/:id/movements', authenticate, authorize('treasury', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const isReconciled = c.req.query('isReconciled') !== undefined ? c.req.query('isReconciled') === 'true' : undefined;

  const data = await TreasuryService.getAccountMovements(id!, user.companyId, fromDate, toDate, isReconciled);
  return c.json({ success: true, data });
});

// POST /api/treasury/movements - Registrar movimiento manual (depósito, retiro, comisión)
treasuryRouter.post('/movements', authenticate, authorize('treasury', 'create'), zValidator('json', bankMovementSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await TreasuryService.registerMovement(user.companyId, user.sub, body);
  return c.json({ success: true, data }, 201);
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

// GET /api/treasury/summary - Resumen general de liquidez y saldos
treasuryRouter.get('/summary', authenticate, authorize('treasury', 'read'), async (c) => {
  const user = c.get('user');
  const data = await TreasuryService.getTreasurySummary(user.companyId);
  return c.json({ success: true, data });
});
