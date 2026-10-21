import { query } from '../apps/api/src/db';

async function main() {
  console.log('--- Iniciando migración de permisos de autorización ---');

  const permsToInsert = [
    {
      module: 'pos',
      action: 'authorize',
      description: 'Autorizar operaciones restringidas en caja (Stock negativo, presentaciones, precios)',
    },
    {
      module: 'sales',
      action: 'approve',
      description: 'Aprobar ventas especiales y autorizaciones de caja',
    },
    {
      module: 'inventory',
      action: 'approve',
      description: 'Aprobar operaciones especiales de inventario',
    },
  ];

  for (const p of permsToInsert) {
    const existing = await query<any>(
      'SELECT id FROM permissions WHERE module = ? AND action = ?',
      [p.module, p.action]
    );

    let permId: string;
    if (existing.length === 0) {
      await query(
        'INSERT INTO permissions (id, module, action, description) VALUES (UUID(), ?, ?, ?)',
        [p.module, p.action, p.description]
      );
      const created = await query<any>(
        'SELECT id FROM permissions WHERE module = ? AND action = ?',
        [p.module, p.action]
      );
      permId = created[0].id;
      console.log(`+ Permiso creado: ${p.module}.${p.action} (${permId})`);
    } else {
      permId = existing[0].id;
      console.log(`= Permiso ya existente: ${p.module}.${p.action} (${permId})`);
    }
  }

  // Obtener roles de administradores y supervisores
  const adminSupervisorRoles = await query<any>(
    `SELECT id, name FROM roles 
     WHERE LOWER(name) LIKE '%admin%' 
        OR LOWER(name) LIKE '%supervisor%' 
        OR LOWER(name) LIKE '%gerente%' 
        OR LOWER(name) LIKE '%director%'`
  );

  console.log(`Roles candidatos a autorización: ${adminSupervisorRoles.map((r: any) => r.name).join(', ')}`);

  // Obtener los IDs de los permisos de autorización
  const authPerms = await query<any>(
    `SELECT id, module, action FROM permissions 
     WHERE (module = 'pos' AND action = 'authorize')
        OR (module = 'sales' AND action IN ('approve', 'approve_discount'))
        OR (module = 'inventory' AND action = 'approve')`
  );

  for (const role of adminSupervisorRoles) {
    for (const perm of authPerms) {
      await query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [role.id, perm.id]
      );
    }
    console.log(`✓ Asignados permisos de autorización a rol: ${role.name}`);
  }

  // Verificar que el rol Cajero POS NO tenga asignado pos.authorize ni approve
  const cashierRoles = await query<any>(
    `SELECT id, name FROM roles WHERE LOWER(name) LIKE '%cajero%'`
  );

  for (const cashier of cashierRoles) {
    const res = await query<any>(
      `DELETE rp FROM role_permissions rp
       INNER JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ? 
         AND ((p.module = 'pos' AND p.action = 'authorize') 
           OR (p.module = 'sales' AND p.action = 'approve') 
           OR (p.module = 'inventory' AND p.action = 'approve'))`,
      [cashier.id]
    );
    console.log(`✓ Verificado aislamiento de rol cajero (${cashier.name}) sin permisos de autorización.`);
  }

  console.log('--- Migración completada exitosamente ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en migración:', err);
  process.exit(1);
});
