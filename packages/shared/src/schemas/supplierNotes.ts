import { z } from 'zod';

export const supplierNoteTypeEnum = z.enum(['CREDIT', 'DEBIT']);
export type SupplierNoteType = z.infer<typeof supplierNoteTypeEnum>;

export const supplierNoteReasonTypeEnum = z.enum([
  'RETURN',
  'DISCOUNT',
  'PRICE_CORRECTION',
  'FREIGHT_SURCHARGE',
  'LATE_FEE',
  'OTHER',
]);
export type SupplierNoteReasonType = z.infer<typeof supplierNoteReasonTypeEnum>;

export const supplierNoteStatusEnum = z.enum(['ACTIVE', 'APPLIED', 'ANNULLED']);
export type SupplierNoteStatus = z.infer<typeof supplierNoteStatusEnum>;

export const supplierNoteItemSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1, 'La descripción del ítem es requerida').max(255),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.coerce.number().min(0, 'El costo unitario no puede ser negativo'),
  taxRate: z.coerce.number().min(0).max(100).default(16.0),
  returnFromInventory: z.boolean().default(false),
});
export type SupplierNoteItemInput = z.infer<typeof supplierNoteItemSchema>;

export const createSupplierNoteSchema = z.object({
  branchId: z.string().min(1, 'ID de sucursal requerido'),
  supplierId: z.string().min(1, 'ID de proveedor requerido'),
  type: supplierNoteTypeEnum,
  warehouseId: z.string().optional().nullable(),
  affectedInvoiceId: z.string().optional().nullable(),
  noteNumber: z.string().optional().nullable(),
  controlNumber: z.string().max(30).optional().nullable(),
  noteDate: z.string().optional().nullable(),
  reasonType: supplierNoteReasonTypeEnum.default('OTHER'),
  reasonDescription: z.string().min(3, 'El motivo o descripción debe tener al menos 3 caracteres'),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.coerce.number().positive('La tasa de cambio debe ser positiva').default(1.0),
  autoApplyToInvoice: z.boolean().default(false),
  items: z.array(supplierNoteItemSchema).min(1, 'Debe incluir al menos un renglón o concepto en la nota'),
});
export type CreateSupplierNoteInput = z.infer<typeof createSupplierNoteSchema>;

export const applySupplierCreditNoteSchema = z.object({
  noteId: z.string().min(1, 'ID de Nota de Crédito requerido'),
  payableId: z.string().min(1, 'ID de Cuenta por Pagar requerido'),
  amount: z.coerce.number().positive('El monto a aplicar debe ser mayor a 0'),
  notes: z.string().max(255).optional().nullable(),
});
export type ApplySupplierCreditNoteInput = z.infer<typeof applySupplierCreditNoteSchema>;

export const annulSupplierNoteSchema = z.object({
  reason: z.string().min(3, 'El motivo de anulación es obligatorio'),
});
export type AnnulSupplierNoteInput = z.infer<typeof annulSupplierNoteSchema>;

export interface SupplierNoteItem {
  id: string;
  noteId: string;
  productId?: string | null;
  sku?: string | null;
  productName?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  returnFromInventory: boolean;
}

export interface SupplierNoteApplication {
  id: string;
  noteId: string;
  payableId: string;
  userId: string;
  userName?: string;
  amountApplied: number;
  appliedDate: string;
  invoiceNumber?: string;
  notes?: string | null;
}

export interface SupplierNote {
  id: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  supplierId: string;
  supplierRif?: string;
  supplierName?: string;
  userId: string;
  userName?: string;
  warehouseId?: string | null;
  warehouseName?: string | null;
  affectedInvoiceId?: string | null;
  affectedInvoiceNumber?: string | null;
  type: SupplierNoteType;
  noteNumber: string;
  controlNumber?: string | null;
  noteDate: string;
  currency: 'USD' | 'VES';
  exchangeRate: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  availableBalance: number;
  reasonType: SupplierNoteReasonType;
  reasonDescription?: string | null;
  status: SupplierNoteStatus;
  annulledAt?: string | null;
  annulledBy?: string | null;
  annulReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: SupplierNoteItem[];
  applications?: SupplierNoteApplication[];
}

export interface SupplierInvoiceOption {
  id: string;
  invoiceNumber: string;
  controlNumber?: string | null;
  invoiceDate: string;
  totalAmount: number;
  payableId?: string | null;
  payableBalance?: number | null;
  status: string;
}
