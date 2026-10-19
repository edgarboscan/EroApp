import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { bulkPriceUpdateRequestSchema, taxRateSchema, applyTaxRateChangeSchema } from '@ero/shared';
import { PricingService } from './pricing.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { generatePriceChangeReportPDF } from '../reports/reports-pdf';
import { ReportsService } from '../reports/reports.service';

export const pricingRouter = new Hono<AppEnv>();

// POST /api/pricing/bulk-update/preview - Simula el impacto antes de aplicar
pricingRouter.post('/bulk-update/preview', authenticate, authorize('pricing', 'read'), zValidator('json', bulkPriceUpdateRequestSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await PricingService.previewBulkPriceUpdate(user.companyId, body.criteria, body.action);
  return c.json({ success: true, data: result });
});

// POST /api/pricing/bulk-update/execute - Ejecuta el cambio masivo de precios
pricingRouter.post('/bulk-update/execute', authenticate, authorize('pricing', 'bulk_update'), zValidator('json', bulkPriceUpdateRequestSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await PricingService.executeBulkPriceUpdate(user.companyId, user.sub, body.criteria, body.action);
  return c.json({ success: true, data: result }, 201);
});

// GET /api/pricing/bulk-update/batches - Listado de lotes
pricingRouter.get('/bulk-update/batches', authenticate, authorize('pricing', 'read'), async (c) => {
  const user = c.get('user');
  const result = await PricingService.getBatches(user.companyId);
  return c.json({ success: true, data: result });
});

// GET /api/pricing/bulk-update/batches/:id/pdf - Descarga / Visualización de Reporte de Lote de Precios
pricingRouter.get('/bulk-update/batches/:id/pdf', authenticate, authorize('pricing', 'read'), async (c) => {
  const user = c.get('user');
  const batchId = c.req.param('id')!;

  try {
    const batch = await PricingService.getBatchById(user.companyId, batchId);
    if (!batch) {
      return c.json({ success: false, error: { code: 'BATCH_NOT_FOUND', message: 'Lote de precios no encontrado' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generatePriceChangeReportPDF({
      company,
      batch,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="lote_precios_${batch.batchNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Price Batch PDF Error]', error);
    return c.json({ success: false, error: { code: 'PRICE_BATCH_PDF_FAILED', message: error.message } }, 500);
  }
});

// GET /api/pricing/tax-rates - Listado de tasas
pricingRouter.get('/tax-rates', authenticate, authorize('pricing', 'read'), async (c) => {
  const user = c.get('user');
  const result = await PricingService.getTaxRates(user.companyId);
  return c.json({ success: true, data: result });
});

// POST /api/pricing/tax-rates - Crear tasa
pricingRouter.post('/tax-rates', authenticate, authorize('pricing', 'apply_tax'), zValidator('json', taxRateSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await PricingService.createTaxRate(body);
  return c.json({ success: true, data: result }, 201);
});

// POST /api/pricing/tax-rates/:id/apply - Modificar tasa con afectación a precio final
pricingRouter.post('/tax-rates/:id/apply', authenticate, authorize('pricing', 'apply_tax'), zValidator('json', applyTaxRateChangeSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await PricingService.applyTaxRateChange(body, user.sub);
  return c.json({ success: true, data: result });
});

// GET /api/inventory/products/:id/price-history - Historial de precios de un producto
pricingRouter.get('/products/:id/price-history', authenticate, authorize('pricing', 'read'), async (c) => {
  const productId = c.req.param('id');
  const result = await PricingService.getProductPriceHistory(productId!);
  return c.json({ success: true, data: result });
});
