import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createPayablePaymentSchema, createPurchaseInvoiceSchema } from '@ero/shared';
import { PayablesService } from './payables.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const payablesRouter = new Hono<AppEnv>();

// GET /api/payables - Listado de cuentas por pagar
payablesRouter.get('/', authenticate, authorize('payables', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || c.get('activeBranchId');
  const supplierId = c.req.query('supplierId');
  const status = c.req.query('status');
  const data = await PayablesService.getPayables(user.companyId, branchId, supplierId, status);
  return c.json({ success: true, data });
});

// GET /api/payables/aging - Reporte de Antigüedad de Saldos CxP
payablesRouter.get('/aging', authenticate, authorize('payables', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || c.get('activeBranchId');
  const data = await PayablesService.getAgingReport(user.companyId, branchId);
  return c.json({ success: true, data });
});

// POST /api/payables/payments - Registrar pago a proveedor
payablesRouter.post('/payments', authenticate, authorize('payables', 'create'), zValidator('json', createPayablePaymentSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await PayablesService.registerPayment(user.companyId, user.sub, body);
  return c.json({ success: true, data }, 201);
});

// POST /api/payables/purchases - Registrar factura de compra
payablesRouter.post('/purchases', authenticate, authorize('purchases', 'create'), zValidator('json', createPurchaseInvoiceSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await PayablesService.createPurchaseInvoice(user.companyId, user.sub, body);
  return c.json({ success: true, data }, 201);
});
