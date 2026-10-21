import mysql from 'mysql2/promise';

async function migrate() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db',
    multipleStatements: true,
  });

  console.log('Conectado a MySQL ero_erp_db...');

  try {
    // 1. Crear tabla customer_notes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_notes (
        id CHAR(36) NOT NULL,
        company_id CHAR(36) NOT NULL,
        branch_id CHAR(36) NOT NULL,
        customer_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        warehouse_id CHAR(36) DEFAULT NULL,
        affected_invoice_id CHAR(36) DEFAULT NULL,
        type ENUM('CREDIT', 'DEBIT') NOT NULL,
        note_number VARCHAR(30) NOT NULL,
        control_number VARCHAR(30) DEFAULT NULL,
        issue_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        due_date DATE DEFAULT NULL,
        reason_type ENUM('RETURN', 'DISCOUNT', 'PRICE_CORRECTION', 'ANNULMENT', 'LATE_FEE', 'COLLECTION_FEE', 'PRICE_DIFFERENCE', 'OTHER') NOT NULL DEFAULT 'OTHER',
        reason_description TEXT NOT NULL,
        currency ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
        exchange_rate DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
        base_exempt_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        base_taxable_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        amount_applied DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        amount_balance DECIMAL(14,2) GENERATED ALWAYS AS (total_amount - amount_applied) STORED,
        status ENUM('ACTIVE', 'APPLIED', 'ANNULLED') NOT NULL DEFAULT 'ACTIVE',
        annulled_at DATETIME DEFAULT NULL,
        annulled_by_user_id CHAR(36) DEFAULT NULL,
        annulment_reason TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_cnot_branch_type_number (branch_id, type, note_number),
        KEY idx_cnot_customer (customer_id),
        KEY idx_cnot_invoice (affected_invoice_id),
        KEY idx_cnot_branch_date (branch_id, issue_date),
        CONSTRAINT fk_cnot_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT,
        CONSTRAINT fk_cnot_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
        CONSTRAINT fk_cnot_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_cnot_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT fk_cnot_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL,
        CONSTRAINT fk_cnot_invoice FOREIGN KEY (affected_invoice_id) REFERENCES sales_invoices (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('Tabla customer_notes creada o verificada.');

    // 2. Crear tabla customer_note_items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_note_items (
        id CHAR(36) NOT NULL,
        note_id CHAR(36) NOT NULL,
        product_id CHAR(36) DEFAULT NULL,
        description VARCHAR(255) NOT NULL,
        quantity DECIMAL(12,2) NOT NULL DEFAULT 1.00,
        unit_price DECIMAL(14,4) NOT NULL,
        tax_rate DECIMAL(5,2) NOT NULL DEFAULT 16.00,
        tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        subtotal DECIMAL(14,2) NOT NULL,
        return_to_inventory TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_cnoti_note (note_id),
        KEY idx_cnoti_product (product_id),
        CONSTRAINT fk_cnoti_note FOREIGN KEY (note_id) REFERENCES customer_notes (id) ON DELETE CASCADE,
        CONSTRAINT fk_cnoti_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('Tabla customer_note_items creada o verificada.');

    // 3. Crear tabla customer_note_applications
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_note_applications (
        id CHAR(36) NOT NULL,
        note_id CHAR(36) NOT NULL,
        receivable_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        amount_applied DECIMAL(14,2) NOT NULL,
        applied_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes VARCHAR(255) DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_cna_note (note_id),
        KEY idx_cna_rec (receivable_id),
        CONSTRAINT fk_cna_note FOREIGN KEY (note_id) REFERENCES customer_notes (id) ON DELETE CASCADE,
        CONSTRAINT fk_cna_rec FOREIGN KEY (receivable_id) REFERENCES receivables (id) ON DELETE CASCADE,
        CONSTRAINT fk_cna_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('Tabla customer_note_applications creada o verificada.');

    // 4. Adaptar tabla receivables para permitir debit_note_id y document_type
    // Verificar si ya existe debit_note_id en receivables
    const [columns]: any = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ero_erp_db' AND TABLE_NAME = 'receivables' AND COLUMN_NAME = 'debit_note_id'
    `);

    if (columns.length === 0) {
      console.log('Modificando tabla receivables para soportar Notas de Débito...');
      // Permitir invoice_id NULL
      await connection.query(`ALTER TABLE receivables MODIFY COLUMN invoice_id CHAR(36) NULL`);
      // Agregar columnas debit_note_id y document_type
      await connection.query(`
        ALTER TABLE receivables
        ADD COLUMN debit_note_id CHAR(36) NULL AFTER invoice_id,
        ADD COLUMN document_type ENUM('INVOICE', 'DEBIT_NOTE') NOT NULL DEFAULT 'INVOICE' AFTER debit_note_id,
        ADD CONSTRAINT fk_rec_debit_note FOREIGN KEY (debit_note_id) REFERENCES customer_notes (id) ON DELETE CASCADE
      `);
      console.log('Tabla receivables actualizada con soporte de Notas de Débito.');
    } else {
      console.log('Tabla receivables ya cuenta con soporte de Notas de Débito.');
    }

    // 5. Agregar medio de pago 'NOTA_CREDITO' a payment_methods si no existe
    const [pmCheck]: any = await connection.query(`
      SELECT id FROM payment_methods WHERE code = 'NOTA_CREDITO' LIMIT 1
    `);
    if (pmCheck.length === 0) {
      // Tomar una empresa existente
      const [companies]: any = await connection.query(`SELECT id FROM companies LIMIT 1`);
      if (companies.length > 0) {
        const compId = companies[0].id;
        await connection.query(`
          INSERT INTO payment_methods (
            id, company_id, code, name, currency, type, applies_igtf, requires_reference, requires_bank_account, is_active, display_order
          ) VALUES (
            UUID(), ?, 'NOTA_CREDITO', 'Nota de Crédito / Saldo a Favor', 'USD', 'CREDIT', 0, 1, 0, 1, 10
          )
        `, [compId]);
        console.log('Medio de pago NOTA_CREDITO agregado.');
      }
    }

    // 6. Asignar permiso sales.credit_notes si no existe
    const [permCheck]: any = await connection.query(`
      SELECT id FROM permissions WHERE module = 'sales' AND action = 'credit_notes' LIMIT 1
    `);
    let permId: string;
    if (permCheck.length === 0) {
      permId = 'p_sales_credit_notes';
      await connection.query(`
        INSERT INTO permissions (id, module, action, description)
        VALUES (?, 'sales', 'credit_notes', 'Emitir, consultar y anular Notas de Crédito y Débito')
      `, [permId]);
      console.log('Permiso sales.credit_notes creado.');
    } else {
      permId = permCheck[0].id;
    }

    // Asignar permiso a roles administradores y ventas
    const [roles]: any = await connection.query(`
      SELECT id, name FROM roles WHERE name IN ('Super Administrador', 'Administrador', 'Vendedor')
    `);
    for (const r of roles) {
      await connection.query(`
        INSERT IGNORE INTO role_permissions (role_id, permission_id)
        VALUES (?, ?)
      `, [r.id, permId]);
    }
    console.log('Permisos asignados a roles clave.');

    console.log('¡Migración de Notas de Crédito y Débito completada con éxito!');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
