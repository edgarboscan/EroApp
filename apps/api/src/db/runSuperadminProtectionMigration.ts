import { pool } from './index';
import { computeSuperAdminSignature } from '../utils/securityIntegrity';

export async function runSuperadminProtectionMigration() {
  console.log('[Security Migration] Verificando protección anti-tampering de Super Administrador...');

  // 1. Agregar columna superadmin_signature a la tabla users si no existe
  try {
    const [cols]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'superadmin_signature'`
    );
    if (!cols || cols.length === 0) {
      await pool.query(
        `ALTER TABLE users ADD COLUMN superadmin_signature VARCHAR(64) DEFAULT NULL AFTER can_use_chat`
      );
      console.log('[Security Migration] Columna superadmin_signature agregada exitosamente.');
    }
  } catch (err: any) {
    console.warn('[Security Migration] Error verificando columna superadmin_signature:', err.message);
  }

  // 2. Firmar criptográficamente a los Super Administradores legítimos actuales
  try {
    const [superAdmins]: any = await pool.query(
      `SELECT u.id, u.username, u.superadmin_signature, r.name as role_name
       FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       WHERE LOWER(REPLACE(r.name, ' ', '')) IN ('superadmin', 'superadministrador')`
    );

    for (const sa of superAdmins) {
      const validSig = computeSuperAdminSignature(sa.id, sa.username);
      if (sa.superadmin_signature !== validSig) {
        await pool.query(
          `UPDATE users SET superadmin_signature = ? WHERE id = ?`,
          [validSig, sa.id]
        );
        console.log(`[Security Migration] Firma criptográfica generada para SuperAdmin legítimo: ${sa.username} (${sa.id})`);
      }
    }
  } catch (err: any) {
    console.warn('[Security Migration] Error firmando superadmins existentes:', err.message);
  }

  // 3. Crear Triggers a nivel de Base de Datos para bloquear cualquier inyección/modificación SQL directa
  try {
    await pool.query(`DROP TRIGGER IF EXISTS trg_users_prevent_direct_superadmin_insert`);
    await pool.query(`
      CREATE TRIGGER trg_users_prevent_direct_superadmin_insert
      BEFORE INSERT ON users
      FOR EACH ROW
      BEGIN
        DECLARE is_super_admin INT DEFAULT 0;
        SELECT COUNT(*) INTO is_super_admin
        FROM roles
        WHERE id = NEW.role_id AND LOWER(REPLACE(name, ' ', '')) IN ('superadmin', 'superadministrador');

        IF is_super_admin > 0 AND (@ero_allow_superadmin_elevation IS NULL OR @ero_allow_superadmin_elevation != 'AUTHORIZED') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'ERROR DE SEGURIDAD ERO: Operación bloqueada. No está permitido asignar el rol de Super Administrador mediante comandos SQL directos en la base de datos.';
        END IF;
      END
    `);

    await pool.query(`DROP TRIGGER IF EXISTS trg_users_prevent_direct_superadmin_update`);
    await pool.query(`
      CREATE TRIGGER trg_users_prevent_direct_superadmin_update
      BEFORE UPDATE ON users
      FOR EACH ROW
      BEGIN
        DECLARE is_super_admin INT DEFAULT 0;
        SELECT COUNT(*) INTO is_super_admin
        FROM roles
        WHERE id = NEW.role_id AND LOWER(REPLACE(name, ' ', '')) IN ('superadmin', 'superadministrador');

        IF is_super_admin > 0 AND (OLD.role_id != NEW.role_id) AND (@ero_allow_superadmin_elevation IS NULL OR @ero_allow_superadmin_elevation != 'AUTHORIZED') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'ERROR DE SEGURIDAD ERO: Operación bloqueada. No está permitido elevar usuarios a Super Administrador mediante comandos SQL directos en la base de datos.';
        END IF;
      END
    `);

    await pool.query(`DROP TRIGGER IF EXISTS trg_roles_prevent_superadmin_rename`);
    await pool.query(`
      CREATE TRIGGER trg_roles_prevent_superadmin_rename
      BEFORE UPDATE ON roles
      FOR EACH ROW
      BEGIN
        IF LOWER(REPLACE(NEW.name, ' ', '')) IN ('superadmin', 'superadministrador')
           AND LOWER(REPLACE(OLD.name, ' ', '')) NOT IN ('superadmin', 'superadministrador')
           AND (@ero_allow_superadmin_elevation IS NULL OR @ero_allow_superadmin_elevation != 'AUTHORIZED') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'ERROR DE SEGURIDAD ERO: No está permitido renombrar roles a Super Administrador directamente en la base de datos.';
        END IF;
      END
    `);

    console.log('[Security Migration] Triggers de protección anti-tampering creados exitosamente en MySQL.');
  } catch (err: any) {
    console.warn('[Security Migration] Nota sobre triggers:', err.message);
  }
}

runSuperadminProtectionMigration()
  .then(() => {
    console.log('[Security Migration] Completado.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Security Migration] Falló:', err);
    process.exit(1);
  });
