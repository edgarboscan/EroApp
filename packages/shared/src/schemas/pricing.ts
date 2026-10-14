import { z } from 'zod';
import { BULK_PRICE_UPDATE_MODES, PRICE_MODES } from '../constants';

// Criterios de Selección para Actualización Masiva
export const bulkPriceUpdateCriteriaSchema = z.object({
  productType: z.enum(['all', 'physical', 'service', 'kit', 'raw_material']).optional().default('all'),
  supplierIds: z.array(z.string().uuid()).optional(),
  departmentIds: z.array(z.string().uuid()).optional(),
  groupIds: z.array(z.string().uuid()).optional(),
  subgroupIds: z.array(z.string().uuid()).optional(),
  brands: z.array(z.string()).optional(),
  minCurrentPrice: z.number().min(0).optional(),
  maxCurrentPrice: z.number().min(0).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
  priceListId: z.string().uuid().optional(),
  searchQuery: z.string().optional(),
});

export type BulkPriceUpdateCriteria = z.infer<typeof bulkPriceUpdateCriteriaSchema>;

// Reglas de Modificación
export const bulkPriceUpdateActionSchema = z.object({
  mode: z.nativeEnum(BULK_PRICE_UPDATE_MODES),
  value: z.number(), // Porcentaje (+/- 10), Monto (+/- 5.5), Nuevo Precio Fijo, o Margen %
  roundingRule: z.number().default(0), // 0, 0.05, 0.10, 0.50, 1.00
  
  // Reglas Tributarias y de Precio Final
  taxAffectsFinalPrice: z.boolean().default(false), // true: incrementa PVP; false: se absorbe en el margen
  priceMode: z.nativeEnum(PRICE_MODES).default(PRICE_MODES.TAX_EXCLUSIVE),
  
  // Ámbito de aplicación
  applyScope: z.enum(['product', 'department', 'group', 'subgroup', 'supplier', 'branch', 'global']).default('global'),
  
  // Programación
  effectiveDate: z.string().datetime().optional().nullable(),
  isScheduled: z.boolean().default(false),
  requireApproval: z.boolean().default(false),
  reason: z.string().min(3).max(255),
});

export type BulkPriceUpdateAction = z.infer<typeof bulkPriceUpdateActionSchema>;

// Payload Completo del Wizard de Cambio Masivo
export const bulkPriceUpdateRequestSchema = z.object({
  criteria: bulkPriceUpdateCriteriaSchema,
  action: bulkPriceUpdateActionSchema,
});

export type BulkPriceUpdateRequest = z.infer<typeof bulkPriceUpdateRequestSchema>;

// Tasas de Impuestos y Cambio de Tasa con Impacto
export const taxRateSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(100),
  rate: z.number().min(0).max(100), // Ej: 16.00, 8.00, 3.00
  type: z.enum(['IVA', 'IGTF', 'ISLR', 'MUNICIPAL', 'EXENTO', 'EXONERADO']),
  isActive: z.boolean().default(true),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
});

export type TaxRateInput = z.infer<typeof taxRateSchema>;

export const applyTaxRateChangeSchema = z.object({
  taxRateId: z.string().uuid(),
  newRate: z.number().min(0).max(100),
  taxAffectsFinalPrice: z.boolean(),
  priceMode: z.nativeEnum(PRICE_MODES),
  applyScope: z.enum(['product', 'department', 'group', 'subgroup', 'supplier', 'branch', 'global']),
  scopeRefId: z.string().uuid().optional().nullable(),
  effectiveDate: z.string().datetime().optional().nullable(),
  reason: z.string().min(3).max(255),
});

export type ApplyTaxRateChangeInput = z.infer<typeof applyTaxRateChangeSchema>;
