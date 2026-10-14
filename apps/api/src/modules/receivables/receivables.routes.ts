import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createCollectionSchema } from '@ero/shared';
import { ReceivablesService } from './receivables.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const receivablesRouter = new Hono<AppEnv>();

// GET /api/receivables - Listado de cuentas por cobrar
receivablesRouter.get('/', authenticate, authorize('receivables', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || c.get('activeBranchId');
  const customerId = c.req.query('customerId');
  const status = c.req.query('status');
  const data = await ReceivablesService.getReceivables(user.companyId, branchId, customerId, status);
  return c.json({ success: true, data });
});

// GET /api/receivables/aging - Reporte de Antigüedad de Saldos (Aging)
receivablesRouter.get('/aging', authenticate, authorize('receivables', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || c.get('activeBranchId');
  const data = await ReceivablesService.getAgingReport(user.companyId, branchId);
  return c.json({ success: true, data });
});

// POST /api/receivables/collections - Registrar cobro o abono a cuenta por cobrar
receivablesRouter.post('/collections', authenticate, authorize('receivables', 'create'), zValidator('json', createCollectionSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await ReceivablesService.registerCollection(user.companyId, user.sub, body);
  return c.json({ success: true, data }, 201);
});
