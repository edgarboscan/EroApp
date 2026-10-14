import { query, withTransaction } from '../../db';
import {
  DepartmentInput,
  GroupInput,
  SubgroupInput,
  ProductInput,
  ProductLocationInput,
  InventoryMovementInput,
  CreateInventoryAdjustmentInput,
  CreateInventoryTransferInput,
  ReceiveInventoryTransferInput,
  KardexFilterInput,
  calculateWeightedAverageCost,
  determineStockStatus,
  calculateSuggestedReorderQuantity,
} from '@ero/shared';
import crypto from 'crypto';

export class InventoryService {
  // ==========================================
  // JERARQUÍA: DEPARTAMENTOS, GRUPOS, SUBGRUPOS
  // ==========================================

  static async getDepartments(companyId: string) {
    return await query<any>(
      `SELECT d.id, d.code, d.name, d.description, d.is_active as isActive,
              (SELECT COUNT(g.id) FROM \`groups\` g WHERE g.department_id = d.id) AS groupsCount
       FROM departments d
       WHERE d.company_id = ?
       ORDER BY d.name ASC`,
      [companyId]
    );
  }

  static async createDepartment(input: DepartmentInput) {
    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO departments (id, company_id, code, name, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.companyId, input.code, input.name, input.description || null, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  static async getGroups(departmentId?: string) {
    return await query<any>(
      `SELECT g.id, g.department_id as departmentId, g.code, g.name, g.description, g.is_active as isActive,
              d.name as departmentName,
              (SELECT COUNT(sg.id) FROM subgroups sg WHERE sg.group_id = g.id) AS subgroupsCount
       FROM \`groups\` g
       INNER JOIN departments d ON g.department_id = d.id
       WHERE (? IS NULL OR g.department_id = ?)
       ORDER BY g.name ASC`,
      [departmentId || null, departmentId || null]
    );
  }

  static async createGroup(input: GroupInput) {
    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO \`groups\` (id, department_id, code, name, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.departmentId, input.code, input.name, input.description || null, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  static async getSubgroups(groupId?: string) {
    return await query<any>(
      `SELECT sg.id, sg.group_id as groupId, sg.code, sg.name, sg.description, sg.is_active as isActive,
              g.name as groupName, d.name as departmentName
       FROM subgroups sg
       INNER JOIN \`groups\` g ON sg.group_id = g.id
       INNER JOIN departments d ON g.department_id = d.id
       WHERE (? IS NULL OR sg.group_id = ?)
       ORDER BY sg.name ASC`,
      [groupId || null, groupId || null]
    );
  }

  static async createSubgroup(input: SubgroupInput) {
    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO subgroups (id, group_id, code, name, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.groupId, input.code, input.name, input.description || null, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  // ==========================================
  // UBICACIÓN FÍSICA (PASILLO, ESTANTE, COMPARTIMIENTO)
  // ==========================================

  static async getProductLocations(productId: string) {
    return await query<any>(
      `SELECT pl.id, pl.product_id as productId, pl.warehouse_id as warehouseId,
              w.name as warehouseName, pl.aisle, pl.shelf, pl.compartment, pl.notes
       FROM product_locations pl
       INNER JOIN warehouses w ON pl.warehouse_id = w.id
       WHERE pl.product_id = ?`,
      [productId]
    );
  }

  static async setProductLocation(input: ProductLocationInput) {
    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         aisle = VALUES(aisle),
         shelf = VALUES(shelf),
         compartment = VALUES(compartment),
         notes = VALUES(notes),
         updated_at = NOW()`,
      [id, input.productId, input.warehouseId, input.aisle || null, input.shelf || null, input.compartment || null, input.notes || null]
    );
    return { id, ...input };
  }

  static async searchLocations(params: { warehouseId?: string; aisle?: string; shelf?: string; compartment?: string }) {
    return await query<any>(
      `SELECT pl.aisle, pl.shelf, pl.compartment, pl.warehouse_id as warehouseId, w.name as warehouseName,
              p.id as productId, p.sku, p.name as productName, ps.current_stock as currentStock
       FROM product_locations pl
       INNER JOIN products p ON pl.product_id = p.id
       INNER JOIN warehouses w ON pl.warehouse_id = w.id
       LEFT JOIN product_stocks ps ON p.id = ps.product_id AND pl.warehouse_id = ps.warehouse_id
       WHERE (? IS NULL OR pl.warehouse_id = ?)
         AND (? IS NULL OR pl.aisle LIKE CONCAT('%', ?, '%'))
         AND (? IS NULL OR pl.shelf LIKE CONCAT('%', ?, '%'))
         AND (? IS NULL OR pl.compartment LIKE CONCAT('%', ?, '%'))
       ORDER BY pl.aisle, pl.shelf, pl.compartment`,
      [
        params.warehouseId || null, params.warehouseId || null,
        params.aisle || null, params.aisle || null,
        params.shelf || null, params.shelf || null,
        params.compartment || null, params.compartment || null,
      ]
    );
  }

  // ==========================================
  // CATÁLOGO DE PRODUCTOS Y MOVIMIENTOS
  // ==========================================

  static async getProducts(companyId: string, filters: {
    departmentId?: string;
    groupId?: string;
    subgroupId?: string;
    search?: string;
    warehouseId?: string;
  }) {
    return await query<any>(
      `SELECT p.id, p.sku, p.barcode, p.name, p.description, p.product_type as productType,
              p.department_id as departmentId, d.name as departmentName,
              p.group_id as groupId, g.name as groupName,
              p.subgroup_id as subgroupId, sg.name as subgroupName,
              p.brand, p.unit_of_measure as unitOfMeasure,
              p.cost_price as costPrice, p.base_price as basePrice, p.currency,
              p.default_tax_rate_id as defaultTaxRateId, tr.name as taxRateName, COALESCE(tr.rate, 16.0) as taxRate,
              p.tax_inclusive as taxInclusive,
              p.min_stock as minStock, p.max_stock as maxStock, p.is_active as isActive,
              COALESCE(ps.current_stock, 0) as currentStock,
              pl.aisle, pl.shelf, pl.compartment
       FROM products p
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN \`groups\` g ON p.group_id = g.id
       LEFT JOIN subgroups sg ON p.subgroup_id = sg.id
       LEFT JOIN tax_rates tr ON p.default_tax_rate_id = tr.id
       LEFT JOIN product_stocks ps ON p.id = ps.product_id AND (? IS NULL OR ps.warehouse_id = ?)
       LEFT JOIN product_locations pl ON p.id = pl.product_id AND (? IS NULL OR pl.warehouse_id = ?)
       WHERE p.company_id = ?
         AND (? IS NULL OR p.department_id = ?)
         AND (? IS NULL OR p.group_id = ?)
         AND (? IS NULL OR p.subgroup_id = ?)
         AND (? IS NULL OR p.name LIKE CONCAT('%', ?, '%') OR p.sku LIKE CONCAT('%', ?, '%') OR p.barcode LIKE CONCAT('%', ?, '%'))
       ORDER BY p.name ASC`,
      [
        filters.warehouseId || null, filters.warehouseId || null,
        filters.warehouseId || null, filters.warehouseId || null,
        companyId,
        filters.departmentId || null, filters.departmentId || null,
        filters.groupId || null, filters.groupId || null,
        filters.subgroupId || null, filters.subgroupId || null,
        filters.search || null, filters.search || null, filters.search || null, filters.search || null,
      ]
    );
  }

  static async createProduct(input: ProductInput) {
    return await withTransaction(async (conn) => {
      const id = input.id || crypto.randomUUID();

      await conn.query(
        `INSERT INTO products (
          id, company_id, sku, barcode, name, description, product_type,
          department_id, group_id, subgroup_id, supplier_id, brand, unit_of_measure,
          cost_price, base_price, currency, default_tax_rate_id, tax_inclusive,
          min_stock, max_stock, has_batches, has_serials, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, input.companyId, input.sku, input.barcode || null, input.name, input.description || null, input.productType,
          input.departmentId || null, input.groupId || null, input.subgroupId || null, input.supplierId || null,
          input.brand || null, input.unitOfMeasure, input.costPrice, input.basePrice, input.currency,
          input.defaultTaxRateId || null, input.taxInclusive ? 1 : 0, input.minStock, input.maxStock,
          input.hasBatches ? 1 : 0, input.hasSerials ? 1 : 0, input.isActive ? 1 : 0,
        ]
      );

      // Si se enviaron ubicaciones iniciales, registrarlas
      if (input.locations && input.locations.length > 0) {
        for (const loc of input.locations) {
          await conn.query(
            `INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), id, loc.warehouseId, loc.aisle || null, loc.shelf || null, loc.compartment || null, loc.notes || null]
          );
        }
      }

      return { id, ...input };
    });
  }

  static async recordMovement(input: InventoryMovementInput, userId: string) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO inventory_movements (
        id, branch_id, warehouse_id, product_id, user_id, movement_type,
        quantity, unit_cost, total_cost, reference_document, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id, input.branchId, input.warehouseId, input.productId, userId, input.movementType,
        input.quantity, input.unitCost, (input.quantity * input.unitCost),
        input.referenceDocument || null, input.reason || null,
      ]
    );
    return { id, ...input };
  }

  /**
   * Obtiene el Kardex Valorizado detallado con saldo acumulado
   */
  static async getKardex(companyId: string, filters: KardexFilterInput) {
    const params: any[] = [companyId];
    let sql = `
      SELECT 
        im.id, im.branch_id, b.name as branch_name,
        im.warehouse_id, w.name as warehouse_name,
        im.product_id, p.sku, p.name as product_name, p.unit_of_measure,
        im.movement_type, im.quantity, im.unit_cost, im.total_cost,
        im.previous_stock, im.new_stock, im.reference_document, im.reason,
        im.created_at, u.full_name as user_name
      FROM inventory_movements im
      INNER JOIN products p ON im.product_id = p.id
      INNER JOIN warehouses w ON im.warehouse_id = w.id
      INNER JOIN branches b ON im.branch_id = b.id
      INNER JOIN users u ON im.user_id = u.id
      WHERE p.company_id = ?
    `;

    if (filters.branchId) {
      sql += ` AND im.branch_id = ?`;
      params.push(filters.branchId);
    }
    if (filters.warehouseId) {
      sql += ` AND im.warehouse_id = ?`;
      params.push(filters.warehouseId);
    }
    if (filters.productId) {
      sql += ` AND im.product_id = ?`;
      params.push(filters.productId);
    }
    if (filters.movementType) {
      sql += ` AND im.movement_type = ?`;
      params.push(filters.movementType);
    }
    if (filters.startDate) {
      sql += ` AND im.created_at >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND im.created_at <= ?`;
      params.push(filters.endDate);
    }

    sql += ` ORDER BY im.created_at DESC LIMIT 200`;

    const rows = await query<any>(sql, params);

    let totalInQty = 0;
    let totalOutQty = 0;
    let totalInValue = 0;
    let totalOutValue = 0;

    for (const r of rows) {
      const qty = Number(r.quantity);
      const total = Number(r.total_cost);
      if (['IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE'].includes(r.movement_type)) {
        totalInQty += qty;
        totalInValue += total;
      } else {
        totalOutQty += qty;
        totalOutValue += total;
      }
    }

    return {
      movements: rows.map((r) => ({
        id: r.id,
        branchId: r.branch_id,
        branchName: r.branch_name,
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        productId: r.product_id,
        sku: r.sku,
        productName: r.product_name,
        unitOfMeasure: r.unit_of_measure,
        movementType: r.movement_type,
        quantity: Number(r.quantity),
        unitCost: Number(r.unit_cost),
        totalCost: Number(r.total_cost),
        previousStock: Number(r.previous_stock),
        newStock: Number(r.new_stock),
        referenceDocument: r.reference_document,
        reason: r.reason,
        createdAt: r.created_at,
        userName: r.user_name,
      })),
      summary: {
        totalMovements: rows.length,
        totalInQty: Number(totalInQty.toFixed(2)),
        totalOutQty: Number(totalOutQty.toFixed(2)),
        totalInValue: Number(totalInValue.toFixed(2)),
        totalOutValue: Number(totalOutValue.toFixed(2)),
      },
    };
  }

  /**
   * Obtiene productos con stock crítico, agotados y sobre-stock
   */
  static async getStockAlerts(companyId: string, branchId?: string, warehouseId?: string) {
    const params: any[] = [companyId];
    let sql = `
      SELECT 
        p.id as product_id, p.sku, p.name as product_name, p.unit_of_measure,
        p.min_stock, p.max_stock, p.cost_price, p.base_price,
        w.id as warehouse_id, w.name as warehouse_name,
        b.id as branch_id, b.name as branch_name,
        COALESCE(ps.current_stock, 0) as current_stock,
        COALESCE(ps.reserved_stock, 0) as reserved_stock,
        COALESCE(ps.current_stock, 0) - COALESCE(ps.reserved_stock, 0) as available_stock
      FROM products p
      CROSS JOIN warehouses w
      INNER JOIN branches b ON w.branch_id = b.id
      LEFT JOIN product_stocks ps ON p.id = ps.product_id AND w.id = ps.warehouse_id
      WHERE p.company_id = ? AND p.is_active = 1 AND p.product_type = 'physical'
    `;

    if (branchId) {
      sql += ` AND b.id = ?`;
      params.push(branchId);
    }
    if (warehouseId) {
      sql += ` AND w.id = ?`;
      params.push(warehouseId);
    }

    sql += ` ORDER BY available_stock ASC`;

    const rows = await query<any>(sql, params);

    return rows
      .map((r) => {
        const available = Number(r.available_stock);
        const minStock = Number(r.min_stock);
        const maxStock = Number(r.max_stock);
        const status = determineStockStatus(available, minStock, maxStock);
        const suggestedReorder = calculateSuggestedReorderQuantity(available, minStock, maxStock);

        return {
          productId: r.product_id,
          sku: r.sku,
          productName: r.product_name,
          unitOfMeasure: r.unit_of_measure,
          warehouseId: r.warehouse_id,
          warehouseName: r.warehouse_name,
          branchId: r.branch_id,
          branchName: r.branch_name,
          minStock,
          maxStock,
          costPrice: Number(r.cost_price),
          basePrice: Number(r.base_price),
          currentStock: Number(r.current_stock),
          reservedStock: Number(r.reserved_stock),
          availableStock: available,
          status,
          suggestedReorderQuantity: suggestedReorder,
        };
      })
      .filter((r) => r.status !== 'OPTIMAL');
  }

  /**
   * Registra un ajuste de inventario (Merma / Sobrante / Conteo físico)
   */
  static async createAdjustment(companyId: string, userId: string, data: CreateInventoryAdjustmentInput) {
    return await withTransaction(async (conn) => {
      const now = new Date();
      const prefix = `AJU-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      const [countResult]: any = await conn.query(
        `SELECT COUNT(id) as count FROM inventory_adjustments WHERE company_id = ? AND adjustment_number LIKE CONCAT(?, '%')`,
        [companyId, prefix]
      );
      const nextNum = (countResult[0]?.count || 0) + 1;
      const adjustmentNumber = `${prefix}-${nextNum.toString().padStart(4, '0')}`;

      const adjustmentId = crypto.randomUUID();
      let totalCostImpact = 0;

      for (const item of data.items) {
        const [stockRows]: any = await conn.query(
          `SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ?`,
          [item.productId, data.warehouseId]
        );
        const previousStock = Number(stockRows[0]?.current_stock || 0);
        let newStock = previousStock;

        if (item.movementType === 'ADJUST_IN') {
          newStock = previousStock + item.quantity;
          totalCostImpact += item.quantity * item.unitCost;
        } else {
          newStock = Math.max(0, previousStock - item.quantity);
          totalCostImpact -= item.quantity * item.unitCost;
        }

        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP())
           ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = CURRENT_TIMESTAMP()`,
          [item.productId, data.warehouseId, newStock]
        );

        const itemId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO inventory_adjustment_items (
            id, adjustment_id, product_id, movement_type, previous_stock,
            quantity, new_stock, unit_cost, total_cost, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            adjustmentId,
            item.productId,
            item.movementType,
            previousStock,
            item.quantity,
            newStock,
            item.unitCost,
            item.quantity * item.unitCost,
            item.notes || null,
          ]
        );

        await conn.query(
          `INSERT INTO inventory_movements (
            id, branch_id, warehouse_id, product_id, user_id, movement_type,
            quantity, unit_cost, total_cost, previous_stock, new_stock,
            reference_document, reason, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
          [
            crypto.randomUUID(),
            data.branchId,
            data.warehouseId,
            item.productId,
            userId,
            item.movementType,
            item.quantity,
            item.unitCost,
            item.quantity * item.unitCost,
            previousStock,
            newStock,
            adjustmentNumber,
            data.reason,
          ]
        );
      }

      await conn.query(
        `INSERT INTO inventory_adjustments (
          id, company_id, branch_id, warehouse_id, user_id,
          adjustment_number, type, total_cost_impact, reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPLIED')`,
        [
          adjustmentId,
          companyId,
          data.branchId,
          data.warehouseId,
          userId,
          adjustmentNumber,
          data.type,
          totalCostImpact,
          data.reason,
        ]
      );

      return {
        id: adjustmentId,
        adjustmentNumber,
        type: data.type,
        totalCostImpact,
        itemsCount: data.items.length,
        status: 'APPLIED',
      };
    });
  }

  /**
   * Obtiene el listado de ajustes de inventario realizados
   */
  static async getAdjustmentsHistory(companyId: string, branchId?: string, warehouseId?: string) {
    const params: any[] = [companyId];
    let sql = `
      SELECT 
        ia.id, ia.adjustment_number, ia.type, ia.adjustment_date,
        ia.total_cost_impact, ia.reason, ia.status,
        b.name as branch_name, w.name as warehouse_name, u.full_name as user_name,
        (SELECT COUNT(iai.id) FROM inventory_adjustment_items iai WHERE iai.adjustment_id = ia.id) as items_count
      FROM inventory_adjustments ia
      INNER JOIN branches b ON ia.branch_id = b.id
      INNER JOIN warehouses w ON ia.warehouse_id = w.id
      INNER JOIN users u ON ia.user_id = u.id
      WHERE ia.company_id = ?
    `;

    if (branchId) {
      sql += ` AND ia.branch_id = ?`;
      params.push(branchId);
    }
    if (warehouseId) {
      sql += ` AND ia.warehouse_id = ?`;
      params.push(warehouseId);
    }

    sql += ` ORDER BY ia.adjustment_date DESC LIMIT 50`;

    return await query<any>(sql, params);
  }

  /**
   * Registra un traslado entre depósitos (sale en tránsito del almacén de origen)
   */
  static async createTransfer(companyId: string, userId: string, data: CreateInventoryTransferInput) {
    if (data.originWarehouseId === data.destinationWarehouseId) {
      throw new Error('El depósito de origen no puede ser igual al de destino');
    }

    return await withTransaction(async (conn) => {
      const now = new Date();
      const prefix = `TRS-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      const [countResult]: any = await conn.query(
        `SELECT COUNT(id) as count FROM inventory_transfers WHERE company_id = ? AND transfer_number LIKE CONCAT(?, '%')`,
        [companyId, prefix]
      );
      const nextNum = (countResult[0]?.count || 0) + 1;
      const transferNumber = `${prefix}-${nextNum.toString().padStart(4, '0')}`;

      const transferId = crypto.randomUUID();
      let totalCost = 0;

      for (const item of data.items) {
        const [stockRows]: any = await conn.query(
          `SELECT ps.current_stock, p.cost_price 
           FROM product_stocks ps
           INNER JOIN products p ON ps.product_id = p.id
           WHERE ps.product_id = ? AND ps.warehouse_id = ?`,
          [item.productId, data.originWarehouseId]
        );

        const currentStock = Number(stockRows[0]?.current_stock || 0);
        const unitCost = Number(stockRows[0]?.cost_price || 0);

        if (currentStock < item.quantity) {
          throw new Error('Stock insuficiente en almacén de origen para el producto seleccionado');
        }

        const newStockOrigin = currentStock - item.quantity;
        totalCost += item.quantity * unitCost;

        await conn.query(
          `UPDATE product_stocks SET current_stock = ?, last_movement_at = CURRENT_TIMESTAMP()
           WHERE product_id = ? AND warehouse_id = ?`,
          [newStockOrigin, item.productId, data.originWarehouseId]
        );

        await conn.query(
          `INSERT INTO inventory_transfer_items (
            id, transfer_id, product_id, quantity_sent, unit_cost, notes
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), transferId, item.productId, item.quantity, unitCost, item.notes || null]
        );

        await conn.query(
          `INSERT INTO inventory_movements (
            id, branch_id, warehouse_id, product_id, user_id, movement_type,
            quantity, unit_cost, total_cost, previous_stock, new_stock,
            reference_document, reason, created_at
          ) VALUES (?, ?, ?, ?, ?, 'TRANSFER_OUT', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
          [
            crypto.randomUUID(),
            data.originBranchId,
            data.originWarehouseId,
            item.productId,
            userId,
            item.quantity,
            unitCost,
            item.quantity * unitCost,
            currentStock,
            newStockOrigin,
            transferNumber,
            data.notes || 'Traslado en tránsito a otro depósito',
          ]
        );
      }

      await conn.query(
        `INSERT INTO inventory_transfers (
          id, company_id, transfer_number, origin_branch_id, origin_warehouse_id,
          destination_branch_id, destination_warehouse_id, status, total_items,
          total_cost, shipped_by_user_id, shipped_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'IN_TRANSIT', ?, ?, ?, CURRENT_TIMESTAMP(), ?)`,
        [
          transferId,
          companyId,
          transferNumber,
          data.originBranchId,
          data.originWarehouseId,
          data.destinationBranchId,
          data.destinationWarehouseId,
          data.items.length,
          totalCost,
          userId,
          data.notes || null,
        ]
      );

      return {
        id: transferId,
        transferNumber,
        status: 'IN_TRANSIT',
        totalItems: data.items.length,
        totalCost,
      };
    });
  }

  /**
   * Recepciona un traslado en el depósito de destino acreditando el stock
   */
  static async receiveTransfer(companyId: string, userId: string, data: ReceiveInventoryTransferInput) {
    return await withTransaction(async (conn) => {
      const [transferRows]: any = await conn.query(
        `SELECT * FROM inventory_transfers WHERE id = ? AND company_id = ? AND status = 'IN_TRANSIT'`,
        [data.transferId, companyId]
      );

      if (!transferRows || transferRows.length === 0) {
        throw new Error('Traslado no encontrado o no se encuentra en tránsito');
      }

      const transfer = transferRows[0];

      const [items]: any = await conn.query(
        `SELECT * FROM inventory_transfer_items WHERE transfer_id = ?`,
        [transfer.id]
      );

      for (const item of items) {
        const receivedItem = data.items?.find((i) => i.productId === item.product_id);
        const qtyReceived = receivedItem ? receivedItem.quantityReceived : Number(item.quantity_sent);

        const [destStockRows]: any = await conn.query(
          `SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ?`,
          [item.product_id, transfer.destination_warehouse_id]
        );
        const prevDestStock = Number(destStockRows[0]?.current_stock || 0);
        const newDestStock = prevDestStock + qtyReceived;

        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP())
           ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = CURRENT_TIMESTAMP()`,
          [item.product_id, transfer.destination_warehouse_id, newDestStock]
        );

        await conn.query(
          `UPDATE inventory_transfer_items SET quantity_received = ? WHERE id = ?`,
          [qtyReceived, item.id]
        );

        await conn.query(
          `INSERT INTO inventory_movements (
            id, branch_id, warehouse_id, product_id, user_id, movement_type,
            quantity, unit_cost, total_cost, previous_stock, new_stock,
            reference_document, reason, created_at
          ) VALUES (?, ?, ?, ?, ?, 'TRANSFER_IN', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
          [
            crypto.randomUUID(),
            transfer.destination_branch_id,
            transfer.destination_warehouse_id,
            item.product_id,
            userId,
            qtyReceived,
            Number(item.unit_cost),
            qtyReceived * Number(item.unit_cost),
            prevDestStock,
            newDestStock,
            transfer.transfer_number,
            data.notes || 'Recepción conforme de mercancía trasladada',
          ]
        );
      }

      await conn.query(
        `UPDATE inventory_transfers SET
          status = 'RECEIVED',
          received_by_user_id = ?,
          received_at = CURRENT_TIMESTAMP(),
          notes = COALESCE(CONCAT(notes, '\n', ?), notes)
         WHERE id = ?`,
        [userId, data.notes || '', transfer.id]
      );

      return {
        id: transfer.id,
        transferNumber: transfer.transfer_number,
        status: 'RECEIVED',
      };
    });
  }

  /**
   * Obtiene la lista de traslados entre depósitos
   */
  static async getTransfers(companyId: string, branchId?: string, status?: string) {
    const params: any[] = [companyId];
    let sql = `
      SELECT 
        it.id, it.transfer_number, it.status, it.total_items, it.total_cost,
        it.shipped_at, it.received_at, it.notes,
        ob.name as origin_branch_name, ow.name as origin_warehouse_name,
        db.name as destination_branch_name, dw.name as destination_warehouse_name,
        su.full_name as shipped_by_name, ru.full_name as received_by_name
      FROM inventory_transfers it
      INNER JOIN branches ob ON it.origin_branch_id = ob.id
      INNER JOIN warehouses ow ON it.origin_warehouse_id = ow.id
      INNER JOIN branches db ON it.destination_branch_id = db.id
      INNER JOIN warehouses dw ON it.destination_warehouse_id = dw.id
      INNER JOIN users su ON it.shipped_by_user_id = su.id
      LEFT JOIN users ru ON it.received_by_user_id = ru.id
      WHERE it.company_id = ?
    `;

    if (branchId) {
      sql += ` AND (it.origin_branch_id = ? OR it.destination_branch_id = ?)`;
      params.push(branchId, branchId);
    }
    if (status) {
      sql += ` AND it.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY it.created_at DESC LIMIT 50`;

    return await query<any>(sql, params);
  }
}
