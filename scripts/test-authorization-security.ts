import { query } from '../apps/api/src/db';
import { POSService } from '../apps/api/src/modules/pos/pos.service';

async function main() {
  console.log('--- Iniciando Test Automatizado de Seguridad en Autorizaciones ---');

  // 1. Obtener usuario cajero y usuario administrador
  const cashierRows = await query<any>(
    `SELECT u.id, u.username, u.company_id, r.name as role_name 
     FROM users u 
     INNER JOIN roles r ON u.role_id = r.id 
     WHERE u.username = 'cajero01' LIMIT 1`
  );

  const adminRows = await query<any>(
    `SELECT u.id, u.username, u.company_id, r.name as role_name 
     FROM users u 
     INNER JOIN roles r ON u.role_id = r.id 
     WHERE u.username = 'admin' LIMIT 1`
  );

  if (cashierRows.length === 0 || adminRows.length === 0) {
    throw new Error('No se encontraron usuarios demo cajero01 o admin');
  }

  const cashier = cashierRows[0];
  const admin = adminRows[0];

  console.log(`Cajero cargado: ${cashier.username} (${cashier.role_name})`);
  console.log(`Admin cargado: ${admin.username} (${admin.role_name})`);

  // Test 1: Cajero intenta auto-autorizarse en POSService.authorizeSupervisor
  console.log('\n[Test 1] Cajero intenta auto-autorizarse (selfAuthorize: true)...');
  try {
    await POSService.authorizeSupervisor(cashier.company_id, cashier.id, {
      selfAuthorize: true,
    });
    console.error('❌ FALLÓ: El cajero NO debió poder auto-autorizarse.');
    process.exit(1);
  } catch (err: any) {
    console.log(`✓ BLOQUEADO CORRECTAMENTE: "${err.message}"`);
  }

  // Test 2: Cajero ingresa sus propias credenciales como si fuera supervisor
  console.log('\n[Test 2] Cajero ingresa sus credenciales en el modal de supervisor...');
  try {
    await POSService.authorizeSupervisor(cashier.company_id, cashier.id, {
      usernameOrEmail: cashier.username,
      password: 'Admin123!', // password demo
      reason: 'Intento de autorización no autorizada',
    });
    console.error('❌ FALLÓ: El backend aceptó las credenciales de un cajero como supervisor.');
    process.exit(1);
  } catch (err: any) {
    console.log(`✓ BLOQUEADO CORRECTAMENTE: "${err.message}"`);
  }

  // Test 3: Administrador se auto-autoriza (selfAuthorize: true)
  console.log('\n[Test 3] Administrador se auto-autoriza...');
  try {
    const res = await POSService.authorizeSupervisor(admin.company_id, admin.id, {
      selfAuthorize: true,
    });
    if (res.authorized) {
      console.log(`✓ AUTORIZACIÓN EXITOSA: Aprobado por ${res.approvedByUserName} (${res.roleName})`);
    } else {
      console.error('❌ FALLÓ: No se autorizó al administrador.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Error inesperado al autorizar administrador:', err);
    process.exit(1);
  }

  // Test 4: Cajero solicita autorización externa y suministra credenciales del Administrador
  console.log('\n[Test 4] Cajero suministra credenciales válidas del Administrador en el modal...');
  try {
    const res = await POSService.authorizeSupervisor(cashier.company_id, cashier.id, {
      usernameOrEmail: admin.username,
      password: 'Admin123!',
      reason: 'Venta especial autorizada por Gerencia',
    });
    if (res.authorized) {
      console.log(`✓ AUTORIZACIÓN EXTERNA EXITOSA: Aprobado por ${res.approvedByUserName} (${res.roleName})`);
    } else {
      console.error('❌ FALLÓ: No se autorizó con credenciales del administrador.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Error inesperado con credenciales válidas:', err);
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('✓ TODOS LOS TESTS DE SEGURIDAD EN AUTORIZACIÓN PASARON');
  console.log('======================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
