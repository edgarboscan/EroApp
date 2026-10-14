import { query } from '../../db';
import { CustomerInput } from '@ero/shared';
import crypto from 'crypto';

export class CustomersService {
  static async getCustomers(companyId: string, search?: string) {
    let sql = `
      SELECT c.id, c.company_id, c.doc_type, c.doc_number, c.name, c.address, c.phone, c.email,
             c.is_special_taxpayer, c.credit_enabled, c.credit_limit, c.payment_terms_days, c.is_active,
             COALESCE(SUM(r.amount_balance), 0) AS current_balance,
             COUNT(CASE WHEN r.status IN ('PENDING', 'PARTIAL', 'OVERDUE') THEN 1 END) AS pending_invoices_count
      FROM customers c
      LEFT JOIN receivables r ON c.id = r.customer_id AND r.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
      WHERE c.company_id = ?
    `;
    const params: any[] = [companyId];

    if (search && search.trim()) {
      sql += ` AND (c.name LIKE ? OR c.doc_number LIKE ? OR c.email LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` GROUP BY c.id ORDER BY c.name ASC`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      docType: r.doc_type,
      docNumber: r.doc_number,
      name: r.name,
      address: r.address,
      phone: r.phone,
      email: r.email,
      isSpecialTaxpayer: Boolean(r.is_special_taxpayer),
      creditEnabled: Boolean(r.credit_enabled),
      creditLimit: Number(r.credit_limit),
      paymentTermsDays: Number(r.payment_terms_days),
      isActive: Boolean(r.is_active),
      currentBalance: Number(r.current_balance),
      pendingInvoicesCount: Number(r.pending_invoices_count),
    }));
  }

  static async getCustomerById(id: string, companyId: string) {
    const rows = await query<any>(
      `SELECT c.*,
              COALESCE(SUM(r.amount_balance), 0) AS current_balance
       FROM customers c
       LEFT JOIN receivables r ON c.id = r.customer_id AND r.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
       WHERE c.id = ? AND c.company_id = ?
       GROUP BY c.id`,
      [id, companyId]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Cliente no encontrado');
    }

    const r = rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      docType: r.doc_type,
      docNumber: r.doc_number,
      name: r.name,
      address: r.address,
      phone: r.phone,
      email: r.email,
      isSpecialTaxpayer: Boolean(r.is_special_taxpayer),
      creditEnabled: Boolean(r.credit_enabled),
      creditLimit: Number(r.credit_limit),
      paymentTermsDays: Number(r.payment_terms_days),
      isActive: Boolean(r.is_active),
      currentBalance: Number(r.current_balance),
      availableCredit: Number(r.credit_limit) - Number(r.current_balance),
    };
  }

  static async createCustomer(companyId: string, data: CustomerInput) {
    const id = crypto.randomUUID();

    await query(
      `INSERT INTO customers (
        id, company_id, doc_type, doc_number, name, address, phone, email,
        is_special_taxpayer, credit_enabled, credit_limit, payment_terms_days, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.docType,
        data.docNumber,
        data.name,
        data.address || null,
        data.phone || null,
        data.email || null,
        data.isSpecialTaxpayer ? 1 : 0,
        data.creditEnabled ? 1 : 0,
        data.creditLimit || 0,
        data.paymentTermsDays || 0,
        data.isActive !== false ? 1 : 0,
      ]
    );

    return this.getCustomerById(id, companyId);
  }

  static async updateCustomer(id: string, companyId: string, data: Partial<CustomerInput>) {
    await query(
      `UPDATE customers SET
        doc_type = COALESCE(?, doc_type),
        doc_number = COALESCE(?, doc_number),
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        is_special_taxpayer = COALESCE(?, is_special_taxpayer),
        credit_enabled = COALESCE(?, credit_enabled),
        credit_limit = COALESCE(?, credit_limit),
        payment_terms_days = COALESCE(?, payment_terms_days),
        is_active = COALESCE(?, is_active),
        updated_at = NOW()
      WHERE id = ? AND company_id = ?`,
      [
        data.docType,
        data.docNumber,
        data.name,
        data.address,
        data.phone,
        data.email,
        data.isSpecialTaxpayer !== undefined ? (data.isSpecialTaxpayer ? 1 : 0) : null,
        data.creditEnabled !== undefined ? (data.creditEnabled ? 1 : 0) : null,
        data.creditLimit,
        data.paymentTermsDays,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : null,
        id,
        companyId,
      ]
    );

    return this.getCustomerById(id, companyId);
  }

  static async getCustomerStatement(id: string, companyId: string) {
    const customer = await this.getCustomerById(id, companyId);

    const invoices = await query<any>(
      `SELECT si.id, si.invoice_number, si.control_number, si.invoice_date, si.currency,
              si.total_amount, si.status, si.is_credit,
              r.id as receivable_id, r.amount_total, r.amount_paid, r.amount_balance,
              r.due_date, r.status as receivable_status,
              DATEDIFF(CURRENT_DATE(), r.due_date) as days_overdue
       FROM sales_invoices si
       LEFT JOIN receivables r ON si.id = r.invoice_id
       WHERE si.customer_id = ?
       ORDER BY si.invoice_date DESC`,
      [id]
    );

    return {
      customer,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        controlNumber: inv.control_number,
        invoiceDate: inv.invoice_date,
        currency: inv.currency,
        totalAmount: Number(inv.total_amount),
        status: inv.status,
        isCredit: Boolean(inv.is_credit),
        receivable: inv.receivable_id
          ? {
              id: inv.receivable_id,
              amountTotal: Number(inv.amount_total),
              amountPaid: Number(inv.amount_paid),
              amountBalance: Number(inv.amount_balance),
              dueDate: inv.due_date,
              status: inv.receivable_status,
              daysOverdue: Number(inv.days_overdue),
            }
          : null,
      })),
    };
  }
}
