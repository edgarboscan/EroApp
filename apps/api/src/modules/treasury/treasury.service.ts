import { query, withTransaction } from '../../db';
import {
  BankAccountInput,
  BankMovementInput,
  TransferBetweenAccountsInput,
  ReconcileStatementInput,
} from '@ero/shared';
import crypto from 'crypto';

export class TreasuryService {
  static async getBanks() {
    return await query<any>(
      `SELECT id, code, name, is_active FROM banks WHERE is_active = 1 ORDER BY code ASC`
    );
  }

  static async getBankAccounts(companyId: string) {
    const rows = await query<any>(
      `SELECT ba.id, ba.company_id, ba.bank_id, ba.branch_id,
              b.code as bank_code, b.name as bank_name,
              br.name as branch_name,
              ba.account_number, ba.account_type, ba.currency,
              ba.description, ba.current_balance, ba.is_active,
              COUNT(CASE WHEN bm.is_reconciled = 0 THEN 1 END) as pending_reconciliations_count
       FROM bank_accounts ba
       INNER JOIN banks b ON ba.bank_id = b.id
       LEFT JOIN branches br ON ba.branch_id = br.id
       LEFT JOIN bank_movements bm ON ba.id = bm.account_id
       WHERE ba.company_id = ? AND ba.is_active = 1
       GROUP BY ba.id
       ORDER BY ba.currency DESC, b.name ASC`,
      [companyId]
    );

    return rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      bankId: r.bank_id,
      bankCode: r.bank_code,
      bankName: r.bank_name,
      branchId: r.branch_id,
      branchName: r.branch_name,
      accountNumber: r.account_number,
      accountType: r.account_type,
      currency: r.currency,
      description: r.description,
      currentBalance: Number(r.current_balance),
      isActive: Boolean(r.is_active),
      pendingReconciliationsCount: Number(r.pending_reconciliations_count),
    }));
  }

  static async getAccountById(id: string, companyId: string) {
    const rows = await query<any>(
      `SELECT ba.*, b.code as bank_code, b.name as bank_name, br.name as branch_name
       FROM bank_accounts ba
       INNER JOIN banks b ON ba.bank_id = b.id
       LEFT JOIN branches br ON ba.branch_id = br.id
       WHERE ba.id = ? AND ba.company_id = ?`,
      [id, companyId]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Cuenta bancaria no encontrada');
    }

    const r = rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      bankId: r.bank_id,
      bankCode: r.bank_code,
      bankName: r.bank_name,
      branchId: r.branch_id,
      branchName: r.branch_name,
      accountNumber: r.account_number,
      accountType: r.account_type,
      currency: r.currency,
      description: r.description,
      currentBalance: Number(r.current_balance),
      isActive: Boolean(r.is_active),
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

      return { id: accountId, ...data, currentBalance: initBalance };
    });
  }

  static async getAccountMovements(
    accountId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string,
    isReconciled?: boolean
  ) {
    await this.getAccountById(accountId, companyId);

    let sql = `
      SELECT bm.id, bm.account_id, bm.user_id, bm.movement_type, bm.amount,
             bm.balance_after, bm.movement_date, bm.reference_number,
             bm.concept, bm.destination_account_id, bm.is_reconciled,
             u.full_name as user_name
      FROM bank_movements bm
      LEFT JOIN users u ON bm.user_id = u.id
      WHERE bm.account_id = ?
    `;
    const params: any[] = [accountId];

    if (fromDate) {
      sql += ` AND bm.movement_date >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND bm.movement_date <= ?`;
      params.push(toDate);
    }
    if (isReconciled !== undefined) {
      sql += ` AND bm.is_reconciled = ?`;
      params.push(isReconciled ? 1 : 0);
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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

  static async reconcileStatement(companyId: string, userId: string, data: ReconcileStatementInput) {
    const account = await this.getAccountById(data.accountId, companyId);
    const reconciliationId = crypto.randomUUID();

    // Fetch un-reconciled movements for this account
    const pendingMovements = await query<any>(
      `SELECT id, amount, reference_number, movement_date, concept
       FROM bank_movements
       WHERE account_id = ? AND is_reconciled = 0`,
      [account.id]
    );

    const matchedMovementIds: string[] = [];
    const unmatchedStatementItems: any[] = [];

    for (const stmtItem of data.statementItems) {
      // Find matching un-reconciled movement by reference or approximate amount
      const match = pendingMovements.find((m) => {
        if (matchedMovementIds.includes(m.id)) return false;

        const refMatch =
          stmtItem.referenceNumber &&
          m.reference_number &&
          stmtItem.referenceNumber.trim().toLowerCase() === m.reference_number.trim().toLowerCase();

        const amountMatch = Math.abs(Number(m.amount) - stmtItem.amount) < 0.01;

        return refMatch || amountMatch;
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
      // 1. Mark matched movements as reconciled
      if (matchedMovementIds.length > 0) {
        await conn.query(
          `UPDATE bank_movements
           SET is_reconciled = 1, reconciliation_id = ?
           WHERE id IN (?)`,
          [reconciliationId, matchedMovementIds]
        );
      }

      // 2. Insert bank_reconciliation record
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

      return {
        reconciliationId,
        accountId: account.id,
        matchedCount: matchedMovementIds.length,
        unmatchedCount: unmatchedStatementItems.length,
        unmatchedItems: unmatchedStatementItems,
        bookBalance: finalBookBalance,
        statementEndingBalance: data.statementEndingBalance,
        difference,
        status,
      };
    });
  }

  static async getTreasurySummary(companyId: string) {
    const accounts = await this.getBankAccounts(companyId);

    const totalVes = accounts
      .filter((a) => a.currency === 'VES')
      .reduce((sum, a) => sum + a.currentBalance, 0);

    const totalUsd = accounts
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + a.currentBalance, 0);

    const totalPendingReconciliations = accounts.reduce(
      (sum, a) => sum + a.pendingReconciliationsCount,
      0
    );

    return {
      totalVes: Number(totalVes.toFixed(2)),
      totalUsd: Number(totalUsd.toFixed(2)),
      activeAccountsCount: accounts.length,
      pendingReconciliationsCount: totalPendingReconciliations,
      accounts,
    };
  }
}
