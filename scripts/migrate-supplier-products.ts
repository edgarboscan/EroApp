import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db',
  });

  try {
    console.log('Creando tabla supplier_products si no existe...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS supplier_products (
        id CHAR(36) NOT NULL,
        company_id CHAR(36) NOT NULL,
        supplier_id CHAR(36) NOT NULL,
        product_id CHAR(36) NOT NULL,
        supplier_product_code VARCHAR(60) DEFAULT NULL,
        cost_price_usd DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
        delivery_lead_time_days INT NOT NULL DEFAULT 0,
        is_preferred TINYINT(1) NOT NULL DEFAULT 0,
        notes VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_supplier_product (supplier_id, product_id),
        KEY idx_sp_product (product_id),
        KEY idx_sp_company (company_id),
        CONSTRAINT fk_sp_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        CONSTRAINT fk_sp_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE,
        CONSTRAINT fk_sp_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('Tabla supplier_products creada exitosamente.');

    // Verificar si suppliers tiene columnas contact_name o commercial_name
    const [cols]: any = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suppliers'
    `);
    const existing = cols.map((c: any) => c.COLUMN_NAME);

    if (!existing.includes('commercial_name')) {
      console.log('Agregando commercial_name a suppliers...');
      await connection.query(`
        ALTER TABLE suppliers ADD COLUMN commercial_name VARCHAR(150) DEFAULT NULL AFTER name;
      `);
    }

    if (!existing.includes('contact_name')) {
      console.log('Agregando contact_name a suppliers...');
      await connection.query(`
        ALTER TABLE suppliers ADD COLUMN contact_name VARCHAR(100) DEFAULT NULL AFTER fiscal_address;
      `);
    }

    console.log('Migración de proveedores y productos completada con éxito.');
  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
