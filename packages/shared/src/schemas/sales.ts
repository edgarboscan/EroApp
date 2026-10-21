import { z } from 'zod';

// ==========================================
// Ítems y Creación de Cotizaciones / Presupuestos
// ==========================================
export const quotationItemSchema = z.object({
  productId: z.string().min(1, 'ID de producto requerido'),
  quantity: z.number().positive('La cantidad a cotizar debe ser mayor a 0'),
  unitPrice: z.number().min(0, 'El precio unitario no puede ser negativo'),
  taxRate: z.number().min(0).default(16.0),
  discountPercent: z.number().min(0).max(100).default(0.0),
  notes: z.string().max(255).optional().nullable(),
});

export const createQuotationSchema = z.object({
  branchId: z.string().min(1, 'ID de sucursal requerido'),
  customerId: z.string().min(1, 'ID de cliente requerido'),
  validUntilDate: z.string().min(1, 'Fecha de validez requerida'),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.number().positive('La tasa de cambio debe ser positiva').default(1.0),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(quotationItemSchema).min(1, 'Debe incluir al menos un producto a cotizar'),
});

export type QuotationItemInput = z.infer<typeof quotationItemSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

// ==========================================
// Notas de Entrega / Despachos Físicos
// ==========================================
export const deliveryNoteItemSchema = z.object({
  productId: z.string().min(1, 'ID de producto requerido'),
  quotationItemId: z.string().min(1).optional().nullable(),
  quantityDelivered: z.number().positive('La cantidad a despachar debe ser mayor a 0'),
  unitPrice: z.number().min(0, 'El precio unitario no puede ser negativo'),
  notes: z.string().max(255).optional().nullable(),
});

export const createDeliveryNoteSchema = z.object({
  branchId: z.string().min(1, 'ID de sucursal requerido'),
  warehouseId: z.string().min(1, 'ID de depósito de despacho requerido'),
  customerId: z.string().min(1, 'ID de cliente requerido'),
  quotationId: z.string().min(1).optional().nullable(),
  driverName: z.string().max(100).optional().nullable(),
  vehiclePlate: z.string().max(20).optional().nullable(),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.number().positive('La tasa de cambio debe ser positiva').default(1.0),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(deliveryNoteItemSchema).min(1, 'Debe incluir al menos un producto a despachar'),
});

export type DeliveryNoteItemInput = z.infer<typeof deliveryNoteItemSchema>;
export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;

// ==========================================
// Conversión a Factura de Venta Fiscal (CxC)
// ==========================================
export const quotationPaymentItemSchema = z.object({
  method: z.enum([
    'CASH_USD',
    'CASH_VES',
    'TRANSFER',
    'PAGO_MOVIL',
    'DEBIT_CARD',
    'CREDIT_CARD',
    'ZELLE',
    'OTHER',
  ]),
  amountUSD: z.coerce.number().min(0).default(0),
  amountVES: z.coerce.number().min(0).default(0),
  exchangeRate: z.coerce.number().positive().default(1),
  bankAccountId: z.string().optional().nullable(),
  referenceNumber: z.string().max(100).optional().nullable(),
});

export type QuotationPaymentItem = z.infer<typeof quotationPaymentItemSchema>;

export const convertQuotationToInvoiceSchema = z.object({
  quotationId: z.string().min(1, 'ID de cotización requerido'),
  warehouseId: z.string().min(1, 'ID de depósito para rebaja de inventario requerido'),
  invoiceNumber: z.string().max(30).optional().nullable(),
  controlNumber: z.string().max(30).optional().nullable(),
  invoiceMode: z.enum(['fiscal_printer', 'free_form', 'no_fiscal', 'normal_printer', 'electronic']).default('free_form'),
  isCredit: z.boolean().default(false),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
  adminAuthorized: z.boolean().optional().default(false),
  supervisorApproval: z.object({
    usernameOrEmail: z.string().min(1, 'Usuario supervisor requerido'),
    password: z.string().min(1, 'Contraseña de supervisor requerida'),
    notes: z.string().max(255).optional().nullable(),
  }).optional().nullable(),
  paymentMethod: z.enum([
    'CASH_USD',
    'CASH_VES',
    'TRANSFER',
    'PAGO_MOVIL',
    'DEBIT_CARD',
    'CREDIT_CARD',
    'ZELLE',
    'OTHER',
  ]).optional().nullable(),
  bankAccountId: z.string().optional().nullable(),
  paymentReference: z.string().max(100).optional().nullable(),
  payments: z.array(quotationPaymentItemSchema).optional().nullable(),
  updatePricesToCurrent: z.boolean().optional().default(false),
});

export const convertDeliveryToInvoiceSchema = z.object({
  deliveryNoteId: z.string().min(1, 'ID de nota de entrega requerido'),
  invoiceNumber: z.string().max(30).optional().nullable(),
  controlNumber: z.string().max(30).optional().nullable(),
  invoiceMode: z.enum(['fiscal_printer', 'free_form', 'no_fiscal', 'normal_printer', 'electronic']).default('free_form'),
  isCredit: z.boolean().default(false),
  dueDate: z.string().optional().nullable(),
  adminAuthorized: z.boolean().optional().default(false),
  supervisorApproval: z.object({
    usernameOrEmail: z.string().min(1, 'Usuario supervisor requerido'),
    password: z.string().min(1, 'Contraseña de supervisor requerida'),
    notes: z.string().max(255).optional().nullable(),
  }).optional().nullable(),
  paymentMethod: z.enum([
    'CASH_USD',
    'CASH_VES',
    'TRANSFER',
    'PAGO_MOVIL',
    'DEBIT_CARD',
    'CREDIT_CARD',
    'ZELLE',
    'OTHER',
  ]).optional().nullable(),
  bankAccountId: z.string().optional().nullable(),
  paymentReference: z.string().max(100).optional().nullable(),
});

export type ConvertQuotationToInvoiceInput = z.infer<typeof convertQuotationToInvoiceSchema>;
export type ConvertDeliveryToInvoiceInput = z.infer<typeof convertDeliveryToInvoiceSchema>;
