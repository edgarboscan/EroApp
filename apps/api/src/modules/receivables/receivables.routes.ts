import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createCollectionSchema } from '@ero/shared';
import { ReceivablesService } from './receivables.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { query } from '../../db';
import { generateCollectionReceiptPDF } from '../reports/reports-pdf';
import { ReportsService } from '../reports/reports.service';

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

// GET /api/receivables/collections/:id/pdf - Descarga / Visualización de Recibo Oficial de Cobro
receivablesRouter.get('/collections/:id/pdf', authenticate, authorize('receivables', 'read'), async (c) => {
  const user = c.get('user');
  const paymentId = c.req.param('id')!;

  try {
    const collection = await ReceivablesService.getCollectionById(user.companyId, paymentId);
    if (!collection) {
      return c.json({ success: false, error: { code: 'COLLECTION_NOT_FOUND', message: 'Recibo de cobro no encontrado' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateCollectionReceiptPDF({
      company,
      collection,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="recibo_cobro_${collection.receiptNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Collection PDF Error]', error);
    return c.json({ success: false, error: { code: 'COLLECTION_PDF_FAILED', message: error.message } }, 500);
  }
});
