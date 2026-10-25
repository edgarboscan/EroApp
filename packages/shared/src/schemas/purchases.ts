import { z } from 'zod';

// ==========================================
// Ítems y Creación de Órdenes de Compra
// ==========================================
export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, 'ID de producto requerido'),
  quantityOrdered: z.number().positive('La cantidad ordenada debe ser mayor a 0'),
  unitCost: z.number().min(0, 'El costo unitario no puede ser negativo'),
  taxRate: z.number().min(0).default(16.0),
  notes: z.string().max(255).optional().nullable(),
});

export const createPurchaseOrderSchema = z.object({
  branchId: z.string().min(1, 'ID de sucursal requerido').optional().nullable(),
  supplierId: z.string().min(1, 'ID de proveedor requerido'),
  expectedDeliveryDate: z.string().optional().nullable(),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.number().positive('La tasa de cambio debe ser positiva').default(1.0),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1, 'Debe incluir al menos un producto en la orden'),
});

export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

// ==========================================
// Recepciones de Mercancía en Depósito (Goods Receipts)
// ==========================================
export const goodsReceiptItemSchema = z.object({
  productId: z.string().min(1, 'ID de producto requerido'),
  purchaseOrderItemId: z.string().min(1).optional().nullable(),
  quantityReceived: z.number().positive('La cantidad recibida debe ser mayor a 0'),
  unitCost: z.number().min(0, 'El costo unitario no puede ser negativo'),
  notes: z.string().max(255).optional().nullable(),
});

export const createGoodsReceiptSchema = z.object({
  branchId: z.string().min(1, 'ID de sucursal requerido').optional().nullable(),
  warehouseId: z.string().min(1, 'ID de depósito requerido').optional().nullable(),
  supplierId: z.string().min(1, 'ID de proveedor requerido'),
  purchaseOrderId: z.string().min(1).optional().nullable(),
  supplierDeliveryNote: z.string().max(50).optional().nullable(),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.number().positive('La tasa de cambio debe ser positiva').default(1.0),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(goodsReceiptItemSchema).min(1, 'Debe incluir al menos un producto a recibir'),
  // Datos opcionales al recibir directamente con factura de compra del proveedor
  invoiceNumber: z.string().max(30).optional().nullable(),
  controlNumber: z.string().max(30).optional().nullable(),
  autoInvoice: z.boolean().optional().default(false),
  isCredit: z.boolean().optional().default(false),
  dueDate: z.string().optional().nullable(),
});

export type GoodsReceiptItemInput = z.infer<typeof goodsReceiptItemSchema>;
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;

// ==========================================
// Conversión de Recepción a Factura de Proveedor en CxP
// ==========================================
export const convertReceiptToInvoiceSchema = z.object({
  receiptId: z.string().min(1, 'ID de recepción requerido'),
  invoiceNumber: z.string().min(1, 'Número de factura requerido').max(30),
  controlNumber: z.string().max(30).optional().nullable(),
  isCredit: z.boolean().default(false),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
});

export type ConvertReceiptToInvoiceInput = z.infer<typeof convertReceiptToInvoiceSchema>;
