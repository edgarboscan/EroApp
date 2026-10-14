import { describe, it, expect } from 'vitest';
import {
  calculateWeightedAverageCost,
  determineStockStatus,
  calculateSuggestedReorderQuantity,
  createInventoryAdjustmentSchema,
  createInventoryTransferSchema,
  receiveInventoryTransferSchema,
  kardexFilterSchema,
} from '@ero/shared';

describe('Operaciones Avanzadas de Inventario (Paso 7)', () => {
  describe('Cálculo de Costo Promedio Ponderado (Weighted Average Cost)', () => {
    it('debe calcular el costo promedio ponderado exacto ante una nueva entrada', () => {
      // Existencia inicial: 100 unidades a $10.00 c/u = $1000
      // Nueva compra: 50 unidades a $13.00 c/u = $650
      // Total: 150 unidades por $1650 => $11.00 c/u
      const newCost = calculateWeightedAverageCost(100, 10.0, 50, 13.0);
      expect(newCost).toBe(11.0);
    });

    it('debe asignar el costo de entrada cuando la existencia previa es cero', () => {
      const newCost = calculateWeightedAverageCost(0, 0, 40, 25.5);
      expect(newCost).toBe(25.5);
    });

    it('debe redondear correctamente a 4 decimales en cálculos de fracciones', () => {
      // 10 unidades a $10 + 3 unidades a $12 = $100 + $36 = $136 / 13 = 10.461538... -> 10.4615
      const newCost = calculateWeightedAverageCost(10, 10.0, 3, 12.0);
      expect(newCost).toBe(10.4615);
    });

    it('debe manejar entradas con cantidad cero conservando el costo anterior', () => {
      const newCost = calculateWeightedAverageCost(50, 15.0, 0, 20.0);
      expect(newCost).toBe(15.0);
    });
  });

  describe('Semáforo y Alertas de Stock Crítico', () => {
    it('debe clasificar como OUT_OF_STOCK cuando el stock es menor o igual a cero', () => {
      expect(determineStockStatus(0, 10, 100)).toBe('OUT_OF_STOCK');
      expect(determineStockStatus(-5, 10, 100)).toBe('OUT_OF_STOCK');
    });

    it('debe clasificar como CRITICAL_LOW cuando el stock está en o por debajo del mínimo', () => {
      expect(determineStockStatus(8, 10, 100)).toBe('CRITICAL_LOW');
      expect(determineStockStatus(10, 10, 100)).toBe('CRITICAL_LOW');
      expect(determineStockStatus(1, 5, 20)).toBe('CRITICAL_LOW');
    });

    it('debe clasificar como OPTIMAL cuando el stock está entre el mínimo y máximo', () => {
      expect(determineStockStatus(11, 10, 100)).toBe('OPTIMAL');
      expect(determineStockStatus(50, 10, 100)).toBe('OPTIMAL');
      expect(determineStockStatus(100, 10, 100)).toBe('OPTIMAL');
    });

    it('debe clasificar como OVERSTOCK cuando el stock supera el máximo configurado', () => {
      expect(determineStockStatus(105, 10, 100)).toBe('OVERSTOCK');
      expect(determineStockStatus(500, 10, 100)).toBe('OVERSTOCK');
    });

    it('debe calcular la cantidad de reposición sugerida para alcanzar el máximo', () => {
      // Si stock actual es 4 y min es 10 con max de 50 -> sugerir 50 - 4 = 46 unidades
      const reorderQty = calculateSuggestedReorderQuantity(4, 10, 50);
      expect(reorderQty).toBe(46);
    });

    it('no debe sugerir reposición cuando el stock cumple o excede el mínimo', () => {
      const reorderQty = calculateSuggestedReorderQuantity(15, 10, 50);
      expect(reorderQty).toBe(0);
    });
  });

  describe('Validación de Esquema de Ajustes de Inventario (Merma / Sobrante / Conteo)', () => {
    const validBranchId = '11111111-1111-1111-1111-111111111111';
    const validWhId = '22222222-2222-2222-2222-222222222222';
    const validProductId = '33333333-3333-3333-3333-333333333333';

    it('debe validar un ajuste por merma o daño físico', () => {
      const result = createInventoryAdjustmentSchema.safeParse({
        branchId: validBranchId,
        warehouseId: validWhId,
        type: 'DAMAGE_SPOILED',
        reason: 'Productos deteriorados por humedad en depósito secundario',
        items: [
          {
            productId: validProductId,
            movementType: 'ADJUST_OUT',
            quantity: 5,
            unitCost: 12.5,
            notes: 'Caja rota y empaque abierto',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('debe validar un ajuste de tipo sobrante (FOUND_SURPLUS)', () => {
      const result = createInventoryAdjustmentSchema.safeParse({
        branchId: validBranchId,
        warehouseId: validWhId,
        type: 'FOUND_SURPLUS',
        reason: 'Excedente encontrado en tarima durante conteo cíclico',
        items: [
          {
            productId: validProductId,
            movementType: 'ADJUST_IN',
            quantity: 12,
            unitCost: 4.8,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar un ajuste con lista de ítems vacía', () => {
      const result = createInventoryAdjustmentSchema.safeParse({
        branchId: validBranchId,
        warehouseId: validWhId,
        type: 'PHYSICAL_COUNT',
        reason: 'Corrección de inventario',
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it('debe rechazar un ajuste con cantidad no positiva o costo negativo', () => {
      const result = createInventoryAdjustmentSchema.safeParse({
        branchId: validBranchId,
        warehouseId: validWhId,
        type: 'DAMAGE_SPOILED',
        reason: 'Prueba de rechazo',
        items: [
          {
            productId: validProductId,
            movementType: 'ADJUST_OUT',
            quantity: -3,
            unitCost: -5.0,
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Validación de Esquema de Traslados entre Depósitos', () => {
    const validOriginBranch = '11111111-1111-1111-1111-111111111111';
    const validDestBranch = '22222222-2222-2222-2222-222222222222';
    const validOriginWh = '33333333-3333-3333-3333-333333333333';
    const validDestWh = '44444444-4444-4444-4444-444444444444';
    const validProductId = '55555555-5555-5555-5555-555555555555';

    it('debe validar un traslado inter-depósitos en estado IN_TRANSIT', () => {
      const result = createInventoryTransferSchema.safeParse({
        originBranchId: validOriginBranch,
        originWarehouseId: validOriginWh,
        destinationBranchId: validDestBranch,
        destinationWarehouseId: validDestWh,
        notes: 'Despacho de reposición a sucursal Las Mercedes',
        items: [
          {
            productId: validProductId,
            quantity: 20,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar un traslado si el depósito de origen y destino son idénticos', () => {
      const result = createInventoryTransferSchema.safeParse({
        originBranchId: validOriginBranch,
        originWarehouseId: validOriginWh,
        destinationBranchId: validOriginBranch,
        destinationWarehouseId: validOriginWh, // Mismo depósito
        notes: 'Traslado inválido',
        items: [
          {
            productId: validProductId,
            quantity: 10,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('debe validar la confirmación de recepción de traslado', () => {
      const validReceive = receiveInventoryTransferSchema.safeParse({
        transferId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        notes: 'Recibido conforme en piso de venta',
      });
      expect(validReceive.success).toBe(true);
    });

    it('debe rechazar confirmación de recepción con UUID inválido', () => {
      const invalidReceive = receiveInventoryTransferSchema.safeParse({
        transferId: 'non-uuid-transfer-id',
      });
      expect(invalidReceive.success).toBe(false);
    });
  });

  describe('Validación de Filtros de Kardex', () => {
    it('debe validar filtros opcionales de producto, depósito y rango de fechas', () => {
      const result = kardexFilterSchema.safeParse({
        productId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        warehouseId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        limit: 50,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });
  });
});
