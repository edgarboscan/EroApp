-- ============================================================================
-- ERO ERP - MÓDULO CONTABLE SENIOR (VEN-NIF / NIIF PYMES & CÓDIGO DE COMERCIO)
-- DDL 07: Estructura Contable Integral Multimoneda, Ajuste por Inflación y Cierres
-- ============================================================================

-- 1. AÑOS FISCALES (EJERCICIOS ECONÓMICOS)
CREATE TABLE IF NOT EXISTS `accounting_fiscal_years` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `year` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `closed_at` TIMESTAMP NULL,
  `closed_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_afy_company_year` (`company_id`, `year`),
  CONSTRAINT `fk_afy_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. PERÍODOS FISCALES MENSUALES
CREATE TABLE IF NOT EXISTS `accounting_fiscal_periods` (
  `id` CHAR(36) NOT NULL,
  `fiscal_year_id` CHAR(36) NOT NULL,
  `month` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('OPEN', 'CLOSED', 'LOCKED') NOT NULL DEFAULT 'OPEN',
  `closed_at` TIMESTAMP NULL,
  `closed_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_afp_year_month` (`fiscal_year_id`, `month`),
  CONSTRAINT `fk_afp_fiscal_year` FOREIGN KEY (`fiscal_year_id`) REFERENCES `accounting_fiscal_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. CATÁLOGO / PLAN DE CUENTAS (JERÁRQUICO VEN-NIF / NIIF)
CREATE TABLE IF NOT EXISTS `accounting_accounts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `level` INT NOT NULL DEFAULT 1,
  `parent_id` CHAR(36) NULL,
  `account_type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COST', 'EXPENSE', 'ORDER') NOT NULL,
  `classification` ENUM('CURRENT', 'NON_CURRENT', 'OPERATING', 'FINANCIAL', 'OTHER') NOT NULL DEFAULT 'CURRENT',
  `normal_balance` ENUM('DEBIT', 'CREDIT') NOT NULL,
  `accepts_postings` TINYINT(1) NOT NULL DEFAULT 0,
  `is_monetary` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0: No monetaria (se reexpresa por inflación), 1: Monetaria (genera REI)',
  `is_bank_or_cash` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_acc_company_code` (`company_id`, `code`),
  INDEX `idx_acc_company_type` (`company_id`, `account_type`),
  INDEX `idx_acc_parent` (`parent_id`),
  CONSTRAINT `fk_acc_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_acc_parent` FOREIGN KEY (`parent_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. ÍNDICES NACIONALES DE PRECIOS AL CONSUMIDOR (INPC - BCV) PARA VEN-NIF B-10
CREATE TABLE IF NOT EXISTS `accounting_inflation_indices` (
  `id` CHAR(36) NOT NULL,
  `year` INT NOT NULL,
  `month` INT NOT NULL,
  `inpc_value` DECIMAL(18, 6) NOT NULL,
  `variation_monthly` DECIMAL(8, 4) NULL DEFAULT 0.0000,
  `published_date` DATE NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inpc_year_month` (`year`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. COMPROBANTES DE DIARIO (LIBRO DIARIO LEGAL - CÓDIGO DE COMERCIO ART. 32-38)
CREATE TABLE IF NOT EXISTS `accounting_journal_entries` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NULL,
  `period_id` CHAR(36) NULL,
  `entry_number` VARCHAR(30) NOT NULL COMMENT 'Correlativo legal obligatorio, ej. AS-2026-00001',
  `entry_date` DATE NOT NULL,
  `entry_type` ENUM('STANDARD', 'OPENING', 'ADJUSTMENT', 'EXCHANGE_DIFF', 'INFLATION_ADJUSTMENT', 'CLOSING') NOT NULL DEFAULT 'STANDARD',
  `concept` VARCHAR(255) NOT NULL,
  `notes` TEXT NULL,
  `currency` ENUM('VES', 'USD') NOT NULL DEFAULT 'VES',
  `exchange_rate` DECIMAL(18, 4) NOT NULL DEFAULT 1.0000,
  `total_debit_ves` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `total_credit_ves` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `total_debit_usd` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `total_credit_usd` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `status` ENUM('DRAFT', 'POSTED', 'ANNULLED') NOT NULL DEFAULT 'DRAFT',
  `created_by` CHAR(36) NOT NULL,
  `posted_by` CHAR(36) NULL,
  `posted_at` TIMESTAMP NULL,
  `reversed_entry_id` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_aje_company_number` (`company_id`, `entry_number`),
  INDEX `idx_aje_company_date` (`company_id`, `entry_date`),
  INDEX `idx_aje_status` (`company_id`, `status`),
  INDEX `idx_aje_period` (`period_id`),
  CONSTRAINT `fk_aje_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aje_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_aje_period` FOREIGN KEY (`period_id`) REFERENCES `accounting_fiscal_periods` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_aje_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_aje_posted_by` FOREIGN KEY (`posted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. LÍNEAS DE COMPROBANTE DE DIARIO (PARTIDA DOBLE ESTRICTA)
CREATE TABLE IF NOT EXISTS `accounting_journal_lines` (
  `id` CHAR(36) NOT NULL,
  `journal_entry_id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `line_order` INT NOT NULL DEFAULT 1,
  `description` VARCHAR(255) NOT NULL,
  `debit_ves` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `credit_ves` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `debit_usd` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `credit_usd` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `reference_doc` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ajl_entry` (`journal_entry_id`),
  INDEX `idx_ajl_account` (`account_id`),
  CONSTRAINT `fk_ajl_entry` FOREIGN KEY (`journal_entry_id`) REFERENCES `accounting_journal_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ajl_account` FOREIGN KEY (`account_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. REGISTRO DE AUDITORÍA Y HISTORIAL DE CIERRES Y REEXPRESIÓN
CREATE TABLE IF NOT EXISTS `accounting_revaluation_logs` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `period_id` CHAR(36) NOT NULL,
  `journal_entry_id` CHAR(36) NULL,
  `type` ENUM('EXCHANGE_DIFFERENCE', 'INFLATION_REEXPRESSION', 'FISCAL_CLOSE') NOT NULL,
  `execution_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `exchange_rate` DECIMAL(18, 4) NULL,
  `inpc_closing` DECIMAL(18, 6) NULL,
  `net_result_ves` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
  `notes` TEXT NULL,
  `executed_by` CHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_arl_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_arl_period` FOREIGN KEY (`period_id`) REFERENCES `accounting_fiscal_periods` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_arl_entry` FOREIGN KEY (`journal_entry_id`) REFERENCES `accounting_journal_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_arl_executed_by` FOREIGN KEY (`executed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. PERMISOS DEL MÓDULO CONTABLE
INSERT IGNORE INTO `permissions` (`id`, `module`, `action`, `description`) VALUES
('perm-acc-001', 'accounting', 'read', 'Ver plan de cuentas, comprobantes de diario, mayor y estados financieros'),
('perm-acc-002', 'accounting', 'write', 'Crear y modificar cuentas contables y comprobantes de diario en borrador'),
('perm-acc-003', 'accounting', 'post', 'Asentar legalmente comprobantes en el libro diario (Aprobación)'),
('perm-acc-004', 'accounting', 'close', 'Ejecutar procesos de cierre mensual/anual y ajuste por inflación');

-- Asignar permisos contables al rol de Administrador y Contador
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id 
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name IN ('Super Admin', 'Administrador', 'General Manager', 'Contador')
  AND p.module = 'accounting';
