import { query, withTransaction } from '../../db';
import { BulkPriceUpdateCriteria, BulkPriceUpdateAction, ApplyTaxRateChangeInput, TaxRateInput, applyRounding } from '@ero/shared';
import crypto from 'crypto';

export class PricingService {
  /**
   * Simulación previa (Preview) del impacto del cambio masivo de precios
   */
  static async previewBulkPriceUpdate(companyId: string, criteria: BulkPriceUpdateCriteria, action: BulkPriceUpdateAction) {
    // 1. Obtener los productos que cumplen los criterios
    const products = await query<any>(
      `SELECT p.id, p.sku, p.name, p.cost_price as costPrice, p.base_price as oldBasePrice,
              COALESCE(tr.rate, 16.00) as taxRate, d.name as departmentName, g.name as groupName
       FROM products p
       LEFT JOIN tax_rates tr ON p.default_tax_rate_id = tr.id
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN \`groups\` g ON p.group_id = g.id
       WHERE p.company_id = ?
         AND p.is_active = 1
         AND (? = 'all' OR p.product_type = ?)
         AND (? IS NULL OR p.base_price >= ?)
         AND (? IS NULL OR p.base_price <= ?)`,
      [
        companyId,
        criteria.productType || 'all', criteria.productType || 'all',
        criteria.minCurrentPrice || null, criteria.minCurrentPrice || null,
        criteria.maxCurrentPrice || null, criteria.maxCurrentPrice || null,
      ]
    );

    // 2. Calcular los nuevos precios simulados
    const previewItems = products.map((p) => {
      let rawNewBase = p.oldBasePrice;

      switch (action.mode) {
        case 'percentage':
          rawNewBase = p.oldBasePrice * (1 + action.value / 100);
          break;
        case 'fixed_amount':
          rawNewBase = p.oldBasePrice + action.value;
          break;
        case 'absolute_price':
          rawNewBase = action.value;
          break;
        case 'margin_over_cost':
          rawNewBase = p.costPrice * (1 + action.value / 100);
          break;
      }

      // Aplicar regla de redondeo
      const newBasePrice = applyRounding(rawNewBase, action.roundingRule);
      const oldFinalPrice = Number((p.oldBasePrice * (1 + p.taxRate / 100)).toFixed(2));
      const newFinalPrice = Number((newBasePrice * (1 + p.taxRate / 100)).toFixed(2));
      const priceDifference = Number((newBasePrice - p.oldBasePrice).toFixed(2));
      const percentageChange = p.oldBasePrice > 0 ? Number(((priceDifference / p.oldBasePrice) * 100).toFixed(2)) : 0;

      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        costPrice: Number(p.costPrice),
        oldBasePrice: Number(p.oldBasePrice),
        newBasePrice,
        oldFinalPrice,
        newFinalPrice,
        taxRate: Number(p.taxRate),
        priceDifference,
        percentageChange,
        departmentName: p.departmentName,
        groupName: p.groupName,
      };
    });

    return {
      totalProductsMatched: previewItems.length,
      samplePreview: previewItems.slice(0, 50), // Primeros 50 para vista previa en vivo
      summary: {
        avgPercentageChange: previewItems.length > 0 
          ? Number((previewItems.reduce((acc, it) => acc + it.percentageChange, 0) / previewItems.length).toFixed(2)) 
          : 0,
        mode: action.mode,
        value: action.value,
        roundingRule: action.roundingRule,
      },
    };
  }

  /**
   * Ejecuta la actualización masiva de precios y genera el lote auditado
   */
  static async executeBulkPriceUpdate(companyId: string, userId: string, criteria: BulkPriceUpdateCriteria, action: BulkPriceUpdateAction) {
    const batchId = crypto.randomUUID();
    const batchNumber = `LOTE-${Date.now().toString().slice(-6)}`;

    return await withTransaction(async (conn) => {
      // 1. Crear registro de lote
      await conn.query(
        `INSERT INTO price_change_batches (
          id, company_id, user_id, batch_number, mode, mode_value, rounding_rule,
          tax_affects_final_price, price_mode, criteria_json, status, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?)`,
        [
          batchId, companyId, userId, batchNumber, action.mode, action.value, action.roundingRule,
          action.taxAffectsFinalPrice ? 1 : 0, action.priceMode, JSON.stringify(criteria), action.reason,
        ]
      );

      // 2. Invocar el Stored Procedure `sp_bulk_price_update`
      await conn.query(
        `CALL sp_bulk_price_update(?, ?, ?, ?, ?, ?, ?, ?, ?, @affected_count)`,
        [
          batchId, companyId, userId, action.mode, action.value, action.roundingRule,
          action.taxAffectsFinalPrice ? 1 : 0, action.priceMode, JSON.stringify(criteria),
        ]
      );

      const [countRows]: any = await conn.query(`SELECT @affected_count AS affectedCount`);
      const affectedCount = countRows[0]?.affectedCount || 0;

      return {
        batchId,
        batchNumber,
        affectedCount,
        status: 'APPLIED',
        appliedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Obtiene el listado de lotes de precios ejecutados
   */
  static async getBatches(companyId: string) {
    return await query<any>(
      `SELECT b.id, b.batch_number as batchNumber, b.mode, b.mode_value as modeValue,
              b.rounding_rule as roundingRule, b.affected_products_count as affectedProductsCount,
              b.status, b.reason, b.created_at as createdAt, b.applied_at as appliedAt,
              u.full_name as createdBy
       FROM price_change_batches b
       INNER JOIN users u ON b.user_id = u.id
       WHERE b.company_id = ?
       ORDER BY b.created_at DESC`,
      [companyId]
    );
  }

  /**
   * Obtiene los datos detallados de un lote de modificación de precios para reporte PDF
   */
  static async getBatchById(companyId: string, batchId: string) {
    const rows = await query<any>(
      `SELECT b.*, u.full_name as user_name
       FROM price_change_batches b
       INNER JOIN users u ON b.user_id = u.id
       WHERE (b.id = ? OR b.batch_number = ?) AND b.company_id = ?`,
      [batchId, batchId, companyId]
    );

    if (rows.length === 0) return null;
    const batch = rows[0];

    const items = await query<any>(
      `SELECT pci.*, p.sku, p.name as product_name
       FROM price_change_items pci
       INNER JOIN products p ON pci.product_id = p.id
       WHERE pci.batch_id = ?`,
      [batch.id]
    );

    return {
      batchNumber: batch.batch_number,
      createdAt: batch.created_at ? new Date(batch.created_at).toISOString() : new Date().toISOString(),
      appliedAt: batch.applied_at ? new Date(batch.applied_at).toISOString() : undefined,
      userName: batch.user_name,
      mode: batch.mode,
      modeValue: Number(batch.mode_value || 0),
      roundingRule: batch.rounding_rule,
      reason: batch.reason || undefined,
      status: batch.status,
      items: items.map((i: any) => {
        const cost = Number(i.cost_price || 0);
        const oldP = Number(i.old_base_price || 0);
        const newP = Number(i.new_base_price || 0);
        const oldMargin = oldP > 0 && cost > 0 ? ((oldP - cost) / oldP) * 100 : undefined;
        const newMargin = newP > 0 && cost > 0 ? ((newP - cost) / newP) * 100 : undefined;

        return {
          sku: i.sku || 'N/A',
          productName: i.product_name,
          oldPrice: oldP,
          newPrice: newP,
          oldMarginPercent: oldMargin ? Number(oldMargin.toFixed(1)) : undefined,
          newMarginPercent: newMargin ? Number(newMargin.toFixed(1)) : undefined,
          currency: 'USD',
        };
      }),
    };
  }

  /**
   * Obtiene las tasas de impuestos configuradas
   */
  static async getTaxRates(companyId: string) {
    return await query<any>(
      `SELECT id, code, name, rate, type, is_active as isActive, valid_from as validFrom, valid_to as validTo
       FROM tax_rates
       WHERE company_id = ?
       ORDER BY type, rate DESC`,
      [companyId]
    );
  }

  /**
   * Crea una nueva tasa de impuesto
   */
  static async createTaxRate(input: TaxRateInput) {
    const id = input.id || crypto.randomUUID();
    await query(
      `INSERT INTO tax_rates (id, company_id, code, name, rate, type, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.companyId, input.code, input.name, input.rate, input.type, input.isActive ? 1 : 0]
    );
    return { id, ...input };
  }

  /**
   * Aplica un cambio de tasa de impuesto con afectación de precio final
   */
  static async applyTaxRateChange(input: ApplyTaxRateChangeInput, userId: string) {
    await query(
      `CALL sp_change_tax_rate(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.taxRateId,
        input.newRate,
        input.taxAffectsFinalPrice ? 1 : 0,
        input.priceMode,
        input.applyScope,
        input.scopeRefId || null,
        userId,
        input.reason,
      ]
    );

    return {
      taxRateId: input.taxRateId,
      newRate: input.newRate,
      taxAffectsFinalPrice: input.taxAffectsFinalPrice,
      appliedAt: new Date().toISOString(),
    };
  }

  /**
   * Historial de auditoría de precios por producto
   */
  static async getProductPriceHistory(productId: string) {
    return await query<any>(
      `SELECT ph.id, ph.old_cost as oldCost, ph.new_cost as newCost,
              ph.old_price as oldPrice, ph.new_price as newPrice,
              ph.change_type as changeType, ph.change_reason as changeReason,
              ph.created_at as createdAt, u.full_name as userName
       FROM price_history ph
       INNER JOIN users u ON ph.user_id = u.id
       WHERE ph.product_id = ?
       ORDER BY ph.created_at DESC`,
      [productId]
    );
  }
}
