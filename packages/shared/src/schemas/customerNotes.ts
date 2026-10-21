import { z } from 'zod';

export const customerNoteTypeEnum = z.enum(['CREDIT', 'DEBIT']);
export type CustomerNoteType = z.infer<typeof customerNoteTypeEnum>;

export const customerNoteReasonTypeEnum = z.enum([
  'RETURN',
  'DISCOUNT',
  'PRICE_CORRECTION',
  'ANNULMENT',
  'LATE_FEE',
  'COLLECTION_FEE',
  'PRICE_DIFFERENCE',
  'OTHER',
]);
export type CustomerNoteReasonType = z.infer<typeof customerNoteReasonTypeEnum>;

export const customerNoteStatusEnum = z.enum(['ACTIVE', 'APPLIED', 'ANNULLED']);
export type CustomerNoteStatus = z.infer<typeof customerNoteStatusEnum>;

export const customerNoteItemSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1, 'La descripción del ítem es requerida').max(255),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unitPrice: z.coerce.number().min(0, 'El precio unitario no puede ser negativo'),
  taxRate: z.coerce.number().min(0).max(100).default(16.0),
  returnToInventory: z.boolean().default(false),
});
export type CustomerNoteItemInput = z.infer<typeof customerNoteItemSchema>;

export const createCustomerNoteSchema = z.object({
  branchId: z.string().min(1, 'ID de sucursal requerido'),
  customerId: z.string().min(1, 'ID de cliente requerido'),
  type: customerNoteTypeEnum,
  warehouseId: z.string().optional().nullable(),
  affectedInvoiceId: z.string().optional().nullable(),
  controlNumber: z.string().max(30).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  reasonType: customerNoteReasonTypeEnum.default('OTHER'),
  reasonDescription: z.string().min(3, 'El motivo o descripción debe tener al menos 3 caracteres'),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.coerce.number().positive('La tasa de cambio debe ser positiva').default(1.0),
  autoApplyToInvoice: z.boolean().default(false),
  items: z.array(customerNoteItemSchema).min(1, 'Debe incluir al menos un renglón o concepto en la nota'),
});
export type CreateCustomerNoteInput = z.infer<typeof createCustomerNoteSchema>;

export const applyCustomerCreditNoteSchema = z.object({
  noteId: z.string().min(1, 'ID de Nota de Crédito requerido'),
  receivableId: z.string().min(1, 'ID de Cuenta por Cobrar requerido'),
  amount: z.coerce.number().positive('El monto a aplicar debe ser mayor a 0'),
  notes: z.string().max(255).optional().nullable(),
});
export type ApplyCustomerCreditNoteInput = z.infer<typeof applyCustomerCreditNoteSchema>;

export const annulCustomerNoteSchema = z.object({
  reason: z.string().min(3, 'El motivo de anulación es obligatorio'),
});
export type AnnulCustomerNoteInput = z.infer<typeof annulCustomerNoteSchema>;

export interface CustomerNoteItem {
  id: string;
  noteId: string;
  productId?: string | null;
  productCode?: string | null;
  productName?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  returnToInventory: boolean;
}

export interface CustomerNoteApplication {
  id: string;
  noteId: string;
  receivableId: string;
  userId: string;
  userName?: string;
  amountApplied: number;
  appliedDate: string;
  invoiceNumber?: string;
  notes?: string | null;
}

export interface CustomerNote {
  id: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  customerId: string;
  customerDoc?: string;
  customerName?: string;
  userId: string;
  userName?: string;
  warehouseId?: string | null;
  warehouseName?: string | null;
  affectedInvoiceId?: string | null;
  affectedInvoiceNumber?: string | null;
  affectedInvoiceDate?: string | null;
  type: CustomerNoteType;
  noteNumber: string;
  controlNumber?: string | null;
  issueDate: string;
  dueDate?: string | null;
  reasonType: CustomerNoteReasonType;
  reasonDescription: string;
  currency: 'USD' | 'VES';
  exchangeRate: number;
  baseExemptAmount: number;
  baseTaxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountApplied: number;
  amountBalance: number;
  status: CustomerNoteStatus;
  annulledAt?: string | null;
  annulledByUserName?: string | null;
  annulmentReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: CustomerNoteItem[];
  applications?: CustomerNoteApplication[];
}

export interface InvoiceItemForNote {
  id: string;
  productId?: string | null;
  productCode?: string | null;
  productName?: string | null;
  description: string;
  invoicedQuantity: number;
  alreadyCreditedQuantity: number;
  availableQuantity: number;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  isFullyCredited: boolean;
}

