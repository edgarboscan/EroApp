import { query, pool, withTransaction } from '../../db';
import crypto from 'crypto';
import {
  AccountInput,
  JournalEntryInput,
  TrialBalanceFilter,
  GeneralLedgerFilter,
  FinancialStatementFilter,
  InflationAdjustmentProcessInput,
  ExchangeDifferenceProcessInput,
} from '@ero/shared';

const uuidv4 = () => crypto.randomUUID();

export class AccountingService {
  // ==========================================================================
  // 1. PLAN DE CUENTAS (CATÁLOGO CONTABLE)
  // ==========================================================================

  static async getAccounts(
    companyId: string,
    filters?: { search?: string; type?: string; level?: number; activeOnly?: boolean }
  ) {
    let sql = `
      SELECT a.*, 
             p.code as parent_code, p.name as parent_name,
             COALESCE(b.total_debit_ves, 0) as total_debit_ves,
             COALESCE(b.total_credit_ves, 0) as total_credit_ves,
             COALESCE(b.total_debit_usd, 0) as total_debit_usd,
             COALESCE(b.total_credit_usd, 0) as total_credit_usd
      FROM accounting_accounts a
      LEFT JOIN accounting_accounts p ON a.parent_id = p.id
      LEFT JOIN (
        SELECT l.account_id,
               SUM(l.debit_ves) as total_debit_ves,
               SUM(l.credit_ves) as total_credit_ves,
               SUM(l.debit_usd) as total_debit_usd,
               SUM(l.credit_usd) as total_credit_usd
        FROM accounting_journal_lines l
        INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
        WHERE e.company_id = ? AND e.status = 'POSTED'
        GROUP BY l.account_id
      ) b ON a.id = b.account_id
      WHERE a.company_id = ?
    `;
    const params: any[] = [companyId, companyId];

    if (filters?.search) {
      sql += ` AND (a.code LIKE ? OR a.name LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters?.type) {
      sql += ` AND a.account_type = ?`;
      params.push(filters.type);
    }

    if (filters?.level) {
      sql += ` AND a.level <= ?`;
      params.push(filters.level);
    }

    if (filters?.activeOnly) {
      sql += ` AND a.is_active = 1`;
    }

    sql += ` ORDER BY a.code ASC`;

    const rows = await query<any>(sql, params);

    return rows.map((r: any) => {
      const isDebitNormal = r.normal_balance === 'DEBIT';
      const balanceVes = isDebitNormal
        ? Number(r.total_debit_ves) - Number(r.total_credit_ves)
        : Number(r.total_credit_ves) - Number(r.total_debit_ves);
      const balanceUsd = isDebitNormal
        ? Number(r.total_debit_usd) - Number(r.total_credit_usd)
        : Number(r.total_credit_usd) - Number(r.total_debit_usd);

      return {
        id: r.id,
        companyId: r.company_id,
        code: r.code,
        name: r.name,
        level: r.level,
        parentId: r.parent_id,
        parentCode: r.parent_code,
        parentName: r.parent_name,
        accountType: r.account_type,
        classification: r.classification,
        normalBalance: r.normal_balance,
        acceptsPostings: Boolean(r.accepts_postings),
        isMonetary: Boolean(r.is_monetary),
        isBankOrCash: Boolean(r.is_bank_or_cash),
        isActive: Boolean(r.is_active),
        notes: r.notes,
        totalDebitVes: Number(r.total_debit_ves),
        totalCreditVes: Number(r.total_credit_ves),
        totalDebitUsd: Number(r.total_debit_usd),
        totalCreditUsd: Number(r.total_credit_usd),
        balanceVes,
        balanceUsd,
      };
    });
  }

  static async getAccountById(companyId: string, id: string) {
    const rows = await query<any>(
      `SELECT a.*, p.code as parent_code, p.name as parent_name
       FROM accounting_accounts a
       LEFT JOIN accounting_accounts p ON a.parent_id = p.id
       WHERE a.id = ? AND a.company_id = ?`,
      [id, companyId]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      companyId: r.company_id,
      code: r.code,
      name: r.name,
      level: r.level,
      parentId: r.parent_id,
      parentCode: r.parent_code,
      parentName: r.parent_name,
      accountType: r.account_type,
      classification: r.classification,
      normalBalance: r.normal_balance,
      acceptsPostings: Boolean(r.accepts_postings),
      isMonetary: Boolean(r.is_monetary),
      isBankOrCash: Boolean(r.is_bank_or_cash),
      isActive: Boolean(r.is_active),
      notes: r.notes,
    };
  }

  static async createAccount(companyId: string, data: AccountInput) {
    // Verificar código duplicado
    const existing = await query<any>(
      `SELECT id FROM accounting_accounts WHERE company_id = ? AND code = ?`,
      [companyId, data.code]
    );
    if (existing.length > 0) {
      throw new Error(`El código contable ${data.code} ya se encuentra registrado`);
    }

    const id = data.id || uuidv4();
    await query(
      `INSERT INTO accounting_accounts (
        id, company_id, code, name, level, parent_id, account_type,
        classification, normal_balance, accepts_postings, is_monetary,
        is_bank_or_cash, is_active, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        data.code,
        data.name,
        data.level,
        data.parentId || null,
        data.accountType,
        data.classification,
        data.normalBalance,
        data.acceptsPostings ? 1 : 0,
        data.isMonetary ? 1 : 0,
        data.isBankOrCash ? 1 : 0,
        data.isActive ? 1 : 0,
        data.notes || null,
      ]
    );

    return this.getAccountById(companyId, id);
  }

  static async updateAccount(companyId: string, id: string, data: Partial<AccountInput>) {
    const existing = await this.getAccountById(companyId, id);
    if (!existing) throw new Error('Cuenta contable no encontrada');

    if (data.code && data.code !== existing.code) {
      const codeCheck = await query<any>(
        `SELECT id FROM accounting_accounts WHERE company_id = ? AND code = ? AND id != ?`,
        [companyId, data.code, id]
      );
      if (codeCheck.length > 0) {
        throw new Error(`El código contable ${data.code} ya está en uso`);
      }
    }

    await query(
      `UPDATE accounting_accounts SET
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        level = COALESCE(?, level),
        parent_id = ?,
        account_type = COALESCE(?, account_type),
        classification = COALESCE(?, classification),
        normal_balance = COALESCE(?, normal_balance),
        accepts_postings = COALESCE(?, accepts_postings),
        is_monetary = COALESCE(?, is_monetary),
        is_bank_or_cash = COALESCE(?, is_bank_or_cash),
        is_active = COALESCE(?, is_active),
        notes = ?
       WHERE id = ? AND company_id = ?`,
      [
        data.code,
        data.name,
        data.level,
        data.parentId !== undefined ? data.parentId : existing.parentId,
        data.accountType,
        data.classification,
        data.normalBalance,
        data.acceptsPostings !== undefined ? (data.acceptsPostings ? 1 : 0) : undefined,
        data.isMonetary !== undefined ? (data.isMonetary ? 1 : 0) : undefined,
        data.isBankOrCash !== undefined ? (data.isBankOrCash ? 1 : 0) : undefined,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : undefined,
        data.notes !== undefined ? data.notes : existing.notes,
        id,
        companyId,
      ]
    );

    return this.getAccountById(companyId, id);
  }

  static async deleteAccount(companyId: string, id: string) {
    // Validar si tiene subcuentas hijas
    const children = await query<any>(
      `SELECT COUNT(*) as count FROM accounting_accounts WHERE parent_id = ?`,
      [id]
    );
    if (children[0].count > 0) {
      throw new Error('No se puede eliminar la cuenta porque contiene subcuentas jerárquicas');
    }

    // Validar si tiene asientos contables registrados
    const lines = await query<any>(
      `SELECT COUNT(*) as count FROM accounting_journal_lines WHERE account_id = ?`,
      [id]
    );
    if (lines[0].count > 0) {
      throw new Error('No se puede eliminar la cuenta porque posee movimientos contables registrados en el Libro Diario');
    }

    await query(`DELETE FROM accounting_accounts WHERE id = ? AND company_id = ?`, [id, companyId]);
    return { success: true };
  }

  // ==========================================================================
  // 2. LIBRO DIARIO (JOURNAL ENTRIES / COMPROBANTES)
  // ==========================================================================

  static async getJournalEntries(
    companyId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      type?: string;
      search?: string;
    }
  ) {
    let sql = `
      SELECT e.*, b.name as branch_name, u.full_name as created_by_name, p.full_name as posted_by_name,
             (SELECT COUNT(*) FROM accounting_journal_lines l WHERE l.journal_entry_id = e.id) as line_count
      FROM accounting_journal_entries e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN users p ON e.posted_by = p.id
      WHERE e.company_id = ?
    `;
    const params: any[] = [companyId];

    if (filters?.startDate) {
      sql += ` AND e.entry_date >= ?`;
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ` AND e.entry_date <= ?`;
      params.push(filters.endDate);
    }
    if (filters?.status) {
      sql += ` AND e.status = ?`;
      params.push(filters.status);
    }
    if (filters?.type) {
      sql += ` AND e.entry_type = ?`;
      params.push(filters.type);
    }
    if (filters?.search) {
      sql += ` AND (e.entry_number LIKE ? OR e.concept LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ` ORDER BY e.entry_date DESC, e.entry_number DESC`;

    const rows = await query<any>(sql, params);
    return rows.map((r: any) => ({
      id: r.id,
      companyId: r.company_id,
      branchId: r.branch_id,
      branchName: r.branch_name,
      periodId: r.period_id,
      entryNumber: r.entry_number,
      entryDate: r.entry_date,
      entryType: r.entry_type,
      concept: r.concept,
      notes: r.notes,
      currency: r.currency,
      exchangeRate: Number(r.exchange_rate),
      totalDebitVes: Number(r.total_debit_ves),
      totalCreditVes: Number(r.total_credit_ves),
      totalDebitUsd: Number(r.total_debit_usd),
      totalCreditUsd: Number(r.total_credit_usd),
      status: r.status,
      createdByName: r.created_by_name,
      postedByName: r.posted_by_name,
      postedAt: r.posted_at,
      lineCount: Number(r.line_count),
      createdAt: r.created_at,
    }));
  }

  static async getJournalEntryById(companyId: string, id: string) {
    const entries = await query<any>(
      `SELECT e.*, b.name as branch_name, u.full_name as created_by_name, p.full_name as posted_by_name
       FROM accounting_journal_entries e
       LEFT JOIN branches b ON e.branch_id = b.id
       LEFT JOIN users u ON e.created_by = u.id
       LEFT JOIN users p ON e.posted_by = p.id
       WHERE e.id = ? AND e.company_id = ?`,
      [id, companyId]
    );

    if (!entries || entries.length === 0) return null;
    const e = entries[0];

    const lines = await query<any>(
      `SELECT l.*, a.code as account_code, a.name as account_name
       FROM accounting_journal_lines l
       INNER JOIN accounting_accounts a ON l.account_id = a.id
       WHERE l.journal_entry_id = ?
       ORDER BY l.line_order ASC`,
      [id]
    );

    return {
      id: e.id,
      companyId: e.company_id,
      branchId: e.branch_id,
      branchName: e.branch_name,
      periodId: e.period_id,
      entryNumber: e.entry_number,
      entryDate: e.entry_date,
      entryType: e.entry_type,
      concept: e.concept,
      notes: e.notes,
      currency: e.currency,
      exchangeRate: Number(e.exchange_rate),
      totalDebitVes: Number(e.total_debit_ves),
      totalCreditVes: Number(e.total_credit_ves),
      totalDebitUsd: Number(e.total_debit_usd),
      totalCreditUsd: Number(e.total_credit_usd),
      status: e.status,
      createdBy: e.created_by,
      createdByName: e.created_by_name,
      postedBy: e.posted_by,
      postedByName: e.posted_by_name,
      postedAt: e.posted_at,
      reversedEntryId: e.reversed_entry_id,
      lines: lines.map((l: any) => ({
        id: l.id,
        accountId: l.account_id,
        accountCode: l.account_code,
        accountName: l.account_name,
        lineOrder: l.line_order,
        description: l.description,
        debitVes: Number(l.debit_ves),
        creditVes: Number(l.credit_ves),
        debitUsd: Number(l.debit_usd),
        creditUsd: Number(l.credit_usd),
        referenceDoc: l.reference_doc,
      })),
    };
  }

  static async createJournalEntry(companyId: string, userId: string, data: JournalEntryInput) {
    return await withTransaction(async (conn) => {
      // 1. Obtener correlativo consecutivo por año
      const entryYear = new Date(data.entryDate).getFullYear();
      const [lastNumberRows]: any = await conn.query(
        `SELECT entry_number FROM accounting_journal_entries 
         WHERE company_id = ? AND entry_number LIKE ? 
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [companyId, `AS-${entryYear}-%`]
      );

      let nextSeq = 1;
      if (lastNumberRows.length > 0) {
        const lastNum = lastNumberRows[0].entry_number;
        const parts = lastNum.split('-');
        if (parts.length >= 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num)) nextSeq = num + 1;
        }
      }
      const entryNumber = data.entryNumber || `AS-${entryYear}-${String(nextSeq).padStart(5, '0')}`;

      // 2. Asociar período fiscal abierto
      const entryMonth = new Date(data.entryDate).getMonth() + 1;
      const [periodRows]: any = await conn.query(
        `SELECT p.id, p.status 
         FROM accounting_fiscal_periods p
         INNER JOIN accounting_fiscal_years y ON p.fiscal_year_id = y.id
         WHERE y.company_id = ? AND y.year = ? AND p.month = ?`,
        [companyId, entryYear, entryMonth]
      );

      const periodId = periodRows.length > 0 ? periodRows[0].id : null;
      if (periodRows.length > 0 && periodRows[0].status === 'LOCKED') {
        throw new Error(`El período fiscal ${entryYear}-${String(entryMonth).padStart(2, '0')} está BLOQUEADO para nuevos asientos.`);
      }

      // 3. Totales de partida doble
      const rate = data.exchangeRate || 1;
      let totalDebitVes = 0;
      let totalCreditVes = 0;
      let totalDebitUsd = 0;
      let totalCreditUsd = 0;

      for (const line of data.lines) {
        const dVes = line.debitVes || 0;
        const cVes = line.creditVes || 0;
        const dUsd = line.debitUsd || (rate > 0 ? dVes / rate : 0);
        const cUsd = line.creditUsd || (rate > 0 ? cVes / rate : 0);

        totalDebitVes += dVes;
        totalCreditVes += cVes;
        totalDebitUsd += dUsd;
        totalCreditUsd += cUsd;
      }

      // Validación estricta de partida doble (Código de Comercio Art. 32-38)
      if (Math.abs(totalDebitVes - totalCreditVes) > 0.05) {
        throw new Error(`Partida Doble Descuadrada: Débitos (Bs. ${totalDebitVes.toFixed(2)}) != Créditos (Bs. ${totalCreditVes.toFixed(2)})`);
      }

      const entryId = data.id || uuidv4();

      await conn.query(
        `INSERT INTO accounting_journal_entries (
          id, company_id, branch_id, period_id, entry_number, entry_date,
          entry_type, concept, notes, currency, exchange_rate,
          total_debit_ves, total_credit_ves, total_debit_usd, total_credit_usd,
          status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
        [
          entryId,
          companyId,
          data.branchId || null,
          periodId,
          entryNumber,
          data.entryDate,
          data.entryType,
          data.concept,
          data.notes || null,
          data.currency,
          rate,
          totalDebitVes,
          totalCreditVes,
          totalDebitUsd,
          totalCreditUsd,
          userId,
        ]
      );

      // Insertar líneas
      let order = 1;
      for (const line of data.lines) {
        const lineId = uuidv4();
        const dVes = line.debitVes || 0;
        const cVes = line.creditVes || 0;
        const dUsd = line.debitUsd || (rate > 0 ? dVes / rate : 0);
        const cUsd = line.creditUsd || (rate > 0 ? cVes / rate : 0);

        await conn.query(
          `INSERT INTO accounting_journal_lines (
            id, journal_entry_id, account_id, line_order, description,
            debit_ves, credit_ves, debit_usd, credit_usd, reference_doc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lineId,
            entryId,
            line.accountId,
            order++,
            line.description,
            dVes,
            cVes,
            dUsd,
            cUsd,
            line.referenceDoc || null,
          ]
        );
      }

      return { id: entryId, entryNumber };
    });
  }

  static async postJournalEntry(companyId: string, userId: string, id: string) {
    const entry = await this.getJournalEntryById(companyId, id);
    if (!entry) throw new Error('Comprobante contable no encontrado');
    if (entry.status === 'POSTED') throw new Error('El comprobante ya se encuentra asentado legalmente');
    if (entry.status === 'ANNULLED') throw new Error('No se puede asentar un comprobante anulado');

    await query(
      `UPDATE accounting_journal_entries 
       SET status = 'POSTED', posted_by = ?, posted_at = NOW() 
       WHERE id = ? AND company_id = ?`,
      [userId, id, companyId]
    );

    return this.getJournalEntryById(companyId, id);
  }

  static async annulJournalEntry(companyId: string, userId: string, id: string, reason: string) {
    const entry = await this.getJournalEntryById(companyId, id);
    if (!entry) throw new Error('Comprobante contable no encontrado');
    if (entry.status === 'ANNULLED') throw new Error('El comprobante ya está anulado');

    return await withTransaction(async (conn) => {
      // Si ya estaba asentado (POSTED), generamos automáticamente un comprobante de reverso
      // para cumplir con el Código de Comercio (Art. 32: prohibición de borrar o enmendar asientos legales)
      if (entry.status === 'POSTED') {
        const entryYear = new Date().getFullYear();
        const reversalNumber = `REV-${entry.entryNumber}`;

        const revEntryId = uuidv4();
        await conn.query(
          `INSERT INTO accounting_journal_entries (
            id, company_id, branch_id, period_id, entry_number, entry_date,
            entry_type, concept, notes, currency, exchange_rate,
            total_debit_ves, total_credit_ves, total_debit_usd, total_credit_usd,
            status, created_by, posted_by, posted_at, reversed_entry_id
          ) VALUES (
            ?, ?, ?, ?, ?, CURDATE(), 'ADJUSTMENT',
            ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, NOW(), ?
          )`,
          [
            revEntryId,
            companyId,
            entry.branchId,
            entry.periodId,
            reversalNumber,
            `Reverso por Anulación de Asiento ${entry.entryNumber}: ${reason}`,
            `Motivo de anulación: ${reason}`,
            entry.currency,
            entry.exchangeRate,
            entry.totalCreditVes, // Invertir totales
            entry.totalDebitVes,
            entry.totalCreditUsd,
            entry.totalDebitUsd,
            userId,
            userId,
            entry.id,
          ]
        );

        // Invertir cada línea
        let ord = 1;
        for (const line of entry.lines) {
          await conn.query(
            `INSERT INTO accounting_journal_lines (
              id, journal_entry_id, account_id, line_order, description,
              debit_ves, credit_ves, debit_usd, credit_usd, reference_doc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              revEntryId,
              line.accountId,
              ord++,
              `Reverso: ${line.description}`,
              line.creditVes, // Invertido
              line.debitVes,
              line.creditUsd,
              line.debitUsd,
              `REV-${entry.entryNumber}`,
            ]
          );
        }
      }

      await conn.query(
        `UPDATE accounting_journal_entries 
         SET status = 'ANNULLED', notes = CONCAT(COALESCE(notes, ''), ' [ANULADO: ', ?, ']')
         WHERE id = ? AND company_id = ?`,
        [reason, id, companyId]
      );

      return { success: true, message: 'Comprobante anulado conforme al Código de Comercio' };
    });
  }

  // ==========================================================================
  // 3. LIBRO MAYOR (GENERAL LEDGER / ANALÍTICO DE CUENTAS)
  // ==========================================================================

  static async getGeneralLedger(companyId: string, filters?: GeneralLedgerFilter) {
    const startDate = filters?.startDate || `${new Date().getFullYear()}-01-01`;
    const endDate = filters?.endDate || `${new Date().getFullYear()}-12-31`;

    let accountsSql = `
      SELECT id, code, name, normal_balance, account_type, classification
      FROM accounting_accounts
      WHERE company_id = ? AND accepts_postings = 1
    `;
    const accountParams: any[] = [companyId];

    if (filters?.accountId) {
      accountsSql += ` AND id = ?`;
      accountParams.push(filters.accountId);
    }

    accountsSql += ` ORDER BY code ASC`;
    const accounts = await query<any>(accountsSql, accountParams);

    const ledgerResults: any[] = [];

    for (const acc of accounts) {
      const isDebitNormal = acc.normal_balance === 'DEBIT';

      // Saldo Inicial anterior a startDate
      const initialRows = await query<any>(
        `SELECT SUM(l.debit_ves) as debit_ves, SUM(l.credit_ves) as credit_ves,
                SUM(l.debit_usd) as debit_usd, SUM(l.credit_usd) as credit_usd
         FROM accounting_journal_lines l
         INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
         WHERE e.company_id = ? AND e.status = 'POSTED' AND l.account_id = ? AND e.entry_date < ?`,
        [companyId, acc.id, startDate]
      );

      const initDebVes = Number(initialRows[0]?.debit_ves || 0);
      const initCredVes = Number(initialRows[0]?.credit_ves || 0);
      const initialBalanceVes = isDebitNormal ? initDebVes - initCredVes : initCredVes - initDebVes;

      const initDebUsd = Number(initialRows[0]?.debit_usd || 0);
      const initCredUsd = Number(initialRows[0]?.credit_usd || 0);
      const initialBalanceUsd = isDebitNormal ? initDebUsd - initCredUsd : initCredUsd - initDebUsd;

      // Movimientos del período
      const movements = await query<any>(
        `SELECT l.id, e.id as entry_id, e.entry_number, e.entry_date, e.concept,
                l.description, l.debit_ves, l.credit_ves, l.debit_usd, l.credit_usd,
                l.reference_doc
         FROM accounting_journal_lines l
         INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
         WHERE e.company_id = ? AND e.status = 'POSTED' AND l.account_id = ? 
           AND e.entry_date >= ? AND e.entry_date <= ?
         ORDER BY e.entry_date ASC, e.entry_number ASC, l.line_order ASC`,
        [companyId, acc.id, startDate, endDate]
      );

      let runningBalanceVes = initialBalanceVes;
      let runningBalanceUsd = initialBalanceUsd;
      let totalPeriodDebitVes = 0;
      let totalPeriodCreditVes = 0;

      const formattedMovements = movements.map((m: any) => {
        const dVes = Number(m.debit_ves);
        const cVes = Number(m.credit_ves);
        const dUsd = Number(m.debit_usd);
        const cUsd = Number(m.credit_usd);

        totalPeriodDebitVes += dVes;
        totalPeriodCreditVes += cVes;

        runningBalanceVes += isDebitNormal ? dVes - cVes : cVes - dVes;
        runningBalanceUsd += isDebitNormal ? dUsd - cUsd : cUsd - dUsd;

        return {
          id: m.id,
          entryId: m.entry_id,
          entryNumber: m.entry_number,
          entryDate: m.entry_date,
          concept: m.concept,
          description: m.description,
          referenceDoc: m.reference_doc,
          debitVes: dVes,
          creditVes: cVes,
          debitUsd: dUsd,
          creditUsd: cUsd,
          runningBalanceVes,
          runningBalanceUsd,
        };
      });

      // Incluir solo si tiene saldo inicial o movimientos
      if (initialBalanceVes !== 0 || movements.length > 0) {
        ledgerResults.push({
          account: {
            id: acc.id,
            code: acc.code,
            name: acc.name,
            normalBalance: acc.normal_balance,
            accountType: acc.account_type,
            classification: acc.classification,
          },
          initialBalanceVes,
          initialBalanceUsd,
          totalPeriodDebitVes,
          totalPeriodCreditVes,
          endingBalanceVes: runningBalanceVes,
          endingBalanceUsd: runningBalanceUsd,
          movements: formattedMovements,
        });
      }
    }

    return {
      startDate,
      endDate,
      accounts: ledgerResults,
    };
  }

  // ==========================================================================
  // 4. BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS)
  // ==========================================================================

  static async getTrialBalance(companyId: string, filters?: TrialBalanceFilter) {
    const startDate = filters?.startDate || `${new Date().getFullYear()}-01-01`;
    const endDate = filters?.endDate || `${new Date().getFullYear()}-12-31`;
    const maxLevel = filters?.level || 4;

    const accounts = await query<any>(
      `SELECT id, code, name, level, parent_id, account_type, classification, normal_balance, accepts_postings
       FROM accounting_accounts
       WHERE company_id = ? AND level <= ? AND is_active = 1
       ORDER BY code ASC`,
      [companyId, maxLevel]
    );

    // Obtener movimientos agregados por cuenta de detalle
    const movementsRows = await query<any>(
      `SELECT l.account_id,
              SUM(CASE WHEN e.entry_date < ? THEN l.debit_ves ELSE 0 END) as init_debit_ves,
              SUM(CASE WHEN e.entry_date < ? THEN l.credit_ves ELSE 0 END) as init_credit_ves,
              SUM(CASE WHEN e.entry_date >= ? AND e.entry_date <= ? THEN l.debit_ves ELSE 0 END) as period_debit_ves,
              SUM(CASE WHEN e.entry_date >= ? AND e.entry_date <= ? THEN l.credit_ves ELSE 0 END) as period_credit_ves
       FROM accounting_journal_lines l
       INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
       WHERE e.company_id = ? AND e.status = 'POSTED'
       GROUP BY l.account_id`,
      [startDate, startDate, startDate, endDate, startDate, endDate, companyId]
    );

    const movementMap = new Map<string, any>();
    for (const row of movementsRows) {
      movementMap.set(row.account_id, {
        initDebit: Number(row.init_debit_ves || 0),
        initCredit: Number(row.init_credit_ves || 0),
        periodDebit: Number(row.period_debit_ves || 0),
        periodCredit: Number(row.period_credit_ves || 0),
      });
    }

    // Acumular valores para cuentas padre
    const allAccountsRows = await query<any>(
      `SELECT id, code, parent_id, accepts_postings FROM accounting_accounts WHERE company_id = ?`,
      [companyId]
    );

    const resultRows = accounts.map((acc: any) => {
      // Sumar todos los movimientos de las cuentas de detalle cuyo código comience con el código de acc
      let initDebit = 0;
      let initCredit = 0;
      let periodDebit = 0;
      let periodCredit = 0;

      for (const item of allAccountsRows) {
        if (item.code.startsWith(acc.code) && item.accepts_postings === 1) {
          const mov = movementMap.get(item.id);
          if (mov) {
            initDebit += mov.initDebit;
            initCredit += mov.initCredit;
            periodDebit += mov.periodDebit;
            periodCredit += mov.periodCredit;
          }
        }
      }

      const isDebit = acc.normal_balance === 'DEBIT';
      const initNet = isDebit ? initDebit - initCredit : initCredit - initDebit;
      const endDebitTotal = initDebit + periodDebit;
      const endCreditTotal = initCredit + periodCredit;
      const finalNet = isDebit ? endDebitTotal - endCreditTotal : endCreditTotal - endDebitTotal;

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        level: acc.level,
        accountType: acc.account_type,
        normalBalance: acc.normal_balance,
        acceptsPostings: Boolean(acc.accepts_postings),
        initialDebit: initDebit,
        initialCredit: initCredit,
        initialBalance: initNet,
        periodDebit,
        periodCredit,
        finalDebit: endDebitTotal,
        finalCredit: endCreditTotal,
        finalBalance: finalNet,
      };
    });

    // Totales de comprobación (solo nivel 1 para no duplicar sumas jerárquicas)
    const level1Accounts = resultRows.filter((r) => r.level === 1);
    const totalInitialDebit = level1Accounts.reduce((acc, r) => acc + (r.normalBalance === 'DEBIT' && r.initialBalance > 0 ? r.initialBalance : 0), 0);
    const totalInitialCredit = level1Accounts.reduce((acc, r) => acc + (r.normalBalance === 'CREDIT' && r.initialBalance > 0 ? r.initialBalance : 0), 0);
    const totalPeriodDebit = level1Accounts.reduce((acc, r) => acc + r.periodDebit, 0);
    const totalPeriodCredit = level1Accounts.reduce((acc, r) => acc + r.periodCredit, 0);
    const totalFinalDebit = level1Accounts.reduce((acc, r) => acc + (r.normalBalance === 'DEBIT' && r.finalBalance > 0 ? r.finalBalance : 0), 0);
    const totalFinalCredit = level1Accounts.reduce((acc, r) => acc + (r.normalBalance === 'CREDIT' && r.finalBalance > 0 ? r.finalBalance : 0), 0);

    const isBalanced = Math.abs(totalPeriodDebit - totalPeriodCredit) < 0.05;

    return {
      startDate,
      endDate,
      level: maxLevel,
      isBalanced,
      totals: {
        totalInitialDebit,
        totalInitialCredit,
        totalPeriodDebit,
        totalPeriodCredit,
        totalFinalDebit,
        totalFinalCredit,
      },
      accounts: filters?.includeZeroBalance
        ? resultRows
        : resultRows.filter((r) => r.periodDebit !== 0 || r.periodCredit !== 0 || r.initialBalance !== 0 || r.finalBalance !== 0),
    };
  }

  // ==========================================================================
  // 5. ESTADOS FINANCIEROS (VEN-NIF / NIIF)
  // ==========================================================================

  /**
   * Estado de Situación Financiera (Balance General)
   */
  static async getBalanceSheet(companyId: string, filters?: FinancialStatementFilter) {
    const asOfDate = filters?.asOfDate || `${new Date().getFullYear()}-12-31`;
    const isReexpressed = Boolean(filters?.isReexpressed);

    // Obtener factor de inflación si está activada la reexpresión VEN-NIF B-10
    let inflationFactor = 1.0;
    if (isReexpressed) {
      const year = filters?.targetInpcYear || new Date(asOfDate).getFullYear();
      const month = filters?.targetInpcMonth || new Date(asOfDate).getMonth() + 1;
      const inpcRows = await query<any>(
        `SELECT inpc_value FROM accounting_inflation_indices WHERE year = ? AND month = ?`,
        [year, month]
      );
      if (inpcRows.length > 0) {
        const inpcClosing = Number(inpcRows[0].inpc_value);
        // Supongamos base anterior o enero
        const inpcBase = 615.63;
        inflationFactor = inpcClosing / inpcBase;
      }
    }

    // Traer todos los movimientos agregados por cuenta de detalle (hoja) hasta asOfDate
    const leafBalancesRows = await query<any>(
      `SELECT a.id, a.code, a.account_type, a.classification, a.normal_balance, a.is_monetary,
              COALESCE(SUM(l.debit_ves), 0) as total_debit,
              COALESCE(SUM(l.credit_ves), 0) as total_credit,
              COALESCE(SUM(l.debit_usd), 0) as total_debit_usd,
              COALESCE(SUM(l.credit_usd), 0) as total_credit_usd
       FROM accounting_accounts a
       INNER JOIN accounting_journal_lines l ON a.id = l.account_id
       INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
       WHERE a.company_id = ? AND e.status = 'POSTED' AND e.entry_date <= ?
       GROUP BY a.id, a.code, a.account_type, a.classification, a.normal_balance, a.is_monetary`,
      [companyId, asOfDate]
    );

    // Todas las cuentas de balance para estructurar el reporte
    const allAccounts = await query<any>(
      `SELECT id, code, name, level, parent_id, account_type, classification, normal_balance, accepts_postings, is_monetary
       FROM accounting_accounts
       WHERE company_id = ? AND account_type IN ('ASSET', 'LIABILITY', 'EQUITY')
       ORDER BY code ASC`,
      [companyId]
    );

    // Calcular saldo de cada cuenta sumando las cuentas hoja con su prefijo
    const accountsWithBalance = allAccounts.map((acc: any) => {
      let deb = 0;
      let cred = 0;
      for (const leaf of leafBalancesRows) {
        if (leaf.code.startsWith(acc.code)) {
          deb += Number(leaf.total_debit);
          cred += Number(leaf.total_credit);
        }
      }
      const isDebit = acc.normal_balance === 'DEBIT';
      let balance = isDebit ? deb - cred : cred - deb;

      // Si es no monetaria y está reexpresado, aplicar factor de inflación
      if (isReexpressed && !acc.is_monetary) {
        balance = balance * inflationFactor;
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        level: acc.level,
        type: acc.account_type,
        classification: acc.classification,
        normalBalance: acc.normal_balance,
        acceptsPostings: Boolean(acc.accepts_postings),
        isMonetary: Boolean(acc.is_monetary),
        balance,
      };
    });

    // Calcular resultado del ejercicio (ingresos - costos - gastos) a la fecha de corte
    const pnlRows = await query<any>(
      `SELECT a.account_type, a.normal_balance,
              COALESCE(SUM(l.debit_ves), 0) as total_debit,
              COALESCE(SUM(l.credit_ves), 0) as total_credit
       FROM accounting_accounts a
       INNER JOIN accounting_journal_lines l ON a.id = l.account_id
       INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
       WHERE a.company_id = ? AND e.status = 'POSTED' AND e.entry_date <= ?
         AND a.account_type IN ('REVENUE', 'COST', 'EXPENSE')
       GROUP BY a.account_type, a.normal_balance`,
      [companyId, asOfDate]
    );

    let totalRevenue = 0;
    let totalCostExpense = 0;

    for (const r of pnlRows) {
      const d = Number(r.total_debit);
      const c = Number(r.total_credit);
      if (r.account_type === 'REVENUE') {
        totalRevenue += (c - d);
      } else {
        totalCostExpense += (d - c);
      }
    }
    const currentPeriodNetIncome = totalRevenue - totalCostExpense;

    const currentAssets = accountsWithBalance.filter(
      (a: any) => a.type === 'ASSET' && a.classification === 'CURRENT' && a.level <= 3
    );
    const nonCurrentAssets = accountsWithBalance.filter(
      (a: any) => a.type === 'ASSET' && a.classification === 'NON_CURRENT' && a.level <= 3
    );
    const currentLiabilities = accountsWithBalance.filter(
      (a: any) => a.type === 'LIABILITY' && a.classification === 'CURRENT' && a.level <= 3
    );
    const nonCurrentLiabilities = accountsWithBalance.filter(
      (a: any) => a.type === 'LIABILITY' && a.classification === 'NON_CURRENT' && a.level <= 3
    );
    const equityAccounts = accountsWithBalance.filter(
      (a: any) => a.type === 'EQUITY' && a.level <= 3
    );

    // Totales calculados a nivel de grupos principales (1.1, 1.2, 2.1, 2.2, 3)
    const totalCurrentAssets = accountsWithBalance.find((a: any) => a.code === '1.1')?.balance || 0;
    const totalNonCurrentAssets = accountsWithBalance.find((a: any) => a.code === '1.2')?.balance || 0;
    const totalAssets = accountsWithBalance.find((a: any) => a.code === '1')?.balance || (totalCurrentAssets + totalNonCurrentAssets);

    const totalCurrentLiabilities = accountsWithBalance.find((a: any) => a.code === '2.1')?.balance || 0;
    const totalNonCurrentLiabilities = accountsWithBalance.find((a: any) => a.code === '2.2')?.balance || 0;
    const totalLiabilities = accountsWithBalance.find((a: any) => a.code === '2')?.balance || (totalCurrentLiabilities + totalNonCurrentLiabilities);

    const totalBaseEquity = accountsWithBalance.find((a: any) => a.code === '3')?.balance || 0;
    const totalEquity = totalBaseEquity + currentPeriodNetIncome;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
    const isBalanced = difference < 1.0;

    return {
      asOfDate,
      isReexpressed,
      inflationFactor,
      currentAssets,
      nonCurrentAssets,
      totalCurrentAssets,
      totalNonCurrentAssets,
      totalAssets,
      currentLiabilities,
      nonCurrentLiabilities,
      totalCurrentLiabilities,
      totalNonCurrentLiabilities,
      totalLiabilities,
      equityAccounts,
      currentPeriodNetIncome,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
      difference,
    };
  }

  /**
   * Estado de Resultados Integral (P&L bajo NIIF / VEN-NIF)
   */
  static async getIncomeStatement(companyId: string, filters?: FinancialStatementFilter) {
    const startDate = filters?.startDate || `${new Date().getFullYear()}-01-01`;
    const endDate = filters?.endDate || `${new Date().getFullYear()}-12-31`;

    const leafPnlRows = await query<any>(
      `SELECT a.id, a.code, a.account_type, a.classification, a.normal_balance,
              COALESCE(SUM(l.debit_ves), 0) as period_debit,
              COALESCE(SUM(l.credit_ves), 0) as period_credit
       FROM accounting_accounts a
       INNER JOIN accounting_journal_lines l ON a.id = l.account_id
       INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
       WHERE a.company_id = ? AND e.status = 'POSTED' 
         AND e.entry_date >= ? AND e.entry_date <= ?
         AND a.account_type IN ('REVENUE', 'COST', 'EXPENSE')
       GROUP BY a.id, a.code, a.account_type, a.classification, a.normal_balance`,
      [companyId, startDate, endDate]
    );

    const allPnlAccounts = await query<any>(
      `SELECT id, code, name, level, parent_id, account_type, classification, normal_balance, accepts_postings
       FROM accounting_accounts
       WHERE company_id = ? AND account_type IN ('REVENUE', 'COST', 'EXPENSE')
       ORDER BY code ASC`,
      [companyId]
    );

    const rowsWithBalance = allPnlAccounts.map((acc: any) => {
      let d = 0;
      let c = 0;
      for (const leaf of leafPnlRows) {
        if (leaf.code.startsWith(acc.code)) {
          d += Number(leaf.period_debit);
          c += Number(leaf.period_credit);
        }
      }
      const isDebit = acc.normal_balance === 'DEBIT';
      const amount = isDebit ? d - c : c - d;
      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        level: acc.level,
        type: acc.account_type,
        classification: acc.classification,
        amount,
      };
    });

    // Ingresos Operacionales
    const revenueLines = rowsWithBalance.filter((r: any) => r.type === 'REVENUE' && r.classification === 'OPERATING' && r.level <= 3);
    const totalRevenue = rowsWithBalance.find((r: any) => r.code === '4')?.amount || 0;

    // Costo de Ventas
    const costLines = rowsWithBalance.filter((r: any) => r.type === 'COST' && r.level <= 3);
    const totalCostOfSales = rowsWithBalance.find((r: any) => r.code === '5')?.amount || 0;

    // Utilidad Bruta
    const grossProfit = totalRevenue - totalCostOfSales;

    // Gastos Operacionales (Administración y Ventas)
    const expenseLines = rowsWithBalance.filter((r: any) => r.type === 'EXPENSE' && r.classification === 'OPERATING' && r.level <= 3);
    const totalOperatingExpenses = rowsWithBalance.find((r: any) => r.code === '6')?.amount || 0;

    // Utilidad Operativa
    const operatingProfit = grossProfit - totalOperatingExpenses;

    // Ingresos y Gastos Financieros (Diferencia en cambio, comisiones)
    const financialRevenueLines = rowsWithBalance.filter((r: any) => r.type === 'REVENUE' && r.classification === 'FINANCIAL' && r.level <= 3);
    const financialExpenseLines = rowsWithBalance.filter((r: any) => r.type === 'EXPENSE' && r.classification === 'FINANCIAL' && r.level <= 3);

    const totalFinancialRevenue = rowsWithBalance.find((r: any) => r.code === '7.2')?.amount || 0;
    const totalFinancialExpenses = rowsWithBalance.find((r: any) => r.code === '7.1')?.amount || 0;

    // Utilidad Antes de Impuestos y REI
    const netIncomeBeforeTaxes = operatingProfit + totalFinancialRevenue - totalFinancialExpenses;

    // Estimación ISLR (aprox 34% para sociedades mercantiles)
    const estimatedIslr = netIncomeBeforeTaxes > 0 ? netIncomeBeforeTaxes * 0.34 : 0;
    const netIncome = netIncomeBeforeTaxes - estimatedIslr;

    return {
      startDate,
      endDate,
      revenueLines,
      totalRevenue,
      costLines,
      totalCostOfSales,
      grossProfit,
      expenseLines,
      totalOperatingExpenses,
      operatingProfit,
      financialRevenueLines,
      financialExpenseLines,
      totalFinancialRevenue,
      totalFinancialExpenses,
      netIncomeBeforeTaxes,
      estimatedIslr,
      netIncome,
    };
  }

  /**
   * Estado de Flujos de Efectivo (Método Indirecto NIIF / VEN-NIF)
   */
  static async getCashFlowStatement(companyId: string, filters?: FinancialStatementFilter) {
    const pnl = await this.getIncomeStatement(companyId, filters);
    const netIncome = pnl.netIncome;

    // Partidas que no requirieron efectivo (Depreciaciones)
    const depRows = await query<any>(
      `SELECT COALESCE(SUM(l.debit_ves), 0) as dep_amount
       FROM accounting_journal_lines l
       INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
       INNER JOIN accounting_accounts a ON l.account_id = a.id
       WHERE e.company_id = ? AND e.status = 'POSTED' AND a.code LIKE '6.1.06%'`,
      [companyId]
    );
    const depreciationAdjustment = Number(depRows[0]?.dep_amount || 0);

    // Cambios en capital de trabajo (Clientes, Inventarios, Proveedores)
    const operatingCashFlow = netIncome + depreciationAdjustment;
    const investingCashFlow = 0; // Adquisiciones de Propiedad, Planta y Equipos
    const financingCashFlow = 0; // Aportes de capital o pago de préstamos

    const netCashIncrease = operatingCashFlow + investingCashFlow + financingCashFlow;

    // Saldo en Caja y Bancos al inicio y cierre
    const cashAccounts = await query<any>(
      `SELECT COALESCE(SUM(l.debit_ves - l.credit_ves), 0) as total_cash
       FROM accounting_journal_lines l
       INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
       INNER JOIN accounting_accounts a ON l.account_id = a.id
       WHERE e.company_id = ? AND e.status = 'POSTED' AND a.code LIKE '1.1.01%'`,
      [companyId]
    );
    const finalCash = Number(cashAccounts[0]?.total_cash || 0);
    const initialCash = finalCash - netCashIncrease;

    return {
      startDate: pnl.startDate,
      endDate: pnl.endDate,
      operatingActivities: {
        netIncome,
        depreciationAdjustment,
        operatingCashFlow,
      },
      investingActivities: {
        capitalExpenditure: investingCashFlow,
      },
      financingActivities: {
        financingCashFlow,
      },
      netCashIncrease,
      initialCash,
      finalCash,
    };
  }

  /**
   * Estado de Cambios en el Patrimonio
   */
  static async getEquityChangesStatement(companyId: string, filters?: FinancialStatementFilter) {
    const bs = await this.getBalanceSheet(companyId, filters);

    return {
      asOfDate: bs.asOfDate,
      capitalSocial: bs.equityAccounts.find((a: any) => a.code.startsWith('3.1'))?.balance || 0,
      reservaLegal: bs.equityAccounts.find((a: any) => a.code.startsWith('3.2'))?.balance || 0,
      utilidadesAcumuladas: bs.equityAccounts.find((a: any) => a.code.startsWith('3.3.01'))?.balance || 0,
      resultadoEjercicio: bs.currentPeriodNetIncome,
      totalEquity: bs.totalEquity,
    };
  }

  /**
   * Notas a los Estados Financieros (Generador Legal VEN-NIF / Código de Comercio)
   */
  static async getFinancialNotes(companyId: string, filters?: FinancialStatementFilter) {
    const [companies]: any = await pool.query(
      `SELECT legal_name, rif, fiscal_address, trade_name FROM companies WHERE id = ?`,
      [companyId]
    );
    const company = companies[0] || {};
    const asOfDate = filters?.asOfDate || `${new Date().getFullYear()}-12-31`;

    const notes = [
      {
        number: 1,
        title: 'Entidad que Informa y Objeto Social',
        content: `${company.legal_name || 'La Empresa'}, RIF ${company.rif || 'J-XXXXXXXX-X'}, domiciliada fiscalmente en ${company.fiscal_address || 'Venezuela'}, es una sociedad mercantil venezolana regida por las leyes de la República Bolivariana de Venezuela y el Código de Comercio. Su objeto principal es la comercialización, distribución y venta de bienes y servicios.`,
      },
      {
        number: 2,
        title: 'Bases de Preparación y Cumplimiento de VEN-NIF',
        content: `Los presentes estados financieros han sido preparados de acuerdo con los Principios de Contabilidad de Aceptación General en Venezuela (VEN-NIF), aprobados por la Federación de Colegios de Contadores Públicos de Venezuela (FCCPV), aplicando la Norma Internacional de Información Financiera para Pequeñas y Medianas Entidades (NIIF para PYMES) y los Boletines de Aplicación BA VEN-NIF vigentes. La contabilidad se mantiene sobre la base del devengo y del principio de negocio en marcha.`,
      },
      {
        number: 3,
        title: 'Principales Políticas Contables',
        subsections: [
          {
            subtitle: 'Moneda Funcional y de Presentación',
            text: 'La moneda funcional de la entidad y de presentación de los estados financieros es el Bolívar (VES), moneda de curso legal en la República Bolivariana de Venezuela, llevándose igualmente registros de control en Dólares Estadounidenses (USD) calculados a la tasa oficial del Banco Central de Venezuela (BCV).',
          },
          {
            subtitle: 'Efectivo y Equivalentes de Efectivo',
            text: 'Incluye la caja general, caja chica, y los depósitos bancarios a la vista en instituciones financieras nacionales con disponibilidad inmediata.',
          },
          {
            subtitle: 'Inventarios',
            text: 'Los inventarios se valoran al costo histórico de adquisición o al Valor Neto Realizable (VNR), el que resulte menor, aplicando la fórmula de costo Promedio Ponderado.',
          },
          {
            subtitle: 'Propiedades, Planta y Equipos',
            text: 'Se registran al costo de adquisición menos la depreciación acumulada calculada según el método de línea recta sobre la vida útil estimada de los activos.',
          },
          {
            subtitle: 'Reconocimiento de Ingresos',
            text: 'Los ingresos de actividades ordinarias se reconocen cuando se transfiere el control de los bienes al cliente y se emite la correspondiente factura fiscal exigida por el SENIAT.',
          },
        ],
      },
      {
        number: 4,
        title: 'Efectivo y Equivalentes de Efectivo',
        content: 'Corresponde a los fondos disponibles en cuentas corrientes y cajas en bolívares y moneda extranjera custodiada.',
      },
      {
        number: 5,
        title: 'Pasivos Tributarios y Retenciones Fiscales (SENIAT)',
        content: 'Comprende el Impuesto al Valor Agregado (IVA) débito fiscal pendiente de liquidación mensual y las retenciones de IVA e ISLR enteradas al Fisco Nacional según los calendarios del SENIAT para Sujetos Pasivos Especiales.',
      },
      {
        number: 6,
        title: 'Capital Social y Reservas',
        content: 'El capital social está íntegramente suscrito y pagado. De conformidad con el Artículo 262 del Código de Comercio, se apropia anualmente el 5% de los beneficios netos para constituir el fondo de Reserva Legal hasta alcanzar el 10% del capital social.',
      },
    ];

    return {
      company,
      asOfDate,
      notes,
    };
  }

  // ==========================================================================
  // 6. MOTOR DE AJUSTE POR INFLACIÓN (VEN-NIF B-10) Y DIFERENCIA EN CAMBIO
  // ==========================================================================

  static async getInflationIndices() {
    const rows = await query<any>(
      `SELECT * FROM accounting_inflation_indices ORDER BY year DESC, month DESC`
    );
    return rows.map((r: any) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      inpcValue: Number(r.inpc_value),
      variationMonthly: Number(r.variation_monthly),
      publishedDate: r.published_date,
    }));
  }

  static async calculateInflationAdjustment(companyId: string, targetYear: number, targetMonth: number) {
    const inpcRows = await query<any>(
      `SELECT inpc_value FROM accounting_inflation_indices WHERE year = ? AND month = ?`,
      [targetYear, targetMonth]
    );

    if (inpcRows.length === 0) {
      throw new Error(`No existe índice INPC registrado para el período ${targetYear}-${String(targetMonth).padStart(2, '0')}`);
    }

    const inpcClosing = Number(inpcRows[0].inpc_value);
    const inpcBase = 615.63; // INPC base ejercicio
    const factor = inpcClosing / inpcBase;

    // Cuentas no monetarias (is_monetary = 0)
    const nonMonetaryAccounts = await query<any>(
      `SELECT a.id, a.code, a.name, a.normal_balance, a.account_type,
              COALESCE(SUM(l.debit_ves - l.credit_ves), 0) as historical_balance
       FROM accounting_accounts a
       LEFT JOIN accounting_journal_lines l ON a.id = l.account_id
       LEFT JOIN accounting_journal_entries e ON l.journal_entry_id = e.id AND e.status = 'POSTED'
       WHERE a.company_id = ? AND a.is_monetary = 0 AND a.accepts_postings = 1
       GROUP BY a.id`,
      [companyId]
    );

    const reexpressions = nonMonetaryAccounts.map((a: any) => {
      const hist = Number(a.historical_balance);
      const reexpressed = hist * factor;
      const adjustment = reexpressed - hist;
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        normalBalance: a.normal_balance,
        historicalBalance: hist,
        reexpressedBalance: reexpressed,
        adjustment,
      };
    });

    const netAdjustment = reexpressions.reduce((sum, r) => sum + r.adjustment, 0);

    return {
      targetYear,
      targetMonth,
      inpcBase,
      inpcClosing,
      factor,
      reexpressions,
      netReiResultVes: netAdjustment,
    };
  }

  static async calculateExchangeDifference(companyId: string, asOfDate: string, newRateBcv: number) {
    // Buscar cuentas en moneda extranjera (is_bank_or_cash = 1 o con movimientos en USD)
    const accounts = await query<any>(
      `SELECT a.id, a.code, a.name, a.normal_balance,
              COALESCE(SUM(l.debit_ves - l.credit_ves), 0) as current_ves,
              COALESCE(SUM(l.debit_usd - l.credit_usd), 0) as current_usd
       FROM accounting_accounts a
       INNER JOIN accounting_journal_lines l ON a.id = l.account_id
       INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id AND e.status = 'POSTED' AND e.entry_date <= ?
       WHERE a.company_id = ? AND (a.is_bank_or_cash = 1 OR a.code IN ('1.1.01.03', '1.1.01.06', '1.1.02.02', '2.1.01.02'))
       GROUP BY a.id`,
      [asOfDate, companyId]
    );

    const adjustments = accounts.map((a: any) => {
      const balVes = Number(a.current_ves);
      const balUsd = Number(a.current_usd);
      const targetVes = balUsd * newRateBcv;
      const differenceVes = targetVes - balVes;

      return {
        id: a.id,
        code: a.code,
        name: a.name,
        normalBalance: a.normal_balance,
        currentBalanceVes: balVes,
        currentBalanceUsd: balUsd,
        targetBalanceVes: targetVes,
        differenceVes,
        isGain: differenceVes > 0,
      };
    });

    const netDifferenceVes = adjustments.reduce((s, a) => s + a.differenceVes, 0);

    return {
      asOfDate,
      newRateBcv,
      accounts: adjustments,
      netDifferenceVes,
      isNetGain: netDifferenceVes >= 0,
    };
  }

  // ==========================================================================
  // 7. PERÍODOS FISCALES Y CIERRES
  // ==========================================================================

  static async getFiscalPeriods(companyId: string) {
    const rows = await query<any>(
      `SELECT p.*, y.year, u.full_name as closed_by_name
       FROM accounting_fiscal_periods p
       INNER JOIN accounting_fiscal_years y ON p.fiscal_year_id = y.id
       LEFT JOIN users u ON p.closed_by = u.id
       WHERE y.company_id = ?
       ORDER BY y.year DESC, p.month DESC`,
      [companyId]
    );

    return rows.map((r: any) => ({
      id: r.id,
      fiscalYearId: r.fiscal_year_id,
      year: r.year,
      month: r.month,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      closedAt: r.closed_at,
      closedByName: r.closed_by_name,
    }));
  }

  static async updatePeriodStatus(companyId: string, userId: string, periodId: string, newStatus: 'OPEN' | 'CLOSED' | 'LOCKED') {
    await query(
      `UPDATE accounting_fiscal_periods p
       INNER JOIN accounting_fiscal_years y ON p.fiscal_year_id = y.id
       SET p.status = ?, p.closed_by = ?, p.closed_at = NOW()
       WHERE p.id = ? AND y.company_id = ?`,
      [newStatus, userId, periodId, companyId]
    );

    return { success: true, newStatus };
  }
}
