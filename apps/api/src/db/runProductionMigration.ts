import { query, pool } from './index';
import crypto from 'crypto';

const DEFAULT_WASTE_REASONS = [
  { code: 'HUESO_GRASA', name: 'Hueso y Grasa no comercializable', affectsCost: 1 },
  { code: 'RECORTE_LIMPIEZA', name: 'Recorte y Limpieza de Pieza', affectsCost: 1 },
  { code: 'DESHIDRATACION', name: 'Pérdida por Deshidratación / Refrigeración', affectsCost: 1 },
  { code: 'AVERIA_PROCESO', name: 'Avería o Deterioro en Proceso', affectsCost: 1 },
  { code: 'CADUCIDAD', name: 'Vencimiento / Descomposición', affectsCost: 1 },
];

export async function runProductionMigration() {
  console.log('Iniciando migración del Módulo de Producción, Desposte y Control de Merma...');

  // 1. Extender tabla products si faltan columnas
  const cols: any = await query(`SHOW COLUMNS FROM products`);
  const existingCols = new Set(cols.map((c: any) => c.Field));

  if (!existingCols.has('allows_waste')) {
    await query(`ALTER TABLE products ADD COLUMN allows_waste TINYINT(1) NOT NULL DEFAULT 0 AFTER has_serials`);
  }
  if (!existingCols.has('is_butchery_base')) {
    await query(`ALTER TABLE products ADD COLUMN is_butchery_base TINYINT(1) NOT NULL DEFAULT 0 AFTER allows_waste`);
  }
  if (!existingCols.has('is_butchery_yield')) {
    await query(`ALTER TABLE products ADD COLUMN is_butchery_yield TINYINT(1) NOT NULL DEFAULT 0 AFTER is_butchery_base`);
  }
  if (!existingCols.has('expected_waste_pct')) {
    await query(`ALTER TABLE products ADD COLUMN expected_waste_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER is_butchery_yield`);
  }

  // 2. Catálogo de motivos de merma
  await query(`
    CREATE TABLE IF NOT EXISTS waste_reasons (
      id CHAR(36) PRIMARY KEY,
      company_id CHAR(36) NOT NULL,
      code VARCHAR(30) NOT NULL,
      name VARCHAR(120) NOT NULL,
      affects_cost TINYINT(1) NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_waste_reason_code (company_id, code),
      INDEX idx_waste_reasons_company (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  // 3. Órdenes de Producción / Desposte
  await query(`
    CREATE TABLE IF NOT EXISTS production_orders (
      id CHAR(36) PRIMARY KEY,
      company_id CHAR(36) NOT NULL,
      branch_id CHAR(36) NOT NULL,
      warehouse_id CHAR(36) NOT NULL,
      order_number VARCHAR(30) NOT NULL,
      process_type ENUM('WHOLE_CARCASS', 'PARTIAL_EXTRACTION', 'SUBDIVISION', 'TRANSFORMATION') NOT NULL DEFAULT 'WHOLE_CARCASS',
      parent_order_id CHAR(36) NULL,
      source_product_id CHAR(36) NOT NULL,
      source_quantity DECIMAL(14,4) NOT NULL,
      source_unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      source_total_cost DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      total_output_quantity DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      waste_quantity DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      waste_pct DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
      waste_reason_id CHAR(36) NULL,
      waste_cost DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      cost_allocation_method ENUM('BY_WEIGHT', 'EQUAL_UNIT') NOT NULL DEFAULT 'BY_WEIGHT',
      status ENUM('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
      notes TEXT NULL,
      created_by CHAR(36) NOT NULL,
      completed_by CHAR(36) NULL,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_prod_order_number (company_id, order_number),
      INDEX idx_prod_orders_company_status (company_id, status),
      INDEX idx_prod_orders_source (source_product_id),
      INDEX idx_prod_orders_parent (parent_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  // 4. Productos derivados / salidas de la orden
  await query(`
    CREATE TABLE IF NOT EXISTS production_order_outputs (
      id CHAR(36) PRIMARY KEY,
      order_id CHAR(36) NOT NULL,
      product_id CHAR(36) NOT NULL,
      output_type ENUM('INTERMEDIATE', 'FINAL_CUT') NOT NULL DEFAULT 'FINAL_CUT',
      quantity DECIMAL(14,4) NOT NULL,
      yield_pct DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
      allocated_unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      allocated_total_cost DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      notes VARCHAR(255) NULL,
      INDEX idx_prod_outputs_order (order_id),
      INDEX idx_prod_outputs_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  // 5. Bitácora auditable de mermas
  await query(`
    CREATE TABLE IF NOT EXISTS production_waste_logs (
      id CHAR(36) PRIMARY KEY,
      company_id CHAR(36) NOT NULL,
      branch_id CHAR(36) NOT NULL,
      warehouse_id CHAR(36) NOT NULL,
      production_order_id CHAR(36) NULL,
      product_id CHAR(36) NOT NULL,
      waste_reason_id CHAR(36) NOT NULL,
      quantity DECIMAL(14,4) NOT NULL,
      unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      total_cost DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      notes TEXT NULL,
      user_id CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_waste_logs_company (company_id, created_at),
      INDEX idx_waste_logs_order (production_order_id),
      INDEX idx_waste_logs_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  // 6. Sembrar motivos de merma por defecto en cada empresa
  const companies: any = await query(`SELECT id FROM companies`);
  for (const c of companies) {
    for (const reason of DEFAULT_WASTE_REASONS) {
      await query(
        `INSERT IGNORE INTO waste_reasons (id, company_id, code, name, affects_cost, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [crypto.randomUUID(), c.id, reason.code, reason.name, reason.affectsCost]
      );
    }
  }

  console.log('Migración de Producción, Desposte y Control de Merma completada.');
}

import { fileURLToPath } from 'url';

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runProductionMigration()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('Error en migración de producción:', err);
      await pool.end();
      process.exit(1);
    });
}
