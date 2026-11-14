import { query } from '../../db';
import { RestaurantService } from '../restaurant/restaurant.service';
import { ReceivablesService } from '../receivables/receivables.service';
import { PayablesService } from '../payables/payables.service';
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

export interface IGTFReportFilters {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  cashRegisterId?: string;
  shiftId?: string;
  paymentMethod?: string;
  origin?: 'ALL' | 'POS' | 'ADMIN';
  search?: string;
}

export interface PaymentMethodsReportFilters {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  paymentMethod?: string;
  origin?: 'ALL' | 'POS' | 'ADMIN_SALES' | 'COLLECTIONS' | 'PURCHASE_PAYMENTS' | 'CASH_MOVEMENTS';
  flowType?: 'ALL' | 'IN' | 'OUT';
  bankAccountId?: string;
  cashRegisterId?: string;
  shiftId?: string;
  userId?: string;
  search?: string;
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
    const rows = await query<any>(
      `SELECT * FROM v_products_by_hierarchy WHERE company_id = ? ORDER BY department_name, group_name, product_name`,
      [companyId]
    );

    return rows.map((r) => {
      const stock = Number(r.stock_qty || 0);
      const cost = Number(r.cost_price || 0);
      const basePrice = Number(r.base_price || 0);
      const finalPrice = Number(r.final_price || 0);
      return {
        productId: r.product_id,
        product_id: r.product_id,
        sku: r.sku,
        barcode: r.barcode,
        productName: r.product_name,
        product_name: r.product_name,
        departmentName: r.department_name || 'General',
        department_name: r.department_name || 'General',
        groupName: r.group_name || 'General',
        group_name: r.group_name || 'General',
        subgroupName: r.subgroup_name || '',
        subgroup_name: r.subgroup_name || '',
        supplierName: r.supplier_name || '',
        supplier_name: r.supplier_name || '',
        warehouseName: r.warehouse_name || 'Principal',
        warehouse_name: r.warehouse_name || 'Principal',
        stockQty: stock,
        stock_qty: stock,
        costPrice: cost,
        cost_price: cost,
        basePrice,
        base_price: basePrice,
        taxName: r.tax_name || 'IVA General',
        taxRate: Number(r.tax_rate || 0),
        finalPrice,
        final_price: finalPrice,
        totalCostUSD: Number((stock * cost).toFixed(2)),
        total_cost_usd: Number((stock * cost).toFixed(2)),
        totalRetailUSD: Number((stock * finalPrice).toFixed(2)),
        total_retail_usd: Number((stock * finalPrice).toFixed(2)),
      };
    });
  }

  /**
   * Reporte de Antigüedad de Cuentas por Cobrar (Aging CxC)
   */
  static async getReceivablesAgingReport(companyId: string, branchId?: string) {
    return await ReceivablesService.getAgingReport(companyId, branchId);
  }

  /**
   * Reporte de Antigüedad de Cuentas por Pagar (Aging CxP)
   */
  static async getPayablesAgingReport(companyId: string, branchId?: string) {
    return await PayablesService.getAgingReport(companyId, branchId);
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

      const depositVES = Number(shift.deposit_amount_ves || 0);
      const depositUSD = Number(shift.deposit_amount_usd || 0);
      const posBatchVES = Number(pmts.posBatchVES || 0);
      const pagomovilVES = Number(pmts.pagomovilVES || 0);
      const debitVES = Number(pmts.debitVES || 0);
      const creditVES = Number(pmts.creditVES || 0);
      const totalCollectedVES = Number(pmts.totalCollectedVES || 0);
      const totalCollectedUSD = Number(pmts.totalCollectedUSD || 0);

      return {
        id: shift.id,
        branchId: shift.branch_id,
        branchName: shift.branch_name,
        branch_name: shift.branch_name,
        cashRegisterId: shift.cash_register_id,
        cashRegisterCode: shift.cash_register_code,
        cash_register_code: shift.cash_register_code,
        cashRegisterName: shift.cash_register_name,
        cash_register_name: shift.cash_register_name,
        fiscalPrinterSerial: shift.fiscal_printer_serial,
        invoiceMode: shift.invoice_mode,
        userId: shift.user_id,
        cashierName: shift.cashier_name,
        cashier_name: shift.cashier_name,
        openedAt: shift.opened_at,
        opened_at: shift.opened_at,
        closedAt: shift.closed_at,
        closed_at: shift.closed_at,
        status: shift.status,
        auditStatus,
        initialCashUSD: Number(shift.initial_cash_usd),
        initialCashVES: Number(shift.initial_cash_ves),
        finalCashUSDExpected: Number(shift.final_cash_usd_expected || 0),
        finalCashVESExpected: Number(shift.final_cash_ves_expected || 0),
        finalCashUSDCounted: Number(shift.final_cash_usd_counted || 0),
        finalCashVESCounted: Number(shift.final_cash_ves_counted || 0),
        differenceUSD: diffUSD,
        difference_usd: diffUSD,
        differenceVES: diffVES,
        difference_ves: diffVES,
        depositAmountVES: depositVES,
        deposit_amount_ves: depositVES,
        depositReferenceVES: shift.deposit_reference_ves,
        deposit_reference_ves: shift.deposit_reference_ves,
        depositAccountVES: shift.deposit_account_ves ? `${shift.deposit_bank_name_ves || 'Banco'} (${shift.deposit_account_ves.slice(-4)})` : null,
        deposit_account_ves: shift.deposit_account_ves ? `${shift.deposit_bank_name_ves || 'Banco'} (${shift.deposit_account_ves.slice(-4)})` : null,
        depositBankNameVES: shift.deposit_bank_name_ves,
        deposit_bank_name_ves: shift.deposit_bank_name_ves,
        depositAmountUSD: depositUSD,
        deposit_amount_usd: depositUSD,
        depositReferenceUSD: shift.deposit_reference_usd,
        deposit_reference_usd: shift.deposit_reference_usd,
        depositAccountUSD: shift.deposit_account_usd ? `${shift.deposit_bank_name_usd || 'Banco'} (${shift.deposit_account_usd.slice(-4)})` : null,
        deposit_account_usd: shift.deposit_account_usd ? `${shift.deposit_bank_name_usd || 'Banco'} (${shift.deposit_account_usd.slice(-4)})` : null,
        depositBankNameUSD: shift.deposit_bank_name_usd,
        deposit_bank_name_usd: shift.deposit_bank_name_usd,
        posBatchVES,
        pos_batch_ves: posBatchVES,
        pagomovilVES,
        pagomovil_ves: pagomovilVES,
        debitVES,
        debit_ves: debitVES,
        creditVES,
        credit_ves: creditVES,
        totalCollectedVES,
        total_collected_ves: totalCollectedVES,
        totalCollectedUSD,
        total_collected_usd: totalCollectedUSD,
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
    const totalPosBatchesVES = detailedShifts.reduce((sum, s) => sum + s.posBatchVES, 0);
    const totalPagoMovilVES = detailedShifts.reduce((sum, s) => sum + s.pagomovilVES, 0);
    const totalCashCollectedVES = detailedShifts.reduce((sum, s) => sum + s.revenue.cashSalesVES, 0);
    const totalCashCollectedUSD = detailedShifts.reduce((sum, s) => sum + s.revenue.cashSalesUSD, 0);
    const totalRevenueVES = detailedShifts.reduce((sum, s) => sum + s.totalCollectedVES, 0);
    const totalRevenueUSD = detailedShifts.reduce((sum, s) => sum + s.totalCollectedUSD, 0);
    const totalDifferenceUSD = detailedShifts.reduce((sum, s) => sum + s.differenceUSD, 0);
    const totalDifferenceVES = detailedShifts.reduce((sum, s) => sum + s.differenceVES, 0);

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
        totalPOSBatchVES: Number(totalPosBatchesVES.toFixed(2)),
        totalPosBatchVES: Number(totalPosBatchesVES.toFixed(2)),
        totalPagoMovilVES: Number(totalPagoMovilVES.toFixed(2)),
        totalPagomovilVES: Number(totalPagoMovilVES.toFixed(2)),
        totalCashCollectedVES: Number(totalCashCollectedVES.toFixed(2)),
        totalCashCollectedUSD: Number(totalCashCollectedUSD.toFixed(2)),
        totalRevenueVES: Number(totalRevenueVES.toFixed(2)),
        totalRevenueUSD: Number(totalRevenueUSD.toFixed(2)),
        totalCollectedVES: Number(totalRevenueVES.toFixed(2)),
        totalCollectedUSD: Number(totalRevenueUSD.toFixed(2)),
        totalDifferenceUSD: Number(totalDifferenceUSD.toFixed(2)),
        totalDifferenceVES: Number(totalDifferenceVES.toFixed(2)),
      },
      shifts: detailedShifts,
    };
  }

  /**
   * Reporte de Ventas por Producto
   */
  static async getSalesByProductReport(companyId: string, startDate?: string, endDate?: string, branchId?: string) {
    const params: any[] = [companyId];
    let dateFilter = '';
    if (startDate) {
      dateFilter += ' AND (si.invoice_date >= ? OR si.created_at >= ?)';
      params.push(`${startDate} 00:00:00`, `${startDate} 00:00:00`);
    }
    if (endDate) {
      dateFilter += ' AND (si.invoice_date <= ? OR si.created_at <= ?)';
      params.push(`${endDate} 23:59:59`, `${endDate} 23:59:59`);
    }
    if (branchId && branchId !== 'all') {
      dateFilter += ' AND si.branch_id = ?';
      params.push(branchId);
    }

    const rows = await query<any>(
      `SELECT 
         p.id as product_id,
         p.sku,
         p.barcode,
         p.name as product_name,
         COALESCE(d.name, 'General') as department_name,
         SUM(sii.quantity) as total_qty_sold,
         SUM(sii.subtotal) as subtotal_usd,
         SUM(sii.tax_amount) as tax_usd,
         SUM(sii.total) as total_sales_usd,
         ROUND(SUM(sii.total * si.exchange_rate), 2) as total_sales_ves,
         COUNT(DISTINCT si.id) as invoices_count
       FROM sales_invoice_items sii
       INNER JOIN sales_invoices si ON sii.invoice_id = si.id
       INNER JOIN branches b ON si.branch_id = b.id
       INNER JOIN products p ON sii.product_id = p.id
       LEFT JOIN departments d ON p.department_id = d.id
       WHERE b.company_id = ? AND si.status <> 'ANNULLED' ${dateFilter}
       GROUP BY p.id, p.sku, p.barcode, p.name, d.name
       ORDER BY total_sales_usd DESC`,
      params
    );

    return rows.map((r) => {
      const totalUnits = Number(r.total_qty_sold || 0);
      const totalSalesUSD = Number(r.total_sales_usd || 0);
      const avgPriceUSD = totalUnits > 0 ? Number((totalSalesUSD / totalUnits).toFixed(2)) : 0;

      return {
        productId: r.product_id,
        product_id: r.product_id,
        sku: r.sku,
        barcode: r.barcode,
        productName: r.product_name,
        product_name: r.product_name,
        departmentName: r.department_name || 'General',
        department_name: r.department_name || 'General',
        categoryName: r.department_name || 'General',
        category_name: r.department_name || 'General',
        totalQtySold: totalUnits,
        total_qty_sold: totalUnits,
        total_units: totalUnits,
        averagePriceUSD: avgPriceUSD,
        average_price_usd: avgPriceUSD,
        subtotalUSD: Number(r.subtotal_usd || 0),
        subtotal_usd: Number(r.subtotal_usd || 0),
        taxUSD: Number(r.tax_usd || 0),
        tax_usd: Number(r.tax_usd || 0),
        totalSalesUSD: totalSalesUSD,
        total_sales_usd: totalSalesUSD,
        totalSalesVES: Number(r.total_sales_ves || 0),
        total_sales_ves: Number(r.total_sales_ves || 0),
        invoicesCount: Number(r.invoices_count || 0),
        invoices_count: Number(r.invoices_count || 0),
      };
    });
  }

  /**
   * Reporte de Ventas por Cajero / Vendedor
   */
  static async getSalesByCashierReport(companyId: string, startDate?: string, endDate?: string, branchId?: string) {
    const params: any[] = [companyId];
    let dateFilter = '';
    if (startDate) {
      dateFilter += ' AND (si.invoice_date >= ? OR si.created_at >= ?)';
      params.push(`${startDate} 00:00:00`, `${startDate} 00:00:00`);
    }
    if (endDate) {
      dateFilter += ' AND (si.invoice_date <= ? OR si.created_at <= ?)';
      params.push(`${endDate} 23:59:59`, `${endDate} 23:59:59`);
    }
    if (branchId && branchId !== 'all') {
      dateFilter += ' AND si.branch_id = ?';
      params.push(branchId);
    }

    const rows = await query<any>(
      `SELECT 
         u.id as user_id,
         u.full_name as cashier_name,
         u.email,
         b.name as branch_name,
         COUNT(DISTINCT si.shift_id) as total_shifts,
         COUNT(si.id) as invoices_count,
         SUM(si.total_amount) as total_sales_usd,
         ROUND(SUM(si.total_amount * si.exchange_rate), 2) as total_sales_ves,
         ROUND(AVG(si.total_amount), 2) as average_ticket_usd
       FROM sales_invoices si
       INNER JOIN users u ON si.user_id = u.id
       INNER JOIN branches b ON si.branch_id = b.id
       WHERE b.company_id = ? AND si.status <> 'ANNULLED' ${dateFilter}
       GROUP BY u.id, u.full_name, u.email, b.name
       ORDER BY total_sales_usd DESC`,
      params
    );

    // Obtener recaudación POS agrupada por usuario
    const userIds = rows.map((r) => r.user_id);
    let posByUser: Record<string, number> = {};
    if (userIds.length > 0) {
      const pRows = await query<any>(
        `SELECT si.user_id, SUM(sp.amount_ves) as pos_batch_ves
         FROM sales_invoices si
         INNER JOIN sales_payments sp ON si.id = sp.invoice_id
         WHERE si.user_id IN (${userIds.map(() => '?').join(',')})
           AND sp.method IN ('DEBIT_CARD', 'CREDIT_CARD')
           AND si.status <> 'ANNULLED'
         GROUP BY si.user_id`,
        userIds
      );
      for (const pr of pRows) {
        posByUser[pr.user_id] = Number(pr.pos_batch_ves || 0);
      }
    }

    return rows.map((r) => {
      const posVES = Number(posByUser[r.user_id] || 0);
      return {
        userId: r.user_id,
        user_id: r.user_id,
        cashierId: r.user_id,
        cashier_id: r.user_id,
        cashierName: r.cashier_name,
        cashier_name: r.cashier_name,
        email: r.email,
        branchName: r.branch_name,
        branch_name: r.branch_name,
        totalShifts: Number(r.total_shifts || 0),
        total_shifts: Number(r.total_shifts || 0),
        invoicesCount: Number(r.invoices_count || 0),
        invoices_count: Number(r.invoices_count || 0),
        totalInvoices: Number(r.invoices_count || 0),
        total_invoices: Number(r.invoices_count || 0),
        totalSalesUSD: Number(r.total_sales_usd || 0),
        total_sales_usd: Number(r.total_sales_usd || 0),
        totalSalesVES: Number(r.total_sales_ves || 0),
        total_sales_ves: Number(r.total_sales_ves || 0),
        averageTicketUSD: Number(r.average_ticket_usd || 0),
        average_ticket_usd: Number(r.average_ticket_usd || 0),
        posBatchVES: posVES,
        pos_batch_ves: posVES,
      };
    });
  }

  /**
   * Reporte de Propinas de Restaurante por Mesero / Usuario
   */
  static async getRestaurantTipsReport(
    companyId: string,
    filters?: {
      branchId?: string;
      waiterId?: string;
      waiterName?: string;
      startDate?: string;
      endDate?: string;
      onlyWithTips?: boolean;
    }
  ) {
    return await RestaurantService.getRestaurantTipsReport(companyId, filters);
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
   * Obtiene la información fiscal y de branding de la empresa para reportes PDF
   */
  static async getCompanyPdfInfo(companyId: string) {
    try {
      const rows = await query<any>(
        `SELECT rif, legal_name, trade_name, fiscal_address, phone, email, is_special_taxpayer,
                report_currency, show_logo_in_reports, report_logo_type, custom_logo_url
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
          reportCurrency: (rows[0].report_currency === 'VES' || rows[0].report_currency === 'USD' ? rows[0].report_currency : 'BOTH') as 'VES' | 'USD' | 'BOTH',
          showLogoInReports: rows[0].show_logo_in_reports !== undefined ? Boolean(rows[0].show_logo_in_reports) : true,
          reportLogoType: (rows[0].report_logo_type === 'custom' ? 'custom' : 'default') as 'default' | 'custom',
          customLogoUrl: rows[0].custom_logo_url || null,
        };
      }
    } catch {
      // Fallback si campos de logo aún no existen en DB
      try {
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
            showLogoInReports: true,
            reportLogoType: 'default' as const,
            customLogoUrl: null,
          };
        }
      } catch {}
    }

    return {
      rif: 'J-123456-7',
      legalName: 'DISTRIBUIDORA ERO VE C.A.',
      tradeName: 'DISTRIBUIDORA ERO VE',
      fiscalAddress: 'Av. Francisco de Miranda, Torre Empresarial, Piso 8, Caracas, Venezuela',
      phone: '+58 212 999 8877',
      email: 'administracion@erove.com.ve',
      isSpecialTaxpayer: true,
      showLogoInReports: true,
      reportLogoType: 'default' as const,
      customLogoUrl: null,
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
   * 10. REPORTE DE POSICIÓN GLOBAL DE SALDOS Y LIQUIDEZ BANCARIA
   */
  static async getTreasuryBalancesReport(
    companyId: string,
    filters: { branchId?: string; currency?: 'VES' | 'USD' | 'BOTH' } = {}
  ) {
    const { ConfigService } = await import('../config/config.service');
    const rateInfo = await ConfigService.getExchangeRate(companyId);
    const bcvRate = rateInfo.rate || 1;

    let sql = `
      SELECT ba.id, ba.company_id, ba.bank_id, ba.branch_id,
             b.code as bank_code, b.name as bank_name,
             br.name as branch_name,
             ba.account_number, ba.account_type, ba.currency,
             ba.description, ba.current_balance, ba.is_active,
             COUNT(CASE WHEN bm.is_reconciled = 0 THEN 1 END) as pending_reconciliations_count,
             COALESCE(SUM(CASE WHEN bm.is_reconciled = 0 AND bm.amount > 0 THEN bm.amount ELSE 0 END), 0) as uncleared_deposits,
             COALESCE(SUM(CASE WHEN bm.is_reconciled = 0 AND bm.amount < 0 THEN ABS(bm.amount) ELSE 0 END), 0) as uncleared_withdrawals,
             (
               SELECT JSON_OBJECT(
                 'id', brc.id,
                 'periodStart', brc.period_start,
                 'periodEnd', brc.period_end,
                 'statementBalance', brc.bank_statement_balance,
                 'difference', brc.difference,
                 'status', brc.status,
                 'createdAt', brc.created_at
               )
               FROM bank_reconciliations brc
               WHERE brc.account_id = ba.id
               ORDER BY brc.period_end DESC, brc.created_at DESC
               LIMIT 1
             ) as last_reconciliation_json
      FROM bank_accounts ba
      INNER JOIN banks b ON ba.bank_id = b.id
      LEFT JOIN branches br ON ba.branch_id = br.id
      LEFT JOIN bank_movements bm ON ba.id = bm.account_id
      WHERE ba.company_id = ? AND ba.is_active = 1
    `;
    const params: any[] = [companyId];

    if (filters.branchId && filters.branchId !== 'all') {
      sql += ` AND (ba.branch_id = ? OR ba.branch_id IS NULL)`;
      params.push(filters.branchId);
    }

    if (filters.currency && (filters.currency === 'VES' || filters.currency === 'USD')) {
      sql += ` AND ba.currency = ?`;
      params.push(filters.currency);
    }

    sql += ` GROUP BY ba.id ORDER BY ba.currency DESC, b.name ASC`;

    const rows = await query<any>(sql, params);

    const accounts = rows.map((r) => {
      const currentBalance = Number(r.current_balance || 0);
      const unclearedDeposits = Number(r.uncleared_deposits || 0);
      const unclearedWithdrawals = Number(r.uncleared_withdrawals || 0);
      const transitBalance = Number((unclearedDeposits - unclearedWithdrawals).toFixed(2));
      const realBalance = Number((currentBalance + unclearedWithdrawals - unclearedDeposits).toFixed(2));

      let lastReconciliation = null;
      if (r.last_reconciliation_json) {
        try {
          lastReconciliation = typeof r.last_reconciliation_json === 'string'
            ? JSON.parse(r.last_reconciliation_json)
            : r.last_reconciliation_json;
        } catch {
          lastReconciliation = null;
        }
      }

      const equivalentUSD = r.currency === 'USD'
        ? currentBalance
        : Number((currentBalance / bcvRate).toFixed(2));
      const equivalentVES = r.currency === 'VES'
        ? currentBalance
        : Number((currentBalance * bcvRate).toFixed(2));

      return {
        id: r.id,
        bankCode: r.bank_code,
        bankName: r.bank_name,
        branchName: r.branch_name || 'Principal',
        accountNumber: r.account_number,
        accountType: r.account_type,
        currency: r.currency,
        description: r.description,
        currentBalance,
        unclearedDeposits,
        unclearedWithdrawals,
        transitBalance,
        realBalance,
        equivalentUSD,
        equivalentVES,
        pendingReconciliationsCount: Number(r.pending_reconciliations_count || 0),
        lastReconciliation,
      };
    });

    const totalVesBook = accounts
      .filter((a) => a.currency === 'VES')
      .reduce((sum, a) => sum + a.currentBalance, 0);
    const totalVesReal = accounts
      .filter((a) => a.currency === 'VES')
      .reduce((sum, a) => sum + a.realBalance, 0);
    const totalVesTransit = accounts
      .filter((a) => a.currency === 'VES')
      .reduce((sum, a) => sum + a.transitBalance, 0);

    const totalUsdBook = accounts
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + a.currentBalance, 0);
    const totalUsdReal = accounts
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + a.realBalance, 0);
    const totalUsdTransit = accounts
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + a.transitBalance, 0);

    const grandTotalUSD = Number((totalUsdBook + totalVesBook / bcvRate).toFixed(2));
    const grandTotalVES = Number((totalVesBook + totalUsdBook * bcvRate).toFixed(2));

    return {
      accounts,
      summary: {
        totalVesBook: Number(totalVesBook.toFixed(2)),
        totalVesReal: Number(totalVesReal.toFixed(2)),
        totalVesTransit: Number(totalVesTransit.toFixed(2)),
        totalUsdBook: Number(totalUsdBook.toFixed(2)),
        totalUsdReal: Number(totalUsdReal.toFixed(2)),
        totalUsdTransit: Number(totalUsdTransit.toFixed(2)),
        grandTotalUSD,
        grandTotalVES,
        activeAccountsCount: accounts.length,
        bcvRate,
      },
      bcvRate,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 11. REPORTE DE MOVIMIENTOS Y CARTOLA DE CUENTA BANCARIA
   */
  static async getBankMovementsReport(
    companyId: string,
    filters: {
      accountId?: string;
      startDate?: string;
      endDate?: string;
      movementType?: string;
      isReconciled?: boolean;
      direction?: 'INFLOW' | 'OUTFLOW';
      search?: string;
    } = {}
  ) {
    let accountId = filters.accountId;
    if (!accountId) {
      const defaultAcc = await query<any>(
        `SELECT id FROM bank_accounts WHERE company_id = ? AND is_active = 1 ORDER BY currency DESC, created_at ASC LIMIT 1`,
        [companyId]
      );
      if (!defaultAcc || defaultAcc.length === 0) {
        throw new Error('No se encontraron cuentas bancarias activas registradas para la empresa.');
      }
      accountId = defaultAcc[0].id;
    }

    const accRows = await query<any>(
      `SELECT ba.id, ba.account_number, ba.account_type, ba.currency, ba.description, ba.current_balance,
              b.code as bank_code, b.name as bank_name, br.name as branch_name
       FROM bank_accounts ba
       INNER JOIN banks b ON ba.bank_id = b.id
       LEFT JOIN branches br ON ba.branch_id = br.id
       WHERE ba.id = ? AND ba.company_id = ? LIMIT 1`,
      [accountId, companyId]
    );

    if (!accRows || accRows.length === 0) {
      throw new Error('La cuenta bancaria especificada no existe o no pertenece a la empresa.');
    }

    const account = {
      id: accRows[0].id,
      bankCode: accRows[0].bank_code,
      bankName: accRows[0].bank_name,
      branchName: accRows[0].branch_name || 'Principal',
      accountNumber: accRows[0].account_number,
      accountType: accRows[0].account_type,
      currency: accRows[0].currency,
      description: accRows[0].description,
      currentBalance: Number(accRows[0].current_balance || 0),
    };

    let openingBalance = 0;
    if (filters.startDate) {
      const priorRows = await query<any>(
        `SELECT balance_after
         FROM bank_movements
         WHERE account_id = ? AND movement_date < ?
         ORDER BY movement_date DESC, created_at DESC, id DESC
         LIMIT 1`,
        [accountId, filters.startDate]
      );

      if (priorRows.length > 0) {
        openingBalance = Number(priorRows[0].balance_after || 0);
      } else {
        const firstMove = await query<any>(
          `SELECT amount, balance_after FROM bank_movements WHERE account_id = ? ORDER BY movement_date ASC, created_at ASC LIMIT 1`,
          [accountId]
        );
        if (firstMove.length > 0) {
          openingBalance = Number((Number(firstMove[0].balance_after) - Number(firstMove[0].amount)).toFixed(2));
        }
      }
    }

    let sql = `
      SELECT bm.id, bm.movement_type, bm.amount, bm.balance_after,
             bm.movement_date, bm.reference_number, bm.concept,
             bm.is_reconciled, bm.reconciliation_id,
             u.full_name as user_name
      FROM bank_movements bm
      LEFT JOIN users u ON bm.user_id = u.id
      WHERE bm.account_id = ?
    `;
    const params: any[] = [accountId];

    if (filters.startDate) {
      sql += ` AND bm.movement_date >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      const fullEnd = filters.endDate.length <= 10 ? `${filters.endDate} 23:59:59` : filters.endDate;
      sql += ` AND bm.movement_date <= ?`;
      params.push(fullEnd);
    }
    if (filters.isReconciled !== undefined) {
      sql += ` AND bm.is_reconciled = ?`;
      params.push(filters.isReconciled ? 1 : 0);
    }
    if (filters.movementType && filters.movementType !== 'ALL') {
      sql += ` AND bm.movement_type = ?`;
      params.push(filters.movementType);
    }
    if (filters.direction === 'INFLOW') {
      sql += ` AND bm.amount > 0`;
    } else if (filters.direction === 'OUTFLOW') {
      sql += ` AND bm.amount < 0`;
    }
    if (filters.search && filters.search.trim()) {
      sql += ` AND (bm.reference_number LIKE CONCAT('%', ?, '%') OR bm.concept LIKE CONCAT('%', ?, '%'))`;
      params.push(filters.search.trim());
    }

    sql += ` ORDER BY bm.movement_date ASC, bm.created_at ASC, bm.id ASC`;

    const movRows = await query<any>(sql, params);

    let runningBalance = openingBalance;
    const movements = movRows.map((r) => {
      const amount = Number(r.amount || 0);
      const debit = amount > 0 ? amount : 0;
      const credit = amount < 0 ? Math.abs(amount) : 0;
      runningBalance = Number((runningBalance + amount).toFixed(2));

      return {
        id: r.id,
        date: r.movement_date ? String(r.movement_date).slice(0, 19).replace('T', ' ') : '',
        reference: r.reference_number || '-',
        type: r.movement_type,
        concept: r.concept || 'Movimiento Bancario',
        debit,
        credit,
        amount,
        balanceAfter: Number(r.balance_after ?? runningBalance),
        isReconciled: Boolean(r.is_reconciled),
        reconciliationId: r.reconciliation_id,
        userName: r.user_name || 'Sistema',
      };
    });

    const totalDebits = movements.reduce((s, m) => s + m.debit, 0);
    const totalCredits = movements.reduce((s, m) => s + m.credit, 0);
    const netFlow = Number((totalDebits - totalCredits).toFixed(2));
    const closingBalance = Number((openingBalance + netFlow).toFixed(2));

    const reconciledCount = movements.filter((m) => m.isReconciled).length;
    const unreconciledCount = movements.length - reconciledCount;

    return {
      account,
      movements,
      summary: {
        openingBalance: Number(openingBalance.toFixed(2)),
        totalDebits: Number(totalDebits.toFixed(2)),
        totalCredits: Number(totalCredits.toFixed(2)),
        netFlow,
        closingBalance,
        movementsCount: movements.length,
        reconciledCount,
        unreconciledCount,
      },
      filters: {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 12. ACTA OFICIAL DE CONCILIACIÓN BANCARIA CERTIFICADA
   */
  static async getBankReconciliationReport(
    companyId: string,
    filters: { accountId: string; reconciliationId?: string; asOfDate?: string }
  ) {
    if (!filters.accountId) {
      throw new Error('Debe especificar el identificador de la cuenta bancaria para el acta de conciliación.');
    }

    const accRows = await query<any>(
      `SELECT ba.id, ba.account_number, ba.account_type, ba.currency, ba.description, ba.current_balance,
              b.code as bank_code, b.name as bank_name, br.name as branch_name
       FROM bank_accounts ba
       INNER JOIN banks b ON ba.bank_id = b.id
       LEFT JOIN branches br ON ba.branch_id = br.id
       WHERE ba.id = ? AND ba.company_id = ? LIMIT 1`,
      [filters.accountId, companyId]
    );

    if (!accRows || accRows.length === 0) {
      throw new Error('La cuenta bancaria especificada no existe.');
    }

    const account = {
      id: accRows[0].id,
      bankCode: accRows[0].bank_code,
      bankName: accRows[0].bank_name,
      branchName: accRows[0].branch_name || 'Principal',
      accountNumber: accRows[0].account_number,
      accountType: accRows[0].account_type,
      currency: accRows[0].currency,
      description: accRows[0].description,
      currentBalance: Number(accRows[0].current_balance || 0),
    };

    let rec: any = null;
    if (filters.reconciliationId) {
      const recRows = await query<any>(
        `SELECT brc.*, u.full_name as auditor_name
         FROM bank_reconciliations brc
         LEFT JOIN users u ON brc.user_id = u.id
         WHERE brc.id = ? AND brc.account_id = ? LIMIT 1`,
        [filters.reconciliationId, filters.accountId]
      );
      if (recRows.length > 0) {
        rec = recRows[0];
      }
    }

    if (!rec) {
      const latestRecRows = await query<any>(
        `SELECT brc.*, u.full_name as auditor_name
         FROM bank_reconciliations brc
         LEFT JOIN users u ON brc.user_id = u.id
         WHERE brc.account_id = ?
         ORDER BY brc.period_end DESC, brc.created_at DESC
         LIMIT 1`,
        [filters.accountId]
      );
      if (latestRecRows.length > 0) {
        rec = latestRecRows[0];
      }
    }

    const periodEnd = rec ? rec.period_end : (filters.asOfDate || new Date().toISOString().slice(0, 10));
    const periodStart = rec ? rec.period_start : `${periodEnd.slice(0, 7)}-01`;

    // Partidas en tránsito (depósitos y retiros no conciliados a la fecha de corte)
    const transitMovements = await query<any>(
      `SELECT bm.id, bm.movement_type, bm.amount, bm.movement_date, bm.reference_number, bm.concept
       FROM bank_movements bm
       WHERE bm.account_id = ? AND bm.is_reconciled = 0
         AND bm.movement_date <= ?
       ORDER BY bm.movement_date ASC`,
      [filters.accountId, `${periodEnd} 23:59:59`]
    );

    const unclearedDepositsList = transitMovements
      .filter((m) => Number(m.amount) > 0)
      .map((m) => ({
        id: m.id,
        date: String(m.movement_date).slice(0, 10),
        reference: m.reference_number || '-',
        type: m.movement_type,
        concept: m.concept,
        amount: Number(m.amount),
      }));

    const unclearedWithdrawalsList = transitMovements
      .filter((m) => Number(m.amount) < 0)
      .map((m) => ({
        id: m.id,
        date: String(m.movement_date).slice(0, 10),
        reference: m.reference_number || '-',
        type: m.movement_type,
        concept: m.concept,
        amount: Math.abs(Number(m.amount)),
      }));

    const totalUnclearedDeposits = unclearedDepositsList.reduce((s, d) => s + d.amount, 0);
    const totalUnclearedWithdrawals = unclearedWithdrawalsList.reduce((s, w) => s + w.amount, 0);

    const bankStatementBalance = rec
      ? Number(rec.bank_statement_balance)
      : Number((account.currentBalance + totalUnclearedWithdrawals - totalUnclearedDeposits).toFixed(2));

    const finalBookBalance = rec
      ? Number(rec.final_book_balance)
      : account.currentBalance;

    const initialBookBalance = rec
      ? Number(rec.initial_book_balance)
      : 0;

    // Saldo bancario ajustado = Saldo Estado Cuenta + Depósitos en tránsito - Cheques/Egresos en tránsito
    const adjustedBankBalance = Number(
      (bankStatementBalance + totalUnclearedDeposits - totalUnclearedWithdrawals).toFixed(2)
    );

    const difference = rec
      ? Number(rec.difference)
      : Number((adjustedBankBalance - finalBookBalance).toFixed(2));

    const status = rec ? rec.status : (Math.abs(difference) < 0.01 ? 'RECONCILED' : 'DISCREPANCY');

    return {
      account,
      reconciliation: {
        id: rec?.id || null,
        periodStart,
        periodEnd,
        statementBalance: bankStatementBalance,
        initialBookBalance,
        finalBookBalance,
        adjustedBankBalance,
        difference,
        status,
        notes: rec?.notes || null,
        auditorName: rec?.auditor_name || 'Auditor de Tesorería',
        createdAt: rec?.created_at || new Date().toISOString(),
      },
      unclearedDeposits: {
        items: unclearedDepositsList,
        total: Number(totalUnclearedDeposits.toFixed(2)),
      },
      unclearedWithdrawals: {
        items: unclearedWithdrawalsList,
        total: Number(totalUnclearedWithdrawals.toFixed(2)),
      },
      isBalanced: Math.abs(difference) < 0.01,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 13. REPORTE DE FLUJO DE CAJA OPERATIVO DE TESORERÍA
   */
  static async getCashFlowReport(
    companyId: string,
    filters: {
      branchId?: string;
      startDate?: string;
      endDate?: string;
      currency?: 'VES' | 'USD' | 'BOTH';
    } = {}
  ) {
    const { ConfigService } = await import('../config/config.service');
    const rateInfo = await ConfigService.getExchangeRate(companyId);
    const bcvRate = rateInfo.rate || 1;

    const startDate = filters.startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const endDate = filters.endDate || new Date().toISOString().slice(0, 10);
    const fullEnd = endDate.length <= 10 ? `${endDate} 23:59:59` : endDate;

    let sql = `
      SELECT bm.id, bm.movement_type, bm.amount, bm.movement_date, bm.concept,
             ba.currency, ba.account_number, b.name as bank_name
      FROM bank_movements bm
      INNER JOIN bank_accounts ba ON bm.account_id = ba.id
      INNER JOIN banks b ON ba.bank_id = b.id
      WHERE ba.company_id = ?
        AND bm.movement_date >= ? AND bm.movement_date <= ?
    `;
    const params: any[] = [companyId, startDate, fullEnd];

    if (filters.branchId && filters.branchId !== 'all') {
      sql += ` AND (ba.branch_id = ? OR ba.branch_id IS NULL)`;
      params.push(filters.branchId);
    }

    if (filters.currency && (filters.currency === 'VES' || filters.currency === 'USD')) {
      sql += ` AND ba.currency = ?`;
      params.push(filters.currency);
    }

    sql += ` ORDER BY bm.movement_date ASC`;

    const rows = await query<any>(sql, params);

    // Agrupación por Categoría Operativa
    const categoryMap: Record<string, { label: string; isOutflow: boolean; ves: number; usd: number }> = {
      POS_SETTLEMENT: { label: 'Recaudación Cajas / Lotes POS', isOutflow: false, ves: 0, usd: 0 },
      DEPOSIT: { label: 'Cobranzas de Facturas CxC y Depósitos', isOutflow: false, ves: 0, usd: 0 },
      TRANSFER_IN: { label: 'Transferencias Propias Recibidas', isOutflow: false, ves: 0, usd: 0 },
      OTHER_INFLOW: { label: 'Otros Ingresos Operativos', isOutflow: false, ves: 0, usd: 0 },
      WITHDRAWAL: { label: 'Pagos a Proveedores CxP y Retiros', isOutflow: true, ves: 0, usd: 0 },
      CHECK: { label: 'Cheques Comerciales Emitidos', isOutflow: true, ves: 0, usd: 0 },
      TRANSFER_OUT: { label: 'Transferencias Propias Enviadas', isOutflow: true, ves: 0, usd: 0 },
      FEE: { label: 'Comisiones Bancarias y de Puntos POS', isOutflow: true, ves: 0, usd: 0 },
      TAX_DEBIT: { label: 'Retenciones e Impuestos Bancarios (IGTF)', isOutflow: true, ves: 0, usd: 0 },
    };

    // Agrupación cronológica diaria
    const dailyMap: Record<string, { date: string; inflowsVES: number; outflowsVES: number; inflowsUSD: number; outflowsUSD: number }> = {};

    rows.forEach((r) => {
      const amount = Number(r.amount || 0);
      const isOutflow = amount < 0;
      const absAmount = Math.abs(amount);
      const currency = r.currency as 'VES' | 'USD';
      const mDate = String(r.movement_date).slice(0, 10);

      // Categoría
      const catKey = categoryMap[r.movement_type]
        ? r.movement_type
        : (isOutflow ? 'WITHDRAWAL' : 'OTHER_INFLOW');

      if (currency === 'VES') {
        categoryMap[catKey].ves += absAmount;
      } else {
        categoryMap[catKey].usd += absAmount;
      }

      // Diario
      if (!dailyMap[mDate]) {
        dailyMap[mDate] = { date: mDate, inflowsVES: 0, outflowsVES: 0, inflowsUSD: 0, outflowsUSD: 0 };
      }
      if (isOutflow) {
        if (currency === 'VES') dailyMap[mDate].outflowsVES += absAmount;
        else dailyMap[mDate].outflowsUSD += absAmount;
      } else {
        if (currency === 'VES') dailyMap[mDate].inflowsVES += absAmount;
        else dailyMap[mDate].inflowsUSD += absAmount;
      }
    });

    const categories = Object.entries(categoryMap).map(([key, cat]) => {
      const consolidatedUSD = Number((cat.usd + cat.ves / bcvRate).toFixed(2));
      const consolidatedVES = Number((cat.ves + cat.usd * bcvRate).toFixed(2));
      return {
        key,
        label: cat.label,
        isOutflow: cat.isOutflow,
        ves: Number(cat.ves.toFixed(2)),
        usd: Number(cat.usd.toFixed(2)),
        consolidatedUSD,
        consolidatedVES,
      };
    });

    const dailyBreakdown = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const netVES = Number((d.inflowsVES - d.outflowsVES).toFixed(2));
        const netUSD = Number((d.inflowsUSD - d.outflowsUSD).toFixed(2));
        const netConsolidatedUSD = Number((netUSD + netVES / bcvRate).toFixed(2));
        return {
          ...d,
          netVES,
          netUSD,
          netConsolidatedUSD,
        };
      });

    const totalInflowsVES = categories.filter((c) => !c.isOutflow).reduce((s, c) => s + c.ves, 0);
    const totalOutflowsVES = categories.filter((c) => c.isOutflow).reduce((s, c) => s + c.ves, 0);
    const netVES = Number((totalInflowsVES - totalOutflowsVES).toFixed(2));

    const totalInflowsUSD = categories.filter((c) => !c.isOutflow).reduce((s, c) => s + c.usd, 0);
    const totalOutflowsUSD = categories.filter((c) => c.isOutflow).reduce((s, c) => s + c.usd, 0);
    const netUSD = Number((totalInflowsUSD - totalOutflowsUSD).toFixed(2));

    const grandTotalInflowsUSD = Number((totalInflowsUSD + totalInflowsVES / bcvRate).toFixed(2));
    const grandTotalOutflowsUSD = Number((totalOutflowsUSD + totalOutflowsVES / bcvRate).toFixed(2));
    const grandNetFlowUSD = Number((grandTotalInflowsUSD - grandTotalOutflowsUSD).toFixed(2));

    return {
      categories,
      dailyBreakdown,
      summary: {
        totalInflowsVES: Number(totalInflowsVES.toFixed(2)),
        totalOutflowsVES: Number(totalOutflowsVES.toFixed(2)),
        netVES,
        totalInflowsUSD: Number(totalInflowsUSD.toFixed(2)),
        totalOutflowsUSD: Number(totalOutflowsUSD.toFixed(2)),
        netUSD,
        grandTotalInflowsUSD,
        grandTotalOutflowsUSD,
        grandNetFlowUSD,
        bcvRate,
      },
      startDate,
      endDate,
      bcvRate,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Reporte Fiscal de IGTF Percibido (3%) sobre pagos en divisas / criptoactivos (SENIAT)
   */
  static async getIGTFReport(companyId: string, filters: IGTFReportFilters = {}) {
    const whereConditions: string[] = ['b.company_id = ?', "si.status <> 'ANNULLED'"];
    const params: any[] = [companyId];

    if (filters.startDate) {
      whereConditions.push('DATE(si.invoice_date) >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereConditions.push('DATE(si.invoice_date) <= ?');
      params.push(filters.endDate);
    }
    if (filters.branchId && filters.branchId !== 'all') {
      whereConditions.push('si.branch_id = ?');
      params.push(filters.branchId);
    }
    if (filters.cashRegisterId && filters.cashRegisterId !== 'all') {
      whereConditions.push('cr.id = ?');
      params.push(filters.cashRegisterId);
    }
    if (filters.shiftId && filters.shiftId !== 'all') {
      whereConditions.push('si.shift_id = ?');
      params.push(filters.shiftId);
    }
    if (filters.origin === 'POS') {
      whereConditions.push('si.shift_id IS NOT NULL');
    } else if (filters.origin === 'ADMIN') {
      whereConditions.push('si.shift_id IS NULL');
    }
    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      whereConditions.push('sp.method = ?');
      params.push(filters.paymentMethod);
    }

    // Regla de aplicación IGTF: aplica si está marcado o si el método es divisas o si la factura tiene igtf registrado
    whereConditions.push(
      "(sp.applies_igtf = 1 OR sp.igtf_amount_usd > 0 OR sp.igtf_amount_ves > 0 OR si.igtf_amount > 0 OR sp.method IN ('CASH_USD', 'ZELLE', 'CRYPTO', 'TRANSFER_USD'))"
    );

    const whereClause = whereConditions.join(' AND ');

    const rows = await query<any>(
      `SELECT 
        sp.id as payment_id,
        sp.invoice_id,
        sp.method,
        sp.amount_usd,
        sp.amount_ves,
        sp.exchange_rate,
        sp.applies_igtf,
        sp.igtf_amount_usd,
        sp.igtf_amount_ves,
        sp.reference_number,
        sp.created_at as payment_date,
        si.invoice_number,
        si.control_number,
        si.invoice_date,
        si.created_at as invoice_created_at,
        si.branch_id,
        b.name as branch_name,
        si.user_id,
        u.full_name as cashier_name,
        si.customer_id,
        COALESCE(c.name, 'CLIENTE CONTADO') as customer_name,
        COALESCE(CONCAT(c.doc_type, '-', c.doc_number), 'V-00000000') as customer_doc,
        si.shift_id,
        cr.id as cash_register_id,
        cr.code as cash_register_code,
        cr.name as cash_register_name,
        si.currency as invoice_currency,
        si.exchange_rate as invoice_exchange_rate,
        si.igtf_amount as invoice_igtf_amount,
        si.total_amount as invoice_total_amount
      FROM sales_payments sp
      INNER JOIN sales_invoices si ON sp.invoice_id = si.id
      INNER JOIN branches b ON si.branch_id = b.id
      INNER JOIN users u ON si.user_id = u.id
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN cash_shifts cs ON si.shift_id = cs.id
      LEFT JOIN cash_registers cr ON cs.cash_register_id = cr.id
      WHERE ${whereClause}
      ORDER BY si.invoice_date DESC, sp.created_at DESC`,
      params
    );

    // Mapeo dinámico de nombres de medios de pago
    const pmRows = await query<any>(
      `SELECT code, name FROM payment_methods WHERE company_id = ?`,
      [companyId]
    );
    const methodNames: Record<string, string> = {
      CASH_USD: 'Efectivo Divisas ($)',
      CASH_VES: 'Efectivo Bolívares (Bs)',
      PAGO_MOVIL: 'Pago Móvil C2P / P2P',
      DEBIT_CARD: 'Punto de Venta Débito',
      CREDIT_CARD: 'Punto de Venta Crédito',
      POS_TERMINAL: 'Punto de Venta',
      ZELLE: 'Zelle USD',
      TRANSFER: 'Transferencia Bancaria Bs',
      TRANSFER_VES: 'Transferencia Bancaria Bs',
      TRANSFER_USD: 'Transferencia Divisas',
      BIOPAGO: 'Biopago BDV',
      CRYPTO: 'Criptoactivos / USDT',
      NOTA_CREDITO: 'Nota de Crédito a Favor',
    };
    for (const pm of pmRows) {
      if (pm.code && pm.name) methodNames[pm.code] = pm.name;
    }

    const records = rows.map((r) => {
      const rate = Number(r.exchange_rate) || Number(r.invoice_exchange_rate) || 1.0;
      let baseUSD = Number(r.amount_usd || 0);
      let baseVES = Number(r.amount_ves || 0);
      if (baseUSD <= 0 && baseVES > 0 && rate > 0) {
        baseUSD = Number((baseVES / rate).toFixed(2));
      } else if (baseVES <= 0 && baseUSD > 0 && rate > 0) {
        baseVES = Number((baseUSD * rate).toFixed(2));
      }

      let igtfUSD = Number(r.igtf_amount_usd || 0);
      let igtfVES = Number(r.igtf_amount_ves || 0);
      if (igtfUSD <= 0 && baseUSD > 0) {
        igtfUSD = Number((baseUSD * 0.03).toFixed(2));
      }
      if (igtfVES <= 0 && igtfUSD > 0 && rate > 0) {
        igtfVES = Number((igtfUSD * rate).toFixed(2));
      }

      const emissionDate = r.invoice_date
        ? String(r.invoice_date).slice(0, 10)
        : String(r.invoice_created_at || '').slice(0, 10);

      const isPOS = Boolean(r.shift_id);

      return {
        id: r.payment_id,
        invoiceId: r.invoice_id,
        invoiceNumber: r.invoice_number,
        controlNumber: r.control_number || '',
        emissionDate,
        branchId: r.branch_id,
        branchName: r.branch_name,
        cashierName: r.cashier_name,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerDoc: r.customer_doc,
        cashRegisterId: r.cash_register_id,
        cashRegisterCode: r.cash_register_code || '',
        cashRegisterName: r.cash_register_name || '',
        method: r.method,
        methodName: methodNames[r.method] || r.method,
        referenceNumber: r.reference_number || '',
        exchangeRate: rate,
        baseUSD,
        baseVES,
        igtfRatePercent: 3.0,
        igtfUSD,
        igtfVES,
        origin: isPOS ? ('POS' as const) : ('ADMIN' as const),
        originLabel: isPOS ? 'Punto de Venta (POS)' : 'Venta Administrativa',
      };
    });

    // Filtro de búsqueda en memoria si aplica
    let filteredRecords = records;
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filteredRecords = records.filter(
        (rec) =>
          rec.invoiceNumber.toLowerCase().includes(q) ||
          rec.controlNumber.toLowerCase().includes(q) ||
          rec.customerName.toLowerCase().includes(q) ||
          rec.customerDoc.toLowerCase().includes(q) ||
          rec.referenceNumber.toLowerCase().includes(q)
      );
    }

    // Totales y KPIs
    const totalTaxableUSD = Number(filteredRecords.reduce((acc, r) => acc + r.baseUSD, 0).toFixed(2));
    const totalTaxableVES = Number(filteredRecords.reduce((acc, r) => acc + r.baseVES, 0).toFixed(2));
    const totalIgtfUSD = Number(filteredRecords.reduce((acc, r) => acc + r.igtfUSD, 0).toFixed(2));
    const totalIgtfVES = Number(filteredRecords.reduce((acc, r) => acc + r.igtfVES, 0).toFixed(2));
    const transactionsCount = filteredRecords.length;
    const uniqueInvoices = new Set(filteredRecords.map((r) => r.invoiceId));
    const invoicesCount = uniqueInvoices.size;
    const weightedRate = totalTaxableUSD > 0 ? Number((totalTaxableVES / totalTaxableUSD).toFixed(4)) : 0;

    // Resumen Quincenal SENIAT
    const quincenaMap: Record<string, {
      key: string;
      periodLabel: string;
      count: number;
      taxableUSD: number;
      taxableVES: number;
      igtfUSD: number;
      igtfVES: number;
    }> = {};

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    for (const r of filteredRecords) {
      const d = new Date(r.emissionDate + 'T12:00:00Z');
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();
      const isFirstFortnight = day <= 15;
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${isFirstFortnight ? 'Q1' : 'Q2'}`;
      const periodLabel = isFirstFortnight
        ? `1ra Quincena ${monthNames[month]} ${year} (01 al 15)`
        : `2da Quincena ${monthNames[month]} ${year} (16 al fin de mes)`;

      if (!quincenaMap[key]) {
        quincenaMap[key] = {
          key,
          periodLabel,
          count: 0,
          taxableUSD: 0,
          taxableVES: 0,
          igtfUSD: 0,
          igtfVES: 0,
        };
      }
      quincenaMap[key].count += 1;
      quincenaMap[key].taxableUSD = Number((quincenaMap[key].taxableUSD + r.baseUSD).toFixed(2));
      quincenaMap[key].taxableVES = Number((quincenaMap[key].taxableVES + r.baseVES).toFixed(2));
      quincenaMap[key].igtfUSD = Number((quincenaMap[key].igtfUSD + r.igtfUSD).toFixed(2));
      quincenaMap[key].igtfVES = Number((quincenaMap[key].igtfVES + r.igtfVES).toFixed(2));
    }

    const quincenaSummary = Object.values(quincenaMap).sort((a, b) => b.key.localeCompare(a.key));

    // Desglose por Medio de Pago
    const methodMap: Record<string, {
      method: string;
      methodName: string;
      count: number;
      taxableUSD: number;
      taxableVES: number;
      igtfUSD: number;
      igtfVES: number;
    }> = {};

    for (const r of filteredRecords) {
      if (!methodMap[r.method]) {
        methodMap[r.method] = {
          method: r.method,
          methodName: r.methodName,
          count: 0,
          taxableUSD: 0,
          taxableVES: 0,
          igtfUSD: 0,
          igtfVES: 0,
        };
      }
      methodMap[r.method].count += 1;
      methodMap[r.method].taxableUSD = Number((methodMap[r.method].taxableUSD + r.baseUSD).toFixed(2));
      methodMap[r.method].taxableVES = Number((methodMap[r.method].taxableVES + r.baseVES).toFixed(2));
      methodMap[r.method].igtfUSD = Number((methodMap[r.method].igtfUSD + r.igtfUSD).toFixed(2));
      methodMap[r.method].igtfVES = Number((methodMap[r.method].igtfVES + r.igtfVES).toFixed(2));
    }

    const byPaymentMethod = Object.values(methodMap).sort((a, b) => b.taxableUSD - a.taxableUSD);

    // Desglose por Sucursal
    const branchMap: Record<string, {
      branchId: string;
      branchName: string;
      count: number;
      taxableUSD: number;
      igtfUSD: number;
      igtfVES: number;
    }> = {};

    for (const r of filteredRecords) {
      if (!branchMap[r.branchId]) {
        branchMap[r.branchId] = {
          branchId: r.branchId,
          branchName: r.branchName,
          count: 0,
          taxableUSD: 0,
          igtfUSD: 0,
          igtfVES: 0,
        };
      }
      branchMap[r.branchId].count += 1;
      branchMap[r.branchId].taxableUSD = Number((branchMap[r.branchId].taxableUSD + r.baseUSD).toFixed(2));
      branchMap[r.branchId].igtfUSD = Number((branchMap[r.branchId].igtfUSD + r.igtfUSD).toFixed(2));
      branchMap[r.branchId].igtfVES = Number((branchMap[r.branchId].igtfVES + r.igtfVES).toFixed(2));
    }

    const byBranch = Object.values(branchMap).sort((a, b) => b.taxableUSD - a.taxableUSD);

    return {
      summary: {
        totalTaxableUSD,
        totalTaxableVES,
        totalIgtfUSD,
        totalIgtfVES,
        transactionsCount,
        invoicesCount,
        weightedRate,
      },
      quincenaSummary,
      byPaymentMethod,
      byBranch,
      records: filteredRecords,
      filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Reporte Discriminado de Movimientos por Medios de Pago (Ingresos, Egresos, Cobranzas, Arqueos)
   */
  static async getPaymentMethodsReport(companyId: string, filters: PaymentMethodsReportFilters = {}) {
    // 1. Cargar nombres amigables de medios de pago
    const pmRows = await query<any>(
      `SELECT code, name, currency, type FROM payment_methods WHERE company_id = ?`,
      [companyId]
    );
    const methodNames: Record<string, string> = {
      CASH_USD: 'Efectivo Divisas ($)',
      CASH_VES: 'Efectivo Bolívares (Bs)',
      PAGO_MOVIL: 'Pago Móvil C2P / P2P',
      DEBIT_CARD: 'Punto de Venta Débito',
      CREDIT_CARD: 'Punto de Venta Crédito',
      POS_TERMINAL: 'Punto de Venta',
      ZELLE: 'Zelle USD',
      TRANSFER: 'Transferencia Bancaria Bs',
      TRANSFER_VES: 'Transferencia Bancaria Bs',
      TRANSFER_USD: 'Transferencia Divisas',
      BIOPAGO: 'Biopago BDV',
      CRYPTO: 'Criptoactivos / USDT',
      NOTA_CREDITO: 'Nota de Crédito a Favor',
      CHECK: 'Cheque Bancario',
      CREDIT: 'Crédito Comercial',
    };
    for (const pm of pmRows) {
      if (pm.code && pm.name) methodNames[pm.code] = pm.name;
    }

    const allItems: any[] = [];

    // --- A. Pagos de Ventas (POS, Ventas Mayoristas y Cobranzas) ---
    const shouldIncludeSales = !filters.flowType || filters.flowType === 'ALL' || filters.flowType === 'IN';
    const shouldIncludeSalesOrigin =
      !filters.origin ||
      filters.origin === 'ALL' ||
      filters.origin === 'POS' ||
      filters.origin === 'ADMIN_SALES' ||
      filters.origin === 'COLLECTIONS';

    if (shouldIncludeSales && shouldIncludeSalesOrigin) {
      const salesConditions: string[] = ['b.company_id = ?', "si.status <> 'ANNULLED'"];
      const salesParams: any[] = [companyId];

      if (filters.startDate) {
        salesConditions.push('DATE(sp.created_at) >= ?');
        salesParams.push(filters.startDate);
      }
      if (filters.endDate) {
        salesConditions.push('DATE(sp.created_at) <= ?');
        salesParams.push(filters.endDate);
      }
      if (filters.branchId && filters.branchId !== 'all') {
        salesConditions.push('si.branch_id = ?');
        salesParams.push(filters.branchId);
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        salesConditions.push('sp.method = ?');
        salesParams.push(filters.paymentMethod);
      }
      if (filters.bankAccountId && filters.bankAccountId !== 'all') {
        salesConditions.push('sp.bank_account_id = ?');
        salesParams.push(filters.bankAccountId);
      }
      if (filters.cashRegisterId && filters.cashRegisterId !== 'all') {
        salesConditions.push('cr.id = ?');
        salesParams.push(filters.cashRegisterId);
      }
      if (filters.shiftId && filters.shiftId !== 'all') {
        salesConditions.push('si.shift_id = ?');
        salesParams.push(filters.shiftId);
      }
      if (filters.userId && filters.userId !== 'all') {
        salesConditions.push('si.user_id = ?');
        salesParams.push(filters.userId);
      }

      const salesRows = await query<any>(
        `SELECT 
          sp.id,
          sp.invoice_id,
          sp.method,
          sp.amount_usd,
          sp.amount_ves,
          sp.exchange_rate,
          sp.applies_igtf,
          sp.igtf_amount_usd,
          sp.igtf_amount_ves,
          sp.reference_number,
          sp.bank_account_id,
          sp.created_at,
          si.invoice_number,
          si.control_number,
          si.invoice_date,
          si.is_credit,
          si.branch_id,
          b.name as branch_name,
          si.user_id,
          u.full_name as user_name,
          si.customer_id,
          COALESCE(c.name, 'CLIENTE CONTADO') as third_party_name,
          COALESCE(CONCAT(c.doc_type, '-', c.doc_number), 'V-00000000') as third_party_doc,
          si.shift_id,
          cr.id as cash_register_id,
          cr.name as cash_register_name,
          cr.code as cash_register_code,
          ba.account_number as bank_account_number,
          bk.name as bank_name
        FROM sales_payments sp
        INNER JOIN sales_invoices si ON sp.invoice_id = si.id
        INNER JOIN branches b ON si.branch_id = b.id
        INNER JOIN users u ON si.user_id = u.id
        LEFT JOIN customers c ON si.customer_id = c.id
        LEFT JOIN cash_shifts cs ON si.shift_id = cs.id
        LEFT JOIN cash_registers cr ON cs.cash_register_id = cr.id
        LEFT JOIN bank_accounts ba ON sp.bank_account_id = ba.id
        LEFT JOIN banks bk ON ba.bank_id = bk.id
        WHERE ${salesConditions.join(' AND ')}
        ORDER BY sp.created_at DESC`,
        salesParams
      );

      for (const r of salesRows) {
        const isPOS = Boolean(r.shift_id);
        const isCreditSale = Boolean(r.is_credit);
        let origin: 'POS' | 'ADMIN_SALES' | 'COLLECTIONS' = isPOS ? 'POS' : 'ADMIN_SALES';
        let originLabel = isPOS ? 'Venta POS Mostrador' : 'Venta Mayorista';
        if (isCreditSale && !isPOS) {
          origin = 'COLLECTIONS';
          originLabel = 'Cobranza Factura a Crédito';
        }

        if (filters.origin && filters.origin !== 'ALL' && filters.origin !== origin) {
          continue;
        }

        const rate = Number(r.exchange_rate) || 1.0;
        let amountUSD = Number(r.amount_usd || 0);
        let amountVES = Number(r.amount_ves || 0);
        if (amountUSD <= 0 && amountVES > 0 && rate > 0) {
          amountUSD = Number((amountVES / rate).toFixed(2));
        } else if (amountVES <= 0 && amountUSD > 0 && rate > 0) {
          amountVES = Number((amountUSD * rate).toFixed(2));
        }

        allItems.push({
          id: r.id,
          date: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          flowType: 'IN' as const,
          origin,
          originLabel,
          documentNumber: r.invoice_number,
          controlNumber: r.control_number || '',
          thirdPartyName: r.third_party_name,
          thirdPartyDoc: r.third_party_doc,
          method: r.method,
          methodName: methodNames[r.method] || r.method,
          referenceNumber: r.reference_number || '',
          bankAccountId: r.bank_account_id,
          bankName: r.bank_name ? `${r.bank_name} (${r.bank_account_number || ''})` : null,
          branchId: r.branch_id,
          branchName: r.branch_name,
          cashRegisterName: r.cash_register_name || r.cash_register_code || null,
          userName: r.user_name,
          amountUSD,
          amountVES,
          exchangeRate: rate,
          appliesIGTF: Boolean(r.applies_igtf),
          igtfUSD: Number(r.igtf_amount_usd || 0),
          notes: null,
        });
      }
    }

    // --- B. Pagos a Proveedores (Egresos) ---
    const shouldIncludePurchases = !filters.flowType || filters.flowType === 'ALL' || filters.flowType === 'OUT';
    const shouldIncludePurchasesOrigin = !filters.origin || filters.origin === 'ALL' || filters.origin === 'PURCHASE_PAYMENTS';

    if (shouldIncludePurchases && shouldIncludePurchasesOrigin) {
      const purConditions: string[] = ['b.company_id = ?', "pi.status <> 'ANNULLED'"];
      const purParams: any[] = [companyId];

      if (filters.startDate) {
        purConditions.push('DATE(pp.created_at) >= ?');
        purParams.push(filters.startDate);
      }
      if (filters.endDate) {
        purConditions.push('DATE(pp.created_at) <= ?');
        purParams.push(filters.endDate);
      }
      if (filters.branchId && filters.branchId !== 'all') {
        purConditions.push('pi.branch_id = ?');
        purParams.push(filters.branchId);
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        purConditions.push('pp.method = ?');
        purParams.push(filters.paymentMethod);
      }
      if (filters.userId && filters.userId !== 'all') {
        purConditions.push('pi.user_id = ?');
        purParams.push(filters.userId);
      }

      const purRows = await query<any>(
        `SELECT 
          pp.id,
          pp.invoice_id,
          pp.payable_id,
          pp.method,
          pp.amount_usd,
          pp.amount_ves,
          pp.exchange_rate,
          pp.reference_number,
          pp.notes,
          pp.created_at,
          pi.invoice_number,
          pi.control_number,
          pi.invoice_date,
          pi.branch_id,
          b.name as branch_name,
          pi.user_id,
          u.full_name as user_name,
          pi.supplier_id,
          COALESCE(s.name, 'PROVEEDOR') as third_party_name,
          COALESCE(s.rif, 'J-00000000-0') as third_party_doc
        FROM purchase_payments pp
        INNER JOIN purchase_invoices pi ON pp.invoice_id = pi.id
        INNER JOIN branches b ON pi.branch_id = b.id
        LEFT JOIN users u ON pi.user_id = u.id
        LEFT JOIN suppliers s ON pi.supplier_id = s.id
        WHERE ${purConditions.join(' AND ')}
        ORDER BY pp.created_at DESC`,
        purParams
      );

      for (const r of purRows) {
        const rate = Number(r.exchange_rate) || 1.0;
        let amountUSD = Number(r.amount_usd || 0);
        let amountVES = Number(r.amount_ves || 0);
        if (amountUSD <= 0 && amountVES > 0 && rate > 0) {
          amountUSD = Number((amountVES / rate).toFixed(2));
        } else if (amountVES <= 0 && amountUSD > 0 && rate > 0) {
          amountVES = Number((amountUSD * rate).toFixed(2));
        }

        allItems.push({
          id: r.id,
          date: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          flowType: 'OUT' as const,
          origin: 'PURCHASE_PAYMENTS' as const,
          originLabel: 'Pago a Proveedor (CxP)',
          documentNumber: r.invoice_number,
          controlNumber: r.control_number || '',
          thirdPartyName: r.third_party_name,
          thirdPartyDoc: r.third_party_doc,
          method: r.method,
          methodName: methodNames[r.method] || r.method,
          referenceNumber: r.reference_number || '',
          bankAccountId: null,
          bankName: null,
          branchId: r.branch_id,
          branchName: r.branch_name,
          cashRegisterName: null,
          userName: r.user_name || 'Administración',
          amountUSD,
          amountVES,
          exchangeRate: rate,
          appliesIGTF: false,
          igtfUSD: 0,
          notes: r.notes || null,
        });
      }
    }

    // --- C. Movimientos de Efectivo en Caja (Ingresos/Egresos directos) ---
    const shouldIncludeCashMovements = !filters.origin || filters.origin === 'ALL' || filters.origin === 'CASH_MOVEMENTS';
    if (shouldIncludeCashMovements) {
      const cmConditions: string[] = ['b.company_id = ?'];
      const cmParams: any[] = [companyId];

      if (filters.startDate) {
        cmConditions.push('DATE(cm.created_at) >= ?');
        cmParams.push(filters.startDate);
      }
      if (filters.endDate) {
        cmConditions.push('DATE(cm.created_at) <= ?');
        cmParams.push(filters.endDate);
      }
      if (filters.branchId && filters.branchId !== 'all') {
        cmConditions.push('cs.branch_id = ?');
        cmParams.push(filters.branchId);
      }
      if (filters.cashRegisterId && filters.cashRegisterId !== 'all') {
        cmConditions.push('cs.cash_register_id = ?');
        cmParams.push(filters.cashRegisterId);
      }
      if (filters.shiftId && filters.shiftId !== 'all') {
        cmConditions.push('cm.shift_id = ?');
        cmParams.push(filters.shiftId);
      }
      if (filters.userId && filters.userId !== 'all') {
        cmConditions.push('cm.user_id = ?');
        cmParams.push(filters.userId);
      }
      if (filters.flowType === 'IN') {
        cmConditions.push("cm.type = 'INFLOW'");
      } else if (filters.flowType === 'OUT') {
        cmConditions.push("cm.type = 'OUTFLOW'");
      }

      const cmRows = await query<any>(
        `SELECT 
          cm.id,
          cm.shift_id,
          cm.user_id,
          u.full_name as user_name,
          cm.type,
          cm.currency,
          cm.amount,
          cm.reason,
          cm.created_at,
          cs.branch_id,
          b.name as branch_name,
          cs.cash_register_id,
          cr.code as cash_register_code,
          cr.name as cash_register_name
        FROM cash_movements cm
        INNER JOIN cash_shifts cs ON cm.shift_id = cs.id
        INNER JOIN branches b ON cs.branch_id = b.id
        INNER JOIN users u ON cm.user_id = u.id
        INNER JOIN cash_registers cr ON cs.cash_register_id = cr.id
        WHERE ${cmConditions.join(' AND ')}
        ORDER BY cm.created_at DESC`,
        cmParams
      );

      // Tasa BCV actual como referencia para movimientos de caja
      const rateRows = await query<any>(
        `SELECT rate FROM exchange_rates WHERE company_id = ? ORDER BY effective_date DESC, created_at DESC LIMIT 1`,
        [companyId]
      );
      const defaultRate = Number(rateRows[0]?.rate || 1.0);

      for (const r of cmRows) {
        const isUSD = r.currency === 'USD';
        const method = isUSD ? 'CASH_USD' : 'CASH_VES';
        if (filters.paymentMethod && filters.paymentMethod !== 'all' && filters.paymentMethod !== method) {
          continue;
        }

        const rawAmount = Number(r.amount || 0);
        const amountUSD = isUSD ? rawAmount : Number((rawAmount / defaultRate).toFixed(2));
        const amountVES = isUSD ? Number((rawAmount * defaultRate).toFixed(2)) : rawAmount;
        const flowType = r.type === 'INFLOW' ? ('IN' as const) : ('OUT' as const);

        allItems.push({
          id: r.id,
          date: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          flowType,
          origin: 'CASH_MOVEMENTS' as const,
          originLabel: flowType === 'IN' ? 'Ingreso Manual a Caja' : 'Egreso Manual de Caja',
          documentNumber: `CAJA-${r.id.slice(0, 8).toUpperCase()}`,
          controlNumber: '',
          thirdPartyName: r.user_name,
          thirdPartyDoc: '',
          method,
          methodName: methodNames[method] || method,
          referenceNumber: '',
          bankAccountId: null,
          bankName: null,
          branchId: r.branch_id,
          branchName: r.branch_name,
          cashRegisterName: r.cash_register_name || r.cash_register_code,
          userName: r.user_name,
          amountUSD,
          amountVES,
          exchangeRate: defaultRate,
          appliesIGTF: false,
          igtfUSD: 0,
          notes: r.reason,
        });
      }
    }

    // Ordenar cronológicamente descendente
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtro de búsqueda en memoria si aplica
    let filteredMovements = allItems;
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filteredMovements = allItems.filter(
        (m) =>
          m.documentNumber.toLowerCase().includes(q) ||
          (m.controlNumber && m.controlNumber.toLowerCase().includes(q)) ||
          m.thirdPartyName.toLowerCase().includes(q) ||
          (m.thirdPartyDoc && m.thirdPartyDoc.toLowerCase().includes(q)) ||
          (m.referenceNumber && m.referenceNumber.toLowerCase().includes(q)) ||
          (m.notes && m.notes.toLowerCase().includes(q))
      );
    }

    // Totales y KPIs
    const inflows = filteredMovements.filter((m) => m.flowType === 'IN');
    const outflows = filteredMovements.filter((m) => m.flowType === 'OUT');

    const totalInflowUSD = Number(inflows.reduce((acc, m) => acc + m.amountUSD, 0).toFixed(2));
    const totalInflowVES = Number(inflows.reduce((acc, m) => acc + m.amountVES, 0).toFixed(2));
    const totalOutflowUSD = Number(outflows.reduce((acc, m) => acc + m.amountUSD, 0).toFixed(2));
    const totalOutflowVES = Number(outflows.reduce((acc, m) => acc + m.amountVES, 0).toFixed(2));
    const netUSD = Number((totalInflowUSD - totalOutflowUSD).toFixed(2));
    const netVES = Number((totalInflowVES - totalOutflowVES).toFixed(2));
    const operationsCount = filteredMovements.length;

    // Desglose por Medio de Pago
    const methodSummaryMap: Record<string, {
      method: string;
      methodName: string;
      count: number;
      inflowUSD: number;
      inflowVES: number;
      outflowUSD: number;
      outflowVES: number;
      netUSD: number;
      netVES: number;
      percentOfTotal: number;
    }> = {};

    const totalVolumeUSD = totalInflowUSD + totalOutflowUSD;

    for (const m of filteredMovements) {
      if (!methodSummaryMap[m.method]) {
        methodSummaryMap[m.method] = {
          method: m.method,
          methodName: m.methodName,
          count: 0,
          inflowUSD: 0,
          inflowVES: 0,
          outflowUSD: 0,
          outflowVES: 0,
          netUSD: 0,
          netVES: 0,
          percentOfTotal: 0,
        };
      }
      methodSummaryMap[m.method].count += 1;
      if (m.flowType === 'IN') {
        methodSummaryMap[m.method].inflowUSD = Number((methodSummaryMap[m.method].inflowUSD + m.amountUSD).toFixed(2));
        methodSummaryMap[m.method].inflowVES = Number((methodSummaryMap[m.method].inflowVES + m.amountVES).toFixed(2));
      } else {
        methodSummaryMap[m.method].outflowUSD = Number((methodSummaryMap[m.method].outflowUSD + m.amountUSD).toFixed(2));
        methodSummaryMap[m.method].outflowVES = Number((methodSummaryMap[m.method].outflowVES + m.amountVES).toFixed(2));
      }
      methodSummaryMap[m.method].netUSD = Number(
        (methodSummaryMap[m.method].inflowUSD - methodSummaryMap[m.method].outflowUSD).toFixed(2)
      );
      methodSummaryMap[m.method].netVES = Number(
        (methodSummaryMap[m.method].inflowVES - methodSummaryMap[m.method].outflowVES).toFixed(2)
      );
    }

    const byMethod = Object.values(methodSummaryMap).map((m) => {
      const vol = m.inflowUSD + m.outflowUSD;
      m.percentOfTotal = totalVolumeUSD > 0 ? Number(((vol / totalVolumeUSD) * 100).toFixed(1)) : 0;
      return m;
    }).sort((a, b) => (b.inflowUSD + b.outflowUSD) - (a.inflowUSD + a.outflowUSD));

    // Desglose por Origen
    const originMap: Record<string, {
      origin: string;
      originLabel: string;
      count: number;
      totalUSD: number;
      totalVES: number;
      percentOfTotal: number;
    }> = {};

    for (const m of filteredMovements) {
      if (!originMap[m.origin]) {
        originMap[m.origin] = {
          origin: m.origin,
          originLabel: m.originLabel,
          count: 0,
          totalUSD: 0,
          totalVES: 0,
          percentOfTotal: 0,
        };
      }
      originMap[m.origin].count += 1;
      originMap[m.origin].totalUSD = Number((originMap[m.origin].totalUSD + m.amountUSD).toFixed(2));
      originMap[m.origin].totalVES = Number((originMap[m.origin].totalVES + m.amountVES).toFixed(2));
    }

    const byOrigin = Object.values(originMap).map((o) => {
      o.percentOfTotal = totalVolumeUSD > 0 ? Number(((o.totalUSD / totalVolumeUSD) * 100).toFixed(1)) : 0;
      return o;
    }).sort((a, b) => b.totalUSD - a.totalUSD);

    return {
      summary: {
        totalInflowUSD,
        totalInflowVES,
        totalOutflowUSD,
        totalOutflowVES,
        netUSD,
        netVES,
        operationsCount,
        inflowsCount: inflows.length,
        outflowsCount: outflows.length,
      },
      byMethod,
      byOrigin,
      movements: filteredMovements,
      filters,
      generatedAt: new Date().toISOString(),
    };
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

