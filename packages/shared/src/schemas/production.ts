import { z } from 'zod';
import { entityId, optionalEntityId, coerceNumber } from './inventory';

export const PRODUCTION_PROCESS_TYPES = [
  'WHOLE_CARCASS',
  'PARTIAL_EXTRACTION',
  'SUBDIVISION',
  'TRANSFORMATION',
] as const;

export const PRODUCTION_OUTPUT_TYPES = ['INTERMEDIATE', 'FINAL_CUT'] as const;
export const COST_ALLOCATION_METHODS = ['BY_WEIGHT', 'EQUAL_UNIT'] as const;

export const wasteReasonSchema = z.object({
  code: z.string().min(2, 'Código requerido').max(30),
  name: z.string().min(2, 'Nombre del motivo requerido').max(120),
  affectsCost: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export type WasteReasonInput = z.infer<typeof wasteReasonSchema>;

export const updateWasteReasonSchema = wasteReasonSchema.partial();
export type UpdateWasteReasonInput = z.infer<typeof updateWasteReasonSchema>;

export const productWasteConfigSchema = z.object({
  allowsWaste: z.boolean(),
  isButcheryBase: z.boolean(),
  isButcheryYield: z.boolean(),
  expectedWastePct: coerceNumber(0).refine((v) => v >= 0 && v <= 100, {
    message: 'El porcentaje esperado debe estar entre 0 y 100',
  }),
});

export type ProductWasteConfigInput = z.infer<typeof productWasteConfigSchema>;

export const productionOutputItemSchema = z.object({
  productId: entityId('Producto derivado inválido'),
  outputType: z.enum(PRODUCTION_OUTPUT_TYPES).default('FINAL_CUT'),
  quantity: coerceNumber(0).refine((v) => v > 0, {
    message: 'La cantidad/peso del derivado debe ser mayor a cero',
  }),
  notes: z.string().max(255).optional().nullable(),
});

export type ProductionOutputItemInput = z.infer<typeof productionOutputItemSchema>;

export const createProductionOrderSchema = z.object({
  warehouseId: entityId('Almacén requerido'),
  branchId: optionalEntityId,
  processType: z.enum(PRODUCTION_PROCESS_TYPES).default('WHOLE_CARCASS'),
  parentOrderId: optionalEntityId,
  sourceProductId: entityId('Producto base requerido'),
  sourceQuantity: coerceNumber(0).refine((v) => v > 0, {
    message: 'La cantidad/peso a procesar debe ser mayor a cero',
  }),
  wasteQuantity: coerceNumber(0).refine((v) => v >= 0, {
    message: 'La merma no puede ser negativa',
  }),
  wasteReasonId: optionalEntityId,
  costAllocationMethod: z.enum(COST_ALLOCATION_METHODS).default('BY_WEIGHT'),
  notes: z.string().max(500).optional().nullable(),
  processImmediately: z.boolean().default(true),
  outputs: z.array(productionOutputItemSchema).min(1, 'Debe agregar al menos un producto derivado'),
});

export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>;

export const registerDirectWasteSchema = z.object({
  warehouseId: entityId('Almacén requerido'),
  productId: entityId('Producto requerido'),
  quantity: coerceNumber(0).refine((v) => v > 0, {
    message: 'La cantidad de merma debe ser mayor a cero',
  }),
  wasteReasonId: entityId('Motivo de merma requerido'),
  notes: z.string().max(500).optional().nullable(),
});

export type RegisterDirectWasteInput = z.infer<typeof registerDirectWasteSchema>;
