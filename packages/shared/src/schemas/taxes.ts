import { z } from 'zod';

export const withholdingIVASchema = z.object({
  invoiceId: z.string().uuid(),
  supplierOrCustomerId: z.string().uuid(),
  taxYear: z.number().int().min(2020),
  taxMonth: z.number().int().min(1).max(12),
  fortnight: z.enum(['FIRST', 'SECOND']), // 1ra o 2da quincena
  retainedPercentage: z.number().min(0).max(100), // Comúnmente 75% o 100%
  totalInvoiceAmount: z.number().positive(),
  taxableBaseAmount: z.number().min(0),
  ivaAmount: z.number().min(0),
  ivaRetainedAmount: z.number().min(0),
  voucherNumber: z.string().max(20), // YYYYMM + 8 correlativo
});

export type WithholdingIVAInput = z.infer<typeof withholdingIVASchema>;

export const withholdingISLRSchema = z.object({
  invoiceId: z.string().uuid(),
  supplierId: z.string().uuid(),
  conceptCode: z.string().max(20), // Ej: Honorarios Profesionales, Servicios, etc.
  conceptDescription: z.string().max(255),
  personType: z.enum(['PNR', 'PNNR', 'PJD', 'PJND']), // PN Residente, No Residente, PJ Domiciliada, No Domiciliada
  ratePercentage: z.number().min(0).max(100),
  subtractingFactor: z.number().min(0).default(0), // Sustraendo en UT o Bs
  totalInvoiceAmount: z.number().positive(),
  taxableBaseAmount: z.number().positive(),
  islrRetainedAmount: z.number().min(0),
  voucherNumber: z.string().max(20),
});

export type WithholdingISLRInput = z.infer<typeof withholdingISLRSchema>;

export const emitWithholdingIVASchema = z.object({
  purchaseInvoiceId: z.string().uuid(),
  retainedPercentage: z.number().min(0).max(100).default(75),
  fortnight: z.enum(['FIRST', 'SECOND']).default('FIRST'),
});

export type EmitWithholdingIVAInput = z.infer<typeof emitWithholdingIVASchema>;

export const emitWithholdingISLRSchema = z.object({
  purchaseInvoiceId: z.string().uuid(),
  conceptCode: z.string().min(1).max(20),
  conceptDescription: z.string().min(1).max(255),
  personType: z.enum(['PNR', 'PNNR', 'PJD', 'PJND']).default('PJD'),
  ratePercentage: z.number().min(0).max(100),
  subtractingFactor: z.number().min(0).default(0),
});

export type EmitWithholdingISLRInput = z.infer<typeof emitWithholdingISLRSchema>;

export const STANDARD_ISLR_CONCEPTS = [
  { code: 'SERV_TRANS', name: 'Servicios de Transporte y Fletes', defaultRatePJD: 5.0, defaultRatePNR: 3.0 },
  { code: 'HON_PROF', name: 'Honorarios Profesionales', defaultRatePJD: 5.0, defaultRatePNR: 3.0 },
  { code: 'SERV_PUB', name: 'Servicios Generales y Contratistas', defaultRatePJD: 2.0, defaultRatePNR: 1.0 },
  { code: 'ARREND_INM', name: 'Arrendamiento de Inmuebles Comerciales', defaultRatePJD: 5.0, defaultRatePNR: 3.0 },
  { code: 'COMIS_MERC', name: 'Comisiones Mercantiles', defaultRatePJD: 5.0, defaultRatePNR: 3.0 },
  { code: 'EJEC_OBRA', name: 'Ejecución de Obras Civiles y Construcción', defaultRatePJD: 2.0, defaultRatePNR: 1.0 },
] as const;
