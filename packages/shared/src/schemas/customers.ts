import { z } from 'zod';

export const customerRatingTierEnum = z.enum([
  'VIP',
  'EXCELLENT',
  'REGULAR',
  'RISKY',
  'MOROSO',
]);

export type CustomerRatingTier = z.infer<typeof customerRatingTierEnum>;

export const customerSchema = z.object({
  id: z.string().min(1).optional(),
  docType: z.enum(['V', 'E', 'J', 'G', 'P']).default('V'),
  docNumber: z.string().min(3, 'El documento debe tener al menos 3 caracteres'),
  name: z.string().min(2, 'El nombre o razón social es requerido'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')).nullable(),
  isSpecialTaxpayer: z.boolean().default(false),
  creditEnabled: z.boolean().default(false),
  creditLimit: z.coerce.number().min(0, 'El límite de crédito no puede ser negativo').default(0),
  paymentTermsDays: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isBlocked: z.boolean().default(false),
  blockReason: z.string().max(255).optional().nullable(),
  blockedAt: z.string().optional().nullable(),
  ratingScore: z.coerce.number().min(1).max(5).default(5),
  ratingTier: customerRatingTierEnum.default('REGULAR'),
  ratingNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const blockCustomerSchema = z.object({
  isBlocked: z.boolean(),
  blockReason: z.string().max(255).optional().nullable(),
});

export type BlockCustomerInput = z.infer<typeof blockCustomerSchema>;

export const rateCustomerSchema = z.object({
  ratingScore: z.coerce.number().min(1).max(5),
  ratingTier: customerRatingTierEnum,
  ratingNotes: z.string().max(500).optional().nullable(),
});

export type RateCustomerInput = z.infer<typeof rateCustomerSchema>;

export const createCollectionSchema = z.object({
  receivableId: z.string().uuid('ID de cuenta por cobrar inválido'),
  amount: z.number().positive('El monto a cobrar debe ser mayor a 0'),
  currency: z.enum(['USD', 'VES']).default('USD'),
  paymentMethod: z.string().min(1, 'El medio de pago es requerido'),
  bankAccountId: z.string().optional().nullable(),
  exchangeRate: z.number().positive().default(1),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
