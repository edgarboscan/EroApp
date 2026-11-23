import { query } from './index';
import { syncSystemPermissions } from './seedPermissions';

export async function migrateChat(): Promise<void> {
  console.log('[MigrateChat] Creando tablas para el módulo de chat...');

  await query(`
    CREATE TABLE IF NOT EXISTS \`chat_conversations\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`user1_id\` CHAR(36) NOT NULL,
      \`user2_id\` CHAR(36) NOT NULL,
      \`last_message\` TEXT DEFAULT NULL,
      \`last_message_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_chat_participants\` (\`company_id\`, \`user1_id\`, \`user2_id\`),
      KEY \`idx_chat_user1\` (\`company_id\`, \`user1_id\`, \`last_message_at\`),
      KEY \`idx_chat_user2\` (\`company_id\`, \`user2_id\`, \`last_message_at\`),
      CONSTRAINT \`fk_chat_conv_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_chat_conv_user1\` FOREIGN KEY (\`user1_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_chat_conv_user2\` FOREIGN KEY (\`user2_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS \`chat_messages\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`conversation_id\` VARCHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`sender_id\` CHAR(36) NOT NULL,
      \`recipient_id\` CHAR(36) NOT NULL,
      \`message\` TEXT NOT NULL,
      \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
      \`read_at\` DATETIME DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_chat_msg_conv\` (\`conversation_id\`, \`created_at\`),
      KEY \`idx_chat_msg_unread\` (\`company_id\`, \`recipient_id\`, \`is_read\`),
      KEY \`idx_chat_msg_audit\` (\`company_id\`, \`created_at\`),
      CONSTRAINT \`fk_chat_msg_conv\` FOREIGN KEY (\`conversation_id\`) REFERENCES \`chat_conversations\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_chat_msg_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_chat_msg_sender\` FOREIGN KEY (\`sender_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_chat_msg_recipient\` FOREIGN KEY (\`recipient_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS \`user_chat_statuses\` (
      \`user_id\` CHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`status\` ENUM('ONLINE', 'AWAY', 'BUSY', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
      \`status_message\` VARCHAR(150) DEFAULT NULL,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`user_id\`),
      KEY \`idx_user_chat_status_company\` (\`company_id\`),
      CONSTRAINT \`fk_user_chat_status_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_user_chat_status_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // Columnas para soporte de grupos y auditoría en chat_conversations
  try {
    await query(`ALTER TABLE \`chat_conversations\` ADD COLUMN \`type\` ENUM('DIRECT', 'GROUP') NOT NULL DEFAULT 'DIRECT' AFTER \`company_id\``);
  } catch {}
  try {
    await query(`ALTER TABLE \`chat_conversations\` ADD COLUMN \`title\` VARCHAR(150) DEFAULT NULL AFTER \`type\``);
  } catch {}
  try {
    await query(`ALTER TABLE \`chat_conversations\` ADD COLUMN \`created_by\` CHAR(36) DEFAULT NULL AFTER \`title\``);
  } catch {}
  try {
    await query(`ALTER TABLE \`chat_conversations\` MODIFY \`user1_id\` CHAR(36) NULL`);
  } catch {}
  try {
    await query(`ALTER TABLE \`chat_conversations\` MODIFY \`user2_id\` CHAR(36) NULL`);
  } catch {}

  // Permitir recipient_id nulo para mensajes en grupos
  try {
    await query(`ALTER TABLE \`chat_messages\` MODIFY \`recipient_id\` CHAR(36) NULL`);
  } catch {}

  // Tabla de participantes por conversación (soporta grupos y ocultamiento/eliminación por usuario)
  await query(`
    CREATE TABLE IF NOT EXISTS \`chat_conversation_participants\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`conversation_id\` VARCHAR(36) NOT NULL,
      \`company_id\` CHAR(36) NOT NULL,
      \`user_id\` CHAR(36) NOT NULL,
      \`is_admin\` TINYINT(1) NOT NULL DEFAULT 0,
      \`hidden_at\` DATETIME DEFAULT NULL,
      \`joined_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_conv_participant\` (\`conversation_id\`, \`user_id\`),
      KEY \`idx_participant_lookup\` (\`company_id\`, \`user_id\`, \`hidden_at\`),
      CONSTRAINT \`fk_part_conv\` FOREIGN KEY (\`conversation_id\`) REFERENCES \`chat_conversations\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_part_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_part_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // Migrar participantes existentes de chats 1-a-1
  try {
    await query(`
      INSERT IGNORE INTO \`chat_conversation_participants\` (\`id\`, \`conversation_id\`, \`company_id\`, \`user_id\`, \`is_admin\`, \`joined_at\`)
      SELECT UUID(), \`id\`, \`company_id\`, \`user1_id\`, 0, \`created_at\`
      FROM \`chat_conversations\` WHERE \`user1_id\` IS NOT NULL
    `);
    await query(`
      INSERT IGNORE INTO \`chat_conversation_participants\` (\`id\`, \`conversation_id\`, \`company_id\`, \`user_id\`, \`is_admin\`, \`joined_at\`)
      SELECT UUID(), \`id\`, \`company_id\`, \`user2_id\`, 0, \`created_at\`
      FROM \`chat_conversations\` WHERE \`user2_id\` IS NOT NULL
    `);
  } catch (err) {
    console.warn('[MigrateChat] Nota durante sincronización de participantes:', err);
  }

  console.log('[MigrateChat] Sincronizando permisos de chat en la base de datos...');
  await syncSystemPermissions();

  console.log('[MigrateChat] Migración de chat finalizada con éxito.');
}

if (process.argv[1] && (process.argv[1].endsWith('migrateChat.ts') || process.argv[1].endsWith('migrateChat.js'))) {
  migrateChat()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[MigrateChat Error]:', err);
      process.exit(1);
    });
}

