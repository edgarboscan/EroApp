import { query } from '../../db';
import { SupplierInput } from '@ero/shared';
import crypto from 'crypto';

export class SuppliersService {
  static async getSuppliers(companyId: string, search?: string) {
    let sql = `
      SELECT s.id, s.company_id, s.rif, s.name, s.fiscal_address, s.phone, s.email,
             s.is_person_natural, s.is_resident, s.islr_concept_code, s.credit_limit,
             s.payment_terms_days, s.is_active,
             COALESCE(SUM(p.amount_balance), 0) AS current_balance,
             COUNT(CASE WHEN p.status IN ('PENDING', 'PARTIAL', 'OVERDUE') THEN 1 END) AS pending_payables_count
      FROM suppliers s
      LEFT JOIN payables p ON s.id = p.supplier_id AND p.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
      WHERE s.company_id = ?
    `;
    const params: any[] = [companyId];

    if (search && search.trim()) {
      sql += ` AND (s.name LIKE ? OR s.rif LIKE ? OR s.email LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` GROUP BY s.id ORDER BY s.name ASC`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      rif: r.rif,
      name: r.name,
      fiscalAddress: r.fiscal_address,
      phone: r.phone,
      email: r.email,
      isPersonNatural: Boolean(r.is_person_natural),
      isResident: Boolean(r.is_resident),
      islrConceptCode: r.islr_concept_code,
      creditLimit: Number(r.credit_limit || 0),
      paymentTermsDays: Number(r.payment_terms_days || 0),
      isActive: Boolean(r.is_active),
      currentBalance: Number(r.current_balance),
      pendingPayablesCount: Number(r.pending_payables_count),
    }));
  }

  static async getSupplierById(id: string, companyId: string) {
    const rows = await query<any>(
      `SELECT s.*,
              COALESCE(SUM(p.amount_balance), 0) AS current_balance
       FROM suppliers s
       LEFT JOIN payables p ON s.id = p.supplier_id AND p.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
       WHERE s.id = ? AND s.company_id = ?
       GROUP BY s.id`,
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
      fiscalAddress: r.fiscal_address,
      phone: r.phone,
      email: r.email,
      isPersonNatural: Boolean(r.is_person_natural),
      isResident: Boolean(r.is_resident),
      islrConceptCode: r.islr_concept_code,
      creditLimit: Number(r.credit_limit || 0),
      paymentTermsDays: Number(r.payment_terms_days || 0),
      isActive: Boolean(r.is_active),
      currentBalance: Number(r.current_balance),
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
        id, company_id, rif, name, fiscal_address, phone, email,
        is_person_natural, is_resident, islr_concept_code, credit_limit,
        payment_terms_days, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.rif.trim().toUpperCase(),
        data.name.trim(),
        data.fiscalAddress || null,
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
    if (data.fiscalAddress !== undefined) {
      fields.push('fiscal_address = ?');
      values.push(data.fiscalAddress || null);
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
