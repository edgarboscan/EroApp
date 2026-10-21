import mysql from 'mysql2/promise';

async function migrate() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db'
  });

  console.log('Connected to MySQL. Inspecting warehouses table...');

  const [cols]: any = await conn.query('SHOW COLUMNS FROM warehouses');
  const colNames = cols.map((c: any) => c.Field);

  if (!colNames.includes('is_default_sales')) {
    console.log('Adding is_default_sales column to warehouses...');
    await conn.query(`
      ALTER TABLE \`warehouses\`
      ADD COLUMN \`is_default_sales\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`is_default\`
    `);
  } else {
    console.log('Column is_default_sales already exists.');
  }

  if (!colNames.includes('is_default_purchases')) {
    console.log('Adding is_default_purchases column to warehouses...');
    await conn.query(`
      ALTER TABLE \`warehouses\`
      ADD COLUMN \`is_default_purchases\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`is_default_sales\`
    `);
  } else {
    console.log('Column is_default_purchases already exists.');
  }

  console.log('Synchronizing initial default values from is_default...');
  await conn.query(`
    UPDATE \`warehouses\`
    SET \`is_default_sales\` = \`is_default\`,
        \`is_default_purchases\` = \`is_default\`
    WHERE \`is_default\` = 1 AND \`is_default_sales\` = 0 AND \`is_default_purchases\` = 0
  `);

  const [rows]: any = await conn.query('SELECT id, branch_id, code, name, is_default, is_default_sales, is_default_purchases FROM warehouses');
  console.log('Current warehouses in DB:', rows);

  await conn.end();
  console.log('Warehouse defaults migration completed successfully!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
