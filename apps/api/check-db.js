const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function check() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ero_erp_db',
    });
    console.log('Connected to DB successfully!');
    const [rows] = await conn.query("SHOW TABLES LIKE 'payment_methods'");
    console.log('payment_methods table exists:', rows.length > 0);
    const [sp] = await conn.query('SELECT DISTINCT method FROM sales_payments');
    console.log('Existing payment methods in sales_payments:', sp);
    await conn.end();
  } catch (err) {
    console.error('DB error:', err.message);
  }
}

check();
