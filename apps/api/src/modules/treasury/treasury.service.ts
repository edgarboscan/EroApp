import { query, withTransaction } from '../../db';
import {
  BankAccountInput,
  BankMovementInput,
  TransferBetweenAccountsInput,
  ReconcileStatementInput,
  BulkReconcileMovementsInput,
} from '@ero/shared';
import crypto from 'crypto';

export interface GetMovementsFilter {
  fromDate?: string;
  toDate?: string;
  isReconciled?: boolean;
  movementType?: string;
  direction?: 'INFLOW' | 'OUTFLOW';
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

export class TreasuryService {
  static async getBanks() {
    return await query<any>(
      `SELECT id, code, name, is_active FROM banks WHERE is_active = 1 ORDER BY code ASC`
    );
  }

  /**
   * Obtiene las cuentas bancarias calculando saldo en libros, partidas en tránsito y saldo real bancario
   */
  static async getBankAccounts(companyId: string, branchId?: string) {
    let sql = `
      SELECT ba.id, ba.company_id, ba.bank_id, ba.branch_id,
             b.code as bank_code, b.name as bank_name,
             br.name as branch_name,
             ba.account_number, ba.account_type, ba.currency,
             ba.description, ba.current_balance, ba.is_active,
             COUNT(CASE WHEN bm.is_reconciled = 0 THEN 1 END) as pending_reconciliations_count,
             COALESCE(SUM(CASE WHEN bm.is_reconciled = 0 AND bm.amount > 0 THEN bm.amount ELSE 0 END), 0) as uncleared_deposits,
             COALESCE(SUM(CASE WHEN bm.is_reconciled = 0 AND bm.amount < 0 THEN ABS(bm.amount) ELSE 0 END), 0) as uncleared_withdrawals,
             COALESCE(SUM(CASE WHEN bm.is_reconciled = 1 THEN bm.amount ELSE 0 END), 0) as cleared_movements_sum,
             (
               SELECT JSON_OBJECT(
                 'id', brc.id,
                 'periodStart', brc.period_start,
                 'periodEnd', brc.period_end,
                 'statementBalance', brc.bank_statement_balance,
                 'difference', brc.difference,
                 'status', brc.status,
                 'createdAt', brc.created_at
               )
               FROM bank_reconciliations brc
               WHERE brc.account_id = ba.id
               ORDER BY brc.period_end DESC, brc.created_at DESC
               LIMIT 1
             ) as last_reconciliation_json
      FROM bank_accounts ba
      INNER JOIN banks b ON ba.bank_id = b.id
      LEFT JOIN branches br ON ba.branch_id = br.id
      LEFT JOIN bank_movements bm ON ba.id = bm.account_id
      WHERE ba.company_id = ? AND ba.is_active = 1
    `;
    const params: any[] = [companyId];

    if (branchId && branchId !== 'all') {
      sql += ` AND (ba.branch_id = ? OR ba.branch_id IS NULL)`;
      params.push(branchId);
    }

    sql += ` GROUP BY ba.id ORDER BY ba.currency DESC, b.name ASC`;

    const rows = await query<any>(sql, params);

    return rows.map((r) => {
      const currentBalance = Number(r.current_balance || 0);
      const unclearedDeposits = Number(r.uncleared_deposits || 0);
      const unclearedWithdrawals = Number(r.uncleared_withdrawals || 0);
      const transitBalance = Number((unclearedDeposits - unclearedWithdrawals).toFixed(2));
      // Saldo Real Bancario = Saldo en Libros + Egresos en Tránsito (no debitados por banco) - Ingresos en Tránsito (no acreditados en banco)
      const realBalance = Number((currentBalance + unclearedWithdrawals - unclearedDeposits).toFixed(2));
      const clearedBalance = Number(r.cleared_movements_sum || 0);

      let lastReconciliation = null;
      if (r.last_reconciliation_json) {
        try {
          lastReconciliation = typeof r.last_reconciliation_json === 'string'
            ? JSON.parse(r.last_reconciliation_json)
            : r.last_reconciliation_json;
        } catch {
          lastReconciliation = null;
        }
      }

      return {
        id: r.id,
        companyId: r.company_id,
        bankId: r.bank_id,
        bankCode: r.bank_code,
        bankName: r.bank_name,
        branchId: r.branch_id,
        branchName: r.branch_name || 'Todas las Sucursales (Global)',
        accountNumber: r.account_number,
        accountType: r.account_type,
        currency: r.currency,
        description: r.description,
        currentBalance,
        bookBalance: currentBalance,
        unclearedDeposits,
        unclearedWithdrawals,
        transitBalance,
        realBalance,
        clearedBalance,
        isActive: Boolean(r.is_active),
        pendingReconciliationsCount: Number(r.pending_reconciliations_count || 0),
        lastReconciliation,
      };
    });
  }

  static async getAccountById(id: string, companyId: string) {
    const rows = await query<any>(
      `SELECT ba.id, ba.company_id, ba.bank_id, ba.branch_id,
              b.code as bank_code, b.name as bank_name,
              br.name as branch_name,
              ba.account_number, ba.account_type, ba.currency,
              ba.description, ba.current_balance, ba.is_active,
              COUNT(CASE WHEN bm.is_reconciled = 0 THEN 1 END) as pending_reconciliations_count,
              COALESCE(SUM(CASE WHEN bm.is_reconciled = 0 AND bm.amount > 0 THEN bm.amount ELSE 0 END), 0) as uncleared_deposits,
              COALESCE(SUM(CASE WHEN bm.is_reconciled = 0 AND bm.amount < 0 THEN ABS(bm.amount) ELSE 0 END), 0) as uncleared_withdrawals,
              COALESCE(SUM(CASE WHEN bm.is_reconciled = 1 THEN bm.amount ELSE 0 END), 0) as cleared_movements_sum,
              (
                SELECT JSON_OBJECT(
                  'id', brc.id,
                  'periodStart', brc.period_start,
                  'periodEnd', brc.period_end,
                  'statementBalance', brc.bank_statement_balance,
                  'difference', brc.difference,
                  'status', brc.status,
                  'createdAt', brc.created_at
                )
                FROM bank_reconciliations brc
                WHERE brc.account_id = ba.id
                ORDER BY brc.period_end DESC, brc.created_at DESC
                LIMIT 1
              ) as last_reconciliation_json
       FROM bank_accounts ba
       INNER JOIN banks b ON ba.bank_id = b.id
       LEFT JOIN branches br ON ba.branch_id = br.id
       LEFT JOIN bank_movements bm ON ba.id = bm.account_id
       WHERE ba.id = ? AND ba.company_id = ?
       GROUP BY ba.id`,
      [id, companyId]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Cuenta bancaria no encontrada');
    }

    const r = rows[0];
    const currentBalance = Number(r.current_balance || 0);
    const unclearedDeposits = Number(r.uncleared_deposits || 0);
    const unclearedWithdrawals = Number(r.uncleared_withdrawals || 0);
    const transitBalance = Number((unclearedDeposits - unclearedWithdrawals).toFixed(2));
    const realBalance = Number((currentBalance + unclearedWithdrawals - unclearedDeposits).toFixed(2));
    const clearedBalance = Number(r.cleared_movements_sum || 0);

    let lastReconciliation = null;
    if (r.last_reconciliation_json) {
      try {
        lastReconciliation = typeof r.last_reconciliation_json === 'string'
          ? JSON.parse(r.last_reconciliation_json)
          : r.last_reconciliation_json;
      } catch {
        lastReconciliation = null;
      }
    }

    return {
      id: r.id,
      companyId: r.company_id,
      bankId: r.bank_id,
      bankCode: r.bank_code,
      bankName: r.bank_name,
      branchId: r.branch_id,
      branchName: r.branch_name || 'Todas las Sucursales (Global)',
      accountNumber: r.account_number,
      accountType: r.account_type,
      currency: r.currency,
      description: r.description,
      currentBalance,
      bookBalance: currentBalance,
      unclearedDeposits,
      unclearedWithdrawals,
      transitBalance,
      realBalance,
      clearedBalance,
      isActive: Boolean(r.is_active),
      pendingReconciliationsCount: Number(r.pending_reconciliations_count || 0),
      lastReconciliation,
    };
  }

  static async createBankAccount(companyId: string, data: BankAccountInput) {
    const existing = await query<any>(
      `SELECT id FROM bank_accounts WHERE company_id = ? AND account_number = ?`,
      [companyId, data.accountNumber.trim()]
    );

    if (existing.length > 0) {
      throw new Error(`El número de cuenta ${data.accountNumber} ya está registrado`);
    }

    const accountId = data.id || crypto.randomUUID();
    const initBalance = data.initialBalance || 0;

    return await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO bank_accounts (
          id, company_id, bank_id, branch_id, account_number, account_type, currency,
          description, current_balance, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          companyId,
          data.bankId,
          data.branchId || null,
          data.accountNumber.trim(),
          data.accountType,
          data.currency,
          data.description.trim(),
          initBalance,
          data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
        ]
      );

      if (initBalance > 0) {
        await conn.query(
          `INSERT INTO bank_movements (
            id, account_id, user_id, movement_type, amount, balance_after, reference_number, concept, is_reconciled
          ) VALUES (?, ?, ?, 'DEPOSIT', ?, ?, 'INICIAL', 'Saldo inicial de apertura de cuenta', 1)`,
          [
            crypto.randomUUID(),
            accountId,
            'SYSTEM',
            initBalance,
            initBalance,
          ]
        );
      }

      return { id: accountId, ...data, currentBalance: initBalance, realBalance: initBalance };
    });
  }

  static async getAccountMovements(
    accountId: string,
    companyId: string,
    filterOrFromDate?: GetMovementsFilter | string,
    toDateArg?: string,
    isReconciledArg?: boolean
  ) {
    await this.getAccountById(accountId, companyId);

    const filter: GetMovementsFilter =
      typeof filterOrFromDate === 'object' && filterOrFromDate !== null
        ? filterOrFromDate
        : {
            fromDate: typeof filterOrFromDate === 'string' ? filterOrFromDate : undefined,
            toDate: toDateArg,
            isReconciled: isReconciledArg,
          };

    let sql = `
      SELECT bm.id, bm.account_id, bm.user_id, bm.movement_type, bm.amount,
             bm.balance_after, bm.movement_date, bm.reference_number,
             bm.concept, bm.destination_account_id, bm.is_reconciled,
             bm.reconciliation_id,
             u.full_name as user_name
      FROM bank_movements bm
      LEFT JOIN users u ON bm.user_id = u.id
      WHERE bm.account_id = ?
    `;
    const params: any[] = [accountId];

    if (filter.fromDate) {
      sql += ` AND bm.movement_date >= ?`;
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      const fullToDate = filter.toDate.length <= 10 ? `${filter.toDate} 23:59:59` : filter.toDate;
      sql += ` AND bm.movement_date <= ?`;
      params.push(fullToDate);
    }
    if (filter.isReconciled !== undefined) {
      sql += ` AND bm.is_reconciled = ?`;
      params.push(filter.isReconciled ? 1 : 0);
    }
    if (filter.movementType && filter.movementType !== 'ALL') {
      sql += ` AND bm.movement_type = ?`;
      params.push(filter.movementType);
    }
    if (filter.direction === 'INFLOW') {
      sql += ` AND bm.amount > 0`;
    } else if (filter.direction === 'OUTFLOW') {
      sql += ` AND bm.amount < 0`;
    }
    if (filter.search && filter.search.trim()) {
      sql += ` AND (bm.reference_number LIKE CONCAT('%', ?, '%') OR bm.concept LIKE CONCAT('%', ?, '%'))`;
      params.push(filter.search.trim());
    }
    if (filter.minAmount !== undefined && !isNaN(filter.minAmount)) {
      sql += ` AND ABS(bm.amount) >= ?`;
      params.push(filter.minAmount);
    }
    if (filter.maxAmount !== undefined && !isNaN(filter.maxAmount)) {
      sql += ` AND ABS(bm.amount) <= ?`;
      params.push(filter.maxAmount);
    }

    sql += ` ORDER BY bm.movement_date DESC, bm.created_at DESC`;

    const rows = await query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      userId: r.user_id,
      userName: r.user_name || 'Sistema',
      movementType: r.movement_type,
      amount: Number(r.amount),
      balanceAfter: Number(r.balance_after),
      movementDate: r.movement_date,
      referenceNumber: r.reference_number,
      concept: r.concept,
      destinationAccountId: r.destination_account_id,
      isReconciled: Boolean(r.is_reconciled),
      reconciliationId: r.reconciliation_id || null,
    }));
  }

  static async registerMovement(companyId: string, userId: string, data: BankMovementInput) {
    const account = await this.getAccountById(data.accountId, companyId);

    // Multiplier: positive for DEPOSIT and TRANSFER_IN; negative for WITHDRAWAL, FEE, CHECK, TAX_DEBIT, TRANSFER_OUT
    const isOutflow = ['WITHDRAWAL', 'TRANSFER_OUT', 'CHECK', 'FEE', 'TAX_DEBIT'].includes(
      data.movementType
    );
    const delta = isOutflow ? -Math.abs(data.amount) : Math.abs(data.amount);
    const balanceAfter = Number((account.currentBalance + delta).toFixed(2));

    if (balanceAfter < 0 && isOutflow) {
      throw new Error(
        `Fondos insuficientes: el saldo actual (${account.currency} ${account.currentBalance.toFixed(2)}) no cubre el egreso solicitado (${account.currency} ${data.amount.toFixed(2)})`
      );
    }

    const movementId = crypto.randomUUID();
    const isReconciled = Boolean(data.isReconciled);

    return await withTransaction(async (conn) => {
      // 1. Update account balance
      await conn.query(
        `UPDATE bank_accounts SET current_balance = ? WHERE id = ?`,
        [balanceAfter, account.id]
      );

      // 2. Insert movement
      await conn.query(
        `INSERT INTO bank_movements (
          id, account_id, user_id, movement_type, amount, balance_after,
          movement_date, reference_number, concept, is_reconciled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementId,
          account.id,
          userId,
          data.movementType,
          delta,
          balanceAfter,
          data.movementDate || new Date().toISOString().slice(0, 19).replace('T', ' '),
          data.referenceNumber || null,
          data.concept.trim(),
          isReconciled ? 1 : 0,
        ]
      );

      return {
        movementId,
        accountId: account.id,
        accountNumber: account.accountNumber,
        currency: account.currency,
        amount: delta,
        balanceAfter,
        movementType: data.movementType,
        concept: data.concept,
        isReconciled,
      };
    });
  }

  static async transferBetweenAccounts(companyId: string, userId: string, data: TransferBetweenAccountsInput) {
    if (data.originAccountId === data.destinationAccountId) {
      throw new Error('La cuenta de origen y destino no pueden ser la misma');
    }

    const origin = await this.getAccountById(data.originAccountId, companyId);
    const destination = await this.getAccountById(data.destinationAccountId, companyId);

    if (origin.currentBalance < data.amount) {
      throw new Error(
        `Saldo insuficiente en cuenta origen: disponible ${origin.currency} ${origin.currentBalance.toFixed(2)}, requerido ${origin.currency} ${data.amount.toFixed(2)}`
      );
    }

    // Calculate received amount based on currency exchange
    let receivedAmount = data.amount;
    if (origin.currency === 'USD' && destination.currency === 'VES') {
      receivedAmount = Number((data.amount * data.exchangeRate).toFixed(2));
    } else if (origin.currency === 'VES' && destination.currency === 'USD') {
      receivedAmount = Number((data.amount / data.exchangeRate).toFixed(2));
    }

    const originNewBalance = Number((origin.currentBalance - data.amount).toFixed(2));
    const destNewBalance = Number((destination.currentBalance + receivedAmount).toFixed(2));

    const refNumber = data.referenceNumber || `TRF-${Date.now().toString().slice(-6)}`;

    return await withTransaction(async (conn) => {
      // 1. Debit origin account
      await conn.query(
        `UPDATE bank_accounts SET current_balance = ? WHERE id = ?`,
        [originNewBalance, origin.id]
      );

      const outMovementId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO bank_movements (
          id, account_id, user_id, movement_type, amount, balance_after,
          movement_date, reference_number, concept, destination_account_id, is_reconciled
        ) VALUES (?, ?, ?, 'TRANSFER_OUT', ?, ?, NOW(), ?, ?, ?, 1)`,
        [
          outMovementId,
          origin.id,
          userId,
          -data.amount,
          originNewBalance,
          refNumber,
          `Transferencia a ${destination.bankName} (${destination.accountNumber.slice(-4)}): ${data.concept}`,
          destination.id,
        ]
      );

      // 2. Credit destination account
      await conn.query(
        `UPDATE bank_accounts SET current_balance = ? WHERE id = ?`,
        [destNewBalance, destination.id]
      );

      const inMovementId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO bank_movements (
          id, account_id, user_id, movement_type, amount, balance_after,
          movement_date, reference_number, concept, destination_account_id, is_reconciled
        ) VALUES (?, ?, ?, 'TRANSFER_IN', ?, ?, NOW(), ?, ?, ?, 1)`,
        [
          inMovementId,
          destination.id,
          userId,
          receivedAmount,
          destNewBalance,
          refNumber,
          `Transferencia desde ${origin.bankName} (${origin.accountNumber.slice(-4)}): ${data.concept}`,
          origin.id,
        ]
      );

      return {
        transferReference: refNumber,
        originAccountId: origin.id,
        originDebited: data.amount,
        originCurrency: origin.currency,
        originNewBalance,
        destAccountId: destination.id,
        destCredited: receivedAmount,
        destCurrency: destination.currency,
        destNewBalance,
        exchangeRate: data.exchangeRate,
      };
    });
  }

  /**
   * Concilia o desconcilia un movimiento individual de forma directa
   */
  static async toggleMovementReconciled(
    companyId: string,
    movementId: string,
    isReconciledTarget?: boolean
  ) {
    const rows = await query<any>(
      `SELECT bm.id, bm.account_id, bm.is_reconciled, bm.amount, bm.reference_number,
              ba.company_id, ba.current_balance
       FROM bank_movements bm
       INNER JOIN bank_accounts ba ON bm.account_id = ba.id
       WHERE bm.id = ? AND ba.company_id = ?`,
      [movementId, companyId]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Movimiento bancario no encontrado');
    }

    const current = Boolean(rows[0].is_reconciled);
    const newStatus = isReconciledTarget !== undefined ? isReconciledTarget : !current;

    await query(
      `UPDATE bank_movements
       SET is_reconciled = ?, reconciliation_id = CASE WHEN ? = 0 THEN NULL ELSE reconciliation_id END
       WHERE id = ?`,
      [newStatus ? 1 : 0, newStatus ? 1 : 0, movementId]
    );

    const account = await this.getAccountById(rows[0].account_id, companyId);
    return {
      movementId,
      accountId: rows[0].account_id,
      isReconciled: newStatus,
      account,
    };
  }

  /**
   * Concilia o desconcilia un lote de movimientos bancarios seleccionados
   */
  static async bulkReconcileMovements(
    companyId: string,
    data: BulkReconcileMovementsInput
  ) {
    await this.getAccountById(data.accountId, companyId);

    if (!data.movementIds || data.movementIds.length === 0) {
      return { updatedCount: 0 };
    }

    await query(
      `UPDATE bank_movements
       SET is_reconciled = ?, reconciliation_id = CASE WHEN ? = 0 THEN NULL ELSE reconciliation_id END
       WHERE id IN (?) AND account_id = ?`,
      [data.isReconciled ? 1 : 0, data.isReconciled ? 1 : 0, data.movementIds, data.accountId]
    );

    const account = await this.getAccountById(data.accountId, companyId);
    return {
      updatedCount: data.movementIds.length,
      isReconciled: data.isReconciled,
      account,
    };
  }

  /**
   * Obtiene el historial de conciliaciones realizadas para una cuenta bancaria
   */
  static async getAccountReconciliations(companyId: string, accountId: string) {
    await this.getAccountById(accountId, companyId);

    const rows = await query<any>(
      `SELECT br.id, br.account_id, br.user_id, br.period_start, br.period_end,
              br.initial_book_balance, br.final_book_balance, br.bank_statement_balance,
              br.difference, br.status, br.notes, br.created_at,
              u.full_name as user_name
       FROM bank_reconciliations br
       LEFT JOIN users u ON br.user_id = u.id
       WHERE br.account_id = ?
       ORDER BY br.period_end DESC, br.created_at DESC`,
      [accountId]
    );

    return rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      userId: r.user_id,
      userName: r.user_name || 'Sistema',
      periodStart: r.period_start,
      periodEnd: r.period_end,
      initialBookBalance: Number(r.initial_book_balance),
      finalBookBalance: Number(r.final_book_balance),
      bankStatementBalance: Number(r.bank_statement_balance),
      difference: Number(r.difference),
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
    }));
  }

  /**
   * Procesa la conciliación formal del extracto bancario con algoritmo de cruce optimizado
   */
  static async reconcileStatement(companyId: string, userId: string, data: ReconcileStatementInput) {
    const account = await this.getAccountById(data.accountId, companyId);
    const reconciliationId = crypto.randomUUID();

    // Movimientos pendientes en libros para esta cuenta
    const pendingMovements = await query<any>(
      `SELECT id, amount, reference_number, movement_date, concept
       FROM bank_movements
       WHERE account_id = ? AND is_reconciled = 0`,
      [account.id]
    );

    const matchedMovementIds: string[] = [];
    const unmatchedStatementItems: any[] = [];

    for (const stmtItem of data.statementItems) {
      // 1. Coincidencia directa por ID asignado explícitamente en UI
      if (stmtItem.matchedMovementId) {
        const directMatch = pendingMovements.find(
          (m: any) => m.id === stmtItem.matchedMovementId && !matchedMovementIds.includes(m.id)
        );
        if (directMatch) {
          matchedMovementIds.push(directMatch.id);
          continue;
        }
      }

      // 2. Coincidencia inteligente por referencia y monto
      const refClean = stmtItem.referenceNumber ? stmtItem.referenceNumber.trim().toLowerCase() : '';
      const refSuffix = refClean.length >= 4 ? refClean.slice(-6) : refClean;

      const match = pendingMovements.find((m: any) => {
        if (matchedMovementIds.includes(m.id)) return false;

        const mRef = m.reference_number ? m.reference_number.trim().toLowerCase() : '';
        const mRefSuffix = mRef.length >= 4 ? mRef.slice(-6) : mRef;

        const exactRef = refClean && mRef && refClean === mRef;
        const suffixRef = refSuffix && mRefSuffix && (mRef.endsWith(refSuffix) || refClean.endsWith(mRefSuffix));
        const amountMatch = Math.abs(Number(m.amount) - stmtItem.amount) < 0.01;

        if (exactRef) return true;
        if (suffixRef && amountMatch) return true;
        if (!refClean && amountMatch) return true;

        return false;
      });

      if (match) {
        matchedMovementIds.push(match.id);
      } else {
        unmatchedStatementItems.push(stmtItem);
      }
    }

    const finalBookBalance = account.currentBalance;
    const difference = Number((data.statementEndingBalance - finalBookBalance).toFixed(2));
    const status = Math.abs(difference) < 0.01 ? 'RECONCILED' : 'DISCREPANCY';

    return await withTransaction(async (conn) => {
      // 1. Asentar los movimientos coincidentes como conciliados
      if (matchedMovementIds.length > 0) {
        await conn.query(
          `UPDATE bank_movements
           SET is_reconciled = 1, reconciliation_id = ?
           WHERE id IN (?)`,
          [reconciliationId, matchedMovementIds]
        );
      }

      // 2. Insertar cabecera oficial de conciliación bancaria
      await conn.query(
        `INSERT INTO bank_reconciliations (
          id, account_id, user_id, period_start, period_end, initial_book_balance,
          final_book_balance, bank_statement_balance, difference, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reconciliationId,
          account.id,
          userId,
          data.periodStart,
          data.periodEnd,
          account.currentBalance,
          finalBookBalance,
          data.statementEndingBalance,
          difference,
          status,
          data.notes || null,
        ]
      );

      const refreshedAccount = await this.getAccountById(account.id, companyId);

      return {
        reconciliationId,
        accountId: account.id,
        matchedCount: matchedMovementIds.length,
        unmatchedCount: unmatchedStatementItems.length,
        unmatchedItems: unmatchedStatementItems,
        bookBalance: finalBookBalance,
        realBalance: refreshedAccount.realBalance,
        statementEndingBalance: data.statementEndingBalance,
        difference,
        status,
      };
    });
  }

  static async getTreasurySummary(companyId: string, branchId?: string) {
    const accounts = await this.getBankAccounts(companyId, branchId);

    const totalVesBook = accounts
      .filter((a) => a.currency === 'VES')
      .reduce((sum, a) => sum + a.currentBalance, 0);

    const totalVesReal = accounts
      .filter((a) => a.currency === 'VES')
      .reduce((sum, a) => sum + a.realBalance, 0);

    const totalUsdBook = accounts
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + a.currentBalance, 0);

    const totalUsdReal = accounts
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + a.realBalance, 0);

    const totalPendingReconciliations = accounts.reduce(
      (sum, a) => sum + a.pendingReconciliationsCount,
      0
    );

    const totalUnclearedDepositsVes = accounts
      .filter((a) => a.currency === 'VES')
      .reduce((sum, a) => sum + a.unclearedDeposits, 0);

    const totalUnclearedWithdrawalsVes = accounts
      .filter((a) => a.currency === 'VES')
      .reduce((sum, a) => sum + a.unclearedWithdrawals, 0);

    const totalUnclearedDepositsUsd = accounts
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + a.unclearedDeposits, 0);

    const totalUnclearedWithdrawalsUsd = accounts
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + a.unclearedWithdrawals, 0);

    return {
      totalVes: Number(totalVesBook.toFixed(2)),
      totalVesBook: Number(totalVesBook.toFixed(2)),
      totalVesReal: Number(totalVesReal.toFixed(2)),
      totalUsd: Number(totalUsdBook.toFixed(2)),
      totalUsdBook: Number(totalUsdBook.toFixed(2)),
      totalUsdReal: Number(totalUsdReal.toFixed(2)),
      totalUnclearedDepositsVes: Number(totalUnclearedDepositsVes.toFixed(2)),
      totalUnclearedWithdrawalsVes: Number(totalUnclearedWithdrawalsVes.toFixed(2)),
      totalUnclearedDepositsUsd: Number(totalUnclearedDepositsUsd.toFixed(2)),
      totalUnclearedWithdrawalsUsd: Number(totalUnclearedWithdrawalsUsd.toFixed(2)),
      activeAccountsCount: accounts.length,
      pendingReconciliationsCount: totalPendingReconciliations,
      accounts,
    };
  }
}
