import { z } from 'zod';

export const TableStatusEnum = z.enum(['AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED']);
export type TableStatus = z.infer<typeof TableStatusEnum>;

export const OrderStatusEnum = z.enum(['OPEN', 'BILL_REQUESTED', 'PAID', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const PreparationStationEnum = z.enum(['KITCHEN', 'BAR']);
export type PreparationStation = z.infer<typeof PreparationStationEnum>;

export const ItemPreparationStatusEnum = z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']);
export type ItemPreparationStatus = z.infer<typeof ItemPreparationStatusEnum>;

// ==========================================
// MESAS / TABLES
// ==========================================
export const RestaurantTableSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  table_number: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  zone: z.string().min(1).max(50).default('Salón Principal'),
  capacity: z.coerce.number().int().min(1).default(4),
  status: TableStatusEnum.default('AVAILABLE'),
  current_waiter_id: z.string().uuid().nullable().optional(),
  current_waiter_name: z.string().max(150).nullable().optional(),
  active_order_id: z.string().uuid().nullable().optional(),
  total_usd: z.number().optional(),
  total_ves: z.number().optional(),
  customer_count: z.number().optional(),
  item_count: z.number().optional(),
  order_number: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type RestaurantTable = z.infer<typeof RestaurantTableSchema>;

export const CreateRestaurantTableSchema = z.object({
  branch_id: z.string().uuid().optional(),
  table_number: z.string().min(1, 'El número de mesa es obligatorio').max(20),
  name: z.string().min(1, 'El nombre de mesa es obligatorio').max(100),
  zone: z.string().min(1).max(50).default('Salón Principal'),
  capacity: z.coerce.number().int().min(1).default(4),
});
export type CreateRestaurantTableInput = z.infer<typeof CreateRestaurantTableSchema>;

export const UpdateRestaurantTableSchema = CreateRestaurantTableSchema.partial().extend({
  status: TableStatusEnum.optional(),
  current_waiter_id: z.string().uuid().nullable().optional(),
  current_waiter_name: z.string().max(150).nullable().optional(),
  active_order_id: z.string().uuid().nullable().optional(),
});
export type UpdateRestaurantTableInput = z.infer<typeof UpdateRestaurantTableSchema>;

// ==========================================
// OBSERVACIONES PREESTABLECIDAS (PRESET NOTES)
// ==========================================
export const RestaurantPresetNoteSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  category: z.string().max(50).default('GENERAL'),
  note_text: z.string().min(1).max(255),
  created_at: z.string().optional(),
});
export type RestaurantPresetNote = z.infer<typeof RestaurantPresetNoteSchema>;

export const CreatePresetNoteSchema = z.object({
  category: z.string().max(50).default('GENERAL'),
  note_text: z.string().min(1, 'El texto de la observación es obligatorio').max(255),
});
export type CreatePresetNoteInput = z.infer<typeof CreatePresetNoteSchema>;

// ==========================================
// CLIENTES DE LA COMANDA (CUSTOMERS PER TABLE)
// ==========================================
export const RestaurantOrderCustomerSchema = z.object({
  id: z.string().max(64),
  order_id: z.string().max(64),
  customer_number: z.number().int().min(1),
  customer_name: z.string().min(1).max(100),
  customer_id: z.string().max(64).nullable().optional(), // Vinculado a clientes ERP (CxC)
  notes: z.string().max(255).nullable().optional(),
  is_paid: z.boolean().default(false),
  total_usd: z.number().default(0),
  total_ves: z.number().default(0),
  created_at: z.string().optional(),
});
export type RestaurantOrderCustomer = z.infer<typeof RestaurantOrderCustomerSchema>;

export const CreateOrderCustomerSchema = z.object({
  customer_name: z.string().min(1, 'Nombre del cliente requerido').max(100),
  customer_id: z.string().max(64).nullable().optional(),
  notes: z.string().max(255).nullable().optional(),
});
export type CreateOrderCustomerInput = z.infer<typeof CreateOrderCustomerSchema>;

// ==========================================
// ITEMS DE COMANDA (ORDER ITEMS)
// ==========================================
export const RestaurantOrderItemSchema = z.object({
  id: z.string().max(64),
  order_id: z.string().max(64),
  order_customer_id: z.string().max(64).nullable().optional(),
  product_id: z.string().max(64).nullable().optional(),
  product_name: z.string().min(1).max(150),
  sku: z.string().max(50).nullable().optional(),
  quantity: z.number().min(0.01),
  unit_price_usd: z.number().min(0),
  unit_price_ves: z.number().min(0),
  subtotal_usd: z.number().min(0),
  subtotal_ves: z.number().min(0),
  station: PreparationStationEnum.default('KITCHEN'),
  notes: z.string().nullable().optional(),
  status: ItemPreparationStatusEnum.default('PENDING'),
  department_id: z.string().max(64).nullable().optional(),
  group_id: z.string().max(64).nullable().optional(),
  customer_name: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type RestaurantOrderItem = z.infer<typeof RestaurantOrderItemSchema>;

export const AddOrderItemSchema = z.object({
  order_customer_id: z.string().max(64).nullable().optional(),
  product_id: z.string().max(64).nullable().optional(),
  product_name: z.string().min(1, 'Nombre del producto requerido').max(150),
  sku: z.string().max(50).nullable().optional(),
  quantity: z.coerce.number().min(0.01).default(1),
  unit_price_usd: z.coerce.number().min(0),
  station: PreparationStationEnum.default('KITCHEN'),
  notes: z.string().nullable().optional(),
  department_id: z.string().max(64).nullable().optional(),
  group_id: z.string().max(64).nullable().optional(),
  // Opción para registrar nueva nota en catálogo preestablecido
  save_as_preset_note: z.boolean().optional(),
});
export type AddOrderItemInput = z.infer<typeof AddOrderItemSchema>;

export const UpdateItemStatusSchema = z.object({
  status: ItemPreparationStatusEnum,
});
export type UpdateItemStatusInput = z.infer<typeof UpdateItemStatusSchema>;

// ==========================================
// PAGOS DE COMANDA (PAYMENTS & SPLIT BILL)
// ==========================================
export const RestaurantOrderPaymentSchema = z.object({
  id: z.string().max(64),
  order_id: z.string().max(64),
  order_customer_id: z.string().max(64).nullable().optional(),
  payment_method_id: z.string().max(64).nullable().optional(),
  payment_method_name: z.string().min(1).max(100),
  currency: z.enum(['USD', 'VES']).default('USD'),
  amount: z.number().min(0.01),
  amount_usd: z.number().min(0),
  amount_ves: z.number().min(0),
  exchange_rate: z.number().min(0.0001),
  reference: z.string().max(100).nullable().optional(),
  bank_account_id: z.string().max(64).nullable().optional(),
  is_credit: z.boolean().default(false),
  due_date: z.string().nullable().optional(),
  customer_id: z.string().max(64).nullable().optional(),
  customer_name: z.string().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type RestaurantOrderPayment = z.infer<typeof RestaurantOrderPaymentSchema>;

export const AddOrderPaymentSchema = z.object({
  order_customer_id: z.string().max(64).nullable().optional(),
  payment_method_id: z.string().max(64).nullable().optional(),
  payment_method_name: z.string().min(1, 'El método de pago es requerido').max(100),
  currency: z.enum(['USD', 'VES']).default('USD'),
  amount: z.coerce.number().min(0.01, 'El monto debe ser mayor a 0'),
  reference: z.string().max(100).nullable().optional(),
  bank_account_id: z.string().max(64).nullable().optional(),
  is_credit: z.boolean().default(false),
  due_date: z.string().nullable().optional(),
  customer_id: z.string().max(64).nullable().optional(),
  notes: z.string().nullable().optional(),
  order_notes: z.string().nullable().optional(), // Observación general al pago del pedido
});
export type AddOrderPaymentInput = z.infer<typeof AddOrderPaymentSchema>;

// ==========================================
// COMANDA COMPLETA (FULL ORDER)
// ==========================================
export const RestaurantOrderSchema = z.object({
  id: z.string().max(64),
  company_id: z.string().max(64),
  branch_id: z.string().max(64),
  table_id: z.string().max(64),
  table_number: z.string().optional(),
  table_name: z.string().optional(),
  zone: z.string().optional(),
  order_number: z.string(),
  waiter_id: z.string().max(64).nullable().optional(),
  waiter_name: z.string().max(150).nullable().optional(),
  customer_id: z.string().max(64).nullable().optional(),
  customer_name: z.string().max(150).nullable().optional(),
  status: OrderStatusEnum.default('OPEN'),
  notes: z.string().nullable().optional(),
  total_usd: z.number().default(0),
  total_ves: z.number().default(0),
  exchange_rate: z.number().default(1),
  is_invoiced: z.boolean().default(false).optional(),
  pos_invoice_id: z.string().max(64).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  customers: z.array(RestaurantOrderCustomerSchema).optional(),
  items: z.array(RestaurantOrderItemSchema).optional(),
  payments: z.array(RestaurantOrderPaymentSchema).optional(),
});
export type RestaurantOrder = z.infer<typeof RestaurantOrderSchema>;

export const OpenOrderSchema = z.object({
  table_id: z.string().min(1, 'ID de mesa requerido').max(64),
  waiter_id: z.string().max(64).nullable().optional(),
  waiter_name: z.string().max(150).nullable().optional(),
  customer_id: z.string().max(64).nullable().optional(),
  customer_name: z.string().max(150).nullable().optional(),
  initial_customers: z.array(z.string()).min(1).default(['Cliente 1']),
  notes: z.string().nullable().optional(),
});
export type OpenOrderInput = z.infer<typeof OpenOrderSchema>;

export const CloseTableOrderSchema = z.object({
  closed_by_user_id: z.string().max(64).nullable().optional(),
  closed_by_user_name: z.string().max(150).nullable().optional(),
  tip_usd: z.coerce.number().min(0).default(0).optional(),
  tip_ves: z.coerce.number().min(0).default(0).optional(),
  notes: z.string().nullable().optional(),
});
export type CloseTableOrderInput = z.infer<typeof CloseTableOrderSchema>;

// ==========================================
// REGISTRO DE HISTÓRICO DE CIERRE DE MESA
// ==========================================
export const RestaurantTableClosureSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  order_id: z.string().uuid(),
  table_id: z.string().uuid(),
  table_number: z.string(),
  table_name: z.string(),
  zone: z.string(),
  order_number: z.string(),
  waiter_id: z.string().uuid().nullable().optional(),
  waiter_name: z.string().max(150).nullable().optional(),
  closed_by_user_id: z.string().uuid().nullable().optional(),
  closed_by_user_name: z.string().max(150).nullable().optional(),
  opened_at: z.string(),
  closed_at: z.string(),
  duration_minutes: z.number().int().default(0),
  customer_count: z.number().int().default(1),
  item_count: z.number().int().default(0),
  subtotal_usd: z.number().default(0),
  subtotal_ves: z.number().default(0),
  tip_usd: z.number().default(0),
  tip_ves: z.number().default(0),
  total_usd: z.number().default(0),
  total_ves: z.number().default(0),
  exchange_rate: z.number().default(1),
  payment_summary: z.any().nullable().optional(),
  closure_notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type RestaurantTableClosure = z.infer<typeof RestaurantTableClosureSchema>;

// ==========================================
// REPORTE DE PROPINAS POR MESERO / USUARIO
// ==========================================
export const RestaurantTipItemSchema = z.object({
  closureId: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  tableNumber: z.string(),
  tableName: z.string(),
  zone: z.string(),
  waiterId: z.string().nullable().optional(),
  waiterName: z.string(),
  closedByUserId: z.string().nullable().optional(),
  closedByUserName: z.string().nullable().optional(),
  customerName: z.string(),
  openedAt: z.string(),
  closedAt: z.string(),
  durationMinutes: z.number().default(0),
  subtotalUSD: z.number().default(0),
  subtotalVES: z.number().default(0),
  tipUSD: z.number().default(0),
  tipVES: z.number().default(0),
  tipPercent: z.number().default(0),
  totalUSD: z.number().default(0),
  totalVES: z.number().default(0),
  exchangeRate: z.number().default(1),
  isInvoiced: z.boolean().default(false),
  posInvoiceId: z.string().nullable().optional(),
  posInvoiceNumber: z.string().nullable().optional(),
  invoiceStatus: z.string().nullable().optional(),
  branchName: z.string().optional(),
});
export type RestaurantTipItem = z.infer<typeof RestaurantTipItemSchema>;

export const WaiterTipsSummarySchema = z.object({
  waiterId: z.string().nullable().optional(),
  waiterName: z.string(),
  ordersCount: z.number().default(0),
  ordersWithTipCount: z.number().default(0),
  totalSalesUSD: z.number().default(0),
  totalTipsUSD: z.number().default(0),
  totalTipsVES: z.number().default(0),
  averageTipUSD: z.number().default(0),
  averageTipPercent: z.number().default(0),
});
export type WaiterTipsSummary = z.infer<typeof WaiterTipsSummarySchema>;

export const RestaurantTipsReportSchema = z.object({
  summary: z.object({
    totalTipsUSD: z.number().default(0),
    totalTipsVES: z.number().default(0),
    totalSalesUSD: z.number().default(0),
    totalSalesVES: z.number().default(0),
    ordersCount: z.number().default(0),
    ordersWithTipCount: z.number().default(0),
    averageTipUSD: z.number().default(0),
    averageTipPercent: z.number().default(0),
  }),
  byWaiter: z.array(WaiterTipsSummarySchema),
  orders: z.array(RestaurantTipItemSchema),
});
export type RestaurantTipsReport = z.infer<typeof RestaurantTipsReportSchema>;
