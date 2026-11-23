import { z } from 'zod';

export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  rif: z.string().min(6, 'El RIF debe tener al menos 6 caracteres (ej. J-12345678-9)'),
  name: z.string().min(2, 'La razón social o nombre es requerido'),
  commercialName: z.string().optional().or(z.literal('')),
  fiscalAddress: z.string().optional().or(z.literal('')),
  contactName: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
  isPersonNatural: z.boolean().default(false),
  isResident: z.boolean().default(true),
  islrConceptCode: z.string().optional().or(z.literal('')),
  creditLimit: z.number().min(0, 'El límite de crédito no puede ser negativo').default(0),
  paymentTermsDays: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  // Datos bancarios
  bankName: z.string().optional().or(z.literal('')).nullable(),
  accountNumber: z.string().optional().or(z.literal('')).nullable(),
  accountType: z.string().optional().or(z.literal('')).nullable(),
  accountHolderName: z.string().optional().or(z.literal('')).nullable(),
  accountHolderId: z.string().optional().or(z.literal('')).nullable(),
  pagoMovilBank: z.string().optional().or(z.literal('')).nullable(),
  pagoMovilPhone: z.string().optional().or(z.literal('')).nullable(),
  pagoMovilId: z.string().optional().or(z.literal('')).nullable(),
  zelleEmail: z.string().optional().or(z.literal('')).nullable(),
  zelleHolderName: z.string().optional().or(z.literal('')).nullable(),
  bankNotes: z.string().optional().or(z.literal('')).nullable(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplierBankAccountSchema = z.object({
  id: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  bankName: z.string().min(1, 'El nombre del banco es requerido'),
  accountNumber: z.string().min(5, 'Número de cuenta inválido'),
  accountType: z.string().default('CURRENT'),
  currency: z.enum(['VES', 'USD']).default('VES'),
  accountHolderName: z.string().optional().or(z.literal('')).nullable(),
  accountHolderId: z.string().optional().or(z.literal('')).nullable(),
  pagoMovilPhone: z.string().optional().or(z.literal('')).nullable(),
  isPreferred: z.boolean().default(false),
  notes: z.string().optional().or(z.literal('')).nullable(),
});

export type SupplierBankAccountInput = z.infer<typeof supplierBankAccountSchema>;

export const supplierProductSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  supplierProductCode: z.string().optional().or(z.literal('')),
  costPriceUsd: z.number().min(0, 'El costo no puede ser negativo').default(0),
  deliveryLeadTimeDays: z.number().int().min(0).default(0),
  isPreferred: z.boolean().default(false),
  notes: z.string().optional().or(z.literal('')),
});

export type SupplierProductInput = z.infer<typeof supplierProductSchema>;

export const createPayablePaymentSchema = z.object({
  payableId: z.string().uuid('ID de cuenta por pagar inválido'),
  amount: z.number().positive('El monto a pagar debe ser mayor a 0'),
  currency: z.enum(['USD', 'VES']).default('USD'),
  paymentMethod: z.enum([
    'TRANSFER_VES',
    'TRANSFER_USD',
    'CASH_USD',
    'CASH_VES',
    'PAGO_MOVIL',
    'ZELLE',
  ]),
  exchangeRate: z.number().positive().default(1),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  bankAccountId: z.string().uuid().optional().nullable(),
});

export type CreatePayablePaymentInput = z.infer<typeof createPayablePaymentSchema>;

export const purchaseInvoiceItemSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitPrice: z.number().positive('El costo unitario debe ser mayor a 0'),
  taxRate: z.number().min(0).default(16),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const createPurchaseInvoiceSchema = z.object({
  branchId: z.string().uuid('ID de sucursal inválido'),
  warehouseId: z.string().uuid('ID de almacén inválido'),
  supplierId: z.string().uuid('ID de proveedor inválido'),
  invoiceNumber: z.string().min(1, 'El número de factura es obligatorio'),
  controlNumber: z.string().optional(),
  invoiceDate: z.string().default(() => new Date().toISOString()),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.number().positive().default(1),
  isCredit: z.boolean().default(false),
  paymentTermsDays: z.number().int().min(0).default(0),
  items: z.array(purchaseInvoiceItemSchema).min(1, 'Debe incluir al menos un producto'),
});

export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>;
