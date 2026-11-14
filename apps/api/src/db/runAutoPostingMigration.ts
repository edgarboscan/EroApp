import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { pool } from './index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uuidv4 = () => crypto.randomUUID();

function makeId(prefix: string, seed: string): string {
  const hash = crypto.createHash('md5').update(`${prefix}:${seed}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function runAutoPostingMigration() {
  console.log('--- Iniciando Migración Motor de Contabilización Automática ---');

  // 1. Ejecutar DDL
  const ddlPath = path.join(__dirname, 'ddl/09_accounting_auto_posting.sql');
  const ddlSql = fs.readFileSync(ddlPath, 'utf8');

  const statements = ddlSql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    if (stmt.trim()) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        console.error('Error en sentencia SQL:', err.message, '\nSentencia:', stmt.substring(0, 100));
        throw err;
      }
    }
  }
  console.log('✓ Tablas accounting_settings y accounting_account_mappings creadas');

  // 2. Modificaciones a accounting_journal_entries (columnas de origen)
  const [ajeCols]: any = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounting_journal_entries' AND COLUMN_NAME IN ('origin_type', 'origin_id')`
  );
  const existingAjeCols = ajeCols.map((r: any) => r.COLUMN_NAME);

  if (!existingAjeCols.includes('origin_type')) {
    await pool.query(
      `ALTER TABLE accounting_journal_entries 
       ADD COLUMN origin_type VARCHAR(50) NULL COMMENT 'POS_SALE, SALE_INVOICE, PURCHASE_INVOICE, CUSTOMER_NOTE, SUPPLIER_NOTE, AP_PAYMENT, AR_PAYMENT, INVENTORY_ADJUST, BANK_MOVEMENT'`
    );
    console.log('✓ Columna origin_type agregada a accounting_journal_entries');
  }

  if (!existingAjeCols.includes('origin_id')) {
    await pool.query(
      `ALTER TABLE accounting_journal_entries 
       ADD COLUMN origin_id CHAR(36) NULL COMMENT 'ID del documento operativo de origen'`
    );
    console.log('✓ Columna origin_id agregada a accounting_journal_entries');
  }

  // Índice para búsqueda rápida y control de idempotencia
  const [ajeIdx]: any = await pool.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounting_journal_entries' AND INDEX_NAME = 'idx_aje_origin'`
  );
  if (ajeIdx.length === 0) {
    await pool.query(
      `CREATE INDEX idx_aje_origin ON accounting_journal_entries (company_id, origin_type, origin_id)`
    );
    console.log('✓ Índice idx_aje_origin creado');
  }

  // 3. Modificaciones a bank_accounts (cuenta contable asociada)
  const [baCols]: any = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_accounts' AND COLUMN_NAME = 'accounting_account_id'`
  );
  if (baCols.length === 0) {
    await pool.query(
      `ALTER TABLE bank_accounts 
       ADD COLUMN accounting_account_id CHAR(36) NULL`
    );
    console.log('✓ Columna accounting_account_id agregada a bank_accounts');
  }

  // 4. Sembrar configuración y mapeos predeterminados para todas las empresas existentes
  const [companies]: any = await pool.query(`SELECT id, legal_name FROM companies`);
  for (const comp of companies) {
    const companyId = comp.id;

    // Configuración general
    await pool.query(
      `INSERT INTO accounting_settings (
        id, company_id, auto_posting_enabled, default_entry_status,
        post_sales, post_purchases, post_payments, post_notes,
        post_inventory_adjustments, post_treasury
      ) VALUES (?, ?, 1, 'POSTED', 1, 1, 1, 1, 1, 1)
      ON DUPLICATE KEY UPDATE auto_posting_enabled = VALUES(auto_posting_enabled)`,
      [makeId('as', companyId), companyId]
    );

    // Mapeos predeterminados por código VEN-NIF
    const defaultKeyToCodeMap: { key: string; code: string; desc: string }[] = [
      { key: 'SALES_REVENUE', code: '4.1.01', desc: 'Ventas de Mercancías Gravadas con IVA' },
      { key: 'SALES_REVENUE_EXEMPT', code: '4.1.02', desc: 'Ventas de Mercancías Exentas / Exoneradas' },
      { key: 'SALES_DISCOUNT', code: '4.1.03', desc: 'Descuentos y Rebajas en Ventas' },
      { key: 'SALES_RETURNS', code: '4.1.04', desc: 'Devoluciones en Ventas' },
      { key: 'VAT_DEBIT', code: '2.1.02.01', desc: 'IVA Débito Fiscal' },
      { key: 'VAT_CREDIT', code: '1.1.03.01', desc: 'IVA Crédito Fiscal' },
      { key: 'IGTF_PAYABLE', code: '2.1.02.05', desc: 'IGTF por Enterar al SENIAT' },
      { key: 'IGTF_EXPENSE', code: '7.1.01', desc: 'Comisiones Bancarias y Débitos IGTF' },
      { key: 'AR_CUSTOMERS_VES', code: '1.1.02.01', desc: 'Clientes Nacionales Comerciales (VES)' },
      { key: 'AR_CUSTOMERS_USD', code: '1.1.02.02', desc: 'Clientes en Moneda Extranjera (USD)' },
      { key: 'AP_SUPPLIERS_VES', code: '2.1.01.01', desc: 'Proveedores Nacionales (VES)' },
      { key: 'AP_SUPPLIERS_USD', code: '2.1.01.02', desc: 'Proveedores Extranjeros / Divisas (USD)' },
      { key: 'INVENTORY_MERCHANDISE', code: '1.1.04.01', desc: 'Inventario de Mercancías para la Venta' },
      { key: 'COST_OF_SALES', code: '5.1.01', desc: 'Costo de Mercancía Vendida' },
      { key: 'CASH_VES', code: '1.1.01.01', desc: 'Caja Principal (Efectivo VES)' },
      { key: 'CASH_USD', code: '1.1.01.03', desc: 'Caja en Moneda Extranjera (USD)' },
      { key: 'BANK_VES_DEFAULT', code: '1.1.01.04', desc: 'Banco Corriente por Defecto (VES)' },
      { key: 'BANK_USD_DEFAULT', code: '1.1.01.06', desc: 'Banco Moneda Extranjera por Defecto (USD)' },
      { key: 'WITHHOLDING_VAT_RECEIVED', code: '1.1.03.02', desc: 'Retenciones de IVA Soportadas por Compensar' },
      { key: 'WITHHOLDING_ISLR_RECEIVED', code: '1.1.03.03', desc: 'Retenciones de ISLR Acumuladas por Compensar' },
      { key: 'WITHHOLDING_VAT_ISSUED', code: '2.1.02.02', desc: 'Retenciones de IVA por Enterar al SENIAT' },
      { key: 'WITHHOLDING_ISLR_ISSUED', code: '2.1.02.03', desc: 'Retenciones de ISLR por Enterar al SENIAT' },
      { key: 'EXCHANGE_DIFF_GAIN', code: '7.2.01', desc: 'Ganancia en Fluctuación Cambiaria' },
      { key: 'EXCHANGE_DIFF_LOSS', code: '7.1.02', desc: 'Pérdida en Fluctuación Cambiaria' },
      { key: 'INVENTORY_ADJUST_EXPENSE', code: '5.1.01', desc: 'Pérdida o Ajuste Negativo de Inventario' },
      { key: 'INVENTORY_ADJUST_INCOME', code: '7.2.01', desc: 'Ajuste Positivo Sobrante de Inventario' },
    ];

    // Obtener catálogo de cuentas de la empresa
    const [accounts]: any = await pool.query(
      `SELECT id, code FROM accounting_accounts WHERE company_id = ?`,
      [companyId]
    );
    const codeMap = new Map<string, string>();
    for (const a of accounts) {
      codeMap.set(a.code, a.id);
    }

    for (const mapping of defaultKeyToCodeMap) {
      const accId = codeMap.get(mapping.code);
      if (accId) {
        await pool.query(
          `INSERT INTO accounting_account_mappings (
            id, company_id, mapping_key, account_id, description
          ) VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            account_id = VALUES(account_id),
            description = VALUES(description)`,
          [makeId('aam', `${companyId}-${mapping.key}`), companyId, mapping.key, accId, mapping.desc]
        );
      }
    }

    // Asociar cuentas contables a bank_accounts si aún no las tienen
    const [baRows]: any = await pool.query(
      `SELECT id, currency, description, accounting_account_id FROM bank_accounts WHERE company_id = ?`,
      [companyId]
    );
    const vesBankAccId = codeMap.get('1.1.01.04');
    const usBankAccId = codeMap.get('1.1.01.06');

    for (const ba of baRows) {
      if (!ba.accounting_account_id) {
        const targetAccId = ba.currency === 'USD' ? usBankAccId : vesBankAccId;
        if (targetAccId) {
          await pool.query(
            `UPDATE bank_accounts SET accounting_account_id = ? WHERE id = ?`,
            [targetAccId, ba.id]
          );
        }
      }
    }
  }

  console.log('✓ Configuración y mapeos contables inicializados para todas las empresas');
  console.log('--- Migración Motor de Contabilización Finalizada con Éxito ---');
}

// Ejecutar directamente si se llama desde CLI
if (process.argv[1] && process.argv[1].includes('runAutoPostingMigration')) {
  runAutoPostingMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en migración:', err);
      process.exit(1);
    });
}

