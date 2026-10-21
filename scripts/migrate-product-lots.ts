import mysql from 'mysql2/promise';

async function migrateLots() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db',
  });

  console.log('Conectado a MySQL. Verificando tabla product_lots...');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`product_lots\` (
      \`id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`product_id\` CHAR(36) NOT NULL,
      \`warehouse_id\` CHAR(36) NOT NULL,
      \`lot_number\` VARCHAR(50) NOT NULL,
      \`manufacturing_date\` DATE DEFAULT NULL,
      \`expiration_date\` DATE NOT NULL,
      \`initial_quantity\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`current_quantity\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`reserved_quantity\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      \`cost_price\` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      \`status\` ENUM('ACTIVE', 'EXPIRED', 'DEPLETED', 'QUARANTINE') NOT NULL DEFAULT 'ACTIVE',
      \`notes\` VARCHAR(255) DEFAULT NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_product_warehouse_lot\` (\`product_id\`, \`warehouse_id\`, \`lot_number\`),
      KEY \`idx_lots_product\` (\`product_id\`),
      KEY \`idx_lots_warehouse\` (\`warehouse_id\`),
      KEY \`idx_lots_expiration\` (\`expiration_date\`, \`status\`),
      KEY \`idx_lots_company\` (\`company_id\`),
      CONSTRAINT \`fk_plot_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_plot_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_plot_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  console.log('Tabla product_lots verificada / creada con éxito.');

  // Obtener una empresa y productos para verificar
  const [products]: any = await conn.query(`
    SELECT p.id, p.company_id, p.sku, p.name, p.has_batches
    FROM products p
    LIMIT 10
  `);

  const [warehouses]: any = await conn.query(`
    SELECT id, branch_id, name, is_default_sales
    FROM warehouses
    WHERE is_active = 1
    ORDER BY is_default_sales DESC
    LIMIT 2
  `);

  if (products.length > 0 && warehouses.length > 0) {
    const p1 = products[0];
    const w1 = warehouses[0];

    // Marcar p1 con has_batches = 1 para pruebas si no lo tiene
    await conn.query(`UPDATE products SET has_batches = 1 WHERE id = ?`, [p1.id]);
    console.log(`Producto ${p1.name} (${p1.sku}) configurado con has_batches = 1`);

    // Insertar un lote de demostración si no existe
    const [existingLots]: any = await conn.query(
      `SELECT id FROM product_lots WHERE product_id = ? AND lot_number = 'LOT-2026-001'`,
      [p1.id]
    );

    if (existingLots.length === 0) {
      const lotId = 'l1111111-1111-1111-1111-111111111111';
      await conn.query(
        `INSERT INTO product_lots (
          id, company_id, product_id, warehouse_id, lot_number,
          manufacturing_date, expiration_date, initial_quantity, current_quantity,
          reserved_quantity, cost_price, status, notes
        ) VALUES (?, ?, ?, ?, 'LOT-2026-001', '2026-01-15', '2026-12-31', 150.00, 120.00, 0.00, 0.9500, 'ACTIVE', 'Lote importado inicial')`,
        [lotId, p1.company_id, p1.id, w1.id]
      );
      console.log('Lote de demostración LOT-2026-001 insertado correctamente.');
    }

    // Insertar un lote próximo a vencer (25 días) para verificar alertas
    const [expiringLots]: any = await conn.query(
      `SELECT id FROM product_lots WHERE product_id = ? AND lot_number = 'LOT-EXP-PRONTO'`,
      [p1.id]
    );
    if (expiringLots.length === 0) {
      const lotExpId = 'l2222222-2222-2222-2222-222222222222';
      const soonExpDate = new Date();
      soonExpDate.setDate(soonExpDate.getDate() + 18);
      const soonExpStr = soonExpDate.toISOString().split('T')[0];

      await conn.query(
        `INSERT INTO product_lots (
          id, company_id, product_id, warehouse_id, lot_number,
          manufacturing_date, expiration_date, initial_quantity, current_quantity,
          reserved_quantity, cost_price, status, notes
        ) VALUES (?, ?, ?, ?, 'LOT-EXP-PRONTO', '2025-10-01', ?, 50.00, 30.00, 0.00, 0.9000, 'ACTIVE', 'Lote próximo a vencer para prueba de semáforo')`,
        [lotExpId, p1.company_id, p1.id, w1.id, soonExpStr]
      );
      console.log('Lote próximo a vencer insertado para prueba.');
    }
  }

  const [lotCount]: any = await conn.query(`SELECT COUNT(*) as total FROM product_lots`);
  console.log(`Total lotes en la base de datos: ${lotCount[0].total}`);

  await conn.end();
  console.log('Migración de lotes finalizada con éxito.');
}

migrateLots().catch((err) => {
  console.error('Error migrando lotes:', err);
  process.exit(1);
});
