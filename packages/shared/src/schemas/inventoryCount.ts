import { z } from 'zod';
import { entityId, optionalEntityId, coerceNumber, coerceBoolean } from './inventory';

// ==========================================
// Enumeraciones y Estados de Conteo
// ==========================================

export type InventoryCountStatus = 'IN_PROGRESS' | 'COMPLETED' | 'APPLIED' | 'CANCELLED';
export type InventoryCountType = 'GENERAL' | 'CYCLIC' | 'PARTIAL';
export type InventoryCountItemStatus = 'PENDING' | 'MATCH' | 'SURPLUS' | 'SHORTAGE';

export const inventoryCountStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED', 'APPLIED', 'CANCELLED']);
export const inventoryCountTypeSchema = z.enum(['GENERAL', 'CYCLIC', 'PARTIAL']);
export const inventoryCountItemStatusSchema = z.enum(['PENDING', 'MATCH', 'SURPLUS', 'SHORTAGE']);

// ==========================================
// Consulta de Stock de Productos por Depósito
// ==========================================

export const warehouseStockFilterSchema = z.object({
  branchId: entityId('ID de sucursal requerido'),
  warehouseId: entityId('ID de depósito requerido'),
  departmentId: optionalEntityId,
  groupId: optionalEntityId,
  subgroupId: optionalEntityId,
  search: z.string().optional(),
  stockFilter: z.enum(['ALL', 'WITH_STOCK', 'ZERO_STOCK', 'NEGATIVE_STOCK']).default('ALL'),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(100),
});

export type WarehouseStockFilterInput = z.infer<typeof warehouseStockFilterSchema>;

export interface WarehouseProductStockItem {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  subgroupId?: string | null;
  subgroupName?: string | null;
  brand?: string | null;
  unitOfMeasure: string;
  costPrice: number;
  basePrice: number;
  currency: string;
  taxRate: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  aisle?: string | null;
  shelf?: string | null;
  compartment?: string | null;
  totalCostValuation: number;
  totalSaleValuation: number;
}

// ==========================================
// Renglón de Conteo Físico
// ==========================================

export const countItemInputSchema = z.object({
  productId: entityId('ID de producto requerido'),
  systemStock: coerceNumber(0),
  countedStock: z.number().nullable().optional(),
  notes: z.string().max(255).optional().nullable(),
});

export type CountItemInput = z.infer<typeof countItemInputSchema>;

export interface InventoryCountItem {
  id: string;
  countId: string;
  productId: string;
  sku: string;
  barcode?: string | null;
  productName: string;
  unitOfMeasure: string;
  departmentName?: string | null;
  aisle?: string | null;
  shelf?: string | null;
  compartment?: string | null;
  systemStock: number;
  countedStock: number | null;
  difference: number | null;
  unitCost: number;
  costImpact: number;
  status: InventoryCountItemStatus;
  notes?: string | null;
  countedAt?: string | null;
  countedBy?: string | null;
  countedByName?: string | null;
}

// ==========================================
// Creación de Sesión de Conteo
// ==========================================

export const createInventoryCountSchema = z.object({
  branchId: entityId('ID de sucursal requerido'),
  warehouseId: entityId('ID de depósito requerido'),
  title: z.string().min(3, 'El título del conteo debe tener al menos 3 caracteres').max(150),
  countType: inventoryCountTypeSchema.default('GENERAL'),
  blindCount: coerceBoolean(false),
  departmentId: optionalEntityId,
  groupId: optionalEntityId,
  subgroupId: optionalEntityId,
  notes: z.string().max(500).optional().nullable(),
  items: z.array(countItemInputSchema).optional(),
});

export type CreateInventoryCountInput = z.infer<typeof createInventoryCountSchema>;

// ==========================================
// Actualización de Ítems de Conteo
// ==========================================

export const updateCountItemSchema = z.object({
  countedStock: z.number().min(0, 'El conteo físico no puede ser negativo'),
  notes: z.string().max(255).optional().nullable(),
});

export type UpdateCountItemInput = z.infer<typeof updateCountItemSchema>;

export const batchUpdateCountItemsSchema = z.object({
  items: z.array(
    z.object({
      productId: entityId(),
      countedStock: z.number().min(0),
      notes: z.string().max(255).optional().nullable(),
    })
  ).min(1, 'Debe enviar al menos un ítem para actualizar'),
});

export type BatchUpdateCountItemsInput = z.infer<typeof batchUpdateCountItemsSchema>;

// ==========================================
// Escaneo Rápido de Código de Barras / SKU
// ==========================================

export const scanProductBarcodeSchema = z.object({
  barcodeOrSku: z.string().min(1, 'Código de barras o SKU requerido'),
  incrementBy: z.number().default(1),
  setExactQuantity: z.number().optional(),
});

export type ScanProductBarcodeInput = z.infer<typeof scanProductBarcodeSchema>;

// ==========================================
// Conciliación y Aplicación de Ajuste
// ==========================================

export const reconcileInventoryCountSchema = z.object({
  reason: z.string().min(3, 'Debe especificar el motivo del ajuste contable').max(255).default('Ajuste por toma física y auditoría de inventario'),
  notes: z.string().max(500).optional().nullable(),
});

export type ReconcileInventoryCountInput = z.infer<typeof reconcileInventoryCountSchema>;

// ==========================================
// Cabecera de Conteo de Inventario
// ==========================================

export interface InventoryCount {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  countNumber: string;
  title: string;
  status: InventoryCountStatus;
  countType: InventoryCountType;
  departmentId?: string | null;
  departmentName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  subgroupId?: string | null;
  subgroupName?: string | null;
  blindCount: boolean;
  totalProducts: number;
  totalCounted: number;
  totalMatched: number;
  totalDiscrepancies: number;
  totalSurplusCost: number;
  totalShortageCost: number;
  netCostImpact: number;
  adjustmentId?: string | null;
  adjustmentNumber?: string | null;
  createdBy: string;
  createdByName?: string | null;
  notes?: string | null;
  startedAt: string;
  completedAt?: string | null;
  appliedAt?: string | null;
  items?: InventoryCountItem[];
}
