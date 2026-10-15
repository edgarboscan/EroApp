const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'erp_admin',
    password: process.env.DB_PASSWORD || 'SecurePassword_2026!',
    database: process.env.DB_NAME || 'ero_erp_db',
  });

  try {
    console.log('Creando tabla payment_methods si no existe...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id CHAR(36) NOT NULL,
        company_id CHAR(36) NOT NULL,
        code VARCHAR(30) NOT NULL,
        name VARCHAR(100) NOT NULL,
        currency ENUM('USD', 'VES') NOT NULL DEFAULT 'VES',
        type ENUM('CASH', 'CARD', 'ELECTRONIC', 'CREDIT', 'OTHER') NOT NULL DEFAULT 'OTHER',
        applies_igtf TINYINT(1) NOT NULL DEFAULT 0,
        requires_reference TINYINT(1) NOT NULL DEFAULT 0,
        requires_bank_account TINYINT(1) NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_pm_code (company_id, code),
        CONSTRAINT fk_pm_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Obtener todas las compañías registradas
    const [companies] = await conn.query('SELECT id, legal_name FROM companies');
    console.log(`Compañías encontradas: ${companies.length}`);

    const DEFAULT_METHODS = [
      { code: 'CASH_USD', name: 'Efectivo Divisas ($)', currency: 'USD', type: 'CASH', appliesIGTF: 1, requiresRef: 0, order: 1 },
      { code: 'PAGO_MOVIL', name: 'Pago Móvil Interbancario (Bs)', currency: 'VES', type: 'ELECTRONIC', appliesIGTF: 0, requiresRef: 1, order: 2 },
      { code: 'DEBIT_CARD', name: 'Punto de Venta / Débito (Bs)', currency: 'VES', type: 'CARD', appliesIGTF: 0, requiresRef: 1, order: 3 },
      { code: 'CREDIT_CARD', name: 'Punto de Venta / Crédito (Bs)', currency: 'VES', type: 'CARD', appliesIGTF: 0, requiresRef: 1, order: 4 },
      { code: 'ZELLE', name: 'Zelle / Divisas ($)', currency: 'USD', type: 'ELECTRONIC', appliesIGTF: 1, requiresRef: 1, order: 5 },
      { code: 'CASH_VES', name: 'Efectivo Bolívares (Bs)', currency: 'VES', type: 'CASH', appliesIGTF: 0, requiresRef: 0, order: 6 },
      { code: 'BIOPAGO', name: 'BioPago BDV (Bs)', currency: 'VES', type: 'ELECTRONIC', appliesIGTF: 0, requiresRef: 1, order: 7 },
      { code: 'CASHEA', name: 'Cashea - Compre Ahora y Pague Después', currency: 'USD', type: 'CREDIT', appliesIGTF: 0, requiresRef: 1, order: 8 },
    ];

    for (const company of companies) {
      console.log(`Sembrando métodos de pago para: ${company.legal_name} (${company.id})`);
      for (const m of DEFAULT_METHODS) {
        await conn.query(`
          INSERT INTO payment_methods (
            id, company_id, code, name, currency, type, applies_igtf, requires_reference, requires_bank_account, is_active, display_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            currency = VALUES(currency),
            type = VALUES(type),
            applies_igtf = VALUES(applies_igtf),
            requires_reference = VALUES(requires_reference),
            display_order = VALUES(display_order)
        `, [
          crypto.randomUUID(),
          company.id,
          m.code,
          m.name,
          m.currency,
          m.type,
          m.appliesIGTF,
          m.requiresRef,
          m.order
        ]);
      }
    }

    console.log('Migración y siembra de métodos de pago completada con éxito!');
  } catch (err) {
    console.error('Error durante la migración:', err);
  } finally {
    await conn.end();
  }
}

migrate();
