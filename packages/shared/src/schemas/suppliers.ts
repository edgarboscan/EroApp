import { z } from 'zod';

export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  rif: z.string().min(6, 'El RIF debe tener al menos 6 caracteres (ej. J-12345678-9)'),
  name: z.string().min(2, 'La razón social o nombre es requerido'),
  fiscalAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
  isPersonNatural: z.boolean().default(false),
  isResident: z.boolean().default(true),
  islrConceptCode: z.string().optional(),
  creditLimit: z.number().min(0, 'El límite de crédito no puede ser negativo').default(0),
  paymentTermsDays: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

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
