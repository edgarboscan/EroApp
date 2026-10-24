import { query, withTransaction } from '../../db';
import {
  DepartmentInput,
  UpdateDepartmentInput,
  GroupInput,
  UpdateGroupInput,
  SubgroupInput,
  UpdateSubgroupInput,
  ProductInput,
  UpdateProductInput,
  ProductLocationInput,
  WarehouseLocationInput,
  UpdateWarehouseLocationInput,
  BrandInput,
  UpdateBrandInput,
  UnitOfMeasureInput,
  UpdateUnitOfMeasureInput,
  PresentationInput,
  UpdatePresentationInput,
  ProductSkuInput,
  ProductPresentationInput,
  ProductLotInput,
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
      [id, input.companyId, input.code.trim().toUpperCase(), input.name.trim(), input.description || null, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  static async updateDepartment(id: string, input: UpdateDepartmentInput) {
    const rows = await query<any>(`SELECT * FROM departments WHERE id = ?`, [id]);
    if (rows.length === 0) throw new Error('Departamento no encontrado');
    const cur = rows[0];
    const code = input.code !== undefined ? input.code.trim().toUpperCase() : cur.code;
    const name = input.name !== undefined ? input.name.trim() : cur.name;
    const description = input.description !== undefined ? input.description : cur.description;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : cur.is_active;

    await query(
      `UPDATE departments SET code = ?, name = ?, description = ?, is_active = ? WHERE id = ?`,
      [code, name, description, isActive, id]
    );
    return { id, code, name, description, isActive: Boolean(isActive) };
  }

  static async deleteDepartment(id: string) {
    const [groups] = await query<any>(`SELECT COUNT(*) as cnt FROM \`groups\` WHERE department_id = ?`, [id]);
    const [products] = await query<any>(`SELECT COUNT(*) as cnt FROM products WHERE department_id = ?`, [id]);
    const hasChildren = (groups?.cnt || 0) > 0 || (products?.cnt || 0) > 0;

    if (hasChildren) {
      await query(`UPDATE departments SET is_active = 0 WHERE id = ?`, [id]);
      return {
        success: true,
        deleted: false,
        deactivated: true,
        message: 'El departamento posee grupos o productos asociados. Ha sido desactivado lógicamente.',
      };
    } else {
      await query(`DELETE FROM departments WHERE id = ?`, [id]);
      return {
        success: true,
        deleted: true,
        deactivated: false,
        message: 'Departamento eliminado permanentemente.',
      };
    }
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
      [id, input.departmentId, input.code.trim().toUpperCase(), input.name.trim(), input.description || null, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  static async updateGroup(id: string, input: UpdateGroupInput) {
    const rows = await query<any>(`SELECT * FROM \`groups\` WHERE id = ?`, [id]);
    if (rows.length === 0) throw new Error('Grupo no encontrado');
    const cur = rows[0];
    const departmentId = input.departmentId !== undefined ? input.departmentId : cur.department_id;
    const code = input.code !== undefined ? input.code.trim().toUpperCase() : cur.code;
    const name = input.name !== undefined ? input.name.trim() : cur.name;
    const description = input.description !== undefined ? input.description : cur.description;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : cur.is_active;

    await query(
      `UPDATE \`groups\` SET department_id = ?, code = ?, name = ?, description = ?, is_active = ? WHERE id = ?`,
      [departmentId, code, name, description, isActive, id]
    );
    return { id, departmentId, code, name, description, isActive: Boolean(isActive) };
  }

  static async deleteGroup(id: string) {
    const [subgroups] = await query<any>(`SELECT COUNT(*) as cnt FROM subgroups WHERE group_id = ?`, [id]);
    const [products] = await query<any>(`SELECT COUNT(*) as cnt FROM products WHERE group_id = ?`, [id]);
    const hasChildren = (subgroups?.cnt || 0) > 0 || (products?.cnt || 0) > 0;

    if (hasChildren) {
      await query(`UPDATE \`groups\` SET is_active = 0 WHERE id = ?`, [id]);
      return {
        success: true,
        deleted: false,
        deactivated: true,
        message: 'El grupo posee subgrupos o productos asociados. Ha sido desactivado lógicamente.',
      };
    } else {
      await query(`DELETE FROM \`groups\` WHERE id = ?`, [id]);
      return {
        success: true,
        deleted: true,
        deactivated: false,
        message: 'Grupo eliminado permanentemente.',
      };
    }
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
      [id, input.groupId, input.code.trim().toUpperCase(), input.name.trim(), input.description || null, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  static async updateSubgroup(id: string, input: UpdateSubgroupInput) {
    const rows = await query<any>(`SELECT * FROM subgroups WHERE id = ?`, [id]);
    if (rows.length === 0) throw new Error('Subgrupo no encontrado');
    const cur = rows[0];
    const groupId = input.groupId !== undefined ? input.groupId : cur.group_id;
    const code = input.code !== undefined ? input.code.trim().toUpperCase() : cur.code;
    const name = input.name !== undefined ? input.name.trim() : cur.name;
    const description = input.description !== undefined ? input.description : cur.description;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : cur.is_active;

    await query(
      `UPDATE subgroups SET group_id = ?, code = ?, name = ?, description = ?, is_active = ? WHERE id = ?`,
      [groupId, code, name, description, isActive, id]
    );
    return { id, groupId, code, name, description, isActive: Boolean(isActive) };
  }

  static async deleteSubgroup(id: string) {
    const [products] = await query<any>(`SELECT COUNT(*) as cnt FROM products WHERE subgroup_id = ?`, [id]);
    const hasChildren = (products?.cnt || 0) > 0;

    if (hasChildren) {
      await query(`UPDATE subgroups SET is_active = 0 WHERE id = ?`, [id]);
      return {
        success: true,
        deleted: false,
        deactivated: true,
        message: 'El subgrupo posee productos asociados. Ha sido desactivado lógicamente.',
      };
    } else {
      await query(`DELETE FROM subgroups WHERE id = ?`, [id]);
      return {
        success: true,
        deleted: true,
        deactivated: false,
        message: 'Subgrupo eliminado permanentemente.',
      };
    }
  }

  // ==========================================
  // UBICACIÓN FÍSICA (PASILLO, ESTANTE, COMPARTIMIENTO)
  // ==========================================

  static async getWarehouseLocations(companyId: string, warehouseId?: string) {
    const params: any[] = [companyId];
    let whFilter = '';
    if (warehouseId) {
      whFilter = 'AND pl.warehouse_id = ?';
      params.push(warehouseId);
    }

    return await query<any>(
      `SELECT pl.id, pl.warehouse_id as warehouseId, w.name as warehouseName, w.code as warehouseCode,
              b.id as branchId, b.name as branchName,
              pl.product_id as productId, p.sku, p.name as productName,
              pl.aisle, pl.shelf, pl.compartment, pl.notes,
              COALESCE(ps.current_stock, 0) as currentStock
       FROM product_locations pl
       INNER JOIN warehouses w ON pl.warehouse_id = w.id
       INNER JOIN branches b ON w.branch_id = b.id
       LEFT JOIN products p ON pl.product_id = p.id
       LEFT JOIN product_stocks ps ON pl.product_id = ps.product_id AND pl.warehouse_id = ps.warehouse_id
       WHERE b.company_id = ? ${whFilter}
       ORDER BY w.name ASC, pl.aisle ASC, pl.shelf ASC, pl.compartment ASC`,
      params
    );
  }

  static async createWarehouseLocation(companyId: string, input: WarehouseLocationInput) {
    const rows = await query<any>(
      `SELECT w.id FROM warehouses w INNER JOIN branches b ON w.branch_id = b.id WHERE w.id = ? AND b.company_id = ?`,
      [input.warehouseId, companyId]
    );
    if (rows.length === 0) throw new Error('El depósito seleccionado no pertenece a la empresa');

    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO product_locations (id, warehouse_id, product_id, aisle, shelf, compartment, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.warehouseId,
        input.productId || null,
        input.aisle.trim(),
        input.shelf?.trim() || null,
        input.compartment?.trim() || null,
        input.notes?.trim() || null,
      ]
    );

    return { id, ...input };
  }

  static async updateWarehouseLocation(companyId: string, id: string, input: UpdateWarehouseLocationInput) {
    const rows = await query<any>(
      `SELECT pl.* FROM product_locations pl
       INNER JOIN warehouses w ON pl.warehouse_id = w.id
       INNER JOIN branches b ON w.branch_id = b.id
       WHERE pl.id = ? AND b.company_id = ?`,
      [id, companyId]
    );
    if (rows.length === 0) throw new Error('Ubicación no encontrada');
    const cur = rows[0];

    const warehouseId = input.warehouseId !== undefined ? input.warehouseId : cur.warehouse_id;
    const productId = input.productId !== undefined ? (input.productId || null) : cur.product_id;
    const aisle = input.aisle !== undefined ? input.aisle.trim() : cur.aisle;
    const shelf = input.shelf !== undefined ? (input.shelf?.trim() || null) : cur.shelf;
    const compartment = input.compartment !== undefined ? (input.compartment?.trim() || null) : cur.compartment;
    const notes = input.notes !== undefined ? (input.notes?.trim() || null) : cur.notes;

    await query(
      `UPDATE product_locations SET warehouse_id = ?, product_id = ?, aisle = ?, shelf = ?, compartment = ?, notes = ?
       WHERE id = ?`,
      [warehouseId, productId, aisle, shelf, compartment, notes, id]
    );

    return { id, warehouseId, productId, aisle, shelf, compartment, notes };
  }

  static async deleteWarehouseLocation(companyId: string, id: string) {
    const rows = await query<any>(
      `SELECT pl.id FROM product_locations pl
       INNER JOIN warehouses w ON pl.warehouse_id = w.id
       INNER JOIN branches b ON w.branch_id = b.id
       WHERE pl.id = ? AND b.company_id = ?`,
      [id, companyId]
    );
    if (rows.length === 0) throw new Error('Ubicación no encontrada');

    await query(`DELETE FROM product_locations WHERE id = ?`, [id]);
    return { success: true, message: 'Ubicación física eliminada exitosamente' };
  }

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
       LEFT JOIN products p ON pl.product_id = p.id
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
    const rows = await query<any>(
      `SELECT p.id, p.sku, p.barcode, p.name, p.description, p.product_type as productType,
              p.tracks_inventory as tracksInventory,
              p.department_id as departmentId, d.name as departmentName,
              p.group_id as groupId, g.name as groupName,
              p.subgroup_id as subgroupId, sg.name as subgroupName,
              p.brand, p.unit_of_measure as unitOfMeasure,
              p.cost_price as costPrice, p.base_price as basePrice, p.currency,
              p.default_tax_rate_id as defaultTaxRateId, tr.name as taxRateName, COALESCE(tr.rate, 16.0) as taxRate,
              p.tax_inclusive as taxInclusive,
              p.min_stock as minStock, p.max_stock as maxStock, p.is_active as isActive,
              p.has_batches as hasBatches, p.has_serials as hasSerials,
              COALESCE(ps.current_stock, 0) as currentStock,
              pl.aisle, pl.shelf, pl.compartment,
              (SELECT COUNT(*) FROM product_skus WHERE product_id = p.id) as skusCount,
              (SELECT COUNT(*) FROM product_presentations WHERE product_id = p.id) as presentationsCount
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

    const productIds = rows.map((r: any) => r.id);
    const presentationsMap: Record<string, any[]> = {};

    if (productIds.length > 0) {
      const presRows = await query<any>(
        `SELECT product_id, id, presentation_id as presentationId, name, sku, barcode, unit_of_measure as unitOfMeasure,
                multiplier, cost_price as costPrice, base_price as basePrice, currency, is_default as isDefault,
                requires_authorization as requiresAuthorization, is_active as isActive
         FROM product_presentations
         WHERE product_id IN (${productIds.map(() => '?').join(',')}) AND is_active = 1
         ORDER BY is_default DESC, multiplier ASC`,
        productIds
      );

      for (const pres of presRows) {
        if (!presentationsMap[pres.product_id]) {
          presentationsMap[pres.product_id] = [];
        }
        presentationsMap[pres.product_id].push({
          id: pres.id,
          presentationId: pres.presentationId,
          name: pres.name,
          sku: pres.sku,
          barcode: pres.barcode,
          unitOfMeasure: pres.unitOfMeasure,
          multiplier: Number(pres.multiplier || 1),
          costPrice: Number(pres.costPrice || 0),
          basePrice: Number(pres.basePrice || 0),
          currency: pres.currency,
          isDefault: Boolean(pres.isDefault),
          requiresAuthorization: Boolean(pres.requiresAuthorization),
          isActive: Boolean(pres.isActive),
        });
      }
    }

    return rows.map((r: any) => ({
      ...r,
      costPrice: Number(r.costPrice || 0),
      basePrice: Number(r.basePrice || 0),
      minStock: Number(r.minStock || 0),
      maxStock: Number(r.maxStock || 0),
      currentStock: Number(r.currentStock || 0),
      hasBatches: Boolean(r.hasBatches),
      hasSerials: Boolean(r.hasSerials),
      taxInclusive: Boolean(r.taxInclusive),
      isActive: Boolean(r.isActive),
      tracksInventory: Boolean(r.tracksInventory !== 0 && r.tracksInventory !== false),
      presentations: presentationsMap[r.id] || [],
    }));
  }

  static async createProduct(input: ProductInput) {
    return await withTransaction(async (conn) => {
      const id = input.id || crypto.randomUUID();

      const tracksInventoryValue = input.tracksInventory !== undefined
        ? (input.tracksInventory ? 1 : 0)
        : (input.productType === 'service' ? 0 : 1);

      await conn.query(
        `INSERT INTO products (
          id, company_id, sku, barcode, name, description, product_type, tracks_inventory,
          department_id, group_id, subgroup_id, supplier_id, brand, unit_of_measure,
          cost_price, base_price, currency, default_tax_rate_id, tax_inclusive,
          min_stock, max_stock, has_batches, has_serials, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, input.companyId, input.sku.trim().toUpperCase(), input.barcode?.trim() || null, input.name.trim(), input.description || null, input.productType, tracksInventoryValue,
          input.departmentId || null, input.groupId || null, input.subgroupId || null, input.supplierId || null,
          input.brand || null, input.unitOfMeasure, input.costPrice, input.basePrice, input.currency,
          input.defaultTaxRateId || null, input.taxInclusive ? 1 : 0, input.minStock, input.maxStock,
          input.hasBatches ? 1 : 0, input.hasSerials ? 1 : 0, input.isActive ? 1 : 0,
        ]
      );

      // Múltiples SKUs: registrar lista o registrar al menos el SKU primario
      if (input.skus && input.skus.length > 0) {
        for (const s of input.skus) {
          await conn.query(
            `INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id || crypto.randomUUID(),
              id,
              s.sku.trim().toUpperCase(),
              s.barcode?.trim() || null,
              s.description || null,
              s.isPrimary ? 1 : 0,
              s.costPrice !== undefined ? s.costPrice : null,
              s.price !== undefined ? s.price : null,
              s.currency || input.currency || 'USD'
            ]
          );
        }
      } else {
        // Registrar SKU maestro como primario en product_skus
        await conn.query(
          `INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency)
           VALUES (?, ?, ?, ?, 'SKU Principal', 1, ?, ?, ?)`,
          [crypto.randomUUID(), id, input.sku.trim().toUpperCase(), input.barcode?.trim() || null, input.costPrice, input.basePrice, input.currency || 'USD']
        );
      }

      // Presentaciones por producto con diferentes factores y precios
      if (input.presentations && input.presentations.length > 0) {
        for (const p of input.presentations) {
          await conn.query(
            `INSERT INTO product_presentations (id, product_id, presentation_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id || crypto.randomUUID(),
              id,
              p.presentationId || null,
              p.name.trim(),
              p.sku?.trim().toUpperCase() || null,
              p.barcode?.trim() || null,
              p.unitOfMeasure || 'UND',
              p.multiplier || 1,
              p.costPrice || 0,
              p.basePrice || 0,
              p.currency || input.currency || 'USD',
              p.isDefault ? 1 : 0,
              p.requiresAuthorization ? 1 : 0,
              p.isActive !== undefined ? (p.isActive ? 1 : 0) : 1
            ]
          );
        }
      }

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

  static async getProductById(companyId: string, id: string) {
    const rows = await query<any>(
      `SELECT p.id, p.sku, p.barcode, p.name, p.description, p.product_type as productType,
              p.tracks_inventory as tracksInventory,
              p.department_id as departmentId, d.name as departmentName,
              p.group_id as groupId, g.name as groupName,
              p.subgroup_id as subgroupId, sg.name as subgroupName,
              p.brand, p.unit_of_measure as unitOfMeasure,
              p.cost_price as costPrice, p.base_price as basePrice, p.currency,
              p.default_tax_rate_id as defaultTaxRateId, tr.name as taxRateName, COALESCE(tr.rate, 16.0) as taxRate,
              p.tax_inclusive as taxInclusive,
              p.min_stock as minStock, p.max_stock as maxStock, p.is_active as isActive,
              p.has_batches as hasBatches, p.has_serials as hasSerials
       FROM products p
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN \`groups\` g ON p.group_id = g.id
       LEFT JOIN subgroups sg ON p.subgroup_id = sg.id
       LEFT JOIN tax_rates tr ON p.default_tax_rate_id = tr.id
       WHERE p.id = ? AND p.company_id = ?`,
      [id, companyId]
    );
    if (rows.length === 0) return null;
    const product = rows[0];

    const [locations, skus, presentations] = await Promise.all([
      query<any>(
        `SELECT pl.id, pl.warehouse_id as warehouseId, w.name as warehouseName,
                pl.aisle, pl.shelf, pl.compartment, pl.notes
         FROM product_locations pl
         INNER JOIN warehouses w ON pl.warehouse_id = w.id
         WHERE pl.product_id = ?`,
        [id]
      ),
      query<any>(
        `SELECT id, sku, barcode, description, is_primary as isPrimary, cost_price as costPrice, price, currency
         FROM product_skus
         WHERE product_id = ?
         ORDER BY is_primary DESC, sku ASC`,
        [id]
      ),
      query<any>(
        `SELECT id, presentation_id as presentationId, name, sku, barcode, unit_of_measure as unitOfMeasure,
                multiplier, cost_price as costPrice, base_price as basePrice, currency, is_default as isDefault,
                requires_authorization as requiresAuthorization, is_active as isActive
         FROM product_presentations
         WHERE product_id = ?
         ORDER BY is_default DESC, multiplier ASC`,
        [id]
      ),
    ]);

    return {
      ...product,
      costPrice: Number(product.costPrice || 0),
      basePrice: Number(product.basePrice || 0),
      minStock: Number(product.minStock || 0),
      maxStock: Number(product.maxStock || 0),
      hasBatches: Boolean(product.hasBatches),
      hasSerials: Boolean(product.hasSerials),
      taxInclusive: Boolean(product.taxInclusive),
      isActive: Boolean(product.isActive),
      tracksInventory: Boolean(product.tracksInventory !== 0 && product.tracksInventory !== false),
      locations,
      skus: skus.map((s: any) => ({
        ...s,
        isPrimary: Boolean(s.isPrimary),
        costPrice: s.costPrice != null ? Number(s.costPrice) : null,
        price: s.price != null ? Number(s.price) : null,
      })),
      presentations: presentations.map((p: any) => ({
        ...p,
        multiplier: Number(p.multiplier || 1),
        costPrice: Number(p.costPrice || 0),
        basePrice: Number(p.basePrice || 0),
        isDefault: Boolean(p.isDefault),
        requiresAuthorization: Boolean(p.requiresAuthorization),
        isActive: Boolean(p.isActive),
      })),
    };
  }

  static async updateProduct(companyId: string, id: string, input: UpdateProductInput) {
    const rows = await query<any>(
      `SELECT * FROM products WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (rows.length === 0) throw new Error('Producto no encontrado');
    const cur = rows[0];

    const sku = input.sku !== undefined ? input.sku.trim().toUpperCase() : cur.sku;
    const barcode = input.barcode !== undefined ? (input.barcode?.trim() || null) : cur.barcode;
    const name = input.name !== undefined ? input.name.trim() : cur.name;
    const description = input.description !== undefined ? input.description : cur.description;
    const productType = input.productType !== undefined ? input.productType : cur.product_type;
    const departmentId = input.departmentId !== undefined ? (input.departmentId || null) : cur.department_id;
    const groupId = input.groupId !== undefined ? (input.groupId || null) : cur.group_id;
    const subgroupId = input.subgroupId !== undefined ? (input.subgroupId || null) : cur.subgroup_id;
    const supplierId = input.supplierId !== undefined ? (input.supplierId || null) : cur.supplier_id;
    const brand = input.brand !== undefined ? (input.brand || null) : cur.brand;
    const unitOfMeasure = input.unitOfMeasure !== undefined ? input.unitOfMeasure : cur.unit_of_measure;
    const costPrice = input.costPrice !== undefined ? input.costPrice : cur.cost_price;
    const basePrice = input.basePrice !== undefined ? input.basePrice : cur.base_price;
    const currency = input.currency !== undefined ? input.currency : cur.currency;
    const defaultTaxRateId = input.defaultTaxRateId !== undefined ? (input.defaultTaxRateId || null) : cur.default_tax_rate_id;
    const taxInclusive = input.taxInclusive !== undefined ? (input.taxInclusive ? 1 : 0) : cur.tax_inclusive;
    const minStock = input.minStock !== undefined ? input.minStock : cur.min_stock;
    const maxStock = input.maxStock !== undefined ? input.maxStock : cur.max_stock;
    const hasBatches = input.hasBatches !== undefined ? (input.hasBatches ? 1 : 0) : cur.has_batches;
    const hasSerials = input.hasSerials !== undefined ? (input.hasSerials ? 1 : 0) : cur.has_serials;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : cur.is_active;
    const tracksInventory = input.tracksInventory !== undefined
      ? (input.tracksInventory ? 1 : 0)
      : (cur.tracks_inventory !== undefined ? cur.tracks_inventory : 1);

    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE products SET
           sku = ?, barcode = ?, name = ?, description = ?, product_type = ?, tracks_inventory = ?,
           department_id = ?, group_id = ?, subgroup_id = ?, supplier_id = ?, brand = ?,
           unit_of_measure = ?, cost_price = ?, base_price = ?, currency = ?,
           default_tax_rate_id = ?, tax_inclusive = ?, min_stock = ?, max_stock = ?,
           has_batches = ?, has_serials = ?, is_active = ?, updated_at = NOW()
         WHERE id = ? AND company_id = ?`,
        [
          sku, barcode, name, description, productType, tracksInventory,
          departmentId, groupId, subgroupId, supplierId, brand,
          unitOfMeasure, costPrice, basePrice, currency,
          defaultTaxRateId, taxInclusive, minStock, maxStock,
          hasBatches, hasSerials, isActive,
          id, companyId
        ]
      );

      // Sincronizar SKUs si se enviaron
      if (input.skus !== undefined) {
        await conn.query(`DELETE FROM product_skus WHERE product_id = ?`, [id]);
        if (input.skus && input.skus.length > 0) {
          for (const s of input.skus) {
            await conn.query(
              `INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                s.id || crypto.randomUUID(),
                id,
                s.sku.trim().toUpperCase(),
                s.barcode?.trim() || null,
                s.description || null,
                s.isPrimary ? 1 : 0,
                s.costPrice !== undefined ? s.costPrice : null,
                s.price !== undefined ? s.price : null,
                s.currency || currency || 'USD'
              ]
            );
          }
        }
      }

      // Sincronizar Presentaciones si se enviaron
      if (input.presentations !== undefined) {
        await conn.query(`DELETE FROM product_presentations WHERE product_id = ?`, [id]);
        if (input.presentations && input.presentations.length > 0) {
          for (const p of input.presentations) {
            await conn.query(
              `INSERT INTO product_presentations (id, product_id, presentation_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                p.id || crypto.randomUUID(),
                id,
                p.presentationId || null,
                p.name.trim(),
                p.sku?.trim().toUpperCase() || null,
                p.barcode?.trim() || null,
                p.unitOfMeasure || 'UND',
                p.multiplier || 1,
                p.costPrice || 0,
                p.basePrice || 0,
                p.currency || currency || 'USD',
                p.isDefault ? 1 : 0,
                p.requiresAuthorization ? 1 : 0,
                p.isActive !== undefined ? (p.isActive ? 1 : 0) : 1
              ]
            );
          }
        }
      }

      // Si se enviaron ubicaciones, actualizarlas
      if (input.locations && input.locations.length > 0) {
        for (const loc of input.locations) {
          await conn.query(
            `INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               aisle = VALUES(aisle),
               shelf = VALUES(shelf),
               compartment = VALUES(compartment),
               notes = VALUES(notes),
               updated_at = NOW()`,
            [crypto.randomUUID(), id, loc.warehouseId, loc.aisle || null, loc.shelf || null, loc.compartment || null, loc.notes || null]
          );
        }
      }
    });

    return { id, sku, barcode, name, description, productType, basePrice, costPrice, currency, isActive: Boolean(isActive) };
  }

  static async deleteProduct(companyId: string, id: string) {
    const rows = await query<any>(
      `SELECT * FROM products WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (rows.length === 0) throw new Error('Producto no encontrado');

    const [invoices] = await query<any>(`SELECT COUNT(*) as cnt FROM sales_invoice_items WHERE product_id = ?`, [id]);
    const [movements] = await query<any>(`SELECT COUNT(*) as cnt FROM inventory_movements WHERE product_id = ?`, [id]);
    const [deliveries] = await query<any>(`SELECT COUNT(*) as cnt FROM delivery_note_items WHERE product_id = ?`, [id]);

    const hasOperationalRecords = (invoices?.cnt || 0) > 0 || (movements?.cnt || 0) > 0 || (deliveries?.cnt || 0) > 0;

    if (hasOperationalRecords) {
      await query(`UPDATE products SET is_active = 0 WHERE id = ?`, [id]);
      return {
        success: true,
        deleted: false,
        deactivated: true,
        message: 'El producto posee movimientos de inventario o ventas asociadas. Ha sido desactivado lógicamente para preservar la integridad contable.',
      };
    } else {
      await withTransaction(async (conn) => {
        await conn.query(`DELETE FROM product_skus WHERE product_id = ?`, [id]);
        await conn.query(`DELETE FROM product_presentations WHERE product_id = ?`, [id]);
        await conn.query(`DELETE FROM product_locations WHERE product_id = ?`, [id]);
        await conn.query(`DELETE FROM product_stocks WHERE product_id = ?`, [id]);
        await conn.query(`DELETE FROM products WHERE id = ?`, [id]);
      });
      return {
        success: true,
        deleted: true,
        deactivated: false,
        message: 'Producto eliminado permanentemente del sistema.',
      };
    }
  }

  // ==========================================
  // EXISTENCIAS POR ALMACÉN Y CONTROL DE LOTES
  // ==========================================

  /**
   * Obtiene el desglose de existencias de un producto en cada uno de los almacenes
   * incluyendo ubicación física, reservado, disponible y valorización monetaria.
   */
  static async getProductStockByWarehouse(companyId: string, productId: string) {
    const rows = await query<any>(
      `SELECT 
        w.id as warehouseId,
        w.code as warehouseCode,
        w.name as warehouseName,
        w.is_default_sales as isDefaultSales,
        w.is_default_purchases as isDefaultPurchases,
        b.id as branchId,
        b.name as branchName,
        COALESCE(ps.current_stock, 0) as currentStock,
        COALESCE(ps.reserved_stock, 0) as reservedStock,
        COALESCE(ps.available_stock, COALESCE(ps.current_stock, 0) - COALESCE(ps.reserved_stock, 0)) as availableStock,
        pl.aisle,
        pl.shelf,
        pl.compartment,
        pl.notes as locationNotes,
        p.cost_price as costPrice,
        p.base_price as basePrice,
        ROUND(COALESCE(ps.current_stock, 0) * p.cost_price, 2) as totalCostValuation,
        ROUND(COALESCE(ps.current_stock, 0) * p.base_price, 2) as totalSaleValuation
      FROM warehouses w
      INNER JOIN branches b ON w.branch_id = b.id
      CROSS JOIN products p ON p.id = ?
      LEFT JOIN product_stocks ps ON ps.warehouse_id = w.id AND ps.product_id = p.id
      LEFT JOIN product_locations pl ON pl.warehouse_id = w.id AND pl.product_id = p.id
      WHERE b.company_id = ? AND w.is_active = 1
      ORDER BY b.name ASC, w.is_default_sales DESC, w.name ASC`,
      [productId, companyId]
    );

    return rows.map((r) => ({
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouseCode,
      warehouseName: r.warehouseName,
      isDefaultSales: Boolean(r.isDefaultSales),
      isDefaultPurchases: Boolean(r.isDefaultPurchases),
      branchId: r.branchId,
      branchName: r.branchName,
      currentStock: Number(r.currentStock || 0),
      reservedStock: Number(r.reservedStock || 0),
      availableStock: Number(r.availableStock || 0),
      aisle: r.aisle || null,
      shelf: r.shelf || null,
      compartment: r.compartment || null,
      locationNotes: r.locationNotes || null,
      costPrice: Number(r.costPrice || 0),
      basePrice: Number(r.basePrice || 0),
      totalCostValuation: Number(r.totalCostValuation || 0),
      totalSaleValuation: Number(r.totalSaleValuation || 0),
    }));
  }

  /**
   * Obtiene los lotes registrados para un producto, calculando los días de vencimiento
   * y el estado de alerta (Vigente, Por Vencer <= 30 días, Vencido).
   */
  static async getProductLots(companyId: string, productId: string, warehouseId?: string) {
    const params: any[] = [companyId, productId];
    let whFilter = '';
    if (warehouseId) {
      whFilter = 'AND pl.warehouse_id = ?';
      params.push(warehouseId);
    }

    const rows = await query<any>(
      `SELECT 
        pl.id,
        pl.company_id as companyId,
        pl.product_id as productId,
        pl.warehouse_id as warehouseId,
        w.name as warehouseName,
        w.code as warehouseCode,
        b.name as branchName,
        pl.lot_number as lotNumber,
        DATE_FORMAT(pl.manufacturing_date, '%Y-%m-%d') as manufacturingDate,
        DATE_FORMAT(pl.expiration_date, '%Y-%m-%d') as expirationDate,
        DATEDIFF(pl.expiration_date, CURDATE()) as daysToExpiration,
        pl.initial_quantity as initialQuantity,
        pl.current_quantity as currentQuantity,
        pl.reserved_quantity as reservedQuantity,
        (pl.current_quantity - pl.reserved_quantity) as availableQuantity,
        pl.cost_price as costPrice,
        pl.status,
        pl.notes,
        pl.created_at as createdAt
      FROM product_lots pl
      INNER JOIN warehouses w ON pl.warehouse_id = w.id
      INNER JOIN branches b ON w.branch_id = b.id
      WHERE pl.company_id = ? AND pl.product_id = ? ${whFilter}
      ORDER BY pl.expiration_date ASC, pl.lot_number ASC`,
      params
    );

    return rows.map((r) => {
      const days = Number(r.daysToExpiration);
      let calculatedStatus = r.status;
      if (days < 0) {
        calculatedStatus = 'EXPIRED';
      } else if (Number(r.currentQuantity) <= 0) {
        calculatedStatus = 'DEPLETED';
      }

      return {
        id: r.id,
        companyId: r.companyId,
        productId: r.productId,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        warehouseCode: r.warehouseCode,
        branchName: r.branchName,
        lotNumber: r.lotNumber,
        manufacturingDate: r.manufacturingDate || null,
        expirationDate: r.expirationDate,
        daysToExpiration: days,
        initialQuantity: Number(r.initialQuantity || 0),
        currentQuantity: Number(r.currentQuantity || 0),
        reservedQuantity: Number(r.reservedQuantity || 0),
        availableQuantity: Number(r.availableQuantity || 0),
        costPrice: Number(r.costPrice || 0),
        status: calculatedStatus,
        isExpiringSoon: days >= 0 && days <= 30,
        isExpired: days < 0,
        notes: r.notes || null,
        createdAt: r.createdAt,
      };
    });
  }

  /**
   * Crea o actualiza un lote de producto y opcionalmente sincroniza existencias en el depósito
   */
  static async createOrAdjustProductLot(companyId: string, userId: string, input: ProductLotInput) {
    return await withTransaction(async (conn) => {
      const lotId = input.id || crypto.randomUUID();

      // Verificar que el depósito pertenezca a la empresa
      const [whCheck]: any = await conn.query(
        `SELECT w.id, w.branch_id FROM warehouses w INNER JOIN branches b ON w.branch_id = b.id WHERE w.id = ? AND b.company_id = ?`,
        [input.warehouseId, companyId]
      );
      if (!whCheck || whCheck.length === 0) {
        throw new Error('El depósito seleccionado no es válido o no pertenece a la empresa');
      }
      const branchId = whCheck[0].branch_id;

      // Upsert lote
      await conn.query(
        `INSERT INTO product_lots (
          id, company_id, product_id, warehouse_id, lot_number,
          manufacturing_date, expiration_date, initial_quantity, current_quantity,
          reserved_quantity, cost_price, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          manufacturing_date = VALUES(manufacturing_date),
          expiration_date = VALUES(expiration_date),
          current_quantity = VALUES(current_quantity),
          cost_price = VALUES(cost_price),
          status = VALUES(status),
          notes = VALUES(notes),
          updated_at = NOW()`,
        [
          lotId,
          companyId,
          input.productId,
          input.warehouseId,
          input.lotNumber.trim().toUpperCase(),
          input.manufacturingDate || null,
          input.expirationDate,
          input.initialQuantity || input.currentQuantity || 0,
          input.currentQuantity || 0,
          input.reservedQuantity || 0,
          input.costPrice || 0,
          input.status || 'ACTIVE',
          input.notes || null,
        ]
      );

      // Si se indicó adjustStock, actualizar product_stocks y registrar en Kardex
      if (input.adjustStock && input.currentQuantity > 0) {
        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             current_stock = current_stock + VALUES(current_stock),
             last_movement_at = NOW()`,
          [input.productId, input.warehouseId, input.currentQuantity]
        );

        await conn.query(
          `INSERT INTO inventory_movements (
            id, branch_id, warehouse_id, product_id, user_id, movement_type,
            quantity, unit_cost, reference_document, reason
          ) VALUES (?, ?, ?, ?, ?, 'ADJUST_IN', ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            branchId,
            input.warehouseId,
            input.productId,
            userId,
            input.currentQuantity,
            input.costPrice || 0,
            `LOTE-${input.lotNumber.trim().toUpperCase()}`,
            `Ingreso/Ajuste de lote ${input.lotNumber}: ${input.notes || 'Registro manual de lote'}`
          ]
        );
      }

      return {
        id: lotId,
        companyId,
        ...input,
      };
    });
  }

  // ==========================================
  // MARCAS
  // ==========================================
  static async getBrands(companyId: string) {
    return await query<any>(
      `SELECT id, company_id as companyId, name, description, is_active as isActive, created_at as createdAt
       FROM brands
       WHERE company_id = ?
       ORDER BY name ASC`,
      [companyId]
    );
  }

  static async createBrand(input: BrandInput) {
    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO brands (id, company_id, name, description, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.companyId, input.name.trim(), input.description || null, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  static async updateBrand(companyId: string, id: string, input: UpdateBrandInput) {
    const rows = await query<any>(`SELECT * FROM brands WHERE id = ? AND company_id = ?`, [id, companyId]);
    if (rows.length === 0) throw new Error('Marca no encontrada');
    const cur = rows[0];
    const name = input.name !== undefined ? input.name.trim() : cur.name;
    const description = input.description !== undefined ? input.description : cur.description;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : cur.is_active;

    await query(
      `UPDATE brands SET name = ?, description = ?, is_active = ?, updated_at = NOW()
       WHERE id = ? AND company_id = ?`,
      [name, description, isActive, id, companyId]
    );
    return { id, name, description, isActive: Boolean(isActive) };
  }

  static async deleteBrand(companyId: string, id: string) {
    const [usage] = await query<any>(`SELECT COUNT(*) as cnt FROM products WHERE brand = (SELECT name FROM brands WHERE id = ?) AND company_id = ?`, [id, companyId]);
    if ((usage?.cnt || 0) > 0) {
      await query(`UPDATE brands SET is_active = 0 WHERE id = ? AND company_id = ?`, [id, companyId]);
      return { success: true, deleted: false, deactivated: true, message: 'La marca tiene productos asociados y fue desactivada lógicamente.' };
    }
    await query(`DELETE FROM brands WHERE id = ? AND company_id = ?`, [id, companyId]);
    return { success: true, deleted: true, message: 'Marca eliminada con éxito.' };
  }

  // ==========================================
  // UNIDADES DE MEDIDA
  // ==========================================
  static async getUnitsOfMeasure(companyId: string) {
    return await query<any>(
      `SELECT id, company_id as companyId, code, name, symbol, is_active as isActive, created_at as createdAt
       FROM units_of_measure
       WHERE company_id = ?
       ORDER BY code ASC`,
      [companyId]
    );
  }

  static async createUnitOfMeasure(input: UnitOfMeasureInput) {
    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO units_of_measure (id, company_id, code, name, symbol, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.companyId, input.code.trim().toUpperCase(), input.name.trim(), input.symbol || null, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  static async updateUnitOfMeasure(companyId: string, id: string, input: UpdateUnitOfMeasureInput) {
    const rows = await query<any>(`SELECT * FROM units_of_measure WHERE id = ? AND company_id = ?`, [id, companyId]);
    if (rows.length === 0) throw new Error('Unidad de medida no encontrada');
    const cur = rows[0];
    const code = input.code !== undefined ? input.code.trim().toUpperCase() : cur.code;
    const name = input.name !== undefined ? input.name.trim() : cur.name;
    const symbol = input.symbol !== undefined ? input.symbol : cur.symbol;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : cur.is_active;

    await query(
      `UPDATE units_of_measure SET code = ?, name = ?, symbol = ?, is_active = ?, updated_at = NOW()
       WHERE id = ? AND company_id = ?`,
      [code, name, symbol, isActive, id, companyId]
    );
    return { id, code, name, symbol, isActive: Boolean(isActive) };
  }

  static async deleteUnitOfMeasure(companyId: string, id: string) {
    const [usage] = await query<any>(`SELECT COUNT(*) as cnt FROM products WHERE unit_of_measure = (SELECT code FROM units_of_measure WHERE id = ?) AND company_id = ?`, [id, companyId]);
    if ((usage?.cnt || 0) > 0) {
      await query(`UPDATE units_of_measure SET is_active = 0 WHERE id = ? AND company_id = ?`, [id, companyId]);
      return { success: true, deleted: false, deactivated: true, message: 'La unidad tiene productos asociados y fue desactivada lógicamente.' };
    }
    await query(`DELETE FROM units_of_measure WHERE id = ? AND company_id = ?`, [id, companyId]);
    return { success: true, deleted: true, message: 'Unidad de medida eliminada con éxito.' };
  }

  // ==========================================
  // CATÁLOGO MAESTRO DE PRESENTACIONES
  // ==========================================
  static async getPresentations(companyId: string) {
    return await query<any>(
      `SELECT id, company_id as companyId, name, description, default_multiplier as defaultMultiplier,
              default_unit as defaultUnit, requires_authorization as requiresAuthorization,
              is_active as isActive, created_at as createdAt
       FROM presentations
       WHERE company_id = ?
       ORDER BY name ASC`,
      [companyId]
    );
  }

  static async createPresentation(input: PresentationInput) {
    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO presentations (id, company_id, name, description, default_multiplier, default_unit, requires_authorization, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.companyId,
        input.name.trim(),
        input.description || null,
        input.defaultMultiplier || 1,
        input.defaultUnit || 'UND',
        input.requiresAuthorization ? 1 : 0,
        input.isActive ? 1 : 0
      ]
    );
    return { id, ...input };
  }

  static async updatePresentation(companyId: string, id: string, input: UpdatePresentationInput) {
    const rows = await query<any>(`SELECT * FROM presentations WHERE id = ? AND company_id = ?`, [id, companyId]);
    if (rows.length === 0) throw new Error('Presentación no encontrada');
    const cur = rows[0];
    const name = input.name !== undefined ? input.name.trim() : cur.name;
    const description = input.description !== undefined ? input.description : cur.description;
    const defaultMultiplier = input.defaultMultiplier !== undefined ? input.defaultMultiplier : cur.default_multiplier;
    const defaultUnit = input.defaultUnit !== undefined ? input.defaultUnit : cur.default_unit;
    const requiresAuthorization = input.requiresAuthorization !== undefined ? (input.requiresAuthorization ? 1 : 0) : cur.requires_authorization;
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : cur.is_active;

    await query(
      `UPDATE presentations SET name = ?, description = ?, default_multiplier = ?, default_unit = ?, requires_authorization = ?, is_active = ?, updated_at = NOW()
       WHERE id = ? AND company_id = ?`,
      [name, description, defaultMultiplier, defaultUnit, requiresAuthorization, isActive, id, companyId]
    );
    return { id, name, description, defaultMultiplier, defaultUnit, requiresAuthorization: Boolean(requiresAuthorization), isActive: Boolean(isActive) };
  }

  static async deletePresentation(companyId: string, id: string) {
    await query(`DELETE FROM presentations WHERE id = ? AND company_id = ?`, [id, companyId]);
    return { success: true, deleted: true, message: 'Presentación eliminada con éxito.' };
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

  /**
   * Obtiene los datos detallados de un ajuste de inventario para comprobante PDF
   */
  static async getAdjustmentById(companyId: string, adjustmentId: string) {
    const rows = await query<any>(
      `SELECT ia.*, b.name as branch_name, w.name as warehouse_name, u.full_name as user_name
       FROM inventory_adjustments ia
       INNER JOIN branches b ON ia.branch_id = b.id
       INNER JOIN warehouses w ON ia.warehouse_id = w.id
       INNER JOIN users u ON ia.user_id = u.id
       WHERE ia.id = ? AND ia.company_id = ?`,
      [adjustmentId, companyId]
    );

    if (rows.length === 0) return null;
    const adj = rows[0];

    const items = await query<any>(
      `SELECT iai.*, p.sku as product_sku, p.name as product_name
       FROM inventory_adjustment_items iai
       INNER JOIN products p ON iai.product_id = p.id
       WHERE iai.adjustment_id = ?`,
      [adjustmentId]
    );

    return {
      adjustmentNumber: adj.adjustment_number,
      adjustmentDate: adj.adjustment_date ? new Date(adj.adjustment_date).toISOString() : new Date().toISOString(),
      type: adj.type,
      reason: adj.reason,
      status: adj.status,
      branchName: adj.branch_name,
      warehouseName: adj.warehouse_name,
      userName: adj.user_name,
      totalCostImpact: Number(adj.total_cost_impact || 0),
      items: items.map((i: any) => ({
        productSku: i.product_sku,
        productName: i.product_name,
        movementType: i.movement_type,
        previousStock: Number(i.previous_stock || 0),
        quantity: Number(i.quantity || 0),
        newStock: Number(i.new_stock || 0),
        unitCost: Number(i.unit_cost || 0),
        totalCost: Number(i.total_cost || 0),
        notes: i.notes || undefined,
      })),
    };
  }

  /**
   * Obtiene los datos detallados de un traslado de inventario para Guía de Traslado PDF
   */
  static async getTransferById(companyId: string, transferId: string) {
    const rows = await query<any>(
      `SELECT it.*,
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
       WHERE it.id = ? AND it.company_id = ?`,
      [transferId, companyId]
    );

    if (rows.length === 0) return null;
    const tr = rows[0];

    const items = await query<any>(
      `SELECT iti.*, p.sku as product_sku, p.name as product_name
       FROM inventory_transfer_items iti
       INNER JOIN products p ON iti.product_id = p.id
       WHERE iti.transfer_id = ?`,
      [transferId]
    );

    return {
      transferNumber: tr.transfer_number,
      shippedAt: tr.shipped_at ? new Date(tr.shipped_at).toISOString() : new Date().toISOString(),
      receivedAt: tr.received_at ? new Date(tr.received_at).toISOString() : undefined,
      status: tr.status,
      originBranchName: tr.origin_branch_name,
      originWarehouseName: tr.origin_warehouse_name,
      destinationBranchName: tr.destination_branch_name,
      destinationWarehouseName: tr.destination_warehouse_name,
      shippedByUserName: tr.shipped_by_name,
      receivedByUserName: tr.received_by_name || undefined,
      notes: tr.notes || undefined,
      totalItems: Number(tr.total_items || items.length),
      totalCost: Number(tr.total_cost || 0),
      items: items.map((i: any) => ({
        productSku: i.product_sku,
        productName: i.product_name,
        quantitySent: Number(i.quantity_sent || 0),
        quantityReceived: i.quantity_received != null ? Number(i.quantity_received) : undefined,
        unitCost: Number(i.unit_cost || 0),
        notes: i.notes || undefined,
      })),
    };
  }
}
