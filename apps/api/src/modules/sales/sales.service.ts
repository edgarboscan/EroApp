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

  static async getQuotations(companyId: string, branchId?: string, status?: string) {
    return await query<any>(
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
              (SELECT COUNT(*) FROM sales_quotation_items sqi WHERE sqi.quotation_id = sq.id) as itemsCount
       FROM sales_quotations sq
       INNER JOIN customers c ON sq.customer_id = c.id
       INNER JOIN branches b ON sq.branch_id = b.id
       INNER JOIN users u ON sq.user_id = u.id
       WHERE sq.company_id = ?
         AND (? IS NULL OR sq.branch_id = ?)
         AND (? IS NULL OR sq.status = ?)
       ORDER BY sq.quotation_date DESC, sq.created_at DESC`,
      [companyId, branchId || null, branchId || null, status || null, status || null]
    );
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
              p.sku as productSku, p.name as productName, p.unit_of_measure as unitOfMeasure
       FROM sales_quotation_items sqi
       INNER JOIN products p ON sqi.product_id = p.id
       WHERE sqi.quotation_id = ?`,
      [quotationId]
    );

    return { ...quotation, items };
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

  static async getDeliveryNotes(companyId: string, branchId?: string, warehouseId?: string, status?: string) {
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
              sq.quotation_number as quotationNumber
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
       ORDER BY dn.delivery_date DESC, dn.created_at DESC`,
      [companyId, branchId || null, branchId || null, warehouseId || null, warehouseId || null, status || null, status || null]
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
              sq.quotation_number as quotationNumber
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

      let totalAmount = 0;

      // 1. Validar existencias físicas en el depósito para todos los productos
      for (const item of input.items) {
        const [stockRows] = await conn.execute<any[]>(
          `SELECT ps.quantity, p.sku, p.cost_price
           FROM products p
           LEFT JOIN product_stocks ps ON ps.product_id = p.id AND ps.warehouse_id = ?
           WHERE p.id = ?`,
          [input.warehouseId, item.productId]
        );

        if (stockRows.length === 0) {
          throw new Error(`Producto ${item.productId} no encontrado`);
        }

        const available = Number(stockRows[0]?.quantity || 0);
        if (available < item.quantityDelivered) {
          throw new Error(
            `Stock insuficiente en el depósito para el producto ${stockRows[0].sku}. Solicitado: ${item.quantityDelivered}, Disponible: ${available}`
          );
        }

        totalAmount += Number((item.quantityDelivered * item.unitPrice).toFixed(2));
      }

      // 2. Insertar cabecera de Nota de Entrega
      await conn.execute(
        `INSERT INTO delivery_notes (
          id, company_id, branch_id, warehouse_id, customer_id,
          quotation_id, user_id, delivery_number, currency, exchange_rate,
          total_amount, driver_name, vehicle_plate, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DELIVERED', ?)`,
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
          input.notes || null,
        ]
      );

      // 3. Procesar ítems, rebaja de inventario y auditoría Kardex
      for (const item of input.items) {
        const [productRow] = await conn.execute<any[]>(
          `SELECT cost_price FROM products WHERE id = ?`,
          [item.productId]
        );
        const unitCost = Number(productRow[0]?.cost_price || 0);
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

        // Descontar inventario físico
        await conn.execute(
          `UPDATE product_stocks
           SET quantity = quantity - ?
           WHERE product_id = ? AND warehouse_id = ?`,
          [item.quantityDelivered, item.productId, input.warehouseId]
        );

        // Registrar en Kardex
        await conn.execute(
          `INSERT INTO inventory_movements (
            id, branch_id, warehouse_id, product_id, movement_type,
            quantity, unit_cost, reference_document, reason
          ) VALUES (?, ?, ?, ?, 'OUT', ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            input.branchId,
            input.warehouseId,
            item.productId,
            item.quantityDelivered,
            unitCost,
            deliveryNumber,
            `Despacho según Nota de Entrega: ${deliveryNumber}`,
          ]
        );
      }

      // Si viene de una cotización, actualizar estatus a CONVERTED
      if (input.quotationId) {
        await conn.execute(
          `UPDATE sales_quotations SET status = 'CONVERTED' WHERE id = ?`,
          [input.quotationId]
        );
      }

      return {
        id: deliveryId,
        deliveryNumber,
        status: 'DELIVERED',
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

      // 7. Si es a crédito, registrar en receivables (CxC)
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
      const customer = customerRows[0];

      let creditApproval: any = null;
      if (input.isCredit) {
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

      // 4. Obtener ítems de la cotización y verificar stock en el depósito
      const [items] = await conn.execute<any[]>(
        `SELECT sqi.*, p.cost_price, p.sku
         FROM sales_quotation_items sqi
         INNER JOIN products p ON sqi.product_id = p.id
         WHERE sqi.quotation_id = ?`,
        [input.quotationId]
      );

      for (const item of items) {
        const [stockRow] = await conn.execute<any[]>(
          `SELECT quantity FROM product_stocks WHERE product_id = ? AND warehouse_id = ?`,
          [item.product_id, input.warehouseId]
        );
        const available = Number(stockRow[0]?.quantity || 0);
        if (available < item.quantity) {
          throw new Error(
            `Stock insuficiente en el depósito para el producto ${item.sku}. Disponible: ${available}, Requerido: ${item.quantity}`
          );
        }
      }

      const invoiceId = crypto.randomUUID();

      // 5. Crear factura de venta
      await conn.execute(
        `INSERT INTO sales_invoices (
          id, branch_id, warehouse_id, customer_id, user_id,
          invoice_number, control_number, invoice_date, invoice_mode,
          currency, exchange_rate, base_exempt_amount, base_taxable_amount,
          tax_amount, igtf_amount, discount_amount, total_amount,
          is_credit, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 0.00, ?, ?, 0.00, ?, ?, ?, ?)`,
        [
          invoiceId,
          quotation.branch_id,
          input.warehouseId,
          quotation.customer_id,
          userId,
          invoiceNumber,
          finalControlNumber,
          invoiceMode,
          quotation.currency,
          quotation.exchange_rate,
          quotation.subtotal_amount,
          quotation.tax_amount,
          quotation.discount_amount,
          quotation.total_amount,
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
              saleAmount: quotation.total_amount,
              approvedBy: creditApproval.approvedByUserName,
              notes: creditApproval.notes,
            }),
          ]
        );
      }

      // 6. Procesar ítems, rebaja de stock y Kardex
      for (const item of items) {
        await conn.execute(
          `INSERT INTO sales_invoice_items (
            id, invoice_id, product_id, quantity, unit_price,
            unit_cost, tax_rate, discount_percent, tax_amount, subtotal, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            invoiceId,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.cost_price,
            item.tax_rate,
            item.discount_percent,
            item.tax_amount,
            item.subtotal,
            item.total,
          ]
        );

        // Descontar inventario
        await conn.execute(
          `UPDATE product_stocks
           SET quantity = quantity - ?
           WHERE product_id = ? AND warehouse_id = ?`,
          [item.quantity, item.product_id, input.warehouseId]
        );

        // Registrar en Kardex
        await conn.execute(
          `INSERT INTO inventory_movements (
            id, branch_id, warehouse_id, product_id, movement_type,
            quantity, unit_cost, reference_document, reason
          ) VALUES (?, ?, ?, ?, 'SALE', ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            quotation.branch_id,
            input.warehouseId,
            item.product_id,
            item.quantity,
            item.cost_price,
            invoiceNumber,
            `Facturación Administrativa: ${invoiceNumber}`,
          ]
        );
      }

      // 7. Si es a crédito, registrar en receivables (CxC) con cálculo de días de vencimiento
      if (input.isCredit) {
        const receivableId = crypto.randomUUID();
        const paymentDays = Number(customer.payment_terms_days) || 15;
        const dueDate = input.dueDate || new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await conn.execute(
          `INSERT INTO receivables (
            id, branch_id, customer_id, invoice_id, amount_total,
            amount_paid, due_date, status
          ) VALUES (?, ?, ?, ?, ?, 0.00, ?, 'PENDING')`,
          [receivableId, quotation.branch_id, quotation.customer_id, invoiceId, quotation.total_amount, dueDate]
        );
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
}
