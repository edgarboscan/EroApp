import { z } from 'zod';
import { POS_INVOICE_MODES } from '../constants';

export const posCartItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string(),
  name: z.string(),
  presentationId: z.string().optional().nullable(),
  multiplier: z.number().positive().default(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRateId: z.string().min(1).optional().nullable(),
  taxRatePercent: z.number().min(0).default(16.0),
  taxInclusive: z.boolean().default(false),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  total: z.number().min(0),
  isNegativeStockAuthorized: z.boolean().optional().default(false),
  isPresentationAuthorized: z.boolean().optional().default(false),
  supervisorApprovedBy: z.string().optional().nullable(),
});

export type POSCartItem = z.infer<typeof posCartItemSchema>;

export const paymentMethodSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(100),
  currency: z.enum(['USD', 'VES']).default('VES'),
  type: z.enum(['CASH', 'CARD', 'ELECTRONIC', 'CREDIT', 'OTHER']).default('OTHER'),
  appliesIGTF: z.boolean().default(false),
  requiresReference: z.boolean().default(false),
  requiresBankAccount: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

export const posPaymentSchema = z.object({
  method: z.string().min(1).max(30),
  amountVES: z.number().min(0),
  amountUSD: z.number().min(0),
  exchangeRate: z.number().positive(),
  referenceNumber: z.string().max(50).optional().nullable(),
  bankAccountId: z.string().min(1).optional().nullable(),
  appliesIGTF: z.boolean().default(false), // true si es divisa/cripto no bancarizada en VES
  igtfAmountVES: z.number().min(0).default(0),
  igtfAmountUSD: z.number().min(0).default(0),
});

export type POSPayment = z.infer<typeof posPaymentSchema>;

const normalizeInvoiceMode = (val: unknown) => {
  if (typeof val === 'string') {
    const l = val.toLowerCase().trim();
    if (l === 'fiscal_printer' || l === 'normal_printer' || l === 'fiscal_email' || l === 'normal_email') {
      return l;
    }
  }
  return val;
};

export const posSaleSubmitSchema = z.object({
  branchId: z.string().min(1),
  warehouseId: z.string().optional().nullable(),
  customerId: z.string().min(1).optional().nullable(),
  customerDocType: z.enum(['V', 'E', 'J', 'G', 'P']).default('V'),
  customerDocNumber: z.string().min(3).max(20).default('99999999'),
  customerName: z.string().min(2).max(150).default('CONSUMIDOR FINAL'),
  customerAddress: z.string().max(255).optional().nullable(),
  
  invoiceMode: z.preprocess(normalizeInvoiceMode, z.nativeEnum(POS_INVOICE_MODES)).default(POS_INVOICE_MODES.NORMAL_PRINTER),
  currency: z.enum(['USD', 'VES']).default('USD'),
  exchangeRate: z.number().positive(),
  
  items: z.array(posCartItemSchema).min(1, 'El carrito no puede estar vacío'),
  payments: z.array(posPaymentSchema).min(1, 'Debe registrar al menos un método de pago'),
  
  baseExemptAmount: z.number().min(0).default(0),
  baseTaxableAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  igtfTotalAmount: z.number().min(0).default(0),
  discountTotalAmount: z.number().min(0).default(0),
  finalTotalAmount: z.number().positive(),
  
  isCredit: z.boolean().default(false),
  creditDays: z.number().int().min(0).default(0),
  notes: z.string().max(255).optional().nullable(),
  restaurantOrderId: z.string().optional().nullable(),
});

export type POSSaleSubmit = z.infer<typeof posSaleSubmitSchema>;

export const cashRegisterSchema = z.object({
  branchId: z.string().min(1),
  warehouseId: z.string().optional().nullable(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  fiscalPrinterSerial: z.string().max(50).optional().nullable(),
  invoiceMode: z.preprocess(normalizeInvoiceMode, z.nativeEnum(POS_INVOICE_MODES)).default(POS_INVOICE_MODES.NORMAL_PRINTER),
  defaultBankAccountIdVES: z.string().optional().nullable(),
  defaultBankAccountIdUSD: z.string().optional().nullable(),
  allowedDepartmentIds: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export type CashRegisterInput = z.infer<typeof cashRegisterSchema>;

export const openCashShiftSchema = z.object({
  cashRegisterId: z.string().min(1),
  branchId: z.string().min(1),
  initialCashUSD: z.number().min(0).default(0),
  initialCashVES: z.number().min(0).default(0),
  notes: z.string().max(255).optional().nullable(),
});

export type OpenCashShiftInput = z.infer<typeof openCashShiftSchema>;

export const closeCashShiftSchema = z.object({
  shiftId: z.string().min(1),
  finalCashUSDCounted: z.number().min(0),
  finalCashVESCounted: z.number().min(0),
  notes: z.string().max(255).optional().nullable(),
  depositBankAccountIdVES: z.string().optional().nullable(),
  depositAmountVES: z.number().min(0).optional().default(0),
  depositReferenceVES: z.string().max(100).optional().nullable(),
  depositBankAccountIdUSD: z.string().optional().nullable(),
  depositAmountUSD: z.number().min(0).optional().default(0),
  depositReferenceUSD: z.string().max(100).optional().nullable(),
});

export type CloseCashShiftInput = z.infer<typeof closeCashShiftSchema>;

export const verifyCashShiftSchema = z.object({
  shiftId: z.string().min(1),
  status: z.enum(['VERIFIED', 'DISCREPANCY_REVIEW', 'PENDING']).default('VERIFIED'),
  notes: z.string().max(255).optional().nullable(),
  resolveNotification: z.boolean().optional().default(false),
});

export type VerifyCashShiftInput = z.infer<typeof verifyCashShiftSchema>;

export const cashShiftDepositItemSchema = z.object({
  bankAccountId: z.string().min(1, 'Debe seleccionar una cuenta bancaria'),
  depositType: z.enum(['CASH_VES', 'CASH_USD', 'POS_BATCH', 'PAGO_MOVIL', 'TRANSFER', 'ZELLE', 'OTHER']),
  amount: z.number().positive('El monto a depositar debe ser mayor a 0'),
  currency: z.enum(['USD', 'VES']),
  depositDate: z.string().optional().nullable(),
  referenceNumber: z.string().min(1, 'Debe indicar el número de referencia o planilla de depósito').max(60),
  notes: z.string().max(255).optional().nullable(),
});

export type CashShiftDepositItem = z.infer<typeof cashShiftDepositItemSchema>;

export const depositCashShiftSchema = z.object({
  shiftId: z.string().min(1),
  deposits: z.array(cashShiftDepositItemSchema).min(1, 'Debe registrar al menos un depósito bancario'),
  markAsDeposited: z.boolean().optional().default(true),
});

export type DepositCashShiftInput = z.infer<typeof depositCashShiftSchema>;

export const resolveDiscrepancySchema = z.object({
  notificationId: z.string().min(1),
  resolutionNotes: z.string().min(2, 'Debe registrar la justificación de la resolución de auditoría').max(255),
});

export type ResolveDiscrepancyInput = z.infer<typeof resolveDiscrepancySchema>;

export const cashMovementSchema = z.object({
  shiftId: z.string().min(1),
  type: z.enum(['INFLOW', 'OUTFLOW']),
  currency: z.enum(['USD', 'VES']),
  amount: z.number().positive(),
  reason: z.string().min(2).max(255),
});

export type CashMovementInput = z.infer<typeof cashMovementSchema>;

export const generateFiscalReportSchema = z.object({
  cashRegisterId: z.string().min(1),
  branchId: z.string().min(1),
  shiftId: z.string().min(1).optional().nullable(),
  reportType: z.enum(['X', 'Z']),
});

export type GenerateFiscalReportInput = z.infer<typeof generateFiscalReportSchema>;
