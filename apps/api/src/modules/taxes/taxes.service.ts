import { query, withTransaction } from '../../db';
import {
  EmitWithholdingIVAInput,
  EmitWithholdingISLRInput,
  calculateIVARetention,
  calculateISLRRetention,
  generateSENIATVoucherNumber,
} from '@ero/shared';
import crypto from 'crypto';

export class TaxesService {
  /**
   * Obtiene el listado de retenciones IVA e ISLR con KPIs consolidados
   */
  static async getWithholdings(
    companyId: string,
    filter?: { type?: 'ALL' | 'IVA' | 'ISLR'; period?: string; branchId?: string; supplierId?: string }
  ) {
    const period = filter?.period;
    const branchId = filter?.branchId;
    const supplierId = filter?.supplierId;

    let ivaWithholdings: any[] = [];
    let islrWithholdings: any[] = [];

    if (!filter?.type || filter.type === 'ALL' || filter.type === 'IVA') {
      let sql = `
        SELECT 
          twi.id, twi.company_id, twi.branch_id, br.name as branch_name,
          twi.supplier_id, s.rif as supplier_rif, s.name as supplier_name,
          twi.purchase_invoice_id, twi.voucher_number, twi.tax_period, twi.fortnight,
          twi.invoice_number, twi.control_number, twi.invoice_date,
          twi.total_invoice_amount, twi.exempt_amount, twi.taxable_base_amount,
          twi.tax_rate, twi.iva_amount, twi.retained_percentage, twi.iva_retained_amount,
          twi.status, twi.created_at
        FROM tax_withholdings_iva twi
        INNER JOIN branches br ON twi.branch_id = br.id
        INNER JOIN suppliers s ON twi.supplier_id = s.id
        WHERE twi.company_id = ?
      `;
      const params: any[] = [companyId];

      if (period) {
        sql += ` AND twi.tax_period = ?`;
        params.push(period);
      }
      if (branchId) {
        sql += ` AND twi.branch_id = ?`;
        params.push(branchId);
      }
      if (supplierId) {
        sql += ` AND twi.supplier_id = ?`;
        params.push(supplierId);
      }
      sql += ` ORDER BY twi.voucher_number DESC, twi.created_at DESC`;

      const rows = await query<any>(sql, params);
      ivaWithholdings = rows.map((r) => ({
        id: r.id,
        type: 'IVA',
        branchId: r.branch_id,
        branchName: r.branch_name,
        supplierId: r.supplier_id,
        supplierRif: r.supplier_rif,
        supplierName: r.supplier_name,
        purchaseInvoiceId: r.purchase_invoice_id,
        voucherNumber: r.voucher_number,
        taxPeriod: r.tax_period,
        fortnight: r.fortnight,
        invoiceNumber: r.invoice_number,
        controlNumber: r.control_number,
        invoiceDate: r.invoice_date,
        totalInvoiceAmount: Number(r.total_invoice_amount),
        exemptAmount: Number(r.exempt_amount),
        taxableBaseAmount: Number(r.taxable_base_amount),
        taxRate: Number(r.tax_rate),
        ivaAmount: Number(r.iva_amount),
        retainedPercentage: Number(r.retained_percentage),
        retainedAmount: Number(r.iva_retained_amount),
        status: r.status,
        createdAt: r.created_at,
      }));
    }

    if (!filter?.type || filter.type === 'ALL' || filter.type === 'ISLR') {
      let sql = `
        SELECT 
          twis.id, twis.company_id, twis.branch_id, br.name as branch_name,
          twis.supplier_id, s.rif as supplier_rif, s.name as supplier_name,
          twis.purchase_invoice_id, twis.voucher_number, twis.tax_period,
          twis.concept_code, twis.concept_description, twis.person_type,
          pi.invoice_number, pi.control_number, pi.invoice_date,
          twis.total_invoice_amount, twis.taxable_base_amount,
          twis.rate_percentage, twis.subtracting_factor, twis.islr_retained_amount,
          twis.status, twis.created_at
        FROM tax_withholdings_islr twis
        INNER JOIN branches br ON twis.branch_id = br.id
        INNER JOIN suppliers s ON twis.supplier_id = s.id
        INNER JOIN purchase_invoices pi ON twis.purchase_invoice_id = pi.id
        WHERE twis.company_id = ?
      `;
      const params: any[] = [companyId];

      if (period) {
        sql += ` AND twis.tax_period = ?`;
        params.push(period);
      }
      if (branchId) {
        sql += ` AND twis.branch_id = ?`;
        params.push(branchId);
      }
      if (supplierId) {
        sql += ` AND twis.supplier_id = ?`;
        params.push(supplierId);
      }
      sql += ` ORDER BY twis.voucher_number DESC, twis.created_at DESC`;

      const rows = await query<any>(sql, params);
      islrWithholdings = rows.map((r) => ({
        id: r.id,
        type: 'ISLR',
        branchId: r.branch_id,
        branchName: r.branch_name,
        supplierId: r.supplier_id,
        supplierRif: r.supplier_rif,
        supplierName: r.supplier_name,
        purchaseInvoiceId: r.purchase_invoice_id,
        voucherNumber: r.voucher_number,
        taxPeriod: r.tax_period,
        conceptCode: r.concept_code,
        conceptDescription: r.concept_description,
        personType: r.person_type,
        invoiceNumber: r.invoice_number,
        controlNumber: r.control_number,
        invoiceDate: r.invoice_date,
        totalInvoiceAmount: Number(r.total_invoice_amount),
        taxableBaseAmount: Number(r.taxable_base_amount),
        ratePercentage: Number(r.rate_percentage),
        subtractingFactor: Number(r.subtracting_factor),
        retainedAmount: Number(r.islr_retained_amount),
        status: r.status,
        createdAt: r.created_at,
      }));
    }

    const totalIvaRetained = ivaWithholdings
      .filter((w) => w.status !== 'ANNULLED')
      .reduce((sum, w) => sum + w.retainedAmount, 0);

    const totalIslrRetained = islrWithholdings
      .filter((w) => w.status !== 'ANNULLED')
      .reduce((sum, w) => sum + w.retainedAmount, 0);

    return {
      ivaWithholdings,
      islrWithholdings,
      kpis: {
        totalIvaRetained: Number(totalIvaRetained.toFixed(2)),
        totalIslrRetained: Number(totalIslrRetained.toFixed(2)),
        totalRetained: Number((totalIvaRetained + totalIslrRetained).toFixed(2)),
        totalVouchersCount: ivaWithholdings.length + islrWithholdings.length,
      },
    };
  }

  /**
   * Obtiene un comprobante de retención específico por ID (IVA o ISLR)
   */
  static async getWithholdingById(companyId: string, id: string) {
    // 1. Probar en IVA
    const ivaRows = await query<any>(
      `SELECT 
        twi.id, twi.company_id, twi.branch_id, br.name as branch_name,
        twi.supplier_id, s.rif as supplier_rif, s.name as supplier_name,
        twi.purchase_invoice_id, twi.voucher_number, twi.tax_period, twi.fortnight,
        twi.invoice_number, twi.control_number, twi.invoice_date,
        twi.total_invoice_amount, twi.exempt_amount, twi.taxable_base_amount,
        twi.tax_rate, twi.iva_amount, twi.retained_percentage, twi.iva_retained_amount,
        twi.status, twi.created_at
      FROM tax_withholdings_iva twi
      INNER JOIN branches br ON twi.branch_id = br.id
      INNER JOIN suppliers s ON twi.supplier_id = s.id
      WHERE twi.id = ? AND twi.company_id = ?`,
      [id, companyId]
    );

    if (ivaRows.length > 0) {
      const r = ivaRows[0];
      return {
        id: r.id,
        type: 'IVA',
        branchId: r.branch_id,
        branchName: r.branch_name,
        supplierId: r.supplier_id,
        supplierRif: r.supplier_rif,
        supplierName: r.supplier_name,
        purchaseInvoiceId: r.purchase_invoice_id,
        voucherNumber: r.voucher_number,
        taxPeriod: r.tax_period,
        fortnight: r.fortnight,
        invoiceNumber: r.invoice_number,
        controlNumber: r.control_number,
        invoiceDate: r.invoice_date,
        totalInvoiceAmount: Number(r.total_invoice_amount),
        exemptAmount: Number(r.exempt_amount),
        taxableBaseAmount: Number(r.taxable_base_amount),
        taxRate: Number(r.tax_rate),
        ivaAmount: Number(r.iva_amount),
        retainedPercentage: Number(r.retained_percentage),
        retainedAmount: Number(r.iva_retained_amount),
        status: r.status,
        createdAt: r.created_at,
      };
    }

    // 2. Probar en ISLR
    const islrRows = await query<any>(
      `SELECT 
        twis.id, twis.company_id, twis.branch_id, br.name as branch_name,
        twis.supplier_id, s.rif as supplier_rif, s.name as supplier_name,
        twis.purchase_invoice_id, twis.voucher_number, twis.tax_period,
        twis.concept_code, twis.concept_description, twis.person_type,
        pi.invoice_number, pi.control_number, pi.invoice_date,
        twis.total_invoice_amount, twis.taxable_base_amount,
        twis.rate_percentage, twis.subtracting_factor, twis.islr_retained_amount,
        twis.status, twis.created_at
      FROM tax_withholdings_islr twis
      INNER JOIN branches br ON twis.branch_id = br.id
      INNER JOIN suppliers s ON twis.supplier_id = s.id
      INNER JOIN purchase_invoices pi ON twis.purchase_invoice_id = pi.id
      WHERE twis.id = ? AND twis.company_id = ?`,
      [id, companyId]
    );

    if (islrRows.length > 0) {
      const r = islrRows[0];
      return {
        id: r.id,
        type: 'ISLR',
        branchId: r.branch_id,
        branchName: r.branch_name,
        supplierId: r.supplier_id,
        supplierRif: r.supplier_rif,
        supplierName: r.supplier_name,
        purchaseInvoiceId: r.purchase_invoice_id,
        voucherNumber: r.voucher_number,
        taxPeriod: r.tax_period,
        conceptCode: r.concept_code,
        conceptDescription: r.concept_description,
        personType: r.person_type,
        invoiceNumber: r.invoice_number,
        controlNumber: r.control_number,
        invoiceDate: r.invoice_date,
        totalInvoiceAmount: Number(r.total_invoice_amount),
        taxableBaseAmount: Number(r.taxable_base_amount),
        ratePercentage: Number(r.rate_percentage),
        subtractingFactor: Number(r.subtracting_factor),
        retainedAmount: Number(r.islr_retained_amount),
        islrRetainedAmount: Number(r.islr_retained_amount),
        status: r.status,
        createdAt: r.created_at,
      };
    }

    return null;
  }

  /**
   * Obtiene facturas de compra pendientes de retención de IVA o ISLR
   */
  static async getInvoicesPendingWithholding(companyId: string, branchId?: string) {
    let sql = `
      SELECT 
        pi.id, pi.branch_id, br.name as branch_name,
        pi.supplier_id, s.rif as supplier_rif, s.name as supplier_name, s.is_resident, s.islr_concept_code,
        pi.invoice_number, pi.control_number, pi.invoice_date, pi.currency, pi.exchange_rate,
        pi.base_exempt_amount, pi.base_taxable_amount, pi.tax_amount, pi.total_amount,
        (SELECT COUNT(*) FROM tax_withholdings_iva twi WHERE twi.purchase_invoice_id = pi.id AND twi.status <> 'ANNULLED') as has_iva_withholding,
        (SELECT COUNT(*) FROM tax_withholdings_islr twis WHERE twis.purchase_invoice_id = pi.id AND twis.status <> 'ANNULLED') as has_islr_withholding
      FROM purchase_invoices pi
      INNER JOIN branches br ON pi.branch_id = br.id
      INNER JOIN suppliers s ON pi.supplier_id = s.id
      WHERE br.company_id = ? AND pi.status <> 'ANNULLED'
    `;
    const params: any[] = [companyId];

    if (branchId) {
      sql += ` AND pi.branch_id = ?`;
      params.push(branchId);
    }
    sql += ` ORDER BY pi.invoice_date DESC LIMIT 100`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      supplierId: r.supplier_id,
      supplierRif: r.supplier_rif,
      supplierName: r.supplier_name,
      supplierIsResident: Boolean(r.is_resident),
      supplierIslrConceptCode: r.islr_concept_code,
      invoiceNumber: r.invoice_number,
      controlNumber: r.control_number,
      invoiceDate: r.invoice_date,
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      baseExemptAmount: Number(r.base_exempt_amount),
      baseTaxableAmount: Number(r.base_taxable_amount),
      taxAmount: Number(r.tax_amount),
      totalAmount: Number(r.total_amount),
      hasIvaWithholding: Number(r.has_iva_withholding) > 0,
      hasIslrWithholding: Number(r.has_islr_withholding) > 0,
    }));
  }

  /**
   * Emite comprobante oficial de Retención de IVA
   */
  static async emitIVAWithholding(companyId: string, userId: string, data: EmitWithholdingIVAInput) {
    return await withTransaction(async (conn) => {
      // 1. Verificar existencia de factura de compra
      const [invoiceRows] = await conn.query<any[]>(
        `SELECT pi.*, br.company_id, s.rif as supplier_rif, s.name as supplier_name
         FROM purchase_invoices pi
         INNER JOIN branches br ON pi.branch_id = br.id
         INNER JOIN suppliers s ON pi.supplier_id = s.id
         WHERE pi.id = ? AND br.company_id = ?`,
        [data.purchaseInvoiceId, companyId]
      );

      if (invoiceRows.length === 0) {
        throw new Error('Factura de compra no encontrada o no pertenece a la empresa');
      }

      const invoice = invoiceRows[0];

      if (Number(invoice.tax_amount) <= 0) {
        throw new Error('La factura no posee monto de IVA sujeto a retención');
      }

      // 2. Verificar que no exista ya una retención activa para esta factura
      const [existingRows] = await conn.query<any[]>(
        `SELECT id, voucher_number FROM tax_withholdings_iva 
         WHERE purchase_invoice_id = ? AND status <> 'ANNULLED'`,
        [data.purchaseInvoiceId]
      );

      if (existingRows.length > 0) {
        throw new Error(`Esta factura ya posee un comprobante de retención de IVA emitido (${existingRows[0].voucher_number})`);
      }

      // 3. Generar Período Fiscal y Número de Comprobante (YYYYMM + 8 dígitos)
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const taxPeriod = `${year}-${month.toString().padStart(2, '0')}`;

      // Obtener el siguiente correlativo para este año/mes
      const prefix = `${year}${month.toString().padStart(2, '0')}%`;
      const [countRows] = await conn.query<any[]>(
        `SELECT COUNT(*) as count FROM tax_withholdings_iva 
         WHERE company_id = ? AND voucher_number LIKE ?`,
        [companyId, prefix]
      );
      const nextSequence = Number(countRows[0].count) + 1;
      const voucherNumber = generateSENIATVoucherNumber(year, month, nextSequence);

      // 4. Calcular el monto retenido
      const retainedPercentage = data.retainedPercentage === 100 ? 100 : 75;
      const ivaRetainedAmount = calculateIVARetention(Number(invoice.tax_amount), retainedPercentage);

      // 5. Insertar en tax_withholdings_iva
      const withholdingId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO tax_withholdings_iva (
          id, company_id, branch_id, supplier_id, purchase_invoice_id,
          voucher_number, tax_period, fortnight, invoice_number, control_number,
          invoice_date, total_invoice_amount, exempt_amount, taxable_base_amount,
          tax_rate, iva_amount, retained_percentage, iva_retained_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMITTED')`,
        [
          withholdingId,
          companyId,
          invoice.branch_id,
          invoice.supplier_id,
          invoice.id,
          voucherNumber,
          taxPeriod,
          data.fortnight,
          invoice.invoice_number,
          invoice.control_number || 'N/A',
          invoice.invoice_date,
          Number(invoice.total_amount),
          Number(invoice.base_exempt_amount),
          Number(invoice.base_taxable_amount),
          16.00,
          Number(invoice.tax_amount),
          retainedPercentage,
          ivaRetainedAmount,
        ]
      );

      return {
        id: withholdingId,
        voucherNumber,
        taxPeriod,
        fortnight: data.fortnight,
        retainedPercentage,
        ivaRetainedAmount,
        invoiceNumber: invoice.invoice_number,
        supplierName: invoice.supplier_name,
        supplierRif: invoice.supplier_rif,
      };
    });
  }

  /**
   * Emite comprobante de Retención de ISLR (Decreto 1808)
   */
  static async emitISLRWithholding(companyId: string, userId: string, data: EmitWithholdingISLRInput) {
    return await withTransaction(async (conn) => {
      // 1. Verificar factura de compra
      const [invoiceRows] = await conn.query<any[]>(
        `SELECT pi.*, br.company_id, s.rif as supplier_rif, s.name as supplier_name
         FROM purchase_invoices pi
         INNER JOIN branches br ON pi.branch_id = br.id
         INNER JOIN suppliers s ON pi.supplier_id = s.id
         WHERE pi.id = ? AND br.company_id = ?`,
        [data.purchaseInvoiceId, companyId]
      );

      if (invoiceRows.length === 0) {
        throw new Error('Factura de compra no encontrada o no pertenece a la empresa');
      }

      const invoice = invoiceRows[0];

      if (Number(invoice.base_taxable_amount) <= 0) {
        throw new Error('La factura no posee base imponible sujeta a retención de ISLR');
      }

      // 2. Verificar que no exista retención activa con este concepto
      const [existingRows] = await conn.query<any[]>(
        `SELECT id, voucher_number FROM tax_withholdings_islr 
         WHERE purchase_invoice_id = ? AND concept_code = ? AND status <> 'ANNULLED'`,
        [data.purchaseInvoiceId, data.conceptCode]
      );

      if (existingRows.length > 0) {
        throw new Error(`Esta factura ya posee retención de ISLR emitida para este concepto (${existingRows[0].voucher_number})`);
      }

      // 3. Generar Correlativo
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const taxPeriod = `${year}-${month.toString().padStart(2, '0')}`;

      const prefix = `${year}${month.toString().padStart(2, '0')}%`;
      const [countRows] = await conn.query<any[]>(
        `SELECT COUNT(*) as count FROM tax_withholdings_islr 
         WHERE company_id = ? AND voucher_number LIKE ?`,
        [companyId, prefix]
      );
      const nextSequence = Number(countRows[0].count) + 1;
      const voucherNumber = generateSENIATVoucherNumber(year, month, nextSequence);

      // 4. Calcular Retención ISLR
      const islrRetainedAmount = calculateISLRRetention(
        Number(invoice.base_taxable_amount),
        data.ratePercentage,
        data.subtractingFactor || 0
      );

      // 5. Guardar en base de datos
      const withholdingId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO tax_withholdings_islr (
          id, company_id, branch_id, supplier_id, purchase_invoice_id,
          voucher_number, tax_period, concept_code, concept_description,
          person_type, total_invoice_amount, taxable_base_amount,
          rate_percentage, subtracting_factor, islr_retained_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMITTED')`,
        [
          withholdingId,
          companyId,
          invoice.branch_id,
          invoice.supplier_id,
          invoice.id,
          voucherNumber,
          taxPeriod,
          data.conceptCode,
          data.conceptDescription,
          data.personType,
          Number(invoice.total_amount),
          Number(invoice.base_taxable_amount),
          data.ratePercentage,
          data.subtractingFactor || 0,
          islrRetainedAmount,
        ]
      );

      return {
        id: withholdingId,
        voucherNumber,
        taxPeriod,
        conceptCode: data.conceptCode,
        conceptDescription: data.conceptDescription,
        ratePercentage: data.ratePercentage,
        islrRetainedAmount,
        invoiceNumber: invoice.invoice_number,
        supplierName: invoice.supplier_name,
        supplierRif: invoice.supplier_rif,
      };
    });
  }

  /**
   * Anula un comprobante de retención
   */
  static async annulWithholding(companyId: string, type: 'IVA' | 'ISLR', id: string) {
    const table = type === 'IVA' ? 'tax_withholdings_iva' : 'tax_withholdings_islr';
    const result = await query(
      `UPDATE ${table} SET status = 'ANNULLED' WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    return { success: true, message: `Comprobante de ${type} anulado correctamente` };
  }

  /**
   * Genera el Libro de Compras Fiscal (SENIAT) para el período dado
   */
  static async getPurchasesBook(companyId: string, period: string, branchId?: string) {
    let sql = `
      SELECT * FROM v_book_purchases
      WHERE company_id = ? AND fiscal_period = ?
    `;
    const params: any[] = [companyId, period];

    if (branchId) {
      sql += ` AND branch_id = ?`;
      params.push(branchId);
    }
    sql += ` ORDER BY emission_date ASC, invoice_number ASC`;

    const rows = await query<any>(sql, params);

    const mapped = rows.map((r, index) => ({
      rowNum: index + 1,
      invoiceId: r.invoice_id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      supplierId: r.supplier_id,
      supplierRif: r.supplier_rif,
      supplierName: r.supplier_name,
      invoiceNumber: r.invoice_number,
      controlNumber: r.control_number || 'N/A',
      emissionDate: r.emission_date,
      totalAmount: Number(r.total_amount),
      baseExemptAmount: Number(r.base_exempt_amount),
      baseTaxableAmount: Number(r.base_taxable_amount),
      taxRate: Number(r.tax_rate),
      taxAmount: Number(r.tax_amount),
      ivaRetainedAmount: Number(r.iva_retained_amount),
      withholdingVoucherNumber: r.withholding_voucher_number || '',
      fiscalPeriod: r.fiscal_period,
    }));

    const totals = mapped.reduce(
      (acc, item) => ({
        totalPurchases: acc.totalPurchases + item.totalAmount,
        totalExempt: acc.totalExempt + item.baseExemptAmount,
        totalTaxable: acc.totalTaxable + item.baseTaxableAmount,
        totalTax: acc.totalTax + item.taxAmount,
        totalIvaRetained: acc.totalIvaRetained + item.ivaRetainedAmount,
      }),
      { totalPurchases: 0, totalExempt: 0, totalTaxable: 0, totalTax: 0, totalIvaRetained: 0 }
    );

    return {
      period,
      branchId,
      items: mapped,
      totals: {
        totalPurchases: Number(totals.totalPurchases.toFixed(2)),
        totalExempt: Number(totals.totalExempt.toFixed(2)),
        totalTaxable: Number(totals.totalTaxable.toFixed(2)),
        totalTax: Number(totals.totalTax.toFixed(2)),
        totalIvaRetained: Number(totals.totalIvaRetained.toFixed(2)),
      },
    };
  }

  /**
   * Genera el Libro de Ventas Fiscal (SENIAT) para el período dado
   */
  static async getSalesBook(companyId: string, period: string, branchId?: string) {
    let sql = `
      SELECT * FROM v_book_sales
      WHERE company_id = ? AND fiscal_period = ?
    `;
    const params: any[] = [companyId, period];

    if (branchId) {
      sql += ` AND branch_id = ?`;
      params.push(branchId);
    }
    sql += ` ORDER BY emission_date ASC, invoice_number ASC`;

    const rows = await query<any>(sql, params);

    const mapped = rows.map((r, index) => ({
      rowNum: index + 1,
      invoiceId: r.invoice_id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      customerRif: r.customer_rif,
      customerName: r.customer_name,
      invoiceNumber: r.invoice_number,
      controlNumber: r.control_number || 'N/A',
      emissionDate: r.emission_date,
      totalAmount: Number(r.total_amount),
      baseExemptAmount: Number(r.base_exempt_amount),
      baseTaxableAmount: Number(r.base_taxable_amount),
      taxRate: Number(r.tax_rate),
      taxAmount: Number(r.tax_amount),
      igtfAmount: Number(r.igtf_amount),
      ivaRetainedAmount: Number(r.iva_retained_amount),
      fiscalPeriod: r.fiscal_period,
    }));

    const totals = mapped.reduce(
      (acc, item) => ({
        totalSales: acc.totalSales + item.totalAmount,
        totalExempt: acc.totalExempt + item.baseExemptAmount,
        totalTaxable: acc.totalTaxable + item.baseTaxableAmount,
        totalTax: acc.totalTax + item.taxAmount,
        totalIgtf: acc.totalIgtf + item.igtfAmount,
        totalIvaRetained: acc.totalIvaRetained + item.ivaRetainedAmount,
      }),
      { totalSales: 0, totalExempt: 0, totalTaxable: 0, totalTax: 0, totalIgtf: 0, totalIvaRetained: 0 }
    );

    return {
      period,
      branchId,
      items: mapped,
      totals: {
        totalSales: Number(totals.totalSales.toFixed(2)),
        totalExempt: Number(totals.totalExempt.toFixed(2)),
        totalTaxable: Number(totals.totalTaxable.toFixed(2)),
        totalTax: Number(totals.totalTax.toFixed(2)),
        totalIgtf: Number(totals.totalIgtf.toFixed(2)),
        totalIvaRetained: Number(totals.totalIvaRetained.toFixed(2)),
      },
    };
  }

  /**
   * Genera el Reporte Anual de Retenciones de ISLR (Comprobante ARCV) por proveedor
   */
  static async getARCVReport(companyId: string, taxYear: number, supplierId?: string) {
    let sql = `
      SELECT 
        s.id as supplier_id, s.rif as supplier_rif, s.name as supplier_name,
        twis.id as withholding_id, twis.voucher_number, twis.tax_period,
        twis.concept_code, twis.concept_description, twis.person_type,
        pi.invoice_number, pi.control_number, pi.invoice_date,
        twis.total_invoice_amount, twis.taxable_base_amount,
        twis.rate_percentage, twis.subtracting_factor, twis.islr_retained_amount,
        twis.created_at
      FROM tax_withholdings_islr twis
      INNER JOIN suppliers s ON twis.supplier_id = s.id
      INNER JOIN purchase_invoices pi ON twis.purchase_invoice_id = pi.id
      WHERE twis.company_id = ? AND twis.tax_period LIKE ? AND twis.status <> 'ANNULLED'
    `;
    const params: any[] = [companyId, `${taxYear}-%`];

    if (supplierId) {
      sql += ` AND twis.supplier_id = ?`;
      params.push(supplierId);
    }
    sql += ` ORDER BY s.name ASC, twis.tax_period ASC, twis.voucher_number ASC`;

    const rows = await query<any>(sql, params);

    // Agrupar por proveedor
    const suppliersMap = new Map<string, any>();

    for (const r of rows) {
      if (!suppliersMap.has(r.supplier_id)) {
        suppliersMap.set(r.supplier_id, {
          supplierId: r.supplier_id,
          supplierRif: r.supplier_rif,
          supplierName: r.supplier_name,
          taxYear,
          totalTaxableBase: 0,
          totalIslrRetained: 0,
          vouchersCount: 0,
          vouchers: [],
        });
      }

      const sup = suppliersMap.get(r.supplier_id);
      sup.totalTaxableBase += Number(r.taxable_base_amount);
      sup.totalIslrRetained += Number(r.islr_retained_amount);
      sup.vouchersCount += 1;
      sup.vouchers.push({
        id: r.withholding_id,
        voucherNumber: r.voucher_number,
        taxPeriod: r.tax_period,
        conceptCode: r.concept_code,
        conceptDescription: r.concept_description,
        personType: r.person_type,
        invoiceNumber: r.invoice_number,
        controlNumber: r.control_number || 'N/A',
        invoiceDate: r.invoice_date,
        totalInvoiceAmount: Number(r.total_invoice_amount),
        taxableBaseAmount: Number(r.taxable_base_amount),
        ratePercentage: Number(r.rate_percentage),
        subtractingFactor: Number(r.subtracting_factor),
        islrRetainedAmount: Number(r.islr_retained_amount),
      });
    }

    const suppliersList = Array.from(suppliersMap.values()).map((s) => ({
      ...s,
      totalTaxableBase: Number(s.totalTaxableBase.toFixed(2)),
      totalIslrRetained: Number(s.totalIslrRetained.toFixed(2)),
    }));

    return {
      taxYear,
      suppliersCount: suppliersList.length,
      suppliers: suppliersList,
    };
  }

  /**
   * Exporta la Declaración Informativa SENIAT en formato oficial XML / TXT
   */
  static async exportSENIAT(companyId: string, period: string, type: 'ISLR' | 'IVA') {
    const [companyRows] = await query<any[]>(
      `SELECT rif, legal_name FROM companies WHERE id = ?`,
      [companyId]
    );
    const company = companyRows[0] || { rif: 'J-00000000-0', legal_name: 'EMPRESA' };
    const cleanCompanyRif = company.rif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const periodFormatted = period.replace('-', '');

    if (type === 'ISLR') {
      // Formato XML Oficial SENIAT para Declaración Informativa de Retenciones de ISLR
      const rows = await query<any>(
        `SELECT 
          s.rif as supplier_rif, pi.invoice_number, pi.control_number,
          DATE_FORMAT(pi.invoice_date, '%d/%m/%Y') as formatted_date,
          twis.concept_code, twis.taxable_base_amount, twis.rate_percentage,
          twis.islr_retained_amount
         FROM tax_withholdings_islr twis
         INNER JOIN suppliers s ON twis.supplier_id = s.id
         INNER JOIN purchase_invoices pi ON twis.purchase_invoice_id = pi.id
         WHERE twis.company_id = ? AND twis.tax_period = ? AND twis.status <> 'ANNULLED'
         ORDER BY twis.voucher_number ASC`,
        [companyId, period]
      );

      let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;
      xml += `<RelacionRetencionesISLR RifAgente="${cleanCompanyRif}" Periodo="${periodFormatted}">\n`;

      for (const r of rows) {
        const cleanSupplierRif = r.supplier_rif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        xml += `  <DetalleRetencion>\n`;
        xml += `    <RifRetenido>${cleanSupplierRif}</RifRetenido>\n`;
        xml += `    <NumeroFactura>${r.invoice_number}</NumeroFactura>\n`;
        xml += `    <NumeroControl>${r.control_number || '00'}</NumeroControl>\n`;
        xml += `    <FechaOperacion>${r.formatted_date}</FechaOperacion>\n`;
        xml += `    <CodigoConcepto>${r.concept_code}</CodigoConcepto>\n`;
        xml += `    <MontoOperacion>${Number(r.taxable_base_amount).toFixed(2)}</MontoOperacion>\n`;
        xml += `    <PorcentajeRetencion>${Number(r.rate_percentage).toFixed(2)}</PorcentajeRetencion>\n`;
        xml += `  </DetalleRetencion>\n`;
      }
      xml += `</RelacionRetencionesISLR>`;

      return {
        format: 'xml',
        filename: `ISLR_${cleanCompanyRif}_${periodFormatted}.xml`,
        content: xml,
      };
    } else {
      // Formato TXT Oficial SENIAT para Retenciones de IVA (Providencia SNAT/2015/0049)
      const rows = await query<any>(
        `SELECT 
          s.rif as supplier_rif, twi.voucher_number, twi.invoice_number, twi.control_number,
          DATE_FORMAT(twi.invoice_date, '%Y-%m-%d') as invoice_date,
          twi.total_invoice_amount, twi.taxable_base_amount, twi.iva_retained_amount,
          twi.tax_rate
         FROM tax_withholdings_iva twi
         INNER JOIN suppliers s ON twi.supplier_id = s.id
         WHERE twi.company_id = ? AND twi.tax_period = ? AND twi.status <> 'ANNULLED'
         ORDER BY twi.voucher_number ASC`,
        [companyId, period]
      );

      let txt = '';
      for (const r of rows) {
        const cleanSupplierRif = r.supplier_rif.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        // Formato tabulado SENIAT estándar:
        // RIF_AGENTE\tPERIODO\tFECHA\tOPERACION\tTIPO_DOC\tRIF_PROVEEDOR\tNUM_FAC\tNUM_CTRL\tTOTAL\tBASE\tRETENIDO\t0\tCOMPROBANTE\tEXENTO\tALICUOTA\t0
        const line = [
          cleanCompanyRif,
          periodFormatted,
          r.invoice_date,
          'C', // Compras
          '01', // Factura
          cleanSupplierRif,
          r.invoice_number,
          r.control_number || '00',
          Number(r.total_invoice_amount).toFixed(2),
          Number(r.taxable_base_amount).toFixed(2),
          Number(r.iva_retained_amount).toFixed(2),
          '0',
          r.voucher_number,
          '0.00',
          Number(r.tax_rate).toFixed(2),
          '0',
        ].join('\t');
        txt += line + '\n';
      }

      return {
        format: 'txt',
        filename: `IVA_${cleanCompanyRif}_${periodFormatted}.txt`,
        content: txt,
      };
    }
  }
}
