import mysql from 'mysql2/promise';

async function migratePresentationAuth() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'erp_admin',
    password: 'SecurePassword_2026!',
    database: 'ero_erp_db',
  });

  console.log('Conectado a MySQL ero_erp_db.');

  // 1. Verificar columna en product_presentations
  const [colsPP]: any = await conn.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'ero_erp_db'
      AND TABLE_NAME = 'product_presentations'
      AND COLUMN_NAME = 'requires_authorization'
  `);

  if (colsPP.length === 0) {
    console.log('Agregando columna requires_authorization a product_presentations...');
    await conn.query(`
      ALTER TABLE \`product_presentations\`
      ADD COLUMN \`requires_authorization\` TINYINT(1) NOT NULL DEFAULT 0
      AFTER \`is_default\`
    `);
    console.log('Columna requires_authorization agregada a product_presentations con éxito.');
  } else {
    console.log('Columna requires_authorization ya existe en product_presentations.');
  }

  // 2. Verificar columna en presentations (plantillas)
  const [colsP]: any = await conn.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'ero_erp_db'
      AND TABLE_NAME = 'presentations'
      AND COLUMN_NAME = 'requires_authorization'
  `);

  if (colsP.length === 0) {
    console.log('Agregando columna requires_authorization a presentations...');
    await conn.query(`
      ALTER TABLE \`presentations\`
      ADD COLUMN \`requires_authorization\` TINYINT(1) NOT NULL DEFAULT 0
      AFTER \`default_unit\`
    `);
    console.log('Columna requires_authorization agregada a presentations con éxito.');
  } else {
    console.log('Columna requires_authorization ya existe en presentations.');
  }

  // 3. Establecer alguna presentación de prueba con autorización requerida (ej. Bultos o cajas al mayor)
  await conn.query(`
    UPDATE \`product_presentations\`
    SET \`requires_authorization\` = 1
    WHERE \`name\` LIKE '%Bulto%' OR \`name\` LIKE '%Caja%'
    LIMIT 2
  `);

  console.log('Migración completada exitosamente.');
  await conn.end();
}

migratePresentationAuth().catch((err) => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
