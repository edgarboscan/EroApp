import { Hono } from 'hono';
import { ReportsService } from './reports.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const reportsRouter = new Hono<AppEnv>();

// GET /api/reports/inventory-hierarchy
reportsRouter.get('/inventory-hierarchy', authenticate, authorize('reports', 'export_pdf'), async (c) => {
  const user = c.get('user');
  const format = c.req.query('format') || 'json';
  const data = await ReportsService.getInventoryHierarchyReport(user.companyId);

  if (format === 'csv') {
    const csv = ReportsService.exportToCSV(data);
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="inventario_jerarquia.csv"');
    return c.text(csv);
  }

  if (format === 'xlsx') {
    const buffer = ReportsService.exportToExcel(data, 'Inventario');
    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    c.header('Content-Disposition', 'attachment; filename="inventario_jerarquia.xlsx"');
    return c.body(new Uint8Array(buffer));
  }

  return c.json({ success: true, data });
});

// GET /api/reports/sales-book
reportsRouter.get('/sales-book', authenticate, authorize('taxes', 'read'), async (c) => {
  const user = c.get('user');
  const period = c.req.query('period');
  const format = c.req.query('format') || 'json';
  const data = await ReportsService.getSalesBookReport(user.companyId, period);

  if (format === 'csv') {
    const csv = ReportsService.exportToCSV(data);
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="libro_ventas.csv"');
    return c.text(csv);
  }

  return c.json({ success: true, data });
});
