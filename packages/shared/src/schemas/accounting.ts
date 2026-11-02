import { z } from 'zod';

export const AccountTypeEnum = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COST',
  'EXPENSE',
  'ORDER',
]);
export type AccountType = z.infer<typeof AccountTypeEnum>;

export const AccountClassificationEnum = z.enum([
  'CURRENT',
  'NON_CURRENT',
  'OPERATING',
  'FINANCIAL',
  'OTHER',
]);
export type AccountClassification = z.infer<typeof AccountClassificationEnum>;

export const NormalBalanceEnum = z.enum(['DEBIT', 'CREDIT']);
export type NormalBalance = z.infer<typeof NormalBalanceEnum>;

export const EntryTypeEnum = z.enum([
  'STANDARD',
  'OPENING',
  'ADJUSTMENT',
  'EXCHANGE_DIFF',
  'INFLATION_ADJUSTMENT',
  'CLOSING',
]);
export type EntryType = z.infer<typeof EntryTypeEnum>;

export const EntryStatusEnum = z.enum(['DRAFT', 'POSTED', 'ANNULLED']);
export type EntryStatus = z.infer<typeof EntryStatusEnum>;

// Esquema de Creación / Actualización de Cuenta Contable
export const accountSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'El código contable es obligatorio'),
  name: z.string().min(2, 'El nombre de la cuenta es requerido'),
  level: z.number().int().min(1).max(6).default(1),
  parentId: z.string().nullable().optional(),
  accountType: AccountTypeEnum,
  classification: AccountClassificationEnum.default('CURRENT'),
  normalBalance: NormalBalanceEnum,
  acceptsPostings: z.boolean().default(false),
  isMonetary: z.boolean().default(true),
  isBankOrCash: z.boolean().default(false),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});
export type AccountInput = z.infer<typeof accountSchema>;

// Línea de Comprobante
export const journalLineSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().min(1, 'La cuenta contable es obligatoria'),
  accountCode: z.string().optional(),
  accountName: z.string().optional(),
  lineOrder: z.number().int().optional(),
  description: z.string().min(1, 'El detalle de la línea es requerido'),
  debitVes: z.number().min(0).default(0),
  creditVes: z.number().min(0).default(0),
  debitUsd: z.number().min(0).default(0),
  creditUsd: z.number().min(0).default(0),
  referenceDoc: z.string().nullable().optional(),
});
export type JournalLineInput = z.infer<typeof journalLineSchema>;

// Comprobante de Diario Completo
export const journalEntrySchema = z.object({
  id: z.string().optional(),
  branchId: z.string().nullable().optional(),
  periodId: z.string().nullable().optional(),
  entryNumber: z.string().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  entryType: EntryTypeEnum.default('STANDARD'),
  concept: z.string().min(3, 'El concepto del asiento es requerido'),
  notes: z.string().nullable().optional(),
  currency: z.enum(['VES', 'USD']).default('VES'),
  exchangeRate: z.number().positive('La tasa de cambio debe ser mayor a 0').default(1),
  lines: z.array(journalLineSchema).min(2, 'Un comprobante contable debe contener al menos dos líneas'),
}).refine((data) => {
  const sumDebitVes = data.lines.reduce((acc, l) => acc + (l.debitVes || 0), 0);
  const sumCreditVes = data.lines.reduce((acc, l) => acc + (l.creditVes || 0), 0);
  // Tolerancia de 0.05 por redondeo decimal
  return Math.abs(sumDebitVes - sumCreditVes) < 0.05;
}, {
  message: 'Partida Doble Descuadrada: La suma de Débitos debe ser exactamente igual a la suma de Créditos en VES',
  path: ['lines'],
});

export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

// Filtros para Balance de Comprobación
export const trialBalanceFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  level: z.coerce.number().int().min(1).max(6).optional().default(4),
  includeZeroBalance: z.coerce.boolean().optional().default(false),
});
export type TrialBalanceFilter = z.infer<typeof trialBalanceFilterSchema>;

// Filtros para Libro Mayor
export const generalLedgerFilterSchema = z.object({
  accountId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type GeneralLedgerFilter = z.infer<typeof generalLedgerFilterSchema>;

// Filtros de Estados Financieros bajo VEN-NIF
export const financialStatementFilterSchema = z.object({
  asOfDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isReexpressed: z.coerce.boolean().optional().default(false), // Ajuste por Inflación VEN-NIF B-10
  targetInpcYear: z.coerce.number().int().optional(),
  targetInpcMonth: z.coerce.number().int().optional(),
});
export type FinancialStatementFilter = z.infer<typeof financialStatementFilterSchema>;

// Entrada para Motor de Ajuste por Inflación
export const inflationAdjustmentProcessSchema = z.object({
  targetYear: z.number().int(),
  targetMonth: z.number().int().min(1).max(12),
  concept: z.string().optional(),
});
export type InflationAdjustmentProcessInput = z.infer<typeof inflationAdjustmentProcessSchema>;

// Entrada para Ajuste por Diferencia en Cambio
export const exchangeDifferenceProcessSchema = z.object({
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rateBcv: z.number().positive(),
  concept: z.string().optional(),
});
export type ExchangeDifferenceProcessInput = z.infer<typeof exchangeDifferenceProcessSchema>;

