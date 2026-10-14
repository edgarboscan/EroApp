import { describe, it, expect } from 'vitest';
import {
  createPurchaseOrderSchema,
  createGoodsReceiptSchema,
  convertReceiptToInvoiceSchema,
  calculateWeightedAverageCost,
} from '@ero/shared';

describe('Módulo de Compras & Abastecimiento Completo (Paso 8)', () => {
  const validBranchId = '11111111-1111-1111-1111-111111111111';
  const validWarehouseId = '22222222-2222-2222-2222-222222222222';
  const validSupplierId = '33333333-3333-3333-3333-333333333333';
  const validProductId = '44444444-4444-4444-4444-444444444444';
  const validOrderId = '55555555-5555-5555-5555-555555555555';
  const validReceiptId = '66666666-6666-6666-6666-666666666666';

  describe('Validación de Esquema de Órdenes de Compra', () => {
    it('debe validar la emisión de una orden de compra con múltiples líneas de producto', () => {
      const result = createPurchaseOrderSchema.safeParse({
        branchId: validBranchId,
        supplierId: validSupplierId,
        expectedDeliveryDate: '2026-10-15',
        currency: 'USD',
        exchangeRate: 36.85,
        notes: 'Pedido mensual de harinas y víveres',
        items: [
          {
            productId: validProductId,
            quantityOrdered: 200,
            unitCost: 1.15,
            taxRate: 0.0,
            notes: 'Presentación bulto 20x1kg',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar una orden de compra sin líneas de productos', () => {
      const result = createPurchaseOrderSchema.safeParse({
        branchId: validBranchId,
        supplierId: validSupplierId,
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it('debe rechazar una orden de compra con cantidad no positiva o costo negativo', () => {
      const invalidQty = createPurchaseOrderSchema.safeParse({
        branchId: validBranchId,
        supplierId: validSupplierId,
        items: [
          {
            productId: validProductId,
            quantityOrdered: -5,
            unitCost: 10.0,
          },
        ],
      });
      expect(invalidQty.success).toBe(false);

      const invalidCost = createPurchaseOrderSchema.safeParse({
        branchId: validBranchId,
        supplierId: validSupplierId,
        items: [
          {
            productId: validProductId,
            quantityOrdered: 10,
            unitCost: -2.5,
          },
        ],
      });
      expect(invalidCost.success).toBe(false);
    });
  });

  describe('Validación de Esquema de Recepción de Mercancías (Goods Receipts)', () => {
    it('debe validar la recepción de mercancía física con depósito destino y guía de despacho', () => {
      const result = createGoodsReceiptSchema.safeParse({
        branchId: validBranchId,
        warehouseId: validWarehouseId,
        supplierId: validSupplierId,
        purchaseOrderId: validOrderId,
        supplierDeliveryNote: 'GD-998822',
        currency: 'USD',
        exchangeRate: 36.85,
        notes: 'Entrada conforme por andén 3',
        items: [
          {
            productId: validProductId,
            quantityReceived: 100,
            unitCost: 1.15,
            notes: 'Paleta completa inspeccionada',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar una recepción sin depósito destino o sin ítems', () => {
      const withoutWh = createGoodsReceiptSchema.safeParse({
        branchId: validBranchId,
        warehouseId: 'not-a-uuid',
        supplierId: validSupplierId,
        items: [
          {
            productId: validProductId,
            quantityReceived: 10,
            unitCost: 5.0,
          },
        ],
      });
      expect(withoutWh.success).toBe(false);

      const emptyItems = createGoodsReceiptSchema.safeParse({
        branchId: validBranchId,
        warehouseId: validWarehouseId,
        supplierId: validSupplierId,
        items: [],
      });
      expect(emptyItems.success).toBe(false);
    });
  });

  describe('Conversión de Recepción a Factura de Proveedor (CxP)', () => {
    it('debe validar los datos fiscales para generar la factura en CxP a crédito', () => {
      const result = convertReceiptToInvoiceSchema.safeParse({
        receiptId: validReceiptId,
        invoiceNumber: 'FACT-009928',
        controlNumber: '00-334411',
        isCredit: true,
        dueDate: '2026-11-15',
        notes: 'Crédito comercial otorgado a 45 días',
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar la conversión si falta el número de factura fiscal', () => {
      const result = convertReceiptToInvoiceSchema.safeParse({
        receiptId: validReceiptId,
        invoiceNumber: '',
        isCredit: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Impacto de Abastecimiento en el Costeo Promedio Ponderado', () => {
    it('debe recomputar el costo promedio del producto al ingresar nueva mercancía a diferente precio', () => {
      // Stock anterior en depósito: 20 unidades con costo promedio de $5.00 ($100 acumulado)
      // Nueva recepción de compra: 30 unidades a $6.00 ($180 acumulado)
      // Nuevo stock total: 50 unidades por $280 => $5.60 por unidad
      const updatedCost = calculateWeightedAverageCost(20, 5.0, 30, 6.0);
      expect(updatedCost).toBe(5.6);
    });

    it('debe mantener el nuevo costo cuando el inventario previo estaba en cero', () => {
      const updatedCost = calculateWeightedAverageCost(0, 0, 80, 7.25);
      expect(updatedCost).toBe(7.25);
    });
  });
});
