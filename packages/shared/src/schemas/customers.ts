import { z } from 'zod';

export const customerSchema = z.object({
  id: z.string().min(1).optional(),
  docType: z.enum(['V', 'E', 'J', 'G', 'P']).default('V'),
  docNumber: z.string().min(3, 'El documento debe tener al menos 3 caracteres'),
  name: z.string().min(2, 'El nombre o razón social es requerido'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
  isSpecialTaxpayer: z.boolean().default(false),
  creditEnabled: z.boolean().default(false),
  creditLimit: z.number().min(0, 'El límite de crédito no puede ser negativo').default(0),
  paymentTermsDays: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const createCollectionSchema = z.object({
  receivableId: z.string().uuid('ID de cuenta por cobrar inválido'),
  amount: z.number().positive('El monto a cobrar debe ser mayor a 0'),
  currency: z.enum(['USD', 'VES']).default('USD'),
  paymentMethod: z.enum([
    'CASH_USD',
    'CASH_VES',
    'PAGO_MOVIL',
    'DEBIT_CARD',
    'ZELLE',
    'TRANSFER',
  ]),
  exchangeRate: z.number().positive().default(1),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
