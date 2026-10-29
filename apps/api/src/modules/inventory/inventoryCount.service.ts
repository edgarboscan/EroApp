import { query, pool } from '../../db';
import crypto from 'crypto';
import {
  CreateInventoryCountInput,
  WarehouseProductStockItem,
  InventoryCount,
  InventoryCountItem,
  ReconcileInventoryCountInput,
} from '@ero/shared';
import { InventoryService } from './inventory.service';

export class InventoryCountService {
  /**
   * Obtiene la lista de productos con su stock actual en un depósito específico,
   * permitiendo buscar por código de barras, SKU o nombre y aplicar filtros.
   */
  static async getWarehouseProductsStock(
    companyId: string,
    filters: {
      branchId: string;
      warehouseId: string;
      departmentId?: string;
      groupId?: string;
      subgroupId?: string;
      search?: string;
      stockFilter?: 'ALL' | 'WITH_STOCK' | 'ZERO_STOCK' | 'NEGATIVE_STOCK';
    }
  ): Promise<WarehouseProductStockItem[]> {
    let sql = `
      SELECT 
        p.id,
        p.sku,
        p.barcode,
        p.name,
        p.description,
        p.department_id as departmentId,
        d.name as departmentName,
        p.group_id as groupId,
        g.name as groupName,
        p.subgroup_id as subgroupId,
        sg.name as subgroupName,
        p.brand,
        p.unit_of_measure as unitOfMeasure,
        COALESCE(p.cost_price, 0) as costPrice,
        COALESCE(p.base_price, 0) as basePrice,
        p.currency,
        COALESCE(tr.rate, 16.0) as taxRate,
        COALESCE(ps.current_stock, 0) as currentStock,
        COALESCE(ps.reserved_stock, 0) as reservedStock,
        COALESCE(ps.available_stock, COALESCE(ps.current_stock, 0) - COALESCE(ps.reserved_stock, 0)) as availableStock,
        pl.aisle,
        pl.shelf,
        pl.compartment,
        ROUND(COALESCE(ps.current_stock, 0) * COALESCE(p.cost_price, 0), 2) as totalCostValuation,
        ROUND(COALESCE(ps.current_stock, 0) * COALESCE(p.base_price, 0), 2) as totalSaleValuation
      FROM products p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN \`groups\` g ON p.group_id = g.id
      LEFT JOIN subgroups sg ON p.subgroup_id = sg.id
      LEFT JOIN tax_rates tr ON p.default_tax_rate_id = tr.id
      LEFT JOIN product_stocks ps ON p.id = ps.product_id AND ps.warehouse_id = ?
      LEFT JOIN product_locations pl ON p.id = pl.product_id AND pl.warehouse_id = ?
      WHERE p.company_id = ? AND p.is_active = 1 AND p.tracks_inventory = 1
    `;

    const params: any[] = [filters.warehouseId, filters.warehouseId, companyId];

    if (filters.departmentId) {
      sql += ' AND p.department_id = ?';
      params.push(filters.departmentId);
    }

    if (filters.groupId) {
      sql += ' AND p.group_id = ?';
      params.push(filters.groupId);
    }

    if (filters.subgroupId) {
      sql += ' AND p.subgroup_id = ?';
      params.push(filters.subgroupId);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      sql += ' AND (p.barcode LIKE ? OR p.sku LIKE ? OR p.name LIKE ?)';
      params.push(term, term, term);
    }

    if (filters.stockFilter === 'WITH_STOCK') {
      sql += ' AND COALESCE(ps.current_stock, 0) > 0';
    } else if (filters.stockFilter === 'ZERO_STOCK') {
      sql += ' AND COALESCE(ps.current_stock, 0) = 0';
    } else if (filters.stockFilter === 'NEGATIVE_STOCK') {
      sql += ' AND COALESCE(ps.current_stock, 0) < 0';
    }

    sql += ' ORDER BY pl.aisle ASC, pl.shelf ASC, d.name ASC, p.name ASC';

    const rows = await query<any>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      barcode: r.barcode || null,
      name: r.name,
      description: r.description || null,
      departmentId: r.departmentId || null,
      departmentName: r.departmentName || null,
      groupId: r.groupId || null,
      groupName: r.groupName || null,
      subgroupId: r.subgroupId || null,
      subgroupName: r.subgroupName || null,
      brand: r.brand || null,
      unitOfMeasure: r.unitOfMeasure || 'UND',
      costPrice: Number(r.costPrice || 0),
      basePrice: Number(r.basePrice || 0),
      currency: r.currency || 'USD',
      taxRate: Number(r.taxRate || 16.0),
      currentStock: Number(r.currentStock || 0),
      reservedStock: Number(r.reservedStock || 0),
      availableStock: Number(r.availableStock || 0),
      aisle: r.aisle || null,
      shelf: r.shelf || null,
      compartment: r.compartment || null,
      totalCostValuation: Number(r.totalCostValuation || 0),
      totalSaleValuation: Number(r.totalSaleValuation || 0),
    }));
  }

  /**
   * Listar sesiones de conteo de inventario
   */
  static async getInventoryCounts(
    companyId: string,
    filters: {
      branchId?: string;
      warehouseId?: string;
      status?: string;
      search?: string;
    }
  ): Promise<InventoryCount[]> {
    let sql = `
      SELECT 
        ic.id,
        ic.company_id as companyId,
        ic.branch_id as branchId,
        b.name as branchName,
        ic.warehouse_id as warehouseId,
        w.code as warehouseCode,
        w.name as warehouseName,
        ic.count_number as countNumber,
        ic.title,
        ic.status,
        ic.count_type as countType,
        ic.department_id as departmentId,
        d.name as departmentName,
        ic.group_id as groupId,
        g.name as groupName,
        ic.subgroup_id as subgroupId,
        sg.name as subgroupName,
        ic.blind_count as blindCount,
        ic.total_products as totalProducts,
        ic.total_counted as totalCounted,
        ic.total_matched as totalMatched,
        ic.total_discrepancies as totalDiscrepancies,
        ic.total_surplus_cost as totalSurplusCost,
        ic.total_shortage_cost as totalShortageCost,
        ic.net_cost_impact as netCostImpact,
        ic.adjustment_id as adjustmentId,
        ia.adjustment_number as adjustmentNumber,
        ic.created_by as createdBy,
        u.name as createdByName,
        ic.notes,
        ic.started_at as startedAt,
        ic.completed_at as completedAt,
        ic.applied_at as appliedAt
      FROM inventory_counts ic
      INNER JOIN branches b ON ic.branch_id = b.id
      INNER JOIN warehouses w ON ic.warehouse_id = w.id
      LEFT JOIN departments d ON ic.department_id = d.id
      LEFT JOIN \`groups\` g ON ic.group_id = g.id
      LEFT JOIN subgroups sg ON ic.subgroup_id = sg.id
      LEFT JOIN inventory_adjustments ia ON ic.adjustment_id = ia.id
      LEFT JOIN users u ON ic.created_by = u.id
      WHERE ic.company_id = ?
    `;

    const params: any[] = [companyId];

    if (filters.branchId && filters.branchId !== 'ALL') {
      sql += ' AND ic.branch_id = ?';
      params.push(filters.branchId);
    }

    if (filters.warehouseId && filters.warehouseId !== 'ALL') {
      sql += ' AND ic.warehouse_id = ?';
      params.push(filters.warehouseId);
    }

    if (filters.status && filters.status !== 'ALL') {
      sql += ' AND ic.status = ?';
      params.push(filters.status);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      sql += ' AND (ic.count_number LIKE ? OR ic.title LIKE ? OR w.name LIKE ?)';
      params.push(term, term, term);
    }

    sql += ' ORDER BY ic.started_at DESC';

    const rows = await query<any>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      branchId: r.branchId,
      branchName: r.branchName,
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouseCode,
      warehouseName: r.warehouseName,
      countNumber: r.countNumber,
      title: r.title,
      status: r.status,
      countType: r.countType,
      departmentId: r.departmentId || null,
      departmentName: r.departmentName || null,
      groupId: r.groupId || null,
      groupName: r.groupName || null,
      subgroupId: r.subgroupId || null,
      subgroupName: r.subgroupName || null,
      blindCount: Boolean(r.blindCount),
      totalProducts: Number(r.totalProducts || 0),
      totalCounted: Number(r.totalCounted || 0),
      totalMatched: Number(r.totalMatched || 0),
      totalDiscrepancies: Number(r.totalDiscrepancies || 0),
      totalSurplusCost: Number(r.totalSurplusCost || 0),
      totalShortageCost: Number(r.totalShortageCost || 0),
      netCostImpact: Number(r.netCostImpact || 0),
      adjustmentId: r.adjustmentId || null,
      adjustmentNumber: r.adjustmentNumber || null,
      createdBy: r.createdBy,
      createdByName: r.createdByName || 'Usuario',
      notes: r.notes || null,
      startedAt: r.startedAt,
      completedAt: r.completedAt || null,
      appliedAt: r.appliedAt || null,
    }));
  }

  /**
   * Obtener detalle de una sesión de conteo con todos sus renglones
   */
  static async getInventoryCountById(companyId: string, id: string): Promise<InventoryCount | null> {
    const counts = await this.getInventoryCounts(companyId, {});
    const count = counts.find((c) => c.id === id);
    if (!count) return null;

    const itemsRows = await query<any>(
      `SELECT 
        ici.id,
        ici.count_id as countId,
        ici.product_id as productId,
        p.sku,
        p.barcode,
        p.name as productName,
        p.unit_of_measure as unitOfMeasure,
        d.name as departmentName,
        pl.aisle,
        pl.shelf,
        pl.compartment,
        ici.system_stock as systemStock,
        ici.counted_stock as countedStock,
        ici.difference,
        ici.unit_cost as unitCost,
        ici.cost_impact as costImpact,
        ici.status,
        ici.notes,
        ici.counted_at as countedAt,
        ici.counted_by as countedBy,
        u.name as countedByName
      FROM inventory_count_items ici
      INNER JOIN products p ON ici.product_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN product_locations pl ON p.id = pl.product_id AND pl.warehouse_id = ?
      LEFT JOIN users u ON ici.counted_by = u.id
      WHERE ici.count_id = ?
      ORDER BY pl.aisle ASC, pl.shelf ASC, p.name ASC`,
      [count.warehouseId, id]
    );

    count.items = itemsRows.map((it: any) => ({
      id: it.id,
      countId: it.countId,
      productId: it.productId,
      sku: it.sku,
      barcode: it.barcode || null,
      productName: it.productName,
      unitOfMeasure: it.unitOfMeasure || 'UND',
      departmentName: it.departmentName || null,
      aisle: it.aisle || null,
      shelf: it.shelf || null,
      compartment: it.compartment || null,
      systemStock: Number(it.systemStock || 0),
      countedStock: it.countedStock !== null && it.countedStock !== undefined ? Number(it.countedStock) : null,
      difference: it.difference !== null && it.difference !== undefined ? Number(it.difference) : null,
      unitCost: Number(it.unitCost || 0),
      costImpact: Number(it.costImpact || 0),
      status: it.status,
      notes: it.notes || null,
      countedAt: it.countedAt || null,
      countedBy: it.countedBy || null,
      countedByName: it.countedByName || null,
    }));

    return count;
  }

  /**
   * Crear nueva sesión de conteo físico para un depósito
   */
  static async createInventoryCount(
    companyId: string,
    userId: string,
    data: CreateInventoryCountInput
  ): Promise<InventoryCount> {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Generar número consecutivo CNT-YYYYMM-XXXX
      const date = new Date();
      const prefix = `CNT-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
      const [countResult]: any = await conn.query(
        `SELECT COUNT(id) as count FROM inventory_counts WHERE company_id = ? AND count_number LIKE CONCAT(?, '%')`,
        [companyId, prefix]
      );
      const nextNum = (countResult[0]?.count || 0) + 1;
      const countNumber = `${prefix}-${nextNum.toString().padStart(4, '0')}`;
      const countId = crypto.randomUUID();

      // Determinar productos a incluir en el conteo
      let productsToCount: Array<{
        productId: string;
        systemStock: number;
        unitCost: number;
        notes?: string | null;
        countedStock?: number | null;
      }> = [];

      if (data.items && data.items.length > 0) {
        // Ítems especificados manualmente
        for (const it of data.items) {
          const [costRows]: any = await conn.query(
            `SELECT cost_price FROM products WHERE id = ?`,
            [it.productId]
          );
          const unitCost = Number(costRows[0]?.cost_price || 0);
          productsToCount.push({
            productId: it.productId,
            systemStock: it.systemStock,
            unitCost,
            notes: it.notes || null,
            countedStock: it.countedStock ?? null,
          });
        }
      } else {
        // Cargar todos los productos activos de la empresa aplicando los filtros seleccionados
        let prodSql = `
          SELECT p.id, COALESCE(p.cost_price, 0) as cost_price, COALESCE(ps.current_stock, 0) as current_stock
          FROM products p
          LEFT JOIN product_stocks ps ON p.id = ps.product_id AND ps.warehouse_id = ?
          WHERE p.company_id = ? AND p.is_active = 1 AND p.tracks_inventory = 1
        `;
        const prodParams: any[] = [data.warehouseId, companyId];

        if (data.departmentId) {
          prodSql += ' AND p.department_id = ?';
          prodParams.push(data.departmentId);
        }
        if (data.groupId) {
          prodSql += ' AND p.group_id = ?';
          prodParams.push(data.groupId);
        }
        if (data.subgroupId) {
          prodSql += ' AND p.subgroup_id = ?';
          prodParams.push(data.subgroupId);
        }

        const [prodRows]: any = await conn.query(prodSql, prodParams);

        productsToCount = prodRows.map((r: any) => ({
          productId: r.id,
          systemStock: Number(r.current_stock || 0),
          unitCost: Number(r.cost_price || 0),
          notes: null,
          countedStock: null,
        }));
      }

      let totalProducts = productsToCount.length;
      let totalCounted = 0;
      let totalMatched = 0;
      let totalDiscrepancies = 0;
      let totalSurplusCost = 0;
      let totalShortageCost = 0;

      // Insertar cabecera de conteo
      await conn.query(
        `INSERT INTO inventory_counts (
          id, company_id, branch_id, warehouse_id, count_number, title,
          status, count_type, department_id, group_id, subgroup_id, blind_count,
          total_products, total_counted, total_matched, total_discrepancies,
          total_surplus_cost, total_shortage_cost, net_cost_impact,
          created_by, notes, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
        [
          countId,
          companyId,
          data.branchId,
          data.warehouseId,
          countNumber,
          data.title,
          'IN_PROGRESS',
          data.countType || 'GENERAL',
          data.departmentId || null,
          data.groupId || null,
          data.subgroupId || null,
          data.blindCount ? 1 : 0,
          totalProducts,
          totalCounted,
          totalMatched,
          totalDiscrepancies,
          totalSurplusCost,
          totalShortageCost,
          totalSurplusCost - totalShortageCost,
          userId,
          data.notes || null,
        ]
      );

      // Insertar renglones de conteo
      for (const item of productsToCount) {
        const itemId = crypto.randomUUID();
        let status = 'PENDING';
        let difference: number | null = null;
        let costImpact = 0;

        if (item.countedStock !== null && item.countedStock !== undefined) {
          totalCounted++;
          difference = Number((item.countedStock - item.systemStock).toFixed(4));
          costImpact = Number((difference * item.unitCost).toFixed(2));

          if (Math.abs(difference) < 0.0001) {
            status = 'MATCH';
            totalMatched++;
          } else if (difference > 0) {
            status = 'SURPLUS';
            totalDiscrepancies++;
            totalSurplusCost += costImpact;
          } else {
            status = 'SHORTAGE';
            totalDiscrepancies++;
            totalShortageCost += Math.abs(costImpact);
          }
        }

        await conn.query(
          `INSERT INTO inventory_count_items (
            id, count_id, product_id, system_stock, counted_stock, difference,
            unit_cost, cost_impact, status, notes, counted_at, counted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            countId,
            item.productId,
            item.systemStock,
            item.countedStock ?? null,
            difference,
            item.unitCost,
            costImpact,
            status,
            item.notes || null,
            item.countedStock !== null ? new Date() : null,
            item.countedStock !== null ? userId : null,
          ]
        );
      }

      // Actualizar métricas si hubo ítems iniciales contados
      if (totalCounted > 0) {
        await conn.query(
          `UPDATE inventory_counts SET
            total_counted = ?,
            total_matched = ?,
            total_discrepancies = ?,
            total_surplus_cost = ?,
            total_shortage_cost = ?,
            net_cost_impact = ?
           WHERE id = ?`,
          [
            totalCounted,
            totalMatched,
            totalDiscrepancies,
            totalSurplusCost,
            totalShortageCost,
            totalSurplusCost - totalShortageCost,
            countId,
          ]
        );
      }

      await conn.commit();

      const created = await this.getInventoryCountById(companyId, countId);
      if (!created) {
        throw new Error('No se pudo recuperar la sesión de conteo creada');
      }
      return created;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Actualizar por lotes los ítems contados en una sesión activa
   */
  static async batchUpdateCountItems(
    companyId: string,
    countId: string,
    userId: string,
    items: Array<{ productId: string; countedStock: number; notes?: string | null }>
  ): Promise<InventoryCount> {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [countRows]: any = await conn.query(
        `SELECT id, warehouse_id, status FROM inventory_counts WHERE id = ? AND company_id = ?`,
        [countId, companyId]
      );
      if (!countRows.length) {
        throw new Error('Sesión de conteo no encontrada');
      }
      if (countRows[0].status === 'APPLIED') {
        throw new Error('Esta sesión de conteo ya fue conciliada y aplicada al inventario.');
      }

      for (const item of items) {
        // Obtener stock del sistema y costo registrado en el renglón
        const [itemRows]: any = await conn.query(
          `SELECT id, system_stock, unit_cost FROM inventory_count_items WHERE count_id = ? AND product_id = ?`,
          [countId, item.productId]
        );

        if (itemRows.length > 0) {
          const systemStock = Number(itemRows[0].system_stock || 0);
          const unitCost = Number(itemRows[0].unit_cost || 0);
          const countedStock = Number(item.countedStock);
          const difference = Number((countedStock - systemStock).toFixed(4));
          const costImpact = Number((difference * unitCost).toFixed(2));

          let status = 'MATCH';
          if (Math.abs(difference) < 0.0001) {
            status = 'MATCH';
          } else if (difference > 0) {
            status = 'SURPLUS';
          } else {
            status = 'SHORTAGE';
          }

          await conn.query(
            `UPDATE inventory_count_items SET
              counted_stock = ?,
              difference = ?,
              cost_impact = ?,
              status = ?,
              notes = COALESCE(?, notes),
              counted_at = CURRENT_TIMESTAMP(),
              counted_by = ?
             WHERE id = ?`,
            [countedStock, difference, costImpact, status, item.notes || null, userId, itemRows[0].id]
          );
        } else {
          // Si el producto no estaba en la sesión de conteo, incorporarlo
          const [prodRows]: any = await conn.query(
            `SELECT p.cost_price, COALESCE(ps.current_stock, 0) as current_stock
             FROM products p
             LEFT JOIN product_stocks ps ON p.id = ps.product_id AND ps.warehouse_id = ?
             WHERE p.id = ?`,
            [countRows[0].warehouse_id, item.productId]
          );

          if (prodRows.length > 0) {
            const systemStock = Number(prodRows[0].current_stock || 0);
            const unitCost = Number(prodRows[0].cost_price || 0);
            const countedStock = Number(item.countedStock);
            const difference = Number((countedStock - systemStock).toFixed(4));
            const costImpact = Number((difference * unitCost).toFixed(2));

            let status = 'MATCH';
            if (Math.abs(difference) < 0.0001) {
              status = 'MATCH';
            } else if (difference > 0) {
              status = 'SURPLUS';
            } else {
              status = 'SHORTAGE';
            }

            await conn.query(
              `INSERT INTO inventory_count_items (
                id, count_id, product_id, system_stock, counted_stock, difference,
                unit_cost, cost_impact, status, notes, counted_at, counted_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), ?)`,
              [
                crypto.randomUUID(),
                countId,
                item.productId,
                systemStock,
                countedStock,
                difference,
                unitCost,
                costImpact,
                status,
                item.notes || null,
                userId,
              ]
            );
          }
        }
      }

      // Recalcular métricas de la cabecera
      const [stats]: any = await conn.query(
        `SELECT 
          COUNT(id) as totalProducts,
          SUM(CASE WHEN counted_stock IS NOT NULL THEN 1 ELSE 0 END) as totalCounted,
          SUM(CASE WHEN status = 'MATCH' THEN 1 ELSE 0 END) as totalMatched,
          SUM(CASE WHEN status IN ('SURPLUS', 'SHORTAGE') THEN 1 ELSE 0 END) as totalDiscrepancies,
          SUM(CASE WHEN status = 'SURPLUS' THEN cost_impact ELSE 0 END) as totalSurplusCost,
          SUM(CASE WHEN status = 'SHORTAGE' THEN ABS(cost_impact) ELSE 0 END) as totalShortageCost
         FROM inventory_count_items
         WHERE count_id = ?`,
        [countId]
      );

      const totalProducts = Number(stats[0]?.totalProducts || 0);
      const totalCounted = Number(stats[0]?.totalCounted || 0);
      const totalMatched = Number(stats[0]?.totalMatched || 0);
      const totalDiscrepancies = Number(stats[0]?.totalDiscrepancies || 0);
      const totalSurplusCost = Number(stats[0]?.totalSurplusCost || 0);
      const totalShortageCost = Number(stats[0]?.totalShortageCost || 0);
      const netCostImpact = Number((totalSurplusCost - totalShortageCost).toFixed(2));

      await conn.query(
        `UPDATE inventory_counts SET
          total_products = ?,
          total_counted = ?,
          total_matched = ?,
          total_discrepancies = ?,
          total_surplus_cost = ?,
          total_shortage_cost = ?,
          net_cost_impact = ?,
          status = CASE WHEN total_counted >= total_products THEN 'COMPLETED' ELSE 'IN_PROGRESS' END
         WHERE id = ?`,
        [
          totalProducts,
          totalCounted,
          totalMatched,
          totalDiscrepancies,
          totalSurplusCost,
          totalShortageCost,
          netCostImpact,
          countId,
        ]
      );

      await conn.commit();

      const updated = await this.getInventoryCountById(companyId, countId);
      if (!updated) {
        throw new Error('Error al recargar conteo de inventario');
      }
      return updated;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Escaneo rápido por código de barras o SKU (compatible con pistolas lectoras)
   */
  static async scanBarcode(
    companyId: string,
    countId: string,
    userId: string,
    barcodeOrSku: string,
    incrementBy: number = 1,
    setExactQuantity?: number
  ): Promise<{ count: InventoryCount; scannedItem: InventoryCountItem; action: 'INCREMENTED' | 'SET' | 'ADDED' }> {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [countRows]: any = await conn.query(
        `SELECT id, warehouse_id, status FROM inventory_counts WHERE id = ? AND company_id = ?`,
        [countId, companyId]
      );
      if (!countRows.length) {
        throw new Error('Sesión de conteo no encontrada');
      }
      if (countRows[0].status === 'APPLIED') {
        throw new Error('Esta sesión de conteo ya está aplicada');
      }

      // Buscar producto por barcode o SKU
      const cleanCode = barcodeOrSku.trim();
      const [prodRows]: any = await conn.query(
        `SELECT id, sku, barcode, name, cost_price FROM products WHERE company_id = ? AND (barcode = ? OR sku = ?) LIMIT 1`,
        [companyId, cleanCode, cleanCode]
      );

      if (!prodRows.length) {
        throw new Error(`No se encontró ningún producto con código de barras o SKU: "${cleanCode}"`);
      }

      const product = prodRows[0];

      // Verificar si ya existe en la sesión de conteo
      const [itemRows]: any = await conn.query(
        `SELECT id, system_stock, counted_stock, unit_cost FROM inventory_count_items WHERE count_id = ? AND product_id = ?`,
        [countId, product.id]
      );

      let action: 'INCREMENTED' | 'SET' | 'ADDED' = 'INCREMENTED';
      let countedStock: number;
      let systemStock: number;
      let unitCost: number;

      if (itemRows.length > 0) {
        const currentCounted = itemRows[0].counted_stock !== null ? Number(itemRows[0].counted_stock) : 0;
        systemStock = Number(itemRows[0].system_stock || 0);
        unitCost = Number(itemRows[0].unit_cost || 0);

        if (setExactQuantity !== undefined && setExactQuantity !== null) {
          countedStock = setExactQuantity;
          action = 'SET';
        } else {
          countedStock = currentCounted + (incrementBy || 1);
          action = 'INCREMENTED';
        }

        const difference = Number((countedStock - systemStock).toFixed(4));
        const costImpact = Number((difference * unitCost).toFixed(2));
        const status = Math.abs(difference) < 0.0001 ? 'MATCH' : difference > 0 ? 'SURPLUS' : 'SHORTAGE';

        await conn.query(
          `UPDATE inventory_count_items SET
            counted_stock = ?,
            difference = ?,
            cost_impact = ?,
            status = ?,
            counted_at = CURRENT_TIMESTAMP(),
            counted_by = ?
           WHERE id = ?`,
          [countedStock, difference, costImpact, status, userId, itemRows[0].id]
        );
      } else {
        // Agregar a la sesión
        action = 'ADDED';
        const [stockRows]: any = await conn.query(
          `SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ?`,
          [product.id, countRows[0].warehouse_id]
        );
        systemStock = Number(stockRows[0]?.current_stock || 0);
        unitCost = Number(product.cost_price || 0);
        countedStock = setExactQuantity !== undefined && setExactQuantity !== null ? setExactQuantity : incrementBy || 1;

        const difference = Number((countedStock - systemStock).toFixed(4));
        const costImpact = Number((difference * unitCost).toFixed(2));
        const status = Math.abs(difference) < 0.0001 ? 'MATCH' : difference > 0 ? 'SURPLUS' : 'SHORTAGE';

        await conn.query(
          `INSERT INTO inventory_count_items (
            id, count_id, product_id, system_stock, counted_stock, difference,
            unit_cost, cost_impact, status, counted_at, counted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), ?)`,
          [
            crypto.randomUUID(),
            countId,
            product.id,
            systemStock,
            countedStock,
            difference,
            unitCost,
            costImpact,
            status,
            userId,
          ]
        );
      }

      // Recalcular métricas
      const [stats]: any = await conn.query(
        `SELECT 
          COUNT(id) as totalProducts,
          SUM(CASE WHEN counted_stock IS NOT NULL THEN 1 ELSE 0 END) as totalCounted,
          SUM(CASE WHEN status = 'MATCH' THEN 1 ELSE 0 END) as totalMatched,
          SUM(CASE WHEN status IN ('SURPLUS', 'SHORTAGE') THEN 1 ELSE 0 END) as totalDiscrepancies,
          SUM(CASE WHEN status = 'SURPLUS' THEN cost_impact ELSE 0 END) as totalSurplusCost,
          SUM(CASE WHEN status = 'SHORTAGE' THEN ABS(cost_impact) ELSE 0 END) as totalShortageCost
         FROM inventory_count_items
         WHERE count_id = ?`,
        [countId]
      );

      const totalProducts = Number(stats[0]?.totalProducts || 0);
      const totalCounted = Number(stats[0]?.totalCounted || 0);
      const totalMatched = Number(stats[0]?.totalMatched || 0);
      const totalDiscrepancies = Number(stats[0]?.totalDiscrepancies || 0);
      const totalSurplusCost = Number(stats[0]?.totalSurplusCost || 0);
      const totalShortageCost = Number(stats[0]?.totalShortageCost || 0);
      const netCostImpact = Number((totalSurplusCost - totalShortageCost).toFixed(2));

      await conn.query(
        `UPDATE inventory_counts SET
          total_products = ?,
          total_counted = ?,
          total_matched = ?,
          total_discrepancies = ?,
          total_surplus_cost = ?,
          total_shortage_cost = ?,
          net_cost_impact = ?
         WHERE id = ?`,
        [
          totalProducts,
          totalCounted,
          totalMatched,
          totalDiscrepancies,
          totalSurplusCost,
          totalShortageCost,
          netCostImpact,
          countId,
        ]
      );

      await conn.commit();

      const fullCount = await this.getInventoryCountById(companyId, countId);
      if (!fullCount) {
        throw new Error('Error al recargar conteo');
      }

      const scannedItem = fullCount.items?.find((it) => it.productId === product.id);
      if (!scannedItem) {
        throw new Error('Error al obtener el ítem escaneado');
      }

      return { count: fullCount, scannedItem, action };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Conciliar la toma física de inventario y generar automáticamente el ajuste contable
   */
  static async reconcileAndApplyAdjustment(
    companyId: string,
    userId: string,
    countId: string,
    input: ReconcileInventoryCountInput
  ): Promise<{ count: InventoryCount; adjustment: any }> {
    const count = await this.getInventoryCountById(companyId, countId);
    if (!count) {
      throw new Error('Sesión de conteo no encontrada');
    }
    if (count.status === 'APPLIED') {
      throw new Error('Esta sesión de conteo ya fue conciliada y aplicada previamente.');
    }

    const itemsWithDifferences = (count.items || []).filter(
      (it) => it.countedStock !== null && it.difference !== null && Math.abs(it.difference) > 0.0001
    );

    if (itemsWithDifferences.length === 0) {
      // Todos conformes sin diferencia
      await query(
        `UPDATE inventory_counts SET status = 'APPLIED', completed_at = CURRENT_TIMESTAMP(), applied_at = CURRENT_TIMESTAMP() WHERE id = ?`,
        [countId]
      );
      const updated = await this.getInventoryCountById(companyId, countId);
      return { count: updated!, adjustment: null };
    }

    // Preparar renglones de ajuste
    const adjustmentItems = itemsWithDifferences.map((it) => {
      const isSurplus = it.difference! > 0;
      return {
        productId: it.productId,
        movementType: isSurplus ? ('ADJUST_IN' as const) : ('ADJUST_OUT' as const),
        quantity: Math.abs(it.difference!),
        unitCost: it.unitCost,
        notes: `Conteo Físico #${count.countNumber}: ${it.notes || (isSurplus ? 'Sobrante detectado' : 'Faltante detectado')}`,
      };
    });

    const adjustmentData = {
      branchId: count.branchId,
      warehouseId: count.warehouseId,
      type: 'PHYSICAL_COUNT' as const,
      reason: input.reason || `Conciliación y ajuste por auditoría de conteo físico #${count.countNumber}`,
      items: adjustmentItems,
    };

    // Crear ajuste de inventario mediante InventoryService (actualiza stock y Kardex en una transacción)
    const adjustmentResult = await InventoryService.createAdjustment(companyId, userId, adjustmentData);

    // Actualizar estado del conteo
    await query(
      `UPDATE inventory_counts SET
        status = 'APPLIED',
        adjustment_id = ?,
        completed_at = CURRENT_TIMESTAMP(),
        applied_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [adjustmentResult.id, countId]
    );

    const updatedCount = await this.getInventoryCountById(companyId, countId);

    return {
      count: updatedCount!,
      adjustment: adjustmentResult,
    };
  }
}
