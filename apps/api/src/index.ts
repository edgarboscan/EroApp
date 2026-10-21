import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import dotenv from 'dotenv';

import { authRouter } from './modules/auth/auth.routes';
import { dashboardsRouter } from './modules/dashboards/dashboards.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { pricingRouter } from './modules/pricing/pricing.routes';
import { posRouter } from './modules/pos/pos.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { receivablesRouter } from './modules/receivables/receivables.routes';
import { suppliersRouter } from './modules/suppliers/suppliers.routes';
import { payablesRouter } from './modules/payables/payables.routes';
import { purchasesRouter } from './modules/purchases/purchases.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { customerNotesRouter } from './modules/sales/customerNotes.routes';
import { treasuryRouter } from './modules/treasury/treasury.routes';
import { taxesRouter } from './modules/taxes/taxes.routes';
import { configRouter } from './modules/config/config.routes';
import { licensesRouter } from './modules/licenses/licenses.routes';
import { auditRouter } from './modules/audit/audit.routes';

dotenv.config();

const app = new Hono();

// Middlewares Globales
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id', 'X-Warehouse-Id', 'Idempotency-Key'],
  exposeHeaders: ['Content-Length', 'Content-Disposition'],
  credentials: true,
}));

// Health Check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ero-erp-api-ve',
    version: '1.0.0',
  });
});

// Montaje de Rutas Modulares
app.route('/api/auth', authRouter);
app.route('/api/dashboards', dashboardsRouter);
app.route('/api/inventory', inventoryRouter);
app.route('/api/pricing', pricingRouter);
app.route('/api/pos', posRouter);
app.route('/api/reports', reportsRouter);
app.route('/api/customers', customersRouter);
app.route('/api/receivables', receivablesRouter);
app.route('/api/suppliers', suppliersRouter);
app.route('/api/payables', payablesRouter);
app.route('/api/purchases', purchasesRouter);
app.route('/api/sales', salesRouter);
app.route('/api/customer-notes', customerNotesRouter);
app.route('/api/sales/customer-notes', customerNotesRouter);
app.route('/api/treasury', treasuryRouter);
app.route('/api/taxes', taxesRouter);
app.route('/api/config', configRouter);
app.route('/api/licenses', licensesRouter);
app.route('/api/audit', auditRouter);

// Manejador Global de Errores
app.onError((err, c) => {
  console.error('[API Error]:', err);
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Ha ocurrido un error inesperado en el servidor',
    },
  }, 500);
});

// Manejador 404
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `La ruta solicitada ${c.req.path} no existe`,
    },
  }, 404);
});

const port = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV !== 'test') {
  console.log(`🚀 ERO ERP VE API inicializado en http://localhost:${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;
