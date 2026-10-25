import { query, withTransaction } from '../../db/index';
import crypto from 'crypto';
import type {
  CreateRestaurantTableInput,
  UpdateRestaurantTableInput,
  CreatePresetNoteInput,
  CreateOrderCustomerInput,
  AddOrderItemInput,
  ItemPreparationStatus,
  AddOrderPaymentInput,
  OpenOrderInput,
  CloseTableOrderInput,
  PreparationStation,
  RestaurantTipsReport,
  RestaurantTipItem,
  WaiterTipsSummary,
} from '@ero/shared';

export class RestaurantService {
  /**
   * Obtiene la tasa de cambio vigente
   */
  private static async getLatestExchangeRate(companyId: string): Promise<number> {
    const rows = await query<{ rate: number }>(
      `SELECT rate FROM exchange_rates
       WHERE company_id = ?
       ORDER BY effective_date DESC, created_at DESC
       LIMIT 1`,
      [companyId]
    );
    return rows.length > 0 ? Number(rows[0].rate) : 1.0;
  }

  // ==========================================
  // GESTIÓN DE MESAS
  // ==========================================

  static async getTables(companyId: string, branchId: string, zone?: string, waiterId?: string) {
    let sql = `
      SELECT 
        t.id, t.company_id, t.branch_id, t.table_number, t.name, t.zone,
        t.capacity, t.status, t.current_waiter_id, t.current_waiter_name,
        t.active_order_id, t.created_at, t.updated_at,
        o.order_number,
        COALESCE(o.total_usd, 0) AS total_usd,
        COALESCE(o.total_ves, 0) AS total_ves,
        (SELECT COUNT(*) FROM restaurant_order_customers roc WHERE roc.order_id = t.active_order_id) AS customer_count,
        (SELECT COUNT(*) FROM restaurant_order_items roi WHERE roi.order_id = t.active_order_id) AS item_count
      FROM restaurant_tables t
      LEFT JOIN restaurant_orders o ON t.active_order_id = o.id
      WHERE t.company_id = ? AND t.branch_id = ?
    `;
    const params: any[] = [companyId, branchId];

    if (zone && zone !== 'ALL') {
      sql += ` AND t.zone = ?`;
      params.push(zone);
    }
    if (waiterId && waiterId !== 'ALL') {
      sql += ` AND t.current_waiter_id = ?`;
      params.push(waiterId);
    }

    sql += ` ORDER BY t.zone ASC, CAST(t.table_number AS UNSIGNED) ASC, t.table_number ASC`;

    const tables = await query<any>(sql, params);
    return tables.map((t) => ({
      ...t,
      capacity: Number(t.capacity),
      total_usd: Number(t.total_usd),
      total_ves: Number(t.total_ves),
      customer_count: Number(t.customer_count || 0),
      item_count: Number(t.item_count || 0),
    }));
  }

  static async getTableById(companyId: string, tableId: string) {
    const rows = await query<any>(
      `SELECT * FROM restaurant_tables WHERE id = ? AND company_id = ? LIMIT 1`,
      [tableId, companyId]
    );
    if (!rows.length) return null;
    return rows[0];
  }

  static async createTable(companyId: string, branchId: string, input: CreateRestaurantTableInput) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO restaurant_tables 
        (id, company_id, branch_id, table_number, name, zone, capacity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')`,
      [
        id,
        companyId,
        input.branch_id || branchId,
        input.table_number,
        input.name,
        input.zone || 'Salón Principal',
        input.capacity || 4,
      ]
    );
    return this.getTableById(companyId, id);
  }

  static async updateTable(companyId: string, tableId: string, input: UpdateRestaurantTableInput) {
    const fields: string[] = [];
    const values: any[] = [];

    if (input.table_number !== undefined) {
      fields.push(`table_number = ?`);
      values.push(input.table_number);
    }
    if (input.name !== undefined) {
      fields.push(`name = ?`);
      values.push(input.name);
    }
    if (input.zone !== undefined) {
      fields.push(`zone = ?`);
      values.push(input.zone);
    }
    if (input.capacity !== undefined) {
      fields.push(`capacity = ?`);
      values.push(input.capacity);
    }
    if (input.status !== undefined) {
      fields.push(`status = ?`);
      values.push(input.status);
    }
    if (input.current_waiter_id !== undefined) {
      fields.push(`current_waiter_id = ?`);
      values.push(input.current_waiter_id);
    }
    if (input.current_waiter_name !== undefined) {
      fields.push(`current_waiter_name = ?`);
      values.push(input.current_waiter_name);
    }
    if (input.active_order_id !== undefined) {
      fields.push(`active_order_id = ?`);
      values.push(input.active_order_id);
    }

    if (fields.length > 0) {
      values.push(tableId, companyId);
      await query(
        `UPDATE restaurant_tables SET ${fields.join(', ')} WHERE id = ? AND company_id = ?`,
        values
      );
    }

    return this.getTableById(companyId, tableId);
  }

  static async deleteTable(companyId: string, tableId: string) {
    const table = await this.getTableById(companyId, tableId);
    if (!table) throw new Error('Mesa no encontrada');
    if (table.status !== 'AVAILABLE' || table.active_order_id) {
      throw new Error('No se puede eliminar una mesa con comanda activa u ocupada');
    }
    await query(`DELETE FROM restaurant_tables WHERE id = ? AND company_id = ?`, [tableId, companyId]);
    return { success: true };
  }

  // ==========================================
  // PRODUCTOS Y FILTRO POR DEPARTAMENTO / GRUPO
  // ==========================================

  static async getRestaurantProducts(
    companyId: string,
    departmentId?: string,
    groupId?: string,
    cashRegisterId?: string
  ) {
    const exchangeRate = await this.getLatestExchangeRate(companyId);

    let sql = `
      SELECT 
        p.id, p.company_id, p.sku, p.name, p.description, p.product_type,
        p.department_id, p.group_id,
        d.name AS department_name,
        g.name AS group_name,
        COALESCE(p.base_price, 0) AS price_usd
      FROM products p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN \`groups\` g ON p.group_id = g.id
      WHERE p.company_id = ? AND p.product_type != 'raw_material'
    `;
    const params: any[] = [companyId];

    if (cashRegisterId && cashRegisterId !== 'ALL') {
      const allowedDepts = await query<any>(
        `SELECT department_id FROM cash_register_departments WHERE cash_register_id = ?`,
        [cashRegisterId]
      );
      if (allowedDepts.length > 0) {
        const allowedIds = allowedDepts.map((d: any) => d.department_id);
        sql += ` AND p.department_id IN (${allowedIds.map(() => '?').join(',')})`;
        params.push(...allowedIds);
      }
    }

    if (departmentId && departmentId !== 'ALL') {
      sql += ` AND p.department_id = ?`;
      params.push(departmentId);
    }
    if (groupId && groupId !== 'ALL') {
      sql += ` AND p.group_id = ?`;
      params.push(groupId);
    }

    sql += ` ORDER BY p.name ASC LIMIT 200`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => {
      const priceUsd = Number(r.price_usd);
      const priceVes = Number((priceUsd * exchangeRate).toFixed(2));
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        description: r.description,
        department_id: r.department_id,
        department_name: r.department_name,
        group_id: r.group_id,
        group_name: r.group_name,
        price_usd: priceUsd,
        price_ves: priceVes,
        suggested_station:
          r.group_name && /bebida|jugo|cerveza|coctel|cafe|bar/i.test(r.group_name)
            ? 'BAR'
            : 'KITCHEN',
      };
    });
  }

  static async getRestaurantDepartments(companyId: string, cashRegisterId?: string) {
    let allowedDeptIds: string[] = [];
    if (cashRegisterId && cashRegisterId !== 'ALL') {
      const allowedDepts = await query<any>(
        `SELECT department_id FROM cash_register_departments WHERE cash_register_id = ?`,
        [cashRegisterId]
      );
      if (allowedDepts.length > 0) {
        allowedDeptIds = allowedDepts.map((d: any) => d.department_id);
      }
    }

    let deptSql = `SELECT id, code, name, description FROM departments WHERE company_id = ? AND is_active = 1`;
    const deptParams: any[] = [companyId];
    if (allowedDeptIds.length > 0) {
      deptSql += ` AND id IN (${allowedDeptIds.map(() => '?').join(',')})`;
      deptParams.push(...allowedDeptIds);
    }
    deptSql += ` ORDER BY name ASC`;

    let groupSql = `
      SELECT g.id, g.department_id, g.code, g.name 
      FROM \`groups\` g
      INNER JOIN departments d ON g.department_id = d.id
      WHERE d.company_id = ? AND g.is_active = 1
    `;
    const groupParams: any[] = [companyId];
    if (allowedDeptIds.length > 0) {
      groupSql += ` AND g.department_id IN (${allowedDeptIds.map(() => '?').join(',')})`;
      groupParams.push(...allowedDeptIds);
    }
    groupSql += ` ORDER BY g.name ASC`;

    const [depts, groups] = await Promise.all([
      query<any>(deptSql, deptParams),
      query<any>(groupSql, groupParams),
    ]);

    return {
      departments: depts,
      groups: groups,
    };
  }

  // ==========================================
  // OBSERVACIONES PREESTABLECIDAS
  // ==========================================

  static async getPresetNotes(companyId: string, category?: string) {
    let sql = `SELECT * FROM restaurant_preset_notes WHERE company_id = ?`;
    const params: any[] = [companyId];
    if (category && category !== 'ALL') {
      sql += ` AND category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY category ASC, note_text ASC`;
    return query<any>(sql, params);
  }

  static async createPresetNote(companyId: string, input: CreatePresetNoteInput) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO restaurant_preset_notes (id, company_id, category, note_text)
       VALUES (?, ?, ?, ?)`,
      [id, companyId, input.category || 'GENERAL', input.note_text.trim()]
    );
    const rows = await query<any>(`SELECT * FROM restaurant_preset_notes WHERE id = ?`, [id]);
    return rows[0];
  }

  // ==========================================
  // COMANDAS DE MESA (ORDERS)
  // ==========================================

  static async openOrder(companyId: string, branchId: string, input: OpenOrderInput) {
    return withTransaction(async (conn) => {
      // Validar mesa
      const [tableRows]: any = await conn.query(
        `SELECT * FROM restaurant_tables WHERE id = ? AND company_id = ? FOR UPDATE`,
        [input.table_id, companyId]
      );
      if (!tableRows.length) throw new Error('Mesa no encontrada');
      const table = tableRows[0];
      if (table.status !== 'AVAILABLE' && table.active_order_id) {
        throw new Error(`La mesa ${table.name} ya se encuentra ocupada con una comanda activa`);
      }

      // Tasa BCV
      const [rateRows]: any = await conn.query(
        `SELECT rate FROM exchange_rates WHERE company_id = ? ORDER BY effective_date DESC, created_at DESC LIMIT 1`,
        [companyId]
      );
      const exchangeRate = rateRows.length > 0 ? Number(rateRows[0].rate) : 1.0;

      // Generar correlativo
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const [countRows]: any = await conn.query(
        `SELECT COUNT(*) as count FROM restaurant_orders WHERE branch_id = ? AND order_number LIKE ?`,
        [branchId, `CMD-${dateStr}-%`]
      );
      const seq = String((countRows[0]?.count || 0) + 1).padStart(4, '0');
      const orderNumber = `CMD-${dateStr}-${seq}`;

      const orderId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO restaurant_orders 
          (id, company_id, branch_id, table_id, order_number, waiter_id, waiter_name, customer_id, customer_name, status, notes, total_usd, total_ves, exchange_rate, is_invoiced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, 0.00, 0.00, ?, 0)`,
        [
          orderId,
          companyId,
          branchId,
          input.table_id,
          orderNumber,
          input.waiter_id || null,
          input.waiter_name || null,
          input.customer_id || null,
          input.customer_name || null,
          input.notes || null,
          exchangeRate,
        ]
      );

      // Crear clientes iniciales
      const customerNames = input.initial_customers && input.initial_customers.length > 0
        ? input.initial_customers
        : ['Cliente 1'];

      let custNum = 1;
      for (const name of customerNames) {
        const custId = crypto.randomUUID();
        const isFirst = custNum === 1;
        const linkedCustId = isFirst && input.customer_id ? input.customer_id : null;
        const finalName = isFirst && input.customer_name ? input.customer_name : name.trim();
        await conn.query(
          `INSERT INTO restaurant_order_customers 
            (id, order_id, customer_number, customer_name, customer_id, is_paid, total_usd, total_ves)
           VALUES (?, ?, ?, ?, ?, 0, 0.00, 0.00)`,
          [custId, orderId, custNum++, finalName, linkedCustId]
        );
      }

      // Actualizar mesa a ocupada
      await conn.query(
        `UPDATE restaurant_tables 
         SET status = 'OCCUPIED', active_order_id = ?, current_waiter_id = ?, current_waiter_name = ?
         WHERE id = ?`,
        [orderId, input.waiter_id || null, input.waiter_name || null, input.table_id]
      );

      return { order_id: orderId, order_number: orderNumber };
    });
  }

  static async getOrder(orderId: string) {
    const orderRows = await query<any>(
      `SELECT 
        o.*,
        t.table_number, t.name as table_name, t.zone
       FROM restaurant_orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       WHERE o.id = ? LIMIT 1`,
      [orderId]
    );
    if (!orderRows.length) return null;
    const order = orderRows[0];

    // Clientes de la comanda
    const customers = await query<any>(
      `SELECT * FROM restaurant_order_customers WHERE order_id = ? ORDER BY customer_number ASC`,
      [orderId]
    );

    // Ítems de la comanda
    const items = await query<any>(
      `SELECT 
        i.*,
        c.customer_name
       FROM restaurant_order_items i
       LEFT JOIN restaurant_order_customers c ON i.order_customer_id = c.id
       WHERE i.order_id = ?
       ORDER BY i.created_at ASC`,
      [orderId]
    );

    // Pagos registrados
    const payments = await query<any>(
      `SELECT 
        p.*,
        c.customer_name
       FROM restaurant_order_payments p
       LEFT JOIN restaurant_order_customers c ON p.order_customer_id = c.id
       WHERE p.order_id = ?
       ORDER BY p.created_at ASC`,
      [orderId]
    );

    return {
      ...order,
      total_usd: Number(order.total_usd),
      total_ves: Number(order.total_ves),
      exchange_rate: Number(order.exchange_rate),
      customers: customers.map((c) => ({
        ...c,
        total_usd: Number(c.total_usd),
        total_ves: Number(c.total_ves),
        is_paid: Boolean(c.is_paid),
      })),
      items: items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unit_price_usd: Number(i.unit_price_usd),
        unit_price_ves: Number(i.unit_price_ves),
        subtotal_usd: Number(i.subtotal_usd),
        subtotal_ves: Number(i.subtotal_ves),
      })),
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        amount_usd: Number(p.amount_usd),
        amount_ves: Number(p.amount_ves),
        exchange_rate: Number(p.exchange_rate),
        is_credit: Boolean(p.is_credit),
      })),
    };
  }

  static async getOrderByTableId(tableId: string) {
    const tableRows = await query<any>(
      `SELECT active_order_id FROM restaurant_tables WHERE id = ? LIMIT 1`,
      [tableId]
    );
    if (!tableRows.length || !tableRows[0].active_order_id) return null;
    return this.getOrder(tableRows[0].active_order_id);
  }

  // ==========================================
  // CLIENTES EN COMANDA
  // ==========================================

  static async addCustomerToOrder(orderId: string, input: CreateOrderCustomerInput) {
    const existing = await query<any>(
      `SELECT COUNT(*) as count FROM restaurant_order_customers WHERE order_id = ?`,
      [orderId]
    );
    const nextNum = (existing[0]?.count || 0) + 1;
    const custId = crypto.randomUUID();

    await query(
      `INSERT INTO restaurant_order_customers 
        (id, order_id, customer_number, customer_name, customer_id, notes, is_paid, total_usd, total_ves)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0.00, 0.00)`,
      [
        custId,
        orderId,
        nextNum,
        input.customer_name.trim(),
        input.customer_id || null,
        input.notes || null,
      ]
    );

    return this.getOrder(orderId);
  }

  // ==========================================
  // ÍTEMS DE COMANDA Y PRODUCTO RÁPIDO / AD-HOC
  // ==========================================

  static async addOrderItem(orderId: string, companyId: string, input: AddOrderItemInput) {
    return withTransaction(async (conn) => {
      // Obtener orden y tasa
      const [orderRows]: any = await conn.query(
        `SELECT id, company_id, branch_id, exchange_rate, status FROM restaurant_orders WHERE id = ? FOR UPDATE`,
        [orderId]
      );
      if (!orderRows.length) throw new Error('Comanda no encontrada');
      const order = orderRows[0];
      if (order.status === 'PAID' || order.status === 'CANCELLED') {
        throw new Error('No se pueden agregar productos a una comanda cerrada o cancelada');
      }

      const exRate = Number(order.exchange_rate) || 1.0;
      const qty = Number(input.quantity) || 1.0;
      const unitUsd = Number(input.unit_price_usd) || 0.0;
      const unitVes = Number((unitUsd * exRate).toFixed(2));
      const subtotalUsd = Number((qty * unitUsd).toFixed(2));
      const subtotalVes = Number((qty * unitVes).toFixed(2));

      // Guardar nota preestablecida si se solicitó
      if (input.save_as_preset_note && input.notes && input.notes.trim()) {
        const pnId = crypto.randomUUID();
        const cat = input.station === 'BAR' ? 'BARRA' : 'COCINA';
        await conn.query(
          `INSERT INTO restaurant_preset_notes (id, company_id, category, note_text)
           VALUES (?, ?, ?, ?)`,
          [pnId, companyId, cat, input.notes.trim()]
        );
      }

      // Si es un nuevo producto que se quiere registrar en catálogo además de agregarlo a la comanda:
      let productId = input.product_id || null;
      let sku = input.sku || null;
      if (!productId && input.product_name) {
        // Puede ser producto fuera de carta o nuevo
        sku = sku || `AD-HOC-${Date.now().toString(36).toUpperCase()}`;
      }

      const itemId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO restaurant_order_items 
          (id, order_id, order_customer_id, product_id, product_name, sku, quantity, 
           unit_price_usd, unit_price_ves, subtotal_usd, subtotal_ves, station, notes, 
           status, department_id, group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
        [
          itemId,
          orderId,
          input.order_customer_id || null,
          productId,
          input.product_name.trim(),
          sku,
          qty,
          unitUsd,
          unitVes,
          subtotalUsd,
          subtotalVes,
          input.station || 'KITCHEN',
          input.notes || null,
          input.department_id || null,
          input.group_id || null,
        ]
      );

      // Reservar inventario en el depósito correspondiente si el producto existe en catálogo y maneja inventario
      if (productId) {
        const [prodRow]: any = await conn.query(
          `SELECT tracks_inventory FROM products WHERE id = ?`,
          [productId]
        );
        const tracksInventory = prodRow.length > 0
          ? Boolean(prodRow[0].tracks_inventory !== 0 && prodRow[0].tracks_inventory !== false)
          : true;

        if (tracksInventory) {
          const [whRows]: any = await conn.query(
            `SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 ORDER BY is_main DESC LIMIT 1`,
            [order.branch_id]
          );
          const warehouseId = whRows.length > 0 ? whRows[0].id : null;
          if (warehouseId) {
            await conn.query(
              `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
               VALUES (?, ?, 0.00, ?, CURRENT_TIMESTAMP())
               ON DUPLICATE KEY UPDATE 
                 reserved_stock = reserved_stock + ?,
                 last_movement_at = CURRENT_TIMESTAMP()`,
              [productId, warehouseId, qty, qty]
            );
          }
        }
      }

      // Recalcular totales de orden
      await this.recalculateOrderTotals(conn, orderId);

      return { item_id: itemId };
    });
  }

  static async updateOrderItem(
    itemId: string,
    updates: {
      quantity?: number;
      notes?: string;
      order_customer_id?: string | null;
      station?: PreparationStation;
    }
  ) {
    return withTransaction(async (conn) => {
      const [itemRows]: any = await conn.query(
        `SELECT i.*, o.branch_id 
         FROM restaurant_order_items i
         INNER JOIN restaurant_orders o ON i.order_id = o.id
         WHERE i.id = ? FOR UPDATE`,
        [itemId]
      );
      if (!itemRows.length) throw new Error('Ítem no encontrado');
      const item = itemRows[0];

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.quantity !== undefined) {
        const qty = Number(updates.quantity);
        const subUsd = Number((qty * Number(item.unit_price_usd)).toFixed(2));
        const subVes = Number((qty * Number(item.unit_price_ves)).toFixed(2));
        fields.push(`quantity = ?`, `subtotal_usd = ?`, `subtotal_ves = ?`);
        values.push(qty, subUsd, subVes);

        // Ajustar reserva de inventario si cambió la cantidad
        if (item.product_id) {
          const [prodRow]: any = await conn.query(
            `SELECT tracks_inventory FROM products WHERE id = ?`,
            [item.product_id]
          );
          const tracksInventory = prodRow.length > 0
            ? Boolean(prodRow[0].tracks_inventory !== 0 && prodRow[0].tracks_inventory !== false)
            : true;

          if (tracksInventory) {
            const oldQty = Number(item.quantity);
            const diff = qty - oldQty;
            if (diff !== 0) {
              const [whRows]: any = await conn.query(
                `SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 ORDER BY is_main DESC LIMIT 1`,
                [item.branch_id]
              );
              const warehouseId = whRows.length > 0 ? whRows[0].id : null;
              if (warehouseId) {
                await conn.query(
                  `UPDATE product_stocks 
                   SET reserved_stock = GREATEST(0, reserved_stock + ?),
                       last_movement_at = CURRENT_TIMESTAMP()
                   WHERE product_id = ? AND warehouse_id = ?`,
                  [diff, item.product_id, warehouseId]
                );
              }
            }
          }
        }
      }
      if (updates.notes !== undefined) {
        fields.push(`notes = ?`);
        values.push(updates.notes);
      }
      if (updates.order_customer_id !== undefined) {
        fields.push(`order_customer_id = ?`);
        values.push(updates.order_customer_id);
      }
      if (updates.station !== undefined) {
        fields.push(`station = ?`);
        values.push(updates.station);
      }

      if (fields.length > 0) {
        values.push(itemId);
        await conn.query(`UPDATE restaurant_order_items SET ${fields.join(', ')} WHERE id = ?`, values);
      }

      await this.recalculateOrderTotals(conn, item.order_id);
      return { success: true };
    });
  }

  static async removeOrderItem(itemId: string) {
    return withTransaction(async (conn) => {
      const [itemRows]: any = await conn.query(
        `SELECT i.*, o.branch_id 
         FROM restaurant_order_items i
         INNER JOIN restaurant_orders o ON i.order_id = o.id
         WHERE i.id = ? FOR UPDATE`,
        [itemId]
      );
      if (!itemRows.length) throw new Error('Ítem no encontrado');
      const item = itemRows[0];
      const orderId = item.order_id;

      // Liberar stock reservado del almacén si el producto maneja inventario
      if (item.product_id) {
        const [prodRow]: any = await conn.query(
          `SELECT tracks_inventory FROM products WHERE id = ?`,
          [item.product_id]
        );
        const tracksInventory = prodRow.length > 0
          ? Boolean(prodRow[0].tracks_inventory !== 0 && prodRow[0].tracks_inventory !== false)
          : true;

        if (tracksInventory) {
          const [whRows]: any = await conn.query(
            `SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 ORDER BY is_main DESC LIMIT 1`,
            [item.branch_id]
          );
          const warehouseId = whRows.length > 0 ? whRows[0].id : null;
          if (warehouseId) {
            await conn.query(
              `UPDATE product_stocks 
               SET reserved_stock = GREATEST(0, reserved_stock - ?),
                   last_movement_at = CURRENT_TIMESTAMP()
               WHERE product_id = ? AND warehouse_id = ?`,
              [Number(item.quantity), item.product_id, warehouseId]
            );
          }
        }
      }

      await conn.query(`DELETE FROM restaurant_order_items WHERE id = ?`, [itemId]);
      await this.recalculateOrderTotals(conn, orderId);

      return { success: true };
    });
  }

  private static async recalculateOrderTotals(conn: any, orderId: string) {
    // Total de la orden completa
    const [totRows]: any = await conn.query(
      `SELECT 
        COALESCE(SUM(subtotal_usd), 0) AS total_usd,
        COALESCE(SUM(subtotal_ves), 0) AS total_ves
       FROM restaurant_order_items
       WHERE order_id = ? AND status != 'CANCELLED'`,
      [orderId]
    );
    const totUsd = Number(totRows[0]?.total_usd || 0);
    const totVes = Number(totRows[0]?.total_ves || 0);

    await conn.query(
      `UPDATE restaurant_orders SET total_usd = ?, total_ves = ? WHERE id = ?`,
      [totUsd, totVes, orderId]
    );

    // Totales por cliente
    const [custRows]: any = await conn.query(
      `SELECT id FROM restaurant_order_customers WHERE order_id = ?`,
      [orderId]
    );

    for (const c of custRows) {
      const [custTot]: any = await conn.query(
        `SELECT 
          COALESCE(SUM(subtotal_usd), 0) AS total_usd,
          COALESCE(SUM(subtotal_ves), 0) AS total_ves
         FROM restaurant_order_items
         WHERE order_id = ? AND order_customer_id = ? AND status != 'CANCELLED'`,
        [orderId, c.id]
      );
      await conn.query(
        `UPDATE restaurant_order_customers SET total_usd = ?, total_ves = ? WHERE id = ?`,
        [Number(custTot[0]?.total_usd || 0), Number(custTot[0]?.total_ves || 0), c.id]
      );
    }
  }

  // ==========================================
  // KDS - PANTALLA DE COCINA Y BARRA (PREPARACIÓN)
  // ==========================================

  static async getPreparationQueue(
    branchId: string,
    station?: 'KITCHEN' | 'BAR' | 'ALL',
    waiterId?: string,
    tableId?: string
  ) {
    let sql = `
      SELECT 
        i.id, i.order_id, i.order_customer_id, i.product_name, i.sku, i.quantity,
        i.station, i.notes, i.status, i.created_at,
        c.customer_name,
        o.order_number, o.waiter_id, o.waiter_name,
        t.id AS table_id, t.table_number, t.name AS table_name, t.zone
      FROM restaurant_order_items i
      INNER JOIN restaurant_orders o ON i.order_id = o.id
      INNER JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN restaurant_order_customers c ON i.order_customer_id = c.id
      WHERE o.branch_id = ? 
        AND i.status IN ('PENDING', 'PREPARING', 'READY')
        AND o.status IN ('OPEN', 'BILL_REQUESTED')
    `;
    const params: any[] = [branchId];

    if (station && station !== 'ALL') {
      sql += ` AND i.station = ?`;
      params.push(station);
    }
    if (waiterId && waiterId !== 'ALL') {
      sql += ` AND o.waiter_id = ?`;
      params.push(waiterId);
    }
    if (tableId && tableId !== 'ALL') {
      sql += ` AND o.table_id = ?`;
      params.push(tableId);
    }

    sql += ` ORDER BY i.created_at ASC`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
    }));
  }

  static async updateItemPreparationStatus(itemId: string, status: ItemPreparationStatus) {
    await query(`UPDATE restaurant_order_items SET status = ? WHERE id = ?`, [status, itemId]);
    return { success: true, item_id: itemId, status };
  }

  // ==========================================
  // PAGOS, SEPARACIÓN DE CUENTA (SPLIT BILL) Y CRÉDITO (CxC)
  // ==========================================

  static async getOrderPaymentBreakdown(orderId: string) {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('Comanda no encontrada');

    // Agrupación por cliente
    const customerBreakdowns = order.customers.map((c: any) => {
      const items = order.items.filter((i: any) => i.order_customer_id === c.id);
      const payments = order.payments.filter((p: any) => p.order_customer_id === c.id);
      const paidUsd = payments.reduce((sum: number, p: any) => sum + Number(p.amount_usd), 0);
      const paidVes = payments.reduce((sum: number, p: any) => sum + Number(p.amount_ves), 0);
      const remainingUsd = Math.max(0, Number((c.total_usd - paidUsd).toFixed(2)));
      const remainingVes = Math.max(0, Number((c.total_ves - paidVes).toFixed(2)));

      return {
        customer_id: c.id,
        customer_number: c.customer_number,
        customer_name: c.customer_name,
        linked_erp_customer_id: c.customer_id,
        is_paid: c.is_paid || remainingUsd === 0,
        total_usd: c.total_usd,
        total_ves: c.total_ves,
        paid_usd: paidUsd,
        paid_ves: paidVes,
        remaining_usd: remainingUsd,
        remaining_ves: remainingVes,
        items,
        payments,
      };
    });

    // Ítems generales de la mesa (no asignados a un cliente específico)
    const unassignedItems = order.items.filter((i: any) => !i.order_customer_id);
    const unassignedPayments = order.payments.filter((p: any) => !p.order_customer_id);

    // Totales globales de la mesa
    const totalPaidUsd = order.payments.reduce((sum: number, p: any) => sum + Number(p.amount_usd), 0);
    const totalPaidVes = order.payments.reduce((sum: number, p: any) => sum + Number(p.amount_ves), 0);
    const remainingTableUsd = Math.max(0, Number((order.total_usd - totalPaidUsd).toFixed(2)));
    const remainingTableVes = Math.max(0, Number((order.total_ves - totalPaidVes).toFixed(2)));

    return {
      order_id: order.id,
      order_number: order.order_number,
      table_name: order.table_name,
      table_number: order.table_number,
      waiter_name: order.waiter_name,
      notes: order.notes,
      exchange_rate: order.exchange_rate,
      total_usd: order.total_usd,
      total_ves: order.total_ves,
      total_paid_usd: totalPaidUsd,
      total_paid_ves: totalPaidVes,
      remaining_usd: remainingTableUsd,
      remaining_ves: remainingTableVes,
      is_fully_paid: remainingTableUsd === 0,
      customer_breakdowns: customerBreakdowns,
      unassigned_items: unassignedItems,
      unassigned_payments: unassignedPayments,
      all_payments: order.payments,
    };
  }

  static async addOrderPayment(orderId: string, input: AddOrderPaymentInput) {
    return withTransaction(async (conn) => {
      const [orderRows]: any = await conn.query(
        `SELECT o.*, t.branch_id 
         FROM restaurant_orders o
         INNER JOIN restaurant_tables t ON o.table_id = t.id
         WHERE o.id = ? FOR UPDATE`,
        [orderId]
      );
      if (!orderRows.length) throw new Error('Comanda no encontrada');
      const order = orderRows[0];
      const exRate = Number(order.exchange_rate) || 1.0;

      const currency = input.currency || 'USD';
      const amount = Number(input.amount);
      const amountUsd = currency === 'USD' ? amount : Number((amount / exRate).toFixed(2));
      const amountVes = currency === 'VES' ? amount : Number((amount * exRate).toFixed(2));

      // Si es crédito comercial (CxC)
      let receivableId: string | null = null;
      if (input.is_credit) {
        if (!input.customer_id) {
          throw new Error('Debe seleccionar un cliente del ERP para otorgar crédito (Cuenta por Cobrar)');
        }
        receivableId = crypto.randomUUID();
        const dueDate = input.due_date || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

        // Crear registro en la tabla receivables del ERP
        await conn.query(
          `INSERT INTO receivables 
            (id, branch_id, customer_id, amount_total, amount_paid, due_date, status)
           VALUES (?, ?, ?, ?, 0.00, ?, 'PENDING')`,
          [receivableId, order.branch_id, input.customer_id, amountUsd, dueDate]
        );
      }

      // Si el cliente especifica una nueva forma de pago personalizada que no existía:
      let paymentMethodId = input.payment_method_id || null;
      let paymentMethodName = input.payment_method_name.trim();

      const paymentId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO restaurant_order_payments 
          (id, order_id, order_customer_id, payment_method_id, payment_method_name, 
           currency, amount, amount_usd, amount_ves, exchange_rate, reference, 
           bank_account_id, is_credit, due_date, customer_id, receivable_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          orderId,
          input.order_customer_id || null,
          paymentMethodId,
          paymentMethodName,
          currency,
          amount,
          amountUsd,
          amountVes,
          exRate,
          input.reference || null,
          input.bank_account_id || null,
          input.is_credit ? 1 : 0,
          input.due_date || null,
          input.customer_id || null,
          receivableId,
          input.notes || null,
        ]
      );

      // Si el pago es de un cliente específico, verificar si ya cubrió su saldo
      if (input.order_customer_id) {
        const [paidRows]: any = await conn.query(
          `SELECT COALESCE(SUM(amount_usd), 0) as paid_usd 
           FROM restaurant_order_payments 
           WHERE order_id = ? AND order_customer_id = ?`,
          [orderId, input.order_customer_id]
        );
        const [custRows]: any = await conn.query(
          `SELECT total_usd FROM restaurant_order_customers WHERE id = ?`,
          [input.order_customer_id]
        );
        const totalCustUsd = Number(custRows[0]?.total_usd || 0);
        const paidCustUsd = Number(paidRows[0]?.paid_usd || 0);

        if (paidCustUsd >= totalCustUsd && totalCustUsd > 0) {
          await conn.query(
            `UPDATE restaurant_order_customers SET is_paid = 1 WHERE id = ?`,
            [input.order_customer_id]
          );
        }
      }

      // Actualizar observaciones generales de la comanda si se enviaron
      if (input.order_notes) {
        await conn.query(
          `UPDATE restaurant_orders SET notes = ? WHERE id = ?`,
          [input.order_notes, orderId]
        );
      }

      return { payment_id: paymentId, receivable_id: receivableId };
    });
  }

  // ==========================================
  // CIERRE DE MESA & REGISTRO DE CIERRE
  // ==========================================

  static async closeTableOrder(orderId: string, input?: CloseTableOrderInput) {
    return withTransaction(async (conn) => {
      const [orderRows]: any = await conn.query(
        `SELECT o.*, t.table_number, t.name as table_name, t.zone 
         FROM restaurant_orders o
         LEFT JOIN restaurant_tables t ON o.table_id = t.id
         WHERE o.id = ? FOR UPDATE`,
        [orderId]
      );
      if (!orderRows.length) throw new Error('Comanda no encontrada');
      const order = orderRows[0];

      // Marcar ítems pendientes como servidos al cerrar
      await conn.query(
        `UPDATE restaurant_order_items 
         SET status = 'SERVED' 
         WHERE order_id = ? AND status IN ('PENDING', 'PREPARING', 'READY')`,
        [orderId]
      );

      // Marcar clientes como pagados
      await conn.query(
        `UPDATE restaurant_order_customers SET is_paid = 1 WHERE order_id = ?`,
        [orderId]
      );

      // Cerrar comanda
      await conn.query(
        `UPDATE restaurant_orders 
         SET status = 'PAID', notes = COALESCE(?, notes)
         WHERE id = ?`,
        [input?.notes || null, orderId]
      );

      // Liberar mesa
      await conn.query(
        `UPDATE restaurant_tables 
         SET status = 'AVAILABLE', active_order_id = NULL, current_waiter_id = NULL, current_waiter_name = NULL
         WHERE id = ?`,
        [order.table_id]
      );

      // Calcular estadísticas para el REGISTRO DE CIERRE DE MESA
      const [statsRows]: any = await conn.query(
        `SELECT 
           COUNT(DISTINCT c.id) as customer_count,
           COUNT(i.id) as item_count,
           COALESCE(SUM(i.subtotal_usd), 0) as subtotal_usd,
           COALESCE(SUM(i.subtotal_ves), 0) as subtotal_ves
         FROM restaurant_orders o
         LEFT JOIN restaurant_order_customers c ON o.id = c.order_id
         LEFT JOIN restaurant_order_items i ON o.id = i.order_id AND i.status != 'CANCELLED'
         WHERE o.id = ?`,
        [orderId]
      );

      // Obtener resumen de pagos
      const [paymentRows]: any = await conn.query(
        `SELECT payment_method_name, currency, amount, amount_usd, amount_ves, is_credit, reference
         FROM restaurant_order_payments
         WHERE order_id = ?`,
        [orderId]
      );

      // Calcular duración en minutos
      const [timeRows]: any = await conn.query(
        `SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) as duration_minutes`,
        [order.created_at]
      );
      const durationMinutes = Math.max(0, Number(timeRows[0]?.duration_minutes || 0));

      const stats = statsRows[0] || {};
      const tipUsd = Number(input?.tip_usd || 0);
      const tipVes = Number(input?.tip_ves || (tipUsd * Number(order.exchange_rate)));
      const subtotalUsd = Number(order.total_usd);
      const subtotalVes = Number(order.total_ves);
      const totalUsd = Number((subtotalUsd + tipUsd).toFixed(2));
      const totalVes = Number((subtotalVes + tipVes).toFixed(2));

      const closureId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO restaurant_table_closures 
          (id, company_id, branch_id, order_id, table_id, table_number, table_name, zone, order_number,
           waiter_id, waiter_name, closed_by_user_id, closed_by_user_name, opened_at, closed_at,
           duration_minutes, customer_count, item_count, subtotal_usd, subtotal_ves, tip_usd, tip_ves,
           total_usd, total_ves, exchange_rate, payment_summary, closure_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          closureId,
          order.company_id,
          order.branch_id,
          orderId,
          order.table_id,
          order.table_number || 'N/A',
          order.table_name || 'Mesa',
          order.zone || 'Salón Principal',
          order.order_number,
          order.waiter_id || null,
          order.waiter_name || null,
          input?.closed_by_user_id || null,
          input?.closed_by_user_name || null,
          order.created_at,
          durationMinutes,
          Number(stats.customer_count || 1),
          Number(stats.item_count || 0),
          subtotalUsd,
          subtotalVes,
          tipUsd,
          tipVes,
          totalUsd,
          totalVes,
          order.exchange_rate,
          JSON.stringify(paymentRows || []),
          input?.notes || null,
        ]
      );

      return {
        success: true,
        table_id: order.table_id,
        order_id: orderId,
        closure_id: closureId,
      };
    });
  }

  // ==========================================
  // HISTORIAL DE CIERRES DE MESAS
  // ==========================================

  static async getTableClosures(
    companyId: string,
    branchId: string,
    options?: {
      tableId?: string;
      waiterId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ) {
    let sql = `
      SELECT * FROM restaurant_table_closures
      WHERE company_id = ? AND branch_id = ?
    `;
    const params: any[] = [companyId, branchId];

    if (options?.tableId) {
      sql += ` AND table_id = ?`;
      params.push(options.tableId);
    }
    if (options?.waiterId) {
      sql += ` AND waiter_id = ?`;
      params.push(options.waiterId);
    }
    if (options?.startDate) {
      sql += ` AND DATE(closed_at) >= ?`;
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ` AND DATE(closed_at) <= ?`;
      params.push(options.endDate);
    }

    const limit = options?.limit || 50;
    sql += ` ORDER BY closed_at DESC LIMIT ${limit}`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      ...r,
      subtotal_usd: Number(r.subtotal_usd),
      subtotal_ves: Number(r.subtotal_ves),
      tip_usd: Number(r.tip_usd),
      tip_ves: Number(r.tip_ves),
      total_usd: Number(r.total_usd),
      total_ves: Number(r.total_ves),
      exchange_rate: Number(r.exchange_rate),
      payment_summary: typeof r.payment_summary === 'string' ? JSON.parse(r.payment_summary) : r.payment_summary,
    }));
  }

  static async getTableClosureById(closureId: string) {
    const rows = await query<any>(
      `SELECT * FROM restaurant_table_closures WHERE id = ? LIMIT 1`,
      [closureId]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      ...r,
      subtotal_usd: Number(r.subtotal_usd),
      subtotal_ves: Number(r.subtotal_ves),
      tip_usd: Number(r.tip_usd),
      tip_ves: Number(r.tip_ves),
      total_usd: Number(r.total_usd),
      total_ves: Number(r.total_ves),
      exchange_rate: Number(r.exchange_rate),
      payment_summary: typeof r.payment_summary === 'string' ? JSON.parse(r.payment_summary) : r.payment_summary,
    };
  }

  /**
   * REPORTE DE PROPINAS POR MESERO / USUARIO QUE GENERÓ LA COMANDA
   */
  static async getRestaurantTipsReport(
    companyId: string,
    filters?: {
      branchId?: string;
      waiterId?: string;
      waiterName?: string;
      startDate?: string;
      endDate?: string;
      onlyWithTips?: boolean;
    }
  ): Promise<RestaurantTipsReport> {
    let sql = `
      SELECT 
        c.id as closure_id,
        c.order_id,
        c.order_number,
        c.table_number,
        c.table_name,
        c.zone,
        COALESCE(NULLIF(TRIM(c.waiter_name), ''), NULLIF(TRIM(o.waiter_name), ''), u.full_name, 'Sin asignar') as waiter_name,
        COALESCE(c.waiter_id, o.waiter_id) as waiter_id,
        c.closed_by_user_id,
        c.closed_by_user_name,
        COALESCE(o.customer_name, 'Consumidor Final') as customer_name,
        c.opened_at,
        c.closed_at,
        c.duration_minutes,
        c.subtotal_usd,
        c.subtotal_ves,
        c.tip_usd,
        c.tip_ves,
        c.total_usd,
        c.total_ves,
        c.exchange_rate,
        COALESCE(o.is_invoiced, 0) as is_invoiced,
        o.pos_invoice_id,
        si.invoice_number as pos_invoice_number,
        si.status as invoice_status,
        b.name as branch_name
      FROM restaurant_table_closures c
      INNER JOIN restaurant_orders o ON c.order_id = o.id
      LEFT JOIN users u ON COALESCE(c.waiter_id, o.waiter_id) = u.id
      LEFT JOIN sales_invoices si ON o.pos_invoice_id = si.id
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE c.company_id = ?
    `;
    const params: any[] = [companyId];

    if (filters?.branchId && filters.branchId !== 'ALL' && filters.branchId !== 'all') {
      sql += ` AND c.branch_id = ?`;
      params.push(filters.branchId);
    }

    if (filters?.waiterId && filters.waiterId !== 'ALL' && filters.waiterId !== 'all') {
      sql += ` AND (COALESCE(c.waiter_id, o.waiter_id) = ? OR c.waiter_name = ?)`;
      params.push(filters.waiterId, filters.waiterId);
    } else if (filters?.waiterName && filters.waiterName !== 'ALL' && filters.waiterName !== 'all') {
      sql += ` AND (c.waiter_name LIKE ? OR o.waiter_name LIKE ?)`;
      params.push(`%${filters.waiterName}%`, `%${filters.waiterName}%`);
    }

    if (filters?.startDate) {
      sql += ` AND DATE(c.closed_at) >= ?`;
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      sql += ` AND DATE(c.closed_at) <= ?`;
      params.push(filters.endDate);
    }

    if (filters?.onlyWithTips !== false) {
      sql += ` AND c.tip_usd > 0`;
    }

    sql += ` ORDER BY c.closed_at DESC`;

    const rows = await query<any>(sql, params);

    let totalTipsUSD = 0;
    let totalTipsVES = 0;
    let totalSalesUSD = 0;
    let totalSalesVES = 0;
    let ordersWithTipCount = 0;

    const waiterMap = new Map<string, {
      waiterId?: string | null;
      waiterName: string;
      ordersCount: number;
      ordersWithTipCount: number;
      totalSalesUSD: number;
      totalTipsUSD: number;
      totalTipsVES: number;
    }>();

    const orders: RestaurantTipItem[] = rows.map((r) => {
      const tipUSD = Number(r.tip_usd || 0);
      const tipVES = Number(r.tip_ves || 0);
      const subtotalUSD = Number(r.subtotal_usd || 0);
      const subtotalVES = Number(r.subtotal_ves || 0);
      const totalUSD = Number(r.total_usd || 0);
      const totalVES = Number(r.total_ves || 0);
      const exchangeRate = Number(r.exchange_rate || 1);
      const tipPercent = subtotalUSD > 0 ? Number(((tipUSD / subtotalUSD) * 100).toFixed(2)) : 0;
      const waiterName = r.waiter_name || 'Sin asignar';
      const waiterId = r.waiter_id || null;

      totalTipsUSD += tipUSD;
      totalTipsVES += tipVES;
      totalSalesUSD += subtotalUSD;
      totalSalesVES += subtotalVES;
      if (tipUSD > 0) ordersWithTipCount++;

      // Agrupación acumulada por mesero
      const existing = waiterMap.get(waiterName) || {
        waiterId,
        waiterName,
        ordersCount: 0,
        ordersWithTipCount: 0,
        totalSalesUSD: 0,
        totalTipsUSD: 0,
        totalTipsVES: 0,
      };

      existing.ordersCount++;
      if (tipUSD > 0) existing.ordersWithTipCount++;
      existing.totalSalesUSD = Number((existing.totalSalesUSD + subtotalUSD).toFixed(2));
      existing.totalTipsUSD = Number((existing.totalTipsUSD + tipUSD).toFixed(2));
      existing.totalTipsVES = Number((existing.totalTipsVES + tipVES).toFixed(2));
      waiterMap.set(waiterName, existing);

      return {
        closureId: r.closure_id,
        orderId: r.order_id,
        orderNumber: r.order_number,
        tableNumber: r.table_number,
        tableName: r.table_name,
        zone: r.zone,
        waiterId,
        waiterName,
        closedByUserId: r.closed_by_user_id || null,
        closedByUserName: r.closed_by_user_name || null,
        customerName: r.customer_name || 'Consumidor Final',
        openedAt: r.opened_at ? new Date(r.opened_at).toISOString() : new Date().toISOString(),
        closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : new Date().toISOString(),
        durationMinutes: Number(r.duration_minutes || 0),
        subtotalUSD,
        subtotalVES,
        tipUSD,
        tipVES,
        tipPercent,
        totalUSD,
        totalVES,
        exchangeRate,
        isInvoiced: Boolean(r.is_invoiced),
        posInvoiceId: r.pos_invoice_id || null,
        posInvoiceNumber: r.pos_invoice_number || null,
        invoiceStatus: r.invoice_status || null,
        branchName: r.branch_name || undefined,
      };
    });

    const byWaiter: WaiterTipsSummary[] = Array.from(waiterMap.values()).map((w) => {
      const avgTipUSD = w.ordersWithTipCount > 0 ? Number((w.totalTipsUSD / w.ordersWithTipCount).toFixed(2)) : 0;
      const avgTipPercent = w.totalSalesUSD > 0 ? Number(((w.totalTipsUSD / w.totalSalesUSD) * 100).toFixed(2)) : 0;
      return {
        waiterId: w.waiterId,
        waiterName: w.waiterName,
        ordersCount: w.ordersCount,
        ordersWithTipCount: w.ordersWithTipCount,
        totalSalesUSD: w.totalSalesUSD,
        totalTipsUSD: w.totalTipsUSD,
        totalTipsVES: w.totalTipsVES,
        averageTipUSD: avgTipUSD,
        averageTipPercent: avgTipPercent,
      };
    }).sort((a, b) => b.totalTipsUSD - a.totalTipsUSD);

    const averageTipUSD = ordersWithTipCount > 0 ? Number((totalTipsUSD / ordersWithTipCount).toFixed(2)) : 0;
    const averageTipPercent = totalSalesUSD > 0 ? Number(((totalTipsUSD / totalSalesUSD) * 100).toFixed(2)) : 0;

    return {
      summary: {
        totalTipsUSD: Number(totalTipsUSD.toFixed(2)),
        totalTipsVES: Number(totalTipsVES.toFixed(2)),
        totalSalesUSD: Number(totalSalesUSD.toFixed(2)),
        totalSalesVES: Number(totalSalesVES.toFixed(2)),
        ordersCount: orders.length,
        ordersWithTipCount,
        averageTipUSD,
        averageTipPercent,
      },
      byWaiter,
      orders,
    };
  }

  // ==========================================
  // COMANDAS CERRADAS PARA IMPORTAR EN POS
  // ==========================================

  static async getClosedUnbilledOrders(companyId: string, branchId: string) {
    const orders = await query<any>(
      `SELECT 
        o.id, o.order_number, o.table_id, o.waiter_id, o.waiter_name,
        o.customer_id, o.customer_name, o.total_usd, o.total_ves, o.exchange_rate,
        o.notes, o.created_at, o.updated_at as closed_at,
        t.table_number, t.name as table_name, t.zone,
        COALESCE(tc.tip_usd, 0) as tip_usd,
        COALESCE(tc.tip_ves, 0) as tip_ves
       FROM restaurant_orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       LEFT JOIN (
         SELECT order_id, MAX(tip_usd) as tip_usd, MAX(tip_ves) as tip_ves
         FROM restaurant_table_closures
         GROUP BY order_id
       ) tc ON tc.order_id = o.id
       WHERE o.company_id = ? 
         AND o.branch_id = ? 
         AND o.status = 'PAID' 
         AND (o.is_invoiced = 0 OR o.is_invoiced IS NULL)
         AND o.pos_invoice_id IS NULL
       ORDER BY o.updated_at DESC LIMIT 50`,
      [companyId, branchId]
    );

    if (!orders.length) return [];

    const orderIds = orders.map((o: any) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    const items = await query<any>(
      `SELECT 
        i.*,
        c.customer_name
       FROM restaurant_order_items i
       LEFT JOIN restaurant_order_customers c ON i.order_customer_id = c.id
       WHERE i.order_id IN (${placeholders}) AND i.status != 'CANCELLED'
       ORDER BY i.created_at ASC`,
      orderIds
    );

    const payments = await query<any>(
      `SELECT * FROM restaurant_order_payments WHERE order_id IN (${placeholders})`,
      orderIds
    );

    return orders.map((o: any) => ({
      ...o,
      total_usd: Number(o.total_usd),
      total_ves: Number(o.total_ves),
      tip_usd: Number(o.tip_usd || 0),
      tip_ves: Number(o.tip_ves || 0),
      exchange_rate: Number(o.exchange_rate),
      items: items
        .filter((it: any) => it.order_id === o.id)
        .map((it: any) => ({
          ...it,
          quantity: Number(it.quantity),
          unit_price_usd: Number(it.unit_price_usd),
          unit_price_ves: Number(it.unit_price_ves),
          subtotal_usd: Number(it.subtotal_usd),
          subtotal_ves: Number(it.subtotal_ves),
        })),
      payments: payments
        .filter((p: any) => p.order_id === o.id)
        .map((p: any) => ({
          ...p,
          amount: Number(p.amount),
          amount_usd: Number(p.amount_usd),
          amount_ves: Number(p.amount_ves),
        })),
    }));
  }

  static async markOrderAsInvoiced(orderId: string, invoiceId?: string) {
    return withTransaction(async (conn) => {
      const [orderRows]: any = await conn.query(
        `SELECT branch_id FROM restaurant_orders WHERE id = ? FOR UPDATE`,
        [orderId]
      );
      if (orderRows.length > 0) {
        const branchId = orderRows[0].branch_id;
        const [whRows]: any = await conn.query(
          `SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 ORDER BY is_main DESC LIMIT 1`,
          [branchId]
        );
        const warehouseId = whRows.length > 0 ? whRows[0].id : null;
        if (warehouseId) {
          const [items]: any = await conn.query(
            `SELECT roi.product_id, roi.quantity, p.tracks_inventory 
             FROM restaurant_order_items roi
             INNER JOIN products p ON roi.product_id = p.id
             WHERE roi.order_id = ? AND roi.product_id IS NOT NULL`,
            [orderId]
          );
          for (const item of items) {
            const tracksInventory = Boolean(item.tracks_inventory !== 0 && item.tracks_inventory !== false);
            if (tracksInventory) {
              await conn.query(
                `UPDATE product_stocks 
                 SET reserved_stock = GREATEST(0, reserved_stock - ?),
                     last_movement_at = CURRENT_TIMESTAMP()
                 WHERE product_id = ? AND warehouse_id = ?`,
                [Number(item.quantity), item.product_id, warehouseId]
              );
            }
          }
        }
      }

      await conn.query(
        `UPDATE restaurant_orders 
         SET is_invoiced = 1, pos_invoice_id = ?
         WHERE id = ?`,
        [invoiceId || null, orderId]
      );
      return { success: true };
    });
  }
}
