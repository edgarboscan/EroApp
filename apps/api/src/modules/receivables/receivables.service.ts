import { query, withTransaction } from '../../db';
import { CreateCollectionInput } from '@ero/shared';
import crypto from 'crypto';

export class ReceivablesService {
  static async getReceivables(companyId: string, branchId?: string, customerId?: string, status?: string) {
    let sql = `
      SELECT r.id, r.branch_id, b.name as branch_name,
             r.customer_id, c.doc_type, c.doc_number, c.name as customer_name,
             r.invoice_id, r.debit_note_id, r.document_type,
             COALESCE(si.invoice_number, cn.note_number, r.id) as invoice_number,
             COALESCE(si.control_number, cn.control_number) as control_number,
             COALESCE(si.invoice_date, cn.issue_date, r.created_at) as invoice_date,
             r.amount_total, r.amount_paid, r.amount_balance, r.due_date, r.status,
             DATEDIFF(CURRENT_DATE(), r.due_date) as days_overdue
      FROM receivables r
      INNER JOIN branches b ON r.branch_id = b.id
      INNER JOIN customers c ON r.customer_id = c.id
      LEFT JOIN sales_invoices si ON r.invoice_id = si.id
      LEFT JOIN customer_notes cn ON r.debit_note_id = cn.id
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
      debitNoteId: r.debit_note_id,
      documentType: r.document_type || (r.debit_note_id ? 'DEBIT_NOTE' : 'INVOICE'),
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
             r.id AS receivable_id, r.document_type,
             COALESCE(si.invoice_number, cn.note_number, r.id) AS invoice_number,
             COALESCE(si.invoice_date, cn.issue_date, r.created_at) AS invoice_date,
             r.due_date,
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
      LEFT JOIN sales_invoices si ON r.invoice_id = si.id
      LEFT JOIN customer_notes cn ON r.debit_note_id = cn.id
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
        documentType: r.document_type || 'INVOICE',
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

  /**
   * Obtiene todos los medios de pago configurados en base de datos para la empresa
   */
  static async getPaymentMethods(companyId: string) {
    const rows = await query<any>(
      `SELECT id, code, name, currency, type, applies_igtf, requires_reference, requires_bank_account, display_order
       FROM payment_methods
       WHERE company_id = ? AND is_active = 1
       ORDER BY display_order ASC, name ASC`,
      [companyId]
    );
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      currency: r.currency,
      type: r.type,
      appliesIGTF: Boolean(r.applies_igtf),
      requiresReference: Boolean(r.requires_reference),
      requiresBankAccount: Boolean(r.requires_bank_account),
      displayOrder: Number(r.display_order),
    }));
  }

  static async registerCollection(companyId: string, _userId: string, data: CreateCollectionInput) {
    return withTransaction(async (conn) => {
      // 1. Obtener la cuenta por cobrar (sea por factura o por nota de débito)
      const [receivables] = await conn.query(
        `SELECT r.*,
                COALESCE(si.branch_id, r.branch_id) as branch_id,
                r.customer_id,
                COALESCE(si.invoice_number, cn.note_number, r.id) as invoice_number,
                c.name as customer_name
         FROM receivables r
         INNER JOIN customers c ON r.customer_id = c.id
         INNER JOIN branches b ON r.branch_id = b.id
         LEFT JOIN sales_invoices si ON r.invoice_id = si.id
         LEFT JOIN customer_notes cn ON r.debit_note_id = cn.id
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

      // 1.1 Validar medio de pago desde la base de datos y exigencias de referencia / banco
      const [pmRows]: any = await conn.query(
        `SELECT id, code, name, currency, type, requires_reference, requires_bank_account
         FROM payment_methods
         WHERE (code = ? OR id = ?) AND company_id = ? AND is_active = 1`,
        [data.paymentMethod, data.paymentMethod, companyId]
      );
      const pm = pmRows && pmRows.length > 0 ? pmRows[0] : null;

      const isCreditNoteMethod = data.paymentMethod === 'NOTA_CREDITO' || pm?.code === 'NOTA_CREDITO';

      if (!isCreditNoteMethod) {
        const requiresRef = pm
          ? Boolean(pm.requires_reference)
          : ['PAGO_MOVIL', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'BIOPAGO', 'ZELLE'].includes(data.paymentMethod);

        if (requiresRef && (!data.referenceNumber || !data.referenceNumber.trim())) {
          throw new Error(`El medio de pago "${pm?.name || data.paymentMethod}" requiere número de referencia para su registro y conciliación bancaria`);
        }

        const requiresBank = pm
          ? Boolean(pm.requires_bank_account)
          : ['PAGO_MOVIL', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'BIOPAGO', 'ZELLE'].includes(data.paymentMethod);

        if (requiresBank && !data.bankAccountId) {
          throw new Error(`El medio de pago "${pm?.name || data.paymentMethod}" requiere seleccionar una cuenta bancaria receptora para generar el movimiento de conciliación`);
        }
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

      const paymentId = crypto.randomUUID();
      const amountUSD = data.currency === 'USD' ? data.amount : data.amount / data.exchangeRate;
      const amountVES = data.currency === 'VES' ? data.amount : data.amount * data.exchangeRate;

      // 3. Si se paga con NOTA_CREDITO: descontar de la Nota de Crédito
      if (isCreditNoteMethod) {
        // Buscar Nota de Crédito por número de referencia o buscar la nota activa del cliente
        let creditNoteId: string | null = null;
        if (data.referenceNumber && data.referenceNumber.trim()) {
          const [cnRows]: any = await conn.query(
            `SELECT id, note_number, total_amount, amount_applied, status
             FROM customer_notes
             WHERE (note_number = ? OR id = ?) AND customer_id = ? AND type = 'CREDIT' AND company_id = ?
             FOR UPDATE`,
            [data.referenceNumber.trim(), data.referenceNumber.trim(), rec.customer_id, companyId]
          );
          if (cnRows && cnRows.length > 0) {
            const cn = cnRows[0];
            const cnBal = Number(cn.total_amount) - Number(cn.amount_applied);
            if (data.amount > cnBal + 0.01) {
              throw new Error(`La Nota de Crédito ${cn.note_number} solo posee un saldo disponible de $${cnBal.toFixed(2)}`);
            }
            creditNoteId = cn.id;
            const newCnApplied = Number(cn.amount_applied) + data.amount;
            const isCnFullyApplied = newCnApplied >= Number(cn.total_amount) - 0.001;
            await conn.query(
              `UPDATE customer_notes SET amount_applied = ?, status = ? WHERE id = ?`,
              [newCnApplied, isCnFullyApplied ? 'APPLIED' : 'ACTIVE', cn.id]
            );
          }
        }

        if (creditNoteId) {
          await conn.query(
            `INSERT INTO customer_note_applications (
              id, note_id, receivable_id, user_id, amount_applied, applied_date, notes
            ) VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
            [
              crypto.randomUUID(),
              creditNoteId,
              rec.id,
              _userId,
              data.amount,
              `Cobranza CxC mediante Nota de Crédito ${data.referenceNumber}`,
            ]
          );
        }
      }

      // 4. Registrar en sales_payments (si la cuenta por cobrar está asociada a una factura)
      if (rec.invoice_id) {
        await conn.query(
          `INSERT INTO sales_payments (
            id, invoice_id, method, amount_ves, amount_usd, exchange_rate,
            applies_igtf, reference_number, bank_account_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())`,
          [
            paymentId,
            rec.invoice_id,
            pm?.code || data.paymentMethod,
            amountVES,
            amountUSD,
            data.exchangeRate,
            data.referenceNumber ? data.referenceNumber.trim() : null,
            data.bankAccountId || null,
          ]
        );
      }

      // 5. Reflejar en tesorería (bank_movements) para conciliación bancaria si usó cuenta bancaria
      let bankMovementId: string | null = null;
      if (data.bankAccountId && !isCreditNoteMethod) {
        const [accRows]: any = await conn.query(
          `SELECT id, currency, current_balance, description FROM bank_accounts WHERE id = ? AND company_id = ? FOR UPDATE`,
          [data.bankAccountId, companyId]
        );
        if (!accRows || accRows.length === 0) {
          throw new Error('La cuenta bancaria seleccionada no existe o no pertenece a la empresa');
        }

        const acc = accRows[0];
        const depositAmount = acc.currency === 'VES' ? Number(amountVES.toFixed(2)) : Number(amountUSD.toFixed(2));
        const newBal = Number((Number(acc.current_balance) + depositAmount).toFixed(2));

        await conn.query(
          `UPDATE bank_accounts SET current_balance = ?, updated_at = NOW() WHERE id = ?`,
          [newBal, acc.id]
        );

        bankMovementId = crypto.randomUUID();
        const refNumber = data.referenceNumber ? data.referenceNumber.trim() : `COB-${Date.now().toString().slice(-6)}`;
        const docLabel = rec.document_type === 'DEBIT_NOTE' ? 'Nota Débito' : 'Factura';
        const concept = `Cobranza CxC ${docLabel} ${rec.invoice_number || rec.id.slice(0, 8)} - ${rec.customer_name} (${pm?.name || data.paymentMethod})`;

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
            refNumber,
            concept,
          ]
        );
      }

      // 6. Si se saldó por completo, actualizar estado de la factura o nota de débito
      if (isPaidInFull) {
        if (rec.invoice_id) {
          await conn.query(
            `UPDATE sales_invoices SET status = 'PAID' WHERE id = ?`,
            [rec.invoice_id]
          );
        }
        if (rec.debit_note_id) {
          await conn.query(
            `UPDATE customer_notes SET status = 'APPLIED' WHERE id = ?`,
            [rec.debit_note_id]
          );
        }
      }

      return {
        paymentId,
        receivableId: rec.id,
        invoiceId: rec.invoice_id,
        debitNoteId: rec.debit_note_id,
        documentType: rec.document_type || 'INVOICE',
        amountPaid: data.amount,
        remainingBalance: Math.max(0, balance - data.amount),
        status: newStatus,
        isPaidInFull,
        bankMovementId,
      };
    });
  }

  /**
   * Obtiene los datos detallados de un cobro realizado para emisión de Recibo Oficial de Cobranza
   */
  static async getCollectionById(companyId: string, paymentId: string) {
    const rows = await query<any>(
      `SELECT sp.*, si.invoice_number, si.total_amount_usd as invoice_total_usd,
              c.name as customer_name, CONCAT(c.doc_type, '-', c.doc_number) as customer_rif,
              c.phone as customer_phone, c.address as customer_address,
              r.amount_total, r.amount_paid as current_amount_paid,
              COALESCE(bnk.name, ba.description) as bank_name
       FROM sales_payments sp
       INNER JOIN sales_invoices si ON sp.invoice_id = si.id
       INNER JOIN customers c ON si.customer_id = c.id
       INNER JOIN branches b ON si.branch_id = b.id
       LEFT JOIN receivables r ON r.invoice_id = si.id
       LEFT JOIN bank_accounts ba ON sp.bank_account_id = ba.id
       LEFT JOIN banks bnk ON ba.bank_id = bnk.id
       WHERE sp.id = ? AND b.company_id = ?`,
      [paymentId, companyId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const remainingBalance = row.amount_total ? Math.max(0, Number(row.amount_total) - Number(row.current_amount_paid)) : 0;

    return {
      receiptNumber: `REC-${row.id.slice(0, 8).toUpperCase()}`,
      date: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      customerName: row.customer_name,
      customerRif: row.customer_rif,
      customerPhone: row.customer_phone || undefined,
      customerAddress: row.customer_address || undefined,
      invoiceNumber: row.invoice_number || `FAC-${row.invoice_id.slice(0, 8)}`,
      invoiceTotalUSD: Number(row.invoice_total_usd || row.amount_total || 0),
      amountPaidUSD: Number(row.amount_usd || 0),
      amountPaidVES: Number(row.amount_ves || 0),
      remainingBalanceUSD: Number(remainingBalance.toFixed(2)),
      paymentMethod: row.method,
      referenceNumber: row.reference_number || undefined,
      bankName: row.bank_name || undefined,
      notes: undefined,
      exchangeRate: Number(row.exchange_rate || 1),
    };
  }
}
