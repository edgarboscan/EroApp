import mysql from 'mysql2/promise';

async function migrateInventoryCounts() {
  console.log('--- Iniciando migración de Módulo de Conteo de Productos por Depósito ---');

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db',
  });

  try {
    // 1. Crear tabla inventory_counts
    console.log('Creando tabla inventory_counts...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`inventory_counts\` (
        \`id\` CHAR(36) NOT NULL,
        \`company_id\` CHAR(36) NOT NULL,
        \`branch_id\` CHAR(36) NOT NULL,
        \`warehouse_id\` CHAR(36) NOT NULL,
        \`count_number\` VARCHAR(30) NOT NULL,
        \`title\` VARCHAR(150) NOT NULL,
        \`status\` ENUM('IN_PROGRESS', 'COMPLETED', 'APPLIED', 'CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
        \`count_type\` ENUM('GENERAL', 'CYCLIC', 'PARTIAL') NOT NULL DEFAULT 'GENERAL',
        \`department_id\` CHAR(36) DEFAULT NULL,
        \`group_id\` CHAR(36) DEFAULT NULL,
        \`subgroup_id\` CHAR(36) DEFAULT NULL,
        \`blind_count\` TINYINT(1) NOT NULL DEFAULT 0,
        \`total_products\` INT NOT NULL DEFAULT 0,
        \`total_counted\` INT NOT NULL DEFAULT 0,
        \`total_matched\` INT NOT NULL DEFAULT 0,
        \`total_discrepancies\` INT NOT NULL DEFAULT 0,
        \`total_surplus_cost\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`total_shortage_cost\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`net_cost_impact\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`adjustment_id\` CHAR(36) DEFAULT NULL,
        \`created_by\` CHAR(36) NOT NULL,
        \`notes\` TEXT DEFAULT NULL,
        \`started_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`completed_at\` TIMESTAMP NULL DEFAULT NULL,
        \`applied_at\` TIMESTAMP NULL DEFAULT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_inventory_counts_number\` (\`company_id\`, \`count_number\`),
        INDEX \`idx_inventory_counts_wh_status\` (\`warehouse_id\`, \`status\`),
        INDEX \`idx_inventory_counts_branch\` (\`branch_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 2. Crear tabla inventory_count_items
    console.log('Creando tabla inventory_count_items...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`inventory_count_items\` (
        \`id\` CHAR(36) NOT NULL,
        \`count_id\` CHAR(36) NOT NULL,
        \`product_id\` CHAR(36) NOT NULL,
        \`system_stock\` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
        \`counted_stock\` DECIMAL(14,4) DEFAULT NULL,
        \`difference\` DECIMAL(14,4) DEFAULT NULL,
        \`unit_cost\` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
        \`cost_impact\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`status\` ENUM('PENDING', 'MATCH', 'SURPLUS', 'SHORTAGE') NOT NULL DEFAULT 'PENDING',
        \`notes\` VARCHAR(255) DEFAULT NULL,
        \`counted_at\` TIMESTAMP NULL DEFAULT NULL,
        \`counted_by\` CHAR(36) DEFAULT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_count_product\` (\`count_id\`, \`product_id\`),
        INDEX \`idx_count_items_product\` (\`product_id\`),
        CONSTRAINT \`fk_count_items_count\` FOREIGN KEY (\`count_id\`) REFERENCES \`inventory_counts\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    console.log('Tablas de conteo de inventario creadas exitosamente.');
  } catch (error) {
    console.error('Error durante la migración:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

migrateInventoryCounts()
  .then(() => {
    console.log('Migración completada con éxito.');
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
