import { pool, withTransaction, query } from '../../db';
import crypto from 'crypto';
import {
  AccountingSettingInput,
  AccountingMappingItem,
  BatchPostingInput,
} from '@ero/shared';

const uuidv4 = () => crypto.randomUUID();

export class AccountingAutoPostingService {
  // ==========================================================================
  // 1. CONFIGURACIÓN Y MAPEOS
  // ==========================================================================

  static async getSettings(companyId: string): Promise<AccountingSettingInput> {
    const rows = await query<any>(
      `SELECT * FROM accounting_settings WHERE company_id = ?`,
      [companyId]
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        companyId: r.company_id,
        autoPostingEnabled: Boolean(r.auto_posting_enabled),
        defaultEntryStatus: r.default_entry_status,
        postSales: Boolean(r.post_sales),
        postPurchases: Boolean(r.post_purchases),
        postPayments: Boolean(r.post_payments),
        postNotes: Boolean(r.post_notes),
        postInventoryAdjustments: Boolean(r.post_inventory_adjustments),
        postTreasury: Boolean(r.post_treasury),
      };
    }

    // Si no existe, crear por defecto
    const id = uuidv4();
    await query(
      `INSERT INTO accounting_settings (
        id, company_id, auto_posting_enabled, default_entry_status,
        post_sales, post_purchases, post_payments, post_notes,
        post_inventory_adjustments, post_treasury
      ) VALUES (?, ?, 1, 'POSTED', 1, 1, 1, 1, 1, 1)`,
      [id, companyId]
    );

    return {
      id,
      companyId,
      autoPostingEnabled: true,
      defaultEntryStatus: 'POSTED',
      postSales: true,
      postPurchases: true,
      postPayments: true,
      postNotes: true,
      postInventoryAdjustments: true,
      postTreasury: true,
    };
  }

  static async updateSettings(
    companyId: string,
    data: Partial<AccountingSettingInput>
  ): Promise<AccountingSettingInput> {
    await this.getSettings(companyId); // Asegura existencia

    const updates: string[] = [];
    const params: any[] = [];

    if (data.autoPostingEnabled !== undefined) {
      updates.push('auto_posting_enabled = ?');
      params.push(data.autoPostingEnabled ? 1 : 0);
    }
    if (data.defaultEntryStatus !== undefined) {
      updates.push('default_entry_status = ?');
      params.push(data.defaultEntryStatus);
    }
    if (data.postSales !== undefined) {
      updates.push('post_sales = ?');
      params.push(data.postSales ? 1 : 0);
    }
    if (data.postPurchases !== undefined) {
      updates.push('post_purchases = ?');
      params.push(data.postPurchases ? 1 : 0);
    }
    if (data.postPayments !== undefined) {
      updates.push('post_payments = ?');
      params.push(data.postPayments ? 1 : 0);
    }
    if (data.postNotes !== undefined) {
      updates.push('post_notes = ?');
      params.push(data.postNotes ? 1 : 0);
    }
    if (data.postInventoryAdjustments !== undefined) {
      updates.push('post_inventory_adjustments = ?');
      params.push(data.postInventoryAdjustments ? 1 : 0);
    }
    if (data.postTreasury !== undefined) {
      updates.push('post_treasury = ?');
      params.push(data.postTreasury ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(companyId);
      await query(
        `UPDATE accounting_settings SET ${updates.join(', ')} WHERE company_id = ?`,
        params
      );
    }

    return this.getSettings(companyId);
  }

  static async getMappings(companyId: string): Promise<AccountingMappingItem[]> {
    const rows = await query<any>(
      `SELECT m.id, m.mapping_key, m.account_id, m.description,
              a.code as account_code, a.name as account_name
       FROM accounting_account_mappings m
       INNER JOIN accounting_accounts a ON m.account_id = a.id
       WHERE m.company_id = ?
       ORDER BY m.mapping_key ASC`,
      [companyId]
    );

    return rows.map((r: any) => ({
      id: r.id,
      mappingKey: r.mapping_key,
      accountId: r.account_id,
      accountCode: r.account_code,
      accountName: r.account_name,
      description: r.description || undefined,
    }));
  }

  static async updateMappings(
    companyId: string,
    mappings: AccountingMappingItem[]
  ): Promise<void> {
    await withTransaction(async (conn) => {
      for (const item of mappings) {
        await conn.query(
          `INSERT INTO accounting_account_mappings (
            id, company_id, mapping_key, account_id, description
          ) VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            account_id = VALUES(account_id),
            description = VALUES(description)`,
          [
            item.id || uuidv4(),
            companyId,
            item.mappingKey,
            item.accountId,
            item.description || null,
          ]
        );
      }
    });
  }

  // ==========================================================================
  // 2. RESOLUTORES DE CUENTAS CONTABLES
  // ==========================================================================

  private static async resolveAccount(
    connOrPool: any,
    companyId: string,
    mappingKey: string,
    fallbackCode?: string
  ): Promise<{ id: string; code: string; name: string } | null> {
    // 1. Buscar en tabla de mapeo configurada
    const [mappingRows]: any = await connOrPool.query(
      `SELECT a.id, a.code, a.name 
       FROM accounting_account_mappings m
       INNER JOIN accounting_accounts a ON m.account_id = a.id
       WHERE m.company_id = ? AND m.mapping_key = ? AND a.is_active = 1
       LIMIT 1`,
      [companyId, mappingKey]
    );

    if (mappingRows && mappingRows.length > 0) {
      return {
        id: mappingRows[0].id,
        code: mappingRows[0].code,
        name: mappingRows[0].name,
      };
    }

    // 2. Si no hay mapeo explícito, buscar por código fallback en el catálogo
    if (fallbackCode) {
      const [codeRows]: any = await connOrPool.query(
        `SELECT id, code, name FROM accounting_accounts 
         WHERE company_id = ? AND code = ? AND is_active = 1
         LIMIT 1`,
        [companyId, fallbackCode]
      );

      if (codeRows && codeRows.length > 0) {
        return {
          id: codeRows[0].id,
          code: codeRows[0].code,
          name: codeRows[0].name,
        };
      }
    }

    return null;
  }

  // ==========================================================================
  // 3. GENERADOR DE COMPROBANTES DE DIARIO (INTERNO ATÓMICO)
  // ==========================================================================

  private static async createInternalEntry(
    conn: any,
    params: {
      companyId: string;
      userId: string;
      branchId?: string | null;
      entryDate: string;
      entryType?: 'STANDARD' | 'ADJUSTMENT' | 'OPENING';
      concept: string;
      notes?: string | null;
      currency?: 'VES' | 'USD';
      exchangeRate?: number;
      originType: string;
      originId: string;
      status?: 'DRAFT' | 'POSTED';
      lines: {
        accountId: string;
        description: string;
        debitVes: number;
        creditVes: number;
        debitUsd?: number;
        creditUsd?: number;
        referenceDoc?: string | null;
      }[];
    }
  ): Promise<{ id: string; entryNumber: string } | null> {
    const {
      companyId,
      userId,
      branchId,
      entryDate,
      entryType = 'STANDARD',
      concept,
      notes,
      currency = 'VES',
      exchangeRate = 1,
      originType,
      originId,
      status = 'POSTED',
      lines,
    } = params;

    // 1. Control de Idempotencia: Verificar si ya existe comprobante para este documento
    const [existing]: any = await conn.query(
      `SELECT id, entry_number FROM accounting_journal_entries 
       WHERE company_id = ? AND origin_type = ? AND origin_id = ? AND status != 'ANNULLED'
       LIMIT 1`,
      [companyId, originType, originId]
    );

    if (existing && existing.length > 0) {
      return { id: existing[0].id, entryNumber: existing[0].entry_number };
    }

    // 2. Período Fiscal
    const entryDateObj = new Date(entryDate);
    const entryYear = entryDateObj.getFullYear();
    const entryMonth = entryDateObj.getMonth() + 1;

    const [periodRows]: any = await conn.query(
      `SELECT p.id, p.status 
       FROM accounting_fiscal_periods p
       INNER JOIN accounting_fiscal_years y ON p.fiscal_year_id = y.id
       WHERE y.company_id = ? AND y.year = ? AND p.month = ?
       LIMIT 1`,
      [companyId, entryYear, entryMonth]
    );

    let periodId = periodRows.length > 0 ? periodRows[0].id : null;
    if (periodRows.length > 0 && periodRows[0].status === 'LOCKED') {
      console.warn(`[AutoPosting] Periodo ${entryYear}-${entryMonth} bloqueado. Se omitió asiento.`);
      return null;
    }

    // Si no existe periodo abierto para el año/mes, crear periodo al vuelo
    if (!periodId) {
      // Buscar o crear año fiscal
      let [yearRows]: any = await conn.query(
        `SELECT id FROM accounting_fiscal_years WHERE company_id = ? AND year = ? LIMIT 1`,
        [companyId, entryYear]
      );
      let yearId = yearRows.length > 0 ? yearRows[0].id : null;
      if (!yearId) {
        yearId = uuidv4();
        await conn.query(
          `INSERT INTO accounting_fiscal_years (id, company_id, year, start_date, end_date, status)
           VALUES (?, ?, ?, ?, ?, 'OPEN')`,
          [yearId, companyId, entryYear, `${entryYear}-01-01`, `${entryYear}-12-31`]
        );
      }
      periodId = uuidv4();
      const lastDayOfMonth = new Date(entryYear, entryMonth, 0).getDate();
      await conn.query(
        `INSERT INTO accounting_fiscal_periods (id, fiscal_year_id, month, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, 'OPEN')`,
        [
          periodId,
          yearId,
          entryMonth,
          `${entryYear}-${String(entryMonth).padStart(2, '0')}-01`,
          `${entryYear}-${String(entryMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`,
        ]
      );
    }

    // 3. Obtener correlativo consecutivo legal AS-YYYY-NNNNN
    const [lastNumberRows]: any = await conn.query(
      `SELECT entry_number FROM accounting_journal_entries 
       WHERE company_id = ? AND entry_number LIKE ? 
       ORDER BY entry_number DESC LIMIT 1 FOR UPDATE`,
      [companyId, `AS-${entryYear}-%`]
    );

    let nextSeq = 1;
    if (lastNumberRows.length > 0) {
      const parts = lastNumberRows[0].entry_number.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num)) nextSeq = num + 1;
      }
    }
    const entryNumber = `AS-${entryYear}-${String(nextSeq).padStart(5, '0')}`;

    // 4. Filtrar y balancear líneas (Partida Doble)
    const validLines = lines.filter(
      (l) => (l.debitVes || 0) > 0.0001 || (l.creditVes || 0) > 0.0001
    );

    if (validLines.length < 2) {
      console.warn(`[AutoPosting] Asiento para ${originType}:${originId} tiene menos de 2 líneas válidas.`);
      return null;
    }

    let totalDebitVes = 0;
    let totalCreditVes = 0;
    let totalDebitUsd = 0;
    let totalCreditUsd = 0;

    for (const l of validLines) {
      const dV = Number((l.debitVes || 0).toFixed(4));
      const cV = Number((l.creditVes || 0).toFixed(4));
      const dU = l.debitUsd !== undefined ? Number(l.debitUsd.toFixed(4)) : (exchangeRate > 0 ? Number((dV / exchangeRate).toFixed(4)) : 0);
      const cU = l.creditUsd !== undefined ? Number(l.creditUsd.toFixed(4)) : (exchangeRate > 0 ? Number((cV / exchangeRate).toFixed(4)) : 0);

      l.debitVes = dV;
      l.creditVes = cV;
      l.debitUsd = dU;
      l.creditUsd = cU;

      totalDebitVes += dV;
      totalCreditVes += cV;
      totalDebitUsd += dU;
      totalCreditUsd += cU;
    }

    // Ajuste fino por redondeo decimal (tolerancia hasta 0.05 Bs)
    const diffVes = Number((totalDebitVes - totalCreditVes).toFixed(4));
    if (Math.abs(diffVes) > 0 && Math.abs(diffVes) <= 0.05) {
      // Ajustar la primera línea que tenga crédito si totalDebitVes > totalCreditVes, o viceversa
      if (diffVes > 0) {
        const targetLine = validLines.find((l) => l.creditVes > 0) || validLines[validLines.length - 1];
        targetLine.creditVes = Number((targetLine.creditVes + diffVes).toFixed(4));
        totalCreditVes = Number((totalCreditVes + diffVes).toFixed(4));
      } else {
        const targetLine = validLines.find((l) => l.debitVes > 0) || validLines[0];
        targetLine.debitVes = Number((targetLine.debitVes + Math.abs(diffVes)).toFixed(4));
        totalDebitVes = Number((totalDebitVes + Math.abs(diffVes)).toFixed(4));
      }
    } else if (Math.abs(diffVes) > 0.05) {
      throw new Error(`[AutoPosting] Descuadre en asiento ${originType}:${originId}. Débito: ${totalDebitVes}, Crédito: ${totalCreditVes}`);
    }

    const entryId = uuidv4();
    const isPosted = status === 'POSTED';

    await conn.query(
      `INSERT INTO accounting_journal_entries (
        id, company_id, branch_id, period_id, entry_number, entry_date,
        entry_type, concept, notes, currency, exchange_rate,
        total_debit_ves, total_credit_ves, total_debit_usd, total_credit_usd,
        status, created_by, posted_by, posted_at, origin_type, origin_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entryId,
        companyId,
        branchId || null,
        periodId,
        entryNumber,
        entryDate,
        entryType,
        concept,
        notes || null,
        currency,
        exchangeRate,
        totalDebitVes,
        totalCreditVes,
        totalDebitUsd,
        totalCreditUsd,
        status,
        userId,
        isPosted ? userId : null,
        isPosted ? new Date() : null,
        originType,
        originId,
      ]
    );

    let order = 1;
    for (const line of validLines) {
      await conn.query(
        `INSERT INTO accounting_journal_lines (
          id, journal_entry_id, account_id, line_order, description,
          debit_ves, credit_ves, debit_usd, credit_usd, reference_doc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          entryId,
          line.accountId,
          order++,
          line.description,
          line.debitVes,
          line.creditVes,
          line.debitUsd,
          line.creditUsd,
          line.referenceDoc || null,
        ]
      );
    }

    return { id: entryId, entryNumber };
  }

  // ==========================================================================
  // 4. CONTABILIZACIÓN DE VENTAS Y COSTO DE MERCANCÍA VENDIDA
  // ==========================================================================

  static async postSaleInvoice(
    connOrPool: any,
    invoiceId: string,
    userId: string
  ): Promise<{ salesEntryId?: string; costEntryId?: string } | null> {
    const [invoiceRows]: any = await connOrPool.query(
      `SELECT i.*, b.company_id, c.name as customer_name, c.doc_type as cust_doc_type, c.doc_number as cust_doc_num
       FROM sales_invoices i
       INNER JOIN branches b ON i.branch_id = b.id
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ?`,
      [invoiceId]
    );

    if (!invoiceRows || invoiceRows.length === 0) return null;
    const inv = invoiceRows[0];
    const companyId = inv.company_id;

    // Verificar si la empresa tiene habilitada la contabilización de ventas
    const settings = await this.getSettings(companyId);
    if (!settings.autoPostingEnabled || !settings.postSales) {
      return null;
    }

    // 1. Obtener pagos asociados
    const [paymentRows]: any = await connOrPool.query(
      `SELECT p.*, ba.accounting_account_id as bank_acc_id
       FROM sales_payments p
       LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
       WHERE p.invoice_id = ?`,
      [invoiceId]
    );

    // 2. Obtener cuentas del catálogo necesarias
    const [
      accRev,
      accRevExempt,
      accVatDebit,
      accIgtfPayable,
      accArVes,
      accArUsd,
      accCashVes,
      accCashUsd,
      accBankVes,
      accBankUsd,
      accCostOfSales,
      accInventory,
    ] = await Promise.all([
      this.resolveAccount(connOrPool, companyId, 'SALES_REVENUE', '4.1.01'),
      this.resolveAccount(connOrPool, companyId, 'SALES_REVENUE_EXEMPT', '4.1.02'),
      this.resolveAccount(connOrPool, companyId, 'VAT_DEBIT', '2.1.02.01'),
      this.resolveAccount(connOrPool, companyId, 'IGTF_PAYABLE', '2.1.02.05'),
      this.resolveAccount(connOrPool, companyId, 'AR_CUSTOMERS_VES', '1.1.02.01'),
      this.resolveAccount(connOrPool, companyId, 'AR_CUSTOMERS_USD', '1.1.02.02'),
      this.resolveAccount(connOrPool, companyId, 'CASH_VES', '1.1.01.01'),
      this.resolveAccount(connOrPool, companyId, 'CASH_USD', '1.1.01.03'),
      this.resolveAccount(connOrPool, companyId, 'BANK_VES_DEFAULT', '1.1.01.04'),
      this.resolveAccount(connOrPool, companyId, 'BANK_USD_DEFAULT', '1.1.01.06'),
      this.resolveAccount(connOrPool, companyId, 'COST_OF_SALES', '5.1.01'),
      this.resolveAccount(connOrPool, companyId, 'INVENTORY_MERCHANDISE', '1.1.04.01'),
    ]);

    if (!accRev || !accVatDebit) {
      console.warn('[AutoPosting] Faltan cuentas de Ventas o Débito Fiscal configuradas');
      return null;
    }

    const rate = Number(inv.exchange_rate) || 1;
    const invDate = inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const customerLabel = inv.customer_name || `${inv.cust_doc_type || 'CI'}-${inv.cust_doc_num || ''}`;

    // Montos en VES
    const taxableVes = Number((Number(inv.base_taxable_amount || 0) * rate).toFixed(2));
    const exemptVes = Number((Number(inv.base_exempt_amount || 0) * rate).toFixed(2));
    const taxVes = Number((Number(inv.tax_amount || 0) * rate).toFixed(2));
    const igtfVes = Number((Number(inv.igtf_amount || 0) * rate).toFixed(2));
    const totalVes = Number((Number(inv.total_amount || 0) * rate).toFixed(2));

    const salesLines: any[] = [];

    // CRÉDITOS / HABER: Ingresos e Impuestos
    if (taxableVes > 0) {
      salesLines.push({
        accountId: accRev.id,
        description: `Ventas de Mercancías Gravadas Fact. ${inv.invoice_number}`,
        debitVes: 0,
        creditVes: taxableVes,
        referenceDoc: inv.invoice_number,
      });
    }

    if (exemptVes > 0 && accRevExempt) {
      salesLines.push({
        accountId: accRevExempt.id,
        description: `Ventas Exentas Fact. ${inv.invoice_number}`,
        debitVes: 0,
        creditVes: exemptVes,
        referenceDoc: inv.invoice_number,
      });
    }

    if (taxVes > 0) {
      salesLines.push({
        accountId: accVatDebit.id,
        description: `IVA Débito Fiscal Fact. ${inv.invoice_number}`,
        debitVes: 0,
        creditVes: taxVes,
        referenceDoc: inv.invoice_number,
      });
    }

    if (igtfVes > 0 && accIgtfPayable) {
      salesLines.push({
        accountId: accIgtfPayable.id,
        description: `IGTF Percibido Fact. ${inv.invoice_number}`,
        debitVes: 0,
        creditVes: igtfVes,
        referenceDoc: inv.invoice_number,
      });
    }

    // DÉBITOS / DEBE: Medios de Cobro o CxC
    let paidAmountVes = 0;

    for (const p of paymentRows) {
      const pMethod = p.method || p.payment_method;
      const totalLineVes = Number(p.amount_ves || (Number(p.amount_usd || 0) * (Number(p.exchange_rate) || rate)).toFixed(2));
      paidAmountVes += totalLineVes;

      let targetAcc = accCashVes;
      if (pMethod === 'CASH_USD' && accCashUsd) {
        targetAcc = accCashUsd;
      } else if (p.bank_acc_id) {
        targetAcc = { id: p.bank_acc_id, code: '', name: '' };
      } else if (['TRANSFER_USD', 'ZELLE'].includes(pMethod) && accBankUsd) {
        targetAcc = accBankUsd;
      } else if (['TRANSFER_VES', 'PAGO_MOVIL', 'DEBIT_CARD', 'CREDIT_CARD'].includes(pMethod) && accBankVes) {
        targetAcc = accBankVes;
      }

      if (targetAcc && totalLineVes > 0) {
        salesLines.push({
          accountId: targetAcc.id,
          description: `Cobro Fact. ${inv.invoice_number} (${pMethod}) Ref: ${p.reference_number || 'N/A'}`,
          debitVes: totalLineVes,
          creditVes: 0,
          referenceDoc: p.reference_number || inv.invoice_number,
        });
      }
    }

    // Saldo pendiente / Crédito comercial
    const pendingBalanceVes = Number((totalVes - paidAmountVes).toFixed(2));
    if (pendingBalanceVes > 0.05) {
      const targetAr = inv.currency === 'USD' && accArUsd ? accArUsd : (accArVes || accArUsd);
      if (targetAr) {
        salesLines.push({
          accountId: targetAr.id,
          description: `Cuenta por Cobrar Cliente ${customerLabel} Fact. ${inv.invoice_number}`,
          debitVes: pendingBalanceVes,
          creditVes: 0,
          referenceDoc: inv.invoice_number,
        });
      }
    }

    // Registrar Asiento de Venta
    const salesEntry = await this.createInternalEntry(connOrPool, {
      companyId,
      userId,
      branchId: inv.branch_id,
      entryDate: invDate,
      concept: `Factura de Venta N° ${inv.invoice_number} - ${customerLabel}`,
      notes: inv.notes,
      currency: (inv.currency as 'VES' | 'USD') || 'VES',
      exchangeRate: rate,
      originType: 'SALE_INVOICE',
      originId: invoiceId,
      status: settings.defaultEntryStatus,
      lines: salesLines,
    });

    // 3. Asiento de Costo de Ventas e Inventario
    let costEntry: any = null;
    if (accCostOfSales && accInventory) {
      const [itemRows]: any = await connOrPool.query(
        `SELECT SUM(quantity * unit_cost) as total_cost_usd
         FROM sales_invoice_items
         WHERE invoice_id = ?`,
        [invoiceId]
      );

      const totalCostUsd = Number(itemRows[0]?.total_cost_usd || 0);
      const totalCostVes = Number((totalCostUsd * rate).toFixed(2));

      if (totalCostVes > 0.01) {
        costEntry = await this.createInternalEntry(connOrPool, {
          companyId,
          userId,
          branchId: inv.branch_id,
          entryDate: invDate,
          concept: `Costo de Ventas e Inventario Factura N° ${inv.invoice_number}`,
          currency: 'VES',
          exchangeRate: rate,
          originType: 'SALE_COST',
          originId: invoiceId,
          status: settings.defaultEntryStatus,
          lines: [
            {
              accountId: accCostOfSales.id,
              description: `Costo de Mercancía Vendida Fact. ${inv.invoice_number}`,
              debitVes: totalCostVes,
              creditVes: 0,
              referenceDoc: inv.invoice_number,
            },
            {
              accountId: accInventory.id,
              description: `Salida de Inventario al Costo Fact. ${inv.invoice_number}`,
              debitVes: 0,
              creditVes: totalCostVes,
              referenceDoc: inv.invoice_number,
            },
          ],
        });
      }
    }

    return {
      salesEntryId: salesEntry?.id,
      costEntryId: costEntry?.id,
    };
  }

  // ==========================================================================
  // 5. CONTABILIZACIÓN DE COMPRAS A PROVEEDORES
  // ==========================================================================

  static async postPurchaseInvoice(
    connOrPool: any,
    purchaseInvoiceId: string,
    userId: string
  ): Promise<{ entryId?: string } | null> {
    const [invRows]: any = await connOrPool.query(
      `SELECT pi.*, b.company_id, s.name as supplier_name, s.rif as supplier_doc
       FROM purchase_invoices pi
       INNER JOIN branches b ON pi.branch_id = b.id
       LEFT JOIN suppliers s ON pi.supplier_id = s.id
       WHERE pi.id = ?`,
      [purchaseInvoiceId]
    );

    if (!invRows || invRows.length === 0) return null;
    const inv = invRows[0];
    const companyId = inv.company_id;

    const settings = await this.getSettings(companyId);
    if (!settings.autoPostingEnabled || !settings.postPurchases) {
      return null;
    }

    const [accInventory, accVatCredit, accApVes, accApUsd, accBankVes, accBankUsd, accCashVes] =
      await Promise.all([
        this.resolveAccount(connOrPool, companyId, 'INVENTORY_MERCHANDISE', '1.1.04.01'),
        this.resolveAccount(connOrPool, companyId, 'VAT_CREDIT', '1.1.03.01'),
        this.resolveAccount(connOrPool, companyId, 'AP_SUPPLIERS_VES', '2.1.01.01'),
        this.resolveAccount(connOrPool, companyId, 'AP_SUPPLIERS_USD', '2.1.01.02'),
        this.resolveAccount(connOrPool, companyId, 'BANK_VES_DEFAULT', '1.1.01.04'),
        this.resolveAccount(connOrPool, companyId, 'BANK_USD_DEFAULT', '1.1.01.06'),
        this.resolveAccount(connOrPool, companyId, 'CASH_VES', '1.1.01.01'),
      ]);

    if (!accInventory || !accVatCredit) {
      console.warn('[AutoPosting] Faltan cuentas de Inventario o Crédito Fiscal configuradas');
      return null;
    }

    const rate = Number(inv.exchange_rate) || 1;
    const invDate = inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const supplierLabel = inv.supplier_name || inv.supplier_doc || 'Proveedor';

    const subtotalVes = Number(((Number(inv.base_taxable_amount || 0) + Number(inv.base_exempt_amount || 0)) * rate).toFixed(2));
    const taxVes = Number((Number(inv.tax_amount || 0) * rate).toFixed(2));
    const totalVes = Number((Number(inv.total_amount || 0) * rate).toFixed(2));

    const lines: any[] = [
      {
        accountId: accInventory.id,
        description: `Entrada a Inventario Fact. Compra N° ${inv.invoice_number} - ${supplierLabel}`,
        debitVes: subtotalVes,
        creditVes: 0,
        referenceDoc: inv.invoice_number,
      },
      {
        accountId: accVatCredit.id,
        description: `IVA Crédito Fiscal Fact. Compra N° ${inv.invoice_number}`,
        debitVes: taxVes,
        creditVes: 0,
        referenceDoc: inv.invoice_number,
      },
    ];

    // Contrapartida: CxP o Tesorería
    if (inv.is_credit) {
      const targetAp = inv.currency === 'USD' && accApUsd ? accApUsd : (accApVes || accApUsd);
      if (targetAp) {
        lines.push({
          accountId: targetAp.id,
          description: `Cuentas por Pagar Proveedor ${supplierLabel} Fact. ${inv.invoice_number}`,
          debitVes: 0,
          creditVes: totalVes,
          referenceDoc: inv.invoice_number,
        });
      }
    } else {
      // Compra de contado
      const targetBank = inv.currency === 'USD' && accBankUsd ? accBankUsd : (accBankVes || accCashVes);
      if (targetBank) {
        lines.push({
          accountId: targetBank.id,
          description: `Desembolso Compra de Contado Fact. ${inv.invoice_number}`,
          debitVes: 0,
          creditVes: totalVes,
          referenceDoc: inv.invoice_number,
        });
      }
    }

    const entry = await this.createInternalEntry(connOrPool, {
      companyId,
      userId,
      branchId: inv.branch_id,
      entryDate: invDate,
      concept: `Factura de Compra N° ${inv.invoice_number} - ${supplierLabel}`,
      currency: (inv.currency as 'VES' | 'USD') || 'VES',
      exchangeRate: rate,
      originType: 'PURCHASE_INVOICE',
      originId: purchaseInvoiceId,
      status: settings.defaultEntryStatus,
      lines,
    });

    return { entryId: entry?.id };
  }

  // ==========================================================================
  // 6. CONTABILIZACIÓN DE PAGOS A PROVEEDORES (CxP)
  // ==========================================================================

  static async postPayablePayment(
    connOrPool: any,
    paymentId: string,
    userId: string
  ): Promise<{ entryId?: string } | null> {
    const [payRows]: any = await connOrPool.query(
      `SELECT pp.*, b.company_id, p.branch_id, pi.invoice_number, 
              s.name as supplier_name, 
              COALESCE(ba.currency, ba_bm.currency) as bank_currency,
              COALESCE(ba.accounting_account_id, ba_bm.accounting_account_id) as bank_acc_id
       FROM purchase_payments pp
       INNER JOIN payables p ON pp.payable_id = p.id
       INNER JOIN branches b ON p.branch_id = b.id
       LEFT JOIN purchase_invoices pi ON p.invoice_id = pi.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN bank_accounts ba ON pp.bank_account_id = ba.id
       LEFT JOIN bank_movements bm ON pp.reference_number IS NOT NULL AND bm.reference_number = pp.reference_number AND bm.movement_type = 'WITHDRAWAL'
       LEFT JOIN bank_accounts ba_bm ON bm.account_id = ba_bm.id
       WHERE pp.id = ?`,
      [paymentId]
    );

    if (!payRows || payRows.length === 0) return null;
    const pay = payRows[0];
    const companyId = pay.company_id;

    const settings = await this.getSettings(companyId);
    if (!settings.autoPostingEnabled || !settings.postPayments) {
      return null;
    }

    const [accApVes, accApUsd, accBankVesRaw, accBankUsd, accCashVes, accCashUsd, accVatWh, accIslrWh] =
      await Promise.all([
        this.resolveAccount(connOrPool, companyId, 'AP_SUPPLIERS_VES', '2.1.01.01'),
        this.resolveAccount(connOrPool, companyId, 'AP_SUPPLIERS_USD', '2.1.01.02'),
        this.resolveAccount(connOrPool, companyId, 'BANK_VES_DEFAULT', '1.1.01.04'),
        this.resolveAccount(connOrPool, companyId, 'BANK_USD_DEFAULT', '1.1.01.06'),
        this.resolveAccount(connOrPool, companyId, 'CASH_VES', '1.1.01.01'),
        this.resolveAccount(connOrPool, companyId, 'CASH_USD', '1.1.01.03'),
        this.resolveAccount(connOrPool, companyId, 'WITHHOLDING_VAT_ISSUED', '2.1.02.02'),
        this.resolveAccount(connOrPool, companyId, 'WITHHOLDING_ISLR_ISSUED', '2.1.02.03'),
      ]);

    const accBankVes = accBankVesRaw || (await this.resolveAccount(connOrPool, companyId, 'BANK_DEFAULT', '1.1.01.04'));

    const rate = Number(pay.exchange_rate) || 1;
    const payDate = pay.created_at ? new Date(pay.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const supplierLabel = pay.supplier_name || 'Proveedor';

    const amountVes = Number(pay.amount_ves || (Number(pay.amount_usd || 0) * rate).toFixed(2));
    const totalDischargeVes = amountVes;

    const targetAp = (accApVes || accApUsd);
    if (!targetAp) return null;

    const lines: any[] = [
      {
        accountId: targetAp.id,
        description: `Cancelación CxP ${supplierLabel} Fact. ${pay.invoice_number}`,
        debitVes: totalDischargeVes,
        creditVes: 0,
        referenceDoc: pay.reference_number || pay.invoice_number,
      },
    ];

    // Salida de fondos
    let targetFund = accBankVes || accCashVes;
    if (pay.bank_acc_id) {
      targetFund = { id: pay.bank_acc_id, code: '', name: '' };
    } else {
      const isUsd =
        pay.bank_currency === 'USD' ||
        pay.currency === 'USD' ||
        ['TRANSFER_USD', 'CASH_USD', 'ZELLE'].includes(pay.method);

      if (isUsd) {
        targetFund =
          ['TRANSFER_USD', 'ZELLE'].includes(pay.method) || pay.bank_account_id
            ? (accBankUsd || accCashUsd)
            : (accCashUsd || accBankUsd);
      } else {
        targetFund =
          ['TRANSFER_VES', 'PAGO_MOVIL'].includes(pay.method) || pay.bank_account_id
            ? (accBankVes || accCashVes)
            : (accCashVes || accBankVes);
      }
    }

    if (targetFund && amountVes > 0) {
      lines.push({
        accountId: targetFund.id,
        description: `Pago a ${supplierLabel} (${pay.method}) Ref: ${pay.reference_number || 'N/A'}`,
        debitVes: 0,
        creditVes: amountVes,
        referenceDoc: pay.reference_number || pay.invoice_number,
      });
    }

    const entry = await this.createInternalEntry(connOrPool, {
      companyId,
      userId,
      branchId: pay.branch_id,
      entryDate: payDate,
      concept: `Pago a Proveedor ${supplierLabel} - Ref: ${pay.reference_number || pay.invoice_number}`,
      currency: (pay.currency as 'VES' | 'USD') || 'VES',
      exchangeRate: rate,
      originType: 'AP_PAYMENT',
      originId: paymentId,
      status: settings.defaultEntryStatus,
      lines,
    });

    return { entryId: entry?.id };
  }

  // ==========================================================================
  // 7. CONTABILIZACIÓN DE NOTAS DE CRÉDITO Y DÉBITO (CLIENTES)
  // ==========================================================================

  static async postCustomerNote(
    connOrPool: any,
    noteId: string,
    userId: string
  ): Promise<{ entryId?: string } | null> {
    const [noteRows]: any = await connOrPool.query(
      `SELECT cn.*, c.legal_name as customer_name
       FROM customer_notes cn
       LEFT JOIN customers c ON cn.customer_id = c.id
       WHERE cn.id = ?`,
      [noteId]
    );

    if (!noteRows || noteRows.length === 0) return null;
    const note = noteRows[0];
    const companyId = note.company_id;

    const settings = await this.getSettings(companyId);
    if (!settings.autoPostingEnabled || !settings.postNotes) {
      return null;
    }

    const [accReturns, accVatDebit, accArVes, accArUsd, accCostOfSales, accInventory] =
      await Promise.all([
        this.resolveAccount(connOrPool, companyId, 'SALES_RETURNS', '4.1.04'),
        this.resolveAccount(connOrPool, companyId, 'VAT_DEBIT', '2.1.02.01'),
        this.resolveAccount(connOrPool, companyId, 'AR_CUSTOMERS_VES', '1.1.02.01'),
        this.resolveAccount(connOrPool, companyId, 'AR_CUSTOMERS_USD', '1.1.02.02'),
        this.resolveAccount(connOrPool, companyId, 'COST_OF_SALES', '5.1.01'),
        this.resolveAccount(connOrPool, companyId, 'INVENTORY_MERCHANDISE', '1.1.04.01'),
      ]);

    if (!accReturns || !accVatDebit) return null;

    const rate = Number(note.exchange_rate) || 1;
    const noteDate = note.created_at ? new Date(note.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const customerLabel = note.customer_name || 'Cliente';

    const subtotalVes = Number((Number(note.subtotal_amount || 0) * rate).toFixed(2));
    const taxVes = Number((Number(note.tax_amount || 0) * rate).toFixed(2));
    const totalVes = Number((Number(note.total_amount || 0) * rate).toFixed(2));

    const targetAr = note.currency === 'USD' && accArUsd ? accArUsd : (accArVes || accArUsd);
    if (!targetAr) return null;

    const lines: any[] = [];

    if (note.note_type === 'CREDIT') {
      // Nota de Crédito: Disminuye venta e IVA, disminuye saldo por cobrar
      lines.push(
        {
          accountId: accReturns.id,
          description: `Devolución / Descuento en Ventas NC ${note.note_number}`,
          debitVes: subtotalVes,
          creditVes: 0,
          referenceDoc: note.note_number,
        },
        {
          accountId: accVatDebit.id,
          description: `Reversión Débito Fiscal IVA NC ${note.note_number}`,
          debitVes: taxVes,
          creditVes: 0,
          referenceDoc: note.note_number,
        },
        {
          accountId: targetAr.id,
          description: `Crédito a favor de Cliente ${customerLabel} NC ${note.note_number}`,
          debitVes: 0,
          creditVes: totalVes,
          referenceDoc: note.note_number,
        }
      );

      // Si fue devolución física de mercancía (RETURN), reingreso al inventario al costo
      if (note.reason === 'RETURN' && accInventory && accCostOfSales) {
        const [items]: any = await connOrPool.query(
          `SELECT SUM(cni.quantity * COALESCE(p.cost_price, 0)) as total_cost_usd
           FROM customer_note_items cni
           INNER JOIN products p ON cni.product_id = p.id
           WHERE cni.customer_note_id = ?`,
          [noteId]
        );
        const costUsd = Number(items[0]?.total_cost_usd || 0);
        const costVes = Number((costUsd * rate).toFixed(2));

        if (costVes > 0.01) {
          // Asiento complementario de reingreso al costo
          await this.createInternalEntry(connOrPool, {
            companyId,
            userId,
            branchId: note.branch_id,
            entryDate: noteDate,
            concept: `Reingreso al Inventario por Devolución NC N° ${note.note_number}`,
            currency: 'VES',
            exchangeRate: rate,
            originType: 'CUSTOMER_NOTE_COST',
            originId: noteId,
            status: settings.defaultEntryStatus,
            lines: [
              {
                accountId: accInventory.id,
                description: `Reingreso de Mercancía NC ${note.note_number}`,
                debitVes: costVes,
                creditVes: 0,
                referenceDoc: note.note_number,
              },
              {
                accountId: accCostOfSales.id,
                description: `Reversión de Costo de Ventas NC ${note.note_number}`,
                debitVes: 0,
                creditVes: costVes,
                referenceDoc: note.note_number,
              },
            ],
          });
        }
      }
    } else {
      // Nota de Débito: Incrementa cuenta por cobrar e ingresos
      const accRev = await this.resolveAccount(connOrPool, companyId, 'SALES_REVENUE', '4.1.01');
      if (!accRev) return null;

      lines.push(
        {
          accountId: targetAr.id,
          description: `Débito aplicado a Cliente ${customerLabel} ND ${note.note_number}`,
          debitVes: totalVes,
          creditVes: 0,
          referenceDoc: note.note_number,
        },
        {
          accountId: accRev.id,
          description: `Ingreso por Nota de Débito ${note.note_number}`,
          debitVes: 0,
          creditVes: subtotalVes,
          referenceDoc: note.note_number,
        },
        {
          accountId: accVatDebit.id,
          description: `Débito Fiscal IVA ND ${note.note_number}`,
          debitVes: 0,
          creditVes: taxVes,
          referenceDoc: note.note_number,
        }
      );
    }

    const entry = await this.createInternalEntry(connOrPool, {
      companyId,
      userId,
      branchId: note.branch_id,
      entryDate: noteDate,
      concept: `Nota de ${note.note_type === 'CREDIT' ? 'Crédito' : 'Débito'} N° ${note.note_number} - ${customerLabel}`,
      currency: (note.currency as 'VES' | 'USD') || 'VES',
      exchangeRate: rate,
      originType: 'CUSTOMER_NOTE',
      originId: noteId,
      status: settings.defaultEntryStatus,
      lines,
    });

    return { entryId: entry?.id };
  }

  // ==========================================================================
  // 8. CONTABILIZACIÓN DE NOTAS DE PROVEEDOR
  // ==========================================================================

  static async postSupplierNote(
    connOrPool: any,
    noteId: string,
    userId: string
  ): Promise<{ entryId?: string } | null> {
    const [noteRows]: any = await connOrPool.query(
      `SELECT sn.*, s.legal_name as supplier_name
       FROM supplier_notes sn
       LEFT JOIN suppliers s ON sn.supplier_id = s.id
       WHERE sn.id = ?`,
      [noteId]
    );

    if (!noteRows || noteRows.length === 0) return null;
    const note = noteRows[0];
    const companyId = note.company_id;

    const settings = await this.getSettings(companyId);
    if (!settings.autoPostingEnabled || !settings.postNotes) {
      return null;
    }

    const [accApVes, accApUsd, accInventory, accVatCredit] = await Promise.all([
      this.resolveAccount(connOrPool, companyId, 'AP_SUPPLIERS_VES', '2.1.01.01'),
      this.resolveAccount(connOrPool, companyId, 'AP_SUPPLIERS_USD', '2.1.01.02'),
      this.resolveAccount(connOrPool, companyId, 'INVENTORY_MERCHANDISE', '1.1.04.01'),
      this.resolveAccount(connOrPool, companyId, 'VAT_CREDIT', '1.1.03.01'),
    ]);

    if (!accInventory || !accVatCredit) return null;

    const rate = Number(note.exchange_rate) || 1;
    const noteDate = note.created_at ? new Date(note.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const supplierLabel = note.supplier_name || 'Proveedor';

    const subtotalVes = Number((Number(note.subtotal_amount || 0) * rate).toFixed(2));
    const taxVes = Number((Number(note.tax_amount || 0) * rate).toFixed(2));
    const totalVes = Number((Number(note.total_amount || 0) * rate).toFixed(2));

    const targetAp = note.currency === 'USD' && accApUsd ? accApUsd : (accApVes || accApUsd);
    if (!targetAp) return null;

    const lines: any[] = [];

    if (note.note_type === 'CREDIT') {
      // Disminuye CxP y disminuye inventario / crédito fiscal
      lines.push(
        {
          accountId: targetAp.id,
          description: `Disminución CxP Proveedor ${supplierLabel} NC ${note.note_number}`,
          debitVes: totalVes,
          creditVes: 0,
          referenceDoc: note.note_number,
        },
        {
          accountId: accInventory.id,
          description: `Devolución de Mercancía a Proveedor NC ${note.note_number}`,
          debitVes: 0,
          creditVes: subtotalVes,
          referenceDoc: note.note_number,
        },
        {
          accountId: accVatCredit.id,
          description: `Reversión Crédito Fiscal IVA NC ${note.note_number}`,
          debitVes: 0,
          creditVes: taxVes,
          referenceDoc: note.note_number,
        }
      );
    } else {
      // Nota de Débito Proveedor: Aumenta deuda e inventario
      lines.push(
        {
          accountId: accInventory.id,
          description: `Cargo adicional en compras ND ${note.note_number}`,
          debitVes: subtotalVes,
          creditVes: 0,
          referenceDoc: note.note_number,
        },
        {
          accountId: accVatCredit.id,
          description: `Crédito Fiscal IVA ND ${note.note_number}`,
          debitVes: taxVes,
          creditVes: 0,
          referenceDoc: note.note_number,
        },
        {
          accountId: targetAp.id,
          description: `Aumento CxP Proveedor ${supplierLabel} ND ${note.note_number}`,
          debitVes: 0,
          creditVes: totalVes,
          referenceDoc: note.note_number,
        }
      );
    }

    const entry = await this.createInternalEntry(connOrPool, {
      companyId,
      userId,
      branchId: note.branch_id,
      entryDate: noteDate,
      concept: `Nota de ${note.note_type === 'CREDIT' ? 'Crédito' : 'Débito'} Proveedor N° ${note.note_number} - ${supplierLabel}`,
      currency: (note.currency as 'VES' | 'USD') || 'VES',
      exchangeRate: rate,
      originType: 'SUPPLIER_NOTE',
      originId: noteId,
      status: settings.defaultEntryStatus,
      lines,
    });

    return { entryId: entry?.id };
  }

  // ==========================================================================
  // 9. CONTABILIZACIÓN DE TESORERÍA (DEPÓSITOS DE CAJA Y TRANSFERENCIAS)
  // ==========================================================================

  static async postCashShiftDeposit(
    connOrPool: any,
    depositId: string,
    userId: string
  ): Promise<{ entryId?: string } | null> {
    const [depRows]: any = await connOrPool.query(
      `SELECT d.*, cs.company_id, cs.branch_id, ba.accounting_account_id as bank_acc_id
       FROM cash_shift_deposits d
       INNER JOIN cash_shifts cs ON d.shift_id = cs.id
       LEFT JOIN bank_accounts ba ON d.bank_account_id = ba.id
       WHERE d.id = ?`,
      [depositId]
    );

    if (!depRows || depRows.length === 0) return null;
    const dep = depRows[0];
    const companyId = dep.company_id;

    const settings = await this.getSettings(companyId);
    if (!settings.autoPostingEnabled || !settings.postTreasury) return null;

    const [accCashVes, accCashUsd, accBankVes, accBankUsd] = await Promise.all([
      this.resolveAccount(connOrPool, companyId, 'CASH_VES', '1.1.01.01'),
      this.resolveAccount(connOrPool, companyId, 'CASH_USD', '1.1.01.03'),
      this.resolveAccount(connOrPool, companyId, 'BANK_VES_DEFAULT', '1.1.01.04'),
      this.resolveAccount(connOrPool, companyId, 'BANK_USD_DEFAULT', '1.1.01.06'),
    ]);

    const isUsd = dep.currency === 'USD';
    const amount = Number(dep.amount || 0);
    const amountVes = isUsd ? Number((amount * 1).toFixed(2)) : amount; // depósitos usualmente en moneda local o banco custodia

    const targetBank = dep.bank_acc_id ? { id: dep.bank_acc_id } : (isUsd ? accBankUsd : accBankVes);
    const targetCash = isUsd ? accCashUsd : accCashVes;

    if (!targetBank || !targetCash || amountVes <= 0) return null;

    const depDate = dep.created_at ? new Date(dep.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const entry = await this.createInternalEntry(connOrPool, {
      companyId,
      userId,
      branchId: dep.branch_id,
      entryDate: depDate,
      concept: `Depósito Bancario Cierre de Caja Ref: ${dep.reference_number || 'S/N'}`,
      currency: dep.currency,
      exchangeRate: 1,
      originType: 'CASH_DEPOSIT',
      originId: depositId,
      status: settings.defaultEntryStatus,
      lines: [
        {
          accountId: targetBank.id,
          description: `Depósito en Cuenta Bancaria Ref: ${dep.reference_number || 'N/A'}`,
          debitVes: amountVes,
          creditVes: 0,
          referenceDoc: dep.reference_number,
        },
        {
          accountId: targetCash.id,
          description: `Egreso de Efectivo de Caja por Depósito`,
          debitVes: 0,
          creditVes: amountVes,
          referenceDoc: dep.reference_number,
        },
      ],
    });

    return { entryId: entry?.id };
  }

  // ==========================================================================
  // 10. PROCESO BATCH Y AUDITORÍA DE ESTADO
  // ==========================================================================

  static async getStatus(companyId: string) {
    const settings = await this.getSettings(companyId);

    // Contar documentos pendientes de contabilización
    const [salesPending]: any = await pool.query(
      `SELECT COUNT(*) as count FROM sales_invoices i
       INNER JOIN branches b ON i.branch_id = b.id
       LEFT JOIN accounting_journal_entries e ON e.company_id = b.company_id 
         AND e.origin_type = 'SALE_INVOICE' AND e.origin_id = i.id AND e.status != 'ANNULLED'
       WHERE b.company_id = ? AND i.status != 'ANNULLED' AND e.id IS NULL`,
      [companyId]
    );

    const [purchasesPending]: any = await pool.query(
      `SELECT COUNT(*) as count FROM purchase_invoices pi
       INNER JOIN branches b ON pi.branch_id = b.id
       LEFT JOIN accounting_journal_entries e ON e.company_id = b.company_id 
         AND e.origin_type = 'PURCHASE_INVOICE' AND e.origin_id = pi.id AND e.status != 'ANNULLED'
       WHERE b.company_id = ? AND pi.status != 'ANNULLED' AND e.id IS NULL`,
      [companyId]
    );

    const [payablesPending]: any = await pool.query(
      `SELECT COUNT(*) as count FROM purchase_payments pp
       INNER JOIN payables p ON pp.payable_id = p.id
       INNER JOIN branches b ON p.branch_id = b.id
       LEFT JOIN accounting_journal_entries e ON e.company_id = b.company_id 
         AND e.origin_type = 'AP_PAYMENT' AND e.origin_id = pp.id AND e.status != 'ANNULLED'
       WHERE b.company_id = ? AND e.id IS NULL`,
      [companyId]
    );

    const [totalPosted]: any = await pool.query(
      `SELECT COUNT(*) as count, 
              COALESCE(SUM(total_debit_ves), 0) as total_ves, 
              COALESCE(SUM(total_debit_usd), 0) as total_usd
       FROM accounting_journal_entries 
       WHERE company_id = ? AND status = 'POSTED'`,
      [companyId]
    );

    return {
      settings,
      stats: {
        totalPostedEntries: Number(totalPosted[0]?.count || 0),
        totalPostedVes: Number(totalPosted[0]?.total_ves || 0),
        totalPostedUsd: Number(totalPosted[0]?.total_usd || 0),
        pendingSalesInvoices: Number(salesPending[0]?.count || 0),
        pendingPurchaseInvoices: Number(purchasesPending[0]?.count || 0),
        pendingPayablePayments: Number(payablesPending[0]?.count || 0),
      },
    };
  }

  static async runBatchPosting(
    companyId: string,
    userId: string,
    filter: BatchPostingInput
  ): Promise<{ processed: number; posted: number; errors: number; details: string[] }> {
    let processed = 0;
    let posted = 0;
    let errors = 0;
    const details: string[] = [];

    // 1. Facturas de Venta
    if (filter.originType === 'ALL' || filter.originType === 'SALE_INVOICE' || filter.originType === 'POS_SALE') {
      const [sales]: any = await pool.query(
        `SELECT i.id, i.invoice_number FROM sales_invoices i
         INNER JOIN branches b ON i.branch_id = b.id
         LEFT JOIN accounting_journal_entries e ON e.company_id = b.company_id 
           AND e.origin_type = 'SALE_INVOICE' AND e.origin_id = i.id AND e.status != 'ANNULLED'
         WHERE b.company_id = ? AND i.status != 'ANNULLED' AND e.id IS NULL
         ORDER BY i.invoice_date ASC LIMIT ?`,
        [companyId, filter.limit]
      );

      for (const s of sales) {
        processed++;
        try {
          await withTransaction(async (conn) => {
            await this.postSaleInvoice(conn, s.id, userId);
          });
          posted++;
          details.push(`Factura de Venta ${s.invoice_number} contabilizada exitosamente`);
        } catch (err: any) {
          errors++;
          details.push(`Error en Factura ${s.invoice_number}: ${err.message}`);
        }
      }
    }

    // 2. Facturas de Compra
    if (filter.originType === 'ALL' || filter.originType === 'PURCHASE_INVOICE') {
      const [purchases]: any = await pool.query(
        `SELECT pi.id, pi.invoice_number FROM purchase_invoices pi
         INNER JOIN branches b ON pi.branch_id = b.id
         LEFT JOIN accounting_journal_entries e ON e.company_id = b.company_id 
           AND e.origin_type = 'PURCHASE_INVOICE' AND e.origin_id = pi.id AND e.status != 'ANNULLED'
         WHERE b.company_id = ? AND pi.status != 'ANNULLED' AND e.id IS NULL
         ORDER BY pi.invoice_date ASC LIMIT ?`,
        [companyId, filter.limit]
      );

      for (const p of purchases) {
        processed++;
        try {
          await withTransaction(async (conn) => {
            await this.postPurchaseInvoice(conn, p.id, userId);
          });
          posted++;
          details.push(`Factura de Compra ${p.invoice_number} contabilizada exitosamente`);
        } catch (err: any) {
          errors++;
          details.push(`Error en Compra ${p.invoice_number}: ${err.message}`);
        }
      }
    }

    // 3. Pagos a Proveedores
    if (filter.originType === 'ALL' || filter.originType === 'AP_PAYMENT') {
      const [payments]: any = await pool.query(
        `SELECT pp.id, pp.reference_number FROM purchase_payments pp
         INNER JOIN payables p ON pp.payable_id = p.id
         INNER JOIN branches b ON p.branch_id = b.id
         LEFT JOIN accounting_journal_entries e ON e.company_id = b.company_id 
           AND e.origin_type = 'AP_PAYMENT' AND e.origin_id = pp.id AND e.status != 'ANNULLED'
         WHERE b.company_id = ? AND e.id IS NULL
         ORDER BY pp.created_at ASC LIMIT ?`,
        [companyId, filter.limit]
      );

      for (const pay of payments) {
        processed++;
        try {
          await withTransaction(async (conn) => {
            await this.postPayablePayment(conn, pay.id, userId);
          });
          posted++;
          details.push(`Pago CxP Ref: ${pay.reference_number || pay.id} contabilizado exitosamente`);
        } catch (err: any) {
          errors++;
          details.push(`Error en Pago CxP ${pay.id}: ${err.message}`);
        }
      }
    }

    return { processed, posted, errors, details };
  }
}
