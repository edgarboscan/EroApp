import { Hono } from 'hono';
import { ReportsService } from './reports.service';
import { ReportsPdfEngine } from './reports-pdf';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const reportsRouter = new Hono<AppEnv>();

// GET /api/reports/sales - Reporte de Ventas (Resumido y Detallado)
reportsRouter.get('/sales', authenticate, authorize('reports', 'sales'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const branchId = c.req.query('branchId');
  const cashRegisterId = c.req.query('cashRegisterId');
  const userId = c.req.query('userId');
  const paymentMethod = c.req.query('paymentMethod');
  const status = c.req.query('status');
  const isDetailed = c.req.query('detailed') === 'true';
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;

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

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateSalesReportPDF(data, company, userName, {
        detailed: isDetailed,
        startDate,
        endDate,
        branchName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="reporte_ventas_${startDate || 'inicio'}_${endDate || 'fin'}.pdf"`);
      return c.body(new Uint8Array(buffer));
    }

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
reportsRouter.get('/cash-shifts', authenticate, authorize('reports', 'cash_shifts'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const branchId = c.req.query('branchId');
  const cashRegisterId = c.req.query('cashRegisterId');
  const userId = c.req.query('userId');
  const status = c.req.query('status');
  const isDetailed = c.req.query('detailed') === 'true';
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;

  try {
    const data = await ReportsService.getCashShiftsReport(user.companyId, {
      startDate,
      endDate,
      branchId,
      cashRegisterId,
      userId,
      status,
    });

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateCashShiftsReportPDF(data, company, userName, {
        detailed: isDetailed,
        startDate,
        endDate,
        branchName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="reporte_cierres_caja_${startDate || 'inicio'}_${endDate || 'fin'}.pdf"`);
      return c.body(new Uint8Array(buffer));
    }

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
reportsRouter.get('/sales-by-product', authenticate, authorize('reports', 'sales_by_product'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const branchId = c.req.query('branchId');
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;

  try {
    const data = await ReportsService.getSalesByProductReport(user.companyId, startDate, endDate, branchId);

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateSalesByProductReportPDF(data, company, userName, {
        startDate,
        endDate,
        branchName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="ventas_por_producto_${startDate || 'inicio'}_${endDate || 'fin'}.pdf"`);
      return c.body(new Uint8Array(buffer));
    }

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
reportsRouter.get('/sales-by-cashier', authenticate, authorize('reports', 'sales_by_cashier'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const branchId = c.req.query('branchId');
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;

  try {
    const data = await ReportsService.getSalesByCashierReport(user.companyId, startDate, endDate, branchId);

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateSalesByCashierReportPDF(data, company, userName, {
        startDate,
        endDate,
        branchName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="ventas_por_cajero_${startDate || 'inicio'}_${endDate || 'fin'}.pdf"`);
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = data.map((c) => ({
        'Cajero': c.cashierName,
        'Sucursal': c.branchName,
        'Turnos Realizados': c.totalShifts,
        'Facturas Emitidas': c.totalInvoices,
        'Lote POS (Bs)': c.posBatchVES,
        'Ticket Promedio ($)': c.averageTicketUSD,
        'Venta Total ($)': c.totalSalesUSD,
        'Venta Total (Bs)': c.totalSalesVES,
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="ventas_por_cajero.csv"');
      return c.text(csv);
    }

    if (format === 'xlsx') {
      const flatRows = data.map((c) => ({
        'Cajero': c.cashierName,
        'Sucursal': c.branchName,
        'Turnos Realizados': c.totalShifts,
        'Facturas Emitidas': c.totalInvoices,
        'Lote POS (Bs)': c.posBatchVES,
        'Ticket Promedio ($)': c.averageTicketUSD,
        'Venta Total ($)': c.totalSalesUSD,
        'Venta Total (Bs)': c.totalSalesVES,
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Por Cajero');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="ventas_por_cajero.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message } }, 500);
  }
});

// GET /api/reports/receivables-aging - Antigüedad de Cuentas por Cobrar (Aging CxC)
reportsRouter.get('/receivables-aging', authenticate, authorize('reports', 'receivables_aging'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId');
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;

  try {
    const data = await ReportsService.getReceivablesAgingReport(user.companyId, branchId);

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateAgingReportPDF(data, company, userName, {
        type: 'receivables',
        branchName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="antiguedad_cxc.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = (data.items || []).map((r: any) => ({
        'Cliente': r.customer_name,
        'Documento': `${r.doc_type || ''}-${r.doc_number || ''}`,
        'N° Factura': r.invoice_number,
        'F. Emisión': r.invoice_date,
        'F. Vencimiento': r.due_date,
        'Días Mora': r.days_overdue,
        'Saldo ($)': r.amount_balance,
        'Corriente ($)': r.current_due,
        '1-30 Días ($)': r.days_1_30,
        '31-60 Días ($)': r.days_31_60,
        '61-90 Días ($)': r.days_61_90,
        '+90 Días ($)': r.days_90_plus,
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="antiguedad_cxc.csv"');
      return c.text(csv);
    }

    if (format === 'xlsx') {
      const flatRows = (data.items || []).map((r: any) => ({
        'Cliente': r.customer_name,
        'Documento': `${r.doc_type || ''}-${r.doc_number || ''}`,
        'N° Factura': r.invoice_number,
        'F. Emisión': r.invoice_date,
        'F. Vencimiento': r.due_date,
        'Días Mora': r.days_overdue,
        'Saldo ($)': r.amount_balance,
        'Corriente ($)': r.current_due,
        '1-30 Días ($)': r.days_1_30,
        '31-60 Días ($)': r.days_31_60,
        '61-90 Días ($)': r.days_61_90,
        '+90 Días ($)': r.days_90_plus,
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Aging CxC');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="antiguedad_cxc.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message } }, 500);
  }
});

// GET /api/reports/payables-aging - Antigüedad de Cuentas por Pagar (Aging CxP)
reportsRouter.get('/payables-aging', authenticate, authorize('reports', 'payables_aging'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId');
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;

  try {
    const data = await ReportsService.getPayablesAgingReport(user.companyId, branchId);

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateAgingReportPDF(data, company, userName, {
        type: 'payables',
        branchName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="antiguedad_cxp.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = (data.items || []).map((r: any) => ({
        'Proveedor': r.supplier_name,
        'RIF': r.rif,
        'N° Factura': r.invoice_number,
        'F. Emisión': r.invoice_date,
        'F. Vencimiento': r.due_date,
        'Días Mora': r.days_overdue,
        'Saldo ($)': r.amount_balance,
        'Corriente ($)': r.current_due,
        '1-30 Días ($)': r.days_1_30,
        '31-60 Días ($)': r.days_31_60,
        '61-90 Días ($)': r.days_61_90,
        '+90 Días ($)': r.days_90_plus,
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="antiguedad_cxp.csv"');
      return c.text(csv);
    }

    if (format === 'xlsx') {
      const flatRows = (data.items || []).map((r: any) => ({
        'Proveedor': r.supplier_name,
        'RIF': r.rif,
        'N° Factura': r.invoice_number,
        'F. Emisión': r.invoice_date,
        'F. Vencimiento': r.due_date,
        'Días Mora': r.days_overdue,
        'Saldo ($)': r.amount_balance,
        'Corriente ($)': r.current_due,
        '1-30 Días ($)': r.days_1_30,
        '31-60 Días ($)': r.days_31_60,
        '61-90 Días ($)': r.days_61_90,
        '+90 Días ($)': r.days_90_plus,
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Aging CxP');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="antiguedad_cxp.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: { message: err.message } }, 500);
  }
});

// GET /api/reports/inventory-hierarchy
reportsRouter.get('/inventory-hierarchy', authenticate, authorize('reports', 'inventory_hierarchy'), async (c) => {
  const user = c.get('user');
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;
  const data = await ReportsService.getInventoryHierarchyReport(user.companyId);

  if (format === 'pdf') {
    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const buffer = ReportsPdfEngine.generateInventoryHierarchyReportPDF(data, company, userName, {
      currency,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'inline; filename="inventario_jerarquia.pdf"');
    return c.body(new Uint8Array(buffer));
  }

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
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const data = await ReportsService.getSalesBookReport(user.companyId, period);

  if (format === 'pdf') {
    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const buffer = ReportsPdfEngine.generateSalesBookReportPDF(data, company, userName, {
      period,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="libro_ventas_${period || 'periodo'}.pdf"`);
    return c.body(new Uint8Array(buffer));
  }

  if (format === 'csv') {
    const csv = ReportsService.exportToCSV(data);
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="libro_ventas.csv"');
    return c.text(csv);
  }

  return c.json({ success: true, data });
});

// GET /api/reports/restaurant-tips - Reporte de Propinas de Restaurante por Mesero / Usuario
reportsRouter.get('/restaurant-tips', authenticate, authorize('reports', 'restaurant_tips'), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const branchId = c.req.query('branchId');
  const waiterId = c.req.query('waiterId');
  const waiterName = c.req.query('waiterName');
  const onlyWithTips = c.req.query('onlyWithTips') !== 'false';
  const format = c.req.query('format') || c.req.query('export') || 'json';
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;

  try {
    const data = await ReportsService.getRestaurantTipsReport(user.companyId, {
      branchId,
      waiterId,
      waiterName,
      startDate,
      endDate,
      onlyWithTips,
    });

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateRestaurantTipsReportPDF(data, company, userName, {
        startDate,
        endDate,
        branchName,
        waiterName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="reporte_propinas_${startDate || 'inicio'}_${endDate || 'fin'}.pdf"`);
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = data.orders.map((o) => ({
        'N° Comanda': o.orderNumber,
        'Mesero / Generador': o.waiterName,
        'Mesa': `${o.tableNumber} (${o.tableName})`,
        'Salón / Área': o.zone,
        'Cliente': o.customerName,
        'Fecha Cierre': o.closedAt ? new Date(o.closedAt).toLocaleString('es-VE') : '',
        'Consumo ($)': o.subtotalUSD.toFixed(2),
        'Consumo (Bs)': o.subtotalVES.toFixed(2),
        'Propina ($)': o.tipUSD.toFixed(2),
        'Propina (Bs)': o.tipVES.toFixed(2),
        '% Propina': `${o.tipPercent}%`,
        'Factura POS': o.posInvoiceNumber || (o.isInvoiced ? 'Facturada' : 'Pendiente'),
        'Estado': o.isInvoiced ? 'FACTURADA' : 'PENDIENTE',
        'Cerrado Por': o.closedByUserName || '',
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="reporte_propinas.csv"');
      return c.text(csv);
    }

    if (format === 'excel') {
      const flatRows = data.orders.map((o) => ({
        'N° Comanda': o.orderNumber,
        'Mesero / Generador': o.waiterName,
        'Mesa': `${o.tableNumber} (${o.tableName})`,
        'Salón / Área': o.zone,
        'Cliente': o.customerName,
        'Fecha Cierre': o.closedAt ? new Date(o.closedAt).toLocaleString('es-VE') : '',
        'Consumo ($)': o.subtotalUSD,
        'Consumo (Bs)': o.subtotalVES,
        'Propina ($)': o.tipUSD,
        'Propina (Bs)': o.tipVES,
        '% Propina': o.tipPercent,
        'Factura POS': o.posInvoiceNumber || (o.isInvoiced ? 'Facturada' : 'Pendiente'),
        'Estado': o.isInvoiced ? 'FACTURADA' : 'PENDIENTE',
        'Cerrado Por': o.closedByUserName || '',
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Propinas');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="reporte_propinas.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/reports/treasury-balances - Posición Global de Saldos y Liquidez Bancaria
reportsRouter.get('/treasury-balances', authenticate, authorize('reports', 'treasury_balances'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId');
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;
  const format = c.req.query('format') || c.req.query('export') || 'json';

  try {
    const data = await ReportsService.getTreasuryBalancesReport(user.companyId, {
      branchId,
      currency,
    });

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateTreasuryBalancesPDF(data, company, userName, {
        branchName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'inline; filename="posicion_bancaria_tesoreria.pdf"');
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = data.accounts.map((acc: any) => ({
        'Código Banco': acc.bankCode,
        'Entidad Bancaria': acc.bankName,
        'N° Cuenta': acc.accountNumber,
        'Tipo': acc.accountType,
        'Moneda': acc.currency,
        'Sucursal': acc.branchName,
        'Saldo en Libros': acc.currentBalance,
        'Partidas en Tránsito': acc.transitBalance,
        'Saldo Real Banco': acc.realBalance,
        'Equivalente USD': acc.equivalentUSD,
        'Equivalente VES': acc.equivalentVES,
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="posicion_bancaria_tesoreria.csv"');
      return c.text(csv);
    }

    if (format === 'excel' || format === 'xlsx') {
      const flatRows = data.accounts.map((acc: any) => ({
        'Código Banco': acc.bankCode,
        'Entidad Bancaria': acc.bankName,
        'N° Cuenta': acc.accountNumber,
        'Tipo': acc.accountType,
        'Moneda': acc.currency,
        'Sucursal': acc.branchName,
        'Saldo en Libros': acc.currentBalance,
        'Partidas en Tránsito': acc.transitBalance,
        'Saldo Real Banco': acc.realBalance,
        'Equivalente USD': acc.equivalentUSD,
        'Equivalente VES': acc.equivalentVES,
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Posición Bancaria');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="posicion_bancaria_tesoreria.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/reports/bank-movements - Libro Auxiliar y Cartola de Movimientos Bancarios
reportsRouter.get('/bank-movements', authenticate, authorize('reports', 'bank_movements'), async (c) => {
  const user = c.get('user');
  const accountId = c.req.query('accountId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const movementType = c.req.query('movementType');
  const isReconciledQuery = c.req.query('isReconciled');
  const isReconciled = isReconciledQuery !== undefined ? isReconciledQuery === 'true' : undefined;
  const direction = (c.req.query('direction') as 'INFLOW' | 'OUTFLOW') || undefined;
  const search = c.req.query('search');
  const format = c.req.query('format') || c.req.query('export') || 'json';

  try {
    const data = await ReportsService.getBankMovementsReport(user.companyId, {
      accountId,
      startDate,
      endDate,
      movementType,
      isReconciled,
      direction,
      search,
    });

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);

      const buffer = ReportsPdfEngine.generateBankMovementsPDF(data, company, userName, {
        startDate,
        endDate,
        currency: data.account?.currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="movimientos_cuenta_${data.account?.accountNumber || 'banco'}.pdf"`);
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = data.movements.map((m: any) => ({
        'Fecha / Hora': m.date,
        'Referencia': m.reference,
        'Operación': m.type,
        'Concepto': m.concept,
        'Ingreso (+)': m.debit,
        'Egreso (-)': m.credit,
        'Saldo en Libros': m.balanceAfter,
        'Conciliado': m.isReconciled ? 'SÍ' : 'NO',
        'Operador': m.userName,
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="movimientos_cuenta_bancaria.csv"');
      return c.text(csv);
    }

    if (format === 'excel' || format === 'xlsx') {
      const flatRows = data.movements.map((m: any) => ({
        'Fecha / Hora': m.date,
        'Referencia': m.reference,
        'Operación': m.type,
        'Concepto': m.concept,
        'Ingreso (+)': m.debit,
        'Egreso (-)': m.credit,
        'Saldo en Libros': m.balanceAfter,
        'Conciliado': m.isReconciled ? 'SÍ' : 'NO',
        'Operador': m.userName,
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Movimientos');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="movimientos_cuenta_bancaria.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/reports/bank-reconciliation - Acta Oficial de Conciliación Bancaria Certificada
reportsRouter.get('/bank-reconciliation', authenticate, authorize('reports', 'bank_reconciliation'), async (c) => {
  const user = c.get('user');
  const accountId = c.req.query('accountId');
  const reconciliationId = c.req.query('reconciliationId');
  const asOfDate = c.req.query('asOfDate') || c.req.query('endDate');
  const format = c.req.query('format') || c.req.query('export') || 'json';

  if (!accountId) {
    return c.json({ success: false, error: { message: 'Debe especificar el parámetro accountId.' } }, 400);
  }

  try {
    const data = await ReportsService.getBankReconciliationReport(user.companyId, {
      accountId,
      reconciliationId,
      asOfDate,
    });

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);

      const buffer = ReportsPdfEngine.generateBankReconciliationPDF(data, company, userName, {
        currency: data.account?.currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="acta_conciliacion_${data.account?.accountNumber || 'banco'}.pdf"`);
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const rec = data.reconciliation;
      const flatRows = [
        { 'Concepto': 'Saldo según Estado de Cuenta Bancario', 'Monto': rec.statementBalance },
        { 'Concepto': '(+) Depósitos en Tránsito', 'Monto': data.unclearedDeposits?.total || 0 },
        { 'Concepto': '(-) Cheques / Egresos en Tránsito', 'Monto': -(data.unclearedWithdrawals?.total || 0) },
        { 'Concepto': '(=) Saldo Bancario Conciliado', 'Monto': rec.adjustedBankBalance },
        { 'Concepto': 'Saldo según Libros ERP', 'Monto': rec.finalBookBalance },
        { 'Concepto': 'Diferencia', 'Monto': rec.difference },
        { 'Concepto': 'Dictamen', 'Monto': data.isBalanced ? 'CUADRADO' : 'DISCREPANCIA' },
      ];
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="acta_conciliacion_bancaria.csv"');
      return c.text(csv);
    }

    if (format === 'excel' || format === 'xlsx') {
      const rec = data.reconciliation;
      const flatRows = [
        { 'Concepto': 'Saldo según Estado de Cuenta Bancario', 'Monto': rec.statementBalance },
        { 'Concepto': '(+) Depósitos en Tránsito', 'Monto': data.unclearedDeposits?.total || 0 },
        { 'Concepto': '(-) Cheques / Egresos en Tránsito', 'Monto': -(data.unclearedWithdrawals?.total || 0) },
        { 'Concepto': '(=) Saldo Bancario Conciliado', 'Monto': rec.adjustedBankBalance },
        { 'Concepto': 'Saldo según Libros ERP', 'Monto': rec.finalBookBalance },
        { 'Concepto': 'Diferencia', 'Monto': rec.difference },
        { 'Concepto': 'Dictamen', 'Monto': data.isBalanced ? 'CUADRADO' : 'DISCREPANCIA' },
      ];
      const buffer = ReportsService.exportToExcel(flatRows, 'Conciliación');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="acta_conciliacion_bancaria.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/reports/cash-flow - Flujo de Caja Operativo de Tesorería
reportsRouter.get('/cash-flow', authenticate, authorize('reports', 'export_pdf'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const currency = (c.req.query('currency') as 'VES' | 'USD' | 'BOTH') || undefined;
  const format = c.req.query('format') || c.req.query('export') || 'json';

  try {
    const data = await ReportsService.getCashFlowReport(user.companyId, {
      branchId,
      startDate,
      endDate,
      currency,
    });

    if (format === 'pdf') {
      const [company, userName, branchName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
        ReportsService.getBranchName(branchId),
      ]);

      const buffer = ReportsPdfEngine.generateCashFlowPDF(data, company, userName, {
        startDate,
        endDate,
        branchName,
        currency,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="flujo_caja_tesoreria_${startDate || 'inicio'}_${endDate || 'fin'}.pdf"`);
      return c.body(new Uint8Array(buffer));
    }

    if (format === 'csv') {
      const flatRows = data.categories.map((cat: any) => ({
        'Concepto / Categoría': cat.label,
        'Naturaleza': cat.isOutflow ? 'Egreso' : 'Ingreso',
        'Bolívares (VES)': cat.ves,
        'Dólares (USD)': cat.usd,
        'Consolidado ($)': cat.consolidatedUSD,
      }));
      const csv = ReportsService.exportToCSV(flatRows);
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="flujo_caja_tesoreria.csv"');
      return c.text(csv);
    }

    if (format === 'excel' || format === 'xlsx') {
      const flatRows = data.categories.map((cat: any) => ({
        'Concepto / Categoría': cat.label,
        'Naturaleza': cat.isOutflow ? 'Egreso' : 'Ingreso',
        'Bolívares (VES)': cat.ves,
        'Dólares (USD)': cat.usd,
        'Consolidado ($)': cat.consolidatedUSD,
      }));
      const buffer = ReportsService.exportToExcel(flatRows, 'Flujo de Caja');
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="flujo_caja_tesoreria.xlsx"');
      return c.body(new Uint8Array(buffer));
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
