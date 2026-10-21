import { z } from 'zod';

// ==========================================
// Helpers de Identificadores y Coacción Robusta (MySQL CHAR 36)
// Admite UUIDs RFC 4122 y llaves semánticas de semillas (w1111111..., g1111111..., etc.)
// ==========================================

const emptyStringToNull = (val: unknown) => (typeof val === 'string' && val.trim() === '' ? null : val);
export const entityId = (msg: string = 'ID requerido') => z.string().regex(/^[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}$/, msg);
export const optionalEntityId = z.preprocess(emptyStringToNull, z.string().regex(/^[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}$/, 'ID inválido').optional().nullable());
export const coerceNumber = (def: number = 0) => z.preprocess((val) => (val === '' || val === null || val === undefined ? def : Number(val)), z.number());
export const coerceOptionalNumber = z.preprocess((val) => (val === '' || val === null || val === undefined ? null : Number(val)), z.number().optional().nullable());
export const coerceBoolean = (def: boolean = false) => z.preprocess((val) => (val === undefined ? def : Boolean(val)), z.boolean());

// ==========================================
// Jerarquía: Departamento -> Grupo -> Subgrupo
// ==========================================

export const departmentSchema = z.object({
  id: optionalEntityId,
  companyId: optionalEntityId,
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;

export const updateDepartmentSchema = departmentSchema.partial();
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const groupSchema = z.object({
  id: optionalEntityId,
  departmentId: entityId('ID de departamento requerido'),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type GroupInput = z.infer<typeof groupSchema>;

export const updateGroupSchema = groupSchema.partial();
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const subgroupSchema = z.object({
  id: optionalEntityId,
  groupId: entityId('ID de grupo requerido'),
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
  id: optionalEntityId,
  productId: optionalEntityId,
  warehouseId: entityId('ID de depósito requerido'),
  aisle: z.preprocess(emptyStringToNull, z.string().max(30).optional().nullable()), // Pasillo
  shelf: z.preprocess(emptyStringToNull, z.string().max(30).optional().nullable()), // Estante
  compartment: z.preprocess(emptyStringToNull, z.string().max(30).optional().nullable()), // Compartimiento
  notes: z.preprocess(emptyStringToNull, z.string().max(255).optional().nullable()),
});

export type ProductLocationInput = z.infer<typeof productLocationSchema>;

export const warehouseLocationSchema = z.object({
  id: optionalEntityId,
  warehouseId: entityId('ID de depósito requerido'),
  productId: optionalEntityId,
  aisle: z.string().min(1, 'El pasillo es requerido').max(30),
  shelf: z.preprocess(emptyStringToNull, z.string().max(30).optional().nullable()),
  compartment: z.preprocess(emptyStringToNull, z.string().max(30).optional().nullable()),
  notes: z.preprocess(emptyStringToNull, z.string().max(255).optional().nullable()),
});

export type WarehouseLocationInput = z.infer<typeof warehouseLocationSchema>;

export const updateWarehouseLocationSchema = warehouseLocationSchema.partial();
export type UpdateWarehouseLocationInput = z.infer<typeof updateWarehouseLocationSchema>;

// ==========================================
// Producto Completo con Jerarquía y Precios
// ==========================================

export const productSchema = z.object({
  id: optionalEntityId,
  companyId: optionalEntityId,
  sku: z.string().min(1, 'El código SKU es requerido').max(50),
  barcode: z.preprocess(emptyStringToNull, z.string().max(50).optional().nullable()),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  description: z.preprocess(emptyStringToNull, z.string().optional().nullable()),
  productType: z.enum(['physical', 'service', 'kit', 'raw_material']).default('physical'),
  
  // Jerarquía
  departmentId: optionalEntityId,
  groupId: optionalEntityId,
  subgroupId: optionalEntityId,
  
  supplierId: optionalEntityId,
  brand: z.preprocess(emptyStringToNull, z.string().max(60).optional().nullable()),
  unitOfMeasure: z.string().max(10).default('UND'),
  
  // Costos y Precios Base
  costPrice: coerceNumber(0),
  basePrice: coerceNumber(0),
  currency: z.enum(['USD', 'VES']).default('USD'),
  
  // Impuestos
  defaultTaxRateId: optionalEntityId,
  taxInclusive: coerceBoolean(false),
  
  // Control de Stock
  minStock: coerceNumber(0),
  maxStock: coerceNumber(0),
  hasBatches: coerceBoolean(false),
  hasSerials: coerceBoolean(false),
  isActive: coerceBoolean(true),
  
  // Ubicaciones iniciales opcionales
  locations: z.array(productLocationSchema.omit({ id: true, productId: true })).optional(),

  // Múltiples SKUs por producto con precio específico opcional
  skus: z.array(z.object({
    id: optionalEntityId,
    sku: z.string().min(1, 'El código SKU es requerido').max(50),
    barcode: z.preprocess(emptyStringToNull, z.string().max(50).optional().nullable()),
    description: z.preprocess(emptyStringToNull, z.string().max(150).optional().nullable()),
    isPrimary: coerceBoolean(false),
    costPrice: coerceOptionalNumber,
    price: coerceOptionalNumber,
    currency: z.enum(['USD', 'VES']).default('USD'),
  })).optional(),

  // Presentaciones por producto con diferentes factores y precios
  presentations: z.array(z.object({
    id: optionalEntityId,
    presentationId: optionalEntityId,
    name: z.string().min(1, 'El nombre de la presentación es requerido').max(100),
    sku: z.preprocess(emptyStringToNull, z.string().max(50).optional().nullable()),
    barcode: z.preprocess(emptyStringToNull, z.string().max(50).optional().nullable()),
    unitOfMeasure: z.string().max(20).default('UND'),
    multiplier: coerceNumber(1),
    costPrice: coerceNumber(0),
    basePrice: coerceNumber(0),
    currency: z.enum(['USD', 'VES']).default('USD'),
    isDefault: coerceBoolean(false),
    requiresAuthorization: coerceBoolean(false),
    isActive: coerceBoolean(true),
  })).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export const updateProductSchema = productSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ==========================================
// Marcas de Productos
// ==========================================
export const brandSchema = z.object({
  id: optionalEntityId,
  companyId: optionalEntityId,
  name: z.string().min(1, 'El nombre de la marca es requerido').max(100),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type BrandInput = z.infer<typeof brandSchema>;
export const updateBrandSchema = brandSchema.partial();
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

// ==========================================
// Unidades de Medida
// ==========================================
export const unitOfMeasureSchema = z.object({
  id: optionalEntityId,
  companyId: optionalEntityId,
  code: z.string().min(1, 'El código es requerido').max(20),
  name: z.string().min(1, 'El nombre es requerido').max(100),
  symbol: z.string().max(10).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type UnitOfMeasureInput = z.infer<typeof unitOfMeasureSchema>;
export const updateUnitOfMeasureSchema = unitOfMeasureSchema.partial();
export type UpdateUnitOfMeasureInput = z.infer<typeof updateUnitOfMeasureSchema>;

// ==========================================
// Catálogo Maestro de Presentaciones
// ==========================================
export const presentationSchema = z.object({
  id: optionalEntityId,
  companyId: optionalEntityId,
  name: z.string().min(1, 'El nombre de la presentación es requerido').max(100),
  description: z.string().max(255).optional().nullable(),
  defaultMultiplier: z.number().positive('El multiplicador debe ser mayor a 0').default(1),
  defaultUnit: z.string().max(20).default('UND'),
  requiresAuthorization: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type PresentationInput = z.infer<typeof presentationSchema>;
export const updatePresentationSchema = presentationSchema.partial();
export type UpdatePresentationInput = z.infer<typeof updatePresentationSchema>;

// ==========================================
// SKUs individuales y Presentaciones individuales
// ==========================================
export const productSkuSchema = z.object({
  id: optionalEntityId,
  productId: entityId('ID de producto requerido'),
  sku: z.string().min(1, 'El código SKU es requerido').max(50),
  barcode: z.string().max(50).optional().nullable(),
  description: z.string().max(150).optional().nullable(),
  isPrimary: z.boolean().default(false),
  costPrice: z.number().min(0).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  currency: z.enum(['USD', 'VES']).default('USD'),
});
export type ProductSkuInput = z.infer<typeof productSkuSchema>;

export const productPresentationSchema = z.object({
  id: optionalEntityId,
  productId: entityId('ID de producto requerido'),
  presentationId: optionalEntityId,
  name: z.string().min(1, 'El nombre de la presentación es requerido').max(100),
  sku: z.string().max(50).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
  unitOfMeasure: z.string().max(20).default('UND'),
  multiplier: z.number().positive().default(1),
  costPrice: z.number().min(0).default(0),
  basePrice: z.number().min(0).default(0),
  currency: z.enum(['USD', 'VES']).default('USD'),
  isDefault: z.boolean().default(false),
  requiresAuthorization: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type ProductPresentationInput = z.infer<typeof productPresentationSchema>;

// ==========================================
// Control de Lotes y Vencimientos
// ==========================================
export const productLotSchema = z.object({
  id: optionalEntityId,
  companyId: optionalEntityId,
  productId: entityId('ID de producto requerido'),
  warehouseId: entityId('ID de depósito requerido'),
  lotNumber: z.string().min(1, 'El número de lote es requerido').max(50),
  manufacturingDate: z.preprocess(emptyStringToNull, z.string().optional().nullable()),
  expirationDate: z.string().min(1, 'La fecha de vencimiento es requerida'),
  initialQuantity: coerceNumber(0),
  currentQuantity: coerceNumber(0),
  reservedQuantity: coerceNumber(0),
  costPrice: coerceNumber(0),
  status: z.enum(['ACTIVE', 'EXPIRED', 'DEPLETED', 'QUARANTINE']).default('ACTIVE'),
  notes: z.preprocess(emptyStringToNull, z.string().max(255).optional().nullable()),
  adjustStock: coerceBoolean(false), // Si true, sincroniza e incrementa la existencia en product_stocks
});
export type ProductLotInput = z.infer<typeof productLotSchema>;

// ==========================================
// Ajustes y Movimientos Kardex
// ==========================================

export const inventoryMovementSchema = z.object({
  branchId: entityId('ID de sucursal requerido'),
  warehouseId: entityId('ID de depósito requerido'),
  productId: entityId('ID de producto requerido'),
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
  productId: entityId('ID de producto requerido'),
  movementType: z.enum(['ADJUST_IN', 'ADJUST_OUT']),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.number().min(0).default(0),
  notes: z.string().max(255).optional().nullable(),
});

export const createInventoryAdjustmentSchema = z.object({
  branchId: entityId('ID de sucursal requerido'),
  warehouseId: entityId('ID de depósito requerido'),
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
  productId: entityId('ID de producto requerido'),
  quantity: z.number().positive('La cantidad a trasladar debe ser mayor a 0'),
  notes: z.string().max(255).optional().nullable(),
});

export const createInventoryTransferSchema = z.object({
  originBranchId: entityId('ID de sucursal origen requerido'),
  originWarehouseId: entityId('ID de depósito origen requerido'),
  destinationBranchId: entityId('ID de sucursal destino requerido'),
  destinationWarehouseId: entityId('ID de depósito destino requerido'),
  notes: z.string().max(255).optional().nullable(),
  items: z.array(inventoryTransferItemSchema).min(1, 'Debe incluir al menos un producto en el traslado'),
}).refine((data) => data.originWarehouseId !== data.destinationWarehouseId, {
  message: 'El depósito de origen y el depósito de destino no pueden ser iguales',
  path: ['destinationWarehouseId'],
});

export type CreateInventoryTransferInput = z.infer<typeof createInventoryTransferSchema>;

export const receiveInventoryTransferSchema = z.object({
  transferId: entityId('ID de traslado requerido'),
  notes: z.string().max(255).optional().nullable(),
  items: z.array(z.object({
    productId: entityId(),
    quantityReceived: z.number().min(0, 'La cantidad recibida no puede ser negativa'),
  })).optional(),
});

export type ReceiveInventoryTransferInput = z.infer<typeof receiveInventoryTransferSchema>;

// ==========================================
// Filtros de Kardex
// ==========================================
export const kardexFilterSchema = z.object({
  productId: optionalEntityId,
  warehouseId: optionalEntityId,
  branchId: optionalEntityId,
  movementType: z.enum(['IN', 'OUT', 'ADJUST_IN', 'ADJUST_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'PURCHASE']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

export type KardexFilterInput = z.infer<typeof kardexFilterSchema>;
