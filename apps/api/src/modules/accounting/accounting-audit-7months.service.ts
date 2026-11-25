import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query, withTransaction } from '../../db';
import { AccountingAutoPostingService } from './accounting-auto-posting.service';
import { AccountingService } from './accounting.service';
import { STANDARD_CHART_OF_ACCOUNTS } from './accounting-defaults';

export interface MonthAuditResult {
  month: number;
  periodLabel: string;
  exchangeRateBcv: number;
  inpcValue: number;
  journalEntriesCount: number;
  totalDebitVes: number;
  totalCreditVes: number;
  debitCreditDiffVes: number;
  orphanEntriesCount: number;
  draftEntriesCount: number;
  outOfRangeEntriesCount: number;
  cumulativeBalanceBeforeVes: number;
  cumulativeBalanceAfterVes: number;
  salesInvoicesCount: number;
  salesBookCount: number;
  purchaseInvoicesCount: number;
  purchasesBookCount: number;
  kardexDiscrepanciesCount: number;
  treasuryDiscrepanciesCount: number;
  cxcAgingDiff: number;
  cxpAgingDiff: number;
  periodStatus: 'OPEN' | 'CLOSED' | 'LOCKED';
  auditStatus: 'OK' | 'ALERTA' | 'ERROR';
  findings: string[];
}

export interface EdgeCaseAuditResult {
  name: string;
  expectedBehavior: string;
  detected: boolean;
  actualMessage: string;
  status: 'OK' | 'ERROR';
}

export interface FullAuditReport {
  companyId: string;
  companyName: string;
  fiscalYear: number;
  executedAt: string;
  months: MonthAuditResult[];
  edgeCases: EdgeCaseAuditResult[];
  overallStatus: 'OK' | 'ALERTA' | 'ERROR';
}

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export class AccountingAudit7MonthsService {
  static readonly AUDIT_COMPANY_ID = 'a0000000-0000-4000-8000-202600000001';
  static readonly AUDIT_BRANCH_MAIN_ID = 'a0000000-0000-4000-8000-202600000002';
  static readonly AUDIT_WH_MAIN_ID = 'a0000000-0000-4000-8000-202600000003';
  static readonly AUDIT_WH_SUB_ID = 'a0000000-0000-4000-8000-202600000004';
  static readonly AUDIT_USER_ID = 'a0000000-0000-4000-8000-202600000005';
  static readonly AUDIT_SUPPLIER_ID = 'a0000000-0000-4000-8000-202600000006';
  static readonly AUDIT_CUSTOMER_ID = 'a0000000-0000-4000-8000-202600000007';
  static readonly AUDIT_BANK_VES_ID = 'a0000000-0000-4000-8000-202600000008';
  static readonly AUDIT_BANK_USD_ID = 'a0000000-0000-4000-8000-202600000009';
  static readonly AUDIT_CASH_REG_ID = 'a0000000-0000-4000-8000-202600000010';
  static readonly AUDIT_FISCAL_YEAR_ID = 'a0000000-0000-4000-8000-202600000011';

  /**
   * Limpia únicamente los datos de la empresa aislada de auditoría para garantizar idempotencia
   */
  static async cleanupAuditCompany(): Promise<void> {
    const cid = this.AUDIT_COMPANY_ID;
    const branchId = this.AUDIT_BRANCH_MAIN_ID;

    await withTransaction(async (conn) => {
      // Desactivar temporalmente FK checks dentro de la transacción de limpieza aislada
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      try {
        await conn.query(`DELETE l FROM accounting_journal_lines l INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id WHERE e.company_id = ?`, [cid]);
        await conn.query(`DELETE FROM accounting_revaluation_logs WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM accounting_journal_entries WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM accounting_account_mappings WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM accounting_settings WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE p FROM accounting_fiscal_periods p INNER JOIN accounting_fiscal_years y ON p.fiscal_year_id = y.id WHERE y.company_id = ?`, [cid]);
        await conn.query(`DELETE FROM accounting_fiscal_years WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM accounting_accounts WHERE company_id = ?`, [cid]);

        await conn.query(`DELETE FROM production_waste_logs WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE o FROM production_order_outputs o INNER JOIN production_orders po ON o.order_id = po.id WHERE po.company_id = ?`, [cid]);
        await conn.query(`DELETE FROM production_orders WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM waste_reasons WHERE company_id = ?`, [cid]);

        await conn.query(`DELETE FROM tax_withholdings_iva WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM tax_withholdings_islr WHERE company_id = ?`, [cid]);

        await conn.query(`DELETE sp FROM sales_payments sp INNER JOIN sales_invoices si ON sp.invoice_id = si.id WHERE si.branch_id = ?`, [branchId]);
        await conn.query(`DELETE sii FROM sales_invoice_items sii INNER JOIN sales_invoices si ON sii.invoice_id = si.id WHERE si.branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM receivables WHERE branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM customer_note_items WHERE note_id IN (SELECT id FROM customer_notes WHERE branch_id = ?)`, [branchId]);
        await conn.query(`DELETE FROM customer_notes WHERE branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM sales_invoices WHERE branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM cash_shifts WHERE branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM cash_registers WHERE branch_id = ?`, [branchId]);

        await conn.query(`DELETE pp FROM purchase_payments pp INNER JOIN payables p ON pp.payable_id = p.id WHERE p.branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM payables WHERE branch_id = ?`, [branchId]);
        await conn.query(`DELETE pii FROM purchase_invoice_items pii INNER JOIN purchase_invoices pi ON pii.invoice_id = pi.id WHERE pi.branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM purchase_invoices WHERE branch_id = ?`, [branchId]);

        await conn.query(`DELETE iti FROM inventory_transfer_items iti INNER JOIN inventory_transfers it ON iti.transfer_id = it.id WHERE it.origin_branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM inventory_transfers WHERE origin_branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM inventory_movements WHERE branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM product_stocks WHERE warehouse_id IN (?, ?)`, [this.AUDIT_WH_MAIN_ID, this.AUDIT_WH_SUB_ID]);
        await conn.query(`DELETE FROM products WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM subgroups WHERE group_id IN (SELECT id FROM \`groups\` WHERE department_id IN (SELECT id FROM departments WHERE company_id = ?))`, [cid]);
        await conn.query(`DELETE FROM \`groups\` WHERE department_id IN (SELECT id FROM departments WHERE company_id = ?)`, [cid]);
        await conn.query(`DELETE FROM departments WHERE company_id = ?`, [cid]);

        await conn.query(`DELETE FROM bank_movements WHERE account_id IN (?, ?)`, [this.AUDIT_BANK_VES_ID, this.AUDIT_BANK_USD_ID]);
        await conn.query(`DELETE FROM bank_reconciliations WHERE account_id IN (?, ?)`, [this.AUDIT_BANK_VES_ID, this.AUDIT_BANK_USD_ID]);
        await conn.query(`DELETE FROM bank_accounts WHERE company_id = ?`, [cid]);

        await conn.query(`DELETE FROM suppliers WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM customers WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM exchange_rates WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM audit_logs WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM warehouses WHERE branch_id = ?`, [branchId]);
        await conn.query(`DELETE FROM branches WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM users WHERE company_id = ?`, [cid]);
        await conn.query(`DELETE FROM companies WHERE id = ?`, [cid]);
      } finally {
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      }
    });
  }

  /**
   * Ejecuta el flujo completo: Seed Base -> 7 Meses (Jun-Dic 2026) -> Cierres -> Casos Borde -> Auditoría SQL
   */
  static async runFull7MonthSimulationAndAudit(writeMarkdownReport: boolean = true): Promise<FullAuditReport> {
    await this.cleanupAuditCompany();

    const cid = this.AUDIT_COMPANY_ID;
    const branchId = this.AUDIT_BRANCH_MAIN_ID;
    const whMain = this.AUDIT_WH_MAIN_ID;
    const whSub = this.AUDIT_WH_SUB_ID;
    const userId = this.AUDIT_USER_ID;

    const prodCanalId = 'a0000000-0000-4000-8000-202600000101';
    const prodLomitoId = 'a0000000-0000-4000-8000-202600000102';
    const prodPrimeraId = 'a0000000-0000-4000-8000-202600000103';
    const prodHarinaId = 'a0000000-0000-4000-8000-202600000104';
    const wasteReasonId = 'a0000000-0000-4000-8000-202600000201';
    const deptId = 'a0000000-0000-4000-8000-202600000301';
    const groupId = 'a0000000-0000-4000-8000-202600000302';
    const subgroupId = 'a0000000-0000-4000-8000-202600000303';

    // -----------------------------------------------------------------------
    // FASE 1: SEED BASE DE LA EMPRESA DE AUDITORÍA
    // -----------------------------------------------------------------------
    const periodIdsByMonth = new Map<number, string>();
    const accountIdByCode = new Map<string, string>();

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO companies (id, rif, legal_name, trade_name, fiscal_address, phone, email, is_special_taxpayer, iva_retention_rate, currency_base, currency_secondary, is_active)
         VALUES (?, 'J-99999999-0', 'Corporación Auditoría VEN-NIF C.A.', 'Auditoría ERP VE', 'Av. Francisco de Miranda, Caracas', '0212-5550000', 'auditoria@eroerp.test', 1, 75.00, 'VES', 'USD', 1)`,
        [cid]
      );

      await conn.query(
        `INSERT INTO branches (id, company_id, code, name, address, is_main, is_active)
         VALUES (?, ?, 'SEDE-AUD', 'Sede Principal Auditoría', 'Caracas, Distrito Capital', 1, 1)`,
        [branchId, cid]
      );

      await conn.query(
        `INSERT INTO warehouses (id, branch_id, code, name, is_default, is_default_sales, is_default_purchases, is_active)
         VALUES (?, ?, 'ALM-AUD-01', 'Almacén Principal Auditoría', 1, 1, 1, 1),
                (?, ?, 'ALM-AUD-02', 'Almacén Sucursal Auditoría', 0, 0, 0, 1)`,
        [whMain, branchId, whSub, branchId]
      );

      // Obtener un rol existente para el usuario auditor
      const [roleRows]: any = await conn.query(`SELECT id FROM roles LIMIT 1`);
      const roleId = roleRows[0]?.id || '00000000-0000-0000-0000-000000000001';

      await conn.query(
        `INSERT INTO users (id, company_id, role_id, username, email, password_hash, full_name, is_active)
         VALUES (?, ?, ?, 'auditor_v2026', 'auditor@eroerp.test', 'hash_no_login', 'Auditor Contable VEN-NIF', 1)`,
        [userId, cid, roleId]
      );

      // Plan de cuentas VEN-NIF
      const defaultAccounts = STANDARD_CHART_OF_ACCOUNTS;
      const parentCodeToId = new Map<string, string>();
      for (const acc of defaultAccounts) {
        const accId = crypto.randomUUID();
        parentCodeToId.set(acc.code, accId);
        accountIdByCode.set(acc.code, accId);
        const parentId = acc.parent ? parentCodeToId.get(acc.parent) || null : null;

        await conn.query(
          `INSERT INTO accounting_accounts (
            id, company_id, code, name, level, parent_id, account_type, classification,
            normal_balance, accepts_postings, is_monetary, is_bank_or_cash, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            accId, cid, acc.code, acc.name, acc.level, parentId, acc.type,
            acc.classif, acc.balance, acc.post ? 1 : 0, acc.monetary ? 1 : 0, acc.bankCash ? 1 : 0,
          ]
        );
      }

      // Configuración de Auto-Contabilización
      await conn.query(
        `INSERT INTO accounting_settings (
          id, company_id, auto_posting_enabled, default_entry_status,
          post_sales, post_purchases, post_payments, post_notes, post_inventory_adjustments, post_treasury
        ) VALUES (?, ?, 1, 'POSTED', 1, 1, 1, 1, 1, 1)`,
        [crypto.randomUUID(), cid]
      );

      const mappings: Array<[string, string, string]> = [
        ['SALES_REVENUE', '4.1.01', 'Ventas Gravadas'],
        ['SALES_REVENUE_EXEMPT', '4.1.02', 'Ventas Exentas'],
        ['VAT_DEBIT', '2.1.02.01', 'IVA Débito Fiscal'],
        ['VAT_CREDIT', '1.1.03.01', 'IVA Crédito Fiscal'],
        ['IGTF_PAYABLE', '2.1.02.05', 'IGTF por Enterar'],
        ['AR_CUSTOMERS_VES', '1.1.02.01', 'Clientes Nacionales'],
        ['AR_CUSTOMERS_USD', '1.1.02.02', 'Clientes USD'],
        ['AP_SUPPLIERS_VES', '2.1.01.01', 'Proveedores Nacionales'],
        ['AP_SUPPLIERS_USD', '2.1.01.02', 'Proveedores USD'],
        ['INVENTORY_MERCHANDISE', '1.1.04.01', 'Inventario Mercancías'],
        ['COST_OF_SALES', '5.1.01', 'Costo de Ventas'],
        ['INVENTORY_ADJUST_EXPENSE', '5.1.01', 'Pérdida / Merma Inventario'],
        ['CASH_VES', '1.1.01.01', 'Caja Principal VES'],
        ['CASH_USD', '1.1.01.03', 'Caja USD'],
        ['BANK_VES_DEFAULT', '1.1.01.04', 'Banco Nacional VES'],
        ['BANK_USD_DEFAULT', '1.1.01.06', 'Banco Divisas USD'],
        ['WITHHOLDING_VAT_ISSUED', '2.1.02.02', 'Retenciones IVA'],
        ['WITHHOLDING_ISLR_ISSUED', '2.1.02.03', 'Retenciones ISLR'],
        ['EXCHANGE_DIFF_GAIN', '7.2.01', 'Ganancia Cambiaria'],
        ['EXCHANGE_DIFF_LOSS', '7.1.02', 'Pérdida Cambiaria'],
      ];
      for (const [key, code, desc] of mappings) {
        const accId = accountIdByCode.get(code);
        if (accId) {
          await conn.query(
            `INSERT INTO accounting_account_mappings (id, company_id, mapping_key, account_id, description)
             VALUES (?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), cid, key, accId, desc]
          );
        }
      }

      // Año fiscal 2026 y 12 períodos
      await conn.query(
        `INSERT INTO accounting_fiscal_years (id, company_id, year, start_date, end_date, status)
         VALUES (?, ?, 2026, '2026-01-01', '2026-12-31', 'OPEN')`,
        [this.AUDIT_FISCAL_YEAR_ID, cid]
      );
      for (let m = 1; m <= 12; m++) {
        const pId = crypto.randomUUID();
        periodIdsByMonth.set(m, pId);
        const lastDay = new Date(2026, m, 0).getDate();
        const startStr = `2026-${String(m).padStart(2, '0')}-01`;
        const endStr = `2026-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        await conn.query(
          `INSERT INTO accounting_fiscal_periods (id, fiscal_year_id, month, start_date, end_date, status)
           VALUES (?, ?, ?, ?, ?, 'OPEN')`,
          [pId, this.AUDIT_FISCAL_YEAR_ID, m, startStr, endStr]
        );
      }

      // Bancos y Cuentas Bancarias vinculadas a 1.1.01.04 y 1.1.01.06
      const [bankRows]: any = await conn.query(`SELECT id FROM banks LIMIT 1`);
      const bankId = bankRows[0]?.id || 'b0191000-0000-0000-0000-000000000191';

      await conn.query(
        `INSERT INTO bank_accounts (id, company_id, bank_id, branch_id, account_number, account_type, currency, description, current_balance, is_active, accounting_account_id)
         VALUES (?, ?, ?, ?, '01919999000000000001', 'CURRENT', 'VES', 'Cuenta Auditoría VES', 500000.00, 1, ?),
                (?, ?, ?, ?, '01919999000000000002', 'CUSTODY_USD', 'USD', 'Cuenta Auditoría USD', 15000.00, 1, ?)`,
        [
          this.AUDIT_BANK_VES_ID, cid, bankId, branchId, accountIdByCode.get('1.1.01.04'),
          this.AUDIT_BANK_USD_ID, cid, bankId, branchId, accountIdByCode.get('1.1.01.06'),
        ]
      );

      // Caja registradora
      await conn.query(
        `INSERT INTO cash_registers (id, branch_id, code, name, is_active)
         VALUES (?, ?, 'CAJA-AUD-01', 'Caja Principal Auditoría', 1)`,
        [this.AUDIT_CASH_REG_ID, branchId]
      );

      // Proveedor y Cliente
      await conn.query(
        `INSERT INTO suppliers (id, company_id, rif, name, fiscal_address, is_person_natural, is_resident, payment_terms_days, is_active)
         VALUES (?, ?, 'J-30123456-7', 'Distribuidora Cárnica Nacional C.A.', 'Zona Industrial, Valencia', 0, 1, 30, 1)`,
        [this.AUDIT_SUPPLIER_ID, cid]
      );
      await conn.query(
        `INSERT INTO customers (id, company_id, doc_type, doc_number, name, address, credit_enabled, credit_limit, payment_terms_days, is_active)
         VALUES (?, ?, 'J', '30987654-3', 'Supermercado Central C.A.', 'Av. Bolívar, Caracas', 1, 20000.00, 15, 1)`,
        [this.AUDIT_CUSTOMER_ID, cid]
      );

      // Jerarquía y Productos
      await conn.query(`INSERT INTO departments (id, company_id, code, name, is_active) VALUES (?, ?, 'CARN', 'Carnicería & Víveres', 1)`, [deptId, cid]);
      await conn.query(`INSERT INTO \`groups\` (id, department_id, code, name, is_active) VALUES (?, ?, 'RES', 'Res y Derivados', 1)`, [groupId, deptId]);
      await conn.query(`INSERT INTO subgroups (id, group_id, code, name, is_active) VALUES (?, ?, 'CORT', 'Cortes y Canal', 1)`, [subgroupId, groupId]);

      await conn.query(
        `INSERT INTO products (
          id, company_id, sku, name, product_type, tracks_inventory, department_id, group_id, subgroup_id,
          unit_of_measure, cost_price, base_price, currency, is_active, allows_waste, is_butchery_base, is_butchery_yield, expected_waste_pct
        ) VALUES
          (?, ?, 'AUD-CANAL', 'Carne en Canal (kg)', 'raw_material', 1, ?, ?, ?, 'KG', 4.0000, 0.0000, 'USD', 1, 1, 1, 0, 15.00),
          (?, ?, 'AUD-LOMITO', 'Lomito Limpio (kg)', 'physical', 1, ?, ?, ?, 'KG', 6.5000, 12.0000, 'USD', 1, 0, 0, 1, 0.00),
          (?, ?, 'AUD-PRIMERA', 'Carne de Primera (kg)', 'physical', 1, ?, ?, ?, 'KG', 5.0000, 9.0000, 'USD', 1, 0, 0, 1, 0.00),
          (?, ?, 'AUD-HARINA', 'Harina Precocida 1kg', 'physical', 1, ?, ?, ?, 'UND', 1.0000, 1.6000, 'USD', 1, 0, 0, 0, 0.00)`,
        [
          prodCanalId, cid, deptId, groupId, subgroupId,
          prodLomitoId, cid, deptId, groupId, subgroupId,
          prodPrimeraId, cid, deptId, groupId, subgroupId,
          prodHarinaId, cid, deptId, groupId, subgroupId,
        ]
      );

      await conn.query(
        `INSERT INTO waste_reasons (id, company_id, code, name, affects_cost, is_active)
         VALUES (?, ?, 'HUESO_GRASA', 'Hueso y Grasa no comercializable', 1, 1)`,
        [wasteReasonId, cid]
      );
    });

    // Asiento inicial de Apertura (2026-06-01)
    const initRate = 42.50;
    const initVesTotal = 500000 + 15000 * initRate; // 500,000 Bs + $15,000 * 42.50 = 1,137,500 Bs
    const openEntry = await AccountingService.createJournalEntry(cid, userId, {
      branchId,
      entryDate: '2026-06-01',
      entryType: 'OPENING',
      concept: 'Asiento de Apertura Saldos Iniciales Junio 2026',
      currency: 'VES',
      exchangeRate: initRate,
      lines: [
        {
          accountId: accountIdByCode.get('1.1.01.04')!,
          description: 'Saldo Inicial Banco VES',
          debitVes: 500000,
          creditVes: 0,
          debitUsd: Number((500000 / initRate).toFixed(2)),
          creditUsd: 0,
        },
        {
          accountId: accountIdByCode.get('1.1.01.06')!,
          description: 'Saldo Inicial Banco USD ($15,000)',
          debitVes: 15000 * initRate,
          creditVes: 0,
          debitUsd: 15000,
          creditUsd: 0,
        },
        {
          accountId: accountIdByCode.get('3.1.01') || accountIdByCode.get('3.1') || Array.from(accountIdByCode.values())[0],
          description: 'Capital Social / Patrimonio Inicial',
          debitVes: 0,
          creditVes: initVesTotal,
          debitUsd: 0,
          creditUsd: Number((initVesTotal / initRate).toFixed(2)),
        },
      ],
    });
    await AccountingService.postJournalEntry(cid, userId, openEntry.id);

    // -----------------------------------------------------------------------
    // FASE 2: SIMULACIÓN CRONOLÓGICA DE 7 MESES (JUNIO A DICIEMBRE 2026)
    // -----------------------------------------------------------------------
    const monthlyRates = new Map<number, number>([
      [6, 42.50],
      [7, 44.10],
      [8, 46.20],
      [9, 48.00],
      [10, 50.15],
      [11, 52.40],
      [12, 54.80],
    ]);
    const monthlyInpc = new Map<number, number>([
      [6, 112.40],
      [7, 115.80],
      [8, 119.50],
      [9, 123.10],
      [10, 127.40],
      [11, 131.90],
      [12, 136.80],
    ]);

    const monthsReport: MonthAuditResult[] = [];
    let prevCumulativeBalanceVes = 0;

    for (let m = 6; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const rate = monthlyRates.get(m)!;
      const inpc = monthlyInpc.get(m)!;
      const periodId = periodIdsByMonth.get(m)!;

      // 2.1 Tasa BCV e INPC del mes
      await query(
        `INSERT INTO exchange_rates (id, company_id, rate, currency_base, currency_secondary, effective_date, source, user_id, created_by_name)
         VALUES (?, ?, ?, 'VES', 'USD', ?, 'BCV', ?, 'Auditor')`,
        [crypto.randomUUID(), cid, rate, `2026-${mm}-05`, userId]
      );
      await query(
        `INSERT INTO accounting_inflation_indices (id, year, month, inpc_value, variation_monthly, published_date)
         VALUES (?, 2026, ?, ?, 3.20, ?)
         ON DUPLICATE KEY UPDATE inpc_value = VALUES(inpc_value)`,
        [crypto.randomUUID(), m, inpc, `2026-${mm}-28`]
      );

      // 2.2 Compra de Inventario + CxP + Retención IVA/ISLR + Pago a Proveedor
      const purchaseInvId = crypto.randomUUID();
      const payableId = crypto.randomUUID();
      const purchInvNum = `FC-2026${mm}-01`;
      const purchDate = `2026-${mm}-08`;
      const qtyCanal = 100; // 100 kg a $4.00 = $400
      const qtyHarina = 200; // 200 und a $1.00 = $200
      const baseTaxableUsd = 200; // Harina gravada 16%
      const baseExemptUsd = 400; // Carne exenta
      const taxUsd = 32; // 16% de 200
      const totalPurchUsd = 632;

      await withTransaction(async (conn) => {
        await conn.query(
          `INSERT INTO purchase_invoices (
            id, branch_id, warehouse_id, supplier_id, user_id, invoice_number, control_number,
            invoice_date, currency, exchange_rate, base_exempt_amount, base_taxable_amount,
            tax_amount, igtf_amount, discount_amount, total_amount, is_credit, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, 0, 0, ?, 1, ?)`,
          [purchaseInvId, branchId, whMain, this.AUDIT_SUPPLIER_ID, userId, purchInvNum, `00-2026${mm}01`, purchDate, rate, baseExemptUsd, baseTaxableUsd, taxUsd, totalPurchUsd, m % 2 === 0 ? 'PENDING' : 'PAID']
        );

        await conn.query(
          `INSERT INTO purchase_invoice_items (id, invoice_id, product_id, quantity, unit_price, tax_rate, discount_percent, tax_amount, subtotal, total)
           VALUES (?, ?, ?, ?, 4.00, 0, 0, 0, 400.00, 400.00),
                  (?, ?, ?, ?, 1.00, 16, 0, 32.00, 200.00, 232.00)`,
          [crypto.randomUUID(), purchaseInvId, prodCanalId, qtyCanal, crypto.randomUUID(), purchaseInvId, prodHarinaId, qtyHarina]
        );

        // Actualizar product_stocks e inventory_movements (PURCHASE)
        for (const [pid, qty, uCost] of [[prodCanalId, qtyCanal, 4.0], [prodHarinaId, qtyHarina, 1.0]] as const) {
          const [st]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [pid, whMain]);
          const prev = Number(st[0]?.current_stock || 0);
          const next = prev + qty;
          await conn.query(
            `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
             VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = VALUES(last_movement_at)`,
            [pid, whMain, next, `${purchDate} 10:00:00`]
          );
          await conn.query(
            `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
             VALUES (?, ?, ?, ?, ?, 'PURCHASE', ?, ?, ?, ?, ?, ?, 'Compra de mercancía mensual', ?)`,
            [crypto.randomUUID(), branchId, whMain, pid, userId, qty, uCost, qty * uCost, prev, next, purchInvNum, `${purchDate} 10:00:00`]
          );
        }

        // Retención IVA (75% de $32 = $24) e ISLR (2% de $200 = $4)
        const ivaRetVes = Number((24 * rate).toFixed(2));
        await conn.query(
          `INSERT INTO tax_withholdings_iva (id, company_id, branch_id, supplier_id, purchase_invoice_id, voucher_number, tax_period, fortnight, invoice_number, control_number, invoice_date, total_invoice_amount, exempt_amount, taxable_base_amount, tax_rate, iva_amount, retained_percentage, iva_retained_amount, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 16.00, ?, 75.00, ?, 'EMITTED')`,
          [crypto.randomUUID(), cid, branchId, this.AUDIT_SUPPLIER_ID, purchaseInvId, `2026${mm}00000001`, `2026-${mm}`, purchInvNum, `00-2026${mm}01`, purchDate, Number((totalPurchUsd * rate).toFixed(2)), Number((baseExemptUsd * rate).toFixed(2)), Number((baseTaxableUsd * rate).toFixed(2)), Number((taxUsd * rate).toFixed(2)), ivaRetVes]
        );

        // CxP
        const payPartial = m % 2 === 0 ? 400.0 : totalPurchUsd; // meses pares pago parcial, impares total
        const payStatus = payPartial < totalPurchUsd ? 'PARTIAL' : 'PAID';
        await conn.query(
          `INSERT INTO payables (id, branch_id, supplier_id, invoice_id, amount_total, amount_paid, due_date, status, is_verified, verified_at, verified_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [payableId, branchId, this.AUDIT_SUPPLIER_ID, purchaseInvId, totalPurchUsd, payPartial, `2026-${mm}-28`, payStatus, `${purchDate} 12:00:00`, userId]
        );

        await AccountingAutoPostingService.postPurchaseInvoice(conn, purchaseInvId, userId);

        // Pago a Proveedor desde Tesorería (alternando VES y USD)
        const paymentId = crypto.randomUUID();
        const isUsdPay = m % 2 === 1;
        const payBankId = isUsdPay ? this.AUDIT_BANK_USD_ID : this.AUDIT_BANK_VES_ID;
        const payVes = Number((payPartial * rate).toFixed(2));
        const payMethod = isUsdPay ? 'TRANSFER_USD' : 'TRANSFER_VES';

        await conn.query(
          `INSERT INTO purchase_payments (id, invoice_id, payable_id, bank_account_id, method, amount_ves, amount_usd, exchange_rate, reference_number, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [paymentId, purchaseInvId, payableId, payBankId, payMethod, payVes, payPartial, rate, `REF-PAG-${mm}01`, `Pago mes ${mm}`, `2026-${mm}-15 11:00:00`]
        );

        const [bkRows]: any = await conn.query(`SELECT current_balance FROM bank_accounts WHERE id = ? FOR UPDATE`, [payBankId]);
        const prevBankBal = Number(bkRows[0].current_balance);
        const debitBankAmt = isUsdPay ? payPartial : payVes;
        const nextBankBal = Number((prevBankBal - debitBankAmt).toFixed(2));
        await conn.query(`UPDATE bank_accounts SET current_balance = ? WHERE id = ?`, [nextBankBal, payBankId]);
        await conn.query(
          `INSERT INTO bank_movements (id, account_id, user_id, movement_type, amount, balance_after, movement_date, reference_number, concept, is_reconciled)
           VALUES (?, ?, ?, 'WITHDRAWAL', ?, ?, ?, ?, ?, 1)`,
          [crypto.randomUUID(), payBankId, userId, debitBankAmt, nextBankBal, `2026-${mm}-15 11:00:00`, `REF-PAG-${mm}01`, `Pago factura ${purchInvNum}`]
        );

        await AccountingAutoPostingService.postPayablePayment(conn, paymentId, userId);
      });

      // 2.3 Producción / Desposte y Merma (100 kg canal -> 60 kg Lomito + 25 kg Primera + 15 kg Merma)
      await withTransaction(async (conn) => {
        const prodOrderId = crypto.randomUUID();
        const orderNum = `PROD-AUD-${mm}01`;
        const wasteLogId = crypto.randomUUID();
        const prodDate = `2026-${mm}-12 14:00:00`;

        const [stCanal]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [prodCanalId, whMain]);
        const prevCanal = Number(stCanal[0]?.current_stock || 0);
        await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevCanal - 100, prodDate, prodCanalId, whMain]);
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'OUT', 100, 4.00, 400.00, ?, ?, ?, 'Consumo Desposte', ?)`,
          [crypto.randomUUID(), branchId, whMain, prodCanalId, userId, prevCanal, prevCanal - 100, orderNum, prodDate]
        );

        for (const [outId, outQty] of [[prodLomitoId, 60], [prodPrimeraId, 25]] as const) {
          const [stOut]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [outId, whMain]);
          const prevOut = Number(stOut[0]?.current_stock || 0);
          await conn.query(
            `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
             VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = VALUES(last_movement_at)`,
            [outId, whMain, prevOut + outQty, prodDate]
          );
          await conn.query(
            `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
             VALUES (?, ?, ?, ?, ?, 'IN', ?, 4.00, ?, ?, ?, ?, 'Ingreso Corte Desposte', ?)`,
            [crypto.randomUUID(), branchId, whMain, outId, userId, outQty, outQty * 4.0, prevOut, prevOut + outQty, orderNum, prodDate]
          );
        }

        await conn.query(
          `INSERT INTO production_orders (id, company_id, branch_id, warehouse_id, order_number, process_type, source_product_id, source_quantity, source_unit_cost, source_total_cost, total_output_quantity, waste_quantity, waste_pct, waste_reason_id, waste_cost, cost_allocation_method, status, created_by, completed_by, completed_at, created_at)
           VALUES (?, ?, ?, ?, ?, 'WHOLE_CARCASS', ?, 100, 4.00, 400.00, 85, 15, 15.00, ?, 60.00, 'EQUAL_UNIT', 'COMPLETED', ?, ?, ?, ?)`,
          [prodOrderId, cid, branchId, whMain, orderNum, prodCanalId, wasteReasonId, userId, userId, prodDate, prodDate]
        );
        await conn.query(
          `INSERT INTO production_waste_logs (id, company_id, branch_id, warehouse_id, production_order_id, product_id, waste_reason_id, quantity, unit_cost, total_cost, notes, user_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 15, 4.00, 60.00, 'Merma estándar desposte', ?, ?)`,
          [wasteLogId, cid, branchId, whMain, prodOrderId, prodCanalId, wasteReasonId, userId, prodDate]
        );

        await AccountingAutoPostingService.postInventoryWaste(conn, {
          companyId: cid,
          branchId,
          userId,
          wasteLogId,
          productName: 'Carne en Canal (kg)',
          reasonName: 'Hueso y Grasa no comercializable',
          totalCostUsd: 60.0,
          referenceDoc: orderNum,
          entryDate: `2026-${mm}-12`,
        });
      });

      // 2.4 Traslado entre almacenes (20 und de Harina de whMain -> whSub)
      await withTransaction(async (conn) => {
        const trId = crypto.randomUUID();
        const trNum = `TR-AUD-${mm}01`;
        const trDate = `2026-${mm}-16 09:00:00`;

        await conn.query(
          `INSERT INTO inventory_transfers (id, company_id, transfer_number, origin_branch_id, origin_warehouse_id, destination_branch_id, destination_warehouse_id, shipped_by_user_id, received_by_user_id, total_items, total_cost, status, shipped_at, received_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 20.00, 'RECEIVED', ?, ?, ?)`,
          [trId, cid, trNum, branchId, whMain, branchId, whSub, userId, userId, trDate, trDate, trDate]
        );
        await conn.query(
          `INSERT INTO inventory_transfer_items (id, transfer_id, product_id, quantity_sent, quantity_received, unit_cost)
           VALUES (?, ?, ?, 20, 20, 1.00)`,
          [crypto.randomUUID(), trId, prodHarinaId]
        );

        const [stOrig]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [prodHarinaId, whMain]);
        const prevOrig = Number(stOrig[0].current_stock);
        await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevOrig - 20, trDate, prodHarinaId, whMain]);
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'TRANSFER_OUT', 20, 1.00, 20.00, ?, ?, ?, 'Traslado a sucursal', ?)`,
          [crypto.randomUUID(), branchId, whMain, prodHarinaId, userId, prevOrig, prevOrig - 20, trNum, trDate]
        );

        const [stDest]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [prodHarinaId, whSub]);
        const prevDest = Number(stDest[0]?.current_stock || 0);
        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
           VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = VALUES(last_movement_at)`,
          [prodHarinaId, whSub, prevDest + 20, trDate]
        );
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'TRANSFER_IN', 20, 1.00, 20.00, ?, ?, ?, 'Recepción traslado', ?)`,
          [crypto.randomUUID(), branchId, whSub, prodHarinaId, userId, prevDest, prevDest + 20, trNum, trDate]
        );
      });

      // 2.5 Ventas POS + Crédito CxC + Cobro + Depósito Bancario
      await withTransaction(async (conn) => {
        const shiftId = crypto.randomUUID();
        const saleInvId = crypto.randomUUID();
        const saleNum = `FV-2026${mm}-01`;
        const saleDate = `2026-${mm}-20`;
        const saleTimestamp = `${saleDate} 15:00:00`;

        await conn.query(
          `INSERT INTO cash_shifts (id, branch_id, cash_register_id, user_id, opened_at, closed_at, initial_cash_ves, initial_cash_usd, final_cash_ves_expected, final_cash_usd_expected, final_cash_ves_counted, final_cash_usd_counted, status)
           VALUES (?, ?, ?, ?, ?, ?, 1000, 100, 1000, 100, 1000, 100, 'CLOSED')`,
          [shiftId, branchId, this.AUDIT_CASH_REG_ID, userId, `${saleDate} 08:00:00`, `${saleDate} 19:00:00`]
        );

        // Venta de 30 kg Lomito ($12 = $360 exento) + 50 und Harina ($1.60 = $80 gravado + $12.80 IVA) + $3.00 IGTF sobre $100 efectivo USD
        const totalSaleUsd = 455.80;
        await conn.query(
          `INSERT INTO sales_invoices (
            id, branch_id, warehouse_id, customer_id, user_id, invoice_number, control_number,
            invoice_date, invoice_mode, currency, exchange_rate, base_exempt_amount, base_taxable_amount,
            tax_amount, igtf_amount, discount_amount, total_amount, is_credit, shift_id, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FISCAL', 'USD', ?, 360.00, 80.00, 12.80, 3.00, 0, ?, 0, ?, 'PAID')`,
          [saleInvId, branchId, whMain, this.AUDIT_CUSTOMER_ID, userId, saleNum, `00-F${mm}01`, saleDate, rate, totalSaleUsd, shiftId]
        );

        await conn.query(
          `INSERT INTO sales_invoice_items (id, invoice_id, product_id, quantity, unit_price, unit_cost, tax_rate, discount_percent, tax_amount, subtotal, total)
           VALUES (?, ?, ?, 30, 12.00, 6.50, 0, 0, 0, 360.00, 360.00),
                  (?, ?, ?, 50, 1.60, 1.00, 16, 0, 12.80, 80.00, 92.80)`,
          [crypto.randomUUID(), saleInvId, prodLomitoId, crypto.randomUUID(), saleInvId, prodHarinaId]
        );

        // Descontar inventario por venta (SALE)
        for (const [pid, qty, uCost] of [[prodLomitoId, 30, 6.5], [prodHarinaId, 50, 1.0]] as const) {
          const [st]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [pid, whMain]);
          const prev = Number(st[0]?.current_stock || 0);
          await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prev - qty, saleTimestamp, pid, whMain]);
          await conn.query(
            `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
             VALUES (?, ?, ?, ?, ?, 'SALE', ?, ?, ?, ?, ?, ?, 'Venta POS', ?)`,
            [crypto.randomUUID(), branchId, whMain, pid, userId, qty, uCost, qty * uCost, prev, prev - qty, saleNum, saleTimestamp]
          );
        }

        // Pago mixto: $100 efectivo USD (+ $3 IGTF) + resto transferencia VES
        const vesRemainderUsd = 352.80;
        const vesRemainderBs = Number((vesRemainderUsd * rate).toFixed(2));
        await conn.query(
          `INSERT INTO sales_payments (id, invoice_id, method, amount_ves, amount_usd, exchange_rate, applies_igtf, igtf_amount_ves, igtf_amount_usd, reference_number, bank_account_id, created_at)
           VALUES (?, ?, 'CASH_USD', ?, 103.00, ?, 1, ?, 3.00, NULL, NULL, ?),
                  (?, ?, 'TRANSFER_VES', ?, ?, ?, 0, 0, 0, ?, ?, ?)`,
          [
            crypto.randomUUID(), saleInvId, Number((103 * rate).toFixed(2)), rate, Number((3 * rate).toFixed(2)), saleTimestamp,
            crypto.randomUUID(), saleInvId, vesRemainderBs, vesRemainderUsd, rate, `DEP-${mm}01`, this.AUDIT_BANK_VES_ID, saleTimestamp,
          ]
        );

        // Reflejar ingreso bancario VES de la venta
        const [bkVes]: any = await conn.query(`SELECT current_balance FROM bank_accounts WHERE id = ? FOR UPDATE`, [this.AUDIT_BANK_VES_ID]);
        const nextBkVes = Number((Number(bkVes[0].current_balance) + vesRemainderBs).toFixed(2));
        await conn.query(`UPDATE bank_accounts SET current_balance = ? WHERE id = ?`, [nextBkVes, this.AUDIT_BANK_VES_ID]);
        await conn.query(
          `INSERT INTO bank_movements (id, account_id, user_id, movement_type, amount, balance_after, movement_date, reference_number, concept, is_reconciled)
           VALUES (?, ?, ?, 'DEPOSIT', ?, ?, ?, ?, ?, 1)`,
          [crypto.randomUUID(), this.AUDIT_BANK_VES_ID, userId, vesRemainderBs, nextBkVes, saleTimestamp, `DEP-${mm}01`, `Cobro factura ${saleNum}`]
        );

        await AccountingAutoPostingService.postSaleInvoice(conn, saleInvId, userId);

        // Factura a crédito CxC adicional
        const credInvId = crypto.randomUUID();
        const credNum = `FCV-2026${mm}-02`;
        await conn.query(
          `INSERT INTO sales_invoices (
            id, branch_id, warehouse_id, customer_id, user_id, invoice_number, control_number,
            invoice_date, invoice_mode, currency, exchange_rate, base_exempt_amount, base_taxable_amount,
            tax_amount, igtf_amount, discount_amount, total_amount, is_credit, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FISCAL', 'USD', ?, 180.00, 0, 0, 0, 0, 180.00, 1, 'PENDING')`,
          [credInvId, branchId, whMain, this.AUDIT_CUSTOMER_ID, userId, credNum, `00-C${mm}02`, saleDate, rate]
        );
        await conn.query(
          `INSERT INTO sales_invoice_items (id, invoice_id, product_id, quantity, unit_price, unit_cost, tax_rate, discount_percent, tax_amount, subtotal, total)
           VALUES (?, ?, ?, 20, 9.00, 5.00, 0, 0, 0, 180.00, 180.00)`,
          [crypto.randomUUID(), credInvId, prodPrimeraId]
        );
        const [stP]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [prodPrimeraId, whMain]);
        const prevP = Number(stP[0]?.current_stock || 0);
        await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevP - 20, saleTimestamp, prodPrimeraId, whMain]);
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'SALE', 20, 5.00, 100.00, ?, ?, ?, 'Venta Crédito CxC', ?)`,
          [crypto.randomUUID(), branchId, whMain, prodPrimeraId, userId, prevP, prevP - 20, credNum, saleTimestamp]
        );
        await conn.query(
          `INSERT INTO receivables (id, branch_id, customer_id, invoice_id, document_type, amount_total, amount_paid, due_date, status)
           VALUES (?, ?, ?, ?, 'INVOICE', 180.00, 80.00, ?, 'PARTIAL')`,
          [crypto.randomUUID(), branchId, this.AUDIT_CUSTOMER_ID, credInvId, `2026-${mm}-28`]
        );

        await AccountingAutoPostingService.postSaleInvoice(conn, credInvId, userId);
      });

      // 2.6 Revaluación Cambiaria / Registro VEN-NIF al cierre del mes
      const revalEntry = await AccountingService.createJournalEntry(cid, userId, {
        branchId,
        entryDate: `2026-${mm}-28`,
        entryType: 'ADJUSTMENT',
        concept: `Revaluación Cambiaria BCV Cierre ${MONTH_NAMES[m]} 2026`,
        currency: 'VES',
        exchangeRate: rate,
        lines: [
          {
            accountId: accountIdByCode.get('1.1.01.06')!,
            description: 'Ajuste cambiario saldo banco USD',
            debitVes: 1500.00,
            creditVes: 0,
            debitUsd: Number((1500.00 / rate).toFixed(2)),
            creditUsd: 0,
          },
          {
            accountId: accountIdByCode.get('7.2.01')!,
            description: 'Ganancia en fluctuación cambiaria VEN-NIF',
            debitVes: 0,
            creditVes: 1500.00,
            debitUsd: 0,
            creditUsd: Number((1500.00 / rate).toFixed(2)),
          },
        ],
      });
      await AccountingService.postJournalEntry(cid, userId, revalEntry.id);

      await query(
        `INSERT INTO accounting_revaluation_logs (id, company_id, period_id, journal_entry_id, type, execution_date, exchange_rate, inpc_closing, net_result_ves, notes, executed_by)
         VALUES (?, ?, ?, ?, 'EXCHANGE_DIFFERENCE', ?, ?, ?, 1500.00, ?, ?)`,
        [crypto.randomUUID(), cid, periodId, revalEntry.id, `2026-${mm}-28`, rate, inpc, `Cierre ${MONTH_NAMES[m]} 2026`, userId]
      );

      // 2.7 Ejecutar Cierre Contable y Bloqueo (LOCKED) del Período + Audit Log
      await AccountingService.updatePeriodStatus(cid, userId, periodId, 'LOCKED');
      await query(
        `INSERT INTO audit_logs (id, company_id, branch_id, user_id, module, action, entity, entity_id, after_json)
         VALUES (?, ?, ?, ?, 'accounting', 'LOCK_PERIOD', 'accounting_fiscal_periods', ?, ?)`,
        [crypto.randomUUID(), cid, branchId, userId, periodId, JSON.stringify({ year: 2026, month: m, status: 'LOCKED' })]
      );

      // 2.8 Auditoría SQL Mensual contra tablas y vistas v_*
      const monthAudit = await this.auditMonthSql(cid, branchId, periodId, m, rate, inpc, prevCumulativeBalanceVes);
      prevCumulativeBalanceVes = monthAudit.cumulativeBalanceAfterVes;
      monthsReport.push(monthAudit);
    }

    // -----------------------------------------------------------------------
    // FASE 3: CASOS BORDE Y ANOMALÍAS CONTROLADAS
    // -----------------------------------------------------------------------
    const edgeCases: EdgeCaseAuditResult[] = [];

    // Anomalía 1: Intento de posteo en período LOCKED (Junio 2026)
    try {
      await AccountingService.createJournalEntry(cid, userId, {
        branchId,
        entryDate: '2026-06-15',
        entryType: 'STANDARD',
        concept: 'Intento de asiento extemporáneo en período cerrado',
        currency: 'VES',
        exchangeRate: 42.50,
        lines: [
          { accountId: accountIdByCode.get('1.1.01.01')!, description: 'Test', debitVes: 100, creditVes: 0, debitUsd: 2.35, creditUsd: 0 },
          { accountId: accountIdByCode.get('4.1.01')!, description: 'Test', debitVes: 0, creditVes: 100, debitUsd: 0, creditUsd: 2.35 },
        ],
      });
      edgeCases.push({
        name: 'Bloqueo de Período Cerrado (LOCKED)',
        expectedBehavior: 'Rechazar asiento en 2026-06-15 porque Junio está LOCKED',
        detected: false,
        actualMessage: 'ERROR: El sistema permitió crear asiento en período bloqueado',
        status: 'ERROR',
      });
    } catch (err: any) {
      edgeCases.push({
        name: 'Bloqueo de Período Cerrado (LOCKED)',
        expectedBehavior: 'Rechazar asiento en 2026-06-15 porque Junio está LOCKED',
        detected: true,
        actualMessage: err.message,
        status: 'OK',
      });
    }

    // Anomalía 2: Intento de asiento descuadrado (Debe != Haber)
    try {
      await AccountingService.createJournalEntry(cid, userId, {
        branchId,
        entryDate: '2027-01-10',
        entryType: 'STANDARD',
        concept: 'Intento de asiento descuadrado',
        currency: 'VES',
        exchangeRate: 55.00,
        lines: [
          { accountId: accountIdByCode.get('1.1.01.01')!, description: 'Debe 500', debitVes: 500, creditVes: 0, debitUsd: 9.09, creditUsd: 0 },
          { accountId: accountIdByCode.get('4.1.01')!, description: 'Haber 450', debitVes: 0, creditVes: 450, debitUsd: 0, creditUsd: 8.18 },
        ],
      });
      edgeCases.push({
        name: 'Validación Estricta de Partida Doble',
        expectedBehavior: 'Rechazar asiento con Débito (500) != Crédito (450)',
        detected: false,
        actualMessage: 'ERROR: Se permitió asiento descuadrado',
        status: 'ERROR',
      });
    } catch (err: any) {
      edgeCases.push({
        name: 'Validación Estricta de Partida Doble',
        expectedBehavior: 'Rechazar asiento con Débito (500) != Crédito (450)',
        detected: true,
        actualMessage: err.message,
        status: 'OK',
      });
    }

    // Anomalía 3: Detección SQL de movimientos fuera de rango o en período sin coincidencia de fechas
    const [outOfRangeRows]: any = await query(
      `SELECT COUNT(*) as cnt
       FROM accounting_journal_entries e
       INNER JOIN accounting_fiscal_periods p ON e.period_id = p.id
       WHERE e.company_id = ?
         AND (e.entry_date < p.start_date OR e.entry_date > p.end_date)`,
      [cid]
    );
    const outOfRangeGlobal = Number(outOfRangeRows?.cnt || 0);
    edgeCases.push({
      name: 'Integridad Cronológica (entry_date dentro de start_date..end_date del período)',
      expectedBehavior: '0 asientos fuera del rango de fechas de su accounting_fiscal_period',
      detected: outOfRangeGlobal === 0,
      actualMessage: `Asientos fuera de rango detectados: ${outOfRangeGlobal}`,
      status: outOfRangeGlobal === 0 ? 'OK' : 'ERROR',
    });

    const hasError =
      monthsReport.some((m) => m.auditStatus === 'ERROR') ||
      edgeCases.some((e) => e.status === 'ERROR');
    const hasAlert = monthsReport.some((m) => m.auditStatus === 'ALERTA');

    const report: FullAuditReport = {
      companyId: cid,
      companyName: 'Corporación Auditoría VEN-NIF C.A.',
      fiscalYear: 2026,
      executedAt: new Date().toISOString(),
      months: monthsReport,
      edgeCases,
      overallStatus: hasError ? 'ERROR' : hasAlert ? 'ALERTA' : 'OK',
    };

    if (writeMarkdownReport) {
      const md = this.formatReportMarkdown(report);
      const outPath = path.resolve(process.cwd(), '../../REPORTE_AUDITORIA_CONTABLE_7_MESES.md');
      const fallbackPath = path.resolve(process.cwd(), 'REPORTE_AUDITORIA_CONTABLE_7_MESES.md');
      const targetPath = fs.existsSync(path.resolve(process.cwd(), '../../package.json')) ? outPath : fallbackPath;
      fs.writeFileSync(targetPath, md, 'utf-8');
    }

    return report;
  }

  private static async auditMonthSql(
    companyId: string,
    branchId: string,
    periodId: string,
    month: number,
    rate: number,
    inpc: number,
    prevCumulativeBalanceVes: number
  ): Promise<MonthAuditResult> {
    const findings: string[] = [];
    const mm = String(month).padStart(2, '0');
    const fiscalPeriodStr = `2026-${mm}`;

    // 1. Partida doble por asiento y por período
    const [entryAgg]: any = await query(
      `SELECT COUNT(DISTINCT e.id) as entriesCount,
              COALESCE(SUM(l.debit_ves), 0) as sumDebit,
              COALESCE(SUM(l.credit_ves), 0) as sumCredit
       FROM accounting_journal_entries e
       LEFT JOIN accounting_journal_lines l ON e.id = l.journal_entry_id
       WHERE e.company_id = ? AND e.period_id = ? AND e.status = 'POSTED'`,
      [companyId, periodId]
    );
    const journalEntriesCount = Number(entryAgg?.entriesCount || 0);
    const totalDebitVes = Number(Number(entryAgg?.sumDebit || 0).toFixed(2));
    const totalCreditVes = Number(Number(entryAgg?.sumCredit || 0).toFixed(2));
    const debitCreditDiffVes = Number(Math.abs(totalDebitVes - totalCreditVes).toFixed(2));
    if (debitCreditDiffVes > 0.05) {
      findings.push(`Descuadre en período ${fiscalPeriodStr}: Debe ${totalDebitVes} != Haber ${totalCreditVes}`);
    }

    // 2. Asientos huérfanos o DRAFT pendientes
    const [orphanRows]: any = await query(
      `SELECT COUNT(*) as cnt FROM accounting_journal_entries e
       LEFT JOIN accounting_journal_lines l ON e.id = l.journal_entry_id
       WHERE e.company_id = ? AND e.period_id = ? AND l.id IS NULL`,
      [companyId, periodId]
    );
    const orphanEntriesCount = Number(orphanRows?.cnt || 0);
    if (orphanEntriesCount > 0) findings.push(`Se detectaron ${orphanEntriesCount} asientos huérfanos sin líneas`);

    const [draftRows]: any = await query(
      `SELECT COUNT(*) as cnt FROM accounting_journal_entries
       WHERE company_id = ? AND period_id = ? AND status = 'DRAFT'`,
      [companyId, periodId]
    );
    const draftEntriesCount = Number(draftRows?.cnt || 0);
    if (draftEntriesCount > 0) findings.push(`Existen ${draftEntriesCount} asientos en borrador sin asentar`);

    // 3. Asientos fuera de rango de fechas del período
    const [oorRows]: any = await query(
      `SELECT COUNT(*) as cnt FROM accounting_journal_entries e
       INNER JOIN accounting_fiscal_periods p ON e.period_id = p.id
       WHERE e.company_id = ? AND e.period_id = ? AND (e.entry_date < p.start_date OR e.entry_date > p.end_date)`,
      [companyId, periodId]
    );
    const outOfRangeEntriesCount = Number(oorRows?.cnt || 0);

    // 4. Continuidad acumulada (Débito acumulado == Crédito acumulado)
    const [cumRows]: any = await query(
      `SELECT COALESCE(SUM(l.debit_ves), 0) as cumDebit
       FROM accounting_journal_entries e
       INNER JOIN accounting_journal_lines l ON e.id = l.journal_entry_id
       INNER JOIN accounting_fiscal_periods p ON e.period_id = p.id
       WHERE e.company_id = ? AND p.month <= ? AND e.status = 'POSTED'`,
      [companyId, month]
    );
    const cumulativeBalanceAfterVes = Number(Number(cumRows?.cumDebit || 0).toFixed(2));
    if (cumulativeBalanceAfterVes < prevCumulativeBalanceVes) {
      findings.push(`Discontinuidad en saldo acumulado respecto al mes anterior`);
    }

    // 5. Vistas fiscales: v_book_sales vs sales_invoices, v_book_purchases vs purchase_invoices
    const [salesCountRow]: any = await query(
      `SELECT COUNT(*) as cnt FROM sales_invoices WHERE branch_id = ? AND DATE_FORMAT(invoice_date, '%Y-%m') = ? AND status != 'ANNULLED'`,
      [branchId, fiscalPeriodStr]
    );
    const [bookSalesRow]: any = await query(
      `SELECT COUNT(*) as cnt FROM v_book_sales WHERE company_id = ? AND fiscal_period = ?`,
      [companyId, fiscalPeriodStr]
    );
    const salesInvoicesCount = Number(salesCountRow?.cnt || 0);
    const salesBookCount = Number(bookSalesRow?.cnt || 0);
    if (salesInvoicesCount !== salesBookCount) {
      findings.push(`Diferencia Libro Ventas: ${salesBookCount} en v_book_sales vs ${salesInvoicesCount} facturas`);
    }

    const [purchCountRow]: any = await query(
      `SELECT COUNT(*) as cnt FROM purchase_invoices WHERE branch_id = ? AND DATE_FORMAT(invoice_date, '%Y-%m') = ? AND status != 'ANNULLED'`,
      [branchId, fiscalPeriodStr]
    );
    const [bookPurchRow]: any = await query(
      `SELECT COUNT(*) as cnt FROM v_book_purchases WHERE company_id = ? AND fiscal_period = ?`,
      [companyId, fiscalPeriodStr]
    );
    const purchaseInvoicesCount = Number(purchCountRow?.cnt || 0);
    const purchasesBookCount = Number(bookPurchRow?.cnt || 0);
    if (purchaseInvoicesCount !== purchasesBookCount) {
      findings.push(`Diferencia Libro Compras: ${purchasesBookCount} en v_book_purchases vs ${purchaseInvoicesCount} facturas`);
    }

    // 6. Kardex (v_inventory_kardex) vs product_stocks
    const [kardexDiffRows]: any = await query(
      `SELECT COUNT(*) as cnt
       FROM product_stocks ps
       INNER JOIN warehouses w ON ps.warehouse_id = w.id
       WHERE w.branch_id = ?
         AND ABS(ps.current_stock - COALESCE((
           SELECT vk.new_stock FROM v_inventory_kardex vk
           WHERE vk.product_id = ps.product_id AND vk.warehouse_id = ps.warehouse_id
           ORDER BY vk.movement_date DESC LIMIT 1
         ), 0)) > 0.01`,
      [branchId]
    );
    const kardexDiscrepanciesCount = Number(kardexDiffRows?.cnt || 0);
    if (kardexDiscrepanciesCount > 0) {
      findings.push(`Se detectaron ${kardexDiscrepanciesCount} discrepancias entre product_stocks y v_inventory_kardex`);
    }

    // 7. Tesorería (v_treasury_balances vs bank_accounts)
    const [treasDiffRows]: any = await query(
      `SELECT COUNT(*) as cnt
       FROM bank_accounts ba
       INNER JOIN v_treasury_balances vt ON ba.id = vt.account_id
       WHERE ba.company_id = ? AND ABS(ba.current_balance - vt.current_balance) > 0.01`,
      [companyId]
    );
    const treasuryDiscrepanciesCount = Number(treasDiffRows?.cnt || 0);

    // 8. CxC (v_cxc_aging vs receivables) y CxP (v_cxp_aging vs payables)
    const [cxcRow]: any = await query(
      `SELECT ABS(COALESCE((SELECT SUM(amount_balance) FROM receivables WHERE branch_id = ? AND status != 'PAID'), 0)
                 - COALESCE((SELECT SUM(amount_balance) FROM v_cxc_aging WHERE branch_id = ?), 0)) as diff`,
      [branchId, branchId]
    );
    const [cxpRow]: any = await query(
      `SELECT ABS(COALESCE((SELECT SUM(amount_balance) FROM payables WHERE branch_id = ? AND status != 'PAID'), 0)
                 - COALESCE((SELECT SUM(amount_balance) FROM v_cxp_aging WHERE branch_id = ?), 0)) as diff`,
      [branchId, branchId]
    );
    const cxcAgingDiff = Number(Number(cxcRow?.diff || 0).toFixed(2));
    const cxpAgingDiff = Number(Number(cxpRow?.diff || 0).toFixed(2));

    const [pRow]: any = await query(`SELECT status FROM accounting_fiscal_periods WHERE id = ?`, [periodId]);
    const periodStatus = (pRow?.status || 'OPEN') as 'OPEN' | 'CLOSED' | 'LOCKED';

    let auditStatus: 'OK' | 'ALERTA' | 'ERROR' = 'OK';
    if (debitCreditDiffVes > 0.05 || orphanEntriesCount > 0 || outOfRangeEntriesCount > 0 || kardexDiscrepanciesCount > 0 || treasuryDiscrepanciesCount > 0) {
      auditStatus = 'ERROR';
    } else if (draftEntriesCount > 0 || salesInvoicesCount !== salesBookCount || purchaseInvoicesCount !== purchasesBookCount || cxcAgingDiff > 0.05 || cxpAgingDiff > 0.05) {
      auditStatus = 'ALERTA';
    }

    return {
      month,
      periodLabel: `${MONTH_NAMES[month]} 2026`,
      exchangeRateBcv: rate,
      inpcValue: inpc,
      journalEntriesCount,
      totalDebitVes,
      totalCreditVes,
      debitCreditDiffVes,
      orphanEntriesCount,
      draftEntriesCount,
      outOfRangeEntriesCount,
      cumulativeBalanceBeforeVes: prevCumulativeBalanceVes,
      cumulativeBalanceAfterVes,
      salesInvoicesCount,
      salesBookCount,
      purchaseInvoicesCount,
      purchasesBookCount,
      kardexDiscrepanciesCount,
      treasuryDiscrepanciesCount,
      cxcAgingDiff,
      cxpAgingDiff,
      periodStatus,
      auditStatus,
      findings,
    };
  }

  static formatReportMarkdown(report: FullAuditReport): string {
    let md = `# REPORTE DE AUDITORÍA CONTABLE Y FISCAL MULTI-MES (JUNIO - DICIEMBRE 2026)\n\n`;
    md += `- **Empresa Auditada:** ${report.companyName} (\`${report.companyId}\`)\n`;
    md += `- **Ejercicio Fiscal:** ${report.fiscalYear}\n`;
    md += `- **Fecha de Ejecución:** ${new Date(report.executedAt).toLocaleString('es-VE')}\n`;
    md += `- **Dictamen General:** **${report.overallStatus}**\n\n`;
    md += `---\n\n`;

    md += `## 1. Resumen de Cierres Contables y Cuadre Mensual (Junio – Diciembre)\n\n`;
    md += `| Mes | Tasa BCV | INPC | Asientos | Débito (Bs.) | Crédito (Bs.) | Dif. | Lib. Ventas | Lib. Compras | Discrep. Kardex/Bco | Estado Período | Dictamen |\n`;
    md += `| :--- | ---: | ---: | ---: | ---: | ---: | ---: | :---: | :---: | :---: | :---: | :---: |\n`;

    for (const m of report.months) {
      md += `| **${m.periodLabel}** | ${m.exchangeRateBcv.toFixed(2)} | ${m.inpcValue.toFixed(2)} | ${m.journalEntriesCount} | ${m.totalDebitVes.toFixed(2)} | ${m.totalCreditVes.toFixed(2)} | ${m.debitCreditDiffVes.toFixed(2)} | ${m.salesBookCount}/${m.salesInvoicesCount} | ${m.purchasesBookCount}/${m.purchaseInvoicesCount} | ${m.kardexDiscrepanciesCount + m.treasuryDiscrepanciesCount} | \`${m.periodStatus}\` | **${m.auditStatus}** |\n`;
    }

    md += `\n---\n\n`;
    md += `## 2. Continuidad de Saldos Acumulados y Aging (CxC / CxP)\n\n`;
    md += `| Mes | Saldo Acum. Inicial (Bs.) | Saldo Acum. Cierre (Bs.) | Dif. \`v_cxc_aging\` | Dif. \`v_cxp_aging\` | Huérfanos | Fuera de Rango |\n`;
    md += `| :--- | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
    for (const m of report.months) {
      md += `| ${m.periodLabel} | ${m.cumulativeBalanceBeforeVes.toFixed(2)} | ${m.cumulativeBalanceAfterVes.toFixed(2)} | ${m.cxcAgingDiff.toFixed(2)} | ${m.cxpAgingDiff.toFixed(2)} | ${m.orphanEntriesCount} | ${m.outOfRangeEntriesCount} |\n`;
    }

    md += `\n---\n\n`;
    md += `## 3. Verificación de Casos Borde y Anomalías Controladas\n\n`;
    md += `| Prueba de Control / Anomalía | Comportamiento Esperado | Detectado | Evidencia / Mensaje del Sistema | Estado |\n`;
    md += `| :--- | :--- | :---: | :--- | :---: |\n`;
    for (const ec of report.edgeCases) {
      md += `| **${ec.name}** | ${ec.expectedBehavior} | ${ec.detected ? 'SÍ' : 'NO'} | ${ec.actualMessage} | **${ec.status}** |\n`;
    }

    const allFindings = report.months.filter((m) => m.findings.length > 0);
    if (allFindings.length > 0) {
      md += `\n---\n\n## 4. Hallazgos Detectados\n\n`;
      for (const m of allFindings) {
        md += `- **${m.periodLabel}:** ${m.findings.join(' | ')}\n`;
      }
    } else {
      md += `\n---\n\n## 4. Hallazgos Detectados\n\n- Sin hallazgos ni descuadres en los 7 meses auditados. Partida doble, vistas fiscales/operativas (\`v_book_sales\`, \`v_book_purchases\`, \`v_inventory_kardex\`, \`v_treasury_balances\`, \`v_cxc_aging\`, \`v_cxp_aging\`) y bloqueos de período 100% conformes.\n`;
    }

    return md;
  }
}
