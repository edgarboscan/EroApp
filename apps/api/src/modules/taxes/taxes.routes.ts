import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  emitWithholdingIVASchema,
  emitWithholdingISLRSchema,
} from '@ero/shared';
import { TaxesService } from './taxes.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { z } from 'zod';

export const taxesRouter = new Hono<AppEnv>();

// GET /api/taxes/withholdings - Listado y KPIs de retenciones
taxesRouter.get('/withholdings', authenticate, authorize('taxes', 'read'), async (c) => {
  const user = c.get('user');
  const type = (c.req.query('type') as 'ALL' | 'IVA' | 'ISLR') || 'ALL';
  const period = c.req.query('period');
  const branchId = c.req.query('branchId') || c.get('activeBranchId');
  const supplierId = c.req.query('supplierId');

  const data = await TaxesService.getWithholdings(user.companyId, {
    type,
    period,
    branchId,
    supplierId,
  });

  return c.json({ success: true, data });
});

// GET /api/taxes/pending-invoices - Facturas de compra disponibles para retención
taxesRouter.get('/pending-invoices', authenticate, authorize('taxes', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || c.get('activeBranchId');
  const data = await TaxesService.getInvoicesPendingWithholding(user.companyId, branchId);
  return c.json({ success: true, data });
});

// POST /api/taxes/withholdings/iva - Emitir comprobante de retención de IVA
taxesRouter.post(
  '/withholdings/iva',
  authenticate,
  authorize('taxes', 'create'),
  zValidator('json', emitWithholdingIVASchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const data = await TaxesService.emitIVAWithholding(user.companyId, user.sub, body);
    return c.json({ success: true, data }, 201);
  }
);

// POST /api/taxes/withholdings/islr - Emitir comprobante de retención de ISLR
taxesRouter.post(
  '/withholdings/islr',
  authenticate,
  authorize('taxes', 'create'),
  zValidator('json', emitWithholdingISLRSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const data = await TaxesService.emitISLRWithholding(user.companyId, user.sub, body);
    return c.json({ success: true, data }, 201);
  }
);

// POST /api/taxes/withholdings/annul - Anular comprobante de retención
taxesRouter.post(
  '/withholdings/annul',
  authenticate,
  authorize('taxes', 'create'),
  zValidator(
    'json',
    z.object({
      type: z.enum(['IVA', 'ISLR']),
      id: z.string().uuid(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { type, id } = c.req.valid('json');
    const data = await TaxesService.annulWithholding(user.companyId, type, id);
    return c.json({ success: true, data });
  }
);

// GET /api/taxes/books/purchases - Libro de Compras SENIAT
taxesRouter.get('/books/purchases', authenticate, authorize('taxes', 'read'), async (c) => {
  const user = c.get('user');
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const period = c.req.query('period') || currentPeriod;
  const branchId = c.req.query('branchId') || c.get('activeBranchId');

  const data = await TaxesService.getPurchasesBook(user.companyId, period, branchId);
  return c.json({ success: true, data });
});

// GET /api/taxes/books/sales - Libro de Ventas SENIAT
taxesRouter.get('/books/sales', authenticate, authorize('taxes', 'read'), async (c) => {
  const user = c.get('user');
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const period = c.req.query('period') || currentPeriod;
  const branchId = c.req.query('branchId') || c.get('activeBranchId');

  const data = await TaxesService.getSalesBook(user.companyId, period, branchId);
  return c.json({ success: true, data });
});

// GET /api/taxes/arcv - Reporte Anual de Retenciones ISLR (Comprobante ARCV)
taxesRouter.get('/arcv', authenticate, authorize('taxes', 'read'), async (c) => {
  const user = c.get('user');
  const currentYear = new Date().getFullYear();
  const yearQuery = c.req.query('year');
  const year = yearQuery ? parseInt(yearQuery, 10) : currentYear;
  const supplierId = c.req.query('supplierId');

  const data = await TaxesService.getARCVReport(user.companyId, year, supplierId);
  return c.json({ success: true, data });
});

// GET /api/taxes/export/seniat - Exportación oficial XML/TXT para portal SENIAT
taxesRouter.get('/export/seniat', authenticate, authorize('taxes', 'read'), async (c) => {
  const user = c.get('user');
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const period = c.req.query('period') || currentPeriod;
  const type = (c.req.query('type') as 'ISLR' | 'IVA') || 'ISLR';

  const fileData = await TaxesService.exportSENIAT(user.companyId, period, type);

  c.header('Content-Disposition', `attachment; filename="${fileData.filename}"`);
  if (fileData.format === 'xml') {
    c.header('Content-Type', 'application/xml; charset=ISO-8859-1');
  } else {
    c.header('Content-Type', 'text/plain; charset=utf-8');
  }

  return c.body(fileData.content);
});
