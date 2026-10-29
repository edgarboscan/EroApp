import mysql from 'mysql2/promise';

async function migrateSupplierNotes() {
  console.log('--- Iniciando migración de Notas de Crédito y Débito de Proveedores ---');

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db',
  });

  try {
    // 1. Crear tabla supplier_notes
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`supplier_notes\` (
        \`id\` CHAR(36) NOT NULL,
        \`company_id\` CHAR(36) NOT NULL,
        \`branch_id\` CHAR(36) NOT NULL,
        \`supplier_id\` CHAR(36) NOT NULL,
        \`user_id\` CHAR(36) NOT NULL,
        \`warehouse_id\` CHAR(36) DEFAULT NULL,
        \`affected_invoice_id\` CHAR(36) DEFAULT NULL,
        \`type\` ENUM('CREDIT', 'DEBIT') NOT NULL,
        \`note_number\` VARCHAR(30) NOT NULL,
        \`control_number\` VARCHAR(30) DEFAULT NULL,
        \`note_date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`currency\` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
        \`exchange_rate\` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
        \`subtotal_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`tax_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`total_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`available_balance\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`reason_type\` ENUM('RETURN', 'DISCOUNT', 'PRICE_CORRECTION', 'FREIGHT_SURCHARGE', 'LATE_FEE', 'OTHER') NOT NULL DEFAULT 'OTHER',
        \`reason_description\` TEXT DEFAULT NULL,
        \`status\` ENUM('ACTIVE', 'APPLIED', 'ANNULLED') NOT NULL DEFAULT 'ACTIVE',
        \`annulled_at\` DATETIME DEFAULT NULL,
        \`annulled_by\` CHAR(36) DEFAULT NULL,
        \`annul_reason\` VARCHAR(255) DEFAULT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_sn_company_branch\` (\`company_id\`, \`branch_id\`),
        KEY \`idx_sn_supplier\` (\`supplier_id\`),
        KEY \`idx_sn_type_status\` (\`type\`, \`status\`),
        KEY \`idx_sn_affected_inv\` (\`affected_invoice_id\`),
        CONSTRAINT \`fk_sn_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_sn_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_sn_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_sn_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('✓ Tabla supplier_notes verificada/creada');

    // 2. Crear tabla supplier_note_items
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`supplier_note_items\` (
        \`id\` CHAR(36) NOT NULL,
        \`note_id\` CHAR(36) NOT NULL,
        \`product_id\` CHAR(36) DEFAULT NULL,
        \`description\` VARCHAR(255) NOT NULL,
        \`quantity\` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
        \`unit_cost\` DECIMAL(14,4) NOT NULL DEFAULT 0.00,
        \`tax_rate\` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
        \`tax_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`subtotal\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`total\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`return_from_inventory\` TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_sni_note\` (\`note_id\`),
        KEY \`idx_sni_product\` (\`product_id\`),
        CONSTRAINT \`fk_sni_note\` FOREIGN KEY (\`note_id\`) REFERENCES \`supplier_notes\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_sni_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('✓ Tabla supplier_note_items verificada/creada');

    // 3. Crear tabla supplier_note_applications
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`supplier_note_applications\` (
        \`id\` CHAR(36) NOT NULL,
        \`note_id\` CHAR(36) NOT NULL,
        \`payable_id\` CHAR(36) NOT NULL,
        \`amount_applied\` DECIMAL(14,2) NOT NULL,
        \`notes\` VARCHAR(255) DEFAULT NULL,
        \`created_by\` CHAR(36) NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_sna_note\` (\`note_id\`),
        KEY \`idx_sna_payable\` (\`payable_id\`),
        CONSTRAINT \`fk_sna_note\` FOREIGN KEY (\`note_id\`) REFERENCES \`supplier_notes\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_sna_payable\` FOREIGN KEY (\`payable_id\`) REFERENCES \`payables\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_sna_user\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('✓ Tabla supplier_note_applications verificada/creada');

    // 4. Modificar tabla payables para soportar notas de débito y notas de crédito de proveedores
    // Permitir invoice_id NULL y agregar supplier_note_id
    const [cols]: any = await conn.query(`
      SELECT COLUMN_NAME, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ero_erp_db' AND TABLE_NAME = 'payables'
    `);
    const colNames = cols.map((c: any) => c.COLUMN_NAME);

    if (!colNames.includes('supplier_note_id')) {
      await conn.query(`
        ALTER TABLE \`payables\`
        ADD COLUMN \`supplier_note_id\` CHAR(36) DEFAULT NULL AFTER \`invoice_id\`,
        ADD KEY \`idx_pay_supplier_note\` (\`supplier_note_id\`),
        ADD CONSTRAINT \`fk_pay_supplier_note\` FOREIGN KEY (\`supplier_note_id\`) REFERENCES \`supplier_notes\` (\`id\`) ON DELETE CASCADE
      `);
      console.log('✓ Columna supplier_note_id agregada a payables');
    }

    const invoiceCol = cols.find((c: any) => c.COLUMN_NAME === 'invoice_id');
    if (invoiceCol && invoiceCol.IS_NULLABLE === 'NO') {
      await conn.query(`
        ALTER TABLE \`payables\` MODIFY COLUMN \`invoice_id\` CHAR(36) NULL
      `);
      console.log('✓ invoice_id en payables ahora permite NULL');
    }

    console.log('--- Migración completada exitosamente ---');
  } catch (error) {
    console.error('Error durante la migración:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

migrateSupplierNotes().catch(console.error);
