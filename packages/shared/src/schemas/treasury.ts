import { z } from 'zod';

export const bankAccountSchema = z.object({
  id: z.string().uuid().optional(),
  bankId: z.string().uuid('ID de banco inválido'),
  branchId: z.string().uuid('ID de sucursal inválido').optional().nullable(),
  accountNumber: z.string().min(10, 'El número de cuenta debe tener al menos 10 dígitos'),
  accountType: z.enum(['CURRENT', 'SAVINGS', 'CUSTODY_USD']).default('CURRENT'),
  currency: z.enum(['USD', 'VES']).default('VES'),
  description: z.string().min(2, 'La descripción o alias de la cuenta es requerida'),
  initialBalance: z.number().default(0),
  isActive: z.boolean().default(true),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const bankMovementSchema = z.object({
  accountId: z.string().uuid('ID de cuenta bancaria inválido'),
  movementType: z.enum([
    'DEPOSIT',
    'WITHDRAWAL',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'CHECK',
    'FEE',
    'TAX_DEBIT',
  ]),
  amount: z.number().positive('El monto debe ser un valor positivo'),
  movementDate: z.string().default(() => new Date().toISOString()),
  referenceNumber: z.string().optional().nullable(),
  concept: z.string().min(2, 'El concepto del movimiento es obligatorio'),
  isReconciled: z.boolean().optional().default(false),
});

export type BankMovementInput = z.infer<typeof bankMovementSchema>;

export const transferBetweenAccountsSchema = z.object({
  originAccountId: z.string().uuid('ID de cuenta origen inválido'),
  destinationAccountId: z.string().uuid('ID de cuenta destino inválido'),
  amount: z.number().positive('El monto a transferir debe ser mayor a 0'),
  exchangeRate: z.number().positive('La tasa de cambio debe ser positiva').default(1),
  referenceNumber: z.string().optional(),
  concept: z.string().min(2, 'El concepto de la transferencia es obligatorio'),
});

export type TransferBetweenAccountsInput = z.infer<typeof transferBetweenAccountsSchema>;

export const bankStatementItemSchema = z.object({
  date: z.string(),
  referenceNumber: z.string().min(1, 'Referencia bancaria obligatoria'),
  description: z.string().optional().nullable(),
  amount: z.number(), // positivo para abonos, negativo para cargos
  matchedMovementId: z.string().uuid().optional().nullable(),
});

export type BankStatementItem = z.infer<typeof bankStatementItemSchema>;

export const reconcileStatementSchema = z.object({
  accountId: z.string().uuid('ID de cuenta bancaria inválido'),
  periodStart: z.string(),
  periodEnd: z.string(),
  statementEndingBalance: z.number(),
  statementItems: z.array(bankStatementItemSchema).min(1, 'Debe incluir al menos un movimiento del extracto'),
  notes: z.string().optional().nullable(),
});

export type ReconcileStatementInput = z.infer<typeof reconcileStatementSchema>;

export const bulkReconcileMovementsSchema = z.object({
  accountId: z.string().uuid('ID de cuenta bancaria inválido'),
  movementIds: z.array(z.string().uuid()).min(1, 'Debe seleccionar al menos un movimiento'),
  isReconciled: z.boolean().default(true),
});

export type BulkReconcileMovementsInput = z.infer<typeof bulkReconcileMovementsSchema>;
