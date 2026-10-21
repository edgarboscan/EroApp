import mysql from 'mysql2/promise';

async function migrateCashAuditVerification() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db',
  });

  console.log('Conectado a MySQL ero_erp_db para migración de auditoría y depósitos de caja.');

  // 1. Columnas en cash_shifts
  const [colsShift]: any = await conn.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'ero_erp_db'
      AND TABLE_NAME = 'cash_shifts'
  `);
  const existingColNames = colsShift.map((c: any) => c.COLUMN_NAME);

  if (!existingColNames.includes('verification_status')) {
    console.log('Agregando verification_status a cash_shifts...');
    await conn.query(`
      ALTER TABLE \`cash_shifts\`
      ADD COLUMN \`verification_status\` ENUM('PENDING', 'VERIFIED', 'DEPOSITED') NOT NULL DEFAULT 'PENDING'
      AFTER \`status\`
    `);
  }

  if (!existingColNames.includes('verified_by_user_id')) {
    console.log('Agregando verified_by_user_id a cash_shifts...');
    await conn.query(`
      ALTER TABLE \`cash_shifts\`
      ADD COLUMN \`verified_by_user_id\` CHAR(36) NULL
      AFTER \`verification_status\`
    `);
  }

  if (!existingColNames.includes('verified_at')) {
    console.log('Agregando verified_at a cash_shifts...');
    await conn.query(`
      ALTER TABLE \`cash_shifts\`
      ADD COLUMN \`verified_at\` DATETIME NULL
      AFTER \`verified_by_user_id\`
    `);
  }

  if (!existingColNames.includes('verification_notes')) {
    console.log('Agregando verification_notes a cash_shifts...');
    await conn.query(`
      ALTER TABLE \`cash_shifts\`
      ADD COLUMN \`verification_notes\` TEXT NULL
      AFTER \`verified_at\`
    `);
  }

  if (!existingColNames.includes('has_discrepancy')) {
    console.log('Agregando has_discrepancy a cash_shifts...');
    await conn.query(`
      ALTER TABLE \`cash_shifts\`
      ADD COLUMN \`has_discrepancy\` TINYINT(1) NOT NULL DEFAULT 0
      AFTER \`difference_ves\`
    `);
  }

  if (!existingColNames.includes('audit_report_text')) {
    console.log('Agregando audit_report_text a cash_shifts...');
    await conn.query(`
      ALTER TABLE \`cash_shifts\`
      ADD COLUMN \`audit_report_text\` TEXT NULL
      AFTER \`has_discrepancy\`
    `);
  }

  // 2. Tabla cash_shift_deposits
  console.log('Creando tabla cash_shift_deposits...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`cash_shift_deposits\` (
      \`id\` CHAR(36) NOT NULL,
      \`shift_id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`bank_account_id\` CHAR(36) NOT NULL,
      \`user_id\` CHAR(36) NOT NULL,
      \`deposit_type\` ENUM('CASH_VES', 'CASH_USD', 'POS_BATCH', 'PAGO_MOVIL', 'TRANSFER', 'ZELLE', 'OTHER') NOT NULL,
      \`amount\` DECIMAL(16,2) NOT NULL,
      \`currency\` ENUM('USD', 'VES') NOT NULL,
      \`deposit_date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`reference_number\` VARCHAR(60) NOT NULL,
      \`notes\` VARCHAR(255) DEFAULT NULL,
      \`bank_movement_id\` CHAR(36) DEFAULT NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_csd_shift\` (\`shift_id\`),
      KEY \`idx_csd_account\` (\`bank_account_id\`),
      CONSTRAINT \`fk_csd_shift\` FOREIGN KEY (\`shift_id\`) REFERENCES \`cash_shifts\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_csd_account\` FOREIGN KEY (\`bank_account_id\`) REFERENCES \`bank_accounts\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_csd_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // 3. Tabla cash_audit_notifications
  console.log('Creando tabla cash_audit_notifications...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`cash_audit_notifications\` (
      \`id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`branch_id\` CHAR(36) NOT NULL,
      \`shift_id\` CHAR(36) NOT NULL,
      \`cash_register_id\` CHAR(36) NOT NULL,
      \`cashier_user_id\` CHAR(36) NOT NULL,
      \`discrepancy_usd\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`discrepancy_ves\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`title\` VARCHAR(150) NOT NULL,
      \`message\` TEXT NOT NULL,
      \`is_resolved\` TINYINT(1) NOT NULL DEFAULT 0,
      \`resolved_by_user_id\` CHAR(36) DEFAULT NULL,
      \`resolved_at\` DATETIME DEFAULT NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_can_company_date\` (\`company_id\`, \`created_at\`),
      KEY \`idx_can_shift\` (\`shift_id\`),
      CONSTRAINT \`fk_can_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_can_shift\` FOREIGN KEY (\`shift_id\`) REFERENCES \`cash_shifts\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // 4. Crear permiso pos.audit_shifts
  console.log('Registrando permiso pos.audit_shifts...');
  const [existingPerm]: any = await conn.query(`
    SELECT id FROM \`permissions\` WHERE \`module\` = 'pos' AND \`action\` = 'audit_shifts'
  `);

  let permId = existingPerm.length > 0 ? existingPerm[0].id : null;
  if (!permId) {
    permId = crypto.randomUUID();
    await conn.query(`
      INSERT INTO \`permissions\` (\`id\`, \`module\`, \`action\`, \`description\`)
      VALUES (?, 'pos', 'audit_shifts', 'Auditar, verificar arqueos de caja y registrar depósitos bancarios de recaudación')
    `, [permId]);
    console.log(`Permiso pos.audit_shifts creado con id: ${permId}`);
  } else {
    console.log('Permiso pos.audit_shifts ya existía en la base de datos.');
  }

  // 5. Asignar permiso a Super Administrador y Administrador
  await conn.query(`
    INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
    SELECT r.id, ?
    FROM \`roles\` r
    WHERE LOWER(r.name) LIKE '%admin%' OR LOWER(r.name) LIKE '%supervisor%'
  `, [permId]);
  console.log('Permiso pos.audit_shifts asignado a roles administrativos y de supervisión.');

  // 6. Actualizar turnos existentes para coherencia
  await conn.query(`
    UPDATE \`cash_shifts\`
    SET \`has_discrepancy\` = 1
    WHERE \`status\` = 'CLOSED' AND (ABS(\`difference_usd\`) > 0.005 OR ABS(\`difference_ves\`) > 0.005)
  `);

  await conn.query(`
    UPDATE \`cash_shifts\`
    SET \`verification_status\` = 'DEPOSITED'
    WHERE \`status\` = 'CLOSED' AND (\`deposit_amount_ves\` > 0 OR \`deposit_amount_usd\` > 0)
  `);

  console.log('Migración completada exitosamente.');
  await conn.end();
}

migrateCashAuditVerification().catch((err) => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
