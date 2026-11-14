-- ============================================================================
-- ERO ERP - MOTOR DE CONTABILIZACIÓN AUTOMÁTICA
-- DDL 09: Mapeo de Cuentas, Configuración de Contabilización y Trazabilidad
-- ============================================================================

-- 1. TABLA DE CONFIGURACIÓN DE CONTABILIZACIÓN AUTOMÁTICA
CREATE TABLE IF NOT EXISTS `accounting_settings` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `auto_posting_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: Generar asientos automáticamente al procesar operaciones',
  `default_entry_status` ENUM('DRAFT', 'POSTED') NOT NULL DEFAULT 'POSTED' COMMENT 'Estado por defecto del asiento generado',
  `post_sales` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Contabilizar ventas y costo de ventas',
  `post_purchases` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Contabilizar compras a proveedores',
  `post_payments` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Contabilizar cobros y pagos CxC/CxP',
  `post_notes` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Contabilizar notas de crédito y débito',
  `post_inventory_adjustments` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Contabilizar ajustes de inventario',
  `post_treasury` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Contabilizar transferencias y depósitos bancarios',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_as_company` (`company_id`),
  CONSTRAINT `fk_as_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. TABLA DE MAPEO DE CUENTAS PREDETERMINADAS POR OPERACIÓN
CREATE TABLE IF NOT EXISTS `accounting_account_mappings` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `mapping_key` VARCHAR(60) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `description` VARCHAR(150) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_aam_company_key` (`company_id`, `mapping_key`),
  CONSTRAINT `fk_aam_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aam_account` FOREIGN KEY (`account_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

