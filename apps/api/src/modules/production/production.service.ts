import { query, withTransaction } from '../../db';
import {
  WasteReasonInput,
  UpdateWasteReasonInput,
  ProductWasteConfigInput,
  CreateProductionOrderInput,
  RegisterDirectWasteInput,
  calculateWeightedAverageCost,
} from '@ero/shared';
import crypto from 'crypto';
import { AccountingAutoPostingService } from '../accounting/accounting-auto-posting.service';

export class ProductionService {
  // =========================================================================
  // ALMACENES DE LA EMPRESA
  // =========================================================================

  static async getWarehouses(companyId: string) {
    return await query<any>(
      `SELECT w.id, w.code, w.name, w.branch_id as branchId, b.name as branchName
       FROM warehouses w
       INNER JOIN branches b ON w.branch_id = b.id
       WHERE b.company_id = ? AND w.is_active = 1
       ORDER BY b.name ASC, w.name ASC`,
      [companyId]
    );
  }

  // =========================================================================
  // MOTIVOS DE MERMA
  // =========================================================================

  static async getWasteReasons(companyId: string) {
    return await query<any>(
      `SELECT id, code, name, affects_cost as affectsCost, is_active as isActive, created_at as createdAt
       FROM waste_reasons
       WHERE company_id = ?
       ORDER BY name ASC`,
      [companyId]
    );
  }

  static async createWasteReason(companyId: string, input: WasteReasonInput) {
    const id = crypto.randomUUID();
    const code = input.code.trim().toUpperCase();
    const existing = await query<any>(
      `SELECT id FROM waste_reasons WHERE company_id = ? AND code = ?`,
      [companyId, code]
    );
    if (existing.length > 0) {
      throw new Error(`Ya existe un motivo de merma con el código ${code}`);
    }

    await query(
      `INSERT INTO waste_reasons (id, company_id, code, name, affects_cost, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, companyId, code, input.name.trim(), input.affectsCost ? 1 : 0, input.isActive ? 1 : 0]
    );

    return { id, code, name: input.name.trim(), affectsCost: input.affectsCost, isActive: input.isActive };
  }

  static async updateWasteReason(companyId: string, id: string, input: UpdateWasteReasonInput) {
    const rows = await query<any>(
      `SELECT * FROM waste_reasons WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (rows.length === 0) throw new Error('Motivo de merma no encontrado');
    const cur = rows[0];

    const code = input.code !== undefined ? input.code.trim().toUpperCase() : cur.code;
    const name = input.name !== undefined ? input.name.trim() : cur.name;
    const affectsCost = input.affectsCost !== undefined ? (input.affectsCost ? 1 : 0) : cur.affects_cost;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : cur.is_active;

    await query(
      `UPDATE waste_reasons SET code = ?, name = ?, affects_cost = ?, is_active = ? WHERE id = ? AND company_id = ?`,
      [code, name, affectsCost, isActive, id, companyId]
    );

    return { id, code, name, affectsCost: Boolean(affectsCost), isActive: Boolean(isActive) };
  }

  // =========================================================================
  // CONFIGURACIÓN DE MERMA Y PRODUCTOS PARA DESPOSTE
  // =========================================================================

  static async getProductsForProduction(companyId: string, warehouseId?: string) {
    const wh = warehouseId && warehouseId.trim() !== '' ? warehouseId.trim() : null;
    const rows = await query<any>(
      `SELECT p.id, p.sku, p.name, p.product_type as productType, p.unit_of_measure as unitOfMeasure,
              p.cost_price as costPrice, p.base_price as basePrice,
              p.allows_waste as allowsWaste, p.is_butchery_base as isButcheryBase,
              p.is_butchery_yield as isButcheryYield, p.expected_waste_pct as expectedWastePct,
              COALESCE(SUM(ps.current_stock), 0) as currentStock
       FROM products p
       LEFT JOIN product_stocks ps ON p.id = ps.product_id AND (? IS NULL OR ps.warehouse_id = ?)
       WHERE p.company_id = ? AND p.is_active = 1 AND p.tracks_inventory = 1
       GROUP BY p.id, p.sku, p.name, p.product_type, p.unit_of_measure, p.cost_price, p.base_price,
                p.allows_waste, p.is_butchery_base, p.is_butchery_yield, p.expected_waste_pct
       ORDER BY p.name ASC`,
      [wh, wh, companyId]
    );

    return rows.map((r: any) => ({
      ...r,
      costPrice: Number(r.costPrice || 0),
      basePrice: Number(r.basePrice || 0),
      expectedWastePct: Number(r.expectedWastePct || 0),
      currentStock: Number(r.currentStock || 0),
      allowsWaste: Boolean(r.allowsWaste),
      isButcheryBase: Boolean(r.isButcheryBase),
      isButcheryYield: Boolean(r.isButcheryYield),
    }));
  }

  static async updateProductWasteConfig(companyId: string, productId: string, input: ProductWasteConfigInput) {
    const rows = await query<any>(
      `SELECT id FROM products WHERE id = ? AND company_id = ?`,
      [productId, companyId]
    );
    if (rows.length === 0) throw new Error('Producto no encontrado');

    await query(
      `UPDATE products
       SET allows_waste = ?, is_butchery_base = ?, is_butchery_yield = ?, expected_waste_pct = ?
       WHERE id = ? AND company_id = ?`,
      [
        input.allowsWaste ? 1 : 0,
        input.isButcheryBase ? 1 : 0,
        input.isButcheryYield ? 1 : 0,
        Number(input.expectedWastePct || 0),
        productId,
        companyId,
      ]
    );

    return { productId, ...input };
  }

  // =========================================================================
  // ÓRDENES DE PRODUCCIÓN / DESPOSTE
  // =========================================================================

  static async listProductionOrders(
    companyId: string,
    filters: { status?: string; processType?: string; warehouseId?: string; search?: string } = {}
  ) {
    const params: any[] = [companyId];
    let where = `WHERE po.company_id = ?`;

    if (filters.status) {
      where += ` AND po.status = ?`;
      params.push(filters.status);
    }
    if (filters.processType) {
      where += ` AND po.process_type = ?`;
      params.push(filters.processType);
    }
    if (filters.warehouseId) {
      where += ` AND po.warehouse_id = ?`;
      params.push(filters.warehouseId);
    }
    if (filters.search) {
      where += ` AND (po.order_number LIKE CONCAT('%', ?, '%') OR sp.name LIKE CONCAT('%', ?, '%') OR sp.sku LIKE CONCAT('%', ?, '%'))`;
      params.push(filters.search, filters.search, filters.search);
    }

    const orders = await query<any>(
      `SELECT po.id, po.order_number as orderNumber, po.process_type as processType,
              po.parent_order_id as parentOrderId, po.warehouse_id as warehouseId,
              w.name as warehouseName, po.branch_id as branchId, b.name as branchName,
              po.source_product_id as sourceProductId, sp.sku as sourceProductSku,
              sp.name as sourceProductName, sp.unit_of_measure as sourceUnit,
              po.source_quantity as sourceQuantity, po.source_unit_cost as sourceUnitCost,
              po.source_total_cost as sourceTotalCost, po.total_output_quantity as totalOutputQuantity,
              po.waste_quantity as wasteQuantity, po.waste_pct as wastePct,
              po.waste_reason_id as wasteReasonId, wr.name as wasteReasonName,
              po.waste_cost as wasteCost, po.cost_allocation_method as costAllocationMethod,
              po.status, po.notes, po.created_at as createdAt, po.completed_at as completedAt,
              u.full_name as createdByName
       FROM production_orders po
       INNER JOIN products sp ON po.source_product_id = sp.id
       INNER JOIN warehouses w ON po.warehouse_id = w.id
       INNER JOIN branches b ON po.branch_id = b.id
       LEFT JOIN waste_reasons wr ON po.waste_reason_id = wr.id
       LEFT JOIN users u ON po.created_by = u.id
       ${where}
       ORDER BY po.created_at DESC
       LIMIT 100`,
      params
    );

    if (orders.length === 0) return [];

    const orderIds = orders.map((o: any) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const outputs = await query<any>(
      `SELECT poo.id, poo.order_id as orderId, poo.product_id as productId,
              p.sku as productSku, p.name as productName, p.unit_of_measure as unitOfMeasure,
              poo.output_type as outputType, poo.quantity, poo.yield_pct as yieldPct,
              poo.allocated_unit_cost as allocatedUnitCost, poo.allocated_total_cost as allocatedTotalCost,
              poo.notes
       FROM production_order_outputs poo
       INNER JOIN products p ON poo.product_id = p.id
       WHERE poo.order_id IN (${placeholders})`,
      orderIds
    );

    const outputsByOrder = new Map<string, any[]>();
    for (const out of outputs) {
      const list = outputsByOrder.get(out.orderId) || [];
      list.push({
        ...out,
        quantity: Number(out.quantity),
        yieldPct: Number(out.yieldPct),
        allocatedUnitCost: Number(out.allocatedUnitCost),
        allocatedTotalCost: Number(out.allocatedTotalCost),
      });
      outputsByOrder.set(out.orderId, list);
    }

    return orders.map((o: any) => ({
      ...o,
      sourceQuantity: Number(o.sourceQuantity),
      sourceUnitCost: Number(o.sourceUnitCost),
      sourceTotalCost: Number(o.sourceTotalCost),
      totalOutputQuantity: Number(o.totalOutputQuantity),
      wasteQuantity: Number(o.wasteQuantity),
      wastePct: Number(o.wastePct),
      wasteCost: Number(o.wasteCost),
      outputs: outputsByOrder.get(o.id) || [],
    }));
  }

  static async createProductionOrder(
    companyId: string,
    userId: string,
    input: CreateProductionOrderInput
  ) {
    // Obtener branch del almacén
    const whRows = await query<any>(
      `SELECT w.id, w.branch_id
       FROM warehouses w
       INNER JOIN branches b ON w.branch_id = b.id
       WHERE w.id = ? AND b.company_id = ?`,
      [input.warehouseId, companyId]
    );
    if (whRows.length === 0) throw new Error('Almacén no válido para la empresa activa');
    const branchId = input.branchId || whRows[0].branch_id;

    // Validar producto origen
    const srcRows = await query<any>(
      `SELECT id, name, cost_price, allows_waste FROM products WHERE id = ? AND company_id = ?`,
      [input.sourceProductId, companyId]
    );
    if (srcRows.length === 0) throw new Error('Producto base no encontrado');
    const srcProd = srcRows[0];

    const totalOutput = input.outputs.reduce((acc, item) => acc + Number(item.quantity), 0);
    const wasteQty = Number(input.wasteQuantity || 0);
    const srcQty = Number(input.sourceQuantity);

    if (totalOutput + wasteQty > srcQty + 0.0001) {
      throw new Error(
        `La suma de derivados (${totalOutput.toFixed(2)}) más la merma (${wasteQty.toFixed(2)}) no puede superar la cantidad consumida del producto base (${srcQty.toFixed(2)})`
      );
    }

    if (wasteQty > 0 && !srcProd.allows_waste) {
      throw new Error(
        `El producto "${srcProd.name}" está configurado para NO admitir merma. Active "Admite Merma" en su configuración o ajuste los pesos de salida para que coincidan con ${srcQty.toFixed(2)}.`
      );
    }

    if (wasteQty > 0 && !input.wasteReasonId) {
      throw new Error('Debe seleccionar un motivo de merma al registrar desperdicio.');
    }

    for (const out of input.outputs) {
      if (out.productId === input.sourceProductId) {
        throw new Error('El producto derivado no puede ser igual al producto base consumido.');
      }
    }

    const orderId = crypto.randomUUID();
    const countRows = await query<any>(
      `SELECT COUNT(*) as cnt FROM production_orders WHERE company_id = ?`,
      [companyId]
    );
    const nextNum = Number(countRows[0]?.cnt || 0) + 1;
    const orderNumber = `PROD-${String(nextNum).padStart(5, '0')}`;

    const srcUnitCost = Number(srcProd.cost_price || 0);
    const srcTotalCost = Number((srcQty * srcUnitCost).toFixed(4));
    const wastePct = srcQty > 0 ? Number(((wasteQty / srcQty) * 100).toFixed(4)) : 0;
    const wasteCost = Number((wasteQty * srcUnitCost).toFixed(4));

    return await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO production_orders (
          id, company_id, branch_id, warehouse_id, order_number, process_type, parent_order_id,
          source_product_id, source_quantity, source_unit_cost, source_total_cost,
          total_output_quantity, waste_quantity, waste_pct, waste_reason_id, waste_cost,
          cost_allocation_method, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
        [
          orderId,
          companyId,
          branchId,
          input.warehouseId,
          orderNumber,
          input.processType,
          input.parentOrderId || null,
          input.sourceProductId,
          srcQty,
          srcUnitCost,
          srcTotalCost,
          totalOutput,
          wasteQty,
          wastePct,
          input.wasteReasonId || null,
          wasteCost,
          input.costAllocationMethod,
          input.notes || null,
          userId,
        ]
      );

      for (const out of input.outputs) {
        const yieldPct = srcQty > 0 ? Number(((Number(out.quantity) / srcQty) * 100).toFixed(4)) : 0;
        await conn.query(
          `INSERT INTO production_order_outputs (
            id, order_id, product_id, output_type, quantity, yield_pct, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            orderId,
            out.productId,
            out.outputType,
            Number(out.quantity),
            yieldPct,
            out.notes || null,
          ]
        );
      }

      if (input.processImmediately) {
        await this.executeOrderInTransaction(conn, companyId, userId, orderId);
      }

      return { id: orderId, orderNumber, status: input.processImmediately ? 'COMPLETED' : 'DRAFT' };
    });
  }

  static async processProductionOrder(companyId: string, userId: string, orderId: string) {
    return await withTransaction(async (conn) => {
      await this.executeOrderInTransaction(conn, companyId, userId, orderId);
      return { id: orderId, status: 'COMPLETED' };
    });
  }

  private static async executeOrderInTransaction(
    conn: any,
    companyId: string,
    userId: string,
    orderId: string
  ) {
    const [orderRows]: any = await conn.query(
      `SELECT po.*, sp.name as source_name, sp.cost_price as current_src_cost, sp.allows_waste
       FROM production_orders po
       INNER JOIN products sp ON po.source_product_id = sp.id
       WHERE po.id = ? AND po.company_id = ? FOR UPDATE`,
      [orderId, companyId]
    );
    if (orderRows.length === 0) throw new Error('Orden de producción no encontrada');
    const order = orderRows[0];

    if (order.status !== 'DRAFT') {
      throw new Error(`La orden ${order.order_number} ya fue procesada o anulada (estado actual: ${order.status})`);
    }

    const srcQty = Number(order.source_quantity);
    const wasteQty = Number(order.waste_quantity);
    const totalOutput = Number(order.total_output_quantity);

    if (wasteQty > 0 && !order.allows_waste) {
      throw new Error(`El producto "${order.source_name}" no admite merma.`);
    }

    // 1. Verificar stock disponible del producto base en el almacén
    const [stockRows]: any = await conn.query(
      `SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`,
      [order.source_product_id, order.warehouse_id]
    );
    const prevSrcStock = Number(stockRows[0]?.current_stock || 0);
    if (prevSrcStock < srcQty) {
      throw new Error(
        `Stock insuficiente para "${order.source_name}" en el almacén seleccionado. Disponible: ${prevSrcStock.toFixed(2)}, Requerido: ${srcQty.toFixed(2)}`
      );
    }

    const srcUnitCost = Number(order.current_src_cost || order.source_unit_cost || 0);
    const srcTotalCost = Number((srcQty * srcUnitCost).toFixed(4));
    const wasteCost = Number((wasteQty * srcUnitCost).toFixed(4));
    const newSrcStock = Number((prevSrcStock - srcQty).toFixed(4));

    // 2. Descontar inventario del producto base / pieza intermedia
    await conn.query(
      `UPDATE product_stocks SET current_stock = ?, last_movement_at = CURRENT_TIMESTAMP()
       WHERE product_id = ? AND warehouse_id = ?`,
      [newSrcStock, order.source_product_id, order.warehouse_id]
    );

    await conn.query(
      `INSERT INTO inventory_movements (
        id, branch_id, warehouse_id, product_id, user_id, movement_type,
        quantity, unit_cost, total_cost, previous_stock, new_stock,
        reference_document, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, 'OUT', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
      [
        crypto.randomUUID(),
        order.branch_id,
        order.warehouse_id,
        order.source_product_id,
        userId,
        srcQty,
        srcUnitCost,
        srcTotalCost,
        prevSrcStock,
        newSrcStock,
        order.order_number,
        `Consumo por Desposte / Producción (${order.process_type})`,
      ]
    );

    // 3. Ingresar productos derivados y prorratear costos
    const [outputs]: any = await conn.query(
      `SELECT poo.*, p.cost_price as cur_cost
       FROM production_order_outputs poo
       INNER JOIN products p ON poo.product_id = p.id
       WHERE poo.order_id = ?`,
      [orderId]
    );

    for (const out of outputs) {
      const outQty = Number(out.quantity);
      let allocatedTotalCost = 0;
      let allocatedUnitCost = 0;

      if (order.cost_allocation_method === 'BY_WEIGHT' && totalOutput > 0) {
        allocatedTotalCost = Number((srcTotalCost * (outQty / totalOutput)).toFixed(4));
        allocatedUnitCost = Number((allocatedTotalCost / outQty).toFixed(4));
      } else {
        allocatedUnitCost = srcUnitCost;
        allocatedTotalCost = Number((outQty * allocatedUnitCost).toFixed(4));
      }

      // Stock total actual del producto derivado en la empresa para recalcular costo promedio ponderado
      const [globalStockRows]: any = await conn.query(
        `SELECT COALESCE(SUM(ps.current_stock), 0) as total_stock
         FROM product_stocks ps
         INNER JOIN warehouses w ON ps.warehouse_id = w.id
         INNER JOIN branches b ON w.branch_id = b.id
         WHERE ps.product_id = ? AND b.company_id = ?`,
        [out.product_id, companyId]
      );
      const totalCompanyStock = Number(globalStockRows[0]?.total_stock || 0);
      const nextWeightedCost = calculateWeightedAverageCost(
        totalCompanyStock,
        Number(out.cur_cost || 0),
        outQty,
        allocatedUnitCost
      );

      // Stock en el almacén específico
      const [outWhStockRows]: any = await conn.query(
        `SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`,
        [out.product_id, order.warehouse_id]
      );
      const prevOutStock = Number(outWhStockRows[0]?.current_stock || 0);
      const newOutStock = Number((prevOutStock + outQty).toFixed(4));

      await conn.query(
        `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP())
         ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = CURRENT_TIMESTAMP()`,
        [out.product_id, order.warehouse_id, newOutStock]
      );

      if (nextWeightedCost > 0) {
        await conn.query(
          `UPDATE products SET cost_price = ? WHERE id = ? AND company_id = ?`,
          [nextWeightedCost, out.product_id, companyId]
        );
      }

      await conn.query(
        `UPDATE production_order_outputs
         SET allocated_unit_cost = ?, allocated_total_cost = ?
         WHERE id = ?`,
        [allocatedUnitCost, allocatedTotalCost, out.id]
      );

      await conn.query(
        `INSERT INTO inventory_movements (
          id, branch_id, warehouse_id, product_id, user_id, movement_type,
          quantity, unit_cost, total_cost, previous_stock, new_stock,
          reference_document, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
        [
          crypto.randomUUID(),
          order.branch_id,
          order.warehouse_id,
          out.product_id,
          userId,
          outQty,
          allocatedUnitCost,
          allocatedTotalCost,
          prevOutStock,
          newOutStock,
          order.order_number,
          `Ingreso de ${out.output_type === 'INTERMEDIATE' ? 'Pieza Intermedia' : 'Corte Final'} por Desposte`,
        ]
      );
    }

    // 4. Registrar bitácora de merma si hay desperdicio
    if (wasteQty > 0 && order.waste_reason_id) {
      const wasteLogId = crypto.randomUUID();
      const [wrRows]: any = await conn.query(
        `SELECT name FROM waste_reasons WHERE id = ?`,
        [order.waste_reason_id]
      );
      const reasonName = wrRows[0]?.name || 'Merma de proceso';

      await conn.query(
        `INSERT INTO production_waste_logs (
          id, company_id, branch_id, warehouse_id, production_order_id,
          product_id, waste_reason_id, quantity, unit_cost, total_cost, notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          wasteLogId,
          companyId,
          order.branch_id,
          order.warehouse_id,
          orderId,
          order.source_product_id,
          order.waste_reason_id,
          wasteQty,
          srcUnitCost,
          wasteCost,
          order.notes || `Merma generada en orden ${order.order_number}`,
          userId,
        ]
      );

      // Si el costeo es EQUAL_UNIT, los cortes no absorben la merma y el costo de merma sale del inventario a gastos/costo
      if (order.cost_allocation_method === 'EQUAL_UNIT' && wasteCost > 0) {
        await AccountingAutoPostingService.postInventoryWaste(conn, {
          companyId,
          branchId: order.branch_id,
          userId,
          wasteLogId,
          productName: order.source_name,
          reasonName,
          totalCostUsd: wasteCost,
          referenceDoc: order.order_number,
        });
      }
    }

    // 5. Marcar orden completada
    await conn.query(
      `UPDATE production_orders
       SET status = 'COMPLETED', source_unit_cost = ?, source_total_cost = ?, waste_cost = ?,
           completed_by = ?, completed_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [srcUnitCost, srcTotalCost, wasteCost, userId, orderId]
    );
  }

  static async cancelProductionOrder(companyId: string, orderId: string) {
    const rows = await query<any>(
      `SELECT id, status FROM production_orders WHERE id = ? AND company_id = ?`,
      [orderId, companyId]
    );
    if (rows.length === 0) throw new Error('Orden no encontrada');
    if (rows[0].status !== 'DRAFT') {
      throw new Error('Solo pueden anularse órdenes en estado Borrador (DRAFT)');
    }

    await query(
      `UPDATE production_orders SET status = 'CANCELLED' WHERE id = ? AND company_id = ?`,
      [orderId, companyId]
    );
    return { id: orderId, status: 'CANCELLED' };
  }

  // =========================================================================
  // CONTROL Y REGISTRO DIRECTO DE MERMA
  // =========================================================================

  static async listWasteLogs(
    companyId: string,
    filters: { warehouseId?: string; wasteReasonId?: string; productId?: string } = {}
  ) {
    const params: any[] = [companyId];
    let where = `WHERE pwl.company_id = ?`;

    if (filters.warehouseId) {
      where += ` AND pwl.warehouse_id = ?`;
      params.push(filters.warehouseId);
    }
    if (filters.wasteReasonId) {
      where += ` AND pwl.waste_reason_id = ?`;
      params.push(filters.wasteReasonId);
    }
    if (filters.productId) {
      where += ` AND pwl.product_id = ?`;
      params.push(filters.productId);
    }

    const rows = await query<any>(
      `SELECT pwl.id, pwl.production_order_id as productionOrderId, po.order_number as orderNumber,
              pwl.warehouse_id as warehouseId, w.name as warehouseName,
              pwl.product_id as productId, p.sku as productSku, p.name as productName, p.unit_of_measure as unitOfMeasure,
              pwl.waste_reason_id as wasteReasonId, wr.code as reasonCode, wr.name as reasonName,
              pwl.quantity, pwl.unit_cost as unitCost, pwl.total_cost as totalCost,
              pwl.notes, u.full_name as userName, pwl.created_at as createdAt
       FROM production_waste_logs pwl
       INNER JOIN products p ON pwl.product_id = p.id
       INNER JOIN warehouses w ON pwl.warehouse_id = w.id
       INNER JOIN waste_reasons wr ON pwl.waste_reason_id = wr.id
       LEFT JOIN production_orders po ON pwl.production_order_id = po.id
       LEFT JOIN users u ON pwl.user_id = u.id
       ${where}
       ORDER BY pwl.created_at DESC
       LIMIT 200`,
      params
    );

    return rows.map((r: any) => ({
      ...r,
      quantity: Number(r.quantity),
      unitCost: Number(r.unitCost),
      totalCost: Number(r.totalCost),
    }));
  }

  static async registerDirectWaste(companyId: string, userId: string, input: RegisterDirectWasteInput) {
    const whRows = await query<any>(
      `SELECT w.id, w.branch_id
       FROM warehouses w
       INNER JOIN branches b ON w.branch_id = b.id
       WHERE w.id = ? AND b.company_id = ?`,
      [input.warehouseId, companyId]
    );
    if (whRows.length === 0) throw new Error('Almacén no válido');
    const branchId = whRows[0].branch_id;

    const prodRows = await query<any>(
      `SELECT id, name, cost_price, allows_waste FROM products WHERE id = ? AND company_id = ?`,
      [input.productId, companyId]
    );
    if (prodRows.length === 0) throw new Error('Producto no encontrado');
    const prod = prodRows[0];

    if (!prod.allows_waste) {
      throw new Error(`El producto "${prod.name}" no tiene habilitado el control de merma.`);
    }

    const reasonRows = await query<any>(
      `SELECT id, name FROM waste_reasons WHERE id = ? AND company_id = ? AND is_active = 1`,
      [input.wasteReasonId, companyId]
    );
    if (reasonRows.length === 0) throw new Error('Motivo de merma inválido o inactivo');
    const reason = reasonRows[0];

    return await withTransaction(async (conn) => {
      const [stockRows]: any = await conn.query(
        `SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`,
        [input.productId, input.warehouseId]
      );
      const prevStock = Number(stockRows[0]?.current_stock || 0);
      const qty = Number(input.quantity);

      if (prevStock < qty) {
        throw new Error(`Stock insuficiente para registrar merma. Disponible: ${prevStock.toFixed(2)}`);
      }

      const newStock = Number((prevStock - qty).toFixed(4));
      const unitCost = Number(prod.cost_price || 0);
      const totalCost = Number((qty * unitCost).toFixed(4));
      const logId = crypto.randomUUID();

      await conn.query(
        `UPDATE product_stocks SET current_stock = ?, last_movement_at = CURRENT_TIMESTAMP()
         WHERE product_id = ? AND warehouse_id = ?`,
        [newStock, input.productId, input.warehouseId]
      );

      await conn.query(
        `INSERT INTO inventory_movements (
          id, branch_id, warehouse_id, product_id, user_id, movement_type,
          quantity, unit_cost, total_cost, previous_stock, new_stock,
          reference_document, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, 'ADJUST_OUT', ?, ?, ?, ?, ?, 'MERMA', ?, CURRENT_TIMESTAMP())`,
        [
          crypto.randomUUID(),
          branchId,
          input.warehouseId,
          input.productId,
          userId,
          qty,
          unitCost,
          totalCost,
          prevStock,
          newStock,
          `Merma Directa: ${reason.name}${input.notes ? ` - ${input.notes}` : ''}`,
        ]
      );

      await conn.query(
        `INSERT INTO production_waste_logs (
          id, company_id, branch_id, warehouse_id, production_order_id,
          product_id, waste_reason_id, quantity, unit_cost, total_cost, notes, user_id
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          companyId,
          branchId,
          input.warehouseId,
          input.productId,
          input.wasteReasonId,
          qty,
          unitCost,
          totalCost,
          input.notes || null,
          userId,
        ]
      );

      if (totalCost > 0) {
        await AccountingAutoPostingService.postInventoryWaste(conn, {
          companyId,
          branchId,
          userId,
          wasteLogId: logId,
          productName: prod.name,
          reasonName: reason.name,
          totalCostUsd: totalCost,
          referenceDoc: 'MERMA',
        });
      }

      return { id: logId, newStock, totalCost };
    });
  }
}
