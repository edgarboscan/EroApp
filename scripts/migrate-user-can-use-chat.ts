import { query } from '../apps/api/src/db';

async function migrate() {
  try {
    const cols = await query<any>('SHOW COLUMNS FROM users LIKE ?', ['can_use_chat']);
    if (cols.length === 0) {
      console.log('Adding column can_use_chat to users table...');
      await query('ALTER TABLE users ADD COLUMN can_use_chat TINYINT(1) NOT NULL DEFAULT 1 AFTER can_switch_warehouses');
      console.log('Column can_use_chat added successfully.');
    } else {
      console.log('Column can_use_chat already exists.');
    }
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();

