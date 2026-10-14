import { z } from 'zod';
import { POS_INVOICE_MODES } from '../constants';

export const posCartItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string(),
  name: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRateId: z.string().min(1).optional().nullable(),
  taxRatePercent: z.number().min(0).default(16.0),
  taxInclusive: z.boolean().default(false),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  total: z.number().min(0),
});

export type POSCartItem = z.infer<typeof posCartItemSchema>;

export const posPaymentSchema = z.object({
  method: z.enum(['CASH_VES', 'CASH_USD', 'PAGO_MOVIL', 'DEBIT_CARD', 'CREDIT_CARD', 'ZELLE', 'CRYPTO', 'CREDIT']),
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

export const posSaleSubmitSchema = z.object({
  branchId: z.string().min(1),
  warehouseId: z.string().min(1),
  customerId: z.string().min(1).optional().nullable(),
  customerDocType: z.enum(['V', 'E', 'J', 'G', 'P']).default('V'),
  customerDocNumber: z.string().min(3).max(20).default('99999999'),
  customerName: z.string().min(2).max(150).default('CONSUMIDOR FINAL'),
  customerAddress: z.string().max(255).optional().nullable(),
  
  invoiceMode: z.nativeEnum(POS_INVOICE_MODES).default(POS_INVOICE_MODES.NORMAL_PRINTER),
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
});

export type POSSaleSubmit = z.infer<typeof posSaleSubmitSchema>;

export const cashRegisterSchema = z.object({
  branchId: z.string().min(1),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  fiscalPrinterSerial: z.string().max(50).optional().nullable(),
  invoiceMode: z.nativeEnum(POS_INVOICE_MODES).default(POS_INVOICE_MODES.NORMAL_PRINTER),
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
});

export type CloseCashShiftInput = z.infer<typeof closeCashShiftSchema>;

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
