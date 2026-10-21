import { query } from '../../db';
import { CustomerInput } from '@ero/shared';
import crypto from 'crypto';

export class CustomersService {
  static async getCustomers(companyId: string, search?: string, filter?: string) {
    let sql = `
      SELECT c.id, c.company_id, c.doc_type, c.doc_number, c.name, c.address, c.phone, c.email,
             c.is_special_taxpayer, c.credit_enabled, c.credit_limit, c.payment_terms_days,
             c.is_active, c.is_blocked, c.block_reason, c.blocked_at,
             c.rating_score, c.rating_tier, c.rating_notes, c.notes,
             COALESCE(SUM(r.amount_balance), 0) AS current_balance,
             COUNT(CASE WHEN r.status IN ('PENDING', 'PARTIAL', 'OVERDUE') THEN 1 END) AS pending_invoices_count,
             (SELECT COUNT(*) FROM sales_invoices si WHERE si.customer_id = c.id AND si.status != 'ANNULLED') AS total_invoices_count,
             (SELECT COALESCE(SUM(si.total_amount), 0) FROM sales_invoices si WHERE si.customer_id = c.id AND si.status != 'ANNULLED') AS total_invoiced_usd
      FROM customers c
      LEFT JOIN receivables r ON c.id = r.customer_id AND r.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
      WHERE c.company_id = ?
    `;
    const params: any[] = [companyId];

    if (search && search.trim()) {
      sql += ` AND (c.name LIKE ? OR c.doc_number LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (filter === 'blocked') {
      sql += ` AND c.is_blocked = 1`;
    } else if (filter === 'active') {
      sql += ` AND c.is_active = 1 AND c.is_blocked = 0`;
    } else if (filter === 'credit') {
      sql += ` AND c.credit_enabled = 1`;
    }

    sql += ` GROUP BY c.id`;

    if (filter === 'debt') {
      sql += ` HAVING current_balance > 0`;
    }

    sql += ` ORDER BY c.is_blocked DESC, c.name ASC`;

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
      isBlocked: Boolean(r.is_blocked),
      blockReason: r.block_reason,
      blockedAt: r.blocked_at,
      ratingScore: Number(r.rating_score) || 5.0,
      ratingTier: r.rating_tier || 'REGULAR',
      ratingNotes: r.rating_notes,
      notes: r.notes,
      currentBalance: Number(r.current_balance),
      pendingInvoicesCount: Number(r.pending_invoices_count),
      totalInvoicesCount: Number(r.total_invoices_count || 0),
      totalInvoicedUSD: Number(r.total_invoiced_usd || 0),
    }));
  }

  static async getCustomerById(id: string, companyId: string) {
    const rows = await query<any>(
      `SELECT c.*,
              COALESCE(SUM(r.amount_balance), 0) AS current_balance,
              COUNT(CASE WHEN r.status IN ('PENDING', 'PARTIAL', 'OVERDUE') THEN 1 END) AS pending_invoices_count
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
      isBlocked: Boolean(r.is_blocked),
      blockReason: r.block_reason,
      blockedAt: r.blocked_at,
      ratingScore: Number(r.rating_score) || 5.0,
      ratingTier: r.rating_tier || 'REGULAR',
      ratingNotes: r.rating_notes,
      notes: r.notes,
      currentBalance: Number(r.current_balance),
      pendingInvoicesCount: Number(r.pending_invoices_count || 0),
      availableCredit: Number(r.credit_limit) - Number(r.current_balance),
    };
  }

  static async createCustomer(companyId: string, data: CustomerInput) {
    const id = crypto.randomUUID();

    await query(
      `INSERT INTO customers (
        id, company_id, doc_type, doc_number, name, address, phone, email,
        is_special_taxpayer, credit_enabled, credit_limit, payment_terms_days,
        is_active, is_blocked, block_reason, blocked_at,
        rating_score, rating_tier, rating_notes, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        data.isBlocked ? 1 : 0,
        data.isBlocked ? (data.blockReason || 'Bloqueado al registrar') : null,
        data.isBlocked ? new Date() : null,
        data.ratingScore !== undefined ? data.ratingScore : 5.0,
        data.ratingTier || 'REGULAR',
        data.ratingNotes || null,
        data.notes || null,
      ]
    );

    return this.getCustomerById(id, companyId);
  }

  static async updateCustomer(id: string, companyId: string, data: Partial<CustomerInput>) {
    // Verificar estado previo para gestionar timestamp de bloqueo
    const existing = await this.getCustomerById(id, companyId);

    let isBlockedVal = existing.isBlocked;
    let blockReasonVal = existing.blockReason;
    let blockedAtVal = existing.blockedAt ? new Date(existing.blockedAt) : null;

    if (data.isBlocked !== undefined) {
      isBlockedVal = Boolean(data.isBlocked);
      if (isBlockedVal) {
        blockReasonVal = data.blockReason?.trim() || existing.blockReason || 'Bloqueado por administración';
        blockedAtVal = existing.blockedAt ? new Date(existing.blockedAt) : new Date();
      } else {
        blockReasonVal = null;
        blockedAtVal = null;
      }
    } else if (data.blockReason !== undefined && isBlockedVal) {
      blockReasonVal = data.blockReason?.trim() || null;
    }

    await query(
      `UPDATE customers SET
        doc_type = COALESCE(?, doc_type),
        doc_number = COALESCE(?, doc_number),
        name = COALESCE(?, name),
        address = ?,
        phone = ?,
        email = ?,
        is_special_taxpayer = COALESCE(?, is_special_taxpayer),
        credit_enabled = COALESCE(?, credit_enabled),
        credit_limit = COALESCE(?, credit_limit),
        payment_terms_days = COALESCE(?, payment_terms_days),
        is_active = COALESCE(?, is_active),
        is_blocked = ?,
        block_reason = ?,
        blocked_at = ?,
        rating_score = COALESCE(?, rating_score),
        rating_tier = COALESCE(?, rating_tier),
        rating_notes = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ? AND company_id = ?`,
      [
        data.docType,
        data.docNumber,
        data.name,
        data.address !== undefined ? data.address : existing.address,
        data.phone !== undefined ? data.phone : existing.phone,
        data.email !== undefined ? data.email : existing.email,
        data.isSpecialTaxpayer !== undefined ? (data.isSpecialTaxpayer ? 1 : 0) : null,
        data.creditEnabled !== undefined ? (data.creditEnabled ? 1 : 0) : null,
        data.creditLimit !== undefined ? data.creditLimit : null,
        data.paymentTermsDays !== undefined ? data.paymentTermsDays : null,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : null,
        isBlockedVal ? 1 : 0,
        blockReasonVal,
        blockedAtVal,
        data.ratingScore !== undefined ? data.ratingScore : null,
        data.ratingTier !== undefined ? data.ratingTier : null,
        data.ratingNotes !== undefined ? data.ratingNotes : existing.ratingNotes,
        data.notes !== undefined ? data.notes : existing.notes,
        id,
        companyId,
      ]
    );

    return this.getCustomerById(id, companyId);
  }

  static async blockCustomer(id: string, companyId: string, isBlocked: boolean, blockReason?: string | null) {
    const reason = isBlocked ? (blockReason?.trim() || 'Bloqueado por administración') : null;
    const blockedAt = isBlocked ? new Date() : null;

    await query(
      `UPDATE customers SET
         is_blocked = ?,
         block_reason = ?,
         blocked_at = ?,
         updated_at = NOW()
       WHERE id = ? AND company_id = ?`,
      [isBlocked ? 1 : 0, reason, blockedAt, id, companyId]
    );

    return this.getCustomerById(id, companyId);
  }

  static async rateCustomer(id: string, companyId: string, ratingScore: number, ratingTier: string, ratingNotes?: string | null) {
    await query(
      `UPDATE customers SET
         rating_score = ?,
         rating_tier = ?,
         rating_notes = ?,
         updated_at = NOW()
       WHERE id = ? AND company_id = ?`,
      [ratingScore, ratingTier, ratingNotes?.trim() || null, id, companyId]
    );

    return this.getCustomerById(id, companyId);
  }

  static async getCustomerHistory(id: string, companyId: string) {
    const customer = await this.getCustomerById(id, companyId);

    // 1. Facturas de venta con sus cuentas por cobrar
    const invoices = await query<any>(
      `SELECT si.id, si.invoice_number as invoiceNumber, si.control_number as controlNumber,
              si.invoice_date as invoiceDate, si.currency,
              si.total_amount as totalAmount, si.exchange_rate as exchangeRate,
              si.status, si.is_credit as isCredit,
              r.id as receivableId, r.amount_total as amountTotal, r.amount_paid as amountPaid,
              r.amount_balance as amountBalance, r.due_date as dueDate,
              r.status as receivableStatus,
              DATEDIFF(CURRENT_DATE(), r.due_date) as daysOverdue
       FROM sales_invoices si
       LEFT JOIN receivables r ON si.id = r.invoice_id
       WHERE si.customer_id = ?
       ORDER BY si.invoice_date DESC`,
      [id]
    );

    // 2. Cotizaciones emitidas
    const quotations = await query<any>(
      `SELECT sq.id, sq.quotation_number as quotationNumber, sq.quotation_date as quotationDate,
              sq.valid_until_date as validUntilDate, sq.currency, sq.exchange_rate as exchangeRate,
              sq.total_amount as totalAmount, sq.status, sq.notes,
              (SELECT COUNT(*) FROM sales_quotation_items sqi WHERE sqi.quotation_id = sq.id) as itemsCount
       FROM sales_quotations sq
       WHERE sq.customer_id = ?
       ORDER BY sq.quotation_date DESC`,
      [id]
    );

    // 3. Notas de Entrega
    const deliveryNotes = await query<any>(
      `SELECT dn.id, dn.delivery_number as deliveryNumber, dn.delivery_date as deliveryDate,
              dn.currency, dn.exchange_rate as exchangeRate, dn.total_amount as totalAmount,
              dn.driver_name as driverName, dn.vehicle_plate as vehiclePlate, dn.status,
              (SELECT COUNT(*) FROM delivery_note_items dni WHERE dni.delivery_note_id = dn.id) as itemsCount
       FROM delivery_notes dn
       WHERE dn.customer_id = ?
       ORDER BY dn.delivery_date DESC`,
      [id]
    );

    // 4. Pagos registrados a través de facturas
    const payments = await query<any>(
      `SELECT sp.id, sp.invoice_id as invoiceId, sp.method, sp.amount_usd as amountUSD,
              sp.amount_ves as amountVES, sp.exchange_rate as exchangeRate,
              sp.reference_number as referenceNumber, sp.created_at as createdAt,
              si.invoice_number as invoiceNumber,
              b.name as bankName, ba.account_number as bankAccountNumber
       FROM sales_payments sp
       INNER JOIN sales_invoices si ON sp.invoice_id = si.id
       LEFT JOIN bank_accounts ba ON sp.bank_account_id = ba.id
       LEFT JOIN banks b ON ba.bank_id = b.id
       WHERE si.customer_id = ?
       ORDER BY sp.created_at DESC`,
      [id]
    );

    // 5. Notas de Crédito y Débito
    const notes = await query<any>(
      `SELECT cn.id, cn.type, cn.note_number as noteNumber, cn.control_number as controlNumber,
              cn.issue_date as issueDate, cn.due_date as dueDate,
              cn.reason_type as reasonType, cn.reason_description as reasonDescription,
              cn.currency, cn.exchange_rate as exchangeRate,
              cn.total_amount as totalAmount, cn.amount_applied as amountApplied,
              cn.amount_balance as amountBalance, cn.status,
              si.invoice_number as affectedInvoiceNumber
       FROM customer_notes cn
       LEFT JOIN sales_invoices si ON cn.affected_invoice_id = si.id
       WHERE cn.customer_id = ?
       ORDER BY cn.issue_date DESC`,
      [id]
    );

    // Cálculos estadísticos y KPIs comerciales
    let totalInvoicedUSD = 0;
    let totalPaidUSD = 0;
    let totalOverdueUSD = 0;
    let overdueCount = 0;
    let paidInvoicesCount = 0;

    invoices.forEach((inv: any) => {
      const amt = Number(inv.totalAmount) || 0;
      if (inv.status !== 'ANNULLED') {
        totalInvoicedUSD += amt;
      }
      if (inv.status === 'PAID') {
        paidInvoicesCount++;
        totalPaidUSD += amt;
      } else if (inv.receivableId) {
        const bal = Number(inv.amountBalance) || 0;
        const paid = Number(inv.amountPaid) || 0;
        totalPaidUSD += paid;
        if (Number(inv.daysOverdue) > 0 && bal > 0) {
          totalOverdueUSD += bal;
          overdueCount++;
        }
      }
    });

    const activeInvoicesCount = invoices.filter((inv: any) => inv.status !== 'ANNULLED').length;
    const punctualityRate = activeInvoicesCount > 0
      ? Math.max(0, Math.round(((activeInvoicesCount - overdueCount) / activeInvoicesCount) * 100))
      : 100;

    // Sugerencia de calificación automatizada basada en historial de pagos y volumen
    let suggestedScore = 5.0;
    let suggestedTier: 'VIP' | 'EXCELLENT' | 'REGULAR' | 'RISKY' | 'MOROSO' = 'REGULAR';
    let suggestedReason = 'Cliente al día';

    if (customer.isBlocked) {
      suggestedScore = 1.0;
      suggestedTier = 'MOROSO';
      suggestedReason = `Cliente bloqueado: ${customer.blockReason || 'Restringido'}`;
    } else if (overdueCount > 0 || totalOverdueUSD > 0) {
      if (totalOverdueUSD > 500 || overdueCount >= 3) {
        suggestedScore = 1.5;
        suggestedTier = 'MOROSO';
        suggestedReason = `${overdueCount} factura(s) con mora vencida ($${totalOverdueUSD.toFixed(2)})`;
      } else {
        suggestedScore = 2.5;
        suggestedTier = 'RISKY';
        suggestedReason = `Retrasos de pago activos por $${totalOverdueUSD.toFixed(2)}`;
      }
    } else if (totalInvoicedUSD >= 1000 && punctualityRate >= 95) {
      suggestedScore = 5.0;
      suggestedTier = 'VIP';
      suggestedReason = 'Alto volumen de compras y 100% puntualidad de pago';
    } else if (totalInvoicedUSD >= 200 && punctualityRate >= 90) {
      suggestedScore = 4.5;
      suggestedTier = 'EXCELLENT';
      suggestedReason = 'Historial impecable y cumplimiento comercial satisfactorio';
    } else {
      suggestedScore = 3.5;
      suggestedTier = 'REGULAR';
      suggestedReason = 'Volumen moderado y sin alertas de mora';
    }

    return {
      customer,
      statistics: {
        totalInvoicedUSD: Number(totalInvoicedUSD.toFixed(2)),
        totalPaidUSD: Number(totalPaidUSD.toFixed(2)),
        currentBalanceUSD: customer.currentBalance,
        totalOverdueUSD: Number(totalOverdueUSD.toFixed(2)),
        overdueCount,
        invoicesCount: activeInvoicesCount,
        paidInvoicesCount,
        quotationsCount: quotations.length,
        deliveryNotesCount: deliveryNotes.length,
        paymentsCount: payments.length,
        punctualityRate,
        suggestedScore,
        suggestedTier,
        suggestedReason,
      },
      invoices: invoices.map((inv: any) => ({
        ...inv,
        totalAmount: Number(inv.totalAmount) || 0,
        amountTotal: inv.amountTotal !== null ? Number(inv.amountTotal) : null,
        amountPaid: inv.amountPaid !== null ? Number(inv.amountPaid) : null,
        amountBalance: inv.amountBalance !== null ? Number(inv.amountBalance) : null,
        daysOverdue: Number(inv.daysOverdue) || 0,
        isCredit: Boolean(inv.isCredit),
      })),
      quotations: quotations.map((q: any) => ({
        ...q,
        totalAmount: Number(q.totalAmount) || 0,
        exchangeRate: Number(q.exchangeRate) || 1,
        itemsCount: Number(q.itemsCount) || 0,
      })),
      deliveryNotes: deliveryNotes.map((d: any) => ({
        ...d,
        totalAmount: Number(d.totalAmount) || 0,
        exchangeRate: Number(d.exchangeRate) || 1,
        itemsCount: Number(d.itemsCount) || 0,
      })),
      payments: payments.map((p: any) => ({
        ...p,
        amountUSD: Number(p.amountUSD) || 0,
        amountVES: Number(p.amountVES) || 0,
        exchangeRate: Number(p.exchangeRate) || 1,
      })),
      notes: notes.map((n: any) => ({
        ...n,
        totalAmount: Number(n.totalAmount) || 0,
        amountApplied: Number(n.amountApplied) || 0,
        amountBalance: Number(n.amountBalance) || 0,
        exchangeRate: Number(n.exchangeRate) || 1,
      })),
    };
  }

  static async getCustomerStatement(id: string, companyId: string) {
    const history = await this.getCustomerHistory(id, companyId);
    return {
      customer: history.customer,
      invoices: history.invoices,
      notes: history.notes,
      statistics: history.statistics,
    };
  }
}
