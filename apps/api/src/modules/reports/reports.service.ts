import { query } from '../../db';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';

const autoTable = (typeof autoTableImport === 'function'
  ? autoTableImport
  : (autoTableImport as any).default || autoTableImport) as typeof autoTableImport;

export interface SalesReportFilters {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  cashRegisterId?: string;
  userId?: string;
  paymentMethod?: string;
  status?: string;
}

export interface CashShiftsReportFilters {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  cashRegisterId?: string;
  userId?: string;
  status?: string;
}

export class ReportsService {
  /**
   * Reporte de Productos con Jerarquía y Ubicación Física
   */
  static async getInventoryHierarchyReport(companyId: string) {
    return await query<any>(
      `SELECT * FROM v_products_by_hierarchy WHERE company_id = ? ORDER BY department_name, group_name, product_name`,
      [companyId]
    );
  }

  /**
   * Reporte de Libro de Ventas Fiscal (SENIAT)
   */
  static async getSalesBookReport(companyId: string, period?: string) {
    return await query<any>(
      `SELECT * FROM v_book_sales 
       WHERE company_id = ? AND (? IS NULL OR fiscal_period = ?)
       ORDER BY emission_date ASC, row_num ASC`,
      [companyId, period || null, period || null]
    );
  }

  /**
   * Reporte de Ventas (Resumido y Detallado)
   */
  static async getSalesReport(companyId: string, filters: SalesReportFilters = {}) {
    const whereConditions: string[] = ['b.company_id = ?'];
    const params: any[] = [companyId];

    if (filters.startDate) {
      whereConditions.push('si.created_at >= ?');
      params.push(`${filters.startDate} 00:00:00`);
    }
    if (filters.endDate) {
      whereConditions.push('si.created_at <= ?');
      params.push(`${filters.endDate} 23:59:59`);
    }
    if (filters.branchId && filters.branchId !== 'all') {
      whereConditions.push('si.branch_id = ?');
      params.push(filters.branchId);
    }
    if (filters.userId && filters.userId !== 'all') {
      whereConditions.push('si.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.cashRegisterId && filters.cashRegisterId !== 'all') {
      whereConditions.push('cs.cash_register_id = ?');
      params.push(filters.cashRegisterId);
    }
    if (filters.status && filters.status !== 'all') {
      whereConditions.push('si.status = ?');
      params.push(filters.status);
    } else {
      whereConditions.push("si.status <> 'ANNULLED'");
    }

    const whereClause = whereConditions.join(' AND ');

    // 1. Facturas detalladas
    const detailedQuery = `
      SELECT 
        si.id,
        si.invoice_number,
        si.control_number,
        si.created_at as emission_date,
        si.branch_id,
        b.name as branch_name,
        cs.cash_register_id,
        cr.code as cash_register_code,
        cr.name as cash_register_name,
        si.user_id,
        u.full_name as cashier_name,
        si.customer_id,
        COALESCE(CONCAT(c.doc_type, '-', c.doc_number), 'V-00000000') as customer_doc,
        COALESCE(c.name, 'CLIENTE CONTADO') as customer_name,
        si.currency,
        si.exchange_rate,
        si.base_exempt_amount as exempt_usd,
        si.base_taxable_amount as taxable_usd,
        si.tax_amount as iva_usd,
        COALESCE(si.igtf_amount, 0) as igtf_usd,
        si.total_amount as total_usd,
        ROUND(si.total_amount * si.exchange_rate, 2) as total_ves,
        si.is_credit,
        si.status
      FROM sales_invoices si
      INNER JOIN branches b ON si.branch_id = b.id
      INNER JOIN users u ON si.user_id = u.id
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN cash_shifts cs ON si.shift_id = cs.id
      LEFT JOIN cash_registers cr ON cs.cash_register_id = cr.id
      WHERE ${whereClause}
      ORDER BY si.created_at DESC
    `;

    const invoices = await query<any>(detailedQuery, params);

    // 2. Pagos por factura
    const invoiceIds = invoices.map((inv) => inv.id);
    let paymentsByInvoice: Record<string, any[]> = {};

    if (invoiceIds.length > 0) {
      // Chunk to prevent MySQL packet limits
      const placeholders = invoiceIds.map(() => '?').join(',');
      const paymentsRows = await query<any>(
        `SELECT invoice_id, method, amount_ves, amount_usd, exchange_rate, reference_number, applies_igtf, igtf_amount_usd
         FROM sales_payments
         WHERE invoice_id IN (${placeholders})`,
        invoiceIds
      );

      for (const p of paymentsRows) {
        if (!paymentsByInvoice[p.invoice_id]) paymentsByInvoice[p.invoice_id] = [];
        paymentsByInvoice[p.invoice_id].push({
          method: p.method,
          amountVES: Number(p.amount_ves),
          amountUSD: Number(p.amount_usd),
          referenceNumber: p.reference_number,
          appliesIGTF: Boolean(p.applies_igtf),
          igtfAmountUSD: Number(p.igtf_amount_usd),
        });
      }
    }

    // Unir facturas con sus pagos
    const detailedInvoices = invoices.map((inv) => {
      const pmts = paymentsByInvoice[inv.id] || [];
      return {
        ...inv,
        exemptUSD: Number(inv.exempt_usd),
        taxableUSD: Number(inv.taxable_usd),
        ivaUSD: Number(inv.iva_usd),
        igtfUSD: Number(inv.igtf_usd),
        totalUSD: Number(inv.total_usd),
        totalVES: Number(inv.total_ves),
        exchangeRate: Number(inv.exchange_rate),
        payments: pmts,
        paymentMethodsSummary: pmts.map((p) => p.method).join(', ') || 'N/A',
      };
    });

    // Filtro en memoria por paymentMethod si fue solicitado
    const filteredDetailed = filters.paymentMethod && filters.paymentMethod !== 'all'
      ? detailedInvoices.filter((inv) => inv.payments.some((p: any) => p.method === filters.paymentMethod))
      : detailedInvoices;

    // 3. Totales & KPIs resumidos
    const totalInvoicesCount = filteredDetailed.length;
    const totalSalesUSD = filteredDetailed.reduce((sum, inv) => sum + inv.totalUSD, 0);
    const totalSalesVES = filteredDetailed.reduce((sum, inv) => sum + inv.totalVES, 0);
    const totalExemptUSD = filteredDetailed.reduce((sum, inv) => sum + inv.exemptUSD, 0);
    const totalTaxableUSD = filteredDetailed.reduce((sum, inv) => sum + inv.taxableUSD, 0);
    const totalIvaUSD = filteredDetailed.reduce((sum, inv) => sum + inv.ivaUSD, 0);
    const totalIgtfUSD = filteredDetailed.reduce((sum, inv) => sum + inv.igtfUSD, 0);
    const averageTicketUSD = totalInvoicesCount > 0 ? totalSalesUSD / totalInvoicesCount : 0;

    // 4. Desglose acumulado por método de pago
    const paymentMethodsBreakdown: Record<string, { count: number; totalUSD: number; totalVES: number }> = {};
    for (const inv of filteredDetailed) {
      for (const p of inv.payments) {
        if (!paymentMethodsBreakdown[p.method]) {
          paymentMethodsBreakdown[p.method] = { count: 0, totalUSD: 0, totalVES: 0 };
        }
        paymentMethodsBreakdown[p.method].count += 1;
        paymentMethodsBreakdown[p.method].totalUSD += p.amountUSD;
        paymentMethodsBreakdown[p.method].totalVES += p.amountVES;
      }
    }

    // 5. Agrupación diaria para el modo resumido
    const dailySummaryMap: Record<string, any> = {};
    for (const inv of filteredDetailed) {
      const day = new Date(inv.emission_date).toISOString().slice(0, 10);
      if (!dailySummaryMap[day]) {
        dailySummaryMap[day] = {
          date: day,
          invoicesCount: 0,
          totalUSD: 0,
          totalVES: 0,
          exemptUSD: 0,
          taxableUSD: 0,
          ivaUSD: 0,
          igtfUSD: 0,
        };
      }
      dailySummaryMap[day].invoicesCount += 1;
      dailySummaryMap[day].totalUSD += inv.totalUSD;
      dailySummaryMap[day].totalVES += inv.totalVES;
      dailySummaryMap[day].exemptUSD += inv.exemptUSD;
      dailySummaryMap[day].taxableUSD += inv.taxableUSD;
      dailySummaryMap[day].ivaUSD += inv.ivaUSD;
      dailySummaryMap[day].igtfUSD += inv.igtfUSD;
    }

    const dailySummary = Object.values(dailySummaryMap).sort((a, b) => b.date.localeCompare(a.date));

    return {
      summary: {
        totalInvoicesCount,
        totalSalesUSD: Number(totalSalesUSD.toFixed(2)),
        totalSalesVES: Number(totalSalesVES.toFixed(2)),
        totalExemptUSD: Number(totalExemptUSD.toFixed(2)),
        totalTaxableUSD: Number(totalTaxableUSD.toFixed(2)),
        totalIvaUSD: Number(totalIvaUSD.toFixed(2)),
        totalIgtfUSD: Number(totalIgtfUSD.toFixed(2)),
        averageTicketUSD: Number(averageTicketUSD.toFixed(2)),
        paymentMethods: Object.entries(paymentMethodsBreakdown).map(([method, data]) => ({
          method,
          count: data.count,
          totalUSD: Number(data.totalUSD.toFixed(2)),
          totalVES: Number(data.totalVES.toFixed(2)),
        })),
      },
      dailySummary,
      invoices: filteredDetailed,
    };
  }

  /**
   * Reporte de Cierres de Turno de Caja (Arqueo X y Z) - Resumido y Detallado
   */
  static async getCashShiftsReport(companyId: string, filters: CashShiftsReportFilters = {}) {
    const whereConditions: string[] = ['b.company_id = ?'];
    const params: any[] = [companyId];

    if (filters.startDate) {
      whereConditions.push('cs.opened_at >= ?');
      params.push(`${filters.startDate} 00:00:00`);
    }
    if (filters.endDate) {
      whereConditions.push('cs.opened_at <= ?');
      params.push(`${filters.endDate} 23:59:59`);
    }
    if (filters.branchId && filters.branchId !== 'all') {
      whereConditions.push('cs.branch_id = ?');
      params.push(filters.branchId);
    }
    if (filters.cashRegisterId && filters.cashRegisterId !== 'all') {
      whereConditions.push('cs.cash_register_id = ?');
      params.push(filters.cashRegisterId);
    }
    if (filters.userId && filters.userId !== 'all') {
      whereConditions.push('cs.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.status && filters.status !== 'all') {
      whereConditions.push('cs.status = ?');
      params.push(filters.status);
    }

    const whereClause = whereConditions.join(' AND ');

    const shiftsQuery = `
      SELECT 
        cs.id,
        cs.branch_id,
        b.name as branch_name,
        cs.cash_register_id,
        cr.code as cash_register_code,
        cr.name as cash_register_name,
        cr.fiscal_printer_serial,
        cr.invoice_mode,
        cs.user_id,
        u.full_name as cashier_name,
        cs.opened_at,
        cs.closed_at,
        cs.initial_cash_usd,
        cs.initial_cash_ves,
        cs.final_cash_usd_expected,
        cs.final_cash_ves_expected,
        cs.final_cash_usd_counted,
        cs.final_cash_ves_counted,
        cs.difference_usd,
        cs.difference_ves,
        cs.deposit_bank_account_ves_id,
        ba_ves.account_number as deposit_account_ves,
        b_ves.name as deposit_bank_name_ves,
        cs.deposit_amount_ves,
        cs.deposit_reference_ves,
        cs.deposit_bank_account_usd_id,
        ba_usd.account_number as deposit_account_usd,
        b_usd.name as deposit_bank_name_usd,
        cs.deposit_amount_usd,
        cs.deposit_reference_usd,
        cs.status,
        cs.notes
      FROM cash_shifts cs
      INNER JOIN branches b ON cs.branch_id = b.id
      INNER JOIN cash_registers cr ON cs.cash_register_id = cr.id
      INNER JOIN users u ON cs.user_id = u.id
      LEFT JOIN bank_accounts ba_ves ON cs.deposit_bank_account_ves_id = ba_ves.id
      LEFT JOIN banks b_ves ON ba_ves.bank_id = b_ves.id
      LEFT JOIN bank_accounts ba_usd ON cs.deposit_bank_account_usd_id = ba_usd.id
      LEFT JOIN banks b_usd ON ba_usd.bank_id = b_usd.id
      WHERE ${whereClause}
      ORDER BY cs.opened_at DESC
    `;

    const shiftRows = await query<any>(shiftsQuery, params);

    // Obtener recaudación por turno desde sales_payments
    const shiftIds = shiftRows.map((s) => s.id);
    let paymentsByShift: Record<string, {
      totalInvoices: number;
      cashSalesUSD: number;
      cashSalesVES: number;
      pagomovilVES: number;
      debitVES: number;
      creditVES: number;
      posBatchVES: number;
      zelleUSD: number;
      otherVES: number;
      otherUSD: number;
      totalCollectedVES: number;
      totalCollectedUSD: number;
      totalIGTFUSD: number;
    }> = {};

    if (shiftIds.length > 0) {
      const placeholders = shiftIds.map(() => '?').join(',');
      const payments = await query<any>(
        `SELECT 
           si.shift_id,
           sp.method,
           COUNT(DISTINCT si.id) as tx_count,
           SUM(sp.amount_usd) as total_usd,
           SUM(sp.amount_ves) as total_ves,
           SUM(sp.igtf_amount_usd) as igtf_usd
         FROM sales_invoices si
         INNER JOIN sales_payments sp ON si.id = sp.invoice_id
         WHERE si.shift_id IN (${placeholders}) AND si.status <> 'ANNULLED'
         GROUP BY si.shift_id, sp.method`,
        shiftIds
      );

      for (const p of payments) {
        if (!paymentsByShift[p.shift_id]) {
          paymentsByShift[p.shift_id] = {
            totalInvoices: 0,
            cashSalesUSD: 0,
            cashSalesVES: 0,
            pagomovilVES: 0,
            debitVES: 0,
            creditVES: 0,
            posBatchVES: 0,
            zelleUSD: 0,
            otherVES: 0,
            otherUSD: 0,
            totalCollectedVES: 0,
            totalCollectedUSD: 0,
            totalIGTFUSD: 0,
          };
        }

        const s = paymentsByShift[p.shift_id];
        const u = Number(p.total_usd || 0);
        const v = Number(p.total_ves || 0);
        s.totalIGTFUSD += Number(p.igtf_usd || 0);
        s.totalInvoices += Number(p.tx_count || 0);

        const m = String(p.method || '').toUpperCase().trim();
        if (m === 'CASH_USD') s.cashSalesUSD += u;
        else if (m === 'CASH_VES') s.cashSalesVES += v;
        else if (m === 'PAGO_MOVIL') s.pagomovilVES += v;
        else if (m === 'DEBIT_CARD') s.debitVES += v;
        else if (m === 'CREDIT_CARD') s.creditVES += v;
        else if (m === 'ZELLE') s.zelleUSD += u;
        else {
          if (v > 0) s.otherVES += v;
          else if (u > 0) s.otherUSD += u;
        }
      }

      // Finalizar cálculos derivados
      for (const s of Object.values(paymentsByShift)) {
        s.posBatchVES = Number((s.debitVES + s.creditVES).toFixed(2));
        s.totalCollectedVES = Number((s.cashSalesVES + s.debitVES + s.creditVES + s.pagomovilVES + s.otherVES).toFixed(2));
        s.totalCollectedUSD = Number((s.cashSalesUSD + s.zelleUSD + s.otherUSD).toFixed(2));
      }
    }

    const detailedShifts = shiftRows.map((shift) => {
      const pmts = paymentsByShift[shift.id] || {
        totalInvoices: 0,
        cashSalesUSD: 0,
        cashSalesVES: 0,
        pagomovilVES: 0,
        debitVES: 0,
        creditVES: 0,
        posBatchVES: 0,
        zelleUSD: 0,
        otherVES: 0,
        otherUSD: 0,
        totalCollectedVES: 0,
        totalCollectedUSD: 0,
        totalIGTFUSD: 0,
      };

      const diffUSD = Number(shift.difference_usd || 0);
      const diffVES = Number(shift.difference_ves || 0);
      let auditStatus = 'BALANCED';
      if (diffUSD < 0 || diffVES < 0) auditStatus = 'SHORTAGE';
      else if (diffUSD > 0 || diffVES > 0) auditStatus = 'SURPLUS';

      return {
        id: shift.id,
        branchId: shift.branch_id,
        branchName: shift.branch_name,
        cashRegisterId: shift.cash_register_id,
        cashRegisterCode: shift.cash_register_code,
        cashRegisterName: shift.cash_register_name,
        fiscalPrinterSerial: shift.fiscal_printer_serial,
        invoiceMode: shift.invoice_mode,
        userId: shift.user_id,
        cashierName: shift.cashier_name,
        openedAt: shift.opened_at,
        closedAt: shift.closed_at,
        status: shift.status,
        auditStatus,
        initialCashUSD: Number(shift.initial_cash_usd),
        initialCashVES: Number(shift.initial_cash_ves),
        finalCashUSDExpected: Number(shift.final_cash_usd_expected || 0),
        finalCashVESExpected: Number(shift.final_cash_ves_expected || 0),
        finalCashUSDCounted: Number(shift.final_cash_usd_counted || 0),
        finalCashVESCounted: Number(shift.final_cash_ves_counted || 0),
        differenceUSD: diffUSD,
        differenceVES: diffVES,
        depositAmountVES: Number(shift.deposit_amount_ves || 0),
        depositReferenceVES: shift.deposit_reference_ves,
        depositAccountVES: shift.deposit_account_ves ? `${shift.deposit_bank_name_ves || 'Banco'} (${shift.deposit_account_ves.slice(-4)})` : null,
        depositAmountUSD: Number(shift.deposit_amount_usd || 0),
        depositReferenceUSD: shift.deposit_reference_usd,
        depositAccountUSD: shift.deposit_account_usd ? `${shift.deposit_bank_name_usd || 'Banco'} (${shift.deposit_account_usd.slice(-4)})` : null,
        notes: shift.notes,
        revenue: pmts,
      };
    });

    // Totales agregados
    const totalShiftsCount = detailedShifts.length;
    const closedShifts = detailedShifts.filter((s) => s.status === 'CLOSED');
    const balancedCount = closedShifts.filter((s) => s.auditStatus === 'BALANCED').length;
    const shortageCount = closedShifts.filter((s) => s.auditStatus === 'SHORTAGE').length;
    const surplusCount = closedShifts.filter((s) => s.auditStatus === 'SURPLUS').length;

    const totalDepositedVES = detailedShifts.reduce((sum, s) => sum + s.depositAmountVES, 0);
    const totalDepositedUSD = detailedShifts.reduce((sum, s) => sum + s.depositAmountUSD, 0);
    const totalPosBatchesVES = detailedShifts.reduce((sum, s) => sum + s.revenue.posBatchVES, 0);
    const totalPagoMovilVES = detailedShifts.reduce((sum, s) => sum + s.revenue.pagomovilVES, 0);
    const totalCashCollectedVES = detailedShifts.reduce((sum, s) => sum + s.revenue.cashSalesVES, 0);
    const totalCashCollectedUSD = detailedShifts.reduce((sum, s) => sum + s.revenue.cashSalesUSD, 0);
    const totalRevenueVES = detailedShifts.reduce((sum, s) => sum + s.revenue.totalCollectedVES, 0);
    const totalRevenueUSD = detailedShifts.reduce((sum, s) => sum + s.revenue.totalCollectedUSD, 0);

    return {
      summary: {
        totalShiftsCount,
        closedShiftsCount: closedShifts.length,
        openShiftsCount: totalShiftsCount - closedShifts.length,
        balancedCount,
        shortageCount,
        surplusCount,
        totalDepositedVES: Number(totalDepositedVES.toFixed(2)),
        totalDepositedUSD: Number(totalDepositedUSD.toFixed(2)),
        totalPosBatchesVES: Number(totalPosBatchesVES.toFixed(2)),
        totalPagoMovilVES: Number(totalPagoMovilVES.toFixed(2)),
        totalCashCollectedVES: Number(totalCashCollectedVES.toFixed(2)),
        totalCashCollectedUSD: Number(totalCashCollectedUSD.toFixed(2)),
        totalRevenueVES: Number(totalRevenueVES.toFixed(2)),
        totalRevenueUSD: Number(totalRevenueUSD.toFixed(2)),
      },
      shifts: detailedShifts,
    };
  }

  /**
   * Reporte de Ventas por Producto
   */
  static async getSalesByProductReport(companyId: string, startDate?: string, endDate?: string) {
    const params: any[] = [companyId];
    let dateFilter = '';
    if (startDate) {
      dateFilter += ' AND si.created_at >= ?';
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      dateFilter += ' AND si.created_at <= ?';
      params.push(`${endDate} 23:59:59`);
    }

    const rows = await query<any>(
      `SELECT 
         p.id as product_id,
         p.sku,
         p.barcode,
         p.name as product_name,
         d.name as department_name,
         SUM(sii.quantity) as total_qty_sold,
         SUM(sii.subtotal) as subtotal_usd,
         SUM(sii.tax_amount) as tax_usd,
         SUM(sii.total) as total_sales_usd,
         ROUND(SUM(sii.total * si.exchange_rate), 2) as total_sales_ves,
         COUNT(DISTINCT si.id) as invoices_count
       FROM sales_invoice_items sii
       INNER JOIN sales_invoices si ON sii.invoice_id = si.id
       INNER JOIN products p ON sii.product_id = p.id
       LEFT JOIN departments d ON p.department_id = d.id
       WHERE si.company_id = ? AND si.status <> 'ANNULLED' ${dateFilter}
       GROUP BY p.id, p.sku, p.barcode, p.name, d.name
       ORDER BY total_sales_usd DESC`,
      params
    );

    return rows.map((r) => ({
      productId: r.product_id,
      sku: r.sku,
      barcode: r.barcode,
      productName: r.product_name,
      departmentName: r.department_name || 'Sin departamento',
      totalQtySold: Number(r.total_qty_sold),
      subtotalUSD: Number(r.subtotal_usd),
      taxUSD: Number(r.tax_usd),
      totalSalesUSD: Number(r.total_sales_usd),
      totalSalesVES: Number(r.total_sales_ves),
      invoicesCount: Number(r.invoices_count),
    }));
  }

  /**
   * Reporte de Ventas por Cajero / Vendedor
   */
  static async getSalesByCashierReport(companyId: string, startDate?: string, endDate?: string) {
    const params: any[] = [companyId];
    let dateFilter = '';
    if (startDate) {
      dateFilter += ' AND si.created_at >= ?';
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      dateFilter += ' AND si.created_at <= ?';
      params.push(`${endDate} 23:59:59`);
    }

    const rows = await query<any>(
      `SELECT 
         u.id as user_id,
         u.full_name as cashier_name,
         u.email,
         b.name as branch_name,
         COUNT(si.id) as invoices_count,
         SUM(si.total_amount) as total_sales_usd,
         ROUND(SUM(si.total_amount * si.exchange_rate), 2) as total_sales_ves,
         ROUND(AVG(si.total_amount), 2) as average_ticket_usd
       FROM sales_invoices si
       INNER JOIN users u ON si.user_id = u.id
       INNER JOIN branches b ON si.branch_id = b.id
       WHERE si.company_id = ? AND si.status <> 'ANNULLED' ${dateFilter}
       GROUP BY u.id, u.full_name, u.email, b.name
       ORDER BY total_sales_usd DESC`,
      params
    );

    return rows.map((r) => ({
      userId: r.user_id,
      cashierName: r.cashier_name,
      email: r.email,
      branchName: r.branch_name,
      invoicesCount: Number(r.invoices_count),
      totalSalesUSD: Number(r.total_sales_usd),
      totalSalesVES: Number(r.total_sales_ves),
      averageTicketUSD: Number(r.average_ticket_usd),
    }));
  }

  /**
   * Exportador a CSV
   */
  static exportToCSV(data: any[]): string {
    return Papa.unparse(data);
  }

  /**
   * Exportador a Excel (XLSX Buffer)
   */
  static exportToExcel(data: any[], sheetName = 'Reporte'): Buffer {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Obtiene la información fiscal de la empresa para reportes PDF
   */
  static async getCompanyPdfInfo(companyId: string) {
    const rows = await query<any>(
      `SELECT rif, legal_name, trade_name, fiscal_address, phone, email, is_special_taxpayer 
       FROM companies 
       WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (rows.length > 0) {
      return {
        rif: rows[0].rif,
        legalName: rows[0].legal_name,
        tradeName: rows[0].trade_name,
        fiscalAddress: rows[0].fiscal_address,
        phone: rows[0].phone,
        email: rows[0].email,
        isSpecialTaxpayer: !!rows[0].is_special_taxpayer,
      };
    }

    return {
      rif: 'J-123456-7',
      legalName: 'DISTRIBUIDORA ERO VE C.A.',
      tradeName: 'DISTRIBUIDORA ERO VE',
      fiscalAddress: 'Av. Francisco de Miranda, Torre Empresarial, Piso 8, Caracas, Venezuela',
      phone: '+58 212 999 8877',
      email: 'administracion@erove.com.ve',
      isSpecialTaxpayer: true,
    };
  }

  /**
   * Obtiene el nombre completo del usuario para la firma del reporte
   */
  static async getUserFullName(userId: string): Promise<string> {
    const rows = await query<any>(`SELECT full_name, username FROM users WHERE id = ? LIMIT 1`, [userId]);
    return rows[0]?.full_name || rows[0]?.username || 'Administrador';
  }

  /**
   * Obtiene el nombre de la sucursal si se especifica
   */
  static async getBranchName(branchId?: string): Promise<string | undefined> {
    if (!branchId || branchId === 'all') return undefined;
    const rows = await query<any>(`SELECT name FROM branches WHERE id = ? LIMIT 1`, [branchId]);
    return rows[0]?.name;
  }

  /**
   * Exportador genérico a PDF (Legacy fallback)
   */
  static exportToPDF(title: string, headers: string[], rows: any[][]): Buffer {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`, 14, 22);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    });

    return Buffer.from(doc.output('arraybuffer'));
  }
}

