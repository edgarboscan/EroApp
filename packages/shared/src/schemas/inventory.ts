import { z } from 'zod';

// ==========================================
// Jerarquía: Departamento -> Grupo -> Subgrupo
// ==========================================

export const departmentSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;

export const updateDepartmentSchema = departmentSchema.partial();
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const groupSchema = z.object({
  id: z.string().uuid().optional(),
  departmentId: z.string().uuid('ID de departamento requerido'),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type GroupInput = z.infer<typeof groupSchema>;

export const updateGroupSchema = groupSchema.partial();
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const subgroupSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid('ID de grupo requerido'),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type SubgroupInput = z.infer<typeof subgroupSchema>;

export const updateSubgroupSchema = subgroupSchema.partial();
export type UpdateSubgroupInput = z.infer<typeof updateSubgroupSchema>;

// ==========================================
// Ubicación Física Opcional / Por Depósito
// ==========================================

export const productLocationSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid('ID de producto requerido'),
  warehouseId: z.string().uuid('ID de depósito requerido'),
  aisle: z.string().max(30).optional().nullable(), // Pasillo
  shelf: z.string().max(30).optional().nullable(), // Estante
  compartment: z.string().max(30).optional().nullable(), // Compartimiento
  notes: z.string().max(255).optional().nullable(),
});

export type ProductLocationInput = z.infer<typeof productLocationSchema>;

export const warehouseLocationSchema = z.object({
  id: z.string().uuid().optional(),
  warehouseId: z.string().uuid('ID de depósito requerido'),
  productId: z.string().uuid().optional().nullable(),
  aisle: z.string().min(1, 'El pasillo es requerido').max(30),
  shelf: z.string().max(30).optional().nullable(),
  compartment: z.string().max(30).optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
});

export type WarehouseLocationInput = z.infer<typeof warehouseLocationSchema>;

export const updateWarehouseLocationSchema = warehouseLocationSchema.partial();
export type UpdateWarehouseLocationInput = z.infer<typeof updateWarehouseLocationSchema>;

// ==========================================
// Producto Completo con Jerarquía y Precios
// ==========================================

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional().nullable(),
  name: z.string().min(2).max(150),
  description: z.string().optional().nullable(),
  productType: z.enum(['physical', 'service', 'kit', 'raw_material']).default('physical'),
  
  // Jerarquía
  departmentId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  subgroupId: z.string().uuid().optional().nullable(),
  
  supplierId: z.string().uuid().optional().nullable(),
  brand: z.string().max(60).optional().nullable(),
  unitOfMeasure: z.string().max(10).default('UND'),
  
  // Costos y Precios Base
  costPrice: z.number().min(0).default(0),
  basePrice: z.number().min(0).default(0),
  currency: z.enum(['USD', 'VES']).default('USD'),
  
  // Impuestos
  defaultTaxRateId: z.string().uuid().optional().nullable(),
  taxInclusive: z.boolean().default(false),
  
  // Control de Stock
  minStock: z.number().min(0).default(0),
  maxStock: z.number().min(0).default(0),
  hasBatches: z.boolean().default(false),
  hasSerials: z.boolean().default(false),
  isActive: z.boolean().default(true),
  
  // Ubicaciones iniciales opcionales
  locations: z.array(productLocationSchema.omit({ id: true, productId: true })).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export const updateProductSchema = productSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ==========================================
// Ajustes y Movimientos Kardex
// ==========================================

export const inventoryMovementSchema = z.object({
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  movementType: z.enum(['IN', 'OUT', 'ADJUST_IN', 'ADJUST_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'PURCHASE']),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  referenceDocument: z.string().max(50).optional(),
  reason: z.string().max(255).optional(),
});

export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;

// ==========================================
// Ajustes de Inventario (Merma / Dañado / Sobrante / Conteo)
// ==========================================
export const inventoryAdjustmentItemSchema = z.object({
  productId: z.string().uuid('ID de producto requerido'),
  movementType: z.enum(['ADJUST_IN', 'ADJUST_OUT']),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.number().min(0).default(0),
  notes: z.string().max(255).optional().nullable(),
});

export const createInventoryAdjustmentSchema = z.object({
  branchId: z.string().uuid('ID de sucursal requerido'),
  warehouseId: z.string().uuid('ID de depósito requerido'),
  type: z.enum([
    'PHYSICAL_COUNT',
    'DAMAGE_SPOILED',
    'THEFT_LOSS',
    'EXPIRED',
    'FOUND_SURPLUS',
    'INTERNAL_CONSUMPTION',
  ]),
  reason: z.string().min(3, 'Debe especificar el motivo del ajuste').max(255),
  items: z.array(inventoryAdjustmentItemSchema).min(1, 'Debe incluir al menos un producto a ajustar'),
});

export type CreateInventoryAdjustmentInput = z.infer<typeof createInventoryAdjustmentSchema>;
export type InventoryAdjustmentItemInput = z.infer<typeof inventoryAdjustmentItemSchema>;

// ==========================================
// Traslados entre Depósitos y Sucursales
// ==========================================
export const inventoryTransferItemSchema = z.object({
  productId: z.string().uuid('ID de producto requerido'),
  quantity: z.number().positive('La cantidad a trasladar debe ser mayor a 0'),
  notes: z.string().max(255).optional().nullable(),
});

export const createInventoryTransferSchema = z.object({
  originBranchId: z.string().uuid('ID de sucursal origen requerido'),
  originWarehouseId: z.string().uuid('ID de depósito origen requerido'),
  destinationBranchId: z.string().uuid('ID de sucursal destino requerido'),
  destinationWarehouseId: z.string().uuid('ID de depósito destino requerido'),
  notes: z.string().max(255).optional().nullable(),
  items: z.array(inventoryTransferItemSchema).min(1, 'Debe incluir al menos un producto en el traslado'),
}).refine((data) => data.originWarehouseId !== data.destinationWarehouseId, {
  message: 'El depósito de origen y el depósito de destino no pueden ser iguales',
  path: ['destinationWarehouseId'],
});

export type CreateInventoryTransferInput = z.infer<typeof createInventoryTransferSchema>;

export const receiveInventoryTransferSchema = z.object({
  transferId: z.string().uuid('ID de traslado requerido'),
  notes: z.string().max(255).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantityReceived: z.number().min(0, 'La cantidad recibida no puede ser negativa'),
  })).optional(),
});

export type ReceiveInventoryTransferInput = z.infer<typeof receiveInventoryTransferSchema>;

// ==========================================
// Filtros de Kardex
// ==========================================
export const kardexFilterSchema = z.object({
  productId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  movementType: z.enum(['IN', 'OUT', 'ADJUST_IN', 'ADJUST_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'PURCHASE']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

export type KardexFilterInput = z.infer<typeof kardexFilterSchema>;
