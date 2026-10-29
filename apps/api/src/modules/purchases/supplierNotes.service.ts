import { query, withTransaction } from '../../db';
import {
  CreateSupplierNoteInput,
  ApplySupplierCreditNoteInput,
  SupplierNote,
  SupplierNoteItem,
  SupplierNoteApplication,
} from '@ero/shared';
import crypto from 'crypto';

export class SupplierNotesService {
  /**
   * Genera el siguiente número correlativo interno para la nota si el usuario no especifica uno propio del proveedor
   */
  private static async getNextNoteNumber(conn: any, branchId: string, type: 'CREDIT' | 'DEBIT'): Promise<string> {
    const prefix = type === 'CREDIT' ? 'NC-PROV' : 'ND-PROV';
    const [rows]: any = await conn.query(
      `SELECT note_number FROM supplier_notes
       WHERE branch_id = ? AND type = ?
       ORDER BY created_at DESC
       LIMIT 1 FOR UPDATE`,
      [branchId, type]
    );

    let nextSeq = 1;
    if (rows && rows.length > 0 && rows[0].note_number) {
      const match = rows[0].note_number.match(new RegExp(`^${prefix}-(\\d+)`));
      if (match && match[1]) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${String(nextSeq).padStart(8, '0')}`;
  }

  /**
   * Listar notas de crédito y débito de proveedores con filtros
   */
  static async getNotes(
    companyId: string,
    filters?: {
      branchId?: string;
      supplierId?: string;
      type?: 'CREDIT' | 'DEBIT';
      status?: 'ACTIVE' | 'APPLIED' | 'ANNULLED';
      search?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    let sql = `
      SELECT sn.id, sn.company_id, sn.branch_id, b.name as branch_name,
             sn.supplier_id, s.rif as supplier_rif, s.name as supplier_name,
             sn.user_id, u.name as user_name,
             sn.warehouse_id, w.name as warehouse_name,
             sn.affected_invoice_id, pi.invoice_number as affected_invoice_number,
             sn.type, sn.note_number, sn.control_number, sn.note_date,
             sn.currency, sn.exchange_rate,
             sn.subtotal_amount, sn.tax_amount, sn.total_amount, sn.available_balance,
             sn.reason_type, sn.reason_description, sn.status,
             sn.annulled_at, sn.annulled_by, sn.annul_reason,
             sn.created_at, sn.updated_at
      FROM supplier_notes sn
      INNER JOIN branches b ON sn.branch_id = b.id
      INNER JOIN suppliers s ON sn.supplier_id = s.id
      INNER JOIN users u ON sn.user_id = u.id
      LEFT JOIN warehouses w ON sn.warehouse_id = w.id
      LEFT JOIN purchase_invoices pi ON sn.affected_invoice_id = pi.id
      WHERE sn.company_id = ?
    `;
    const params: any[] = [companyId];

    if (filters?.branchId) {
      sql += ` AND sn.branch_id = ?`;
      params.push(filters.branchId);
    }

    if (filters?.supplierId) {
      sql += ` AND sn.supplier_id = ?`;
      params.push(filters.supplierId);
    }

    if (filters?.type) {
      sql += ` AND sn.type = ?`;
      params.push(filters.type);
    }

    if (filters?.status) {
      sql += ` AND sn.status = ?`;
      params.push(filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      sql += ` AND (sn.note_number LIKE ? OR sn.control_number LIKE ? OR s.name LIKE ? OR s.rif LIKE ? OR pi.invoice_number LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    if (filters?.startDate) {
      sql += ` AND DATE(sn.note_date) >= ?`;
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      sql += ` AND DATE(sn.note_date) <= ?`;
      params.push(filters.endDate);
    }

    sql += ` ORDER BY sn.note_date DESC, sn.created_at DESC`;

    const rows = await query<any>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      supplierId: r.supplier_id,
      supplierRif: r.supplier_rif,
      supplierName: r.supplier_name,
      userId: r.user_id,
      userName: r.user_name,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      affectedInvoiceId: r.affected_invoice_id,
      affectedInvoiceNumber: r.affected_invoice_number,
      type: r.type,
      noteNumber: r.note_number,
      controlNumber: r.control_number,
      noteDate: r.note_date,
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      subtotalAmount: Number(r.subtotal_amount),
      taxAmount: Number(r.tax_amount),
      totalAmount: Number(r.total_amount),
      availableBalance: Number(r.available_balance),
      reasonType: r.reason_type,
      reasonDescription: r.reason_description,
      status: r.status,
      annulledAt: r.annulled_at,
      annulledBy: r.annulled_by,
      annulReason: r.annul_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })) as SupplierNote[];
  }

  /**
   * Obtener detalle completo de una nota por su ID
   */
  static async getNoteById(companyId: string, id: string): Promise<SupplierNote | null> {
    const noteRows = await query<any>(
      `SELECT sn.id, sn.company_id, sn.branch_id, b.name as branch_name,
              sn.supplier_id, s.rif as supplier_rif, s.name as supplier_name,
              sn.user_id, u.name as user_name,
              sn.warehouse_id, w.name as warehouse_name,
              sn.affected_invoice_id, pi.invoice_number as affected_invoice_number,
              sn.type, sn.note_number, sn.control_number, sn.note_date,
              sn.currency, sn.exchange_rate,
              sn.subtotal_amount, sn.tax_amount, sn.total_amount, sn.available_balance,
              sn.reason_type, sn.reason_description, sn.status,
              sn.annulled_at, sn.annulled_by, sn.annul_reason,
              sn.created_at, sn.updated_at
       FROM supplier_notes sn
       INNER JOIN branches b ON sn.branch_id = b.id
       INNER JOIN suppliers s ON sn.supplier_id = s.id
       INNER JOIN users u ON sn.user_id = u.id
       LEFT JOIN warehouses w ON sn.warehouse_id = w.id
       LEFT JOIN purchase_invoices pi ON sn.affected_invoice_id = pi.id
       WHERE sn.id = ? AND sn.company_id = ?`,
      [id, companyId]
    );

    if (!noteRows || noteRows.length === 0) {
      return null;
    }

    const r = noteRows[0];

    // Obtener ítems
    const itemRows = await query<any>(
      `SELECT sni.id, sni.note_id, sni.product_id, p.sku, p.name as product_name,
              sni.description, sni.quantity, sni.unit_cost, sni.tax_rate,
              sni.tax_amount, sni.subtotal, sni.total, sni.return_from_inventory
       FROM supplier_note_items sni
       LEFT JOIN products p ON sni.product_id = p.id
       WHERE sni.note_id = ?`,
      [id]
    );

    // Obtener aplicaciones de crédito (si aplica)
    const appRows = await query<any>(
      `SELECT sna.id, sna.note_id, sna.payable_id, sna.amount_applied,
              sna.notes, sna.created_by, u.name as user_name, sna.created_at as applied_date,
              pi.invoice_number
       FROM supplier_note_applications sna
       INNER JOIN users u ON sna.created_by = u.id
       INNER JOIN payables p ON sna.payable_id = p.id
       LEFT JOIN purchase_invoices pi ON p.invoice_id = pi.id
       WHERE sna.note_id = ?
       ORDER BY sna.created_at DESC`,
      [id]
    );

    return {
      id: r.id,
      companyId: r.company_id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      supplierId: r.supplier_id,
      supplierRif: r.supplier_rif,
      supplierName: r.supplier_name,
      userId: r.user_id,
      userName: r.user_name,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      affectedInvoiceId: r.affected_invoice_id,
      affectedInvoiceNumber: r.affected_invoice_number,
      type: r.type,
      noteNumber: r.note_number,
      controlNumber: r.control_number,
      noteDate: r.note_date,
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      subtotalAmount: Number(r.subtotal_amount),
      taxAmount: Number(r.tax_amount),
      totalAmount: Number(r.total_amount),
      availableBalance: Number(r.available_balance),
      reasonType: r.reason_type,
      reasonDescription: r.reason_description,
      status: r.status,
      annulledAt: r.annulled_at,
      annulledBy: r.annulled_by,
      annulReason: r.annul_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      items: itemRows.map((it: any) => ({
        id: it.id,
        noteId: it.note_id,
        productId: it.product_id,
        sku: it.sku,
        productName: it.product_name,
        description: it.description,
        quantity: Number(it.quantity),
        unitCost: Number(it.unit_cost),
        taxRate: Number(it.tax_rate),
        taxAmount: Number(it.tax_amount),
        subtotal: Number(it.subtotal),
        total: Number(it.total),
        returnFromInventory: Boolean(it.return_from_inventory),
      })),
      applications: appRows.map((ap: any) => ({
        id: ap.id,
        noteId: ap.note_id,
        payableId: ap.payable_id,
        userId: ap.created_by,
        userName: ap.user_name,
        amountApplied: Number(ap.amount_applied),
        appliedDate: ap.applied_date,
        invoiceNumber: ap.invoice_number,
        notes: ap.notes,
      })),
    };
  }

  /**
   * Obtener Notas de Crédito de un proveedor con saldo disponible a favor
   */
  static async getSupplierAvailableCreditNotes(companyId: string, supplierId: string) {
    const rows = await query<any>(
      `SELECT sn.id, sn.note_number, sn.control_number, sn.note_date,
              sn.total_amount, sn.available_balance, sn.currency, sn.exchange_rate,
              sn.reason_type, sn.reason_description, b.name as branch_name
       FROM supplier_notes sn
       INNER JOIN branches b ON sn.branch_id = b.id
       WHERE sn.company_id = ?
         AND sn.supplier_id = ?
         AND sn.type = 'CREDIT'
         AND sn.status = 'ACTIVE'
         AND sn.available_balance > 0.009
       ORDER BY sn.note_date ASC`,
      [companyId, supplierId]
    );

    return rows.map((r) => ({
      id: r.id,
      noteNumber: r.note_number,
      controlNumber: r.control_number,
      noteDate: r.note_date,
      totalAmount: Number(r.total_amount),
      availableBalance: Number(r.available_balance),
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      reasonType: r.reason_type,
      reasonDescription: r.reason_description,
      branchName: r.branch_name,
    }));
  }

  /**
   * Obtener facturas de compra del proveedor con saldos de CxP pendientes
   */
  static async getSupplierInvoices(companyId: string, supplierId: string) {
    const rows = await query<any>(
      `SELECT pi.id, pi.invoice_number, pi.control_number, pi.invoice_date,
              pi.total_amount, pi.status,
              p.id as payable_id, p.amount_balance as payable_balance, p.status as payable_status
       FROM purchase_invoices pi
       INNER JOIN branches b ON pi.branch_id = b.id
       LEFT JOIN payables p ON pi.id = p.invoice_id
       WHERE pi.supplier_id = ?
         AND b.company_id = ?
         AND pi.status != 'ANNULLED'
       ORDER BY pi.invoice_date DESC`,
      [supplierId, companyId]
    );

    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      controlNumber: r.control_number,
      invoiceDate: r.invoice_date,
      totalAmount: Number(r.total_amount),
      status: r.status,
      payableId: r.payable_id || null,
      payableBalance: r.payable_balance !== null ? Number(r.payable_balance) : null,
      payableStatus: r.payable_status || null,
    }));
  }

  /**
   * Obtener ítems facturados en una factura de compra para procesar devoluciones
   */
  static async getInvoiceItems(companyId: string, invoiceId: string) {
    const rows = await query<any>(
      `SELECT pii.product_id, pii.quantity, pii.unit_price, pii.tax_rate,
              p.sku, p.name as product_name
       FROM purchase_invoice_items pii
       INNER JOIN purchase_invoices pi ON pii.invoice_id = pi.id
       INNER JOIN branches b ON pi.branch_id = b.id
       LEFT JOIN products p ON pii.product_id = p.id
       WHERE pii.invoice_id = ? AND b.company_id = ?`,
      [invoiceId, companyId]
    );

    // Obtener cantidades ya acreditadas previamente en notas no anuladas
    const creditedRows = await query<any>(
      `SELECT sni.product_id, SUM(sni.quantity) as total_credited
       FROM supplier_note_items sni
       INNER JOIN supplier_notes sn ON sni.note_id = sn.id
       WHERE sn.affected_invoice_id = ?
         AND sn.type = 'CREDIT'
         AND sn.status != 'ANNULLED'
       GROUP BY sni.product_id`,
      [invoiceId]
    );

    const creditedMap = new Map<string, number>();
    for (const c of creditedRows) {
      if (c.product_id) {
        creditedMap.set(c.product_id, Number(c.total_credited));
      }
    }

    return rows.map((r) => {
      const invoiced = Number(r.quantity);
      const credited = creditedMap.get(r.product_id) || 0;
      const available = Math.max(0, invoiced - credited);

      return {
        productId: r.product_id,
        sku: r.sku,
        productName: r.product_name,
        invoicedQuantity: invoiced,
        alreadyCreditedQuantity: credited,
        availableQuantity: available,
        unitCost: Number(r.unit_price),
        taxRate: Number(r.tax_rate),
      };
    });
  }

  /**
   * Emitir nueva Nota de Crédito o Débito a Proveedor
   */
  static async createNote(companyId: string, userId: string, data: CreateSupplierNoteInput) {
    return withTransaction(async (conn) => {
      // 1. Validar Proveedor
      const [suppRows]: any = await conn.query(
        `SELECT id, name, rif, is_active FROM suppliers WHERE id = ? AND company_id = ?`,
        [data.supplierId, companyId]
      );
      if (!suppRows || suppRows.length === 0) {
        throw new Error('Proveedor no encontrado');
      }

      // 2. Si hay factura afectada, verificar pertenencia
      let affectedInvoice: any = null;
      let affectedPayable: any = null;
      if (data.affectedInvoiceId) {
        const [invRows]: any = await conn.query(
          `SELECT pi.id, pi.invoice_number, pi.total_amount, pi.branch_id,
                  p.id as payable_id, p.amount_balance, p.amount_paid, p.amount_total, p.status as payable_status
           FROM purchase_invoices pi
           INNER JOIN branches b ON pi.branch_id = b.id
           LEFT JOIN payables p ON pi.id = p.invoice_id
           WHERE pi.id = ? AND pi.supplier_id = ? AND b.company_id = ?`,
          [data.affectedInvoiceId, data.supplierId, companyId]
        );
        if (!invRows || invRows.length === 0) {
          throw new Error('La factura de compra seleccionada no pertenece a este proveedor');
        }
        affectedInvoice = invRows[0];
        if (affectedInvoice.payable_id) {
          affectedPayable = {
            id: affectedInvoice.payable_id,
            amountTotal: Number(affectedInvoice.amount_total),
            amountPaid: Number(affectedInvoice.amount_paid),
            amountBalance: Number(affectedInvoice.amount_balance),
            status: affectedInvoice.payable_status,
          };
        }
      }

      // 3. Calcular totales y validar renglones
      let calculatedSubtotal = 0;
      let calculatedTax = 0;
      const itemsToInsert: any[] = [];

      for (const item of data.items) {
        const qty = Number(item.quantity);
        const cost = Number(item.unitCost);
        const taxRate = Number(item.taxRate || 0);

        const subtotal = Number((qty * cost).toFixed(2));
        const tax = Number(((subtotal * taxRate) / 100).toFixed(2));
        const total = Number((subtotal + tax).toFixed(2));

        calculatedSubtotal += subtotal;
        calculatedTax += tax;

        itemsToInsert.push({
          id: crypto.randomUUID(),
          productId: item.productId || null,
          description: item.description.trim(),
          quantity: qty,
          unitCost: cost,
          taxRate,
          taxAmount: tax,
          subtotal,
          total,
          returnFromInventory: Boolean(item.returnFromInventory),
        });
      }

      calculatedSubtotal = Number(calculatedSubtotal.toFixed(2));
      calculatedTax = Number(calculatedTax.toFixed(2));
      const calculatedTotal = Number((calculatedSubtotal + calculatedTax).toFixed(2));

      // 4. Determinar número de nota
      const noteNumber = data.noteNumber && data.noteNumber.trim()
        ? data.noteNumber.trim().toUpperCase()
        : await this.getNextNoteNumber(conn, data.branchId, data.type);

      const noteId = crypto.randomUUID();
      let availableBalance = 0;
      let noteStatus: 'ACTIVE' | 'APPLIED' = 'ACTIVE';

      // 5. Lógica financiera según tipo de nota
      if (data.type === 'CREDIT') {
        availableBalance = calculatedTotal;

        // Si se seleccionó auto-aplicar y la factura tiene saldo en CxP
        if (data.autoApplyToInvoice && affectedPayable && affectedPayable.amountBalance > 0) {
          const applyAmount = Math.min(availableBalance, affectedPayable.amountBalance);

          if (applyAmount > 0) {
            const newAmountPaid = Number((affectedPayable.amountPaid + applyAmount).toFixed(2));
            const newBalance = Number((affectedPayable.amountTotal - newAmountPaid).toFixed(2));
            const newPayableStatus = newBalance <= 0.009 ? 'PAID' : 'PARTIAL';

            // Actualizar cuenta por pagar
            await conn.query(
              `UPDATE payables SET amount_paid = ?, status = ? WHERE id = ?`,
              [newAmountPaid, newPayableStatus, affectedPayable.id]
            );

            // Registrar aplicación de crédito
            const appId = crypto.randomUUID();
            await conn.query(
              `INSERT INTO supplier_note_applications (id, note_id, payable_id, amount_applied, notes, created_by)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                appId,
                noteId,
                affectedPayable.id,
                applyAmount,
                `Auto-aplicado al emitir ${noteNumber}`,
                userId,
              ]
            );

            // Registrar abono en purchase_payments para rastreabilidad contable
            const payId = crypto.randomUUID();
            await conn.query(
              `INSERT INTO purchase_payments (
                id, invoice_id, payable_id, method, amount_ves, amount_usd,
                exchange_rate, reference_number, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                payId,
                affectedInvoice.id,
                affectedPayable.id,
                'CREDIT_NOTE',
                Number((applyAmount * (data.exchangeRate || 1)).toFixed(2)),
                applyAmount,
                data.exchangeRate || 1.0,
                noteNumber,
                `Amortización por Nota de Crédito ${noteNumber}`,
              ]
            );

            // Si se saldó totalmente la factura
            if (newPayableStatus === 'PAID') {
              await conn.query(
                `UPDATE purchase_invoices SET status = 'PAID' WHERE id = ?`,
                [affectedInvoice.id]
              );
            }

            availableBalance = Number((availableBalance - applyAmount).toFixed(2));
            if (availableBalance <= 0.009) {
              noteStatus = 'APPLIED';
              availableBalance = 0;
            }
          }
        }

        // Si hay devolución física a inventario (returnFromInventory)
        if (data.warehouseId) {
          for (const item of itemsToInsert) {
            if (item.returnFromInventory && item.productId) {
              // Descontar inventario físico del depósito seleccionado
              await conn.query(
                `UPDATE product_warehouse_stock
                 SET physical_stock = physical_stock - ?,
                     available_stock = available_stock - ?
                 WHERE product_id = ? AND warehouse_id = ?`,
                [item.quantity, item.quantity, item.productId, data.warehouseId]
              );

              // Registrar movimiento en el kardex si la tabla existe
              const movementId = crypto.randomUUID();
              await conn.query(
                `INSERT INTO inventory_movements (
                  id, company_id, branch_id, warehouse_id, product_id, user_id,
                  movement_type, quantity, unit_cost, reference_type, reference_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, 'OUT_SUPPLIER_RETURN', ?, ?, 'SUPPLIER_NOTE', ?, ?)`,
                [
                  movementId,
                  companyId,
                  data.branchId,
                  data.warehouseId,
                  item.productId,
                  userId,
                  item.quantity,
                  item.unitCost,
                  noteId,
                  `Devolución a proveedor según ${noteNumber}`,
                ]
              ).catch(() => {
                // En caso de que inventory_movements tenga otra estructura, continúa de forma resiliente
              });
            }
          }
        }
      } else {
        // NOTA DE DÉBITO (Aumenta la obligación de pago)
        availableBalance = 0;
        noteStatus = 'ACTIVE';

        // Si la factura afectada tiene una cuenta por pagar abierta, aumentamos el total por pagar
        if (affectedPayable) {
          const newAmountTotal = Number((affectedPayable.amountTotal + calculatedTotal).toFixed(2));
          const newBalance = Number((newAmountTotal - affectedPayable.amountPaid).toFixed(2));
          const newPayableStatus = newBalance > 0.009 ? (affectedPayable.amountPaid > 0 ? 'PARTIAL' : 'PENDING') : 'PAID';

          await conn.query(
            `UPDATE payables SET amount_total = ?, status = ? WHERE id = ?`,
            [newAmountTotal, newPayableStatus, affectedPayable.id]
          );
        } else {
          // Si no tiene cuenta por pagar abierta o no hay factura afectada, creamos una obligación en payables vinculada a esta nota
          const newPayableId = crypto.randomUUID();
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 15);

          await conn.query(
            `INSERT INTO payables (
              id, branch_id, supplier_id, invoice_id, supplier_note_id,
              amount_total, amount_paid, due_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 'PENDING')`,
            [
              newPayableId,
              data.branchId,
              data.supplierId,
              data.affectedInvoiceId || null,
              noteId,
              calculatedTotal,
              dueDate.toISOString().split('T')[0],
            ]
          );
        }
      }

      // 6. Insertar cabecera de la nota
      await conn.query(
        `INSERT INTO supplier_notes (
          id, company_id, branch_id, supplier_id, user_id, warehouse_id,
          affected_invoice_id, type, note_number, control_number, note_date,
          currency, exchange_rate, subtotal_amount, tax_amount, total_amount,
          available_balance, reason_type, reason_description, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          noteId,
          companyId,
          data.branchId,
          data.supplierId,
          userId,
          data.warehouseId || null,
          data.affectedInvoiceId || null,
          data.type,
          noteNumber,
          data.controlNumber ? data.controlNumber.trim() : null,
          data.noteDate || new Date().toISOString(),
          data.currency || 'USD',
          data.exchangeRate || 1.0,
          calculatedSubtotal,
          calculatedTax,
          calculatedTotal,
          availableBalance,
          data.reasonType,
          data.reasonDescription.trim(),
          noteStatus,
        ]
      );

      // 7. Insertar renglones de la nota
      for (const item of itemsToInsert) {
        await conn.query(
          `INSERT INTO supplier_note_items (
            id, note_id, product_id, description, quantity, unit_cost,
            tax_rate, tax_amount, subtotal, total, return_from_inventory
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            noteId,
            item.productId,
            item.description,
            item.quantity,
            item.unitCost,
            item.taxRate,
            item.taxAmount,
            item.subtotal,
            item.total,
            item.returnFromInventory ? 1 : 0,
          ]
        );
      }

      return {
        id: noteId,
        noteNumber,
        type: data.type,
        totalAmount: calculatedTotal,
        availableBalance,
        status: noteStatus,
      };
    });
  }

  /**
   * Aplicar saldo de una Nota de Crédito de Proveedor a una Cuenta por Pagar pendiente
   */
  static async applyCreditNote(companyId: string, userId: string, data: ApplySupplierCreditNoteInput) {
    return withTransaction(async (conn) => {
      // 1. Validar Nota de Crédito
      const [noteRows]: any = await conn.query(
        `SELECT sn.*, s.name as supplier_name, s.rif as supplier_rif
         FROM supplier_notes sn
         INNER JOIN suppliers s ON sn.supplier_id = s.id
         WHERE sn.id = ? AND sn.company_id = ? FOR UPDATE`,
        [data.noteId, companyId]
      );

      if (!noteRows || noteRows.length === 0) {
        throw new Error('Nota de Crédito no encontrada');
      }

      const note = noteRows[0];
      if (note.type !== 'CREDIT') {
        throw new Error('Solo se pueden aplicar Notas de Crédito');
      }
      if (note.status !== 'ACTIVE' || Number(note.available_balance) <= 0.009) {
        throw new Error('Esta Nota de Crédito no tiene saldo disponible para aplicar');
      }

      const noteAvailable = Number(note.available_balance);
      const applyAmount = Number(data.amount);

      if (applyAmount <= 0) {
        throw new Error('El monto a aplicar debe ser mayor a 0');
      }
      if (applyAmount > noteAvailable + 0.01) {
        throw new Error(`El monto ($${applyAmount.toFixed(2)}) excede el saldo disponible de la nota ($${noteAvailable.toFixed(2)})`);
      }

      // 2. Validar Cuenta por Pagar
      const [payRows]: any = await conn.query(
        `SELECT p.*, pi.id as invoice_id, pi.invoice_number, b.company_id
         FROM payables p
         INNER JOIN branches b ON p.branch_id = b.id
         LEFT JOIN purchase_invoices pi ON p.invoice_id = pi.id
         WHERE p.id = ? AND b.company_id = ? FOR UPDATE`,
        [data.payableId, companyId]
      );

      if (!payRows || payRows.length === 0) {
        throw new Error('Cuenta por pagar no encontrada');
      }

      const payable = payRows[0];
      if (payable.supplier_id !== note.supplier_id) {
        throw new Error('La cuenta por pagar no pertenece al mismo proveedor de la Nota de Crédito');
      }

      const payBalance = Number(payable.amount_balance);
      if (payBalance <= 0.009) {
        throw new Error('Esta cuenta por pagar ya se encuentra totalmente saldada');
      }

      if (applyAmount > payBalance + 0.01) {
        throw new Error(`El monto a aplicar ($${applyAmount.toFixed(2)}) supera el saldo pendiente de la cuenta por pagar ($${payBalance.toFixed(2)})`);
      }

      // 3. Descontar saldo de la nota
      const newNoteAvailable = Number(Math.max(0, noteAvailable - applyAmount).toFixed(2));
      const newNoteStatus = newNoteAvailable <= 0.009 ? 'APPLIED' : 'ACTIVE';

      await conn.query(
        `UPDATE supplier_notes
         SET available_balance = ?, status = ?
         WHERE id = ?`,
        [newNoteAvailable, newNoteStatus, note.id]
      );

      // 4. Actualizar cuenta por pagar
      const newPayAmountPaid = Number((Number(payable.amount_paid) + applyAmount).toFixed(2));
      const newPayBalance = Number((Number(payable.amount_total) - newPayAmountPaid).toFixed(2));
      const newPayStatus = newPayBalance <= 0.009 ? 'PAID' : 'PARTIAL';

      await conn.query(
        `UPDATE payables SET amount_paid = ?, status = ? WHERE id = ?`,
        [newPayAmountPaid, newPayStatus, payable.id]
      );

      // 5. Registrar en tabla de aplicaciones
      const appId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO supplier_note_applications (id, note_id, payable_id, amount_applied, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [appId, note.id, payable.id, applyAmount, data.notes || null, userId]
      );

      // 6. Registrar abono en purchase_payments
      if (payable.invoice_id) {
        const payId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO purchase_payments (
            id, invoice_id, payable_id, method, amount_ves, amount_usd,
            exchange_rate, reference_number, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            payId,
            payable.invoice_id,
            payable.id,
            'CREDIT_NOTE',
            Number((applyAmount * Number(note.exchange_rate || 1)).toFixed(2)),
            applyAmount,
            Number(note.exchange_rate || 1.0),
            note.note_number,
            data.notes || `Aplicación de Nota de Crédito ${note.note_number}`,
          ]
        );

        if (newPayStatus === 'PAID') {
          await conn.query(
            `UPDATE purchase_invoices SET status = 'PAID' WHERE id = ?`,
            [payable.invoice_id]
          );
        }
      }

      return {
        applicationId: appId,
        noteId: note.id,
        noteNumber: note.note_number,
        payableId: payable.id,
        amountApplied: applyAmount,
        noteRemainingBalance: newNoteAvailable,
        payableRemainingBalance: Math.max(0, newPayBalance),
        payableStatus: newPayStatus,
      };
    });
  }

  /**
   * Anular una Nota de Crédito o Débito
   */
  static async annulNote(companyId: string, userId: string, id: string, reason: string) {
    return withTransaction(async (conn) => {
      // 1. Obtener nota
      const [noteRows]: any = await conn.query(
        `SELECT * FROM supplier_notes WHERE id = ? AND company_id = ? FOR UPDATE`,
        [id, companyId]
      );

      if (!noteRows || noteRows.length === 0) {
        throw new Error('Nota no encontrada');
      }

      const note = noteRows[0];
      if (note.status === 'ANNULLED') {
        throw new Error('La nota ya se encuentra anulada');
      }

      // 2. Si es Nota de Crédito, revertir las aplicaciones realizadas
      if (note.type === 'CREDIT') {
        const [appRows]: any = await conn.query(
          `SELECT * FROM supplier_note_applications WHERE note_id = ?`,
          [note.id]
        );

        for (const app of appRows) {
          const applied = Number(app.amount_applied);

          // Restablecer el saldo en la cuenta por pagar
          await conn.query(
            `UPDATE payables
             SET amount_paid = GREATEST(0, amount_paid - ?),
                 status = CASE
                   WHEN (amount_total - (amount_paid - ?)) <= 0.009 THEN 'PAID'
                   WHEN (amount_paid - ?) > 0 THEN 'PARTIAL'
                   ELSE 'PENDING'
                 END
             WHERE id = ?`,
            [applied, applied, applied, app.payable_id]
          );

          // Eliminar abono correspondiente en purchase_payments
          await conn.query(
            `DELETE FROM purchase_payments
             WHERE payable_id = ? AND method = 'CREDIT_NOTE' AND reference_number = ?`,
            [app.payable_id, note.note_number]
          );
        }

        // Eliminar aplicaciones
        await conn.query(`DELETE FROM supplier_note_applications WHERE note_id = ?`, [note.id]);

        // Revertir inventario si hubo devolución física
        if (note.warehouse_id) {
          const [itemRows]: any = await conn.query(
            `SELECT product_id, quantity, return_from_inventory FROM supplier_note_items WHERE note_id = ?`,
            [note.id]
          );

          for (const item of itemRows) {
            if (item.return_from_inventory && item.product_id) {
              await conn.query(
                `UPDATE product_warehouse_stock
                 SET physical_stock = physical_stock + ?,
                     available_stock = available_stock + ?
                 WHERE product_id = ? AND warehouse_id = ?`,
                [item.quantity, item.quantity, item.product_id, note.warehouse_id]
              );
            }
          }
        }
      } else {
        // NOTA DE DÉBITO: Revertir aumento de deuda
        if (note.affected_invoice_id) {
          const [payRows]: any = await conn.query(
            `SELECT id, amount_total, amount_paid FROM payables WHERE invoice_id = ?`,
            [note.affected_invoice_id]
          );
          if (payRows && payRows.length > 0) {
            const p = payRows[0];
            const newTotal = Math.max(0, Number(p.amount_total) - Number(note.total_amount));
            const newBalance = newTotal - Number(p.amount_paid);
            const newStatus = newBalance <= 0.009 ? 'PAID' : (Number(p.amount_paid) > 0 ? 'PARTIAL' : 'PENDING');

            await conn.query(
              `UPDATE payables SET amount_total = ?, status = ? WHERE id = ?`,
              [newTotal, newStatus, p.id]
            );
          }
        } else {
          // Si tenía cuenta por pagar directa vinculada a la nota de débito
          await conn.query(`DELETE FROM payables WHERE supplier_note_id = ?`, [note.id]);
        }
      }

      // 3. Marcar nota como anulada
      await conn.query(
        `UPDATE supplier_notes
         SET status = 'ANNULLED',
             available_balance = 0.00,
             annulled_at = CURRENT_TIMESTAMP,
             annulled_by = ?,
             annul_reason = ?
         WHERE id = ?`,
        [userId, reason.trim(), note.id]
      );

      return {
        id: note.id,
        status: 'ANNULLED',
        annulReason: reason.trim(),
      };
    });
  }
}
