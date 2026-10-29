import mysql from 'mysql2/promise';

async function migrate() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db',
  });

  console.log('Connected to MySQL. Inspecting cash_registers table...');

  const [cols]: any = await conn.query('SHOW COLUMNS FROM cash_registers');
  const colNames = cols.map((c: any) => c.Field);

  if (!colNames.includes('accepts_orders')) {
    console.log('Adding accepts_orders column to cash_registers...');
    await conn.query(`
      ALTER TABLE \`cash_registers\`
      ADD COLUMN \`accepts_orders\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`invoice_mode\`
    `);
    console.log('Column accepts_orders added successfully.');
  } else {
    console.log('Column accepts_orders already exists.');
  }

  await conn.end();
  console.log('Migration completed successfully.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
