import mysql from 'mysql2/promise';

async function migrate() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db'
  });

  console.log('Connected to MySQL. Creating tables for brands, units, presentations and SKUs...');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`brands\` (
      \`id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`description\` VARCHAR(255) DEFAULT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_brands_company_name\` (\`company_id\`, \`name\`),
      KEY \`idx_brands_company_active\` (\`company_id\`, \`is_active\`),
      CONSTRAINT \`fk_brands_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`units_of_measure\` (
      \`id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`code\` VARCHAR(20) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`symbol\` VARCHAR(10) DEFAULT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_uom_company_code\` (\`company_id\`, \`code\`),
      KEY \`idx_uom_company_active\` (\`company_id\`, \`is_active\`),
      CONSTRAINT \`fk_uom_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`presentations\` (
      \`id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`description\` VARCHAR(255) DEFAULT NULL,
      \`default_multiplier\` DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
      \`default_unit\` VARCHAR(20) NOT NULL DEFAULT 'UND',
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_presentations_company_name\` (\`company_id\`, \`name\`),
      KEY \`idx_presentations_company_active\` (\`company_id\`, \`is_active\`),
      CONSTRAINT \`fk_presentations_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`product_skus\` (
      \`id\` CHAR(36) NOT NULL,
      \`product_id\` CHAR(36) NOT NULL,
      \`sku\` VARCHAR(50) NOT NULL,
      \`barcode\` VARCHAR(50) DEFAULT NULL,
      \`description\` VARCHAR(150) DEFAULT NULL,
      \`is_primary\` TINYINT(1) NOT NULL DEFAULT 0,
      \`cost_price\` DECIMAL(14,4) DEFAULT NULL,
      \`price\` DECIMAL(14,4) DEFAULT NULL,
      \`currency\` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_product_skus_sku\` (\`product_id\`, \`sku\`),
      KEY \`idx_ps_product_id\` (\`product_id\`),
      KEY \`idx_ps_sku\` (\`sku\`),
      KEY \`idx_ps_barcode\` (\`barcode\`),
      CONSTRAINT \`fk_product_skus_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`product_presentations\` (
      \`id\` CHAR(36) NOT NULL,
      \`product_id\` CHAR(36) NOT NULL,
      \`presentation_id\` CHAR(36) DEFAULT NULL,
      \`name\` VARCHAR(100) NOT NULL,
      \`sku\` VARCHAR(50) DEFAULT NULL,
      \`barcode\` VARCHAR(50) DEFAULT NULL,
      \`unit_of_measure\` VARCHAR(20) NOT NULL DEFAULT 'UND',
      \`multiplier\` DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
      \`cost_price\` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      \`base_price\` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      \`currency\` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
      \`is_default\` TINYINT(1) NOT NULL DEFAULT 0,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_pp_product_id\` (\`product_id\`),
      KEY \`idx_pp_sku\` (\`sku\`),
      KEY \`idx_pp_barcode\` (\`barcode\`),
      CONSTRAINT \`fk_pp_product_link\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_pp_presentation\` FOREIGN KEY (\`presentation_id\`) REFERENCES \`presentations\` (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // Seed default units and presentations for demo company
  const companyId = 'c1111111-1111-1111-1111-111111111111';

  await conn.query(`
    INSERT IGNORE INTO \`units_of_measure\` (\`id\`, \`company_id\`, \`code\`, \`name\`, \`symbol\`) VALUES
    (UUID(), ?, 'UND', 'Unidad', 'und'),
    (UUID(), ?, 'KG', 'Kilogramo', 'kg'),
    (UUID(), ?, 'GR', 'Gramo', 'g'),
    (UUID(), ?, 'LTS', 'Litro', 'L'),
    (UUID(), ?, 'ML', 'Mililitro', 'mL'),
    (UUID(), ?, 'CAJA', 'Caja', 'cja'),
    (UUID(), ?, 'PAQ', 'Paquete', 'paq'),
    (UUID(), ?, 'BULTO', 'Bulto', 'blt'),
    (UUID(), ?, 'MTR', 'Metro', 'm');
  `, [companyId, companyId, companyId, companyId, companyId, companyId, companyId, companyId, companyId]);

  await conn.query(`
    INSERT IGNORE INTO \`presentations\` (\`id\`, \`company_id\`, \`name\`, \`description\`, \`default_multiplier\`, \`default_unit\`) VALUES
    (UUID(), ?, 'Unidad Individual', 'Presentación individual al detal', 1.0000, 'UND'),
    (UUID(), ?, 'Display x 6', 'Empaque intermedio por 6 unidades', 6.0000, 'UND'),
    (UUID(), ?, 'Display x 12', 'Empaque por 12 unidades', 12.0000, 'UND'),
    (UUID(), ?, 'Caja x 24', 'Caja corrugada estándar por 24 unidades', 24.0000, 'CAJA'),
    (UUID(), ?, 'Caja x 48', 'Caja por 48 unidades', 48.0000, 'CAJA'),
    (UUID(), ?, 'Bulto x 20Kg', 'Saco o bulto por 20 kilogramos', 20.0000, 'KG'),
    (UUID(), ?, 'Bulto x 50Kg', 'Saco industrial por 50 kilogramos', 50.0000, 'KG');
  `, [companyId, companyId, companyId, companyId, companyId, companyId, companyId]);

  await conn.query(`
    INSERT IGNORE INTO \`brands\` (\`id\`, \`company_id\`, \`name\`, \`description\`) VALUES
    (UUID(), ?, 'Empresas Polar', 'Alimentos y Bebidas Polar'),
    (UUID(), ?, 'Primor', 'Pastas y Arroz Primor'),
    (UUID(), ?, 'Mavesa', 'Margarinas y Salsas Mavesa'),
    (UUID(), ?, 'Juana', 'Harina de Maíz'),
    (UUID(), ?, 'Genérico / Sin Marca', 'Artículos sin marca registrada');
  `, [companyId, companyId, companyId, companyId, companyId]);

  console.log('Migration completed successfully!');
  await conn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
