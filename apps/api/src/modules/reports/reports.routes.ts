import { Hono } from 'hono';
import { ReportsService } from './reports.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const reportsRouter = new Hono<AppEnv>();

// GET /api/reports/sales - Reporte de Ventas (Resumido y Detallado)
reportsRouter.get('/sales', authenticate, authorize('reports', 'export_pdf'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const branchId = c.req.query('branchId');
  const cashRegisterId = c.req.query('cashRegisterId');
  const userId = c.req.query('userId');
  const paymentMethod = c.req.query('paymentMethod');
  const status = c.req.query('status');
  const format = c.req.query('format') || 'json';

  try {
    const data = await ReportsService.getSalesReport(user.companyId, {
      startDate,
      endDate,
      branchId,
      cashRegisterId,
      userId,
      paymentMethod,
      status,
    });

    if (format === 'csv') {
      const flatRows = data.invoices.map((inv) => ({
        'N° Factura': inv.invoice_number,
        'N° Control': inv.control_number || '',
        'Fecha': inv.emission_date,
        'Sucursal': inv.branch_name,
        'Caja': inv.cash_register_name || '',
        'Cajero': inv.cashier_name,
        'Cliente': inv.customer_name,
        'RIF / Doc': inv.customer_doc,
        'Exento ($)': inv.exemptUSD,
        'Base Imponible ($)': inv.taxableUSD,
        'IVA 16% ($)': inv.ivaUSD,
        'IGTF 3% ($)': inv.igtfUSD,
        'Total ($)': inv.totalUSD,
        'Total (Bs)': inv.totalVES,
        'Métodos de Pago': inv.paymentMethodsSummary,
        'Estado': inv.status,
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="reporte_ventas.csv"');
      return c.text(csv);
    }

    if (format === 'xlsx') {
      const flatRows = data.invoices.map((inv) => ({
        'N° Factura': inv.invoice_number,
        'N° Control': inv.control_number || '',
        'Fecha': inv.emission_date,
        'Sucursal': inv.branch_name,
        'Caja': inv.cash_register_name || '',
        'Cajero': inv.cashier_name,
        'Cliente': inv.customer_name,
        'RIF / Doc': inv.customer_doc,
        'Exento ($)': inv.exemptUSD,
        'Base Imponible ($)': inv.taxableUSD,
        'IVA 16% ($)': inv.ivaUSD,
        'IGTF 3% ($)': inv.igtfUSD,
        'Total ($)': inv.totalUSD,
        'Total (Bs)': inv.totalVES,
        'Métodos de Pago': inv.paymentMethodsSummary,
        'Estado': inv.status,
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Ventas');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="reporte_ventas.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message } }, 500);
  }
});

// GET /api/reports/cash-shifts - Reporte de Cierres de Turno de Caja (Arqueo X y Z)
reportsRouter.get('/cash-shifts', authenticate, authorize('reports', 'export_pdf'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const branchId = c.req.query('branchId');
  const cashRegisterId = c.req.query('cashRegisterId');
  const userId = c.req.query('userId');
  const status = c.req.query('status');
  const format = c.req.query('format') || 'json';

  try {
    const data = await ReportsService.getCashShiftsReport(user.companyId, {
      startDate,
      endDate,
      branchId,
      cashRegisterId,
      userId,
      status,
    });

    if (format === 'csv') {
      const flatRows = data.shifts.map((s) => ({
        'ID Turno': s.id.slice(0, 8),
        'Sucursal': s.branchName,
        'Caja': `${s.cashRegisterCode} - ${s.cashRegisterName}`,
        'Cajero': s.cashierName,
        'Apertura': s.openedAt,
        'Cierre': s.closedAt || 'EN VIVO',
        'Estado': s.status,
        'Arqueo': s.auditStatus,
        'Efectivo Inicial ($)': s.initialCashUSD,
        'Efectivo Inicial (Bs)': s.initialCashVES,
        'Efectivo Esperado ($)': s.finalCashUSDExpected,
        'Efectivo Contado ($)': s.finalCashUSDCounted,
        'Diferencia ($)': s.differenceUSD,
        'Efectivo Esperado (Bs)': s.finalCashVESExpected,
        'Efectivo Contado (Bs)': s.finalCashVESCounted,
        'Diferencia (Bs)': s.differenceVES,
        'Lote Punto Venta (Bs)': s.revenue.posBatchVES,
        'Pago Móvil (Bs)': s.revenue.pagomovilVES,
        'Total Recaudado (Bs)': s.revenue.totalCollectedVES,
        'Depósito Banco (Bs)': s.depositAmountVES,
        'Cuenta Depósito (Bs)': s.depositAccountVES || '',
        'Ref. Depósito (Bs)': s.depositReferenceVES || '',
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="reporte_cierres_caja.csv"');
      return c.text(csv);
    }

    if (format === 'xlsx') {
      const flatRows = data.shifts.map((s) => ({
        'ID Turno': s.id.slice(0, 8),
        'Sucursal': s.branchName,
        'Caja': `${s.cashRegisterCode} - ${s.cashRegisterName}`,
        'Cajero': s.cashierName,
        'Apertura': s.openedAt,
        'Cierre': s.closedAt || 'EN VIVO',
        'Estado': s.status,
        'Arqueo': s.auditStatus,
        'Efectivo Inicial ($)': s.initialCashUSD,
        'Efectivo Inicial (Bs)': s.initialCashVES,
        'Efectivo Esperado ($)': s.finalCashUSDExpected,
        'Efectivo Contado ($)': s.finalCashUSDCounted,
        'Diferencia ($)': s.differenceUSD,
        'Efectivo Esperado (Bs)': s.finalCashVESExpected,
        'Efectivo Contado (Bs)': s.finalCashVESCounted,
        'Diferencia (Bs)': s.differenceVES,
        'Lote Punto Venta (Bs)': s.revenue.posBatchVES,
        'Pago Móvil (Bs)': s.revenue.pagomovilVES,
        'Total Recaudado (Bs)': s.revenue.totalCollectedVES,
        'Depósito Banco (Bs)': s.depositAmountVES,
        'Cuenta Depósito (Bs)': s.depositAccountVES || '',
        'Ref. Depósito (Bs)': s.depositReferenceVES || '',
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Cierres de Caja');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="reporte_cierres_caja.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message } }, 500);
  }
});

// GET /api/reports/sales-by-product - Ventas por producto
reportsRouter.get('/sales-by-product', authenticate, authorize('reports', 'export_pdf'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const format = c.req.query('format') || 'json';

  try {
    const data = await ReportsService.getSalesByProductReport(user.companyId, startDate, endDate);

    if (format === 'csv') {
      const flatRows = data.map((p) => ({
        'SKU': p.sku,
        'Código de Barras': p.barcode || '',
        'Producto': p.productName,
        'Departamento': p.departmentName,
        'Cantidad Vendida': p.totalQtySold,
        'Subtotal ($)': p.subtotalUSD,
        'IVA ($)': p.taxUSD,
        'Total Ventas ($)': p.totalSalesUSD,
        'Total Ventas (Bs)': p.totalSalesVES,
        'N° Facturas': p.invoicesCount,
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="ventas_por_producto.csv"');
      return c.text(csv);
    }

    if (format === 'xlsx') {
      const flatRows = data.map((p) => ({
        'SKU': p.sku,
        'Código de Barras': p.barcode || '',
        'Producto': p.productName,
        'Departamento': p.departmentName,
        'Cantidad Vendida': p.totalQtySold,
        'Subtotal ($)': p.subtotalUSD,
        'IVA ($)': p.taxUSD,
        'Total Ventas ($)': p.totalSalesUSD,
        'Total Ventas (Bs)': p.totalSalesVES,
        'N° Facturas': p.invoicesCount,
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Por Producto');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="ventas_por_producto.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message } }, 500);
  }
});

// GET /api/reports/sales-by-cashier - Ventas por cajero
reportsRouter.get('/sales-by-cashier', authenticate, authorize('reports', 'export_pdf'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const format = c.req.query('format') || 'json';

  try {
    const data = await ReportsService.getSalesByCashierReport(user.companyId, startDate, endDate);

    if (format === 'csv') {
      const csv = ReportsService.exportToCSV(data);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="ventas_por_cajero.csv"');
      return c.text(csv);
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message } }, 500);
  }
});

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
