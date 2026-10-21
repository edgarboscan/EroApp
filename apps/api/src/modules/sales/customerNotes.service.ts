import { query, withTransaction } from '../../db';
import {
  CreateCustomerNoteInput,
  ApplyCustomerCreditNoteInput,
  CustomerNote,
  CustomerNoteItem,
  CustomerNoteApplication,
} from '@ero/shared';
import crypto from 'crypto';

export class CustomerNotesService {
  /**
   * Genera el siguiente número correlativo para la nota (NC-00000001 o ND-00000001)
   */
  private static async getNextNoteNumber(conn: any, branchId: string, type: 'CREDIT' | 'DEBIT'): Promise<string> {
    const prefix = type === 'CREDIT' ? 'NC' : 'ND';
    const [rows]: any = await conn.query(
      `SELECT note_number FROM customer_notes
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
   * Emite una nueva Nota de Crédito o Nota de Débito
   */
  static async createNote(companyId: string, userId: string, data: CreateCustomerNoteInput) {
    return withTransaction(async (conn) => {
      // 1. Validar Cliente y Bloqueo
      const [custRows]: any = await conn.query(
        `SELECT id, name, doc_type, doc_number, is_blocked, block_reason
         FROM customers
         WHERE id = ? AND company_id = ?`,
        [data.customerId, companyId]
      );

      if (!custRows || custRows.length === 0) {
        throw new Error('Cliente no encontrado');
      }

      const customer = custRows[0];
      if (customer.is_blocked) {
        throw new Error(`El cliente se encuentra BLOQUEADO (${customer.block_reason || 'Sin motivo especificado'}). No se pueden emitir notas.`);
      }

      // 2. Si hay factura afectada, verificar pertenencia y límites de productos
      let affectedInvoice: any = null;
      if (data.affectedInvoiceId) {
        const [invRows]: any = await conn.query(
          `SELECT id, invoice_number, invoice_date, total_amount, branch_id, currency, exchange_rate
           FROM sales_invoices
           WHERE id = ? AND customer_id = ?`,
          [data.affectedInvoiceId, data.customerId]
        );
        if (!invRows || invRows.length === 0) {
          throw new Error('La factura afectada seleccionada no pertenece a este cliente');
        }
        affectedInvoice = invRows[0];

        // Si es Nota de Crédito, validar que los productos no excedan lo facturado ni lo disponible
        if (data.type === 'CREDIT') {
          // Obtener cantidades facturadas por producto
          const [invItemRows]: any = await conn.query(
            `SELECT sii.product_id, SUM(sii.quantity) as total_invoiced, p.sku, p.name
             FROM sales_invoice_items sii
             LEFT JOIN products p ON sii.product_id = p.id
             WHERE sii.invoice_id = ?
             GROUP BY sii.product_id, p.sku, p.name`,
            [data.affectedInvoiceId]
          );

          const invoicedMap = new Map<string, { quantity: number; sku: string; name: string }>();
          for (const row of invItemRows) {
            if (row.product_id) {
              invoicedMap.set(row.product_id, {
                quantity: Number(row.total_invoiced),
                sku: row.sku || '',
                name: row.name || '',
              });
            }
          }

          // Obtener cantidades ya acreditadas en notas de crédito previas no anuladas para esta factura
          const [creditedRows]: any = await conn.query(
            `SELECT cni.product_id, SUM(cni.quantity) as total_credited
             FROM customer_note_items cni
             INNER JOIN customer_notes cn ON cni.note_id = cn.id
             WHERE cn.affected_invoice_id = ?
               AND cn.type = 'CREDIT'
               AND cn.status != 'ANNULLED'
               AND cni.product_id IS NOT NULL
             GROUP BY cni.product_id`,
            [data.affectedInvoiceId]
          );

          const creditedMap = new Map<string, number>();
          for (const row of creditedRows) {
            if (row.product_id) {
              creditedMap.set(row.product_id, Number(row.total_credited));
            }
          }

          // Agrupar cantidades solicitadas en la nota actual por producto
          const requestedByProduct = new Map<string, { quantity: number; description: string }>();
          for (const item of data.items) {
            if (item.productId) {
              const current = requestedByProduct.get(item.productId) || { quantity: 0, description: item.description };
              current.quantity += Number(item.quantity);
              requestedByProduct.set(item.productId, current);
            }
          }

          // Verificar límites para cada producto
          for (const [prodId, req] of requestedByProduct.entries()) {
            const invProd = invoicedMap.get(prodId);
            if (!invProd) {
              if (data.reasonType === 'RETURN' || data.reasonType === 'PRICE_CORRECTION') {
                throw new Error(
                  `El producto "${req.description}" no forma parte de la Factura N° ${affectedInvoice.invoice_number}.`
                );
              }
            } else {
              const invoicedQty = invProd.quantity;
              const alreadyCreditedQty = creditedMap.get(prodId) || 0;
              const availableQty = Math.max(0, Number((invoicedQty - alreadyCreditedQty).toFixed(4)));

              if (req.quantity > availableQty + 0.0001) {
                const prodDisplayName = invProd.name || req.description;
                throw new Error(
                  `La cantidad a acreditar para "${prodDisplayName}" (${req.quantity}) excede la cantidad disponible de la Factura N° ${affectedInvoice.invoice_number}. ` +
                  `(Facturado original: ${invoicedQty}, Ya acreditado previamente: ${alreadyCreditedQty}, Cantidad máxima disponible: ${availableQty})`
                );
              }
            }
          }

          // Verificar monto total acumulado de notas de crédito vs monto de la factura
          const [totalCreditedRows]: any = await conn.query(
            `SELECT COALESCE(SUM(total_amount), 0) as total_credited_amount
             FROM customer_notes
             WHERE affected_invoice_id = ?
               AND type = 'CREDIT'
               AND status != 'ANNULLED'`,
            [data.affectedInvoiceId]
          );
          const totalAlreadyCreditedAmount = Number(totalCreditedRows[0]?.total_credited_amount || 0);
          const invoicedTotalAmount = Number(affectedInvoice.total_amount);

          let noteSubtotal = 0;
          let noteTax = 0;
          for (const it of data.items) {
            const q = Number(it.quantity);
            const p = Number(it.unitPrice);
            const r = Number(it.taxRate ?? 16);
            const sub = Number((q * p).toFixed(2));
            noteSubtotal += sub;
            noteTax += r > 0 ? Number(((sub * r) / 100).toFixed(2)) : 0;
          }
          const incomingNoteTotal = Number((noteSubtotal + noteTax).toFixed(2));

          if (totalAlreadyCreditedAmount + incomingNoteTotal > invoicedTotalAmount + 0.01) {
            const availableAmount = Math.max(0, Number((invoicedTotalAmount - totalAlreadyCreditedAmount).toFixed(2)));
            throw new Error(
              `El total de la Nota de Crédito ($${incomingNoteTotal.toFixed(2)}) supera el saldo disponible acreditable de la Factura N° ${affectedInvoice.invoice_number}. ` +
              `(Total Factura: $${invoicedTotalAmount.toFixed(2)}, Ya acreditado en notas previas: $${totalAlreadyCreditedAmount.toFixed(2)}, Monto disponible: $${availableAmount.toFixed(2)})`
            );
          }
        }
      }

      // 3. Validar almacén si hay devolución física a inventario
      const hasReturns = data.items.some((it) => it.returnToInventory && it.productId);
      if (hasReturns && !data.warehouseId) {
        throw new Error('Debe seleccionar un almacén de destino para el reingreso físico de los productos devueltos');
      }

      // 4. Calcular importes e impuestos
      let baseExempt = 0;
      let baseTaxable = 0;
      let totalTax = 0;

      const processedItems = data.items.map((it) => {
        const qty = Number(it.quantity);
        const price = Number(it.unitPrice);
        const rate = Number(it.taxRate ?? 16);
        const subtotal = Number((qty * price).toFixed(2));
        const tax = rate > 0 ? Number(((subtotal * rate) / 100).toFixed(2)) : 0;

        if (rate === 0) {
          baseExempt += subtotal;
        } else {
          baseTaxable += subtotal;
        }
        totalTax += tax;

        return {
          id: crypto.randomUUID(),
          productId: it.productId || null,
          description: it.description.trim(),
          quantity: qty,
          unitPrice: price,
          taxRate: rate,
          taxAmount: tax,
          subtotal,
          returnToInventory: Boolean(it.returnToInventory && it.productId),
        };
      });

      const totalAmount = Number((baseExempt + baseTaxable + totalTax).toFixed(2));
      const noteCurrency = data.currency || (affectedInvoice ? affectedInvoice.currency : 'USD');
      const noteExchangeRate = data.exchangeRate || (affectedInvoice ? Number(affectedInvoice.exchange_rate) : 1.0);
      const noteNumber = await this.getNextNoteNumber(conn, data.branchId, data.type);
      const noteId = crypto.randomUUID();

      // 5. Insertar en customer_notes
      await conn.query(
        `INSERT INTO customer_notes (
          id, company_id, branch_id, customer_id, user_id, warehouse_id,
          affected_invoice_id, type, note_number, control_number, issue_date, due_date,
          reason_type, reason_description, currency, exchange_rate,
          base_exempt_amount, base_taxable_amount, tax_amount, total_amount,
          amount_applied, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 'ACTIVE', NOW())`,
        [
          noteId,
          companyId,
          data.branchId,
          data.customerId,
          userId,
          data.warehouseId || null,
          data.affectedInvoiceId || null,
          data.type,
          noteNumber,
          data.controlNumber ? data.controlNumber.trim() : null,
          data.type === 'DEBIT' && data.dueDate ? data.dueDate : null,
          data.reasonType,
          data.reasonDescription.trim(),
          noteCurrency,
          noteExchangeRate,
          baseExempt,
          baseTaxable,
          totalTax,
          totalAmount,
        ]
      );

      // 6. Insertar renglones en customer_note_items y procesar retorno de inventario si aplica
      for (const item of processedItems) {
        await conn.query(
          `INSERT INTO customer_note_items (
            id, note_id, product_id, description, quantity, unit_price,
            tax_rate, tax_amount, subtotal, return_to_inventory
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            noteId,
            item.productId,
            item.description,
            item.quantity,
            item.unitPrice,
            item.taxRate,
            item.taxAmount,
            item.subtotal,
            item.returnToInventory ? 1 : 0,
          ]
        );

        // Reingreso físico de stock si es devolución
        if (data.type === 'CREDIT' && item.returnToInventory && item.productId && data.warehouseId) {
          const [stockRows]: any = await conn.query(
            `SELECT current_stock FROM product_stocks
             WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`,
            [item.productId, data.warehouseId]
          );

          let prevStock = 0;
          let newStock = item.quantity;

          if (stockRows && stockRows.length > 0) {
            prevStock = Number(stockRows[0].current_stock);
            newStock = prevStock + item.quantity;
            await conn.query(
              `UPDATE product_stocks
               SET current_stock = ?, last_movement_at = NOW()
               WHERE product_id = ? AND warehouse_id = ?`,
              [newStock, item.productId, data.warehouseId]
            );
          } else {
            await conn.query(
              `INSERT INTO product_stocks (
                product_id, warehouse_id, current_stock, reserved_stock, last_movement_at
              ) VALUES (?, ?, ?, 0.00, NOW())`,
              [item.productId, data.warehouseId, newStock]
            );
          }

          // Registrar en inventory_movements
          await conn.query(
            `INSERT INTO inventory_movements (
              id, branch_id, warehouse_id, product_id, user_id,
              movement_type, quantity, unit_cost, total_cost,
              previous_stock, new_stock, reference_document, reason, created_at
            ) VALUES (?, ?, ?, ?, ?, 'IN', ?, 0.0000, 0.0000, ?, ?, ?, ?, NOW())`,
            [
              crypto.randomUUID(),
              data.branchId,
              data.warehouseId,
              item.productId,
              userId,
              item.quantity,
              prevStock,
              newStock,
              noteNumber,
              `Devolución de cliente s/ Nota de Crédito ${noteNumber} (${item.description})`,
            ]
          );
        }
      }

      // 7. Si es NOTA DE DÉBITO: Generar automáticamente la cuenta por cobrar en receivables
      let generatedReceivableId: string | null = null;
      if (data.type === 'DEBIT') {
        generatedReceivableId = crypto.randomUUID();
        const dueDate = data.dueDate || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

        await conn.query(
          `INSERT INTO receivables (
            id, branch_id, customer_id, invoice_id, debit_note_id, document_type,
            amount_total, amount_paid, due_date, status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'DEBIT_NOTE', ?, 0.00, ?, 'PENDING', NOW())`,
          [
            generatedReceivableId,
            data.branchId,
            data.customerId,
            data.affectedInvoiceId || null,
            noteId,
            totalAmount,
            dueDate,
          ]
        );
      }

      // 8. Si es NOTA DE CRÉDITO y se solicitó auto-aplicar a la factura afectada
      let appliedAmount = 0;
      if (data.type === 'CREDIT' && data.autoApplyToInvoice && data.affectedInvoiceId) {
        const [recRows]: any = await conn.query(
          `SELECT id, amount_total, amount_paid, status
           FROM receivables
           WHERE invoice_id = ? AND customer_id = ? AND status IN ('PENDING', 'PARTIAL', 'OVERDUE')
           FOR UPDATE`,
          [data.affectedInvoiceId, data.customerId]
        );

        if (recRows && recRows.length > 0) {
          const rec = recRows[0];
          const pendingBalance = Number(rec.amount_total) - Number(rec.amount_paid);
          appliedAmount = Math.min(totalAmount, pendingBalance);

          if (appliedAmount > 0) {
            const appId = crypto.randomUUID();
            await conn.query(
              `INSERT INTO customer_note_applications (
                id, note_id, receivable_id, user_id, amount_applied, applied_date, notes
              ) VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
              [
                appId,
                noteId,
                rec.id,
                userId,
                appliedAmount,
                `Aplicación automática de NC ${noteNumber} a Factura ${affectedInvoice?.invoice_number || ''}`,
              ]
            );

            // Actualizar Nota de Crédito
            const isNoteFullyApplied = appliedAmount >= totalAmount - 0.001;
            await conn.query(
              `UPDATE customer_notes
               SET amount_applied = ?, status = ?
               WHERE id = ?`,
              [appliedAmount, isNoteFullyApplied ? 'APPLIED' : 'ACTIVE', noteId]
            );

            // Actualizar Cuenta por Cobrar
            const newPaid = Number(rec.amount_paid) + appliedAmount;
            const isRecPaid = newPaid >= Number(rec.amount_total) - 0.001;
            await conn.query(
              `UPDATE receivables
               SET amount_paid = ?, status = ?
               WHERE id = ?`,
              [newPaid, isRecPaid ? 'PAID' : 'PARTIAL', rec.id]
            );

            if (isRecPaid) {
              await conn.query(
                `UPDATE sales_invoices SET status = 'PAID' WHERE id = ?`,
                [data.affectedInvoiceId]
              );
            }
          }
        }
      }

      // 9. Registrar auditoría
      await conn.query(
        `INSERT INTO audit_logs (
          id, company_id, branch_id, user_id, module, action, entity, entity_id, after_json
        ) VALUES (?, ?, ?, ?, 'sales', 'CREATE_CUSTOMER_NOTE', 'customer_notes', ?, ?)`,
        [
          crypto.randomUUID(),
          companyId,
          data.branchId,
          userId,
          noteId,
          JSON.stringify({
            noteNumber,
            type: data.type,
            customerId: data.customerId,
            customerName: customer.name,
            totalAmount,
            reason: data.reasonDescription,
          }),
        ]
      );

      return {
        id: noteId,
        noteNumber,
        type: data.type,
        totalAmount,
        amountApplied: appliedAmount,
        amountBalance: totalAmount - appliedAmount,
        status: (appliedAmount >= totalAmount - 0.001 && totalAmount > 0) ? 'APPLIED' : 'ACTIVE',
        generatedReceivableId,
      };
    });
  }

  /**
   * Obtiene la lista de Notas de Crédito y Débito con filtros
   */
  static async getNotes(
    companyId: string,
    filters: {
      branchId?: string;
      customerId?: string;
      type?: 'CREDIT' | 'DEBIT';
      status?: 'ACTIVE' | 'APPLIED' | 'ANNULLED';
      search?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<CustomerNote[]> {
    let sql = `
      SELECT cn.*,
             b.name as branch_name,
             c.doc_type, c.doc_number, c.name as customer_name,
             u.full_name as user_name,
             w.name as warehouse_name,
             si.invoice_number as affected_invoice_number,
             si.invoice_date as affected_invoice_date,
             ua.full_name as annulled_by_user_name
      FROM customer_notes cn
      INNER JOIN branches b ON cn.branch_id = b.id
      INNER JOIN customers c ON cn.customer_id = c.id
      INNER JOIN users u ON cn.user_id = u.id
      LEFT JOIN warehouses w ON cn.warehouse_id = w.id
      LEFT JOIN sales_invoices si ON cn.affected_invoice_id = si.id
      LEFT JOIN users ua ON cn.annulled_by_user_id = ua.id
      WHERE cn.company_id = ?
    `;
    const params: any[] = [companyId];

    if (filters.branchId) {
      sql += ` AND cn.branch_id = ?`;
      params.push(filters.branchId);
    }

    if (filters.customerId) {
      sql += ` AND cn.customer_id = ?`;
      params.push(filters.customerId);
    }

    if (filters.type) {
      sql += ` AND cn.type = ?`;
      params.push(filters.type);
    }

    if (filters.status) {
      sql += ` AND cn.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      sql += ` AND cn.issue_date >= ?`;
      params.push(`${filters.startDate} 00:00:00`);
    }

    if (filters.endDate) {
      sql += ` AND cn.issue_date <= ?`;
      params.push(`${filters.endDate} 23:59:59`);
    }

    if (filters.search) {
      sql += ` AND (cn.note_number LIKE ? OR c.name LIKE ? OR c.doc_number LIKE ? OR cn.reason_description LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY cn.issue_date DESC`;

    const rows = await query<any>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      customerId: r.customer_id,
      customerDoc: `${r.doc_type}-${r.doc_number}`,
      customerName: r.customer_name,
      userId: r.user_id,
      userName: r.user_name,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      affectedInvoiceId: r.affected_invoice_id,
      affectedInvoiceNumber: r.affected_invoice_number,
      affectedInvoiceDate: r.affected_invoice_date,
      type: r.type,
      noteNumber: r.note_number,
      controlNumber: r.control_number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      reasonType: r.reason_type,
      reasonDescription: r.reason_description,
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      baseExemptAmount: Number(r.base_exempt_amount),
      baseTaxableAmount: Number(r.base_taxable_amount),
      taxAmount: Number(r.tax_amount),
      totalAmount: Number(r.total_amount),
      amountApplied: Number(r.amount_applied),
      amountBalance: Number(r.amount_balance),
      status: r.status,
      annulledAt: r.annulled_at,
      annulledByUserName: r.annulled_by_user_name,
      annulmentReason: r.annulment_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Obtiene el detalle completo de una Nota por ID
   */
  static async getNoteById(companyId: string, noteId: string): Promise<CustomerNote | null> {
    const rows = await query<any>(
      `SELECT cn.*,
              b.name as branch_name,
              c.doc_type, c.doc_number, c.name as customer_name,
              c.phone as customer_phone, c.address as customer_address, c.email as customer_email,
              u.full_name as user_name,
              w.name as warehouse_name,
              si.invoice_number as affected_invoice_number,
              si.invoice_date as affected_invoice_date,
              si.control_number as affected_invoice_control_number,
              ua.full_name as annulled_by_user_name
       FROM customer_notes cn
       INNER JOIN branches b ON cn.branch_id = b.id
       INNER JOIN customers c ON cn.customer_id = c.id
       INNER JOIN users u ON cn.user_id = u.id
       LEFT JOIN warehouses w ON cn.warehouse_id = w.id
       LEFT JOIN sales_invoices si ON cn.affected_invoice_id = si.id
       LEFT JOIN users ua ON cn.annulled_by_user_id = ua.id
       WHERE cn.company_id = ? AND cn.id = ?
       LIMIT 1`,
      [companyId, noteId]
    );

    if (rows.length === 0) return null;
    const r = rows[0];

    const note: any = {
      id: r.id,
      companyId: r.company_id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      customerId: r.customer_id,
      customerDoc: `${r.doc_type}-${r.doc_number}`,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerAddress: r.customer_address,
      customerEmail: r.customer_email,
      userId: r.user_id,
      userName: r.user_name,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      affectedInvoiceId: r.affected_invoice_id,
      affectedInvoiceNumber: r.affected_invoice_number,
      affectedInvoiceDate: r.affected_invoice_date,
      affectedInvoiceControlNumber: r.affected_invoice_control_number,
      type: r.type,
      noteNumber: r.note_number,
      controlNumber: r.control_number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      reasonType: r.reason_type,
      reasonDescription: r.reason_description,
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      baseExemptAmount: Number(r.base_exempt_amount),
      baseTaxableAmount: Number(r.base_taxable_amount),
      taxAmount: Number(r.tax_amount),
      totalAmount: Number(r.total_amount),
      amountApplied: Number(r.amount_applied),
      amountBalance: Number(r.amount_balance),
      status: r.status,
      annulledAt: r.annulled_at,
      annulledByUserName: r.annulled_by_user_name,
      annulmentReason: r.annulment_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };

    // Obtener ítems
    const itemsRows = await query<any>(
      `SELECT cni.*, p.sku as product_code, p.name as product_name
       FROM customer_note_items cni
       LEFT JOIN products p ON cni.product_id = p.id
       WHERE cni.note_id = ?
       ORDER BY cni.id ASC`,
      [noteId]
    );

    note.items = itemsRows.map((it) => ({
      id: it.id,
      noteId: it.note_id,
      productId: it.product_id,
      productCode: it.product_code,
      productName: it.product_name,
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      taxRate: Number(it.tax_rate),
      taxAmount: Number(it.tax_amount),
      subtotal: Number(it.subtotal),
      returnToInventory: Boolean(it.return_to_inventory),
    }));

    // Obtener aplicaciones a CxC
    const appRows = await query<any>(
      `SELECT cna.*, u.full_name as user_name, si.invoice_number
       FROM customer_note_applications cna
       INNER JOIN users u ON cna.user_id = u.id
       LEFT JOIN receivables r ON cna.receivable_id = r.id
       LEFT JOIN sales_invoices si ON r.invoice_id = si.id
       WHERE cna.note_id = ?
       ORDER BY cna.applied_date DESC`,
      [noteId]
    );

    note.applications = appRows.map((a) => ({
      id: a.id,
      noteId: a.note_id,
      receivableId: a.receivable_id,
      userId: a.user_id,
      userName: a.user_name,
      amountApplied: Number(a.amount_applied),
      appliedDate: a.applied_date,
      invoiceNumber: a.invoice_number,
      notes: a.notes,
    }));

    return note;
  }

  /**
   * Aplica saldo de una Nota de Crédito a una Cuenta por Cobrar pendiente
   */
  static async applyCreditNote(companyId: string, userId: string, data: ApplyCustomerCreditNoteInput) {
    return withTransaction(async (conn) => {
      // 1. Validar Nota de Crédito
      const [noteRows]: any = await conn.query(
        `SELECT id, customer_id, note_number, type, total_amount, amount_applied, status
         FROM customer_notes
         WHERE id = ? AND company_id = ? FOR UPDATE`,
        [data.noteId, companyId]
      );

      if (!noteRows || noteRows.length === 0) {
        throw new Error('Nota de Crédito no encontrada');
      }

      const note = noteRows[0];
      if (note.type !== 'CREDIT') {
        throw new Error('Solo se pueden aplicar Notas de Crédito');
      }

      if (note.status !== 'ACTIVE') {
        throw new Error(`La Nota de Crédito no está activa para aplicación (Estado: ${note.status})`);
      }

      const noteBalance = Number(note.total_amount) - Number(note.amount_applied);
      if (data.amount > noteBalance + 0.01) {
        throw new Error(`El monto a aplicar ($${data.amount}) excede el saldo disponible de la Nota de Crédito ($${noteBalance.toFixed(2)})`);
      }

      // 2. Validar Cuenta por Cobrar
      const [recRows]: any = await conn.query(
        `SELECT r.id, r.customer_id, r.invoice_id, r.amount_total, r.amount_paid, r.status,
                si.invoice_number, c.name as customer_name
         FROM receivables r
         INNER JOIN branches b ON r.branch_id = b.id
         INNER JOIN customers c ON r.customer_id = c.id
         LEFT JOIN sales_invoices si ON r.invoice_id = si.id
         WHERE r.id = ? AND b.company_id = ? FOR UPDATE`,
        [data.receivableId, companyId]
      );

      if (!recRows || recRows.length === 0) {
        throw new Error('Cuenta por cobrar no encontrada');
      }

      const rec = recRows[0];
      if (rec.customer_id !== note.customer_id) {
        throw new Error('La Nota de Crédito y la Cuenta por Cobrar pertenecen a clientes diferentes');
      }

      const recBalance = Number(rec.amount_total) - Number(rec.amount_paid);
      if (data.amount > recBalance + 0.01) {
        throw new Error(`El monto a aplicar ($${data.amount}) excede el saldo pendiente de la cuenta por cobrar ($${recBalance.toFixed(2)})`);
      }

      // 3. Registrar aplicación en customer_note_applications
      const appId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO customer_note_applications (
          id, note_id, receivable_id, user_id, amount_applied, applied_date, notes
        ) VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
        [
          appId,
          data.noteId,
          data.receivableId,
          userId,
          data.amount,
          data.notes ? data.notes.trim() : `Compensación de saldo con NC ${note.note_number}`,
        ]
      );

      // 4. Actualizar Nota de Crédito
      const newNoteApplied = Number(note.amount_applied) + data.amount;
      const isNoteFullyApplied = newNoteApplied >= Number(note.total_amount) - 0.001;
      await conn.query(
        `UPDATE customer_notes
         SET amount_applied = ?, status = ?
         WHERE id = ?`,
        [newNoteApplied, isNoteFullyApplied ? 'APPLIED' : 'ACTIVE', note.id]
      );

      // 5. Actualizar Cuenta por Cobrar
      const newRecPaid = Number(rec.amount_paid) + data.amount;
      const isRecPaid = newRecPaid >= Number(rec.amount_total) - 0.001;
      await conn.query(
        `UPDATE receivables
         SET amount_paid = ?, status = ?
         WHERE id = ?`,
        [newRecPaid, isRecPaid ? 'PAID' : 'PARTIAL', rec.id]
      );

      // Si la factura se saldó, marcar PAID en sales_invoices
      if (isRecPaid && rec.invoice_id) {
        await conn.query(
          `UPDATE sales_invoices SET status = 'PAID' WHERE id = ?`,
          [rec.invoice_id]
        );
      }

      // 6. Auditoría
      await conn.query(
        `INSERT INTO audit_logs (
          id, company_id, branch_id, user_id, module, action, entity, entity_id, after_json
        ) VALUES (?, ?, ?, ?, 'receivables', 'APPLY_CUSTOMER_NOTE', 'customer_note_applications', ?, ?)`,
        [
          crypto.randomUUID(),
          companyId,
          note.branch_id,
          userId,
          appId,
          JSON.stringify({
            noteId: note.id,
            noteNumber: note.note_number,
            receivableId: rec.id,
            amount: data.amount,
          }),
        ]
      );

      return {
        applicationId: appId,
        noteId: note.id,
        receivableId: rec.id,
        amountApplied: data.amount,
        noteRemainingBalance: Math.max(0, noteBalance - data.amount),
        recRemainingBalance: Math.max(0, recBalance - data.amount),
      };
    });
  }

  /**
   * Anula una Nota de Crédito o Débito
   */
  static async annulNote(companyId: string, userId: string, noteId: string, reason: string) {
    return withTransaction(async (conn) => {
      const [notes]: any = await conn.query(
        `SELECT * FROM customer_notes WHERE id = ? AND company_id = ? FOR UPDATE`,
        [noteId, companyId]
      );

      if (!notes || notes.length === 0) {
        throw new Error('Nota no encontrada');
      }

      const note = notes[0];
      if (note.status === 'ANNULLED') {
        throw new Error('Esta nota ya se encuentra anulada');
      }

      if (note.type === 'CREDIT' && Number(note.amount_applied) > 0.01) {
        throw new Error('No se puede anular una Nota de Crédito que ya ha sido aplicada a Cuentas por Cobrar. Primero debe desvincular o reversar los cobros compensados.');
      }

      // Si es Nota de Débito, verificar que la CxC no tenga pagos registrados
      if (note.type === 'DEBIT') {
        const [recs]: any = await conn.query(
          `SELECT id, amount_paid FROM receivables WHERE debit_note_id = ? FOR UPDATE`,
          [note.id]
        );
        if (recs && recs.length > 0 && Number(recs[0].amount_paid) > 0.01) {
          throw new Error('No se puede anular una Nota de Débito que ya posee pagos registrados');
        }
        // Marcar CxC como anulada
        await conn.query(
          `UPDATE receivables SET status = 'OVERDUE', amount_paid = 0 WHERE debit_note_id = ?`,
          [note.id]
        );
        await conn.query(
          `DELETE FROM receivables WHERE debit_note_id = ?`,
          [note.id]
        );
      }

      // Si hubo devolución de inventario, revertir reingreso
      const [items]: any = await conn.query(
        `SELECT * FROM customer_note_items WHERE note_id = ? AND return_to_inventory = 1 AND product_id IS NOT NULL`,
        [note.id]
      );

      if (items && items.length > 0 && note.warehouse_id) {
        for (const item of items) {
          const [stockRows]: any = await conn.query(
            `SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`,
            [item.product_id, note.warehouse_id]
          );

          if (stockRows && stockRows.length > 0) {
            const currentStock = Number(stockRows[0].current_stock);
            const newStock = Math.max(0, currentStock - Number(item.quantity));
            await conn.query(
              `UPDATE product_stocks SET current_stock = ?, last_movement_at = NOW() WHERE product_id = ? AND warehouse_id = ?`,
              [newStock, item.product_id, note.warehouse_id]
            );

            await conn.query(
              `INSERT INTO inventory_movements (
                id, branch_id, warehouse_id, product_id, user_id,
                movement_type, quantity, unit_cost, total_cost,
                previous_stock, new_stock, reference_document, reason, created_at
              ) VALUES (?, ?, ?, ?, ?, 'OUT', ?, 0.0000, 0.0000, ?, ?, ?, ?, NOW())`,
              [
                crypto.randomUUID(),
                note.branch_id,
                note.warehouse_id,
                item.product_id,
                userId,
                item.quantity,
                currentStock,
                newStock,
                note.note_number,
                `Reversión de devolución por anulación de NC ${note.note_number}`,
              ]
            );
          }
        }
      }

      // Marcar anulada
      await conn.query(
        `UPDATE customer_notes
         SET status = 'ANNULLED', annulled_at = NOW(), annulled_by_user_id = ?, annulment_reason = ?
         WHERE id = ?`,
        [userId, reason.trim(), note.id]
      );

      // Auditoría
      await conn.query(
        `INSERT INTO audit_logs (
          id, company_id, branch_id, user_id, module, action, entity, entity_id, after_json
        ) VALUES (?, ?, ?, ?, 'sales', 'ANNUL_CUSTOMER_NOTE', 'customer_notes', ?, ?)`,
        [
          crypto.randomUUID(),
          companyId,
          note.branch_id,
          userId,
          note.id,
          JSON.stringify({
            noteNumber: note.note_number,
            type: note.type,
            reason: reason.trim(),
          }),
        ]
      );

      return { success: true, noteId: note.id, status: 'ANNULLED' };
    });
  }

  /**
   * Obtiene las Notas de Crédito disponibles con saldo a favor para un cliente
   */
  static async getCustomerAvailableCreditNotes(companyId: string, customerId: string) {
    const rows = await query<any>(
      `SELECT cn.id, cn.note_number, cn.issue_date, cn.currency, cn.exchange_rate,
              cn.total_amount, cn.amount_applied, cn.amount_balance,
              cn.reason_type, cn.reason_description,
              si.invoice_number as affected_invoice_number
       FROM customer_notes cn
       LEFT JOIN sales_invoices si ON cn.affected_invoice_id = si.id
       WHERE cn.company_id = ? AND cn.customer_id = ?
         AND cn.type = 'CREDIT' AND cn.status = 'ACTIVE'
         AND cn.amount_balance > 0.005
       ORDER BY cn.issue_date ASC`,
      [companyId, customerId]
    );

    return rows.map((r) => ({
      id: r.id,
      noteNumber: r.note_number,
      issueDate: r.issue_date,
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      totalAmount: Number(r.total_amount),
      amountApplied: Number(r.amount_applied),
      amountBalance: Number(r.amount_balance),
      reasonType: r.reason_type,
      reasonDescription: r.reason_description,
      affectedInvoiceNumber: r.affected_invoice_number,
    }));
  }

  /**
   * Facturas emitidas al cliente para seleccionar al crear la nota
   */
  static async getCustomerInvoices(companyId: string, customerId: string) {
    const rows = await query<any>(
      `SELECT si.id, si.invoice_number, si.control_number, si.invoice_date,
              si.currency, si.exchange_rate, si.total_amount, si.status,
              r.amount_balance as pending_receivable_balance
       FROM sales_invoices si
       INNER JOIN branches b ON si.branch_id = b.id
       LEFT JOIN receivables r ON r.invoice_id = si.id AND r.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
       WHERE b.company_id = ? AND si.customer_id = ?
         AND si.status <> 'ANNULLED'
       ORDER BY si.invoice_date DESC
       LIMIT 50`,
      [companyId, customerId]
    );

    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      controlNumber: r.control_number,
      invoiceDate: r.invoice_date,
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      totalAmount: Number(r.total_amount),
      status: r.status,
      pendingBalance: r.pending_receivable_balance !== null ? Number(r.pending_receivable_balance) : 0,
    }));
  }

  /**
   * Obtiene los ítems facturados en una factura específica para cargarlos en devolución
   * y calcula el saldo disponible que aún puede ser acreditado o devuelto.
   */
  static async getInvoiceItems(companyId: string, invoiceId: string) {
    const rows = await query<any>(
      `SELECT sii.id, sii.product_id, sii.quantity, sii.unit_price,
              sii.tax_rate, sii.tax_amount, sii.subtotal,
              p.sku as product_code, p.name as product_name
       FROM sales_invoice_items sii
       INNER JOIN sales_invoices si ON sii.invoice_id = si.id
       INNER JOIN branches b ON si.branch_id = b.id
       LEFT JOIN products p ON sii.product_id = p.id
       WHERE sii.invoice_id = ? AND b.company_id = ?
       ORDER BY sii.id ASC`,
      [invoiceId, companyId]
    );

    // Cantidades ya acreditadas en Notas de Crédito previas no anuladas para esta factura
    const creditedRows = await query<any>(
      `SELECT cni.product_id, SUM(cni.quantity) as total_credited
       FROM customer_note_items cni
       INNER JOIN customer_notes cn ON cni.note_id = cn.id
       WHERE cn.affected_invoice_id = ?
         AND cn.type = 'CREDIT'
         AND cn.status != 'ANNULLED'
         AND cni.product_id IS NOT NULL
       GROUP BY cni.product_id`,
      [invoiceId]
    );

    const creditedMap = new Map<string, number>();
    for (const cr of creditedRows) {
      if (cr.product_id) {
        creditedMap.set(cr.product_id, Number(cr.total_credited) || 0);
      }
    }

    return rows.map((r) => {
      const invoicedQty = Number(r.quantity);
      const alreadyCredited = r.product_id ? (creditedMap.get(r.product_id) || 0) : 0;
      const availableQty = Math.max(0, Number((invoicedQty - alreadyCredited).toFixed(4)));

      return {
        id: r.id,
        productId: r.product_id,
        productCode: r.product_code,
        productName: r.product_name,
        description: r.product_name || `Producto ${r.product_code || ''}`,
        invoicedQuantity: invoicedQty,
        alreadyCreditedQuantity: alreadyCredited,
        availableQuantity: availableQty,
        quantity: availableQty,
        unitPrice: Number(r.unit_price),
        taxRate: Number(r.tax_rate),
        taxAmount: Number(r.tax_amount),
        subtotal: Number((availableQty * Number(r.unit_price)).toFixed(2)),
        isFullyCredited: availableQty <= 0,
      };
    });
  }
}
