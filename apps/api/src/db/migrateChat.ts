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

