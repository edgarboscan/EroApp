import { query, withTransaction } from '../../db';
import {
  CreatePurchaseOrderInput,
  CreateGoodsReceiptInput,
  ConvertReceiptToInvoiceInput,
  calculateWeightedAverageCost,
} from '@ero/shared';
import crypto from 'crypto';

export class PurchasesService {
  // ==========================================
  // ÓRDENES DE COMPRA (PURCHASE ORDERS)
  // ==========================================

  static async getOrders(companyId: string, branchId?: string, status?: string) {
    const orders = await query<any>(
      `SELECT po.id, po.company_id as companyId, po.branch_id as branchId,
              po.supplier_id as supplierId, po.user_id as userId,
              po.order_number as orderNumber, po.order_date as orderDate,
              po.expected_delivery_date as expectedDeliveryDate,
              po.currency, po.exchange_rate as exchangeRate,
              po.subtotal_amount as subtotalAmount, po.tax_amount as taxAmount,
              po.total_amount as totalAmount, po.status, po.notes,
              po.created_at as createdAt,
              s.name as supplierName, s.rif as supplierRif,
              b.name as branchName,
              u.full_name as createdByUserName,
              (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.order_id = po.id) as itemsCount
       FROM purchase_orders po
       INNER JOIN suppliers s ON po.supplier_id = s.id
       INNER JOIN branches b ON po.branch_id = b.id
       INNER JOIN users u ON po.user_id = u.id
       WHERE po.company_id = ?
         AND (? IS NULL OR po.branch_id = ?)
         AND (? IS NULL OR po.status = ?)
       ORDER BY po.order_date DESC, po.created_at DESC`,
      [companyId, branchId || null, branchId || null, status || null, status || null]
    );

    return orders;
  }

  static async getOrderById(companyId: string, orderId: string) {
    const orders = await query<any>(
      `SELECT po.id, po.company_id as companyId, po.branch_id as branchId,
              po.supplier_id as supplierId, po.user_id as userId,
              po.order_number as orderNumber, po.order_date as orderDate,
              po.expected_delivery_date as expectedDeliveryDate,
              po.currency, po.exchange_rate as exchangeRate,
              po.subtotal_amount as subtotalAmount, po.tax_amount as taxAmount,
              po.total_amount as totalAmount, po.status, po.notes,
              po.created_at as createdAt,
              s.name as supplierName, s.rif as supplierRif, s.phone as supplierPhone, s.email as supplierEmail,
              b.name as branchName,
              u.full_name as createdByUserName
       FROM purchase_orders po
       INNER JOIN suppliers s ON po.supplier_id = s.id
       INNER JOIN branches b ON po.branch_id = b.id
       INNER JOIN users u ON po.user_id = u.id
       WHERE po.id = ? AND po.company_id = ?`,
      [orderId, companyId]
    );

    if (orders.length === 0) return null;
    const order = orders[0];

    const items = await query<any>(
      `SELECT poi.id, poi.order_id as orderId, poi.product_id as productId,
              poi.quantity_ordered as quantityOrdered, poi.quantity_received as quantityReceived,
              poi.unit_cost as unitCost, poi.tax_rate as taxRate, poi.tax_amount as taxAmount,
              poi.subtotal, poi.total, poi.notes,
              p.sku as productSku, p.name as productName, p.unit_of_measure as unitOfMeasure
       FROM purchase_order_items poi
       INNER JOIN products p ON poi.product_id = p.id
       WHERE poi.order_id = ?`,
      [orderId]
    );

    return { ...order, items };
  }

  static async createOrder(companyId: string, userId: string, input: CreatePurchaseOrderInput) {
    return await withTransaction(async (conn) => {
      const orderId = crypto.randomUUID();
      const currentYear = new Date().getFullYear();

      // Generar correlativo OC-YYYY-0001
      const [countResult] = await conn.execute<any[]>(
        `SELECT COUNT(*) as total FROM purchase_orders WHERE company_id = ? AND YEAR(order_date) = ?`,
        [companyId, currentYear]
      );
      const seq = Number(countResult[0]?.total || 0) + 1;
      const orderNumber = `OC-${currentYear}-${String(seq).padStart(4, '0')}`;

      // Calcular montos acumulados
      let subtotalAmount = 0;
      let taxAmount = 0;

      const preparedItems = input.items.map((item) => {
        const itemSubtotal = Number((item.quantityOrdered * item.unitCost).toFixed(2));
        const itemTax = Number((itemSubtotal * (item.taxRate / 100)).toFixed(2));
        const itemTotal = Number((itemSubtotal + itemTax).toFixed(2));

        subtotalAmount += itemSubtotal;
        taxAmount += itemTax;

        return {
          id: crypto.randomUUID(),
          orderId,
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
          taxAmount: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
          notes: item.notes || null,
        };
      });

      const totalAmount = Number((subtotalAmount + taxAmount).toFixed(2));

      await conn.execute(
        `INSERT INTO purchase_orders (
          id, company_id, branch_id, supplier_id, user_id,
          order_number, expected_delivery_date, currency, exchange_rate,
          subtotal_amount, tax_amount, total_amount, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
        [
          orderId,
          companyId,
          input.branchId,
          input.supplierId,
          userId,
          orderNumber,
          input.expectedDeliveryDate || null,
          input.currency,
          input.exchangeRate,
          subtotalAmount,
          taxAmount,
          totalAmount,
          input.notes || null,
        ]
      );

      for (const item of preparedItems) {
        await conn.execute(
          `INSERT INTO purchase_order_items (
            id, order_id, product_id, quantity_ordered, quantity_received,
            unit_cost, tax_rate, tax_amount, subtotal, total, notes
          ) VALUES (?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.orderId,
            item.productId,
            item.quantityOrdered,
            item.unitCost,
            item.taxRate,
            item.taxAmount,
            item.subtotal,
            item.total,
            item.notes,
          ]
        );
      }

      return {
        id: orderId,
        orderNumber,
        status: 'DRAFT',
        subtotalAmount,
        taxAmount,
        totalAmount,
        itemsCount: preparedItems.length,
      };
    });
  }

  static async confirmOrder(companyId: string, orderId: string) {
    const orders = await query<any>(
      `SELECT id, status FROM purchase_orders WHERE id = ? AND company_id = ?`,
      [orderId, companyId]
    );

    if (orders.length === 0) {
      throw new Error('Orden de compra no encontrada');
    }
    if (orders[0].status !== 'DRAFT') {
      throw new Error(`No se puede confirmar una orden en estado ${orders[0].status}`);
    }

    await query(
      `UPDATE purchase_orders SET status = 'CONFIRMED' WHERE id = ?`,
      [orderId]
    );

    return { id: orderId, status: 'CONFIRMED' };
  }

  static async cancelOrder(companyId: string, orderId: string) {
    const orders = await query<any>(
      `SELECT id, status FROM purchase_orders WHERE id = ? AND company_id = ?`,
      [orderId, companyId]
    );

    if (orders.length === 0) {
      throw new Error('Orden de compra no encontrada');
    }
    if (orders[0].status === 'RECEIVED' || orders[0].status === 'PARTIALLY_RECEIVED') {
      throw new Error('No se puede cancelar una orden que ya tiene recepciones de mercancía');
    }

    await query(
      `UPDATE purchase_orders SET status = 'CANCELLED' WHERE id = ?`,
      [orderId]
    );

    return { id: orderId, status: 'CANCELLED' };
  }

  // ==========================================
  // RECEPCIÓN DE MERCANCÍAS (GOODS RECEIPTS)
  // ==========================================

  static async getReceipts(companyId: string, branchId?: string, warehouseId?: string) {
    return await query<any>(
      `SELECT gr.id, gr.company_id as companyId, gr.branch_id as branchId,
              gr.warehouse_id as warehouseId, gr.supplier_id as supplierId,
              gr.purchase_order_id as purchaseOrderId, gr.user_id as userId,
              gr.receipt_number as receiptNumber, gr.supplier_delivery_note as supplierDeliveryNote,
              gr.receipt_date as receiptDate, gr.currency, gr.exchange_rate as exchangeRate,
              gr.total_cost as totalCost, gr.status, gr.purchase_invoice_id as purchaseInvoiceId,
              gr.notes, gr.created_at as createdAt,
              s.name as supplierName, s.rif as supplierRif,
              w.name as warehouseName, b.name as branchName,
              u.full_name as receivedByUserName,
              po.order_number as purchaseOrderNumber
       FROM goods_receipts gr
       INNER JOIN suppliers s ON gr.supplier_id = s.id
       INNER JOIN warehouses w ON gr.warehouse_id = w.id
       INNER JOIN branches b ON gr.branch_id = b.id
       INNER JOIN users u ON gr.user_id = u.id
       LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
       WHERE gr.company_id = ?
         AND (? IS NULL OR gr.branch_id = ?)
         AND (? IS NULL OR gr.warehouse_id = ?)
       ORDER BY gr.receipt_date DESC, gr.created_at DESC`,
      [companyId, branchId || null, branchId || null, warehouseId || null, warehouseId || null]
    );
  }

  static async getReceiptById(companyId: string, receiptId: string) {
    const receipts = await query<any>(
      `SELECT gr.id, gr.company_id as companyId, gr.branch_id as branchId,
              gr.warehouse_id as warehouseId, gr.supplier_id as supplierId,
              gr.purchase_order_id as purchaseOrderId, gr.user_id as userId,
              gr.receipt_number as receiptNumber, gr.supplier_delivery_note as supplierDeliveryNote,
              gr.receipt_date as receiptDate, gr.currency, gr.exchange_rate as exchangeRate,
              gr.total_cost as totalCost, gr.status, gr.purchase_invoice_id as purchaseInvoiceId,
              gr.notes, gr.created_at as createdAt,
              s.name as supplierName, s.rif as supplierRif,
              w.name as warehouseName, b.name as branchName,
              u.full_name as receivedByUserName,
              po.order_number as purchaseOrderNumber
       FROM goods_receipts gr
       INNER JOIN suppliers s ON gr.supplier_id = s.id
       INNER JOIN warehouses w ON gr.warehouse_id = w.id
       INNER JOIN branches b ON gr.branch_id = b.id
       INNER JOIN users u ON gr.user_id = u.id
       LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
       WHERE gr.id = ? AND gr.company_id = ?`,
      [receiptId, companyId]
    );

    if (receipts.length === 0) return null;
    const receipt = receipts[0];

    const items = await query<any>(
      `SELECT gri.id, gri.receipt_id as receiptId, gri.purchase_order_item_id as purchaseOrderItemId,
              gri.product_id as productId, gri.quantity_received as quantityReceived,
              gri.unit_cost as unitCost, gri.total_cost as totalCost, gri.notes,
              p.sku as productSku, p.name as productName, p.unit_of_measure as unitOfMeasure
       FROM goods_receipt_items gri
       INNER JOIN products p ON gri.product_id = p.id
       WHERE gri.receipt_id = ?`,
      [receiptId]
    );

    return { ...receipt, items };
  }

  static async createReceipt(companyId: string, userId: string, input: CreateGoodsReceiptInput) {
    return await withTransaction(async (conn) => {
      const receiptId = crypto.randomUUID();
      const currentYear = new Date().getFullYear();

      // Generar correlativo REC-YYYY-0001
      const [countResult] = await conn.execute<any[]>(
        `SELECT COUNT(*) as total FROM goods_receipts WHERE company_id = ? AND YEAR(receipt_date) = ?`,
        [companyId, currentYear]
      );
      const seq = Number(countResult[0]?.total || 0) + 1;
      const receiptNumber = `REC-${currentYear}-${String(seq).padStart(4, '0')}`;

      let totalCost = 0;

      // 1. Guardar Cabecera de Recepción
      for (const item of input.items) {
        totalCost += Number((item.quantityReceived * item.unitCost).toFixed(4));
      }

      let effectiveWarehouseId = input.warehouseId;
      if (!effectiveWarehouseId) {
        const [defWh]: any = await conn.query(
          `SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 ORDER BY is_default_purchases DESC, is_default DESC LIMIT 1`,
          [input.branchId]
        );
        effectiveWarehouseId = defWh[0]?.id;
      }

      await conn.execute(
        `INSERT INTO goods_receipts (
          id, company_id, branch_id, warehouse_id, supplier_id,
          purchase_order_id, user_id, receipt_number, supplier_delivery_note,
          currency, exchange_rate, total_cost, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?)`,
        [
          receiptId,
          companyId,
          input.branchId,
          effectiveWarehouseId,
          input.supplierId,
          input.purchaseOrderId || null,
          userId,
          receiptNumber,
          input.supplierDeliveryNote || null,
          input.currency,
          input.exchangeRate,
          totalCost,
          input.notes || null,
        ]
      );

      // 2. Procesar cada ítem recibido: Stock, Costeo Promedio y Kardex
      for (const item of input.items) {
        const itemTotalCost = Number((item.quantityReceived * item.unitCost).toFixed(4));

        await conn.execute(
          `INSERT INTO goods_receipt_items (
            id, receipt_id, purchase_order_item_id, product_id,
            quantity_received, unit_cost, total_cost, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            receiptId,
            item.purchaseOrderItemId || null,
            item.productId,
            item.quantityReceived,
            item.unitCost,
            itemTotalCost,
            item.notes || null,
          ]
        );

        // Consultar stock global y costo anterior para recálculo ponderado
        const [productRow] = await conn.execute<any[]>(
          `SELECT cost_price FROM products WHERE id = ?`,
          [item.productId]
        );
        const currentAvgCost = Number(productRow[0]?.cost_price || 0);

        // Stock disponible actual en el depósito de destino
        const [stockRow] = await conn.execute<any[]>(
          `SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ?`,
          [item.productId, input.warehouseId]
        );
        const currentStockInWh = Number(stockRow[0]?.current_stock || 0);

        // Cálculo de nuevo Costo Promedio Ponderado
        const newWeightedCost = calculateWeightedAverageCost(
          currentStockInWh,
          currentAvgCost,
          item.quantityReceived,
          item.unitCost
        );

        // Actualizar costo del producto
        await conn.execute(
          `UPDATE products SET cost_price = ? WHERE id = ?`,
          [newWeightedCost, item.productId]
        );

        // Aumentar stock físico en el depósito
        if (stockRow.length === 0) {
          await conn.execute(
            `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
             VALUES (?, ?, ?, NOW())`,
            [item.productId, input.warehouseId, item.quantityReceived]
          );
        } else {
          await conn.execute(
            `UPDATE product_stocks SET current_stock = current_stock + ?, last_movement_at = NOW() WHERE product_id = ? AND warehouse_id = ?`,
            [item.quantityReceived, item.productId, input.warehouseId]
          );
        }

        // Registrar movimiento de auditoría en Kardex
        await conn.execute(
          `INSERT INTO inventory_movements (
            id, branch_id, warehouse_id, product_id, user_id, movement_type,
            quantity, unit_cost, reference_document, reason
          ) VALUES (?, ?, ?, ?, ?, 'PURCHASE', ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            input.branchId,
            input.warehouseId,
            item.productId,
            userId,
            item.quantityReceived,
            item.unitCost,
            receiptNumber,
            `Recepción de Mercancía: ${receiptNumber} (Doc Ref: ${input.supplierDeliveryNote || 'S/N'})`,
          ]
        );

        // Si pertenece a una orden de compra, actualizar cantidad recibida en el ítem de la orden
        if (item.purchaseOrderItemId) {
          await conn.execute(
            `UPDATE purchase_order_items
             SET quantity_received = quantity_received + ?
             WHERE id = ?`,
            [item.quantityReceived, item.purchaseOrderItemId]
          );
        }
      }

      // 3. Si hay orden de compra asociada, evaluar si se completó o quedó parcial
      if (input.purchaseOrderId) {
        const [orderItems] = await conn.execute<any[]>(
          `SELECT SUM(quantity_ordered) as totalOrdered, SUM(quantity_received) as totalReceived
           FROM purchase_order_items
           WHERE order_id = ?`,
          [input.purchaseOrderId]
        );

        const totalOrdered = Number(orderItems[0]?.totalOrdered || 0);
        const totalReceived = Number(orderItems[0]?.totalReceived || 0);

        let newOrderStatus = 'PARTIALLY_RECEIVED';
        if (totalReceived >= totalOrdered && totalOrdered > 0) {
          newOrderStatus = 'RECEIVED';
        }

        await conn.execute(
          `UPDATE purchase_orders SET status = ? WHERE id = ?`,
          [newOrderStatus, input.purchaseOrderId]
        );
      }

      return {
        id: receiptId,
        receiptNumber,
        status: 'RECEIVED',
        totalCost,
        itemsCount: input.items.length,
      };
    });
  }

  // ==========================================
  // CONVERSIÓN DE RECEPCIÓN A FACTURA DE PROVEEDOR (CXP)
  // ==========================================

  static async convertReceiptToInvoice(companyId: string, userId: string, input: ConvertReceiptToInvoiceInput) {
    return await withTransaction(async (conn) => {
      // 1. Obtener datos de la recepción
      const [receiptRows] = await conn.execute<any[]>(
        `SELECT * FROM goods_receipts WHERE id = ? AND company_id = ?`,
        [input.receiptId, companyId]
      );

      if (receiptRows.length === 0) {
        throw new Error('Recepción de mercancía no encontrada');
      }

      const receipt = receiptRows[0];
      if (receipt.status === 'INVOICED') {
        throw new Error('Esta recepción ya fue convertida a factura');
      }
      if (receipt.status === 'ANNULLED') {
        throw new Error('No se puede facturar una recepción anulada');
      }

      // 2. Obtener los ítems de la recepción
      const [items] = await conn.execute<any[]>(
        `SELECT gri.*, p.default_tax_rate_id
         FROM goods_receipt_items gri
         INNER JOIN products p ON gri.product_id = p.id
         WHERE gri.receipt_id = ?`,
        [input.receiptId]
      );

      if (items.length === 0) {
        throw new Error('La recepción no contiene ítems para facturar');
      }

      const invoiceId = crypto.randomUUID();
      let baseTaxableAmount = 0;
      let taxAmount = 0;

      const preparedInvoiceItems = items.map((item) => {
        const itemSubtotal = Number((item.quantity_received * item.unit_cost).toFixed(2));
        const itemTax = Number((itemSubtotal * 0.16).toFixed(2)); // Tasa general 16% por defecto
        const itemTotal = Number((itemSubtotal + itemTax).toFixed(2));

        baseTaxableAmount += itemSubtotal;
        taxAmount += itemTax;

        return {
          id: crypto.randomUUID(),
          invoiceId,
          productId: item.product_id,
          quantity: item.quantity_received,
          unitPrice: item.unit_cost,
          taxRate: 16.0,
          discountPercent: 0.0,
          taxAmount: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
        };
      });

      const totalAmount = Number((baseTaxableAmount + taxAmount).toFixed(2));

      // 3. Insertar factura de compra (purchase_invoices)
      await conn.execute(
        `INSERT INTO purchase_invoices (
          id, branch_id, warehouse_id, supplier_id, user_id,
          invoice_number, control_number, invoice_date, currency, exchange_rate,
          base_exempt_amount, base_taxable_amount, tax_amount, igtf_amount,
          discount_amount, total_amount, is_credit, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 0.00, ?, ?, 0.00, 0.00, ?, ?, ?)`,
        [
          invoiceId,
          receipt.branch_id,
          receipt.warehouse_id,
          receipt.supplier_id,
          userId,
          input.invoiceNumber,
          input.controlNumber || null,
          receipt.currency,
          receipt.exchange_rate,
          baseTaxableAmount,
          taxAmount,
          totalAmount,
          input.isCredit ? 1 : 0,
          input.isCredit ? 'PENDING' : 'PAID',
        ]
      );

      // 4. Insertar ítems de factura
      for (const item of preparedInvoiceItems) {
        await conn.execute(
          `INSERT INTO purchase_invoice_items (
            id, invoice_id, product_id, quantity, unit_price,
            tax_rate, discount_percent, tax_amount, subtotal, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.invoiceId,
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

      // 5. Si es a crédito, registrar automáticamente la cuenta por pagar (payables)
      if (input.isCredit) {
        const payableId = crypto.randomUUID();
        const dueDate = input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        await conn.execute(
          `INSERT INTO payables (
            id, branch_id, supplier_id, invoice_id, amount_total,
            amount_paid, due_date, status
          ) VALUES (?, ?, ?, ?, ?, 0.00, ?, 'PENDING')`,
          [payableId, receipt.branch_id, receipt.supplier_id, invoiceId, totalAmount, dueDate]
        );
      }

      // 6. Actualizar recepción con estado INVOICED y enlace a la factura
      await conn.execute(
        `UPDATE goods_receipts
         SET status = 'INVOICED', purchase_invoice_id = ?
         WHERE id = ?`,
        [invoiceId, input.receiptId]
      );

      return {
        invoiceId,
        invoiceNumber: input.invoiceNumber,
        totalAmount,
        isCredit: input.isCredit,
        status: input.isCredit ? 'PENDING' : 'PAID',
      };
    });
  }
}
