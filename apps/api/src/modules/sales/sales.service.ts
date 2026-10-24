import { query, withTransaction } from '../../db';
import {
  CreateQuotationInput,
  CreateDeliveryNoteInput,
  ConvertQuotationToInvoiceInput,
  ConvertDeliveryToInvoiceInput,
  isSuperAdminRole,
} from '@ero/shared';
import crypto from 'crypto';
import argon2 from 'argon2';

export class SalesService {
  // ==========================================
  // CONFIGURACIÓN & REGLAS DE FACTURACIÓN
  // ==========================================

  static async getNextInvoiceNumber(companyId: string) {
    const currentYear = new Date().getFullYear();
    const rows = await query<any>(
      `SELECT invoice_number FROM sales_invoices 
       WHERE (branch_id IN (SELECT id FROM branches WHERE company_id = ?) OR user_id IN (SELECT id FROM users WHERE company_id = ?))
         AND YEAR(invoice_date) = ?`,
      [companyId, companyId, currentYear]
    );

    const regex = new RegExp(`^FACT-${currentYear}-(\\d+)$`);
    let maxSeq = 0;
    for (const r of rows) {
      const match = String(r.invoice_number || '').match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const nextInvoiceNumber = `FACT-${currentYear}-${String(nextSeq).padStart(5, '0')}`;

    const ruleRows = await query<any>(
      `SELECT sales_invoice_mode, require_approval_credit_exceeded, enforce_credit_limit 
       FROM business_rules WHERE company_id = ?`,
      [companyId]
    );
    const rules = ruleRows[0] || {
      sales_invoice_mode: 'free_form',
      require_approval_credit_exceeded: 1,
      enforce_credit_limit: 1,
    };

    return {
      nextInvoiceNumber,
      salesInvoiceMode: rules.sales_invoice_mode || 'free_form',
      requireApprovalCreditExceeded: Boolean(rules.require_approval_credit_exceeded),
      enforceCreditLimit: Boolean(rules.enforce_credit_limit),
    };
  }

  static async getCustomerCredit(companyId: string, customerId: string) {
    const [customerRows, debtRows, ruleRows] = await Promise.all([
      query<any>(
        `SELECT id, name, doc_type, doc_number, credit_enabled, credit_limit, payment_terms_days 
         FROM customers WHERE id = ? AND company_id = ?`,
        [customerId, companyId]
      ),
      query<any>(
        `SELECT COALESCE(SUM(amount_balance), 0) as currentDebt
         FROM receivables
         WHERE customer_id = ? AND status IN ('PENDING', 'PARTIAL', 'OVERDUE')`,
        [customerId]
      ),
      query<any>(
        `SELECT sales_invoice_mode, require_approval_credit_exceeded, enforce_credit_limit 
         FROM business_rules WHERE company_id = ?`,
        [companyId]
      ),
    ]);

    if (customerRows.length === 0) {
      throw new Error('Cliente no encontrado');
    }

    const customer = customerRows[0];
    const rules = ruleRows[0] || {
      sales_invoice_mode: 'free_form',
      require_approval_credit_exceeded: 1,
      enforce_credit_limit: 1,
    };
    const creditLimit = Number(customer.credit_limit || 0);
    const currentDebt = Number(debtRows[0]?.currentDebt || 0);
    const availableCredit = Number((creditLimit - currentDebt).toFixed(2));
    const paymentTermsDays = Number(customer.payment_terms_days || 15);

    return {
      customerId: customer.id,
      customerName: customer.name,
      customerDoc: `${customer.doc_type}-${customer.doc_number}`,
      creditEnabled: Boolean(customer.credit_enabled),
      creditLimit,
      paymentTermsDays,
      currentDebt,
      availableCredit,
      salesInvoiceMode: rules.sales_invoice_mode || 'free_form',
      enforceCreditLimit: Boolean(rules.enforce_credit_limit),
      requireApprovalCreditExceeded: Boolean(rules.require_approval_credit_exceeded),
    };
  }

  static async generateInvoiceNumber(conn: any, companyId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const [rows] = await conn.execute(
      `SELECT invoice_number FROM sales_invoices 
       WHERE (branch_id IN (SELECT id FROM branches WHERE company_id = ?) OR user_id IN (SELECT id FROM users WHERE company_id = ?))
         AND YEAR(invoice_date) = ?`,
      [companyId, companyId, currentYear]
    );

    const regex = new RegExp(`^FACT-${currentYear}-(\\d+)$`);
    let maxSeq = 0;
    for (const r of rows) {
      const match = String(r.invoice_number || '').match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    return `FACT-${currentYear}-${String(nextSeq).padStart(5, '0')}`;
  }

  static async validateCreditAndApproval(
    conn: any,
    companyId: string,
    userId: string,
    customer: any,
    totalAmount: number,
    adminAuthorized?: boolean,
    supervisorApproval?: { usernameOrEmail: string; password: string; notes?: string | null } | null
  ) {
    if (!customer.credit_enabled) {
      throw new Error(`El cliente ${customer.name} no tiene crédito comercial autorizado`);
    }

    const [debtRows] = await conn.execute(
      `SELECT COALESCE(SUM(amount_balance), 0) as currentDebt
       FROM receivables
       WHERE customer_id = ? AND status IN ('PENDING', 'PARTIAL', 'OVERDUE')`,
      [customer.id]
    );
    const currentDebt = Number(debtRows[0]?.currentDebt || 0);
    const creditLimit = Number(customer.credit_limit || 0);
    const availableCredit = Number((creditLimit - currentDebt).toFixed(2));
    const isCreditExceeded = currentDebt + totalAmount > creditLimit;

    const [ruleRows] = await conn.execute(
      `SELECT enforce_credit_limit, require_approval_credit_exceeded 
       FROM business_rules WHERE company_id = ?`,
      [companyId]
    );
    const rules = ruleRows[0] || { enforce_credit_limit: 1, require_approval_credit_exceeded: 1 };

    if (isCreditExceeded && rules.enforce_credit_limit) {
      if (!rules.require_approval_credit_exceeded) {
        throw new Error(
          `Límite de crédito comercial excedido. Límite: $${creditLimit.toFixed(2)}, Deuda actual: $${currentDebt.toFixed(2)}, Disponible: $${availableCredit.toFixed(2)}, Monto a facturar: $${totalAmount.toFixed(2)}.`
        );
      }

      // Se requiere aprobación de usuario de mayor nivel
      const [currentUserRows] = await conn.execute(
        `SELECT u.id, u.full_name, r.name as role_name 
         FROM users u 
         INNER JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ?`,
        [userId]
      );
      const currentUser = currentUserRows[0];
      const isCurrentUserAdmin = currentUser && isSuperAdminRole(currentUser.role_name);

      let approvedByUserId = userId;
      let approvedByUserName = currentUser?.full_name || 'Administrador';

      if (isCurrentUserAdmin && adminAuthorized) {
        approvedByUserId = userId;
        approvedByUserName = currentUser.full_name;
      } else if (supervisorApproval) {
        const { usernameOrEmail, password } = supervisorApproval;
        const [supervisorRows] = await conn.execute(
          `SELECT u.id, u.full_name, u.password_hash, u.is_active, r.name as role_name
           FROM users u
           INNER JOIN roles r ON u.role_id = r.id
           WHERE (u.username = ? OR u.email = ?) AND u.company_id = ? AND u.is_active = 1`,
          [usernameOrEmail, usernameOrEmail, companyId]
        );

        if (supervisorRows.length === 0) {
          throw new Error('Credenciales de supervisor inválidas o usuario inactivo');
        }

        const supervisor = supervisorRows[0];
        let isPasswordValid = false;
        try {
          if (supervisor.password_hash.startsWith('$argon2')) {
            isPasswordValid = await argon2.verify(supervisor.password_hash, password);
          } else {
            isPasswordValid = supervisor.password_hash === password;
          }
        } catch {
          isPasswordValid = false;
        }

        if (!isPasswordValid) {
          throw new Error('Contraseña del supervisor incorrecta');
        }

        if (!isSuperAdminRole(supervisor.role_name)) {
          const [permRows] = await conn.execute(
            `SELECT p.action FROM role_permissions rp
             INNER JOIN permissions p ON rp.permission_id = p.id
             WHERE rp.role_id = (SELECT role_id FROM users WHERE id = ?)
               AND p.module = 'sales' AND p.action IN ('approve', 'create')`,
            [supervisor.id]
          );
          if (permRows.length === 0) {
            throw new Error('El usuario supervisor indicado no cuenta con rango suficiente para autorizar sobregiro de crédito');
          }
        }

        approvedByUserId = supervisor.id;
        approvedByUserName = supervisor.full_name;
      } else {
        throw new Error(
          `Límite de crédito excedido (Disponible: $${availableCredit.toFixed(2)}, Monto a facturar: $${totalAmount.toFixed(2)}). Se requiere autorización de un usuario supervisor o administrador.`
        );
      }

      return {
        approved: true,
        approvedByUserId,
        approvedByUserName,
        currentDebt,
        creditLimit,
        availableCredit,
        notes: supervisorApproval?.notes || 'Autorizado por administrador',
      };
    }

    return {
      approved: false,
      currentDebt,
      creditLimit,
      availableCredit,
    };
  }

  // ==========================================
  // COTIZACIONES / PRESUPUESTOS (QUOTATIONS)
  // ==========================================

  static async getQuotations(
    companyId: string,
    branchId?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
    customerId?: string,
    forDelivery?: boolean | string
  ) {
    const isForDelivery = forDelivery === true || forDelivery === 'true';

    const rows = await query<any>(
      `SELECT sq.id, sq.company_id as companyId, sq.branch_id as branchId,
              sq.customer_id as customerId, sq.user_id as userId,
              sq.quotation_number as quotationNumber, sq.quotation_date as quotationDate,
              sq.valid_until_date as validUntilDate, sq.currency,
              sq.exchange_rate as exchangeRate, sq.subtotal_amount as subtotalAmount,
              sq.tax_amount as taxAmount, sq.discount_amount as discountAmount,
              sq.total_amount as totalAmount, sq.status, sq.notes,
              sq.created_at as createdAt,
              c.name as customerName, CONCAT(c.doc_type, '-', c.doc_number) as customerDoc,
              c.credit_enabled as creditEnabled, c.credit_limit as creditLimit,
              c.payment_terms_days as paymentTermsDays,
              b.name as branchName,
              u.full_name as createdByUserName,
              (SELECT COUNT(*) FROM sales_quotation_items sqi WHERE sqi.quotation_id = sq.id) as itemsCount,
              (
                SELECT COALESCE(SUM(dn.total_amount), 0)
                FROM delivery_notes dn
                WHERE dn.quotation_id = sq.id AND dn.status != 'ANNULLED'
              ) as deliveredAmount,
              (
                SELECT COALESCE(SUM(sqi.quantity), 0)
                FROM sales_quotation_items sqi
                WHERE sqi.quotation_id = sq.id
              ) as totalQuotedQuantity,
              (
                SELECT COALESCE(SUM(dni.quantity_delivered), 0)
                FROM delivery_note_items dni
                INNER JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dn.quotation_id = sq.id AND dn.status != 'ANNULLED'
              ) as totalDeliveredQuantity,
              (
                SELECT COUNT(*)
                FROM sales_quotation_items sqi
                WHERE sqi.quotation_id = sq.id
                  AND sqi.quantity > (
                    SELECT COALESCE(SUM(dni.quantity_delivered), 0)
                    FROM delivery_note_items dni
                    INNER JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
                    WHERE dn.quotation_id = sq.id
                      AND dn.status != 'ANNULLED'
                      AND (dni.quotation_item_id = sqi.id OR dni.product_id = sqi.product_id)
                  )
              ) as pendingItemsCount,
              si.invoice_number as invoiceNumber,
              si.control_number as invoiceControlNumber,
              si.is_credit as isCredit,
              si.status as invoiceStatus,
              si.invoice_date as invoiceDate
       FROM sales_quotations sq
       INNER JOIN customers c ON sq.customer_id = c.id
       INNER JOIN branches b ON sq.branch_id = b.id
       INNER JOIN users u ON sq.user_id = u.id
       LEFT JOIN sales_invoices si ON si.quotation_id = sq.id
       WHERE sq.company_id = ?
         AND (? IS NULL OR sq.branch_id = ?)
         AND (? IS NULL OR sq.status = ?)
         AND (? IS NULL OR sq.customer_id = ?)
         AND (? IS NULL OR DATE(sq.quotation_date) >= ?)
         AND (? IS NULL OR DATE(sq.quotation_date) <= ?)
         AND (
           ? = false OR (
             sq.status = 'CONVERTED'
             AND (
               SELECT COUNT(*)
               FROM sales_quotation_items sqi
               WHERE sqi.quotation_id = sq.id
                 AND sqi.quantity > (
                   SELECT COALESCE(SUM(dni.quantity_delivered), 0)
                   FROM delivery_note_items dni
                   INNER JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
                   WHERE dn.quotation_id = sq.id
                     AND dn.status != 'ANNULLED'
                     AND (dni.quotation_item_id = sqi.id OR dni.product_id = sqi.product_id)
                 )
             ) > 0
           )
         )
       ORDER BY sq.quotation_date DESC, sq.created_at DESC`,
      [
        companyId,
        branchId || null,
        branchId || null,
        status || null,
        status || null,
        customerId || null,
        customerId || null,
        startDate || null,
        startDate || null,
        endDate || null,
        endDate || null,
        isForDelivery,
      ]
    );

    return rows.map((r: any) => {
      const quoted = Number(r.totalQuotedQuantity || 0);
      const delivered = Number(r.totalDeliveredQuantity || 0);
      const pending = Number(r.pendingItemsCount || 0);
      const isFullyDelivered = (quoted > 0 && delivered >= quoted) || (Number(r.itemsCount || 0) > 0 && pending === 0);
      return {
        ...r,
        exchangeRate: Number(r.exchangeRate) || 1,
        subtotalAmount: Number(r.subtotalAmount) || 0,
        taxAmount: Number(r.taxAmount) || 0,
        discountAmount: Number(r.discountAmount) || 0,
        totalAmount: Number(r.totalAmount) || 0,
        isFullyDelivered,
      };
    });
  }

  static async getQuotationById(companyId: string, quotationId: string) {
    const rows = await query<any>(
      `SELECT sq.id, sq.company_id as companyId, sq.branch_id as branchId,
              sq.customer_id as customerId, sq.user_id as userId,
              sq.quotation_number as quotationNumber, sq.quotation_date as quotationDate,
              sq.valid_until_date as validUntilDate, sq.currency,
              sq.exchange_rate as exchangeRate, sq.subtotal_amount as subtotalAmount,
              sq.tax_amount as taxAmount, sq.discount_amount as discountAmount,
              sq.total_amount as totalAmount, sq.status, sq.notes,
              sq.created_at as createdAt,
              c.name as customerName, CONCAT(c.doc_type, '-', c.doc_number) as customerDoc,
              c.phone as customerPhone, c.email as customerEmail, c.address as customerAddress,
              c.credit_enabled as creditEnabled, c.credit_limit as creditLimit,
              c.payment_terms_days as paymentTermsDays,
              b.name as branchName,
              u.full_name as createdByUserName
       FROM sales_quotations sq
       INNER JOIN customers c ON sq.customer_id = c.id
       INNER JOIN branches b ON sq.branch_id = b.id
       INNER JOIN users u ON sq.user_id = u.id
       WHERE sq.id = ? AND sq.company_id = ?`,
      [quotationId, companyId]
    );

    if (rows.length === 0) return null;
    const quotation = rows[0];

    const items = await query<any>(
      `SELECT sqi.id, sqi.quotation_id as quotationId, sqi.product_id as productId,
              sqi.quantity, sqi.unit_price as unitPrice, sqi.tax_rate as taxRate,
              sqi.discount_percent as discountPercent, sqi.tax_amount as taxAmount,
              sqi.subtotal, sqi.total, sqi.notes,
              p.sku as productSku, p.name as productName, p.unit_of_measure as unitOfMeasure,
              (
                SELECT COALESCE(SUM(dni.quantity_delivered), 0)
                FROM delivery_note_items dni
                INNER JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dn.quotation_id = sqi.quotation_id
                  AND dn.status != 'ANNULLED'
                  AND (dni.quotation_item_id = sqi.id OR dni.product_id = sqi.product_id)
              ) as quantityDelivered
       FROM sales_quotation_items sqi
       INNER JOIN products p ON sqi.product_id = p.id
       WHERE sqi.quotation_id = ?`,
      [quotationId]
    );

    const mappedItems = items.map((i: any) => ({
      ...i,
      quantityPending: Math.max(0, Number(i.quantity) - Number(i.quantityDelivered || 0)),
    }));

    // 3. Buscar factura asociada y sus pagos / liquidación
    const invoiceRows = await query<any>(
      `SELECT si.id as invoiceId, si.invoice_number as invoiceNumber,
              si.control_number as controlNumber, si.invoice_date as invoiceDate,
              si.is_credit as isCredit, si.status as invoiceStatus,
              si.total_amount as invoiceTotalAmount, si.currency as invoiceCurrency,
              si.exchange_rate as invoiceExchangeRate,
              w.name as warehouseName
       FROM sales_invoices si
       LEFT JOIN warehouses w ON si.warehouse_id = w.id
       WHERE si.quotation_id = ?
       ORDER BY si.invoice_date DESC
       LIMIT 1`,
      [quotationId]
    );

    let invoiceData: any = null;
    if (invoiceRows.length > 0) {
      const inv = invoiceRows[0];
      let receivableData = null;
      let paymentsData: any[] = [];

      if (inv.isCredit) {
        const recRows = await query<any>(
          `SELECT r.id, r.amount_total as amountTotal, r.amount_paid as amountPaid,
                  r.due_date as dueDate, r.status as receivableStatus
           FROM receivables r
           WHERE r.invoice_id = ?
           LIMIT 1`,
          [inv.invoiceId]
        );
        if (recRows.length > 0) receivableData = recRows[0];
      }

      const paymentRows = await query<any>(
        `SELECT sp.id, sp.method, sp.amount_ves as amountVES, sp.amount_usd as amountUSD,
                sp.exchange_rate as exchangeRate, sp.reference_number as referenceNumber,
                sp.bank_account_id as bankAccountId, sp.created_at as createdAt,
                b.name as bankName, ba.description as bankAccountDescription,
                ba.account_number as bankAccountNumber, ba.currency as bankAccountCurrency
         FROM sales_payments sp
         LEFT JOIN bank_accounts ba ON sp.bank_account_id = ba.id
         LEFT JOIN banks b ON ba.bank_id = b.id
         WHERE sp.invoice_id = ?
         ORDER BY sp.created_at ASC`,
        [inv.invoiceId]
      );
      paymentsData = paymentRows;

      invoiceData = {
        ...inv,
        isCredit: Boolean(inv.isCredit),
        receivable: receivableData,
        payments: paymentsData.map((p: any) => ({
          ...p,
          amountUSD: Number(p.amountUSD) || 0,
          amountVES: Number(p.amountVES) || 0,
          exchangeRate: Number(p.exchangeRate) || 1,
        })),
      };
    }

    return {
      ...quotation,
      exchangeRate: Number(quotation.exchangeRate) || 1,
      subtotalAmount: Number(quotation.subtotalAmount) || 0,
      taxAmount: Number(quotation.taxAmount) || 0,
      discountAmount: Number(quotation.discountAmount) || 0,
      totalAmount: Number(quotation.totalAmount) || 0,
      items: mappedItems,
      invoice: invoiceData
    };
  }

  static async createQuotation(companyId: string, userId: string, input: CreateQuotationInput) {
    return await withTransaction(async (conn) => {
      const quotationId = crypto.randomUUID();
      const currentYear = new Date().getFullYear();

      // Correlativo COT-YYYY-0001
      const [countResult] = await conn.execute<any[]>(
        `SELECT COUNT(*) as total FROM sales_quotations WHERE company_id = ? AND YEAR(quotation_date) = ?`,
        [companyId, currentYear]
      );
      const seq = Number(countResult[0]?.total || 0) + 1;
      const quotationNumber = `COT-${currentYear}-${String(seq).padStart(4, '0')}`;

      // Verificar si el cliente está bloqueado
      const [custCheck] = await conn.execute<any[]>(
        `SELECT is_blocked, block_reason FROM customers WHERE id = ? AND company_id = ?`,
        [input.customerId, companyId]
      );
      if (custCheck.length > 0 && custCheck[0].is_blocked) {
        throw new Error(`El cliente se encuentra BLOQUEADO: ${custCheck[0].block_reason || 'Consulte con administración'}`);
      }

      let subtotalAmount = 0;
      let taxAmount = 0;
      let discountAmount = 0;

      const preparedItems = input.items.map((item) => {
        const rawSubtotal = item.quantity * item.unitPrice;
        const disc = rawSubtotal * (item.discountPercent / 100);
        const itemSubtotal = Number((rawSubtotal - disc).toFixed(2));
        const itemTax = Number((itemSubtotal * (item.taxRate / 100)).toFixed(2));
        const itemTotal = Number((itemSubtotal + itemTax).toFixed(2));

        subtotalAmount += itemSubtotal;
        taxAmount += itemTax;
        discountAmount += Number(disc.toFixed(2));

        return {
          id: crypto.randomUUID(),
          quotationId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountPercent: item.discountPercent,
          taxAmount: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
          notes: item.notes || null,
        };
      });

      const totalAmount = Number((subtotalAmount + taxAmount).toFixed(2));

      await conn.execute(
        `INSERT INTO sales_quotations (
          id, company_id, branch_id, customer_id, user_id,
          quotation_number, valid_until_date, currency, exchange_rate,
          subtotal_amount, tax_amount, discount_amount, total_amount,
          status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMITTED', ?)`,
        [
          quotationId,
          companyId,
          input.branchId,
          input.customerId,
          userId,
          quotationNumber,
          input.validUntilDate,
          input.currency,
          input.exchangeRate,
          subtotalAmount,
          taxAmount,
          discountAmount,
          totalAmount,
          input.notes || null,
        ]
      );

      for (const item of preparedItems) {
        await conn.execute(
          `INSERT INTO sales_quotation_items (
            id, quotation_id, product_id, quantity, unit_price,
            tax_rate, discount_percent, tax_amount, subtotal, total, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.quotationId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.taxRate,
            item.discountPercent,
            item.taxAmount,
            item.subtotal,
            item.total,
            item.notes,
          ]
        );
      }

      return {
        id: quotationId,
        quotationNumber,
        status: 'EMITTED',
        subtotalAmount,
        taxAmount,
        totalAmount,
        itemsCount: preparedItems.length,
      };
    });
  }

  static async acceptQuotation(companyId: string, quotationId: string) {
    const rows = await query<any>(
      `SELECT id, status FROM sales_quotations WHERE id = ? AND company_id = ?`,
      [quotationId, companyId]
    );

    if (rows.length === 0) throw new Error('Cotización no encontrada');
    if (rows[0].status !== 'EMITTED' && rows[0].status !== 'DRAFT') {
      throw new Error(`No se puede aceptar una cotización en estado ${rows[0].status}`);
    }

    await query(
      `UPDATE sales_quotations SET status = 'ACCEPTED' WHERE id = ?`,
      [quotationId]
    );

    return { id: quotationId, status: 'ACCEPTED' };
  }

  // ==========================================
  // NOTAS DE ENTREGA / DESPACHOS FÍSICOS
  // ==========================================

  static async getDeliveryNotes(
    companyId: string,
    branchId?: string,
    warehouseId?: string,
    status?: string,
    customerId?: string,
    hasQuotation?: string,
    startDate?: string,
    endDate?: string
  ) {
    return await query<any>(
      `SELECT dn.id, dn.company_id as companyId, dn.branch_id as branchId,
              dn.warehouse_id as warehouseId, dn.customer_id as customerId,
              dn.quotation_id as quotationId, dn.user_id as userId,
              dn.delivery_number as deliveryNumber, dn.delivery_date as deliveryDate,
              dn.currency, dn.exchange_rate as exchangeRate,
              dn.total_amount as totalAmount, dn.driver_name as driverName,
              dn.vehicle_plate as vehiclePlate, dn.status,
              dn.sales_invoice_id as salesInvoiceId, dn.notes,
              dn.created_at as createdAt,
              c.name as customerName, CONCAT(c.doc_type, '-', c.doc_number) as customerDoc,
              w.name as warehouseName, b.name as branchName,
              u.full_name as dispatchedByUserName,
              sq.quotation_number as quotationNumber,
              sq.status as quotationStatus,
              sq.subtotal_amount as quotationSubtotalAmount,
              sq.tax_amount as quotationTaxAmount,
              sq.total_amount as quotationTotalAmount,
              (
                SELECT COALESCE(SUM(sqi.quantity), 0)
                FROM sales_quotation_items sqi
                WHERE sqi.quotation_id = sq.id
              ) as quotationTotalQuantity,
              (
                SELECT COALESCE(SUM(dni.quantity_delivered), 0)
                FROM delivery_note_items dni
                INNER JOIN delivery_notes dn2 ON dni.delivery_note_id = dn2.id
                WHERE dn2.quotation_id = sq.id AND dn2.status != 'ANNULLED'
              ) as quotationDeliveredQuantity,
              (
                SELECT COALESCE(SUM(dn2.total_amount), 0)
                FROM delivery_notes dn2
                WHERE dn2.quotation_id = dn.quotation_id AND dn2.status != 'ANNULLED'
              ) as quotationDeliveredTotal
       FROM delivery_notes dn
       INNER JOIN customers c ON dn.customer_id = c.id
       INNER JOIN warehouses w ON dn.warehouse_id = w.id
       INNER JOIN branches b ON dn.branch_id = b.id
       INNER JOIN users u ON dn.user_id = u.id
       LEFT JOIN sales_quotations sq ON dn.quotation_id = sq.id
       WHERE dn.company_id = ?
         AND (? IS NULL OR dn.branch_id = ?)
         AND (? IS NULL OR dn.warehouse_id = ?)
         AND (? IS NULL OR dn.status = ?)
         AND (? IS NULL OR dn.customer_id = ?)
         AND (
           ? IS NULL OR
           (? = 'true' AND dn.quotation_id IS NOT NULL) OR
           (? = 'false' AND dn.quotation_id IS NULL)
         )
         AND (? IS NULL OR DATE(dn.delivery_date) >= ?)
         AND (? IS NULL OR DATE(dn.delivery_date) <= ?)
       ORDER BY dn.delivery_date DESC, dn.created_at DESC`,
      [
        companyId,
        branchId || null,
        branchId || null,
        warehouseId || null,
        warehouseId || null,
        status || null,
        status || null,
        customerId || null,
        customerId || null,
        hasQuotation || null,
        hasQuotation || null,
        hasQuotation || null,
        startDate || null,
        startDate || null,
        endDate || null,
        endDate || null,
      ]
    );
  }

  static async getDeliveryNoteById(companyId: string, deliveryId: string) {
    const rows = await query<any>(
      `SELECT dn.id, dn.company_id as companyId, dn.branch_id as branchId,
              dn.warehouse_id as warehouseId, dn.customer_id as customerId,
              dn.quotation_id as quotationId, dn.user_id as userId,
              dn.delivery_number as deliveryNumber, dn.delivery_date as deliveryDate,
              dn.currency, dn.exchange_rate as exchangeRate,
              dn.total_amount as totalAmount, dn.driver_name as driverName,
              dn.vehicle_plate as vehiclePlate, dn.status,
              dn.sales_invoice_id as salesInvoiceId, dn.notes,
              dn.created_at as createdAt,
              c.name as customerName, CONCAT(c.doc_type, '-', c.doc_number) as customerDoc,
              c.phone as customerPhone, c.address as customerAddress,
              w.name as warehouseName, b.name as branchName,
              u.full_name as dispatchedByUserName,
              sq.quotation_number as quotationNumber,
              sq.status as quotationStatus,
              sq.subtotal_amount as quotationSubtotalAmount,
              sq.tax_amount as quotationTaxAmount,
              sq.total_amount as quotationTotalAmount,
              (
                SELECT COALESCE(SUM(sqi.quantity), 0)
                FROM sales_quotation_items sqi
                WHERE sqi.quotation_id = sq.id
              ) as quotationTotalQuantity,
              (
                SELECT COALESCE(SUM(dni.quantity_delivered), 0)
                FROM delivery_note_items dni
                INNER JOIN delivery_notes dn2 ON dni.delivery_note_id = dn2.id
                WHERE dn2.quotation_id = sq.id AND dn2.status != 'ANNULLED'
              ) as quotationDeliveredQuantity,
              (
                SELECT COALESCE(SUM(dn2.total_amount), 0)
                FROM delivery_notes dn2
                WHERE dn2.quotation_id = dn.quotation_id AND dn2.status != 'ANNULLED'
              ) as quotationDeliveredTotal
       FROM delivery_notes dn
       INNER JOIN customers c ON dn.customer_id = c.id
       INNER JOIN warehouses w ON dn.warehouse_id = w.id
       INNER JOIN branches b ON dn.branch_id = b.id
       INNER JOIN users u ON dn.user_id = u.id
       LEFT JOIN sales_quotations sq ON dn.quotation_id = sq.id
       WHERE dn.id = ? AND dn.company_id = ?`,
      [deliveryId, companyId]
    );

    if (rows.length === 0) return null;
    const delivery = rows[0];

    const items = await query<any>(
      `SELECT dni.id, dni.delivery_note_id as deliveryNoteId, dni.product_id as productId,
              dni.quantity_delivered as quantityDelivered, dni.unit_price as unitPrice,
              dni.unit_cost as unitCost, dni.total, dni.notes,
              p.sku as productSku, p.name as productName, p.unit_of_measure as unitOfMeasure
       FROM delivery_note_items dni
       INNER JOIN products p ON dni.product_id = p.id
       WHERE dni.delivery_note_id = ?`,
      [deliveryId]
    );

    return { ...delivery, items };
  }

  static async createDeliveryNote(companyId: string, userId: string, input: CreateDeliveryNoteInput) {
    return await withTransaction(async (conn) => {
      const deliveryId = crypto.randomUUID();
      const currentYear = new Date().getFullYear();

      // Correlativo NE-YYYY-0001
      const [countResult] = await conn.execute<any[]>(
        `SELECT COUNT(*) as total FROM delivery_notes WHERE company_id = ? AND YEAR(delivery_date) = ?`,
        [companyId, currentYear]
      );
      const seq = Number(countResult[0]?.total || 0) + 1;
      const deliveryNumber = `NE-${currentYear}-${String(seq).padStart(4, '0')}`;

      // Validar si el cliente está bloqueado
      const [custCheck] = await conn.execute<any[]>(
        `SELECT is_blocked, block_reason FROM customers WHERE id = ? AND company_id = ?`,
        [input.customerId, companyId]
      );
      if (custCheck.length > 0 && custCheck[0].is_blocked) {
        throw new Error(
          `El cliente se encuentra BLOQUEADO: ${custCheck[0].block_reason || 'Consulte con administración'}`
        );
      }

      let totalAmount = 0;

      // 0. Si viene de una cotización, validar que exista, esté FACTURADA y no esté 100% entregada
      let relatedInvoiceId: string | null = null;
      if (input.quotationId) {
        const [qRows] = await conn.execute<any[]>(
          `SELECT id, quotation_number, status, total_amount FROM sales_quotations WHERE id = ? AND company_id = ?`,
          [input.quotationId, companyId]
        );
        if (qRows.length === 0) {
          throw new Error('La cotización seleccionada no existe en el sistema');
        }
        const quot = qRows[0];
        if (quot.status !== 'CONVERTED') {
          throw new Error(
            `Solo se pueden despachar cotizaciones previamente facturadas. La cotización ${quot.quotation_number} no se encuentra facturada.`
          );
        }

        // Buscar la factura asociada a esta cotización para vincularla a la nota de entrega
        const [invRows] = await conn.execute<any[]>(
          `SELECT id FROM sales_invoices WHERE quotation_id = ? ORDER BY created_at DESC LIMIT 1`,
          [input.quotationId]
        );
        if (invRows.length > 0) {
          relatedInvoiceId = invRows[0].id;
        }

        // Validar que la cotización tenga cantidades pendientes por despachar (no entregada al 100%)
        const [pendingRows] = await conn.execute<any[]>(
          `SELECT COUNT(*) as pendingCount
           FROM sales_quotation_items sqi
           WHERE sqi.quotation_id = ?
             AND sqi.quantity > (
               SELECT COALESCE(SUM(dni.quantity_delivered), 0)
               FROM delivery_note_items dni
               INNER JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
               WHERE dn.quotation_id = ?
                 AND dn.status != 'ANNULLED'
                 AND (dni.quotation_item_id = sqi.id OR dni.product_id = sqi.product_id)
             )`,
          [input.quotationId, input.quotationId]
        );
        if (Number(pendingRows[0]?.pendingCount || 0) === 0) {
          throw new Error(
            `La cotización ${quot.quotation_number} ya ha sido entregada al 100%. No posee mercancía pendiente por despachar.`
          );
        }
      }

      // 1. Validar existencias físicas en el depósito para todos los productos
      for (const item of input.items) {
        const [stockRows] = await conn.execute<any[]>(
          `SELECT COALESCE(ps.available_stock, ps.current_stock - ps.reserved_stock, 0) as available_stock,
                  COALESCE(ps.current_stock, 0) as current_stock,
                  COALESCE(ps.reserved_stock, 0) as reserved_stock,
                  p.sku, p.cost_price, p.tracks_inventory
           FROM products p
           LEFT JOIN product_stocks ps ON ps.product_id = p.id AND ps.warehouse_id = ?
           WHERE p.id = ?`,
          [input.warehouseId, item.productId]
        );

        if (stockRows.length === 0) {
          throw new Error(`Producto ${item.productId} no encontrado`);
        }

        const tracksInventory = Boolean(stockRows[0]?.tracks_inventory !== 0 && stockRows[0]?.tracks_inventory !== false);
        const physical = Number(stockRows[0]?.current_stock || 0);
        const available = Number(stockRows[0]?.available_stock || 0);

        // Si viene de cotización facturada, el inventario ya fue reservado previamente para este despacho.
        // Se valida contra el stock físico real (current_stock).
        // Si es un despacho directo sin cotización, se valida contra el stock disponible no reservado (available_stock).
        const stockToCheck = input.quotationId ? physical : available;
        const stockLabel = input.quotationId ? 'Físico en almacén' : 'Disponible no reservado';

        if (tracksInventory && stockToCheck < item.quantityDelivered) {
          throw new Error(
            `Stock insuficiente en el depósito para el producto ${stockRows[0].sku}. Solicitado: ${item.quantityDelivered}, ${stockLabel}: ${stockToCheck}`
          );
        }

        totalAmount += Number((item.quantityDelivered * item.unitPrice).toFixed(2));
      }

      // 2. Insertar cabecera de Nota de Entrega
      const deliveryStatus = relatedInvoiceId ? 'INVOICED' : 'DELIVERED';
      await conn.execute(
        `INSERT INTO delivery_notes (
          id, company_id, branch_id, warehouse_id, customer_id,
          quotation_id, user_id, delivery_number, currency, exchange_rate,
          total_amount, driver_name, vehicle_plate, status, sales_invoice_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deliveryId,
          companyId,
          input.branchId,
          input.warehouseId,
          input.customerId,
          input.quotationId || null,
          userId,
          deliveryNumber,
          input.currency,
          input.exchangeRate,
          totalAmount,
          input.driverName || null,
          input.vehiclePlate || null,
          deliveryStatus,
          relatedInvoiceId,
          input.notes || null,
        ]
      );

      // 3. Procesar ítems, rebaja física de inventario, liberación de reservas y auditoría Kardex
      for (const item of input.items) {
        const [productRow] = await conn.execute<any[]>(
          `SELECT cost_price, tracks_inventory FROM products WHERE id = ?`,
          [item.productId]
        );
        const unitCost = Number(productRow[0]?.cost_price || 0);
        const tracksInventory = Boolean(productRow[0]?.tracks_inventory !== 0 && productRow[0]?.tracks_inventory !== false);
        const itemTotal = Number((item.quantityDelivered * item.unitPrice).toFixed(2));

        await conn.execute(
          `INSERT INTO delivery_note_items (
            id, delivery_note_id, quotation_item_id, product_id,
            quantity_delivered, unit_price, unit_cost, total, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            deliveryId,
            item.quotationItemId || null,
            item.productId,
            item.quantityDelivered,
            item.unitPrice,
            unitCost,
            itemTotal,
            item.notes || null,
          ]
        );

        // Descontar inventario físico y liberar reserva solo si el producto maneja inventario
        if (tracksInventory) {
          if (input.quotationId) {
            await conn.execute(
              `UPDATE product_stocks
               SET current_stock = current_stock - ?,
                   reserved_stock = GREATEST(0, reserved_stock - ?),
                   last_movement_at = NOW()
               WHERE product_id = ? AND warehouse_id = ?`,
              [item.quantityDelivered, item.quantityDelivered, item.productId, input.warehouseId]
            );
          } else {
            // Despacho directo sin cotización: descontar inventario físico
            await conn.execute(
              `UPDATE product_stocks
               SET current_stock = current_stock - ?,
                   last_movement_at = NOW()
               WHERE product_id = ? AND warehouse_id = ?`,
              [item.quantityDelivered, item.productId, input.warehouseId]
            );
          }

          // Registrar en Kardex la salida física real de inventario
          await conn.execute(
            `INSERT INTO inventory_movements (
              id, branch_id, warehouse_id, product_id, user_id, movement_type,
              quantity, unit_cost, reference_document, reason
            ) VALUES (?, ?, ?, ?, ?, 'OUT', ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              input.branchId,
              input.warehouseId,
              item.productId,
              userId,
              item.quantityDelivered,
              unitCost,
              deliveryNumber,
              input.quotationId
                ? `Despacho de mercancía reservada según Nota de Entrega: ${deliveryNumber}`
                : `Despacho según Nota de Entrega: ${deliveryNumber}`,
            ]
          );
        }
      }

      // Si viene de una cotización, mantener como CONVERTED
      if (input.quotationId) {
        await conn.execute(
          `UPDATE sales_quotations SET status = 'CONVERTED' WHERE id = ?`,
          [input.quotationId]
        );
      }

      return {
        id: deliveryId,
        deliveryNumber,
        status: deliveryStatus,
        salesInvoiceId: relatedInvoiceId,
        totalAmount,
        itemsCount: input.items.length,
      };
    });
  }

  // ==========================================
  // CONVERSIÓN A FACTURA FISCAL (VENTAS / CXC)
  // ==========================================

  static async convertDeliveryToInvoice(companyId: string, userId: string, input: ConvertDeliveryToInvoiceInput) {
    return await withTransaction(async (conn) => {
      // 1. Obtener nota de entrega
      const [deliveryRows] = await conn.execute<any[]>(
        `SELECT * FROM delivery_notes WHERE id = ? AND company_id = ?`,
        [input.deliveryNoteId, companyId]
      );

      if (deliveryRows.length === 0) throw new Error('Nota de entrega no encontrada');
      const delivery = deliveryRows[0];
      if (delivery.status === 'INVOICED') throw new Error('Esta nota de entrega ya fue facturada');
      if (delivery.status === 'ANNULLED') throw new Error('No se puede facturar una nota de entrega anulada');

      // 2. Reglas de facturación administrativa
      const [ruleRows] = await conn.execute<any[]>(
        `SELECT sales_invoice_mode, require_approval_credit_exceeded, enforce_credit_limit 
         FROM business_rules WHERE company_id = ?`,
        [companyId]
      );
      const companyRules = ruleRows[0] || {
        sales_invoice_mode: 'free_form',
        require_approval_credit_exceeded: 1,
        enforce_credit_limit: 1,
      };

      const invoiceMode = input.invoiceMode || companyRules.sales_invoice_mode || 'free_form';

      // Validar Nº de control fiscal según el modo de facturación
      let finalControlNumber: string | null = null;
      if (invoiceMode === 'free_form') {
        if (!input.controlNumber || !input.controlNumber.trim()) {
          throw new Error('El Nº de Control SENIAT es obligatorio para Facturas en Forma Libre / Talonario');
        }
        finalControlNumber = input.controlNumber.trim();
      } else if (invoiceMode === 'fiscal_printer') {
        finalControlNumber = input.controlNumber?.trim() || null;
      } else {
        finalControlNumber = null;
      }

      // Autogenerar número de factura si no fue provisto
      const invoiceNumber = input.invoiceNumber?.trim() || (await this.generateInvoiceNumber(conn, companyId));

      // 3. Obtener cliente y verificar crédito comercial
      const [customerRows] = await conn.execute<any[]>(
        `SELECT * FROM customers WHERE id = ?`,
        [delivery.customer_id]
      );
      const customer = customerRows[0];

      let creditApproval: any = null;
      if (input.isCredit) {
        creditApproval = await this.validateCreditAndApproval(
          conn,
          companyId,
          userId,
          customer,
          delivery.total_amount,
          input.adminAuthorized,
          input.supervisorApproval
        );
      }

      // 4. Obtener ítems despachados
      const [items] = await conn.execute<any[]>(
        `SELECT dni.*, p.default_tax_rate_id
         FROM delivery_note_items dni
         INNER JOIN products p ON dni.product_id = p.id
         WHERE dni.delivery_note_id = ?`,
        [input.deliveryNoteId]
      );

      const invoiceId = crypto.randomUUID();
      let baseTaxableAmount = 0;
      let taxAmount = 0;

      const preparedInvoiceItems = items.map((item) => {
        const itemSubtotal = Number((item.quantity_delivered * item.unit_price).toFixed(2));
        const itemTax = Number((itemSubtotal * 0.16).toFixed(2)); // IVA general 16%
        const itemTotal = Number((itemSubtotal + itemTax).toFixed(2));

        baseTaxableAmount += itemSubtotal;
        taxAmount += itemTax;

        return {
          id: crypto.randomUUID(),
          invoiceId,
          productId: item.product_id,
          quantity: item.quantity_delivered,
          unitPrice: item.unit_price,
          unitCost: item.unit_cost,
          taxRate: 16.0,
          discountPercent: 0.0,
          taxAmount: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
        };
      });

      const totalInvoiceAmount = Number((baseTaxableAmount + taxAmount).toFixed(2));

      // 5. Insertar sales_invoices (El inventario YA fue rebajado por la nota de entrega)
      await conn.execute(
        `INSERT INTO sales_invoices (
          id, branch_id, warehouse_id, customer_id, user_id,
          invoice_number, control_number, invoice_date, invoice_mode,
          currency, exchange_rate, base_exempt_amount, base_taxable_amount,
          tax_amount, igtf_amount, discount_amount, total_amount,
          is_credit, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 0.00, ?, ?, 0.00, 0.00, ?, ?, ?)`,
        [
          invoiceId,
          delivery.branch_id,
          delivery.warehouse_id,
          delivery.customer_id,
          userId,
          invoiceNumber,
          finalControlNumber,
          invoiceMode,
          delivery.currency,
          delivery.exchange_rate,
          baseTaxableAmount,
          taxAmount,
          totalInvoiceAmount,
          input.isCredit ? 1 : 0,
          input.isCredit ? 'PENDING' : 'PAID',
        ]
      );

      // Si se aprobó sobregiro de crédito, registrar en auditoría
      if (creditApproval && creditApproval.approved) {
        await conn.execute(
          `INSERT INTO audit_logs (
            id, company_id, branch_id, user_id, module, action, entity, entity_id, after_json
          ) VALUES (?, ?, ?, ?, 'sales', 'CREDIT_LIMIT_OVERRIDE', 'sales_invoices', ?, ?)`,
          [
            crypto.randomUUID(),
            companyId,
            delivery.branch_id,
            creditApproval.approvedByUserId,
            invoiceId,
            JSON.stringify({
              customerId: delivery.customer_id,
              customerName: customer.name,
              creditLimit: creditApproval.creditLimit,
              currentDebt: creditApproval.currentDebt,
              saleAmount: totalInvoiceAmount,
              approvedBy: creditApproval.approvedByUserName,
              notes: creditApproval.notes,
            }),
          ]
        );
      }

      // 6. Insertar ítems de factura
      for (const item of preparedInvoiceItems) {
        await conn.execute(
          `INSERT INTO sales_invoice_items (
            id, invoice_id, product_id, quantity, unit_price,
            unit_cost, tax_rate, discount_percent, tax_amount, subtotal, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.invoiceId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.unitCost,
            item.taxRate,
            item.discountPercent,
            item.taxAmount,
            item.subtotal,
            item.total,
          ]
        );
      }

      // 7. Si es a crédito, registrar en receivables (CxC); si es de contado, registrar pago y movimiento bancario
      // 7. Si es a crédito, registrar en receivables (CxC); si es de contado, registrar pago y movimiento bancario
      if (input.isCredit) {
        const receivableId = crypto.randomUUID();
        const paymentDays = Number(customer.payment_terms_days) || 15;
        const dueDate = input.dueDate || new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await conn.execute(
          `INSERT INTO receivables (
            id, branch_id, customer_id, invoice_id, amount_total,
            amount_paid, due_date, status
          ) VALUES (?, ?, ?, ?, ?, 0.00, ?, 'PENDING')`,
          [receivableId, delivery.branch_id, delivery.customer_id, invoiceId, totalInvoiceAmount, dueDate]
        );
      } else {
        const paymentMethod = input.paymentMethod || 'CASH_USD';
        const exRate = Number(delivery.exchange_rate) || 1.0;
        const isUSD = delivery.currency === 'USD';
        const totalAmount = totalInvoiceAmount;
        const amountUSD = isUSD ? totalAmount : Number((totalAmount / exRate).toFixed(2));
        const amountVES = isUSD ? Number((totalAmount * exRate).toFixed(2)) : totalAmount;

        await conn.execute(
          `INSERT INTO sales_payments (
            id, invoice_id, method, amount_ves, amount_usd, exchange_rate,
            applies_igtf, igtf_amount_ves, igtf_amount_usd, reference_number
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0.00, 0.00, ?)`,
          [
            crypto.randomUUID(),
            invoiceId,
            paymentMethod,
            amountVES,
            amountUSD,
            exRate,
            input.paymentReference?.trim() || null,
          ]
        );

        let targetBankAccountId = input.bankAccountId;
        if (!targetBankAccountId) {
          const isPaymentUSD = ['CASH_USD', 'ZELLE'].includes(paymentMethod) || (isUSD && !['CASH_VES', 'TRANSFER', 'PAGO_MOVIL', 'DEBIT_CARD', 'CREDIT_CARD'].includes(paymentMethod));
          const targetCurrency = isPaymentUSD ? 'USD' : 'VES';

          const [branchAccs] = await conn.execute<any[]>(
            `SELECT id FROM bank_accounts 
             WHERE company_id = ? AND branch_id = ? AND is_active = 1 AND currency = ? 
             ORDER BY created_at ASC LIMIT 1`,
            [companyId, delivery.branch_id, targetCurrency]
          );

          if (branchAccs.length > 0) {
            targetBankAccountId = branchAccs[0].id;
          } else {
            const [companyAccs] = await conn.execute<any[]>(
              `SELECT id FROM bank_accounts 
               WHERE company_id = ? AND is_active = 1 AND currency = ? 
               ORDER BY created_at ASC LIMIT 1`,
              [companyId, targetCurrency]
            );
            if (companyAccs.length > 0) {
              targetBankAccountId = companyAccs[0].id;
            } else {
              const [anyAccs] = await conn.execute<any[]>(
                `SELECT id FROM bank_accounts 
                 WHERE company_id = ? AND is_active = 1 
                 ORDER BY created_at ASC LIMIT 1`,
                [companyId]
              );
              if (anyAccs.length > 0) {
                targetBankAccountId = anyAccs[0].id;
              }
            }
          }
        }

        if (targetBankAccountId) {
          const [accRows] = await conn.execute<any[]>(
            `SELECT id, currency, current_balance FROM bank_accounts WHERE id = ? AND company_id = ? FOR UPDATE`,
            [targetBankAccountId, companyId]
          );
          if (accRows.length > 0) {
            const acc = accRows[0];
            const depositAmount = acc.currency === 'USD' ? amountUSD : amountVES;
            const updatedBalance = Number((Number(acc.current_balance) + depositAmount).toFixed(2));

            await conn.execute(
              `UPDATE bank_accounts SET current_balance = ? WHERE id = ?`,
              [updatedBalance, targetBankAccountId]
            );

            const refNumber = (input.paymentReference?.trim() || invoiceNumber).slice(0, 60);
            const concept = `Cobro Factura ${invoiceNumber} (${paymentMethod}) - Nota de Entrega ${delivery.delivery_number} [${customer.name}]`.slice(0, 255);

            await conn.execute(
              `INSERT INTO bank_movements (
                id, account_id, user_id, movement_type, amount, balance_after,
                movement_date, reference_number, concept, is_reconciled
              ) VALUES (?, ?, ?, 'DEPOSIT', ?, ?, NOW(), ?, ?, 0)`,
              [
                crypto.randomUUID(),
                targetBankAccountId,
                userId,
                depositAmount,
                updatedBalance,
                refNumber,
                concept,
              ]
            );
          }
        }
      }

      // 8. Actualizar la nota de entrega a INVOICED
      await conn.execute(
        `UPDATE delivery_notes
         SET status = 'INVOICED', sales_invoice_id = ?
         WHERE id = ?`,
        [invoiceId, input.deliveryNoteId]
      );

      return {
        invoiceId,
        invoiceNumber,
        controlNumber: finalControlNumber,
        invoiceMode,
        totalAmount: totalInvoiceAmount,
        isCredit: input.isCredit,
        status: input.isCredit ? 'PENDING' : 'PAID',
      };
    });
  }

  static async convertQuotationToInvoice(companyId: string, userId: string, input: ConvertQuotationToInvoiceInput) {
    return await withTransaction(async (conn) => {
      // 1. Obtener cotización
      const [quotationRows] = await conn.execute<any[]>(
        `SELECT * FROM sales_quotations WHERE id = ? AND company_id = ?`,
        [input.quotationId, companyId]
      );

      if (quotationRows.length === 0) throw new Error('Cotización no encontrada');
      const quotation = quotationRows[0];
      if (quotation.status === 'CONVERTED') throw new Error('Esta cotización ya fue facturada');

      // 2. Reglas de facturación administrativa
      const [ruleRows] = await conn.execute<any[]>(
        `SELECT sales_invoice_mode, require_approval_credit_exceeded, enforce_credit_limit 
         FROM business_rules WHERE company_id = ?`,
        [companyId]
      );
      const companyRules = ruleRows[0] || {
        sales_invoice_mode: 'free_form',
        require_approval_credit_exceeded: 1,
        enforce_credit_limit: 1,
      };

      const invoiceMode = input.invoiceMode || companyRules.sales_invoice_mode || 'free_form';

      // Validar Nº de control fiscal según el modo de facturación
      let finalControlNumber: string | null = null;
      if (invoiceMode === 'free_form') {
        if (!input.controlNumber || !input.controlNumber.trim()) {
          throw new Error('El Nº de Control SENIAT es obligatorio para Facturas en Forma Libre / Talonario');
        }
        finalControlNumber = input.controlNumber.trim();
      } else if (invoiceMode === 'fiscal_printer') {
        finalControlNumber = input.controlNumber?.trim() || null;
      } else {
        finalControlNumber = null;
      }

      // Autogenerar número de factura si no fue provisto
      const invoiceNumber = input.invoiceNumber?.trim() || (await this.generateInvoiceNumber(conn, companyId));

      // 3. Verificar cliente y crédito comercial
      const [customerRows] = await conn.execute<any[]>(
        `SELECT * FROM customers WHERE id = ?`,
        [quotation.customer_id]
      );
      if (customerRows.length === 0) {
        throw new Error('Cliente asociado a la cotización no encontrado');
      }
      const customer = customerRows[0];
      if (customer.is_blocked) {
        throw new Error(`No se puede facturar. El cliente está BLOQUEADO: ${customer.block_reason || 'Consulte con administración'}`);
      }

      let creditApproval: any = null;
      if (input.isCredit) {
        if (!customer.credit_enabled) {
          throw new Error(`El cliente ${customer.name} no tiene línea de crédito comercial habilitada.`);
        }
        creditApproval = await this.validateCreditAndApproval(
          conn,
          companyId,
          userId,
          customer,
          quotation.total_amount,
          input.adminAuthorized,
          input.supervisorApproval
        );
      }

      // 4. Obtener ítems de la cotización, verificar stock en el depósito y comparar precios
      const [items] = await conn.execute<any[]>(
        `SELECT sqi.*, p.cost_price, p.sku, p.name as product_name, p.base_price as current_base_price, p.currency as product_currency, p.tracks_inventory
         FROM sales_quotation_items sqi
         INNER JOIN products p ON sqi.product_id = p.id
         WHERE sqi.quotation_id = ?`,
        [input.quotationId]
      );

      for (const item of items) {
        const tracksInventory = Boolean(item.tracks_inventory !== 0 && item.tracks_inventory !== false);
        if (tracksInventory) {
          const [stockRow] = await conn.execute<any[]>(
            `SELECT COALESCE(available_stock, current_stock, 0) as available_stock
             FROM product_stocks
             WHERE product_id = ? AND warehouse_id = ?`,
            [item.product_id, input.warehouseId]
          );
          const available = Number(stockRow[0]?.available_stock || 0);
          if (available < item.quantity) {
            throw new Error(
              `Stock insuficiente en el depósito para el producto ${item.sku} (${item.product_name || ''}). Disponible: ${available}, Requerido: ${item.quantity}`
            );
          }
        }
      }

      // Preparar totales e ítems (respetando precio cotizado o actualizando según selección)
      let finalSubtotal = 0;
      let finalTax = 0;
      let finalDiscount = 0;
      let finalTotal = 0;

      const quotationExRate = Number(quotation.exchange_rate || 1);

      const preparedInvoiceItems = items.map((item) => {
        let currentBasePrice = Number(item.current_base_price || 0);
        if (item.product_currency && quotation.currency && item.product_currency !== quotation.currency) {
          if (item.product_currency === 'USD' && quotation.currency === 'VES' && quotationExRate > 0) {
            currentBasePrice = Number((currentBasePrice * quotationExRate).toFixed(4));
          } else if (item.product_currency === 'VES' && quotation.currency === 'USD' && quotationExRate > 0) {
            currentBasePrice = Number((currentBasePrice / quotationExRate).toFixed(4));
          }
        }

        const unitPrice = input.updatePricesToCurrent
          ? currentBasePrice
          : Number(item.unit_price);
        const qty = Number(item.quantity);
        const discountPct = Number(item.discount_percent || 0);
        const taxRate = Number(item.tax_rate || 0);

        const gross = qty * unitPrice;
        const discount = Number((gross * (discountPct / 100)).toFixed(2));
        const subtotal = Number((gross - discount).toFixed(2));
        const tax = Number((subtotal * (taxRate / 100)).toFixed(2));
        const total = Number((subtotal + tax).toFixed(2));

        finalSubtotal += subtotal;
        finalTax += tax;
        finalDiscount += discount;
        finalTotal += total;

        return {
          id: crypto.randomUUID(),
          productId: item.product_id,
          quantity: qty,
          unitPrice,
          unitCost: Number(item.cost_price || 0),
          taxRate,
          discountPercent: discountPct,
          taxAmount: tax,
          subtotal,
          total,
          tracks_inventory: item.tracks_inventory,
        };
      });

      const invoiceSubtotalAmount = input.updatePricesToCurrent ? Number(finalSubtotal.toFixed(2)) : Number(quotation.subtotal_amount);
      const invoiceTaxAmount = input.updatePricesToCurrent ? Number(finalTax.toFixed(2)) : Number(quotation.tax_amount);
      const invoiceDiscountAmount = input.updatePricesToCurrent ? Number(finalDiscount.toFixed(2)) : Number(quotation.discount_amount);
      const invoiceTotalAmount = input.updatePricesToCurrent ? Number(finalTotal.toFixed(2)) : Number(quotation.total_amount);

      // Revalidar crédito si se actualizaron precios
      if (input.isCredit && input.updatePricesToCurrent) {
        creditApproval = await this.validateCreditAndApproval(
          conn,
          companyId,
          userId,
          customer,
          invoiceTotalAmount,
          input.adminAuthorized,
          input.supervisorApproval
        );
      }

      const invoiceId = crypto.randomUUID();

      // 5. Crear factura de venta
      await conn.execute(
        `INSERT INTO sales_invoices (
          id, branch_id, warehouse_id, customer_id, user_id, quotation_id,
          invoice_number, control_number, invoice_date, invoice_mode,
          currency, exchange_rate, base_exempt_amount, base_taxable_amount,
          tax_amount, igtf_amount, discount_amount, total_amount,
          is_credit, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 0.00, ?, ?, 0.00, ?, ?, ?, ?)`,
        [
          invoiceId,
          quotation.branch_id,
          input.warehouseId,
          quotation.customer_id,
          userId,
          input.quotationId,
          invoiceNumber,
          finalControlNumber,
          invoiceMode,
          quotation.currency,
          quotation.exchange_rate,
          invoiceSubtotalAmount,
          invoiceTaxAmount,
          invoiceDiscountAmount,
          invoiceTotalAmount,
          input.isCredit ? 1 : 0,
          input.isCredit ? 'PENDING' : 'PAID',
        ]
      );

      // Si se aprobó sobregiro de crédito, registrar en auditoría
      if (creditApproval && creditApproval.approved) {
        await conn.execute(
          `INSERT INTO audit_logs (
            id, company_id, branch_id, user_id, module, action, entity, entity_id, after_json
          ) VALUES (?, ?, ?, ?, 'sales', 'CREDIT_LIMIT_OVERRIDE', 'sales_invoices', ?, ?)`,
          [
            crypto.randomUUID(),
            companyId,
            quotation.branch_id,
            creditApproval.approvedByUserId,
            invoiceId,
            JSON.stringify({
              customerId: quotation.customer_id,
              customerName: customer.name,
              creditLimit: creditApproval.creditLimit,
              currentDebt: creditApproval.currentDebt,
              saleAmount: invoiceTotalAmount,
              approvedBy: creditApproval.approvedByUserName,
              notes: creditApproval.notes,
            }),
          ]
        );
      }

      // 6. Procesar ítems y reservar stock en el depósito (el stock físico se descarga al emitir la Nota de Entrega)
      for (const item of preparedInvoiceItems) {
        await conn.execute(
          `INSERT INTO sales_invoice_items (
            id, invoice_id, product_id, quantity, unit_price,
            unit_cost, tax_rate, discount_percent, tax_amount, subtotal, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            invoiceId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.unitCost,
            item.taxRate,
            item.discountPercent,
            item.taxAmount,
            item.subtotal,
            item.total,
          ]
        );

        const tracksInventory = Boolean(item.tracks_inventory !== 0 && item.tracks_inventory !== false);
        if (tracksInventory) {
          // Reservar stock en el depósito (disponible se reduce, stock físico se mantiene intacto para el despacho)
          await conn.execute(
            `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
             VALUES (?, ?, 0.00, ?, NOW())
             ON DUPLICATE KEY UPDATE
               reserved_stock = reserved_stock + ?,
               last_movement_at = NOW()`,
            [item.productId, input.warehouseId, item.quantity, item.quantity]
          );
        }
      }

      // 7. Si es a crédito, registrar en receivables (CxC); si es de contado, registrar pago y movimiento bancario
      if (input.isCredit) {
        const receivableId = crypto.randomUUID();
        const paymentDays = Number(customer.payment_terms_days) || 15;
        const dueDate = input.dueDate || new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await conn.execute(
          `INSERT INTO receivables (
            id, branch_id, customer_id, invoice_id, amount_total,
            amount_paid, due_date, status
          ) VALUES (?, ?, ?, ?, ?, 0.00, ?, 'PENDING')`,
          [receivableId, quotation.branch_id, quotation.customer_id, invoiceId, invoiceTotalAmount, dueDate]
        );
      } else {
        const exRate = Number(quotation.exchange_rate) || 1.0;
        const isUSD = quotation.currency === 'USD';
        const totalAmount = invoiceTotalAmount;

        // Normalizar los pagos recibidos (múltiples métodos o método individual por retrocompatibilidad)
        let paymentsToProcess: Array<{
          method: string;
          amountUSD: number;
          amountVES: number;
          exchangeRate: number;
          bankAccountId?: string | null;
          referenceNumber?: string | null;
        }> = [];

        if (input.payments && input.payments.length > 0) {
          paymentsToProcess = input.payments.map((p) => {
            const pRate = Number(p.exchangeRate) || exRate;
            let usd = Number(p.amountUSD || 0);
            let ves = Number(p.amountVES || 0);
            if (usd <= 0 && ves > 0 && pRate > 0) {
              usd = Number((ves / pRate).toFixed(2));
            } else if (ves <= 0 && usd > 0 && pRate > 0) {
              ves = Number((usd * pRate).toFixed(2));
            }
            return {
              method: p.method,
              amountUSD: usd,
              amountVES: ves,
              exchangeRate: pRate,
              bankAccountId: p.bankAccountId || null,
              referenceNumber: p.referenceNumber?.trim() || null,
            };
          });

          // Validar que la sumatoria de pagos cubra el total de la factura
          const sumUSD = paymentsToProcess.reduce((sum, p) => sum + p.amountUSD, 0);
          const sumVES = paymentsToProcess.reduce((sum, p) => sum + p.amountVES, 0);

          if (isUSD) {
            if (Math.abs(sumUSD - totalAmount) > 0.05 && sumUSD < totalAmount - 0.05) {
              throw new Error(
                `La sumatoria de los pagos ($${sumUSD.toFixed(2)}) no cubre el total de la factura ($${totalAmount.toFixed(2)}).`
              );
            }
          } else {
            if (Math.abs(sumVES - totalAmount) > 0.5 && sumVES < totalAmount - 0.5) {
              throw new Error(
                `La sumatoria de los pagos (Bs. ${sumVES.toFixed(2)}) no cubre el total de la factura (Bs. ${totalAmount.toFixed(2)}).`
              );
            }
          }
        } else {
          const paymentMethod = input.paymentMethod || 'CASH_USD';
          const amountUSD = isUSD ? totalAmount : Number((totalAmount / exRate).toFixed(2));
          const amountVES = isUSD ? Number((totalAmount * exRate).toFixed(2)) : totalAmount;

          paymentsToProcess = [
            {
              method: paymentMethod,
              amountUSD,
              amountVES,
              exchangeRate: exRate,
              bankAccountId: input.bankAccountId || null,
              referenceNumber: input.paymentReference?.trim() || null,
            },
          ];
        }

        // Registrar cada método de pago e impactar tesorería
        for (const payment of paymentsToProcess) {
          let targetBankAccountId = payment.bankAccountId;

          // Auto-resolver cuenta bancaria si no se seleccionó explícitamente
          if (!targetBankAccountId) {
            const isPaymentUSD =
              ['CASH_USD', 'ZELLE'].includes(payment.method) ||
              (isUSD && !['CASH_VES', 'TRANSFER', 'PAGO_MOVIL', 'DEBIT_CARD', 'CREDIT_CARD'].includes(payment.method));
            const targetCurrency = isPaymentUSD ? 'USD' : 'VES';

            const [branchAccs] = await conn.execute<any[]>(
              `SELECT id FROM bank_accounts 
               WHERE company_id = ? AND branch_id = ? AND is_active = 1 AND currency = ? 
               ORDER BY created_at ASC LIMIT 1`,
              [companyId, quotation.branch_id, targetCurrency]
            );

            if (branchAccs.length > 0) {
              targetBankAccountId = branchAccs[0].id;
            } else {
              const [companyAccs] = await conn.execute<any[]>(
                `SELECT id FROM bank_accounts 
                 WHERE company_id = ? AND is_active = 1 AND currency = ? 
                 ORDER BY created_at ASC LIMIT 1`,
                [companyId, targetCurrency]
              );
              if (companyAccs.length > 0) {
                targetBankAccountId = companyAccs[0].id;
              } else {
                const [anyAccs] = await conn.execute<any[]>(
                  `SELECT id FROM bank_accounts 
                   WHERE company_id = ? AND is_active = 1 
                   ORDER BY created_at ASC LIMIT 1`,
                  [companyId]
                );
                if (anyAccs.length > 0) {
                  targetBankAccountId = anyAccs[0].id;
                }
              }
            }
          }

          await conn.execute(
            `INSERT INTO sales_payments (
              id, invoice_id, method, amount_ves, amount_usd, exchange_rate,
              applies_igtf, igtf_amount_ves, igtf_amount_usd, reference_number, bank_account_id
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 0.00, 0.00, ?, ?)`,
            [
              crypto.randomUUID(),
              invoiceId,
              payment.method,
              payment.amountVES,
              payment.amountUSD,
              payment.exchangeRate,
              payment.referenceNumber || null,
              targetBankAccountId || null,
            ]
          );

          if (targetBankAccountId) {
            const [accRows] = await conn.execute<any[]>(
              `SELECT id, currency, current_balance FROM bank_accounts WHERE id = ? AND company_id = ? FOR UPDATE`,
              [targetBankAccountId, companyId]
            );
            if (accRows.length > 0) {
              const acc = accRows[0];
              const depositAmount = acc.currency === 'USD' ? payment.amountUSD : payment.amountVES;
              const updatedBalance = Number((Number(acc.current_balance) + depositAmount).toFixed(2));

              await conn.execute(
                `UPDATE bank_accounts SET current_balance = ? WHERE id = ?`,
                [updatedBalance, targetBankAccountId]
              );

              const refNumber = (payment.referenceNumber || invoiceNumber).slice(0, 60);
              const concept = `Cobro Factura ${invoiceNumber} (${payment.method}) - Cotización ${quotation.quotation_number} [${customer.name}]`.slice(0, 255);

              await conn.execute(
                `INSERT INTO bank_movements (
                  id, account_id, user_id, movement_type, amount, balance_after,
                  movement_date, reference_number, concept, is_reconciled
                ) VALUES (?, ?, ?, 'DEPOSIT', ?, ?, NOW(), ?, ?, 0)`,
                [
                  crypto.randomUUID(),
                  targetBankAccountId,
                  userId,
                  depositAmount,
                  updatedBalance,
                  refNumber,
                  concept,
                ]
              );
            }
          }
        }
      }

      // 8. Marcar cotización como CONVERTED
      await conn.execute(
        `UPDATE sales_quotations SET status = 'CONVERTED' WHERE id = ?`,
        [input.quotationId]
      );

      return {
        invoiceId,
        invoiceNumber,
        controlNumber: finalControlNumber,
        invoiceMode,
        totalAmount: quotation.total_amount,
        isCredit: input.isCredit,
        status: input.isCredit ? 'PENDING' : 'PAID',
      };
    });
  }

  static async getSalesCustomersSummary(companyId: string) {
    return await query<any>(
      `SELECT c.id, c.name, CONCAT(c.doc_type, '-', c.doc_number) as doc,
              c.credit_enabled as creditEnabled, c.credit_limit as creditLimit,
              (SELECT COUNT(*) FROM delivery_notes dn WHERE dn.customer_id = c.id AND dn.company_id = c.company_id) as deliveryNotesCount,
              (SELECT COUNT(*) FROM sales_quotations sq WHERE sq.customer_id = c.id AND sq.company_id = c.company_id) as quotationsCount,
              (SELECT COUNT(*) FROM sales_quotations sq WHERE sq.customer_id = c.id AND sq.company_id = c.company_id AND sq.status IN ('EMITTED', 'ACCEPTED')) as activeQuotationsCount
       FROM customers c
       WHERE c.company_id = ?
       ORDER BY c.name ASC`,
      [companyId]
    );
  }

  static async verifyQuotationForInvoicing(companyId: string, quotationId: string, warehouseId?: string) {
    const qRows = await query<any>(
      `SELECT sq.id, sq.branch_id as branchId, sq.quotation_number as quotationNumber, sq.status, sq.currency,
              sq.exchange_rate as exchangeRate, sq.total_amount as totalAmount,
              sq.subtotal_amount as subtotalAmount, sq.tax_amount as taxAmount
       FROM sales_quotations sq
       WHERE sq.id = ? AND sq.company_id = ?`,
      [quotationId, companyId]
    );
    if (!qRows || qRows.length === 0) {
      throw new Error('Cotización no encontrada');
    }
    const quotation = qRows[0];

    // 1. Resolver depósito: validar pertenencia a la empresa a través de branches
    let whRows: any[] = [];
    if (warehouseId && warehouseId.trim() !== '') {
      whRows = await query<any>(
        `SELECT w.id, w.name, w.branch_id as branchId
         FROM warehouses w
         INNER JOIN branches b ON w.branch_id = b.id
         WHERE w.id = ? AND b.company_id = ?`,
        [warehouseId, companyId]
      );
    }

    // Si no se proporcionó o no se encontró, obtener el depósito de ventas predeterminado
    if (!whRows || whRows.length === 0) {
      whRows = await query<any>(
        `SELECT w.id, w.name, w.branch_id as branchId
         FROM warehouses w
         INNER JOIN branches b ON w.branch_id = b.id
         WHERE b.company_id = ?
           AND (w.branch_id = ? OR ? IS NULL)
           AND w.is_active = 1
         ORDER BY (w.branch_id = ?) DESC, w.is_default_sales DESC, w.is_default DESC, w.name ASC
         LIMIT 1`,
        [companyId, quotation.branchId, quotation.branchId, quotation.branchId]
      );
    }

    const resolvedWarehouse = whRows?.[0];
    const finalWarehouseId = resolvedWarehouse?.id || warehouseId || '';
    const warehouseName = resolvedWarehouse?.name || 'Depósito Seleccionado';

    // 2. Consultar ítems de la cotización, precios de catálogo vigentes y stock en depósito
    const items = await query<any>(
      `SELECT sqi.id, sqi.product_id as productId, sqi.quantity,
              sqi.unit_price as quotedUnitPrice, sqi.tax_rate as taxRate,
              sqi.discount_percent as discountPercent, sqi.subtotal as quotedSubtotal,
              sqi.tax_amount as quotedTaxAmount, sqi.total as quotedTotal,
              p.sku as productSku, p.name as productName, p.unit_of_measure as unitOfMeasure,
              p.base_price as currentBasePrice, p.cost_price as currentCostPrice,
              p.currency as productCurrency, p.tracks_inventory as tracksInventory,
              COALESCE(ps.available_stock, ps.current_stock, 0) as availableStock
       FROM sales_quotation_items sqi
       INNER JOIN products p ON sqi.product_id = p.id
       LEFT JOIN product_stocks ps ON ps.product_id = p.id AND ps.warehouse_id = ?
       WHERE sqi.quotation_id = ?`,
      [finalWarehouseId || null, quotationId]
    );

    let hasStockIssues = false;
    let hasPriceVariations = false;
    let totalCurrentAmount = 0;
    let insufficientCount = 0;
    let priceVariationsCount = 0;

    const quotationExRate = Number(quotation.exchangeRate || 1);
    const quotationCurrency = quotation.currency || 'USD';

    const evaluatedItems = items.map((item: any) => {
      const quantity = Number(item.quantity || 0);
      const quotedUnitPrice = Number(item.quotedUnitPrice || 0);
      let currentBasePrice = Number(item.currentBasePrice || 0);
      const availableStock = Number(item.availableStock || 0);
      const tracksInventory = item.tracksInventory !== 0 && item.tracksInventory !== false;

      // Si las monedas difieren, convertir el precio vigente a la moneda de la cotización
      if (item.productCurrency && quotationCurrency && item.productCurrency !== quotationCurrency) {
        if (item.productCurrency === 'USD' && quotationCurrency === 'VES' && quotationExRate > 0) {
          currentBasePrice = Number((currentBasePrice * quotationExRate).toFixed(4));
        } else if (item.productCurrency === 'VES' && quotationCurrency === 'USD' && quotationExRate > 0) {
          currentBasePrice = Number((currentBasePrice / quotationExRate).toFixed(4));
        }
      }

      const hasSufficientStock = !tracksInventory || availableStock >= quantity;
      if (tracksInventory && !hasSufficientStock) {
        hasStockIssues = true;
        insufficientCount++;
      }
      const stockShortage = hasSufficientStock ? 0 : Number((quantity - availableStock).toFixed(2));

      const priceDifference = Number((currentBasePrice - quotedUnitPrice).toFixed(4));
      const hasPriceVariation = Math.abs(priceDifference) > 0.0001;
      if (hasPriceVariation) {
        hasPriceVariations = true;
        priceVariationsCount++;
      }
      const priceVariationPercent = quotedUnitPrice > 0
        ? Number(((priceDifference / quotedUnitPrice) * 100).toFixed(2))
        : 0;

      const discountPercent = Number(item.discountPercent || 0);
      const taxRate = Number(item.taxRate || 0);
      const currentGross = quantity * currentBasePrice;
      const currentDiscount = Number((currentGross * (discountPercent / 100)).toFixed(2));
      const currentSubtotal = Number((currentGross - currentDiscount).toFixed(2));
      const currentTax = Number((currentSubtotal * (taxRate / 100)).toFixed(2));
      const currentTotal = Number((currentSubtotal + currentTax).toFixed(2));

      totalCurrentAmount += currentTotal;

      return {
        id: item.id,
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        unitOfMeasure: item.unitOfMeasure,
        quantity,
        availableStock,
        hasSufficientStock,
        stockShortage,
        quotedUnitPrice,
        currentBasePrice,
        hasPriceVariation,
        priceDifference,
        priceVariationPercent,
        quotedTotal: Number(item.quotedTotal || 0),
        currentTotal,
      };
    });

    const totalQuotedAmount = Number(quotation.totalAmount || 0);
    const totalDifference = Number((totalCurrentAmount - totalQuotedAmount).toFixed(2));

    return {
      quotationId,
      quotationNumber: quotation.quotationNumber,
      currency: quotation.currency,
      exchangeRate: quotation.exchangeRate,
      warehouseId: finalWarehouseId,
      warehouseName,
      canInvoice: !hasStockIssues,
      hasStockIssues,
      hasPriceVariations,
      insufficientCount,
      priceVariationsCount,
      totalQuotedAmount,
      totalCurrentAmount: Number(totalCurrentAmount.toFixed(2)),
      totalDifference,
      items: evaluatedItems,
    };
  }

  static async getPaymentBankAccounts(companyId: string) {
    const rows = await query<any>(
      `SELECT ba.id, ba.company_id, ba.bank_id, ba.branch_id,
              b.code as bank_code, b.name as bank_name,
              br.name as branch_name,
              ba.account_number, ba.account_type, ba.currency,
              ba.description, ba.current_balance, ba.is_active
       FROM bank_accounts ba
       INNER JOIN banks b ON ba.bank_id = b.id
       LEFT JOIN branches br ON ba.branch_id = br.id
       WHERE ba.company_id = ? AND ba.is_active = 1
       ORDER BY ba.currency DESC, b.name ASC`,
      [companyId]
    );

    return rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      bankId: r.bank_id,
      bankCode: r.bank_code,
      bankName: r.bank_name,
      branchId: r.branch_id,
      branchName: r.branch_name,
      accountNumber: r.account_number,
      accountType: r.account_type,
      currency: r.currency,
      description: r.description,
      currentBalance: Number(r.current_balance),
      isActive: Boolean(r.is_active),
    }));
  }
}

