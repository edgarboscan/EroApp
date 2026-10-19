import { query, withTransaction } from '../../db';
import { CreatePayablePaymentInput, CreatePurchaseInvoiceInput } from '@ero/shared';
import crypto from 'crypto';

export class PayablesService {
  static async getPayables(companyId: string, branchId?: string, supplierId?: string, status?: string) {
    let sql = `
      SELECT p.id, p.branch_id, b.name as branch_name,
             p.supplier_id, s.rif as supplier_rif, s.name as supplier_name,
             p.invoice_id, pi.invoice_number, pi.control_number, pi.invoice_date,
             p.amount_total, p.amount_paid, p.amount_balance, p.due_date, p.status,
             DATEDIFF(CURRENT_DATE(), p.due_date) as days_overdue
      FROM payables p
      INNER JOIN branches b ON p.branch_id = b.id
      INNER JOIN suppliers s ON p.supplier_id = s.id
      INNER JOIN purchase_invoices pi ON p.invoice_id = pi.id
      WHERE b.company_id = ?
    `;
    const params: any[] = [companyId];

    if (branchId) {
      sql += ` AND p.branch_id = ?`;
      params.push(branchId);
    }

    if (supplierId) {
      sql += ` AND p.supplier_id = ?`;
      params.push(supplierId);
    }

    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    } else {
      sql += ` AND p.status IN ('PENDING', 'PARTIAL', 'OVERDUE')`;
    }

    sql += ` ORDER BY p.due_date ASC`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      supplierId: r.supplier_id,
      supplierRif: r.supplier_rif,
      supplierName: r.supplier_name,
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number,
      controlNumber: r.control_number,
      invoiceDate: r.invoice_date,
      amountTotal: Number(r.amount_total),
      amountPaid: Number(r.amount_paid),
      amountBalance: Number(r.amount_balance),
      dueDate: r.due_date,
      status: r.status,
      daysOverdue: Number(r.days_overdue),
    }));
  }

  static async getAgingReport(companyId: string, branchId?: string) {
    let sql = `
      SELECT p.branch_id, b.name AS branch_name,
             s.id AS supplier_id, s.rif AS supplier_rif, s.name AS supplier_name,
             p.id AS payable_id, pi.invoice_number, pi.invoice_date, p.due_date,
             DATEDIFF(CURRENT_DATE(), p.due_date) AS days_overdue,
             p.amount_total, p.amount_paid, p.amount_balance,
             CASE WHEN DATEDIFF(CURRENT_DATE(), p.due_date) <= 0 THEN p.amount_balance ELSE 0 END AS current_due,
             CASE WHEN DATEDIFF(CURRENT_DATE(), p.due_date) BETWEEN 1 AND 30 THEN p.amount_balance ELSE 0 END AS days_1_30,
             CASE WHEN DATEDIFF(CURRENT_DATE(), p.due_date) BETWEEN 31 AND 60 THEN p.amount_balance ELSE 0 END AS days_31_60,
             CASE WHEN DATEDIFF(CURRENT_DATE(), p.due_date) BETWEEN 61 AND 90 THEN p.amount_balance ELSE 0 END AS days_61_90,
             CASE WHEN DATEDIFF(CURRENT_DATE(), p.due_date) > 90 THEN p.amount_balance ELSE 0 END AS days_90_plus
      FROM payables p
      INNER JOIN branches b ON p.branch_id = b.id
      INNER JOIN suppliers s ON p.supplier_id = s.id
      INNER JOIN purchase_invoices pi ON p.invoice_id = pi.id
      WHERE b.company_id = ?
        AND p.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
    `;
    const params: any[] = [companyId];

    if (branchId) {
      sql += ` AND p.branch_id = ?`;
      params.push(branchId);
    }

    sql += ` ORDER BY p.due_date ASC`;

    const rows = await query<any>(sql, params);

    let totalCurrent = 0;
    let totalDays1_30 = 0;
    let totalDays31_60 = 0;
    let totalDays61_90 = 0;
    let totalDays90Plus = 0;
    let grandTotal = 0;

    const items = rows.map((r) => {
      const cur = Number(r.current_due);
      const d1 = Number(r.days_1_30);
      const d2 = Number(r.days_31_60);
      const d3 = Number(r.days_61_90);
      const d4 = Number(r.days_90_plus);
      const bal = Number(r.amount_balance);

      totalCurrent += cur;
      totalDays1_30 += d1;
      totalDays31_60 += d2;
      totalDays61_90 += d3;
      totalDays90Plus += d4;
      grandTotal += bal;

      return {
        payableId: r.payable_id,
        branchId: r.branch_id,
        branchName: r.branch_name,
        supplierId: r.supplier_id,
        supplierRif: r.supplier_rif,
        supplierName: r.supplier_name,
        invoiceNumber: r.invoice_number,
        invoiceDate: r.invoice_date,
        dueDate: r.due_date,
        daysOverdue: Number(r.days_overdue),
        amountTotal: Number(r.amount_total),
        amountPaid: Number(r.amount_paid),
        amountBalance: bal,
        currentDue: cur,
        days1_30: d1,
        days31_60: d2,
        days61_90: d3,
        days90Plus: d4,
      };
    });

    return {
      totals: {
        current: Number(totalCurrent.toFixed(2)),
        days1_30: Number(totalDays1_30.toFixed(2)),
        days31_60: Number(totalDays31_60.toFixed(2)),
        days61_90: Number(totalDays61_90.toFixed(2)),
        days90Plus: Number(totalDays90Plus.toFixed(2)),
        grandTotal: Number(grandTotal.toFixed(2)),
      },
      items,
    };
  }

  static async registerPayment(companyId: string, userId: string, data: CreatePayablePaymentInput) {
    const rows = await query<any>(
      `SELECT p.*, pi.id as invoice_id, pi.invoice_number, b.company_id
       FROM payables p
       INNER JOIN branches b ON p.branch_id = b.id
       INNER JOIN purchase_invoices pi ON p.invoice_id = pi.id
       WHERE p.id = ? AND b.company_id = ?`,
      [data.payableId, companyId]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Cuenta por pagar no encontrada');
    }

    const payable = rows[0];
    const currentBalance = Number(payable.amount_balance);

    if (currentBalance <= 0) {
      throw new Error('Esta cuenta por pagar ya se encuentra totalmente saldada');
    }

    // Convert amount to USD if paid in VES
    const paymentAmountUsd =
      data.currency === 'USD' ? data.amount : Number((data.amount / data.exchangeRate).toFixed(2));
    const paymentAmountVes =
      data.currency === 'VES' ? data.amount : Number((data.amount * data.exchangeRate).toFixed(2));

    if (paymentAmountUsd > currentBalance + 0.01) {
      throw new Error(
        `El monto a pagar ($${paymentAmountUsd.toFixed(2)}) supera el saldo pendiente ($${currentBalance.toFixed(2)})`
      );
    }

    const newAmountPaid = Number((Number(payable.amount_paid) + paymentAmountUsd).toFixed(2));
    const newBalance = Number((Number(payable.amount_total) - newAmountPaid).toFixed(2));
    const newStatus = newBalance <= 0.009 ? 'PAID' : 'PARTIAL';

    return await withTransaction(async (conn) => {
      // 1. Update payable
      await conn.query(
        `UPDATE payables SET amount_paid = ?, status = ? WHERE id = ?`,
        [newAmountPaid, newStatus, payable.id]
      );

      // 2. Insert into purchase_payments
      const paymentId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO purchase_payments (
          id, invoice_id, payable_id, method, amount_ves, amount_usd,
          exchange_rate, reference_number, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          payable.invoice_id,
          payable.id,
          data.paymentMethod,
          paymentAmountVes,
          paymentAmountUsd,
          data.exchangeRate,
          data.referenceNumber || null,
          data.notes || null,
        ]
      );

      // 3. If fully paid, check if all payables for this purchase invoice are paid
      if (newStatus === 'PAID') {
        const [pendingRows] = (await conn.query(
          `SELECT COUNT(*) as count FROM payables WHERE invoice_id = ? AND status <> 'PAID'`,
          [payable.invoice_id]
        )) as any;

        if (pendingRows[0].count === 0) {
          await conn.query(
            `UPDATE purchase_invoices SET status = 'PAID' WHERE id = ?`,
            [payable.invoice_id]
          );
        }
      }

      return {
        paymentId,
        payableId: payable.id,
        invoiceNumber: payable.invoice_number,
        amountPaid: paymentAmountUsd,
        currency: data.currency,
        amountInCurrency: data.amount,
        remainingBalance: Math.max(0, newBalance),
        status: newStatus,
      };
    });
  }

  static async createPurchaseInvoice(companyId: string, userId: string, data: CreatePurchaseInvoiceInput) {
    const invoiceId = crypto.randomUUID();

    // Verify branch belongs to company
    const branchRows = await query<any>(
      `SELECT id FROM branches WHERE id = ? AND company_id = ?`,
      [data.branchId, companyId]
    );
    if (!branchRows || branchRows.length === 0) {
      throw new Error('Sucursal inválida');
    }

    // Verify supplier belongs to company
    const supRows = await query<any>(
      `SELECT id, name FROM suppliers WHERE id = ? AND company_id = ?`,
      [data.supplierId, companyId]
    );
    if (!supRows || supRows.length === 0) {
      throw new Error('Proveedor no encontrado');
    }

    // Calculate totals
    let baseTaxable = 0;
    let baseExempt = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    const calculatedItems = data.items.map((item) => {
      const subtotal = Number((item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100)).toFixed(2));
      const itemTax = item.taxRate > 0 ? Number(((subtotal * item.taxRate) / 100).toFixed(2)) : 0;
      const itemTotal = Number((subtotal + itemTax).toFixed(2));

      if (item.taxRate > 0) {
        baseTaxable += subtotal;
        taxAmount += itemTax;
      } else {
        baseExempt += subtotal;
      }
      totalAmount += itemTotal;

      return {
        ...item,
        subtotal,
        taxAmount: itemTax,
        total: itemTotal,
      };
    });

    const status = data.isCredit ? 'PENDING' : 'PAID';

    return await withTransaction(async (conn) => {
      // 1. Insert purchase invoice
      await conn.query(
        `INSERT INTO purchase_invoices (
          id, branch_id, warehouse_id, supplier_id, user_id, invoice_number, control_number,
          invoice_date, currency, exchange_rate, base_exempt_amount, base_taxable_amount,
          tax_amount, total_amount, is_credit, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          data.branchId,
          data.warehouseId,
          data.supplierId,
          userId,
          data.invoiceNumber,
          data.controlNumber || null,
          data.invoiceDate,
          data.currency,
          data.exchangeRate,
          baseExempt,
          baseTaxable,
          taxAmount,
          totalAmount,
          data.isCredit ? 1 : 0,
          status,
        ]
      );

      // 2. Insert items
      for (const item of calculatedItems) {
        await conn.query(
          `INSERT INTO purchase_invoice_items (
            id, invoice_id, product_id, quantity, unit_price, tax_rate, discount_percent, tax_amount, subtotal, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            invoiceId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.taxRate,
            item.discountPercent,
            item.taxAmount,
            item.subtotal,
            item.total,
          ]
        );
      }

      // 3. If credit, register payable
      let payableId = null;
      if (data.isCredit) {
        payableId = crypto.randomUUID();
        const days = data.paymentTermsDays || 15;
        await conn.query(
          `INSERT INTO payables (
            id, branch_id, supplier_id, invoice_id, amount_total, amount_paid, due_date, status
          ) VALUES (?, ?, ?, ?, ?, 0.00, DATE_ADD(?, INTERVAL ? DAY), 'PENDING')`,
          [
            payableId,
            data.branchId,
            data.supplierId,
            invoiceId,
            totalAmount,
            data.invoiceDate,
            days,
          ]
        );
      }

      return {
        id: invoiceId,
        invoiceNumber: data.invoiceNumber,
        totalAmount,
        isCredit: data.isCredit,
        payableId,
        status,
      };
    });
  }

  /**
   * Obtiene los datos detallados de un pago a proveedor para emisión de Comprobante / Recibo de Pago
   */
  static async getPaymentById(companyId: string, paymentId: string) {
    const rows = await query<any>(
      `SELECT pp.*, pi.invoice_number, pi.total_amount_usd as invoice_total_usd,
              s.name as supplier_name, s.rif as supplier_rif,
              s.phone as supplier_phone, s.fiscal_address as supplier_address,
              p.amount_total, p.amount_paid as current_amount_paid,
              COALESCE(bnk.name, ba.description) as bank_name
       FROM purchase_payments pp
       INNER JOIN purchase_invoices pi ON pp.invoice_id = pi.id
       INNER JOIN suppliers s ON pi.supplier_id = s.id
       INNER JOIN branches b ON pi.branch_id = b.id
       LEFT JOIN payables p ON pp.payable_id = p.id
       LEFT JOIN bank_movements bm ON bm.reference_number = pp.reference_number AND bm.movement_type = 'WITHDRAWAL'
       LEFT JOIN bank_accounts ba ON bm.account_id = ba.id
       LEFT JOIN banks bnk ON ba.bank_id = bnk.id
       WHERE pp.id = ? AND b.company_id = ?`,
      [paymentId, companyId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const remainingBalance = row.amount_total ? Math.max(0, Number(row.amount_total) - Number(row.current_amount_paid)) : 0;

    return {
      receiptNumber: `PAG-${row.id.slice(0, 8).toUpperCase()}`,
      date: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      supplierName: row.supplier_name,
      supplierRif: row.supplier_rif,
      supplierPhone: row.supplier_phone || undefined,
      supplierAddress: row.supplier_address || undefined,
      invoiceNumber: row.invoice_number,
      invoiceTotalUSD: Number(row.invoice_total_usd || row.amount_total || 0),
      amountPaidUSD: Number(row.amount_usd || 0),
      amountPaidVES: Number(row.amount_ves || 0),
      remainingBalanceUSD: Number(remainingBalance.toFixed(2)),
      paymentMethod: row.method,
      referenceNumber: row.reference_number || undefined,
      bankName: row.bank_name || undefined,
      notes: row.notes || undefined,
      exchangeRate: Number(row.exchange_rate || 1),
    };
  }
}
