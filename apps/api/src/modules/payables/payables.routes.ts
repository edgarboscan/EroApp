import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createPayablePaymentSchema, createPurchaseInvoiceSchema } from '@ero/shared';
import { PayablesService } from './payables.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { query } from '../../db';
import { generatePayablePaymentReceiptPDF } from '../reports/reports-pdf';
import { ReportsService } from '../reports/reports.service';

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

// GET /api/payables/payments/:id/pdf - Descarga / Visualización de Comprobante de Pago a Proveedor
payablesRouter.get('/payments/:id/pdf', authenticate, authorize('payables', 'read'), async (c) => {
  const user = c.get('user');
  const paymentId = c.req.param('id')!;

  try {
    const payment = await PayablesService.getPaymentById(user.companyId, paymentId);
    if (!payment) {
      return c.json({ success: false, error: { code: 'PAYMENT_NOT_FOUND', message: 'Comprobante de pago no encontrado' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generatePayablePaymentReceiptPDF({
      company,
      payment,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="recibo_pago_${payment.receiptNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Payment PDF Error]', error);
    return c.json({ success: false, error: { code: 'PAYMENT_PDF_FAILED', message: error.message } }, 500);
  }
});

// POST /api/payables/purchases - Registrar factura de compra
payablesRouter.post('/purchases', authenticate, authorize('purchases', 'create'), zValidator('json', createPurchaseInvoiceSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await PayablesService.createPurchaseInvoice(user.companyId, user.sub, body);
  return c.json({ success: true, data }, 201);
});
