import { query } from '../../db';
import { SupplierInput, SupplierProductInput } from '@ero/shared';
import crypto from 'crypto';

export interface SupplierFilters {
  search?: string;
  status?: string;
  debtStatus?: string;
  creditTerms?: string;
}

export class SuppliersService {
  static async getSuppliers(companyId: string, filters?: SupplierFilters | string) {
    const opts: SupplierFilters = typeof filters === 'string' ? { search: filters } : (filters || {});

    let sql = `
      SELECT s.id, s.company_id, s.rif, s.name, s.commercial_name, s.fiscal_address, s.contact_name,
             s.phone, s.email, s.is_person_natural, s.is_resident, s.islr_concept_code, s.credit_limit,
             s.payment_terms_days, s.is_active, s.created_at,
             COALESCE(pay.balance, 0) AS current_balance,
             COALESCE(pay.pending_count, 0) AS pending_payables_count,
             COALESCE(pur.total_amount, 0) AS total_purchases_amount,
             COALESCE(pur.invoices_count, 0) AS total_purchases_count,
             pur.last_purchase_date,
             COALESCE(prod.products_count, 0) AS products_count
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id,
               SUM(amount_balance) AS balance,
               COUNT(CASE WHEN status IN ('PENDING', 'PARTIAL', 'OVERDUE') THEN 1 END) AS pending_count
        FROM payables
        WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')
        GROUP BY supplier_id
      ) pay ON s.id = pay.supplier_id
      LEFT JOIN (
        SELECT supplier_id,
               SUM(total_amount) AS total_amount,
               COUNT(id) AS invoices_count,
               MAX(invoice_date) AS last_purchase_date
        FROM purchase_invoices
        WHERE status != 'ANNULLED'
        GROUP BY supplier_id
      ) pur ON s.id = pur.supplier_id
      LEFT JOIN (
        SELECT supplier_id, COUNT(id) AS products_count
        FROM supplier_products
        GROUP BY supplier_id
      ) prod ON s.id = prod.supplier_id
      WHERE s.company_id = ?
    `;
    const params: any[] = [companyId];

    if (opts.search && opts.search.trim()) {
      sql += ` AND (s.name LIKE ? OR s.commercial_name LIKE ? OR s.rif LIKE ? OR s.email LIKE ? OR s.contact_name LIKE ? OR s.phone LIKE ?)`;
      const term = `%${opts.search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    if (opts.status === 'active') {
      sql += ` AND s.is_active = 1`;
    } else if (opts.status === 'inactive') {
      sql += ` AND s.is_active = 0`;
    }

    if (opts.creditTerms === 'credit') {
      sql += ` AND s.payment_terms_days > 0`;
    } else if (opts.creditTerms === 'cash') {
      sql += ` AND s.payment_terms_days = 0`;
    }

    if (opts.debtStatus === 'with_debt') {
      sql += ` AND COALESCE(pay.balance, 0) > 0`;
    } else if (opts.debtStatus === 'solvent') {
      sql += ` AND COALESCE(pay.balance, 0) = 0`;
    }

    sql += ` ORDER BY s.name ASC`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      rif: r.rif,
      name: r.name,
      commercialName: r.commercial_name || null,
      fiscalAddress: r.fiscal_address || null,
      contactName: r.contact_name || null,
      phone: r.phone || null,
      email: r.email || null,
      isPersonNatural: Boolean(r.is_person_natural),
      isResident: Boolean(r.is_resident),
      islrConceptCode: r.islr_concept_code || null,
      creditLimit: Number(r.credit_limit || 0),
      paymentTermsDays: Number(r.payment_terms_days || 0),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      currentBalance: Number(r.current_balance),
      pendingPayablesCount: Number(r.pending_payables_count),
      totalPurchasesAmount: Number(r.total_purchases_amount),
      totalPurchasesCount: Number(r.total_purchases_count),
      lastPurchaseDate: r.last_purchase_date || null,
      productsCount: Number(r.products_count),
    }));
  }

  static async getSupplierById(id: string, companyId: string) {
    const rows = await query<any>(
      `SELECT s.*,
              COALESCE(pay.balance, 0) AS current_balance,
              COALESCE(pay.pending_count, 0) AS pending_payables_count,
              COALESCE(pur.total_amount, 0) AS total_purchases_amount,
              COALESCE(pur.invoices_count, 0) AS total_purchases_count,
              pur.last_purchase_date,
              COALESCE(prod.products_count, 0) AS products_count
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id,
                SUM(amount_balance) AS balance,
                COUNT(CASE WHEN status IN ('PENDING', 'PARTIAL', 'OVERDUE') THEN 1 END) AS pending_count
         FROM payables
         WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')
         GROUP BY supplier_id
       ) pay ON s.id = pay.supplier_id
       LEFT JOIN (
         SELECT supplier_id,
                SUM(total_amount) AS total_amount,
                COUNT(id) AS invoices_count,
                MAX(invoice_date) AS last_purchase_date
         FROM purchase_invoices
         WHERE status != 'ANNULLED'
         GROUP BY supplier_id
       ) pur ON s.id = pur.supplier_id
       LEFT JOIN (
         SELECT supplier_id, COUNT(id) AS products_count
         FROM supplier_products
         GROUP BY supplier_id
       ) prod ON s.id = prod.supplier_id
       WHERE s.id = ? AND s.company_id = ?`,
      [id, companyId]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Proveedor no encontrado');
    }

    const r = rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      rif: r.rif,
      name: r.name,
      commercialName: r.commercial_name || null,
      fiscalAddress: r.fiscal_address || null,
      contactName: r.contact_name || null,
      phone: r.phone || null,
      email: r.email || null,
      isPersonNatural: Boolean(r.is_person_natural),
      isResident: Boolean(r.is_resident),
      islrConceptCode: r.islr_concept_code || null,
      creditLimit: Number(r.credit_limit || 0),
      paymentTermsDays: Number(r.payment_terms_days || 0),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      currentBalance: Number(r.current_balance),
      pendingPayablesCount: Number(r.pending_payables_count),
      totalPurchasesAmount: Number(r.total_purchases_amount),
      totalPurchasesCount: Number(r.total_purchases_count),
      lastPurchaseDate: r.last_purchase_date || null,
      productsCount: Number(r.products_count),
    };
  }

  static async createSupplier(companyId: string, data: SupplierInput) {
    const existing = await query<any>(
      `SELECT id FROM suppliers WHERE company_id = ? AND rif = ?`,
      [companyId, data.rif]
    );

    if (existing.length > 0) {
      throw new Error(`Ya existe un proveedor registrado con el RIF ${data.rif}`);
    }

    const id = data.id || crypto.randomUUID();

    await query(
      `INSERT INTO suppliers (
        id, company_id, rif, name, commercial_name, fiscal_address, contact_name, phone, email,
        is_person_natural, is_resident, islr_concept_code, credit_limit,
        payment_terms_days, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.rif.trim().toUpperCase(),
        data.name.trim(),
        data.commercialName ? data.commercialName.trim() : null,
        data.fiscalAddress || null,
        data.contactName ? data.contactName.trim() : null,
        data.phone || null,
        data.email || null,
        data.isPersonNatural ? 1 : 0,
        data.isResident ? 1 : 0,
        data.islrConceptCode || null,
        data.creditLimit || 0,
        data.paymentTermsDays || 0,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      ]
    );

    return this.getSupplierById(id, companyId);
  }

  static async updateSupplier(id: string, companyId: string, data: Partial<SupplierInput>) {
    await this.getSupplierById(id, companyId);

    const fields: string[] = [];
    const values: any[] = [];

    if (data.rif !== undefined) {
      fields.push('rif = ?');
      values.push(data.rif.trim().toUpperCase());
    }
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name.trim());
    }
    if (data.commercialName !== undefined) {
      fields.push('commercial_name = ?');
      values.push(data.commercialName ? data.commercialName.trim() : null);
    }
    if (data.fiscalAddress !== undefined) {
      fields.push('fiscal_address = ?');
      values.push(data.fiscalAddress || null);
    }
    if (data.contactName !== undefined) {
      fields.push('contact_name = ?');
      values.push(data.contactName ? data.contactName.trim() : null);
    }
    if (data.phone !== undefined) {
      fields.push('phone = ?');
      values.push(data.phone || null);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email || null);
    }
    if (data.isPersonNatural !== undefined) {
      fields.push('is_person_natural = ?');
      values.push(data.isPersonNatural ? 1 : 0);
    }
    if (data.isResident !== undefined) {
      fields.push('is_resident = ?');
      values.push(data.isResident ? 1 : 0);
    }
    if (data.islrConceptCode !== undefined) {
      fields.push('islr_concept_code = ?');
      values.push(data.islrConceptCode || null);
    }
    if (data.creditLimit !== undefined) {
      fields.push('credit_limit = ?');
      values.push(data.creditLimit);
    }
    if (data.paymentTermsDays !== undefined) {
      fields.push('payment_terms_days = ?');
      values.push(data.paymentTermsDays);
    }
    if (data.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (fields.length === 0) {
      return this.getSupplierById(id, companyId);
    }

    values.push(id, companyId);
    await query(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ? AND company_id = ?`, values);

    return this.getSupplierById(id, companyId);
  }

  // --- PRODUCTOS POR PROVEEDOR ---
  static async getSupplierProducts(supplierId: string, companyId: string) {
    const rows = await query<any>(
      `SELECT sp.id, sp.supplier_id, sp.product_id, sp.supplier_product_code,
              sp.cost_price_usd, sp.delivery_lead_time_days, sp.is_preferred, sp.notes,
              sp.created_at, sp.updated_at,
              p.name AS product_name, p.sku, p.barcode,
              b.name AS brand_name,
              u.symbol AS unit_symbol,
              d.name AS department_name
       FROM supplier_products sp
       INNER JOIN products p ON sp.product_id = p.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN units_of_measure u ON p.unit_of_measure_id = u.id
       LEFT JOIN departments d ON p.department_id = d.id
       WHERE sp.supplier_id = ? AND sp.company_id = ?
       ORDER BY sp.is_preferred DESC, p.name ASC`,
      [supplierId, companyId]
    );

    return rows.map((r) => ({
      id: r.id,
      supplierId: r.supplier_id,
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      barcode: r.barcode,
      brandName: r.brand_name || null,
      unitSymbol: r.unit_symbol || null,
      departmentName: r.department_name || null,
      supplierProductCode: r.supplier_product_code || null,
      costPriceUsd: Number(r.cost_price_usd || 0),
      deliveryLeadTimeDays: Number(r.delivery_lead_time_days || 0),
      isPreferred: Boolean(r.is_preferred),
      notes: r.notes || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  static async addOrUpdateSupplierProduct(supplierId: string, companyId: string, data: SupplierProductInput) {
    const id = crypto.randomUUID();

    // Si este se marca como preferido, desmarcar otros preferidos para el mismo producto en la empresa si aplica
    if (data.isPreferred) {
      await query(
        `UPDATE supplier_products SET is_preferred = 0 WHERE product_id = ? AND company_id = ?`,
        [data.productId, companyId]
      );
    }

    await query(
      `INSERT INTO supplier_products (
        id, company_id, supplier_id, product_id, supplier_product_code,
        cost_price_usd, delivery_lead_time_days, is_preferred, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        supplier_product_code = VALUES(supplier_product_code),
        cost_price_usd = VALUES(cost_price_usd),
        delivery_lead_time_days = VALUES(delivery_lead_time_days),
        is_preferred = VALUES(is_preferred),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        companyId,
        supplierId,
        data.productId,
        data.supplierProductCode ? data.supplierProductCode.trim() : null,
        data.costPriceUsd || 0,
        data.deliveryLeadTimeDays || 0,
        data.isPreferred ? 1 : 0,
        data.notes ? data.notes.trim() : null,
      ]
    );

    return this.getSupplierProducts(supplierId, companyId);
  }

  static async removeSupplierProduct(supplierId: string, productId: string, companyId: string) {
    await query(
      `DELETE FROM supplier_products WHERE supplier_id = ? AND product_id = ? AND company_id = ?`,
      [supplierId, productId, companyId]
    );
    return { success: true };
  }

  // --- HISTÓRICO DEL PROVEEDOR ---
  static async getSupplierHistory(supplierId: string, companyId: string) {
    const supplier = await this.getSupplierById(supplierId, companyId);

    // 1. Órdenes de compra
    const orders = await query<any>(
      `SELECT po.id, 'PURCHASE_ORDER' AS type, po.order_number AS reference,
              po.order_date AS date, po.total_amount, po.currency, po.status,
              po.notes, b.name AS branch_name
       FROM purchase_orders po
       INNER JOIN branches b ON po.branch_id = b.id
       WHERE po.supplier_id = ? AND po.company_id = ?
       ORDER BY po.order_date DESC`,
      [supplierId, companyId]
    );

    // 2. Recepciones de mercancía
    const receipts = await query<any>(
      `SELECT gr.id, 'GOODS_RECEIPT' AS type, gr.receipt_number AS reference,
              gr.receipt_date AS date, gr.total_cost AS total_amount, gr.currency,
              gr.status, gr.supplier_delivery_note AS notes, b.name AS branch_name
       FROM goods_receipts gr
       INNER JOIN branches b ON gr.branch_id = b.id
       WHERE gr.supplier_id = ? AND gr.company_id = ?
       ORDER BY gr.receipt_date DESC`,
      [supplierId, companyId]
    );

    // 3. Facturas de compra
    const invoices = await query<any>(
      `SELECT pi.id, 'PURCHASE_INVOICE' AS type, pi.invoice_number AS reference,
              pi.invoice_date AS date, pi.total_amount, pi.currency, pi.status,
              pi.control_number AS notes, b.name AS branch_name
       FROM purchase_invoices pi
       INNER JOIN branches b ON pi.branch_id = b.id
       WHERE pi.supplier_id = ? AND b.company_id = ?
       ORDER BY pi.invoice_date DESC`,
      [supplierId, companyId]
    );

    // 4. Pagos y abonos realizados
    const payments = await query<any>(
      `SELECT pp.id, 'PAYMENT' AS type, pp.reference_number AS reference,
              pp.created_at AS date, pp.amount_usd AS total_amount, 'USD' AS currency,
              'PAID' AS status, CONCAT(pp.method, IF(pp.notes IS NOT NULL, CONCAT(' - ', pp.notes), '')) AS notes,
              b.name AS branch_name
       FROM purchase_payments pp
       INNER JOIN purchase_invoices pi ON pp.invoice_id = pi.id
       INNER JOIN branches b ON pi.branch_id = b.id
       WHERE pi.supplier_id = ? AND b.company_id = ?
       ORDER BY pp.created_at DESC`,
      [supplierId, companyId]
    );

    // 5. Notas de Crédito y Débito del proveedor
    const notes = await query<any>(
      `SELECT sn.id,
              IF(sn.type = 'CREDIT', 'CREDIT_NOTE', 'DEBIT_NOTE') AS type,
              sn.note_number AS reference,
              sn.note_date AS date,
              sn.total_amount,
              sn.currency,
              sn.status,
              CONCAT(
                IF(sn.type = 'CREDIT', 'Nota de Crédito', 'Nota de Débito'),
                IF(sn.reason_description IS NOT NULL, CONCAT(' - ', sn.reason_description), '')
              ) AS notes,
              b.name AS branch_name
       FROM supplier_notes sn
       INNER JOIN branches b ON sn.branch_id = b.id
       WHERE sn.supplier_id = ? AND sn.company_id = ?
       ORDER BY sn.note_date DESC`,
      [supplierId, companyId]
    );

    // Unificar y ordenar por fecha descendente
    const history = [...orders, ...receipts, ...invoices, ...payments, ...notes].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return {
      supplier,
      history: history.map((h) => ({
        id: h.id,
        type: h.type,
        reference: h.reference,
        date: h.date,
        totalAmount: Number(h.total_amount || 0),
        currency: h.currency,
        status: h.status,
        notes: h.notes || null,
        branchName: h.branch_name,
      })),
    };
  }

  // --- ESTADO DE CUENTA ---
  static async getSupplierStatement(id: string, companyId: string) {
    const supplier = await this.getSupplierById(id, companyId);

    const invoices = await query<any>(
      `SELECT pi.id, pi.invoice_number, pi.control_number, pi.invoice_date,
              pi.total_amount, pi.status, pi.is_credit,
              b.name as branch_name,
              p.id as payable_id, p.amount_paid, p.amount_balance, p.due_date,
              DATEDIFF(CURRENT_DATE(), p.due_date) as days_overdue
       FROM purchase_invoices pi
       INNER JOIN branches b ON pi.branch_id = b.id
       LEFT JOIN payables p ON pi.id = p.invoice_id
       WHERE pi.supplier_id = ? AND b.company_id = ?
       ORDER BY pi.invoice_date DESC`,
      [id, companyId]
    );

    const payments = await query<any>(
      `SELECT pp.id, pp.method, pp.amount_ves, pp.amount_usd, pp.exchange_rate,
              pp.reference_number, pp.notes, pp.created_at,
              pi.invoice_number
       FROM purchase_payments pp
       INNER JOIN purchase_invoices pi ON pp.invoice_id = pi.id
       INNER JOIN branches b ON pi.branch_id = b.id
       WHERE pi.supplier_id = ? AND b.company_id = ?
       ORDER BY pp.created_at DESC`,
      [id, companyId]
    );

    return {
      supplier,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        controlNumber: inv.control_number,
        invoiceDate: inv.invoice_date,
        totalAmount: Number(inv.total_amount),
        status: inv.status,
        isCredit: Boolean(inv.is_credit),
        branchName: inv.branch_name,
        payableId: inv.payable_id,
        amountPaid: inv.amount_paid ? Number(inv.amount_paid) : 0,
        amountBalance: inv.amount_balance !== null ? Number(inv.amount_balance) : 0,
        dueDate: inv.due_date,
        daysOverdue: inv.days_overdue ? Number(inv.days_overdue) : 0,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        method: p.method,
        amountVes: Number(p.amount_ves),
        amountUsd: Number(p.amount_usd),
        exchangeRate: Number(p.exchange_rate),
        referenceNumber: p.reference_number,
        notes: p.notes,
        createdAt: p.created_at,
        invoiceNumber: p.invoice_number,
      })),
    };
  }
}
