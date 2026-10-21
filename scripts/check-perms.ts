import { query } from '../apps/api/src/db';

async function main() {
  const perms = await query<any>('SELECT module, action, description FROM permissions WHERE module IN (\'pos\', \'inventory\', \'sales\')');
  console.log('Perms:', perms);
  const roles = await query<any>('SELECT id, name, description FROM roles');
  console.log('Roles:', roles);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
