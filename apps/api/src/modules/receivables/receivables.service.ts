import { query, withTransaction } from '../../db';
import { CreateCollectionInput } from '@ero/shared';
import crypto from 'crypto';

export class ReceivablesService {
  static async getReceivables(companyId: string, branchId?: string, customerId?: string, status?: string) {
    let sql = `
      SELECT r.id, r.branch_id, b.name as branch_name,
             r.customer_id, c.doc_type, c.doc_number, c.name as customer_name,
             r.invoice_id, si.invoice_number, si.control_number, si.invoice_date,
             r.amount_total, r.amount_paid, r.amount_balance, r.due_date, r.status,
             DATEDIFF(CURRENT_DATE(), r.due_date) as days_overdue
      FROM receivables r
      INNER JOIN branches b ON r.branch_id = b.id
      INNER JOIN customers c ON r.customer_id = c.id
      INNER JOIN sales_invoices si ON r.invoice_id = si.id
      WHERE b.company_id = ?
    `;
    const params: any[] = [companyId];

    if (branchId) {
      sql += ` AND r.branch_id = ?`;
      params.push(branchId);
    }

    if (customerId) {
      sql += ` AND r.customer_id = ?`;
      params.push(customerId);
    }

    if (status) {
      sql += ` AND r.status = ?`;
      params.push(status);
    } else {
      sql += ` AND r.status IN ('PENDING', 'PARTIAL', 'OVERDUE')`;
    }

    sql += ` ORDER BY r.due_date ASC`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      customerId: r.customer_id,
      customerDoc: `${r.doc_type}-${r.doc_number}`,
      customerName: r.customer_name,
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
      SELECT r.branch_id, b.name AS branch_name,
             c.id AS customer_id, c.doc_type, c.doc_number, c.name AS customer_name,
             r.id AS receivable_id, si.invoice_number, si.invoice_date, r.due_date,
             DATEDIFF(CURRENT_DATE(), r.due_date) AS days_overdue,
             r.amount_total, r.amount_paid, r.amount_balance,
             CASE WHEN DATEDIFF(CURRENT_DATE(), r.due_date) <= 0 THEN r.amount_balance ELSE 0 END AS current_due,
             CASE WHEN DATEDIFF(CURRENT_DATE(), r.due_date) BETWEEN 1 AND 30 THEN r.amount_balance ELSE 0 END AS days_1_30,
             CASE WHEN DATEDIFF(CURRENT_DATE(), r.due_date) BETWEEN 31 AND 60 THEN r.amount_balance ELSE 0 END AS days_31_60,
             CASE WHEN DATEDIFF(CURRENT_DATE(), r.due_date) BETWEEN 61 AND 90 THEN r.amount_balance ELSE 0 END AS days_61_90,
             CASE WHEN DATEDIFF(CURRENT_DATE(), r.due_date) > 90 THEN r.amount_balance ELSE 0 END AS days_90_plus
      FROM receivables r
      INNER JOIN branches b ON r.branch_id = b.id
      INNER JOIN customers c ON r.customer_id = c.id
      INNER JOIN sales_invoices si ON r.invoice_id = si.id
      WHERE b.company_id = ?
        AND r.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
    `;
    const params: any[] = [companyId];

    if (branchId) {
      sql += ` AND r.branch_id = ?`;
      params.push(branchId);
    }

    sql += ` ORDER BY r.due_date ASC`;

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
        receivableId: r.receivable_id,
        branchId: r.branch_id,
        branchName: r.branch_name,
        customerId: r.customer_id,
        customerDoc: `${r.doc_type}-${r.doc_number}`,
        customerName: r.customer_name,
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
      summary: {
        totalCurrent,
        totalDays1_30,
        totalDays31_60,
        totalDays61_90,
        totalDays90Plus,
        grandTotal,
        invoicesCount: items.length,
      },
      items,
    };
  }

  static async registerCollection(companyId: string, _userId: string, data: CreateCollectionInput) {
    return withTransaction(async (conn) => {
      // 1. Obtener la cuenta por cobrar
      const [receivables] = await conn.query(
        `SELECT r.*, si.branch_id, si.customer_id, si.invoice_number, c.name as customer_name
         FROM receivables r
         INNER JOIN sales_invoices si ON r.invoice_id = si.id
         INNER JOIN customers c ON r.customer_id = c.id
         INNER JOIN branches b ON r.branch_id = b.id
         WHERE r.id = ? AND b.company_id = ? FOR UPDATE`,
        [data.receivableId, companyId]
      );

      const recList = receivables as any[];
      if (!recList || recList.length === 0) {
        throw new Error('Cuenta por cobrar no encontrada');
      }

      const rec = recList[0];
      const balance = Number(rec.amount_total) - Number(rec.amount_paid);

      if (data.amount > balance + 0.01) {
        throw new Error(`El monto a cobrar (${data.amount}$) no puede superar el saldo pendiente (${balance.toFixed(2)}$)`);
      }

      const newAmountPaid = Number(rec.amount_paid) + data.amount;
      const isPaidInFull = newAmountPaid >= Number(rec.amount_total) - 0.001;
      const newStatus = isPaidInFull ? 'PAID' : 'PARTIAL';

      // 2. Actualizar receivables
      await conn.query(
        `UPDATE receivables
         SET amount_paid = ?, status = ?, updated_at = NOW()
         WHERE id = ?`,
        [newAmountPaid, newStatus, rec.id]
      );

      // 3. Registrar en sales_payments
      const paymentId = crypto.randomUUID();
      const amountUSD = data.currency === 'USD' ? data.amount : data.amount / data.exchangeRate;
      const amountVES = data.currency === 'VES' ? data.amount : data.amount * data.exchangeRate;

      await conn.query(
        `INSERT INTO sales_payments (
          id, invoice_id, method, amount_ves, amount_usd, exchange_rate,
          applies_igtf, reference_number, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW())`,
        [
          paymentId,
          rec.invoice_id,
          data.paymentMethod,
          amountVES,
          amountUSD,
          data.exchangeRate,
          data.referenceNumber || null,
        ]
      );

      // 3.1 Si se especificó cuenta bancaria de destino, reflejar en tesorería
      let bankMovementId: string | null = null;
      if (data.bankAccountId) {
        const [accRows]: any = await conn.query(
          `SELECT id, currency, current_balance FROM bank_accounts WHERE id = ? AND company_id = ? FOR UPDATE`,
          [data.bankAccountId, companyId]
        );
        if (accRows && accRows.length > 0) {
          const acc = accRows[0];
          const depositAmount = acc.currency === 'VES' ? Number(amountVES.toFixed(2)) : Number(amountUSD.toFixed(2));
          const newBal = Number((Number(acc.current_balance) + depositAmount).toFixed(2));
          await conn.query(
            `UPDATE bank_accounts SET current_balance = ? WHERE id = ?`,
            [newBal, acc.id]
          );

          bankMovementId = crypto.randomUUID();
          await conn.query(
            `INSERT INTO bank_movements (
              id, account_id, user_id, movement_type, amount, balance_after,
              movement_date, reference_number, concept, is_reconciled
            ) VALUES (?, ?, ?, 'DEPOSIT', ?, ?, NOW(), ?, ?, 0)`,
            [
              bankMovementId,
              acc.id,
              _userId,
              depositAmount,
              newBal,
              data.referenceNumber || null,
              `Cobro CxC Factura ${rec.invoice_number || rec.id.slice(0, 8)} - ${rec.customer_name} (${data.paymentMethod})`,
            ]
          );
        }
      }

      // 4. Si la factura se saldó por completo, actualizar sales_invoices.status
      if (isPaidInFull) {
        await conn.query(
          `UPDATE sales_invoices SET status = 'PAID' WHERE id = ?`,
          [rec.invoice_id]
        );
      }

      return {
        paymentId,
        receivableId: rec.id,
        invoiceId: rec.invoice_id,
        amountPaid: data.amount,
        remainingBalance: Math.max(0, balance - data.amount),
        status: newStatus,
        isPaidInFull,
        bankMovementId,
      };
    });
  }
}
