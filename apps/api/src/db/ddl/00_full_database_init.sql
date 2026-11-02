-- =============================================================================
-- ERO ERP - BOOTSTRAP UNIFICADO DE BASE DE DATOS (NUEVOS SERVIDORES)
-- Incluye: Esquema Completo + Módulos (Restaurante, Contabilidad, Notificaciones)
--         + Triggers + Stored Procedures + Vistas + Seeds Base + Datos de Hipermercado
-- Fecha: Noviembre 2026
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `ero_erp_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_0900_ai_ci;

USE `ero_erp_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. ESQUEMA PRINCIPAL DE TABLAS (01_schema.sql)
-- -----------------------------------------------------------------------------
-- ========================================================
-- ERO ERP VE - DDL SCHEMA DEFINITIONS (MySQL 8)
-- Charset: utf8mb4, Collation: utf8mb4_0900_ai_ci, Engine: InnoDB
-- ========================================================

CREATE DATABASE IF NOT EXISTS `ero_erp_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `ero_erp_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. EMPRESAS, SUCURSALES Y DEPÓSITOS
DROP TABLE IF EXISTS `companies`;
CREATE TABLE `companies` (
  `id` CHAR(36) NOT NULL,
  `rif` VARCHAR(20) NOT NULL,
  `legal_name` VARCHAR(150) NOT NULL,
  `trade_name` VARCHAR(150) DEFAULT NULL,
  `fiscal_address` TEXT NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `is_special_taxpayer` TINYINT(1) NOT NULL DEFAULT 1, -- Contribuyente Especial SENIAT
  `iva_retention_rate` DECIMAL(5,2) NOT NULL DEFAULT 75.00, -- 75% o 100%
  `currency_base` CHAR(3) NOT NULL DEFAULT 'USD',
  `currency_secondary` CHAR(3) NOT NULL DEFAULT 'VES',
  `report_currency` VARCHAR(10) NOT NULL DEFAULT 'BOTH',
  `show_logo_in_reports` TINYINT(1) NOT NULL DEFAULT 1,
  `report_logo_type` VARCHAR(20) NOT NULL DEFAULT 'default',
  `custom_logo_url` LONGTEXT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_companies_rif` (`rif`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `exchange_rates`;
CREATE TABLE `exchange_rates` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `rate` DECIMAL(14,4) NOT NULL,
  `currency_base` CHAR(3) NOT NULL DEFAULT 'USD',
  `currency_secondary` CHAR(3) NOT NULL DEFAULT 'VES',
  `effective_date` DATE NOT NULL,
  `source` VARCHAR(100) NOT NULL DEFAULT 'Banco Central de Venezuela (BCV)',
  `user_id` CHAR(36) DEFAULT NULL,
  `created_by_name` VARCHAR(150) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_exchange_rates_company_date` (`company_id`, `effective_date`, `created_at`),
  CONSTRAINT `fk_exchange_rates_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `is_main` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_branches_company_code` (`company_id`, `code`),
  CONSTRAINT `fk_branches_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `warehouses`;
CREATE TABLE `warehouses` (
  `id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `is_default_sales` TINYINT(1) NOT NULL DEFAULT 0,
  `is_default_purchases` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_warehouses_branch_code` (`branch_id`, `code`),
  CONSTRAINT `fk_warehouses_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. SEGURIDAD, RBAC Y USUARIOS
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roles_company_name` (`company_id`, `name`),
  CONSTRAINT `fk_roles_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` CHAR(36) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permissions_module_action` (`module`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `role_id` CHAR(36) NOT NULL,
  `permission_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `role_id` CHAR(36) NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `is_2fa_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `two_factor_secret` VARCHAR(100) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `all_branches` TINYINT(1) NOT NULL DEFAULT 1,
  `can_switch_warehouses` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `idx_users_company_role` (`company_id`, `role_id`),
  CONSTRAINT `fk_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `user_branches`;
CREATE TABLE `user_branches` (
  `user_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`, `branch_id`),
  CONSTRAINT `fk_ub_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ub_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `user_warehouses`;
CREATE TABLE `user_warehouses` (
  `user_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`, `warehouse_id`),
  CONSTRAINT `fk_uw_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uw_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. JERARQUÍA DE CLASIFICACIÓN DE PRODUCTOS (NUEVO)
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_departments_company_code` (`company_id`, `code`),
  KEY `idx_departments_company_active` (`company_id`, `is_active`),
  CONSTRAINT `fk_departments_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups` (
  `id` CHAR(36) NOT NULL,
  `department_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_groups_dept_code` (`department_id`, `code`),
  KEY `idx_groups_department` (`department_id`, `is_active`),
  CONSTRAINT `fk_groups_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `subgroups`;
CREATE TABLE `subgroups` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_subgroups_group_code` (`group_id`, `code`),
  KEY `idx_subgroups_group` (`group_id`, `is_active`),
  CONSTRAINT `fk_subgroups_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. TASAS DE IMPUESTOS Y REGLAS TRIBUTARIAS
DROP TABLE IF EXISTS `tax_rates`;
CREATE TABLE `tax_rates` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL, -- IVA_GEN, IVA_RED, IGTF_DIV, EXENTO
  `name` VARCHAR(100) NOT NULL,
  `rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  `type` ENUM('IVA', 'IGTF', 'ISLR', 'MUNICIPAL', 'EXENTO', 'EXONERADO') NOT NULL DEFAULT 'IVA',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `valid_from` DATETIME DEFAULT NULL,
  `valid_to` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tax_rates_company_code` (`company_id`, `code`),
  CONSTRAINT `fk_tax_rates_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. CATÁLOGO DE PRODUCTOS
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `rif` VARCHAR(20) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `commercial_name` VARCHAR(150) DEFAULT NULL,
  `fiscal_address` TEXT DEFAULT NULL,
  `contact_name` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `is_person_natural` TINYINT(1) NOT NULL DEFAULT 0,
  `is_resident` TINYINT(1) NOT NULL DEFAULT 1,
  `islr_concept_code` VARCHAR(20) DEFAULT NULL,
  `credit_limit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payment_terms_days` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_suppliers_company_rif` (`company_id`, `rif`),
  CONSTRAINT `fk_suppliers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `supplier_products`;
CREATE TABLE `supplier_products` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `supplier_product_code` VARCHAR(60) DEFAULT NULL,
  `cost_price_usd` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `delivery_lead_time_days` INT NOT NULL DEFAULT 0,
  `is_preferred` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_supplier_product` (`supplier_id`, `product_id`),
  KEY `idx_sp_product` (`product_id`),
  KEY `idx_sp_company` (`company_id`),
  CONSTRAINT `fk_sp_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sp_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sp_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5.1 MARCAS DE PRODUCTOS
DROP TABLE IF EXISTS `brands`;
CREATE TABLE `brands` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_brands_company_name` (`company_id`, `name`),
  KEY `idx_brands_company_active` (`company_id`, `is_active`),
  CONSTRAINT `fk_brands_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5.2 UNIDADES DE MEDIDA
DROP TABLE IF EXISTS `units_of_measure`;
CREATE TABLE `units_of_measure` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `symbol` VARCHAR(10) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uom_company_code` (`company_id`, `code`),
  KEY `idx_uom_company_active` (`company_id`, `is_active`),
  CONSTRAINT `fk_uom_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5.3 PLANTILLAS DE PRESENTACIONES DE PRODUCTOS
DROP TABLE IF EXISTS `presentations`;
CREATE TABLE `presentations` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `default_multiplier` DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
  `default_unit` VARCHAR(20) NOT NULL DEFAULT 'UND',
  `requires_authorization` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_presentations_company_name` (`company_id`, `name`),
  KEY `idx_presentations_company_active` (`company_id`, `is_active`),
  CONSTRAINT `fk_presentations_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `sku` VARCHAR(50) NOT NULL,
  `barcode` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `product_type` ENUM('physical', 'service', 'kit', 'raw_material') NOT NULL DEFAULT 'physical',
  `tracks_inventory` TINYINT(1) NOT NULL DEFAULT 1,
  
  -- Relaciones de Jerarquía
  `department_id` CHAR(36) DEFAULT NULL,
  `group_id` CHAR(36) DEFAULT NULL,
  `subgroup_id` CHAR(36) DEFAULT NULL,
  
  `supplier_id` CHAR(36) DEFAULT NULL,
  `brand` VARCHAR(60) DEFAULT NULL,
  `unit_of_measure` VARCHAR(10) NOT NULL DEFAULT 'UND',
  
  -- Precios Base y Costo
  `cost_price` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `base_price` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  
  -- Reglas Tributarias
  `default_tax_rate_id` CHAR(36) DEFAULT NULL,
  `tax_inclusive` TINYINT(1) NOT NULL DEFAULT 0, -- true: el precio base ya incluye IVA
  
  -- Control de Stock
  `min_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `max_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `has_batches` TINYINT(1) NOT NULL DEFAULT 0,
  `has_serials` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_company_sku` (`company_id`, `sku`),
  KEY `idx_products_barcode` (`company_id`, `barcode`),
  KEY `idx_products_hierarchy` (`department_id`, `group_id`, `subgroup_id`),
  FULLTEXT KEY `ft_products_name_desc` (`name`, `description`),
  CONSTRAINT `fk_products_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_products_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_products_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_products_subgroup` FOREIGN KEY (`subgroup_id`) REFERENCES `subgroups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_products_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_products_tax_rate` FOREIGN KEY (`default_tax_rate_id`) REFERENCES `tax_rates` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5.4 MÚLTIPLES SKUS Y CÓDIGOS POR PRODUCTO
DROP TABLE IF EXISTS `product_skus`;
CREATE TABLE `product_skus` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `sku` VARCHAR(50) NOT NULL,
  `barcode` VARCHAR(50) DEFAULT NULL,
  `description` VARCHAR(150) DEFAULT NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `cost_price` DECIMAL(14,4) DEFAULT NULL,
  `price` DECIMAL(14,4) DEFAULT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_skus_sku` (`product_id`, `sku`),
  KEY `idx_ps_product_id` (`product_id`),
  KEY `idx_ps_sku` (`sku`),
  KEY `idx_ps_barcode` (`barcode`),
  CONSTRAINT `fk_product_skus_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5.5 PRESENTACIONES Y EMPAQUES CON PRECIOS DIFERENCIADOS POR PRODUCTO
DROP TABLE IF EXISTS `product_presentations`;
CREATE TABLE `product_presentations` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `presentation_id` CHAR(36) DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `sku` VARCHAR(50) DEFAULT NULL,
  `barcode` VARCHAR(50) DEFAULT NULL,
  `unit_of_measure` VARCHAR(20) NOT NULL DEFAULT 'UND',
  `multiplier` DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
  `cost_price` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `base_price` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `requires_authorization` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pp_product_id` (`product_id`),
  KEY `idx_pp_sku` (`sku`),
  KEY `idx_pp_barcode` (`barcode`),
  CONSTRAINT `fk_pp_product_link` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pp_presentation` FOREIGN KEY (`presentation_id`) REFERENCES `presentations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. UBICACIÓN FÍSICA OPCIONAL DEL PRODUCTO EN DEPÓSITOS (NUEVO)
DROP TABLE IF EXISTS `product_locations`;
CREATE TABLE `product_locations` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) DEFAULT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `aisle` VARCHAR(30) DEFAULT NULL,       -- Pasillo
  `shelf` VARCHAR(30) DEFAULT NULL,       -- Estante
  `compartment` VARCHAR(30) DEFAULT NULL, -- Compartimiento / Gaveta
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_warehouse_location` (`product_id`, `warehouse_id`),
  KEY `idx_locations_search` (`warehouse_id`, `aisle`, `shelf`, `compartment`),
  CONSTRAINT `fk_pl_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pl_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. STOCK Y MOVIMIENTOS KARDEX
DROP TABLE IF EXISTS `product_stocks`;
CREATE TABLE `product_stocks` (
  `product_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `current_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reserved_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `available_stock` DECIMAL(12,2) GENERATED ALWAYS AS (`current_stock` - `reserved_stock`) STORED,
  `last_movement_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`product_id`, `warehouse_id`),
  KEY `idx_stock_warehouse` (`warehouse_id`, `current_stock`),
  CONSTRAINT `fk_ps_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ps_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7.1 CONTROL DE LOTES Y VENCIMIENTOS DE PRODUCTOS
DROP TABLE IF EXISTS `product_lots`;
CREATE TABLE `product_lots` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `lot_number` VARCHAR(50) NOT NULL,
  `manufacturing_date` DATE DEFAULT NULL,
  `expiration_date` DATE NOT NULL,
  `initial_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `current_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reserved_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cost_price` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `status` ENUM('ACTIVE', 'EXPIRED', 'DEPLETED', 'QUARANTINE') NOT NULL DEFAULT 'ACTIVE',
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_warehouse_lot` (`product_id`, `warehouse_id`, `lot_number`),
  KEY `idx_lots_product` (`product_id`),
  KEY `idx_lots_warehouse` (`warehouse_id`),
  KEY `idx_lots_expiration` (`expiration_date`, `status`),
  KEY `idx_lots_company` (`company_id`),
  CONSTRAINT `fk_plot_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plot_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plot_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `inventory_movements`;
CREATE TABLE `inventory_movements` (
  `id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `movement_type` ENUM('IN', 'OUT', 'ADJUST_IN', 'ADJUST_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE', 'PURCHASE') NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `total_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `previous_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `new_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reference_document` VARCHAR(50) DEFAULT NULL,
  `reason` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_movements_prod_wh_date` (`product_id`, `warehouse_id`, `created_at`),
  KEY `idx_movements_branch_date` (`branch_id`, `created_at`),
  CONSTRAINT `fk_im_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_im_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_im_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_im_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7.1 AJUSTES DE INVENTARIO (MERMA, VENCIDO, SOBRANTE, CONTEO FÍSICO)
DROP TABLE IF EXISTS `inventory_adjustment_items`;
DROP TABLE IF EXISTS `inventory_adjustments`;
CREATE TABLE `inventory_adjustments` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `adjustment_number` VARCHAR(30) NOT NULL,
  `type` ENUM('PHYSICAL_COUNT', 'DAMAGE_SPOILED', 'THEFT_LOSS', 'EXPIRED', 'FOUND_SURPLUS', 'INTERNAL_CONSUMPTION') NOT NULL,
  `adjustment_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_cost_impact` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `reason` TEXT NOT NULL,
  `status` ENUM('APPLIED', 'ANNULLED') NOT NULL DEFAULT 'APPLIED',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_adj_company_number` (`company_id`, `adjustment_number`),
  KEY `idx_adj_wh_date` (`warehouse_id`, `adjustment_date`),
  CONSTRAINT `fk_adj_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_adj_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_adj_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_adj_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inventory_adjustment_items` (
  `id` CHAR(36) NOT NULL,
  `adjustment_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `movement_type` ENUM('ADJUST_IN', 'ADJUST_OUT') NOT NULL,
  `previous_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `quantity` DECIMAL(12,2) NOT NULL,
  `new_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `unit_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `total_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `notes` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_adj_items_adj` (`adjustment_id`),
  CONSTRAINT `fk_adji_adjustment` FOREIGN KEY (`adjustment_id`) REFERENCES `inventory_adjustments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_adji_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7.2 TRASLADOS ENTRE DEPÓSITOS Y SUCURSALES (EN TRÁNSITO / RECEPCIÓN)
DROP TABLE IF EXISTS `inventory_transfer_items`;
DROP TABLE IF EXISTS `inventory_transfers`;
CREATE TABLE `inventory_transfers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `transfer_number` VARCHAR(30) NOT NULL,
  `origin_branch_id` CHAR(36) NOT NULL,
  `origin_warehouse_id` CHAR(36) NOT NULL,
  `destination_branch_id` CHAR(36) NOT NULL,
  `destination_warehouse_id` CHAR(36) NOT NULL,
  `status` ENUM('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'IN_TRANSIT',
  `total_items` INT NOT NULL DEFAULT 0,
  `total_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `shipped_by_user_id` CHAR(36) NOT NULL,
  `shipped_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `received_by_user_id` CHAR(36) DEFAULT NULL,
  `received_at` DATETIME DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_transfer_company_number` (`company_id`, `transfer_number`),
  KEY `idx_transfers_origin` (`origin_warehouse_id`, `status`),
  KEY `idx_transfers_destination` (`destination_warehouse_id`, `status`),
  CONSTRAINT `fk_tr_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tr_orig_branch` FOREIGN KEY (`origin_branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tr_orig_wh` FOREIGN KEY (`origin_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tr_dest_branch` FOREIGN KEY (`destination_branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tr_dest_wh` FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tr_ship_user` FOREIGN KEY (`shipped_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tr_recv_user` FOREIGN KEY (`received_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inventory_transfer_items` (
  `id` CHAR(36) NOT NULL,
  `transfer_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity_sent` DECIMAL(12,2) NOT NULL,
  `quantity_received` DECIMAL(12,2) DEFAULT NULL,
  `unit_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `notes` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tr_items_transfer` (`transfer_id`),
  CONSTRAINT `fk_tri_transfer` FOREIGN KEY (`transfer_id`) REFERENCES `inventory_transfers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. GESTIÓN AVANZADA DE PRECIOS E IMPUESTOS (NUEVO)
DROP TABLE IF EXISTS `price_lists`;
CREATE TABLE `price_lists` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_price_lists_company_code` (`company_id`, `code`),
  CONSTRAINT `fk_price_lists_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `product_prices`;
CREATE TABLE `product_prices` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `price_list_id` CHAR(36) NOT NULL,
  `price` DECIMAL(14,4) NOT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `valid_from` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `valid_to` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_price_list` (`product_id`, `price_list_id`),
  CONSTRAINT `fk_pp_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pp_price_list` FOREIGN KEY (`price_list_id`) REFERENCES `price_lists` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `price_change_batches`;
CREATE TABLE `price_change_batches` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `batch_number` VARCHAR(30) NOT NULL,
  `mode` VARCHAR(30) NOT NULL, -- percentage, fixed_amount, absolute, margin
  `mode_value` DECIMAL(10,4) NOT NULL,
  `rounding_rule` DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  `tax_affects_final_price` TINYINT(1) NOT NULL DEFAULT 0,
  `price_mode` VARCHAR(20) NOT NULL DEFAULT 'tax_exclusive',
  `criteria_json` JSON NOT NULL,
  `affected_products_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPLIED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `approved_by` CHAR(36) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `scheduled_for` DATETIME DEFAULT NULL,
  `applied_at` DATETIME DEFAULT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pcb_batch_number` (`company_id`, `batch_number`),
  CONSTRAINT `fk_pcb_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pcb_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pcb_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `price_change_items`;
CREATE TABLE `price_change_items` (
  `id` CHAR(36) NOT NULL,
  `batch_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `cost_price` DECIMAL(14,4) NOT NULL,
  `old_base_price` DECIMAL(14,4) NOT NULL,
  `new_base_price` DECIMAL(14,4) NOT NULL,
  `old_final_price` DECIMAL(14,4) NOT NULL,
  `new_final_price` DECIMAL(14,4) NOT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  PRIMARY KEY (`id`),
  KEY `idx_pci_batch` (`batch_id`),
  KEY `idx_pci_product` (`product_id`),
  CONSTRAINT `fk_pci_batch` FOREIGN KEY (`batch_id`) REFERENCES `price_change_batches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pci_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `price_history`;
CREATE TABLE `price_history` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `batch_id` CHAR(36) DEFAULT NULL,
  `old_cost` DECIMAL(14,4) NOT NULL,
  `new_cost` DECIMAL(14,4) NOT NULL,
  `old_price` DECIMAL(14,4) NOT NULL,
  `new_price` DECIMAL(14,4) NOT NULL,
  `change_type` VARCHAR(50) NOT NULL, -- BULK_UPDATE, MANUAL_EDIT, TAX_RATE_CHANGE, COST_ADJUSTMENT
  `change_reason` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ph_product_date` (`product_id`, `created_at`),
  CONSTRAINT `fk_ph_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ph_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `tax_rate_changes`;
CREATE TABLE `tax_rate_changes` (
  `id` CHAR(36) NOT NULL,
  `tax_rate_id` CHAR(36) NOT NULL,
  `old_rate` DECIMAL(5,2) NOT NULL,
  `new_rate` DECIMAL(5,2) NOT NULL,
  `affects_final_price` TINYINT(1) NOT NULL,
  `price_mode` VARCHAR(20) NOT NULL,
  `apply_scope` VARCHAR(30) NOT NULL,
  `scope_ref_id` CHAR(36) DEFAULT NULL,
  `user_id` CHAR(36) NOT NULL,
  `effective_date` DATETIME NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trc_tax_rate` (`tax_rate_id`),
  CONSTRAINT `fk_trc_tax_rate` FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rates` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_trc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 9. CLIENTES, VENTAS Y POS (PUNTO DE VENTA FISCAL)
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `doc_type` ENUM('V', 'E', 'J', 'G', 'P') NOT NULL DEFAULT 'V',
  `doc_number` VARCHAR(20) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `is_special_taxpayer` TINYINT(1) NOT NULL DEFAULT 0,
  `credit_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `credit_limit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payment_terms_days` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_blocked` TINYINT(1) NOT NULL DEFAULT 0,
  `block_reason` VARCHAR(255) DEFAULT NULL,
  `blocked_at` DATETIME DEFAULT NULL,
  `rating_score` DECIMAL(3,1) NOT NULL DEFAULT 5.0,
  `rating_tier` ENUM('VIP', 'EXCELLENT', 'REGULAR', 'RISKY', 'MOROSO') NOT NULL DEFAULT 'REGULAR',
  `rating_notes` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customers_doc` (`company_id`, `doc_type`, `doc_number`),
  CONSTRAINT `fk_customers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `sales_invoices`;
CREATE TABLE `sales_invoices` (
  `id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `quotation_id` CHAR(36) DEFAULT NULL,
  `invoice_number` VARCHAR(30) NOT NULL, -- Número de Factura o Control
  `control_number` VARCHAR(30) DEFAULT NULL, -- Control Fiscal SENIAT
  `invoice_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `invoice_mode` VARCHAR(30) NOT NULL DEFAULT 'normal_printer',
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000, -- Tasa oficial BCV
  
  -- Montos Totales
  `base_exempt_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `base_taxable_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `igtf_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  
  `is_credit` TINYINT(1) NOT NULL DEFAULT 0,
  `shift_id` CHAR(36) DEFAULT NULL,
  `status` ENUM('PAID', 'PENDING', 'ANNULLED') NOT NULL DEFAULT 'PAID',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_branch_invoice` (`branch_id`, `invoice_number`),
  KEY `idx_sales_branch_date` (`branch_id`, `invoice_date`),
  KEY `idx_sales_customer` (`customer_id`),
  CONSTRAINT `fk_sales_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sales_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sales_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sales_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `sales_invoice_items`;
CREATE TABLE `sales_invoice_items` (
  `id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_price` DECIMAL(14,4) NOT NULL,
  `unit_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  `discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `total` DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sii_invoice` (`invoice_id`),
  KEY `idx_sii_product` (`product_id`),
  CONSTRAINT `fk_sii_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sii_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 9.00 MEDIOS Y FORMAS DE PAGO (CONFIGURABLES)
DROP TABLE IF EXISTS `payment_methods`;
CREATE TABLE `payment_methods` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'VES',
  `type` ENUM('CASH', 'CARD', 'ELECTRONIC', 'CREDIT', 'OTHER') NOT NULL DEFAULT 'OTHER',
  `applies_igtf` TINYINT(1) NOT NULL DEFAULT 0,
  `requires_reference` TINYINT(1) NOT NULL DEFAULT 0,
  `requires_bank_account` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pm_code` (`company_id`, `code`),
  CONSTRAINT `fk_pm_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `sales_payments`;
CREATE TABLE `sales_payments` (
  `id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `method` VARCHAR(30) NOT NULL, -- CASH_VES, CASH_USD, PAGO_MOVIL, DEBIT_CARD, ZELLE, CRYPTO, CREDIT
  `amount_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `amount_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `exchange_rate` DECIMAL(14,4) NOT NULL,
  `applies_igtf` TINYINT(1) NOT NULL DEFAULT 0,
  `igtf_amount_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `igtf_amount_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `reference_number` VARCHAR(50) DEFAULT NULL,
  `bank_account_id` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sp_invoice` (`invoice_id`),
  KEY `idx_sp_bank_account` (`bank_account_id`),
  CONSTRAINT `fk_sp_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sp_bank_account` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 9.01 COTIZACIONES Y NOTAS DE ENTREGA (DESPACHOS)
DROP TABLE IF EXISTS `delivery_note_items`;
DROP TABLE IF EXISTS `delivery_notes`;
DROP TABLE IF EXISTS `sales_quotation_items`;
DROP TABLE IF EXISTS `sales_quotations`;

CREATE TABLE `sales_quotations` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `quotation_number` VARCHAR(30) NOT NULL,
  `quotation_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `valid_until_date` DATE NOT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `subtotal_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('DRAFT', 'EMITTED', 'ACCEPTED', 'EXPIRED', 'REJECTED', 'CONVERTED') NOT NULL DEFAULT 'EMITTED',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sq_branch_number` (`branch_id`, `quotation_number`),
  KEY `idx_sq_customer` (`customer_id`),
  KEY `idx_sq_branch_date` (`branch_id`, `quotation_date`),
  CONSTRAINT `fk_sq_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sq_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sq_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sq_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `sales_quotation_items` (
  `id` CHAR(36) NOT NULL,
  `quotation_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_price` DECIMAL(14,4) NOT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  `discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `total` DECIMAL(14,2) NOT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sqi_quotation` (`quotation_id`),
  KEY `idx_sqi_product` (`product_id`),
  CONSTRAINT `fk_sqi_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `sales_quotations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sqi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `delivery_notes` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `quotation_id` CHAR(36) DEFAULT NULL,
  `user_id` CHAR(36) NOT NULL,
  `delivery_number` VARCHAR(30) NOT NULL,
  `delivery_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `driver_name` VARCHAR(100) DEFAULT NULL,
  `vehicle_plate` VARCHAR(20) DEFAULT NULL,
  `status` ENUM('DELIVERED', 'INVOICED', 'ANNULLED') NOT NULL DEFAULT 'DELIVERED',
  `sales_invoice_id` CHAR(36) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dn_branch_number` (`branch_id`, `delivery_number`),
  KEY `idx_dn_wh_date` (`warehouse_id`, `delivery_date`),
  KEY `idx_dn_customer` (`customer_id`),
  CONSTRAINT `fk_dn_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_dn_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_dn_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_dn_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_dn_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `sales_quotations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dn_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_dn_invoice` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `delivery_note_items` (
  `id` CHAR(36) NOT NULL,
  `delivery_note_id` CHAR(36) NOT NULL,
  `quotation_item_id` CHAR(36) DEFAULT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity_delivered` DECIMAL(12,2) NOT NULL,
  `unit_price` DECIMAL(14,4) NOT NULL,
  `unit_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `total` DECIMAL(14,2) NOT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dni_delivery` (`delivery_note_id`),
  KEY `idx_dni_product` (`product_id`),
  CONSTRAINT `fk_dni_delivery` FOREIGN KEY (`delivery_note_id`) REFERENCES `delivery_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dni_qi` FOREIGN KEY (`quotation_item_id`) REFERENCES `sales_quotation_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dni_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 9.02 NOTAS DE CRÉDITO Y NOTAS DE DÉBITO A CLIENTES (SENIAT / CXC)
DROP TABLE IF EXISTS `customer_note_applications`;
DROP TABLE IF EXISTS `customer_note_items`;
DROP TABLE IF EXISTS `customer_notes`;

CREATE TABLE `customer_notes` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) DEFAULT NULL,
  `affected_invoice_id` CHAR(36) DEFAULT NULL,
  `type` ENUM('CREDIT', 'DEBIT') NOT NULL,
  `note_number` VARCHAR(30) NOT NULL,
  `control_number` VARCHAR(30) DEFAULT NULL,
  `issue_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date` DATE DEFAULT NULL,
  `reason_type` ENUM('RETURN', 'DISCOUNT', 'PRICE_CORRECTION', 'ANNULMENT', 'LATE_FEE', 'COLLECTION_FEE', 'PRICE_DIFFERENCE', 'OTHER') NOT NULL DEFAULT 'OTHER',
  `reason_description` TEXT NOT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `base_exempt_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `base_taxable_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `amount_applied` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `amount_balance` DECIMAL(14,2) GENERATED ALWAYS AS (`total_amount` - `amount_applied`) STORED,
  `status` ENUM('ACTIVE', 'APPLIED', 'ANNULLED') NOT NULL DEFAULT 'ACTIVE',
  `annulled_at` DATETIME DEFAULT NULL,
  `annulled_by_user_id` CHAR(36) DEFAULT NULL,
  `annulment_reason` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cnot_branch_type_number` (`branch_id`, `type`, `note_number`),
  KEY `idx_cnot_customer` (`customer_id`),
  KEY `idx_cnot_invoice` (`affected_invoice_id`),
  KEY `idx_cnot_branch_date` (`branch_id`, `issue_date`),
  CONSTRAINT `fk_cnot_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cnot_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cnot_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cnot_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cnot_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cnot_invoice` FOREIGN KEY (`affected_invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `customer_note_items` (
  `id` CHAR(36) NOT NULL,
  `note_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) DEFAULT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  `unit_price` DECIMAL(14,4) NOT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `return_to_inventory` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_cnoti_note` (`note_id`),
  KEY `idx_cnoti_product` (`product_id`),
  CONSTRAINT `fk_cnoti_note` FOREIGN KEY (`note_id`) REFERENCES `customer_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cnoti_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `customer_note_applications` (
  `id` CHAR(36) NOT NULL,
  `note_id` CHAR(36) NOT NULL,
  `receivable_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `amount_applied` DECIMAL(14,2) NOT NULL,
  `applied_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cna_note` (`note_id`),
  KEY `idx_cna_rec` (`receivable_id`),
  CONSTRAINT `fk_cna_note` FOREIGN KEY (`note_id`) REFERENCES `customer_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cna_rec` FOREIGN KEY (`receivable_id`) REFERENCES `receivables` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cna_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- 9.1 CAJAS, TURNOS Y REPORTES FISCALES SENIAT
DROP TABLE IF EXISTS `cash_registers`;
CREATE TABLE `cash_registers` (
  `id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL, -- ej: 'CAJA-01'
  `name` VARCHAR(100) NOT NULL, -- ej: 'Caja Principal Piso de Venta'
  `fiscal_printer_serial` VARCHAR(50) DEFAULT NULL, -- ej: 'Z5A1234567'
  `invoice_mode` VARCHAR(30) NOT NULL DEFAULT 'normal_printer',
  `ticket_printer_type` VARCHAR(50) NOT NULL DEFAULT 'thermal_80mm',
  `ticket_printer_name` VARCHAR(100) DEFAULT NULL,
  `ticket_print_mode` VARCHAR(20) NOT NULL DEFAULT 'prompt',
  `accepts_orders` TINYINT(1) NOT NULL DEFAULT 1,
  `warehouse_id` CHAR(36) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cr_branch_code` (`branch_id`, `code`),
  CONSTRAINT `fk_cr_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cr_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `cash_register_departments`;
CREATE TABLE `cash_register_departments` (
  `cash_register_id` CHAR(36) NOT NULL,
  `department_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`cash_register_id`, `department_id`),
  CONSTRAINT `fk_crd_cash_register` FOREIGN KEY (`cash_register_id`) REFERENCES `cash_registers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_crd_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `cash_shifts`;
CREATE TABLE `cash_shifts` (
  `id` CHAR(36) NOT NULL,
  `cash_register_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` DATETIME DEFAULT NULL,
  `initial_cash_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `initial_cash_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `final_cash_usd_expected` DECIMAL(14,2) DEFAULT 0.00,
  `final_cash_ves_expected` DECIMAL(14,2) DEFAULT 0.00,
  `final_cash_usd_counted` DECIMAL(14,2) DEFAULT 0.00,
  `final_cash_ves_counted` DECIMAL(14,2) DEFAULT 0.00,
  `difference_usd` DECIMAL(14,2) DEFAULT 0.00,
  `difference_ves` DECIMAL(14,2) DEFAULT 0.00,
  `has_discrepancy` TINYINT(1) NOT NULL DEFAULT 0,
  `audit_report_text` TEXT DEFAULT NULL,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `verification_status` ENUM('PENDING', 'VERIFIED', 'DEPOSITED') NOT NULL DEFAULT 'PENDING',
  `verified_by_user_id` CHAR(36) DEFAULT NULL,
  `verified_at` DATETIME DEFAULT NULL,
  `verification_notes` TEXT DEFAULT NULL,
  `deposit_bank_account_ves_id` CHAR(36) DEFAULT NULL,
  `deposit_amount_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `deposit_reference_ves` VARCHAR(60) DEFAULT NULL,
  `deposit_bank_account_usd_id` CHAR(36) DEFAULT NULL,
  `deposit_amount_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `deposit_reference_usd` VARCHAR(60) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cs_register_status` (`cash_register_id`, `status`),
  KEY `idx_cs_branch_date` (`branch_id`, `opened_at`),
  KEY `idx_cs_verification` (`branch_id`, `verification_status`),
  CONSTRAINT `fk_cs_register` FOREIGN KEY (`cash_register_id`) REFERENCES `cash_registers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cs_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `cash_shift_deposits`;
CREATE TABLE `cash_shift_deposits` (
  `id` CHAR(36) NOT NULL,
  `shift_id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `bank_account_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `deposit_type` ENUM('CASH_VES', 'CASH_USD', 'POS_BATCH', 'PAGO_MOVIL', 'TRANSFER', 'ZELLE', 'OTHER') NOT NULL,
  `amount` DECIMAL(16,2) NOT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL,
  `deposit_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reference_number` VARCHAR(60) NOT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `bank_movement_id` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_csd_shift` (`shift_id`),
  KEY `idx_csd_account` (`bank_account_id`),
  CONSTRAINT `fk_csd_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_csd_account` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_csd_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `cash_audit_notifications`;
CREATE TABLE `cash_audit_notifications` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `shift_id` CHAR(36) NOT NULL,
  `cash_register_id` CHAR(36) NOT NULL,
  `cashier_user_id` CHAR(36) NOT NULL,
  `discrepancy_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `discrepancy_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `is_resolved` TINYINT(1) NOT NULL DEFAULT 0,
  `resolved_by_user_id` CHAR(36) DEFAULT NULL,
  `resolved_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_can_company_date` (`company_id`, `created_at`),
  KEY `idx_can_shift` (`shift_id`),
  CONSTRAINT `fk_can_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_can_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `cash_movements`;
CREATE TABLE `cash_movements` (
  `id` CHAR(36) NOT NULL,
  `shift_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `type` ENUM('INFLOW', 'OUTFLOW') NOT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cm_shift` (`shift_id`),
  CONSTRAINT `fk_cm_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `fiscal_reports`;
CREATE TABLE `fiscal_reports` (
  `id` CHAR(36) NOT NULL,
  `cash_register_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `shift_id` CHAR(36) DEFAULT NULL,
  `user_id` CHAR(36) NOT NULL,
  `report_type` ENUM('X', 'Z') NOT NULL,
  `z_number` INT DEFAULT NULL,
  `report_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `first_invoice_number` VARCHAR(30) DEFAULT NULL,
  `last_invoice_number` VARCHAR(30) DEFAULT NULL,
  `invoices_count` INT NOT NULL DEFAULT 0,
  `base_exempt_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `base_taxable_general` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_general_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `base_taxable_reduced` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_reduced_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `igtf_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_sales_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `raw_content` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fr_register_type` (`cash_register_id`, `report_type`),
  KEY `idx_fr_branch_date` (`branch_id`, `report_date`),
  CONSTRAINT `fk_fr_register` FOREIGN KEY (`cash_register_id`) REFERENCES `cash_registers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_fr_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_fr_shift` FOREIGN KEY (`shift_id`) REFERENCES `cash_shifts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 10. CUENTAS POR COBRAR (CxC) Y CUENTAS POR PAGAR (CxP)
DROP TABLE IF EXISTS `receivables`;
CREATE TABLE `receivables` (
  `id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) DEFAULT NULL,
  `debit_note_id` CHAR(36) DEFAULT NULL,
  `document_type` ENUM('INVOICE', 'DEBIT_NOTE') NOT NULL DEFAULT 'INVOICE',
  `amount_total` DECIMAL(14,2) NOT NULL,
  `amount_paid` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `amount_balance` DECIMAL(14,2) GENERATED ALWAYS AS (`amount_total` - `amount_paid`) STORED,
  `due_date` DATE NOT NULL,
  `status` ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rec_customer_status` (`customer_id`, `status`),
  KEY `idx_rec_due_date` (`due_date`),
  KEY `idx_rec_debit_note` (`debit_note_id`),
  CONSTRAINT `fk_rec_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rec_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rec_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rec_debit_note` FOREIGN KEY (`debit_note_id`) REFERENCES `customer_notes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `purchase_invoices`;
CREATE TABLE `purchase_invoices` (
  `id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `invoice_number` VARCHAR(30) NOT NULL,
  `control_number` VARCHAR(30) DEFAULT NULL,
  `invoice_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `base_exempt_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `base_taxable_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `igtf_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `is_credit` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('PAID', 'PENDING', 'ANNULLED') NOT NULL DEFAULT 'PENDING',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_purchase_supplier_invoice` (`supplier_id`, `invoice_number`),
  KEY `idx_purchase_branch_date` (`branch_id`, `invoice_date`),
  KEY `idx_purchase_supplier` (`supplier_id`),
  CONSTRAINT `fk_purchase_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_purchase_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_purchase_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_purchase_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `purchase_invoice_items`;
CREATE TABLE `purchase_invoice_items` (
  `id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `unit_price` DECIMAL(14,4) NOT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  `discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `total` DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pii_invoice` (`invoice_id`),
  KEY `idx_pii_product` (`product_id`),
  CONSTRAINT `fk_pii_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pii_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `payables`;
CREATE TABLE `payables` (
  `id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `amount_total` DECIMAL(14,2) NOT NULL,
  `amount_paid` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `amount_balance` DECIMAL(14,2) GENERATED ALWAYS AS (`amount_total` - `amount_paid`) STORED,
  `due_date` DATE NOT NULL,
  `status` ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pay_supplier_status` (`supplier_id`, `status`),
  KEY `idx_pay_due_date` (`due_date`),
  CONSTRAINT `fk_pay_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pay_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pay_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `purchase_payments`;
CREATE TABLE `purchase_payments` (
  `id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `payable_id` CHAR(36) DEFAULT NULL,
  `method` VARCHAR(30) NOT NULL,
  `amount_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `amount_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `exchange_rate` DECIMAL(14,4) NOT NULL,
  `reference_number` VARCHAR(50) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pp_invoice` (`invoice_id`),
  KEY `idx_pp_payable` (`payable_id`),
  CONSTRAINT `fk_pp_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pp_payable` FOREIGN KEY (`payable_id`) REFERENCES `payables` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 10.0.1 NOTAS DE CRÉDITO Y DÉBITO A PROVEEDORES
DROP TABLE IF EXISTS `supplier_note_applications`;
DROP TABLE IF EXISTS `supplier_note_items`;
DROP TABLE IF EXISTS `supplier_notes`;

CREATE TABLE `supplier_notes` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) DEFAULT NULL,
  `affected_invoice_id` CHAR(36) DEFAULT NULL,
  `type` ENUM('CREDIT', 'DEBIT') NOT NULL,
  `note_number` VARCHAR(30) NOT NULL,
  `control_number` VARCHAR(30) DEFAULT NULL,
  `note_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `subtotal_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `available_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `reason_type` ENUM('RETURN', 'DISCOUNT', 'PRICE_CORRECTION', 'FREIGHT_SURCHARGE', 'LATE_FEE', 'OTHER') NOT NULL DEFAULT 'OTHER',
  `reason_description` TEXT DEFAULT NULL,
  `status` ENUM('ACTIVE', 'APPLIED', 'ANNULLED') NOT NULL DEFAULT 'ACTIVE',
  `annulled_at` DATETIME DEFAULT NULL,
  `annulled_by` CHAR(36) DEFAULT NULL,
  `annul_reason` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sn_company_branch` (`company_id`, `branch_id`),
  KEY `idx_sn_supplier` (`supplier_id`),
  KEY `idx_sn_type_status` (`type`, `status`),
  KEY `idx_sn_affected_inv` (`affected_invoice_id`),
  CONSTRAINT `fk_sn_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sn_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sn_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sn_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_note_items` (
  `id` CHAR(36) NOT NULL,
  `note_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) DEFAULT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  `unit_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `return_from_inventory` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_sni_note` (`note_id`),
  KEY `idx_sni_product` (`product_id`),
  CONSTRAINT `fk_sni_note` FOREIGN KEY (`note_id`) REFERENCES `supplier_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sni_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_note_applications` (
  `id` CHAR(36) NOT NULL,
  `note_id` CHAR(36) NOT NULL,
  `payable_id` CHAR(36) NOT NULL,
  `amount_applied` DECIMAL(14,2) NOT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_by` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sna_note` (`note_id`),
  KEY `idx_sna_payable` (`payable_id`),
  CONSTRAINT `fk_sna_note` FOREIGN KEY (`note_id`) REFERENCES `supplier_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sna_payable` FOREIGN KEY (`payable_id`) REFERENCES `payables` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sna_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 10.1 ÓRDENES DE COMPRA Y RECEPCIÓN DE MERCANCÍAS (GOODS RECEIPTS)
DROP TABLE IF EXISTS `goods_receipt_items`;
DROP TABLE IF EXISTS `goods_receipts`;
DROP TABLE IF EXISTS `purchase_order_items`;
DROP TABLE IF EXISTS `purchase_orders`;

CREATE TABLE `purchase_orders` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `order_number` VARCHAR(30) NOT NULL,
  `order_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expected_delivery_date` DATE DEFAULT NULL,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `subtotal_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_po_branch_number` (`branch_id`, `order_number`),
  KEY `idx_po_supplier_status` (`supplier_id`, `status`),
  KEY `idx_po_branch_date` (`branch_id`, `order_date`),
  CONSTRAINT `fk_po_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_po_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_po_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `purchase_order_items` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity_ordered` DECIMAL(12,2) NOT NULL,
  `quantity_received` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `unit_cost` DECIMAL(14,4) NOT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `total` DECIMAL(14,2) NOT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_poi_order` (`order_id`),
  KEY `idx_poi_product` (`product_id`),
  CONSTRAINT `fk_poi_order` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_poi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `goods_receipts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `purchase_order_id` CHAR(36) DEFAULT NULL,
  `user_id` CHAR(36) NOT NULL,
  `receipt_number` VARCHAR(30) NOT NULL,
  `supplier_delivery_note` VARCHAR(50) DEFAULT NULL,
  `receipt_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'USD',
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `total_cost` DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
  `status` ENUM('RECEIVED', 'INVOICED', 'ANNULLED') NOT NULL DEFAULT 'RECEIVED',
  `purchase_invoice_id` CHAR(36) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_gr_branch_number` (`branch_id`, `receipt_number`),
  KEY `idx_gr_wh_date` (`warehouse_id`, `receipt_date`),
  KEY `idx_gr_order` (`purchase_order_id`),
  CONSTRAINT `fk_gr_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_gr_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_gr_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_gr_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_gr_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_gr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_gr_invoice` FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `goods_receipt_items` (
  `id` CHAR(36) NOT NULL,
  `receipt_id` CHAR(36) NOT NULL,
  `purchase_order_item_id` CHAR(36) DEFAULT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity_received` DECIMAL(12,2) NOT NULL,
  `unit_cost` DECIMAL(14,4) NOT NULL,
  `total_cost` DECIMAL(14,4) NOT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gri_receipt` (`receipt_id`),
  KEY `idx_gri_product` (`product_id`),
  CONSTRAINT `fk_gri_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `goods_receipts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gri_poi` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_gri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 11. TESORERÍA, BANCOS Y CONCILIACIÓN BANCARIA
DROP TABLE IF EXISTS `banks`;
CREATE TABLE `banks` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(10) NOT NULL, -- Ej: 0102 (Venezuela), 0134 (Banesco), 0105 (Mercantil)
  `name` VARCHAR(100) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_banks_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `bank_accounts`;
CREATE TABLE `bank_accounts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `bank_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) DEFAULT NULL,
  `account_number` VARCHAR(30) NOT NULL, -- 20 dígitos estándar bancario venezolano
  `account_type` ENUM('CURRENT', 'SAVINGS', 'CUSTODY_USD') NOT NULL DEFAULT 'CURRENT',
  `currency` ENUM('USD', 'VES') NOT NULL DEFAULT 'VES',
  `description` VARCHAR(100) NOT NULL,
  `current_balance` DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bank_account_num` (`company_id`, `account_number`),
  CONSTRAINT `fk_ba_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ba_bank` FOREIGN KEY (`bank_id`) REFERENCES `banks` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ba_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `bank_movements`;
CREATE TABLE `bank_movements` (
  `id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `movement_type` ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'CHECK', 'FEE', 'TAX_DEBIT') NOT NULL,
  `amount` DECIMAL(16,2) NOT NULL,
  `balance_after` DECIMAL(16,2) NOT NULL,
  `movement_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reference_number` VARCHAR(60) DEFAULT NULL,
  `concept` VARCHAR(255) NOT NULL,
  `destination_account_id` CHAR(36) DEFAULT NULL,
  `is_reconciled` TINYINT(1) NOT NULL DEFAULT 0,
  `reconciliation_id` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bm_account_date` (`account_id`, `movement_date`),
  KEY `idx_bm_reference` (`reference_number`),
  CONSTRAINT `fk_bm_account` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `bank_reconciliations`;
CREATE TABLE `bank_reconciliations` (
  `id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `initial_book_balance` DECIMAL(16,2) NOT NULL,
  `final_book_balance` DECIMAL(16,2) NOT NULL,
  `bank_statement_balance` DECIMAL(16,2) NOT NULL,
  `difference` DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('IN_PROGRESS', 'RECONCILED', 'DISCREPANCY') NOT NULL DEFAULT 'IN_PROGRESS',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_br_account_period` (`account_id`, `period_start`, `period_end`),
  CONSTRAINT `fk_br_account` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_br_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 12. RETENCIONES TRIBUTARIAS SENIAT (IVA E ISLR)
DROP TABLE IF EXISTS `tax_withholdings_iva`;
CREATE TABLE `tax_withholdings_iva` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `purchase_invoice_id` CHAR(36) NOT NULL,
  `voucher_number` VARCHAR(20) NOT NULL, -- YYYYMM + 8 dígitos correlativos
  `tax_period` VARCHAR(7) NOT NULL, -- YYYY-MM
  `fortnight` ENUM('FIRST', 'SECOND') NOT NULL DEFAULT 'FIRST',
  `invoice_number` VARCHAR(30) NOT NULL,
  `control_number` VARCHAR(30) DEFAULT NULL,
  `invoice_date` DATE NOT NULL,
  `total_invoice_amount` DECIMAL(14,2) NOT NULL,
  `exempt_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `taxable_base_amount` DECIMAL(14,2) NOT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  `iva_amount` DECIMAL(14,2) NOT NULL,
  `retained_percentage` DECIMAL(5,2) NOT NULL DEFAULT 75.00,
  `iva_retained_amount` DECIMAL(14,2) NOT NULL,
  `status` ENUM('EMITTED', 'DECLARED', 'ANNULLED') NOT NULL DEFAULT 'EMITTED',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_twi_voucher` (`company_id`, `voucher_number`),
  KEY `idx_twi_supplier` (`supplier_id`),
  KEY `idx_twi_period` (`company_id`, `tax_period`),
  CONSTRAINT `fk_twi_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_twi_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_twi_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_twi_invoice` FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `tax_withholdings_islr`;
CREATE TABLE `tax_withholdings_islr` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `purchase_invoice_id` CHAR(36) NOT NULL,
  `voucher_number` VARCHAR(20) NOT NULL, -- YYYYMM + 8 dígitos correlativos
  `tax_period` VARCHAR(7) NOT NULL, -- YYYY-MM
  `concept_code` VARCHAR(20) NOT NULL,
  `concept_description` VARCHAR(255) NOT NULL,
  `person_type` ENUM('PNR', 'PNNR', 'PJD', 'PJND') NOT NULL DEFAULT 'PJD',
  `total_invoice_amount` DECIMAL(14,2) NOT NULL,
  `taxable_base_amount` DECIMAL(14,2) NOT NULL,
  `rate_percentage` DECIMAL(5,2) NOT NULL,
  `subtracting_factor` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `islr_retained_amount` DECIMAL(14,2) NOT NULL,
  `status` ENUM('EMITTED', 'DECLARED', 'ANNULLED') NOT NULL DEFAULT 'EMITTED',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_twis_voucher` (`company_id`, `voucher_number`),
  KEY `idx_twis_supplier` (`supplier_id`),
  KEY `idx_twis_period` (`company_id`, `tax_period`),
  CONSTRAINT `fk_twis_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_twis_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_twis_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_twis_invoice` FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 13. DASHBOARDS DINÁMICOS POR MÓDULO Y PERMISOS (NUEVO)
DROP TABLE IF EXISTS `dashboard_widgets`;
CREATE TABLE `dashboard_widgets` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `type` ENUM('kpi', 'chart_line', 'chart_bar', 'chart_pie', 'table', 'list', 'gauge') NOT NULL DEFAULT 'kpi',
  `config_json` JSON DEFAULT NULL,
  `default_width` INT NOT NULL DEFAULT 4,
  `default_height` INT NOT NULL DEFAULT 3,
  `required_permission` VARCHAR(100) NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_widgets_code` (`code`),
  KEY `idx_widgets_module_perm` (`module`, `required_permission`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `dashboards`;
CREATE TABLE `dashboards` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `scope` ENUM('global', 'role', 'user') NOT NULL DEFAULT 'role',
  `role_id` CHAR(36) DEFAULT NULL,
  `user_id` CHAR(36) DEFAULT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dashboards_user` (`user_id`),
  KEY `idx_dashboards_role` (`role_id`),
  CONSTRAINT `fk_dashboards_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_dashboards_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dashboards_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `dashboard_layout`;
CREATE TABLE `dashboard_layout` (
  `id` CHAR(36) NOT NULL,
  `dashboard_id` CHAR(36) NOT NULL,
  `widget_id` CHAR(36) NOT NULL,
  `pos_x` INT NOT NULL DEFAULT 0,
  `pos_y` INT NOT NULL DEFAULT 0,
  `width` INT NOT NULL DEFAULT 4,
  `height` INT NOT NULL DEFAULT 3,
  `config_override` JSON DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dl_dashboard_widget` (`dashboard_id`, `widget_id`),
  CONSTRAINT `fk_dl_dashboard` FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dl_widget` FOREIGN KEY (`widget_id`) REFERENCES `dashboard_widgets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 12. AUDITORÍA INTEGRAL (AUDIT LOGS) Y LICENCIAS
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) DEFAULT NULL,
  `user_id` CHAR(36) DEFAULT NULL,
  `module` VARCHAR(50) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `entity` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(50) DEFAULT NULL,
  `before_json` JSON DEFAULT NULL,
  `after_json` JSON DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_company_date` (`company_id`, `created_at`),
  KEY `idx_audit_module_entity` (`module`, `entity`, `entity_id`),
  KEY `idx_audit_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `licenses`;
CREATE TABLE `licenses` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `company_name` VARCHAR(255) DEFAULT NULL,
  `company_rif` VARCHAR(50) DEFAULT NULL,
  `license_key` TEXT NOT NULL,
  `type` ENUM('trial', 'temporal', 'perpetua') NOT NULL DEFAULT 'trial',
  `expires_at` DATETIME DEFAULT NULL,
  `hardware_fingerprint` VARCHAR(255) NOT NULL,
  `modules_allowed` JSON NOT NULL,
  `max_users` INT NOT NULL DEFAULT 5,
  `max_branches` INT NOT NULL DEFAULT 1,
  `has_support` TINYINT(1) NOT NULL DEFAULT 1,
  `encrypted_payload` LONGTEXT DEFAULT NULL,
  `auth_tag` VARCHAR(64) DEFAULT NULL,
  `iv` VARCHAR(64) DEFAULT NULL,
  `integrity_hash` VARCHAR(128) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_licenses_company` (`company_id`),
  CONSTRAINT `fk_licenses_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `business_rules`;
CREATE TABLE `business_rules` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) DEFAULT NULL,
  `allow_credit_sales` TINYINT(1) NOT NULL DEFAULT 1,
  `require_approval_discount` TINYINT(1) NOT NULL DEFAULT 1,
  `max_discount_allowed` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `pos_invoice_mode` ENUM('normal_printer', 'fiscal_printer', 'electronic') NOT NULL DEFAULT 'normal_printer',
  `sales_invoice_mode` ENUM('fiscal_printer', 'free_form', 'no_fiscal') NOT NULL DEFAULT 'free_form',
  `tax_affects_final_price` TINYINT(1) NOT NULL DEFAULT 1,
  `enforce_credit_limit` TINYINT(1) NOT NULL DEFAULT 1,
  `require_approval_credit_exceeded` TINYINT(1) NOT NULL DEFAULT 1,
  `allow_negative_stock` TINYINT(1) NOT NULL DEFAULT 1,
  `require_approval_negative_stock` TINYINT(1) NOT NULL DEFAULT 1,
  `retention_period_years` INT NOT NULL DEFAULT 5,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_br_company_branch` (`company_id`, `branch_id`),
  CONSTRAINT `fk_br_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `data` JSON DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT '0',
  `read_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`company_id`, `user_id`, `is_read`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `user_notification_preferences`;
CREATE TABLE `user_notification_preferences` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `notification_type` VARCHAR(50) NOT NULL,
  `in_app_enabled` TINYINT(1) NOT NULL DEFAULT '1',
  `email_enabled` TINYINT(1) NOT NULL DEFAULT '0',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_notif_pref` (`company_id`, `user_id`, `notification_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;


-- -----------------------------------------------------------------------------
-- 2. MÓDULO DE RESTAURANTE (06_restaurant.sql)
-- -----------------------------------------------------------------------------
-- ========================================================
-- ERO ERP VE - RESTAURANT & KITCHEN DISPLAY (KDS) TABLES
-- ========================================================

CREATE TABLE IF NOT EXISTS `restaurant_settings` (
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) DEFAULT NULL,
  `print_order_ticket` TINYINT(1) NOT NULL DEFAULT 1,
  `print_waiter_copy` TINYINT(1) NOT NULL DEFAULT 1,
  `print_kitchen_ticket` TINYINT(1) NOT NULL DEFAULT 1,
  `ticket_print_mode` ENUM('direct', 'prompt') NOT NULL DEFAULT 'prompt',
  `ticket_header` VARCHAR(255) DEFAULT NULL,
  `ticket_footer` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`company_id`),
  CONSTRAINT `fk_rsettings_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `restaurant_tables` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `table_number` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `zone` VARCHAR(50) NOT NULL DEFAULT 'Salón Principal',
  `capacity` INT NOT NULL DEFAULT 4,
  `status` ENUM('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED') NOT NULL DEFAULT 'AVAILABLE',
  `current_waiter_id` CHAR(36) DEFAULT NULL,
  `current_waiter_name` VARCHAR(150) DEFAULT NULL,
  `active_order_id` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_restaurant_tables_branch` (`branch_id`, `status`),
  CONSTRAINT `fk_rtables_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rtables_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `restaurant_preset_notes` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  `note_text` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_preset_notes_company` (`company_id`, `category`),
  CONSTRAINT `fk_rpnotes_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `restaurant_orders` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `table_id` CHAR(36) NOT NULL,
  `order_number` VARCHAR(30) NOT NULL,
  `waiter_id` CHAR(36) DEFAULT NULL,
  `waiter_name` VARCHAR(150) DEFAULT NULL,
  `customer_id` CHAR(36) DEFAULT NULL,
  `customer_name` VARCHAR(150) DEFAULT NULL,
  `status` ENUM('OPEN', 'BILL_REQUESTED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
  `notes` TEXT DEFAULT NULL,
  `total_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `is_invoiced` TINYINT(1) NOT NULL DEFAULT 0,
  `pos_invoice_id` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_rorders_table_status` (`table_id`, `status`),
  INDEX `idx_rorders_invoiced` (`is_invoiced`, `status`),
  CONSTRAINT `fk_rorders_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rorders_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rorders_table` FOREIGN KEY (`table_id`) REFERENCES `restaurant_tables` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `restaurant_table_closures` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `table_id` CHAR(36) NOT NULL,
  `table_number` VARCHAR(20) NOT NULL,
  `table_name` VARCHAR(100) NOT NULL,
  `zone` VARCHAR(50) NOT NULL DEFAULT 'Salón Principal',
  `order_number` VARCHAR(30) NOT NULL,
  `waiter_id` CHAR(36) DEFAULT NULL,
  `waiter_name` VARCHAR(150) DEFAULT NULL,
  `closed_by_user_id` CHAR(36) DEFAULT NULL,
  `closed_by_user_name` VARCHAR(150) DEFAULT NULL,
  `opened_at` TIMESTAMP NOT NULL,
  `closed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `duration_minutes` INT NOT NULL DEFAULT 0,
  `customer_count` INT NOT NULL DEFAULT 1,
  `item_count` INT NOT NULL DEFAULT 0,
  `subtotal_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tip_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tip_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `payment_summary` JSON DEFAULT NULL,
  `closure_notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_table_closures_company` (`company_id`, `created_at`),
  INDEX `idx_table_closures_branch` (`branch_id`, `created_at`),
  INDEX `idx_table_closures_table` (`table_id`),
  INDEX `idx_table_closures_waiter` (`waiter_id`),
  CONSTRAINT `fk_rtclosures_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rtclosures_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `restaurant_order_customers` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `customer_number` INT NOT NULL DEFAULT 1,
  `customer_name` VARCHAR(100) NOT NULL,
  `customer_id` CHAR(36) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `is_paid` TINYINT(1) NOT NULL DEFAULT 0,
  `total_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_rocustomers_order` (`order_id`),
  CONSTRAINT `fk_rocustomers_order` FOREIGN KEY (`order_id`) REFERENCES `restaurant_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `restaurant_order_items` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `order_customer_id` CHAR(36) DEFAULT NULL,
  `product_id` CHAR(36) DEFAULT NULL,
  `product_name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(50) DEFAULT NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  `unit_price_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `unit_price_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `subtotal_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `station` ENUM('KITCHEN', 'BAR') NOT NULL DEFAULT 'KITCHEN',
  `notes` TEXT DEFAULT NULL,
  `status` ENUM('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `department_id` CHAR(36) DEFAULT NULL,
  `group_id` CHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_roitems_order` (`order_id`),
  INDEX `idx_roitems_station_status` (`station`, `status`),
  CONSTRAINT `fk_roitems_order` FOREIGN KEY (`order_id`) REFERENCES `restaurant_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_roitems_customer` FOREIGN KEY (`order_customer_id`) REFERENCES `restaurant_order_customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `restaurant_order_payments` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `order_customer_id` CHAR(36) DEFAULT NULL,
  `payment_method_id` CHAR(36) DEFAULT NULL,
  `payment_method_name` VARCHAR(100) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'USD',
  `amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `amount_usd` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `amount_ves` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `exchange_rate` DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  `reference` VARCHAR(100) DEFAULT NULL,
  `bank_account_id` CHAR(36) DEFAULT NULL,
  `is_credit` TINYINT(1) NOT NULL DEFAULT 0,
  `due_date` DATE DEFAULT NULL,
  `customer_id` CHAR(36) DEFAULT NULL,
  `receivable_id` CHAR(36) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ropayments_order` (`order_id`),
  CONSTRAINT `fk_ropayments_order` FOREIGN KEY (`order_id`) REFERENCES `restaurant_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ropayments_customer` FOREIGN KEY (`order_customer_id`) REFERENCES `restaurant_order_customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- -----------------------------------------------------------------------------
-- 3. MÓDULO DE CONTABILIDAD Y NIIF (07_accounting.sql)
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- 4. DISPARADORES / TRIGGERS (02_triggers.sql)
-- -----------------------------------------------------------------------------
-- ========================================================
-- ERO ERP VE - TRIGGERS DE AUTOMATIZACIÓN Y AUDITORÍA (MySQL 8)
-- ========================================================

USE `ero_erp_db`;

DELIMITER $$

-- 1. Actualización de Stock por Movimientos de Inventario (Deshabilitado: el control transaccional de stock, lotes y reservas se gestiona directamente en la capa de servicios)
DROP TRIGGER IF EXISTS `trg_inventory_movements_after_insert`$$


-- 2. Registro Histórico Automático al Modificar Precios de Productos
DROP TRIGGER IF EXISTS `trg_products_after_update_price`$$
CREATE TRIGGER `trg_products_after_update_price`
AFTER UPDATE ON `products`
FOR EACH ROW
BEGIN
  IF (OLD.base_price <> NEW.base_price OR OLD.cost_price <> NEW.cost_price) THEN
    INSERT INTO `price_history` (
      `id`,
      `product_id`,
      `user_id`,
      `old_cost`,
      `new_cost`,
      `old_price`,
      `new_price`,
      `change_type`,
      `change_reason`,
      `created_at`
    ) VALUES (
      UUID(),
      NEW.id,
      COALESCE(@current_user_id, (SELECT id FROM users WHERE company_id = NEW.company_id LIMIT 1)),
      OLD.cost_price,
      NEW.cost_price,
      OLD.base_price,
      NEW.base_price,
      'PRICE_OR_COST_UPDATE',
      'Actualización directa de precio o costo en catálogo',
      NOW()
    );
  END IF;
END$$

-- 3. Generación Automática de Cuenta por Cobrar (CxC) en Ventas a Crédito
DROP TRIGGER IF EXISTS `trg_sales_invoices_after_insert`$$
CREATE TRIGGER `trg_sales_invoices_after_insert`
AFTER INSERT ON `sales_invoices`
FOR EACH ROW
BEGIN
  IF NEW.is_credit = 1 AND NEW.status <> 'ANNULLED' THEN
    INSERT INTO `receivables` (
      `id`,
      `branch_id`,
      `customer_id`,
      `invoice_id`,
      `amount_total`,
      `amount_paid`,
      `due_date`,
      `status`,
      `created_at`
    ) VALUES (
      UUID(),
      NEW.branch_id,
      NEW.customer_id,
      NEW.id,
      NEW.total_amount,
      0.00,
      DATE_ADD(NEW.invoice_date, INTERVAL 15 DAY), -- Término estándar 15 días o configurable
      'PENDING',
      NOW()
    );
  END IF;
END$$

-- 4. Descuento Automático de Stock al Insertar Renglones de Factura (Deshabilitado: el control de stock, reserva y despacho se realiza a nivel transaccional en la capa de servicios)
DROP TRIGGER IF EXISTS `trg_sales_invoice_items_after_insert`$$

DELIMITER ;


-- -----------------------------------------------------------------------------
-- 5. PROCEDIMIENTOS ALMACENADOS (03_procedures.sql)
-- -----------------------------------------------------------------------------
-- ========================================================
-- ERO ERP VE - STORED PROCEDURES CLAVE (MySQL 8)
-- ========================================================

USE `ero_erp_db`;

DELIMITER $$

-- 1. Actualización Masiva de Precios con Criterios Combinables y Reglas Tributarias
DROP PROCEDURE IF EXISTS `sp_bulk_price_update`$$
CREATE PROCEDURE `sp_bulk_price_update`(
  IN p_batch_id CHAR(36),
  IN p_company_id CHAR(36),
  IN p_user_id CHAR(36),
  IN p_mode VARCHAR(30),              -- 'percentage', 'fixed_amount', 'absolute_price', 'margin_over_cost'
  IN p_mode_value DECIMAL(10,4),      -- +10%, -5$, 12.50$, o 35% margen
  IN p_rounding_rule DECIMAL(4,2),    -- 0, 0.05, 0.10, 0.50, 1.00
  IN p_tax_affects_final_price TINYINT(1),
  IN p_price_mode VARCHAR(20),        -- 'tax_inclusive', 'tax_exclusive'
  IN p_criteria JSON,
  OUT p_affected_count INT
)
BEGIN
  DECLARE v_dept_ids JSON;
  DECLARE v_group_ids JSON;
  DECLARE v_subgroup_ids JSON;
  DECLARE v_supplier_ids JSON;
  DECLARE v_product_type VARCHAR(30);
  DECLARE v_min_price DECIMAL(14,4);
  DECLARE v_max_price DECIMAL(14,4);

  -- Extraer criterios desde el JSON
  SET v_dept_ids = JSON_EXTRACT(p_criteria, '$.departmentIds');
  SET v_group_ids = JSON_EXTRACT(p_criteria, '$.groupIds');
  SET v_subgroup_ids = JSON_EXTRACT(p_criteria, '$.subgroupIds');
  SET v_supplier_ids = JSON_EXTRACT(p_criteria, '$.supplierIds');
  SET v_product_type = JSON_UNQUOTE(JSON_EXTRACT(p_criteria, '$.productType'));
  SET v_min_price = CAST(JSON_EXTRACT(p_criteria, '$.minCurrentPrice') AS DECIMAL(14,4));
  SET v_max_price = CAST(JSON_EXTRACT(p_criteria, '$.maxCurrentPrice') AS DECIMAL(14,4));

  START TRANSACTION;

  -- 1. Crear tabla temporal con el universo filtrado y el cálculo de nuevo precio
  DROP TEMPORARY TABLE IF EXISTS `tmp_price_updates`;
  CREATE TEMPORARY TABLE `tmp_price_updates` AS
  SELECT 
    p.id AS product_id,
    p.cost_price,
    p.base_price AS old_base_price,
    COALESCE(tr.rate, 16.00) AS tax_rate,
    
    -- Cálculo del nuevo precio base según el modo seleccionado
    CASE 
      WHEN p_mode = 'percentage' THEN p.base_price * (1 + (p_mode_value / 100))
      WHEN p_mode = 'fixed_amount' THEN p.base_price + p_mode_value
      WHEN p_mode = 'absolute_price' THEN p_mode_value
      WHEN p_mode = 'margin_over_cost' THEN p.cost_price * (1 + (p_mode_value / 100))
      ELSE p.base_price
    END AS raw_new_base_price
  FROM `products` p
  LEFT JOIN `tax_rates` tr ON p.default_tax_rate_id = tr.id
  WHERE p.company_id = p_company_id
    AND p.is_active = 1
    AND (v_product_type IS NULL OR v_product_type = 'all' OR p.product_type = v_product_type)
    AND (v_dept_ids IS NULL OR JSON_CONTAINS(v_dept_ids, JSON_QUOTE(p.department_id)))
    AND (v_group_ids IS NULL OR JSON_CONTAINS(v_group_ids, JSON_QUOTE(p.group_id)))
    AND (v_subgroup_ids IS NULL OR JSON_CONTAINS(v_subgroup_ids, JSON_QUOTE(p.subgroup_id)))
    AND (v_supplier_ids IS NULL OR JSON_CONTAINS(v_supplier_ids, JSON_QUOTE(p.supplier_id)))
    AND (v_min_price IS NULL OR p.base_price >= v_min_price)
    AND (v_max_price IS NULL OR p.base_price <= v_max_price);

  -- 2. Guardar detalles en `price_change_items` aplicando regla de redondeo
  INSERT INTO `price_change_items` (
    `id`,
    `batch_id`,
    `product_id`,
    `cost_price`,
    `old_base_price`,
    `new_base_price`,
    `old_final_price`,
    `new_final_price`,
    `tax_rate`
  )
  SELECT 
    UUID(),
    p_batch_id,
    t.product_id,
    t.cost_price,
    t.old_base_price,
    -- Aplicación de Redondeo al precio base
    CASE 
      WHEN p_rounding_rule > 0 THEN ROUND(t.raw_new_base_price / p_rounding_rule) * p_rounding_rule
      ELSE ROUND(t.raw_new_base_price, 2)
    END AS new_base_price,
    -- Precio Final Antes (con IVA)
    ROUND(t.old_base_price * (1 + (t.tax_rate / 100)), 2) AS old_final_price,
    -- Precio Final Después (con IVA)
    CASE 
      WHEN p_rounding_rule > 0 THEN 
        ROUND((ROUND(t.raw_new_base_price / p_rounding_rule) * p_rounding_rule) * (1 + (t.tax_rate / 100)), 2)
      ELSE 
        ROUND(ROUND(t.raw_new_base_price, 2) * (1 + (t.tax_rate / 100)), 2)
    END AS new_final_price,
    t.tax_rate
  FROM `tmp_price_updates` t;

  -- 3. Actualizar la tabla principal de `products`
  UPDATE `products` p
  INNER JOIN `price_change_items` pci ON p.id = pci.product_id AND pci.batch_id = p_batch_id
  SET 
    p.base_price = pci.new_base_price,
    p.updated_at = NOW();

  -- 4. Registrar en la bitácora histórica `price_history`
  INSERT INTO `price_history` (
    `id`,
    `product_id`,
    `user_id`,
    `batch_id`,
    `old_cost`,
    `new_cost`,
    `old_price`,
    `new_price`,
    `change_type`,
    `change_reason`,
    `created_at`
  )
  SELECT 
    UUID(),
    pci.product_id,
    p_user_id,
    p_batch_id,
    pci.cost_price,
    pci.cost_price,
    pci.old_base_price,
    pci.new_base_price,
    'BULK_UPDATE',
    CONCAT('Lote de actualización masiva: ', p_mode, ' (Valor: ', p_mode_value, ')'),
    NOW()
  FROM `price_change_items` pci
  WHERE pci.batch_id = p_batch_id;

  SET p_affected_count = (SELECT COUNT(*) FROM `price_change_items` WHERE `batch_id` = p_batch_id);

  -- Actualizar el encabezado del lote
  UPDATE `price_change_batches`
  SET 
    `affected_products_count` = p_affected_count,
    `status` = 'APPLIED',
    `applied_at` = NOW()
  WHERE `id` = p_batch_id;

  COMMIT;
END$$

-- 2. Modificación de Tasa de Impuesto con Recálculo y Afectación al Precio Final
DROP PROCEDURE IF EXISTS `sp_change_tax_rate`$$
CREATE PROCEDURE `sp_change_tax_rate`(
  IN p_tax_rate_id CHAR(36),
  IN p_new_rate DECIMAL(5,2),
  IN p_affects_final_price TINYINT(1),
  IN p_price_mode VARCHAR(20),        -- 'tax_inclusive' o 'tax_exclusive'
  IN p_apply_scope VARCHAR(30),        -- 'global', 'department', 'group', 'subgroup'
  IN p_scope_ref_id CHAR(36),
  IN p_user_id CHAR(36),
  IN p_reason VARCHAR(255)
)
BEGIN
  DECLARE v_old_rate DECIMAL(5,2);
  DECLARE v_company_id CHAR(36);

  SELECT `rate`, `company_id` INTO v_old_rate, v_company_id
  FROM `tax_rates`
  WHERE `id` = p_tax_rate_id;

  START TRANSACTION;

  -- 1. Actualizar tasa en la tabla principal
  UPDATE `tax_rates`
  SET `rate` = p_new_rate, `updated_at` = NOW()
  WHERE `id` = p_tax_rate_id;

  -- 2. Registrar en auditoría de tasas `tax_rate_changes`
  INSERT INTO `tax_rate_changes` (
    `id`,
    `tax_rate_id`,
    `old_rate`,
    `new_rate`,
    `affects_final_price`,
    `price_mode`,
    `apply_scope`,
    `scope_ref_id`,
    `user_id`,
    `effective_date`,
    `reason`,
    `created_at`
  ) VALUES (
    UUID(),
    p_tax_rate_id,
    v_old_rate,
    p_new_rate,
    p_affects_final_price,
    p_price_mode,
    p_apply_scope,
    p_scope_ref_id,
    p_user_id,
    NOW(),
    p_reason,
    NOW()
  );

  -- 3. Si el cambio NO afecta el precio final al público en modo inclusivo,
  -- se ajusta la base imponible para que el PVP se mantenga y la empresa absorba la diferencia en su margen.
  IF p_affects_final_price = 0 AND p_price_mode = 'tax_inclusive' THEN
    UPDATE `products` p
    SET 
      -- Nueva Base = Precio_Final_Actual / (1 + Nueva_Tasa)
      p.base_price = (p.base_price * (1 + (v_old_rate / 100))) / (1 + (p_new_rate / 100)),
      p.updated_at = NOW()
    WHERE p.default_tax_rate_id = p_tax_rate_id
      AND p.is_active = 1
      AND (
        p_apply_scope = 'global'
        OR (p_apply_scope = 'department' AND p.department_id = p_scope_ref_id)
        OR (p_apply_scope = 'group' AND p.group_id = p_scope_ref_id)
        OR (p_apply_scope = 'subgroup' AND p.subgroup_id = p_scope_ref_id)
      );
  END IF;

  COMMIT;
END$$

-- 3. Ensamblado Dinámico de Dashboard según Permisos del Usuario
DROP PROCEDURE IF EXISTS `sp_build_dashboard`$$
CREATE PROCEDURE `sp_build_dashboard`(
  IN p_user_id CHAR(36)
)
BEGIN
  -- Retorna los widgets a los que el usuario tiene acceso según sus permisos asignados
  SELECT 
    w.id,
    w.code,
    w.module,
    w.title,
    w.description,
    w.type,
    w.config_json,
    COALESCE(dl.width, w.default_width) AS width,
    COALESCE(dl.height, w.default_height) AS height,
    COALESCE(dl.pos_x, 0) AS pos_x,
    COALESCE(dl.pos_y, 0) AS pos_y,
    w.required_permission
  FROM `dashboard_widgets` w
  LEFT JOIN `dashboards` d ON d.user_id = p_user_id AND d.is_default = 1
  LEFT JOIN `dashboard_layout` dl ON dl.dashboard_id = d.id AND dl.widget_id = w.id
  WHERE w.required_permission IN (
    -- Permisos del usuario mediante su rol
    SELECT CONCAT(p.module, '.', p.action)
    FROM `users` u
    INNER JOIN `role_permissions` rp ON u.role_id = rp.role_id
    INNER JOIN `permissions` p ON rp.permission_id = p.id
    WHERE u.id = p_user_id
  )
  ORDER BY dl.pos_y ASC, dl.pos_x ASC;
END$$

DELIMITER ;


-- -----------------------------------------------------------------------------
-- 6. VISTAS DEL SISTEMA (04_views.sql)
-- -----------------------------------------------------------------------------
-- ========================================================
-- ERO ERP VE - VISTAS ANALÍTICAS Y FISCALES (MySQL 8)
-- ========================================================

USE `ero_erp_db`;

-- 1. Vista de Productos con Jerarquía Completa y Ubicación Física
DROP VIEW IF EXISTS `v_products_by_hierarchy`;
CREATE VIEW `v_products_by_hierarchy` AS
SELECT 
  p.id AS product_id,
  p.company_id,
  p.sku,
  p.barcode,
  p.name AS product_name,
  p.product_type,
  d.id AS department_id,
  d.name AS department_name,
  g.id AS group_id,
  g.name AS group_name,
  sg.id AS subgroup_id,
  sg.name AS subgroup_name,
  s.name AS supplier_name,
  p.cost_price,
  p.base_price,
  tr.name AS tax_name,
  COALESCE(tr.rate, 0.00) AS tax_rate,
  ROUND(p.base_price * (1 + (COALESCE(tr.rate, 0.00) / 100)), 2) AS final_price,
  pl.warehouse_id,
  w.name AS warehouse_name,
  pl.aisle,
  pl.shelf,
  pl.compartment,
  COALESCE(ps.current_stock, 0.00) AS stock_qty,
  p.is_active
FROM `products` p
LEFT JOIN `departments` d ON p.department_id = d.id
LEFT JOIN `groups` g ON p.group_id = g.id
LEFT JOIN `subgroups` sg ON p.subgroup_id = sg.id
LEFT JOIN `suppliers` s ON p.supplier_id = s.id
LEFT JOIN `tax_rates` tr ON p.default_tax_rate_id = tr.id
LEFT JOIN `product_locations` pl ON p.id = pl.product_id
LEFT JOIN `warehouses` w ON pl.warehouse_id = w.id
LEFT JOIN `product_stocks` ps ON p.id = ps.product_id AND (pl.warehouse_id = ps.warehouse_id OR pl.warehouse_id IS NULL);

-- 2. Vista de Productos sin Ubicación Asignada
DROP VIEW IF EXISTS `v_products_without_location`;
CREATE VIEW `v_products_without_location` AS
SELECT 
  p.id AS product_id,
  p.company_id,
  p.sku,
  p.name AS product_name,
  d.name AS department_name,
  g.name AS group_name,
  sg.name AS subgroup_name,
  p.cost_price,
  p.base_price
FROM `products` p
LEFT JOIN `departments` d ON p.department_id = d.id
LEFT JOIN `groups` g ON p.group_id = g.id
LEFT JOIN `subgroups` sg ON p.subgroup_id = sg.id
WHERE p.is_active = 1
  AND p.product_type = 'physical'
  AND NOT EXISTS (
    SELECT 1 FROM `product_locations` pl WHERE pl.product_id = p.id
  );

-- 3. Vista de Antigüedad de Saldos CxC (Aging 0-30, 31-60, 61-90, 90+)
DROP VIEW IF EXISTS `v_cxc_aging`;
CREATE VIEW `v_cxc_aging` AS
SELECT 
  r.branch_id,
  b.name AS branch_name,
  c.id AS customer_id,
  c.doc_type,
  c.doc_number,
  c.name AS customer_name,
  r.id AS receivable_id,
  si.invoice_number,
  si.invoice_date,
  r.due_date,
  DATEDIFF(CURRENT_DATE(), r.due_date) AS days_overdue,
  r.amount_total,
  r.amount_paid,
  r.amount_balance,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), r.due_date) <= 0 THEN r.amount_balance ELSE 0 
  END AS current_due,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), r.due_date) BETWEEN 1 AND 30 THEN r.amount_balance ELSE 0 
  END AS days_1_30,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), r.due_date) BETWEEN 31 AND 60 THEN r.amount_balance ELSE 0 
  END AS days_31_60,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), r.due_date) BETWEEN 61 AND 90 THEN r.amount_balance ELSE 0 
  END AS days_61_90,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), r.due_date) > 90 THEN r.amount_balance ELSE 0 
  END AS days_90_plus
FROM `receivables` r
INNER JOIN `customers` c ON r.customer_id = c.id
INNER JOIN `branches` b ON r.branch_id = b.id
INNER JOIN `sales_invoices` si ON r.invoice_id = si.id
WHERE r.status IN ('PENDING', 'PARTIAL', 'OVERDUE');

-- 4. Vista de Resumen Diario de Ventas por Sucursal
DROP VIEW IF EXISTS `v_sales_daily`;
CREATE VIEW `v_sales_daily` AS
SELECT 
  si.branch_id,
  b.name AS branch_name,
  DATE(si.invoice_date) AS sale_date,
  COUNT(si.id) AS total_invoices,
  SUM(si.base_exempt_amount) AS total_exempt,
  SUM(si.base_taxable_amount) AS total_taxable,
  SUM(si.tax_amount) AS total_iva,
  SUM(si.igtf_amount) AS total_igtf,
  SUM(si.discount_amount) AS total_discounts,
  SUM(si.total_amount) AS total_sales_usd
FROM `sales_invoices` si
INNER JOIN `branches` b ON si.branch_id = b.id
WHERE si.status <> 'ANNULLED'
GROUP BY si.branch_id, b.name, DATE(si.invoice_date);

-- 5. Vista de Libro de Ventas Fiscal (Formato SENIAT)
DROP VIEW IF EXISTS `v_book_sales`;
CREATE VIEW `v_book_sales` AS
SELECT 
  si.id AS invoice_id,
  b.company_id,
  b.id AS branch_id,
  b.name AS branch_name,
  ROW_NUMBER() OVER (PARTITION BY si.branch_id, DATE_FORMAT(si.invoice_date, '%Y%m') ORDER BY si.invoice_date ASC) AS row_num,
  DATE(si.invoice_date) AS emission_date,
  CONCAT(cust.doc_type, '-', cust.doc_number) AS customer_rif,
  cust.name AS customer_name,
  si.invoice_number,
  si.control_number,
  si.total_amount,
  si.base_exempt_amount,
  si.base_taxable_amount,
  16.00 AS tax_rate,
  si.tax_amount,
  si.igtf_amount,
  0.00 AS iva_retained_amount,
  DATE_FORMAT(si.invoice_date, '%Y-%m') AS fiscal_period
FROM `sales_invoices` si
INNER JOIN `branches` b ON si.branch_id = b.id
INNER JOIN `customers` cust ON si.customer_id = cust.id
WHERE si.status <> 'ANNULLED';

-- 6. Vista de Antigüedad de Saldos CxP (Aging 0-30, 31-60, 61-90, 90+)
DROP VIEW IF EXISTS `v_cxp_aging`;
CREATE VIEW `v_cxp_aging` AS
SELECT 
  p.branch_id,
  b.name AS branch_name,
  s.id AS supplier_id,
  s.rif AS supplier_rif,
  s.name AS supplier_name,
  p.id AS payable_id,
  pi.invoice_number,
  pi.invoice_date,
  p.due_date,
  DATEDIFF(CURRENT_DATE(), p.due_date) AS days_overdue,
  p.amount_total,
  p.amount_paid,
  p.amount_balance,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), p.due_date) <= 0 THEN p.amount_balance ELSE 0 
  END AS current_due,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), p.due_date) BETWEEN 1 AND 30 THEN p.amount_balance ELSE 0 
  END AS days_1_30,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), p.due_date) BETWEEN 31 AND 60 THEN p.amount_balance ELSE 0 
  END AS days_31_60,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), p.due_date) BETWEEN 61 AND 90 THEN p.amount_balance ELSE 0 
  END AS days_61_90,
  CASE 
    WHEN DATEDIFF(CURRENT_DATE(), p.due_date) > 90 THEN p.amount_balance ELSE 0 
  END AS days_90_plus
FROM `payables` p
INNER JOIN `suppliers` s ON p.supplier_id = s.id
INNER JOIN `branches` b ON p.branch_id = b.id
INNER JOIN `purchase_invoices` pi ON p.invoice_id = pi.id
WHERE p.status IN ('PENDING', 'PARTIAL', 'OVERDUE');

-- 7. Vista de Disponibilidad y Saldos de Tesorería
DROP VIEW IF EXISTS `v_treasury_balances`;
CREATE VIEW `v_treasury_balances` AS
SELECT 
  ba.id AS account_id,
  ba.company_id,
  ba.branch_id,
  br.name AS branch_name,
  b.id AS bank_id,
  b.code AS bank_code,
  b.name AS bank_name,
  ba.account_number,
  ba.account_type,
  ba.currency,
  ba.description,
  ba.current_balance,
  (SELECT COUNT(*) FROM `bank_movements` bm WHERE bm.account_id = ba.id AND bm.is_reconciled = 0) AS pending_reconciliations_count,
  (SELECT MAX(bm.movement_date) FROM `bank_movements` bm WHERE bm.account_id = ba.id) AS last_movement_date
FROM `bank_accounts` ba
INNER JOIN `banks` b ON ba.bank_id = b.id
LEFT JOIN `branches` br ON ba.branch_id = br.id
WHERE ba.is_active = 1;

-- 8. Vista de Libro de Compras Fiscal (Formato SENIAT)
DROP VIEW IF EXISTS `v_book_purchases`;
CREATE VIEW `v_book_purchases` AS
SELECT 
  pi.id AS invoice_id,
  b.company_id,
  b.id AS branch_id,
  b.name AS branch_name,
  s.id AS supplier_id,
  ROW_NUMBER() OVER (PARTITION BY pi.branch_id, DATE_FORMAT(pi.invoice_date, '%Y%m') ORDER BY pi.invoice_date ASC) AS row_num,
  DATE(pi.invoice_date) AS emission_date,
  s.rif AS supplier_rif,
  s.name AS supplier_name,
  pi.invoice_number,
  pi.control_number,
  pi.total_amount,
  pi.base_exempt_amount,
  pi.base_taxable_amount,
  16.00 AS tax_rate,
  pi.tax_amount,
  COALESCE(twi.iva_retained_amount, 0.00) AS iva_retained_amount,
  twi.voucher_number AS withholding_voucher_number,
  DATE_FORMAT(pi.invoice_date, '%Y-%m') AS fiscal_period
FROM `purchase_invoices` pi
INNER JOIN `branches` b ON pi.branch_id = b.id
INNER JOIN `suppliers` s ON pi.supplier_id = s.id
LEFT JOIN `tax_withholdings_iva` twi ON pi.id = twi.purchase_invoice_id AND twi.status <> 'ANNULLED'
WHERE pi.status <> 'ANNULLED';

-- 9. Vista de Turnos de Caja y Estado de POS
DROP VIEW IF EXISTS `v_pos_active_shifts`;
CREATE VIEW `v_pos_active_shifts` AS
SELECT 
  cs.id AS shift_id,
  b.company_id,
  cs.branch_id,
  b.name AS branch_name,
  cs.cash_register_id,
  cr.code AS cash_register_code,
  cr.name AS cash_register_name,
  cr.fiscal_printer_serial,
  cr.invoice_mode,
  cs.user_id,
  u.full_name AS cashier_name,
  cs.opened_at,
  cs.closed_at,
  cs.initial_cash_usd,
  cs.initial_cash_ves,
  cs.final_cash_usd_expected,
  cs.final_cash_ves_expected,
  cs.final_cash_usd_counted,
  cs.final_cash_ves_counted,
  cs.difference_usd,
  cs.difference_ves,
  cs.status,
  COALESCE(sales_summary.invoices_count, 0) AS invoices_count,
  COALESCE(sales_summary.total_sales_usd, 0.00) AS total_sales_usd,
  COALESCE(sales_summary.total_cash_usd, 0.00) AS total_cash_usd,
  COALESCE(sales_summary.total_cash_ves, 0.00) AS total_cash_ves,
  COALESCE(sales_summary.total_pagomovil_ves, 0.00) AS total_pagomovil_ves,
  COALESCE(sales_summary.total_debit_ves, 0.00) AS total_debit_ves,
  COALESCE(sales_summary.total_igtf_usd, 0.00) AS total_igtf_usd
FROM `cash_shifts` cs
INNER JOIN `cash_registers` cr ON cs.cash_register_id = cr.id
INNER JOIN `branches` b ON cs.branch_id = b.id
INNER JOIN `users` u ON cs.user_id = u.id
LEFT JOIN (
  SELECT 
    si.shift_id,
    COUNT(si.id) AS invoices_count,
    SUM(si.total_amount) AS total_sales_usd,
    SUM(CASE WHEN sp.method = 'CASH_USD' THEN sp.amount_usd ELSE 0 END) AS total_cash_usd,
    SUM(CASE WHEN sp.method = 'CASH_VES' THEN sp.amount_ves ELSE 0 END) AS total_cash_ves,
    SUM(CASE WHEN sp.method = 'PAGO_MOVIL' THEN sp.amount_ves ELSE 0 END) AS total_pagomovil_ves,
    SUM(CASE WHEN sp.method = 'DEBIT_CARD' THEN sp.amount_ves ELSE 0 END) AS total_debit_ves,
    SUM(sp.igtf_amount_usd) AS total_igtf_usd
  FROM `sales_invoices` si
  LEFT JOIN `sales_payments` sp ON si.id = sp.invoice_id
  WHERE si.status <> 'ANNULLED'
  GROUP BY si.shift_id
) sales_summary ON cs.id = sales_summary.shift_id;

-- 10. Vista de Kardex Valorizado Detallado
DROP VIEW IF EXISTS `v_inventory_kardex`;
CREATE VIEW `v_inventory_kardex` AS
SELECT 
  im.id AS movement_id,
  im.created_at AS movement_date,
  im.branch_id,
  b.name AS branch_name,
  im.warehouse_id,
  w.name AS warehouse_name,
  im.product_id,
  p.sku,
  p.name AS product_name,
  p.unit_of_measure,
  im.movement_type,
  im.quantity,
  im.unit_cost,
  im.total_cost,
  im.previous_stock,
  im.new_stock,
  im.reference_document,
  im.reason,
  im.user_id,
  u.full_name AS user_name
FROM `inventory_movements` im
INNER JOIN `products` p ON im.product_id = p.id
INNER JOIN `warehouses` w ON im.warehouse_id = w.id
INNER JOIN `branches` b ON im.branch_id = b.id
INNER JOIN `users` u ON im.user_id = u.id;

-- 11. Vista de Stock Crítico y Alertas de Reorden
DROP VIEW IF EXISTS `v_stock_critical`;
CREATE VIEW `v_stock_critical` AS
SELECT 
  p.id AS product_id,
  p.company_id,
  p.sku,
  p.name AS product_name,
  p.unit_of_measure,
  p.min_stock,
  p.max_stock,
  p.cost_price,
  p.base_price,
  w.id AS warehouse_id,
  w.name AS warehouse_name,
  b.id AS branch_id,
  b.name AS branch_name,
  COALESCE(ps.current_stock, 0.00) AS current_stock,
  COALESCE(ps.reserved_stock, 0.00) AS reserved_stock,
  COALESCE(ps.available_stock, 0.00) AS available_stock,
  CASE 
    WHEN COALESCE(ps.available_stock, 0.00) <= 0 THEN 'OUT_OF_STOCK'
    WHEN COALESCE(ps.available_stock, 0.00) <= p.min_stock THEN 'CRITICAL_LOW'
    WHEN p.max_stock > 0 AND COALESCE(ps.available_stock, 0.00) > p.max_stock THEN 'OVERSTOCK'
    ELSE 'OPTIMAL'
  END AS stock_status,
  CASE 
    WHEN COALESCE(ps.available_stock, 0.00) <= p.min_stock 
    THEN GREATEST(p.max_stock - COALESCE(ps.available_stock, 0.00), p.min_stock * 2)
    ELSE 0.00
  END AS suggested_reorder_qty
FROM `products` p
CROSS JOIN `warehouses` w
INNER JOIN `branches` b ON w.branch_id = b.id
LEFT JOIN `product_stocks` ps ON p.id = ps.product_id AND w.id = ps.warehouse_id
WHERE p.is_active = 1 AND p.product_type = 'physical';






-- -----------------------------------------------------------------------------
-- 7. SEMILLAS BASE DE CONFIGURACIÓN (05_seeds.sql)
-- -----------------------------------------------------------------------------
-- ========================================================
-- ERO ERP VE - INITIAL SEEDS DATA (MySQL 8)
-- ========================================================

USE `ero_erp_db`;

-- Variables de Identificadores UUID fijos para consistencia
SET @company_id = 'c1111111-1111-1111-1111-111111111111';
SET @branch_main_id = 'b1111111-1111-1111-1111-111111111111';
SET @branch_east_id = 'b2222222-2222-2222-2222-222222222222';
SET @wh_main_id = 'w1111111-1111-1111-1111-111111111111';
SET @wh_store_id = 'w2222222-2222-2222-2222-222222222222';

SET @role_admin_id = 'r1111111-1111-1111-1111-111111111111';
SET @role_cashier_id = 'r2222222-2222-2222-2222-222222222222';
SET @role_supervisor_id = 'r3333333-3333-3333-3333-333333333333';

SET @user_admin_id = 'u1111111-1111-1111-1111-111111111111';
SET @user_cashier_id = 'u2222222-2222-2222-2222-222222222222';

-- 1. Empresa Principal
INSERT INTO `companies` (`id`, `rif`, `legal_name`, `trade_name`, `fiscal_address`, `phone`, `email`, `is_special_taxpayer`, `iva_retention_rate`)
VALUES (
  @company_id, 
  'J-40123456-7', 
  'DISTRIBUIDORA Y COMERCIALIZADORA VENEZOLANA C.A.', 
  'DISTRIBUIDORA ERO VE', 
  'Av. Francisco de Miranda, Torre Empresarial, Piso 8, Caracas, Venezuela', 
  '+58 212 999 8877', 
  'administracion@erove.com.ve', 
  1, 
  75.00
) ON DUPLICATE KEY UPDATE `legal_name` = VALUES(`legal_name`);

-- 1.1 Tasa de Cambio Oficial Inicial
INSERT INTO `exchange_rates` (`id`, `company_id`, `rate`, `currency_base`, `currency_secondary`, `effective_date`, `source`, `created_by_name`)
VALUES (UUID(), @company_id, 876.7976, 'USD', 'VES', CURRENT_DATE(), 'Banco Central de Venezuela (BCV)', 'Ing. Edgar Boscán');

-- 2. Sucursales
INSERT INTO `branches` (`id`, `company_id`, `code`, `name`, `address`, `phone`, `is_main`, `is_active`)
VALUES 
  (@branch_main_id, @company_id, 'SUC-01', 'Sucursal Principal Caracas', 'Av. Francisco de Miranda', '+58 212 999 8877', 1, 1),
  (@branch_east_id, @company_id, 'SUC-02', 'Sucursal Este - Las Mercedes', 'Calle París, Las Mercedes', '+58 212 999 8888', 0, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Depósitos
INSERT INTO `warehouses` (`id`, `branch_id`, `code`, `name`, `is_default`, `is_default_sales`, `is_default_purchases`, `is_active`)
VALUES 
  (@wh_main_id, @branch_main_id, 'ALM-01', 'Almacén Central Mayorista', 1, 1, 1, 1),
  (@wh_store_id, @branch_main_id, 'TIENDA-01', 'Depósito Piso de Venta', 0, 0, 0, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `is_default_sales` = VALUES(`is_default_sales`), `is_default_purchases` = VALUES(`is_default_purchases`);

-- 4. Tasas de Impuestos Venezolanas
SET @tax_iva_gen = 't1111111-1111-1111-1111-111111111111';
SET @tax_iva_red = 't2222222-2222-2222-2222-222222222222';
SET @tax_igtf = 't3333333-3333-3333-3333-333333333333';
SET @tax_exempt = 't4444444-4444-4444-4444-444444444444';

INSERT INTO `tax_rates` (`id`, `company_id`, `code`, `name`, `rate`, `type`, `is_active`)
VALUES 
  (@tax_iva_gen, @company_id, 'IVA_16', 'IVA Alícuota General (16%)', 16.00, 'IVA', 1),
  (@tax_iva_red, @company_id, 'IVA_08', 'IVA Alícuota Reducida (8%)', 8.00, 'IVA', 1),
  (@tax_igtf, @company_id, 'IGTF_03', 'IGTF Transacciones en Divisas (3%)', 3.00, 'IGTF', 1),
  (@tax_exempt, @company_id, 'EXENTO', 'Productos y Servicios Exentos', 0.00, 'EXENTO', 1)
ON DUPLICATE KEY UPDATE `rate` = VALUES(`rate`);

-- 5. Roles y Permisos
INSERT INTO `roles` (`id`, `company_id`, `name`, `description`, `is_system`)
VALUES 
  (@role_admin_id, @company_id, 'Super Administrador', 'Acceso total y configuración del ERP', 1),
  (@role_cashier_id, @company_id, 'Cajero POS', 'Operaciones de caja y facturación', 1),
  (@role_supervisor_id, @company_id, 'Supervisor de Inventario', 'Control de stock, precios y transferencias', 1)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- Inserción de Catálogo de Permisos
INSERT IGNORE INTO `permissions` (`id`, `module`, `action`, `description`)
VALUES 
  (UUID(), 'dashboards', 'read', 'Ver dashboards'),
  (UUID(), 'dashboards', 'update', 'Personalizar layout de widgets'),
  (UUID(), 'inventory', 'read', 'Ver catálogo y stock'),
  (UUID(), 'inventory', 'create', 'Crear productos y jerarquías'),
  (UUID(), 'inventory', 'update', 'Modificar productos y ubicaciones'),
  (UUID(), 'inventory', 'adjust', 'Realizar ajustes de inventario'),
  (UUID(), 'inventory', 'transfer', 'Realizar traslados entre depósitos'),
  (UUID(), 'pricing', 'read', 'Ver listas y reglas de precios'),
  (UUID(), 'pricing', 'bulk_update', 'Ejecutar actualización masiva de precios'),
  (UUID(), 'pricing', 'apply_tax', 'Modificar tasas de impuesto con afectación'),
  (UUID(), 'sales', 'read', 'Ver ventas y facturas'),
  (UUID(), 'sales', 'create', 'Facturar y procesar ventas'),
  (UUID(), 'pos', 'read', 'Acceso a pantalla de caja'),
  (UUID(), 'pos', 'create', 'Apertura y operaciones de caja'),
  (UUID(), 'pos', 'close_register', 'Realizar cierre de caja y arqueo'),
  (UUID(), 'receivables', 'read', 'Consultar cuentas por cobrar'),
  (UUID(), 'receivables', 'create', 'Registrar cobros y abonos CxC'),
  (UUID(), 'suppliers', 'read', 'Consultar catálogo de proveedores'),
  (UUID(), 'suppliers', 'create', 'Registrar nuevos proveedores'),
  (UUID(), 'suppliers', 'update', 'Modificar datos de proveedores'),
  (UUID(), 'purchases', 'read', 'Consultar compras y recepciones'),
  (UUID(), 'purchases', 'create', 'Registrar compras y facturas de proveedor'),
  (UUID(), 'payables', 'read', 'Consultar cuentas por pagar'),
  (UUID(), 'payables', 'create', 'Registrar pagos y amortizaciones a proveedores'),
  (UUID(), 'payables', 'update', 'Modificar pagos a proveedores'),
  (UUID(), 'treasury', 'read', 'Consultar saldos bancarios y movimientos'),
  (UUID(), 'treasury', 'create', 'Registrar movimientos y transferencias bancarias'),
  (UUID(), 'treasury', 'reconcile', 'Ejecutar conciliación bancaria por extracto'),
  (UUID(), 'taxes', 'read', 'Consultar retenciones y libros SENIAT'),
  (UUID(), 'taxes', 'create', 'Emitir y anular retenciones SENIAT'),
  (UUID(), 'reports', 'read', 'Consultar catálogo general de reportes'),
  (UUID(), 'reports', 'export_pdf', 'Exportar reportes en PDF'),
  (UUID(), 'reports', 'export_excel', 'Exportar reportes en Excel/CSV'),
  (UUID(), 'reports', 'sales', 'Acceso a Reporte General de Ventas'),
  (UUID(), 'reports', 'cash_shifts', 'Acceso a Reporte de Cierres de Caja & Arqueos (X / Z)'),
  (UUID(), 'reports', 'sales_by_cashier', 'Acceso a Reporte de Rendimiento y Desempeño por Cajero'),
  (UUID(), 'reports', 'sales_by_product', 'Acceso a Reporte de Ventas y Rotación por Producto'),
  (UUID(), 'reports', 'inventory_hierarchy', 'Acceso a Reporte de Jerarquía & Stock Valorizado'),
  (UUID(), 'reports', 'restaurant_tips', 'Acceso a Reporte de Propinas de Restaurante por Mesero'),
  (UUID(), 'reports', 'receivables_aging', 'Acceso a Reporte de Antigüedad de Cartera (CxC)'),
  (UUID(), 'reports', 'payables_aging', 'Acceso a Reporte de Antigüedad de Deudas (CxP)'),
  (UUID(), 'reports', 'treasury_balances', 'Acceso a Reporte de Posición Global de Saldos y Liquidez Bancaria'),
  (UUID(), 'reports', 'bank_movements', 'Acceso a Reporte de Libro Auxiliar & Movimientos Bancarios'),
  (UUID(), 'reports', 'bank_reconciliation', 'Acceso a Reporte de Conciliación Bancaria Certificada'),
  (UUID(), 'reports', 'cash_flow', 'Acceso a Reporte de Flujo de Caja Operativo de Tesorería'),
  (UUID(), 'config', 'read', 'Consultar configuración del sistema, empresa y sucursales'),
  (UUID(), 'config', 'write', 'Modificar configuración del sistema, usuarios y roles'),
  (UUID(), 'audit', 'read', 'Consultar bitácora y registros de auditoría'),
  (UUID(), 'customers', 'read', 'Consultar directorio de clientes'),
  (UUID(), 'customers', 'create', 'Registrar nuevos clientes'),
  (UUID(), 'customers', 'update', 'Modificar datos de clientes'),
  (UUID(), 'customers', 'delete', 'Anular o desactivar clientes'),
  (UUID(), 'pricing', 'exchange_rate', 'Modificar tasa de cambio oficial BCV'),
  (UUID(), 'sales', 'update', 'Modificar cotizaciones y documentos de venta'),
  (UUID(), 'sales', 'delete', 'Anular documentos de venta'),
  (UUID(), 'sales', 'approve', 'Aprobar ventas especiales y autorizaciones de caja'),
  (UUID(), 'sales', 'approve_discount', 'Aprobar descuentos comerciales'),
  (UUID(), 'pos', 'authorize', 'Autorizar operaciones restringidas en caja (Stock negativo, presentaciones, precios)'),
  (UUID(), 'pos', 'audit_shifts', 'Auditar, verificar arqueos de caja y registrar depósitos bancarios de recaudación'),
  (UUID(), 'inventory', 'approve', 'Aprobar operaciones especiales de inventario'),
  (UUID(), 'inventory', 'counts', 'Toma física y conteos cíclicos de inventario'),
  (UUID(), 'pos', 'credit_notes', 'Emisión de notas de crédito y devoluciones en caja'),
  (UUID(), 'taxes', 'export_seniat', 'Exportación de libros y declaraciones SENIAT'),
  (UUID(), 'notifications', 'read', 'Ver notificaciones y alertas'),
  (UUID(), 'notifications', 'write', 'Gestionar y descartar notificaciones'),
  (UUID(), 'restaurant', 'read', 'Ver mesas, pedidos abiertos y comandas'),
  (UUID(), 'restaurant', 'write', 'Crear y editar comandas de restaurante'),
  (UUID(), 'restaurant', 'items', 'Agregar y anular ítems de comanda'),
  (UUID(), 'restaurant', 'payments', 'Cobrar cuentas de comanda'),
  (UUID(), 'restaurant', 'close', 'Cerrar pedidos y turnos de restaurante'),
  (UUID(), 'restaurant', 'tables', 'Gestionar salones y mesas'),
  (UUID(), 'restaurant', 'kds', 'Acceso y operación a pantalla KDS'),
  (UUID(), 'restaurant', 'settings', 'Configuración de restaurante'),
  (UUID(), 'purchases', 'update', 'Modificar órdenes de compra'),
  (UUID(), 'purchases', 'delete', 'Anular órdenes de compra');

-- Asignar todos los permisos al Super Administrador
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT @role_admin_id, id FROM `permissions`;

-- Asignar permisos básicos a Cajero (POS + Sales + Customers + Inventory + Pricing) SIN permisos de autorización
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT @role_cashier_id, id FROM `permissions` 
WHERE module IN ('pos', 'sales', 'dashboards', 'customers', 'inventory', 'pricing') AND action IN ('read', 'create', 'close_register');

-- 6. Usuarios
-- Password demo: "Admin123!" en hash Argon2
SET @admin_hash = '$argon2id$v=19$m=65536,t=3,p=4$tHvv8+hyrrk9FgP6N/TqHw$1fUw05h+/+cwxom5jEzMvN1zXvilhJz9zUX9moY9Zls';

INSERT INTO `users` (`id`, `company_id`, `role_id`, `username`, `email`, `password_hash`, `full_name`, `is_active`)
VALUES 
  (@user_admin_id, @company_id, @role_admin_id, 'admin', 'admin@erove.com.ve', @admin_hash, 'Ing. Edgar Boscán (Director General)', 1),
  (@user_cashier_id, @company_id, @role_cashier_id, 'cajero01', 'caja1@erove.com.ve', @admin_hash, 'María Pérez (Cajera Principal)', 1)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

INSERT IGNORE INTO `user_branches` (`user_id`, `branch_id`, `is_default`)
VALUES 
  (@user_admin_id, @branch_main_id, 1),
  (@user_admin_id, @branch_east_id, 0),
  (@user_cashier_id, @branch_main_id, 1);

INSERT IGNORE INTO `user_warehouses` (`user_id`, `warehouse_id`, `is_default`)
VALUES 
  (@user_admin_id, @wh_main_id, 1),
  (@user_admin_id, @wh_store_id, 0),
  (@user_cashier_id, @wh_store_id, 1);

-- 7. Jerarquía de Inventario (Departamentos, Grupos, Subgrupos)
SET @dept_alimentos = 'd1111111-1111-1111-1111-111111111111';
SET @dept_ferreteria = 'd2222222-2222-2222-2222-222222222222';
SET @dept_electronica = 'd3333333-3333-3333-3333-333333333333';

INSERT INTO `departments` (`id`, `company_id`, `code`, `name`, `description`, `is_active`)
VALUES 
  (@dept_alimentos, @company_id, 'DEP-ALM', 'Alimentos y Víveres', 'Productos de consumo masivo y abarrotes', 1),
  (@dept_ferreteria, @company_id, 'DEP-FER', 'Ferretería y Construcción', 'Herramientas, tornillería y materiales', 1),
  (@dept_electronica, @company_id, 'DEP-ELE', 'Electrónica y Tecnología', 'Equipos, periféricos e iluminación LED', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET @group_lacteos = 'g1111111-1111-1111-1111-111111111111';
SET @group_granos = 'g2222222-2222-2222-2222-222222222222';
SET @group_herramientas = 'g3333333-3333-3333-3333-333333333333';

INSERT INTO `groups` (`id`, `department_id`, `code`, `name`, `description`, `is_active`)
VALUES 
  (@group_lacteos, @dept_alimentos, 'GRP-LAC', 'Lácteos y Derivados', 'Leches, quesos y mantequillas', 1),
  (@group_granos, @dept_alimentos, 'GRP-GRA', 'Granos y Cereales', 'Arroz, harinas, caraotas y pastas', 1),
  (@group_herramientas, @dept_ferreteria, 'GRP-HER', 'Herramientas Manuales', 'Martillos, destornilladores, pinzas', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET @subgroup_leches = 's1111111-1111-1111-1111-111111111111';
SET @subgroup_quesos = 's2222222-2222-2222-2222-222222222222';
SET @subgroup_destornilladores = 's3333333-3333-3333-3333-333333333333';

INSERT INTO `subgroups` (`id`, `group_id`, `code`, `name`, `description`, `is_active`)
VALUES 
  (@subgroup_leches, @group_lacteos, 'SUB-LEC', 'Leche en Polvo y Líquida', 'Presentaciones pasteurizadas y larga duración', 1),
  (@subgroup_quesos, @group_lacteos, 'SUB-QUE', 'Quesos Duros y Semiduros', 'Queso llanero, paisa y guayanés', 1),
  (@subgroup_destornilladores, @group_herramientas, 'SUB-DES', 'Destornilladores de Precisión', 'Juegos de destornilladores Phillips y pala', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 8. Proveedores Demo
SET @sup_1 = 'p1111111-1111-1111-1111-111111111111';
INSERT INTO `suppliers` (`id`, `company_id`, `rif`, `name`, `fiscal_address`, `phone`, `email`, `is_resident`, `islr_concept_code`)
VALUES 
  (@sup_1, @company_id, 'J-30555666-0', 'ALIMENTOS POLAR COMERCIAL C.A.', 'Los Cortijos, Caracas', '+58 212 202 3111', 'ventas@polar.com.ve', 1, 'SERV_IND');

-- 8.1 Marcas Demo
INSERT IGNORE INTO `brands` (`id`, `company_id`, `name`, `description`) VALUES
  (UUID(), @company_id, 'P.A.N.', 'Harinas y derivados de maíz'),
  (UUID(), @company_id, 'La Campesina', 'Lácteos y leches en polvo'),
  (UUID(), @company_id, 'Stanley', 'Herramientas de alta durabilidad'),
  (UUID(), @company_id, 'Mavesa', 'Margarinas, mayonesas y salsas'),
  (UUID(), @company_id, 'Nestlé', 'Alimentos infantiles y confitería');

-- 8.2 Unidades de Medida
INSERT IGNORE INTO `units_of_measure` (`id`, `company_id`, `code`, `name`, `symbol`) VALUES
  (UUID(), @company_id, 'UND', 'Unidad', 'und'),
  (UUID(), @company_id, 'KG', 'Kilogramo', 'kg'),
  (UUID(), @company_id, 'GR', 'Gramo', 'g'),
  (UUID(), @company_id, 'LTS', 'Litro', 'L'),
  (UUID(), @company_id, 'ML', 'Mililitro', 'mL'),
  (UUID(), @company_id, 'CAJA', 'Caja', 'cja'),
  (UUID(), @company_id, 'PAQ', 'Paquete', 'paq'),
  (UUID(), @company_id, 'BULTO', 'Bulto', 'blt'),
  (UUID(), @company_id, 'MTR', 'Metro', 'm');

-- 8.3 Plantillas de Presentaciones
INSERT IGNORE INTO `presentations` (`id`, `company_id`, `name`, `description`, `default_multiplier`, `default_unit`) VALUES
  (UUID(), @company_id, 'Unidad Individual', 'Presentación individual al detal', 1.0000, 'UND'),
  (UUID(), @company_id, 'Display x 6', 'Empaque intermedio por 6 unidades', 6.0000, 'UND'),
  (UUID(), @company_id, 'Display x 12', 'Empaque por 12 unidades', 12.0000, 'UND'),
  (UUID(), @company_id, 'Caja x 24', 'Caja corrugada estándar por 24 unidades', 24.0000, 'CAJA'),
  (UUID(), @company_id, 'Caja x 48', 'Caja por 48 unidades', 48.0000, 'CAJA'),
  (UUID(), @company_id, 'Bulto x 20Kg', 'Saco o bulto por 20 kilogramos', 20.0000, 'KG'),
  (UUID(), @company_id, 'Bulto x 50Kg', 'Saco industrial por 50 kilogramos', 50.0000, 'KG');

-- 9. Catálogo de Productos Inicial
SET @prod_1 = 'a1111111-1111-1111-1111-111111111111';
SET @prod_2 = 'a2222222-2222-2222-2222-222222222222';
SET @prod_3 = 'a3333333-3333-3333-3333-333333333333';

INSERT INTO `products` (
  `id`, `company_id`, `sku`, `barcode`, `name`, `description`, `product_type`,
  `department_id`, `group_id`, `subgroup_id`, `supplier_id`, `brand`,
  `unit_of_measure`, `cost_price`, `base_price`, `currency`, `default_tax_rate_id`, `tax_inclusive`,
  `min_stock`, `max_stock`, `is_active`
) VALUES 
  (@prod_1, @company_id, 'HAR-PAN-01', '7591012345678', 'Harina PAN Blanca 1Kg', 'Harina de maíz precocida tradicional', 'physical', @dept_alimentos, @group_granos, NULL, @sup_1, 'P.A.N.', 'KG', 1.0000, 1.4000, 'USD', @tax_exempt, 0, 50, 500, 1),
  (@prod_2, @company_id, 'LEC-POL-01', '7591098765432', 'Leche en Polvo Completa 1Kg', 'Leche pasteurizada enriquecida con vitaminas', 'physical', @dept_alimentos, @group_lacteos, @subgroup_leches, @sup_1, 'La Campesina', 'KG', 6.5000, 9.2000, 'USD', @tax_iva_gen, 0, 20, 200, 1),
  (@prod_3, @company_id, 'DES-SET-06', '7591055554444', 'Juego de Destornilladores 6 Piezas', 'Acero cromo vanadio imantados', 'physical', @dept_ferreteria, @group_herramientas, @subgroup_destornilladores, NULL, 'Stanley', 'UND', 8.0000, 14.5000, 'USD', @tax_iva_gen, 0, 10, 80, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 9.1 SKUs Secundarios y Códigos de Barras
INSERT IGNORE INTO `product_skus` (`id`, `product_id`, `sku`, `barcode`, `description`, `is_primary`, `price`, `currency`) VALUES
  (UUID(), @prod_1, 'HAR-PAN-01', '7591012345678', 'SKU Principal Harina PAN 1Kg', 1, 1.4000, 'USD'),
  (UUID(), @prod_1, 'HAR-PAN-AMAR', '7591012345679', 'Harina PAN Maíz Amarillo 1Kg', 0, 1.4500, 'USD'),
  (UUID(), @prod_2, 'LEC-POL-01', '7591098765432', 'SKU Principal Leche Completa 1Kg', 1, 9.2000, 'USD'),
  (UUID(), @prod_2, 'LEC-POL-DESM', '7591098765433', 'Leche Descremada 1Kg', 0, 9.8000, 'USD'),
  (UUID(), @prod_3, 'DES-SET-06', '7591055554444', 'SKU Principal Juego 6 Piezas', 1, 14.5000, 'USD');

-- 9.2 Presentaciones y Empaques con Precios Diferenciados
INSERT IGNORE INTO `product_presentations` (`id`, `product_id`, `name`, `sku`, `barcode`, `unit_of_measure`, `multiplier`, `cost_price`, `base_price`, `currency`, `is_default`) VALUES
  (UUID(), @prod_1, 'Unidad 1 Kg', 'HAR-PAN-01', '7591012345678', 'KG', 1.0000, 1.0000, 1.4000, 'USD', 1),
  (UUID(), @prod_1, 'Bulto x 20 Unidades', 'HAR-PAN-BLT20', '7591012345680', 'BULTO', 20.0000, 19.0000, 26.5000, 'USD', 0),
  (UUID(), @prod_2, 'Lata / Bolsa 1 Kg', 'LEC-POL-01', '7591098765432', 'KG', 1.0000, 6.5000, 9.2000, 'USD', 1),
  (UUID(), @prod_2, 'Caja x 12 Unidades', 'LEC-POL-CJ12', '7591098765434', 'CAJA', 12.0000, 75.0000, 105.0000, 'USD', 0);

-- 10. Ubicación Física Inicial de Productos (Pasillo / Estante / Compartimiento)
INSERT INTO `product_locations` (`id`, `product_id`, `warehouse_id`, `aisle`, `shelf`, `compartment`, `notes`)
VALUES 
  (UUID(), @prod_1, @wh_main_id, 'Pasillo A1', 'Estante 03', 'Nivel 1 (Piso)', 'Cerca del área de despacho'),
  (UUID(), @prod_2, @wh_main_id, 'Pasillo A1', 'Estante 04', 'Nivel 2', 'Zona de productos refrigerados/secos'),
  (UUID(), @prod_3, @wh_main_id, 'Pasillo C2', 'Estante 01', 'Gaveta 05-B', 'Ferretería liviana')
ON DUPLICATE KEY UPDATE `aisle` = VALUES(`aisle`);

-- 11. Stock Inicial
INSERT INTO `product_stocks` (`product_id`, `warehouse_id`, `current_stock`, `last_movement_at`)
VALUES 
  (@prod_1, @wh_main_id, 350.00, NOW()),
  (@prod_2, @wh_main_id, 120.00, NOW()),
  (@prod_3, @wh_main_id, 45.00, NOW())
ON DUPLICATE KEY UPDATE `current_stock` = VALUES(`current_stock`);

-- 12. Catálogo de Widgets para Dashboards Dinámicos
INSERT INTO `dashboard_widgets` (`id`, `code`, `module`, `title`, `description`, `type`, `default_width`, `default_height`, `required_permission`, `is_default`)
VALUES 
  (UUID(), 'WIDGET_SALES_TODAY', 'sales', 'Ventas del Día', 'Total facturado hoy en divisas y bolívares', 'kpi', 4, 2, 'sales.read', 1),
  (UUID(), 'WIDGET_TICKET_AVG', 'sales', 'Ticket Promedio', 'Valor medio por transacción facturada', 'kpi', 4, 2, 'sales.read', 1),
  (UUID(), 'WIDGET_TOP_PRODUCTS', 'sales', 'Top 5 Productos Vendidos', 'Ránking de productos más vendidos en el período', 'chart_bar', 6, 4, 'sales.read', 1),
  (UUID(), 'WIDGET_CRITICAL_STOCK', 'inventory', 'Stock Crítico & Mínimos', 'Productos por debajo del nivel de reorden', 'table', 6, 4, 'inventory.read', 1),
  (UUID(), 'WIDGET_CXC_AGING', 'receivables', 'Antigüedad de Deuda (CxC)', 'Distribución de saldos vencidos 30/60/90+ días', 'chart_pie', 6, 4, 'receivables.read', 1),
  (UUID(), 'WIDGET_TREASURY_BALANCES', 'treasury', 'Disponibilidad Bancaria', 'Saldos consolidados en cuentas USD / VES', 'table', 6, 4, 'treasury.read', 1),
  (UUID(), 'WIDGET_TAX_SUMMARY', 'taxes', 'Resumen Fiscal SENIAT', 'IVA por pagar y retenciones del mes en curso', 'kpi', 4, 2, 'taxes.read', 1),
  (UUID(), 'WIDGET_POS_STATUS', 'pos', 'Estado de Cajas POS', 'Ventas por cajero y estatus de arqueo', 'list', 6, 3, 'pos.read', 1)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 13. Clientes Demo
INSERT INTO `customers` (`id`, `company_id`, `doc_type`, `doc_number`, `name`, `address`, `phone`, `email`, `is_special_taxpayer`, `credit_enabled`, `credit_limit`, `payment_terms_days`)
VALUES 
  (UUID(), @company_id, 'V', '18222333', 'Juan Carlos Mendoza', 'Urb. Santa Mónica, Caracas', '+58 414 111 2233', 'jmendoza@gmail.com', 0, 1, 500.00, 15),
  (UUID(), @company_id, 'J', '31999888-0', 'INVERSIONES LA CASCADA C.A.', 'Av. Principal de Chacao, Edif. Centro', '+58 212 267 0011', 'compras@lacascada.com', 1, 1, 3000.00, 30)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 14. Proveedores y Facturas de Compra / CxP Demo
SET @sup_2 = 'p2222222-2222-2222-2222-222222222222';
INSERT INTO `suppliers` (`id`, `company_id`, `rif`, `name`, `fiscal_address`, `phone`, `email`, `is_resident`, `islr_concept_code`, `credit_limit`, `payment_terms_days`)
VALUES 
  (@sup_2, @company_id, 'J-00033322-1', 'MONDELEZ VENEZUELA C.A.', 'Zona Industrial San Diego, Valencia, Edo. Carabobo', '+58 241 876 5432', 'cuentas@mondelezinternational.com', 1, 'SERV_IND', 10000.00, 30)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET @purch_inv_1 = 'pi111111-1111-1111-1111-111111111111';
SET @purch_inv_2 = 'pi222222-2222-2222-2222-222222222222';

INSERT INTO `purchase_invoices` (
  `id`, `branch_id`, `warehouse_id`, `supplier_id`, `user_id`, `invoice_number`, `control_number`,
  `invoice_date`, `currency`, `exchange_rate`, `base_exempt_amount`, `base_taxable_amount`, `tax_amount`, `total_amount`, `is_credit`, `status`
) VALUES 
  (@purch_inv_1, @branch_main_id, @wh_main_id, @sup_1, @user_admin_id, 'FACT-POLAR-9812', '00-0981234', DATE_SUB(CURRENT_DATE(), INTERVAL 15 DAY), 'USD', 36.5000, 350.00, 780.00, 124.80, 1254.80, 1, 'PENDING'),
  (@purch_inv_2, @branch_main_id, @wh_main_id, @sup_2, @user_admin_id, 'FACT-MDLZ-4410', '00-0044102', DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY), 'USD', 36.2000, 0.00, 1500.00, 240.00, 1740.00, 1, 'PENDING')
ON DUPLICATE KEY UPDATE `invoice_number` = VALUES(`invoice_number`);

INSERT INTO `payables` (`id`, `branch_id`, `supplier_id`, `invoice_id`, `amount_total`, `amount_paid`, `due_date`, `status`)
VALUES 
  (UUID(), @branch_main_id, @sup_1, @purch_inv_1, 1254.80, 0.00, DATE_ADD(DATE_SUB(CURRENT_DATE(), INTERVAL 15 DAY), INTERVAL 15 DAY), 'PENDING'),
  (UUID(), @branch_main_id, @sup_2, @purch_inv_2, 1740.00, 500.00, DATE_SUB(CURRENT_DATE(), INTERVAL 15 DAY), 'OVERDUE')
ON DUPLICATE KEY UPDATE `amount_total` = VALUES(`amount_total`);

-- 15. Bancos, Cuentas Bancarias y Tesorería Inicial
SET @bank_banesco_id = 'bk111111-1111-1111-1111-111111111111';
SET @bank_mercantil_id = 'bk222222-2222-2222-2222-222222222222';
SET @bank_bancamiga_id = 'bk333333-3333-3333-3333-333333333333';

INSERT INTO `banks` (`id`, `code`, `name`, `is_active`)
VALUES 
  (@bank_banesco_id, '0134', 'Banesco Banco Universal', 1),
  (@bank_mercantil_id, '0105', 'Banco Mercantil', 1),
  (@bank_bancamiga_id, '0172', 'Bancamiga Banco Universal', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET @account_banesco_ves = 'ba111111-1111-1111-1111-111111111111';
SET @account_bancamiga_usd = 'ba222222-2222-2222-2222-222222222222';

INSERT INTO `bank_accounts` (`id`, `company_id`, `bank_id`, `branch_id`, `account_number`, `account_type`, `currency`, `description`, `current_balance`)
VALUES 
  (@account_banesco_ves, @company_id, @bank_banesco_id, @branch_main_id, '01340012345678901234', 'CURRENT', 'VES', 'Banesco Operativa Principal (Bolívares)', 45850.00),
  (@account_bancamiga_usd, @company_id, @bank_bancamiga_id, @branch_main_id, '01720098765432109876', 'CUSTODY_USD', 'USD', 'Bancamiga Cuenta Custodia / Moneda Extranjera', 12450.00)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

INSERT INTO `bank_movements` (`id`, `account_id`, `user_id`, `movement_type`, `amount`, `balance_after`, `reference_number`, `concept`, `is_reconciled`)
VALUES 
  (UUID(), @account_banesco_ves, @user_admin_id, 'DEPOSIT', 50000.00, 50000.00, 'DEP-001092', 'Aporte inicial de capital de trabajo', 1),
  (UUID(), @account_banesco_ves, @user_admin_id, 'FEE', -4150.00, 45850.00, 'COM-000841', 'Mantenimiento de cuenta y comisión IGTF mensual', 1),
  (UUID(), @account_bancamiga_usd, @user_admin_id, 'DEPOSIT', 15000.00, 15000.00, 'DEP-USD-0021', 'Apertura y fondo de custodia en divisas', 1),
  (UUID(), @account_bancamiga_usd, @user_admin_id, 'WITHDRAWAL', -2550.00, 12450.00, 'EGR-USD-0044', 'Pago a proveedores y flete marítimo', 0)
ON DUPLICATE KEY UPDATE `concept` = VALUES(`concept`);

-- 16. Retenciones Fiscales Demo (IVA e ISLR)
INSERT INTO `tax_withholdings_iva` (
  `id`, `company_id`, `branch_id`, `supplier_id`, `purchase_invoice_id`, `voucher_number`,
  `tax_period`, `fortnight`, `invoice_number`, `control_number`, `invoice_date`,
  `total_invoice_amount`, `exempt_amount`, `taxable_base_amount`, `tax_rate`,
  `iva_amount`, `retained_percentage`, `iva_retained_amount`, `status`
) VALUES (
  UUID(), @company_id, @branch_main_id, @sup_1, @purch_inv_1, '20260900000001',
  DATE_FORMAT(CURRENT_DATE(), '%Y-%m'), 'FIRST', 'FACT-POLAR-9812', '00-0981234', DATE_SUB(CURRENT_DATE(), INTERVAL 15 DAY),
  1254.80, 350.00, 780.00, 16.00,
  124.80, 75.00, 93.60, 'EMITTED'
) ON DUPLICATE KEY UPDATE `voucher_number` = VALUES(`voucher_number`);

INSERT INTO `tax_withholdings_islr` (
  `id`, `company_id`, `branch_id`, `supplier_id`, `purchase_invoice_id`, `voucher_number`,
  `tax_period`, `concept_code`, `concept_description`, `person_type`,
  `total_invoice_amount`, `taxable_base_amount`, `rate_percentage`, `subtracting_factor`,
  `islr_retained_amount`, `status`
) VALUES (
  UUID(), @company_id, @branch_main_id, @sup_1, @purch_inv_1, '20260900000001',
  DATE_FORMAT(CURRENT_DATE(), '%Y-%m'), 'SERV_TRANS', 'Servicio de Transporte y Envíos', 'PJD',
  1254.80, 780.00, 5.00, 0.00,
  39.00, 'EMITTED'
) ON DUPLICATE KEY UPDATE `voucher_number` = VALUES(`voucher_number`);

-- 17. Cajas y Turnos Fiscales POS Iniciales
SET @caja_1_id = 'cj111111-1111-1111-1111-111111111111';
SET @caja_2_id = 'cj222222-2222-2222-2222-222222222222';

INSERT INTO `cash_registers` (`id`, `branch_id`, `code`, `name`, `fiscal_printer_serial`, `invoice_mode`, `is_active`)
VALUES 
  (@caja_1_id, @branch_main_id, 'CAJA-01', 'Caja Principal Piso de Venta', 'Z5A8812341', 'fiscal_printer', 1),
  (@caja_2_id, @branch_main_id, 'CAJA-02', 'Caja Rápida Express (Digital)', NULL, 'normal_printer', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET @shift_demo_id = 'sh111111-1111-1111-1111-111111111111';
INSERT INTO `cash_shifts` (
  `id`, `cash_register_id`, `branch_id`, `user_id`, `opened_at`,
  `initial_cash_usd`, `initial_cash_ves`, `status`, `notes`
) VALUES (
  @shift_demo_id, @caja_1_id, @branch_main_id, @user_cashier_id, CURRENT_TIMESTAMP(),
  50.00, 1500.00, 'OPEN', 'Apertura de turno matutino con fondo de caja'
) ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);






-- -----------------------------------------------------------------------------
-- 8. DATOS DE HIPERMERCADO VENEZOLANO (08_hypermarket_seed.sql)
-- -----------------------------------------------------------------------------
-- =============================================================================
-- ERO ERP - SCRIPT DE INICIALIZACIÓN / LIMPIEZA Y CARGA DE DATOS DE HIPERMERCADO
-- Ámbito: Mercado Venezolano (Hipermercado de Consumo Masivo)
-- Preserva: Usuarios, Roles, Permisos, Licencias, Empresa y Configuración
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Obtención de Identificadores Base (Empresa, Sucursal y Almacenes)
SELECT id INTO @company_id FROM companies LIMIT 1;
SELECT id INTO @branch_id FROM branches WHERE company_id = @company_id ORDER BY is_main DESC LIMIT 1;

-- Si no hay almacenes definidos, se asignan valores por defecto
SELECT id INTO @wh_main FROM warehouses WHERE branch_id = @branch_id ORDER BY is_default DESC LIMIT 1;
SELECT id INTO @wh_store FROM warehouses WHERE branch_id = @branch_id AND id != @wh_main LIMIT 1;
SET @wh_store = COALESCE(@wh_store, @wh_main);

-- Tasas de Impuesto SENIAT (Exento y 16%)
SELECT id INTO @tax_exempt_id FROM tax_rates WHERE company_id = @company_id AND type = 'EXENTO' LIMIT 1;
SELECT id INTO @tax_iva16_id FROM tax_rates WHERE company_id = @company_id AND type = 'IVA' AND rate = 16.00 LIMIT 1;

-- Si no existen tasas, crearlas
INSERT INTO tax_rates (id, company_id, code, name, rate, type, is_active)
VALUES 
  (COALESCE(@tax_exempt_id, 't4444444-4444-4444-4444-444444444444'), @company_id, 'EXENTO', 'Productos y Servicios Exentos', 0.00, 'EXENTO', 1),
  (COALESCE(@tax_iva16_id, 't1111111-1111-1111-1111-111111111111'), @company_id, 'IVA_16', 'IVA Alícuota General (16%)', 16.00, 'IVA', 1)
ON DUPLICATE KEY UPDATE rate = VALUES(rate);

SET @tax_exempt_id = COALESCE(@tax_exempt_id, 't4444444-4444-4444-4444-444444444444');
SET @tax_iva16_id = COALESCE(@tax_iva16_id, 't1111111-1111-1111-1111-111111111111');

-- 2. Limpieza de Tablas Transaccionales y Catálogos Operativos Anteriores
DELETE FROM sales_payments;
DELETE FROM sales_invoice_items;
DELETE FROM sales_invoices;
DELETE FROM sales_quotation_items;
DELETE FROM sales_quotations;
DELETE FROM delivery_note_items;
DELETE FROM delivery_notes;
DELETE FROM customer_note_applications;
DELETE FROM customer_note_items;
DELETE FROM customer_notes;
DELETE FROM receivables;
DELETE FROM purchase_payments;
DELETE FROM purchase_invoice_items;
DELETE FROM purchase_invoices;
DELETE FROM payables;
DELETE FROM supplier_note_applications;
DELETE FROM supplier_note_items;
DELETE FROM supplier_notes;
DELETE FROM goods_receipt_items;
DELETE FROM goods_receipts;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM tax_withholdings_iva;
DELETE FROM tax_withholdings_islr;
DELETE FROM cash_shift_deposits;
DELETE FROM cash_audit_notifications;
DELETE FROM cash_movements;
DELETE FROM fiscal_reports;
DELETE FROM cash_shifts;
DELETE FROM inventory_movements;
DELETE FROM inventory_adjustment_items;
DELETE FROM inventory_adjustments;
DELETE FROM inventory_transfer_items;
DELETE FROM inventory_transfers;
DELETE FROM product_lots;
DELETE FROM product_stocks;
DELETE FROM product_prices;
DELETE FROM product_locations;
DELETE FROM product_presentations;
DELETE FROM product_skus;
DELETE FROM supplier_products;
DELETE FROM price_history;
DELETE FROM price_change_items;
DELETE FROM price_change_batches;
DELETE FROM price_lists;
DELETE FROM products;
DELETE FROM presentations;
DELETE FROM units_of_measure;
DELETE FROM brands;
DELETE FROM subgroups;
DELETE FROM `groups`;
DELETE FROM departments;
DELETE FROM bank_reconciliations;
DELETE FROM bank_movements;
DELETE FROM bank_accounts;
DELETE FROM banks;
DELETE FROM customers;
DELETE FROM suppliers;
DELETE FROM restaurant_order_items;
DELETE FROM restaurant_orders;
DELETE FROM restaurant_table_closures;
DELETE FROM accounting_journal_lines;
DELETE FROM accounting_journal_entries;
DELETE FROM notifications;
DELETE FROM user_notification_preferences;
DELETE FROM email_logs;

-- 3. Bancos Oficiales Venezolanos (SUDEBAN)
INSERT INTO banks (id, code, name, is_active) VALUES
('b0134000-0000-0000-0000-000000000134', '0134', 'Banesco Banco Universal', 1),
('b0102000-0000-0000-0000-000000000102', '0102', 'Banco de Venezuela S.A.C.A.', 1),
('b0105000-0000-0000-0000-000000000105', '0105', 'Banco Mercantil C.A.', 1),
('b0108000-0000-0000-0000-000000000108', '0108', 'BBVA Banco Provincial', 1),
('b0172000-0000-0000-0000-000000000172', '0172', 'Bancamiga Banco Universal', 1),
('b0191000-0000-0000-0000-000000000191', '0191', 'Banco Nacional de Crédito (BNC)', 1),
('b0114000-0000-0000-0000-000000000114', '0114', 'Bancaribe C.A.', 1),
('b0115000-0000-0000-0000-000000000115', '0115', 'Banco Exterior C.A.', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 4. Cuentas Bancarias Operativas (VES y USD Custodia)
INSERT INTO bank_accounts (id, company_id, bank_id, branch_id, account_number, account_type, currency, description, current_balance, is_active) VALUES
('acc11111-0000-0000-0000-000000000001', @company_id, 'b0134000-0000-0000-0000-000000000134', @branch_id, '01340001121234567890', 'CURRENT', 'VES', 'Banesco Principal Corriente Operativa (Bs.)', 154200.50, 1),
('acc11111-0000-0000-0000-000000000002', @company_id, 'b0102000-0000-0000-0000-000000000102', @branch_id, '01020110349876543210', 'CURRENT', 'VES', 'Banco de Venezuela Nómina y Recaudación (Bs.)', 89340.20, 1),
('acc11111-0000-0000-0000-000000000003', @company_id, 'b0105000-0000-0000-0000-000000000105', @branch_id, '01050022881122334455', 'CURRENT', 'VES', 'Mercantil Recaudación POS (Bs.)', 67450.00, 1),
('acc11111-0000-0000-0000-000000000004', @company_id, 'b0172000-0000-0000-0000-000000000172', @branch_id, '01720111559988776655', 'CUSTODY_USD', 'USD', 'Bancamiga Cuenta Especial Custodia Divisas ($)', 12850.00, 1),
('acc11111-0000-0000-0000-000000000005', @company_id, 'b0134000-0000-0000-0000-000000000134', @branch_id, '01340999775544332211', 'CUSTODY_USD', 'USD', 'Banesco Cuenta Verde Libre Convertibilidad ($)', 24600.00, 1);

-- 5. Proveedores Venezolanos de Consumo Masivo
INSERT INTO suppliers (id, company_id, rif, name, fiscal_address, phone, email, is_resident, islr_concept_code, credit_limit, payment_terms_days, is_active) VALUES
('sup11111-0000-0000-0000-000000000001', @company_id, 'J-00006548-0', 'ALIMENTOS POLAR COMERCIAL C.A.', 'Av. 4, Los Cortijos de Lourdes, Caracas', '+58 212 202-3111', 'atencion.proveedor@empresaspolar.com', 1, 'SERV_IND', 50000.00, 30, 1),
('sup11111-0000-0000-0000-000000000002', @company_id, 'J-00034567-8', 'NESTLE VENEZUELA S.A.', 'Av. Eugenio Mendoza, Edif. Nestlé, La Urbina, Caracas', '+58 212 201-0111', 'pedidos@ve.nestle.com', 1, 'SERV_IND', 40000.00, 30, 1),
('sup11111-0000-0000-0000-000000000003', @company_id, 'J-00012398-4', 'MONDELEZ VZLA S.A.', 'Urb. Industrial Castillito, Valencia, Carabobo', '+58 241 874-1100', 'atencion.pedidos@mdlz.com', 1, 'SERV_IND', 25000.00, 21, 1),
('sup11111-0000-0000-0000-000000000004', @company_id, 'J-00028912-1', 'C.A. RON SANTA TERESA', 'Hacienda Santa Teresa, El Consejo, Edo. Aragua', '+58 244 395-5111', 'distribucion@santateresa.com.ve', 1, 'SERV_IND', 35000.00, 30, 1),
('sup11111-0000-0000-0000-000000000005', @company_id, 'J-00045678-9', 'CERVECERIA POLAR C.A.', 'Av. 2da, Los Cortijos de Lourdes, Caracas', '+58 212 202-7777', 'ventas.cerveceria@empresaspolar.com', 1, 'SERV_IND', 60000.00, 15, 1),
('sup11111-0000-0000-0000-000000000006', @company_id, 'J-00011223-3', 'C.A. CERVECERIA REGIONAL', 'Zona Industrial II, Maracaibo, Edo. Zulia', '+58 261 736-2211', 'contacto@cerveceriaregional.com', 1, 'SERV_IND', 30000.00, 15, 1),
('sup11111-0000-0000-0000-000000000007', @company_id, 'J-00067890-1', 'PLUMROSE LATINOAMERICANA C.A.', 'Av. Sucre, Los Dos Caminos, Caracas', '+58 212 284-4411', 'ventas@plumrose.com', 1, 'SERV_IND', 30000.00, 21, 1),
('sup11111-0000-0000-0000-000000000008', @company_id, 'J-00078901-2', 'PAISA INDUSTRIAL C.A.', 'Carretera Panamericana Km 18, Los Teques, Edo. Miranda', '+58 212 383-1122', 'contacto@paisa.com.ve', 1, 'SERV_IND', 20000.00, 15, 1),
('sup11111-0000-0000-0000-000000000009', @company_id, 'J-00089012-3', 'GALLETAS PUIG C.A.', 'Calle Vargas, Boleíta Norte, Caracas', '+58 212 239-5566', 'pedidos@puig.com.ve', 1, 'SERV_IND', 18000.00, 21, 1),
('sup11111-0000-0000-0000-000000000010', @company_id, 'J-00090123-4', 'CENTRAL EL PALMAR S.A.', 'Carretera San Mateo, San Mateo, Edo. Aragua', '+58 244 321-4400', 'azucar@elpalmar.com.ve', 1, 'SERV_IND', 35000.00, 30, 1),
('sup11111-0000-0000-0000-000000000011', @company_id, 'J-00054321-0', 'CARGILL DE VENEZUELA S.R.L.', 'Av. Francisco de Miranda, Edif. Parque Cristal, Caracas', '+58 212 285-2233', 'ventas@cargill.com.ve', 1, 'SERV_IND', 45000.00, 30, 1),
('sup11111-0000-0000-0000-000000000012', @company_id, 'J-00043210-9', 'INDUSTRIAS DIANA C.A.', 'Zona Industrial Municipal Norte, Valencia, Carabobo', '+58 241 871-6600', 'ventas@diana.com.ve', 1, 'SERV_IND', 25000.00, 21, 1),
('sup11111-0000-0000-0000-000000000013', @company_id, 'J-00032109-8', 'COLGATE-PALMOLIVE C.A.', 'Av. Diego Cisneros, Los Ruices, Caracas', '+58 212 207-1111', 'atencion@colgate.com.ve', 1, 'SERV_IND', 40000.00, 30, 1),
('sup11111-0000-0000-0000-000000000014', @company_id, 'J-00021098-7', 'PROCTER & GAMBLE DE VENEZUELA S.C.A.', 'Edif. P&G, Calle Altagracia, La Trinidad, Caracas', '+58 212 904-4111', 'contacto@pg.com.ve', 1, 'SERV_IND', 50000.00, 30, 1),
('sup11111-0000-0000-0000-000000000015', @company_id, 'J-00010987-6', 'KIMBERLY-CLARK VENEZUELA', 'Zona Industrial La Hamaca, Maracay, Aragua', '+58 243 236-8800', 'atencion@kcc.com.ve', 1, 'SERV_IND', 25000.00, 21, 1),
('sup11111-0000-0000-0000-000000000016', @company_id, 'J-30129845-0', 'AVICOLA LA MORITA C.A.', 'Carretera Nacional Turmero, Turmero, Edo. Aragua', '+58 244 663-1200', 'ventas@lamorita.com.ve', 1, 'SERV_IND', 20000.00, 15, 1),
('sup11111-0000-0000-0000-000000000017', @company_id, 'J-30981234-5', 'FRIGOCENTRO CARNICOS C.A.', 'Zona Industrial Sur, Valencia, Edo. Carabobo', '+58 241 832-5544', 'pedidos@frigocentro.com.ve', 1, 'SERV_IND', 35000.00, 15, 1),
('sup11111-0000-0000-0000-000000000018', @company_id, 'J-40123987-6', 'DISTRIBUIDORA HORTICOLA DE LOS ANDES C.A.', 'Mercado Mayorista de Barquisimeto, Edo. Lara', '+58 251 269-3322', 'horticola.andes@gmail.com', 1, 'SERV_IND', 15000.00, 10, 1);

-- 6. Clientes Venezolanos Diversificados
INSERT INTO customers (id, company_id, doc_type, doc_number, name, address, phone, email, is_special_taxpayer, credit_enabled, credit_limit, payment_terms_days, is_active) VALUES
('cli11111-0000-0000-0000-000000000001', @company_id, 'J', '401298456', 'AUTOMERCADOS Y BODEGONES SAN ANTONIO C.A.', 'Av. Las Delicias, Maracay, Edo. Aragua', '+58 243 241-9988', 'compras@sanantonio.com.ve', 1, 1, 15000.00, 21, 1),
('cli11111-0000-0000-0000-000000000002', @company_id, 'J', '409812345', 'BODEGÓN Y RESTAURANT EL PORTÓN GOURMET C.A.', 'Calle 72 con Av. Bella Vista, Maracaibo, Zulia', '+58 261 792-8811', 'elportongourmet@gmail.com', 0, 1, 8000.00, 15, 1),
('cli11111-0000-0000-0000-000000000003', @company_id, 'J', '501239874', 'INVERSIONES RESTAURANTE EL ASADOR CARACAS C.A.', 'Av. Blandín, CC San Ignacio, Caracas', '+58 212 263-4455', 'administracion@elasador.com.ve', 1, 1, 12000.00, 15, 1),
('cli11111-0000-0000-0000-000000000004', @company_id, 'J', '314567890', 'PANADERÍA Y PASTELERÍA FLOR DE LIS C.A.', 'Av. Bolívar Norte, Valencia, Edo. Carabobo', '+58 241 821-6677', 'flordelispan@gmail.com', 0, 1, 5000.00, 15, 1),
('cli11111-0000-0000-0000-000000000005', @company_id, 'J', '412398456', 'COMERCIALIZADORA ALIMENTOS MARGARITA S.A.', 'Av. 4 de Mayo, Porlamar, Edo. Nueva Esparta', '+58 295 264-1122', 'margaritacompras@gmail.com', 1, 1, 20000.00, 30, 1),
('cli11111-0000-0000-0000-000000000006', @company_id, 'V', '14567890', 'CARLOS ENRIQUE MENDOZA PÉREZ', 'Urb. Santa Mónica, Caracas', '+58 414 111-2233', 'cmendoza@gmail.com', 0, 1, 500.00, 15, 1),
('cli11111-0000-0000-0000-000000000007', @company_id, 'V', '18901234', 'MARÍA ALEJANDRA RODRÍGUEZ SILVA', 'Urb. El Rosal, Chacao, Caracas', '+58 412 333-4455', 'mrodriguez@gmail.com', 0, 1, 800.00, 15, 1),
('cli11111-0000-0000-0000-000000000008', @company_id, 'V', '12345678', 'GABRIEL JOSÉ HERNÁNDEZ SÁNCHEZ', 'Urb. La Trigaleña, Valencia, Carabobo', '+58 414 777-8899', 'ghernandez@hotmail.com', 0, 0, 0.00, 0, 1),
('cli11111-0000-0000-0000-000000000009', @company_id, 'V', '21345678', 'ANDREÍNA CHIRINOS ALVARADO', 'Av. Fuerzas Armadas, Maracaibo, Zulia', '+58 424 666-5544', 'achirinos@gmail.com', 0, 0, 0.00, 0, 1),
('cli11111-0000-0000-0000-000000000010', @company_id, 'V', '10987654', 'ROBERTO ANTONIO SALAZAR GÓMEZ', 'Sector Tierra Negra, Maracaibo, Zulia', '+58 416 888-9900', 'rsalazar@yahoo.com', 0, 1, 300.00, 10, 1);

-- 7. Departamentos, Grupos y Marcas
INSERT INTO departments (id, company_id, code, name, description, is_active) VALUES
('dep11111-0000-0000-0000-000000000001', @company_id, 'DEP-VIV', 'Víveres y Despensa', 'Granos, harinas, pastas, aceites, enlatados y abarrotes', 1),
('dep11111-0000-0000-0000-000000000002', @company_id, 'DEP-REF', 'Lácteos y Refrigerados', 'Leches, quesos, embutidos y derivados', 1),
('dep11111-0000-0000-0000-000000000003', @company_id, 'DEP-CAR', 'Carnicería y Aves', 'Carnes de res, pollo beneficiado, cerdo y charcutería fresca', 1),
('dep11111-0000-0000-0000-000000000004', @company_id, 'DEP-BEB', 'Bebidas y Refrescos', 'Gaseosas, aguas, jugos y maltas', 1),
('dep11111-0000-0000-0000-000000000005', @company_id, 'DEP-LIC', 'Licores y Cervezas', 'Cervezas nacionales, rones venezolanos y licores', 1),
('dep11111-0000-0000-0000-000000000006', @company_id, 'DEP-CP', 'Cuidado Personal y Farmacia', 'Cuidado oral, jabones, champús y toallas higiénicas', 1),
('dep11111-0000-0000-0000-000000000007', @company_id, 'DEP-LIM', 'Limpieza del Hogar', 'Detergentes, cloros, lavaplatos y desinfectantes', 1),
('dep11111-0000-0000-0000-000000000008', @company_id, 'DEP-FRU', 'Frutas y Hortalizas', 'Frutas frescas, verduras, tubérculos y legumbres', 1);

INSERT INTO `groups` (id, department_id, code, name, is_active) VALUES
('grp11111-0000-0000-0000-000000000001', 'dep11111-0000-0000-0000-000000000001', 'GRP-HAR', 'Harinas y Mezclas', 1),
('grp11111-0000-0000-0000-000000000002', 'dep11111-0000-0000-0000-000000000001', 'GRP-ARR', 'Arroces y Granos', 1),
('grp11111-0000-0000-0000-000000000003', 'dep11111-0000-0000-0000-000000000001', 'GRP-PAS', 'Pastas Alimenticias', 1),
('grp11111-0000-0000-0000-000000000004', 'dep11111-0000-0000-0000-000000000001', 'GRP-ACE', 'Aceites y Mantecas', 1),
('grp11111-0000-0000-0000-000000000005', 'dep11111-0000-0000-0000-000000000001', 'GRP-ENL', 'Enlatados y Conservas', 1),
('grp11111-0000-0000-0000-000000000006', 'dep11111-0000-0000-0000-000000000001', 'GRP-DUL', 'Azúcar, Café y Chocolates', 1),
('grp11111-0000-0000-0000-000000000007', 'dep11111-0000-0000-0000-000000000001', 'GRP-GAL', 'Galletas y Confitería', 1),
('grp11111-0000-0000-0000-000000000008', 'dep11111-0000-0000-0000-000000000001', 'GRP-SAL', 'Salsas y Condimentos', 1),
('grp11111-0000-0000-0000-000000000009', 'dep11111-0000-0000-0000-000000000002', 'GRP-LEC', 'Leches y Lácteos', 1),
('grp11111-0000-0000-0000-000000000010', 'dep11111-0000-0000-0000-000000000002', 'GRP-QUE', 'Quesos y Mantequillas', 1),
('grp11111-0000-0000-0000-000000000011', 'dep11111-0000-0000-0000-000000000002', 'GRP-EMB', 'Embutidos y Madurados', 1),
('grp11111-0000-0000-0000-000000000012', 'dep11111-0000-0000-0000-000000000003', 'GRP-RES', 'Carne de Res', 1),
('grp11111-0000-0000-0000-000000000013', 'dep11111-0000-0000-0000-000000000003', 'GRP-AVE', 'Pollo y Huevos', 1),
('grp11111-0000-0000-0000-000000000014', 'dep11111-0000-0000-0000-000000000003', 'GRP-CER', 'Cerdo y Cortes', 1),
('grp11111-0000-0000-0000-000000000015', 'dep11111-0000-0000-0000-000000000004', 'GRP-REF', 'Refrescos y Gaseosas', 1),
('grp11111-0000-0000-0000-000000000016', 'dep11111-0000-0000-0000-000000000004', 'GRP-AGU', 'Aguas y Jugos', 1),
('grp11111-0000-0000-0000-000000000017', 'dep11111-0000-0000-0000-000000000004', 'GRP-MAL', 'Maltas', 1),
('grp11111-0000-0000-0000-000000000018', 'dep11111-0000-0000-0000-000000000005', 'GRP-CERV', 'Cervezas', 1),
('grp11111-0000-0000-0000-000000000019', 'dep11111-0000-0000-0000-000000000005', 'GRP-RON', 'Rones y Espirituosos', 1),
('grp11111-0000-0000-0000-000000000020', 'dep11111-0000-0000-0000-000000000006', 'GRP-HIG', 'Higiene y Cuidado Oral', 1),
('grp11111-0000-0000-0000-000000000021', 'dep11111-0000-0000-0000-000000000006', 'GRP-CAP', 'Cuidado Capilar', 1),
('grp11111-0000-0000-0000-000000000022', 'dep11111-0000-0000-0000-000000000006', 'GRP-PAP', 'Papel Higiénico y Pañales', 1),
('grp11111-0000-0000-0000-000000000023', 'dep11111-0000-0000-0000-000000000007', 'GRP-DET', 'Detergentes y Jabones', 1),
('grp11111-0000-0000-0000-000000000024', 'dep11111-0000-0000-0000-000000000007', 'GRP-DESI', 'Desinfectantes y Cloros', 1),
('grp11111-0000-0000-0000-000000000025', 'dep11111-0000-0000-0000-000000000007', 'GRP-LAV', 'Lavaplatos y Limpieza Cocina', 1),
('grp11111-0000-0000-0000-000000000026', 'dep11111-0000-0000-0000-000000000008', 'GRP-HOR', 'Verduras y Hortalizas', 1);

INSERT INTO brands (id, company_id, name, is_active) VALUES
(UUID(), @company_id, 'P.A.N.', 1),
(UUID(), @company_id, 'Mavesa', 1),
(UUID(), @company_id, 'Primor', 1),
(UUID(), @company_id, 'Mary', 1),
(UUID(), @company_id, 'Mazeite', 1),
(UUID(), @company_id, 'Diana', 1),
(UUID(), @company_id, 'Ronco', 1),
(UUID(), @company_id, 'La Lucha', 1),
(UUID(), @company_id, 'Montalbán', 1),
(UUID(), @company_id, 'Fama de América', 1),
(UUID(), @company_id, 'Toddy', 1),
(UUID(), @company_id, 'Savoy', 1),
(UUID(), @company_id, 'Puig', 1),
(UUID(), @company_id, 'Club Social', 1),
(UUID(), @company_id, 'Oreo', 1),
(UUID(), @company_id, 'La Campesina', 1),
(UUID(), @company_id, 'Mi Vaca', 1),
(UUID(), @company_id, 'Paisa', 1),
(UUID(), @company_id, 'Torondoy', 1),
(UUID(), @company_id, 'Plumrose', 1),
(UUID(), @company_id, 'La Morita', 1),
(UUID(), @company_id, 'Frigocentro', 1),
(UUID(), @company_id, 'Pepsi', 1),
(UUID(), @company_id, '7Up', 1),
(UUID(), @company_id, 'Minalba', 1),
(UUID(), @company_id, 'Maltín Polar', 1),
(UUID(), @company_id, 'Polar Pilsen', 1),
(UUID(), @company_id, 'Polar Light', 1),
(UUID(), @company_id, 'Regional', 1),
(UUID(), @company_id, 'Santa Teresa', 1),
(UUID(), @company_id, 'Cacique', 1),
(UUID(), @company_id, 'Colgate', 1),
(UUID(), @company_id, 'Protex', 1),
(UUID(), @company_id, 'Pantene', 1),
(UUID(), @company_id, 'Rexona', 1),
(UUID(), @company_id, 'Scott', 1),
(UUID(), @company_id, 'Ariel', 1),
(UUID(), @company_id, 'Clorox', 1),
(UUID(), @company_id, 'Axion', 1),
(UUID(), @company_id, 'Mistolín', 1);

-- 8. Listas de Precios
SET @pl_detal = 'pl111111-0000-0000-0000-000000000001';
SET @pl_mayor = 'pl111111-0000-0000-0000-000000000002';
SET @pl_vip   = 'pl111111-0000-0000-0000-000000000003';

INSERT INTO price_lists (id, company_id, code, name, currency, is_default, is_active)
VALUES 
  (@pl_detal, @company_id, 'PL-DETAL', 'Precio Detal / Al Mayor', 'USD', 1, 1),
  (@pl_mayor, @company_id, 'PL-MAYOR', 'Precio Mayorista', 'USD', 0, 1),
  (@pl_vip, @company_id, 'PL-ESPECIAL', 'Precio Cliente Especial', 'USD', 0, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 9. Catálogo Extenso de 55 Productos de Hipermercado (con SKUs, Precios, Lotes y Stocks)

-- Producto 1: Harina P.A.N. Blanca 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000001', @company_id, 'HAR-PAN-BLA', '7591012300014', 'Harina P.A.N. Blanca 1 Kg', 'Harina de maíz precocida blanca tradicional',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000001', NULL, 'sup11111-0000-0000-0000-000000000001',
  'P.A.N.', 'KG', 1.05, 1.4, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000001', 'HAR-PAN-BLA', '7591012300014', 'SKU Principal Harina P.A.N. Blanca 1 Kg', 1, 1.05, 1.4, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000001', @pl_detal, 1.4, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000001', @pl_mayor, 1.26, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000001', @pl_vip, 1.19, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000001', 'Empaque Individual', 'HAR-PAN-BLA', '7591012300014', 'KG', 1.0000, 1.05, 1.4, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000001', 'Bulto x 12 Unidades', 'HAR-PAN-BLA-B12', '7591012300019', 'BULTO', 12, 11.97, 15.46, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000001', @wh_main, 500, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000001', @wh_main, 'Pasillo 1A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000001', @wh_main, 'LOT-HAR-PAN-BLA-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 500, 500, 0, 1.05, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000001', @wh_store, 120, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000001', @wh_store, 'Pasillo 1A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 2: Harina P.A.N. Amarilla 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000002', @company_id, 'HAR-PAN-AMA', '7591012300021', 'Harina P.A.N. Amarilla 1 Kg', 'Harina de maíz precocida amarilla',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000001', NULL, 'sup11111-0000-0000-0000-000000000001',
  'P.A.N.', 'KG', 1.1, 1.45, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000002', 'HAR-PAN-AMA', '7591012300021', 'SKU Principal Harina P.A.N. Amarilla 1 Kg', 1, 1.1, 1.45, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000002', @pl_detal, 1.45, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000002', @pl_mayor, 1.3, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000002', @pl_vip, 1.23, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000002', 'Empaque Individual', 'HAR-PAN-AMA', '7591012300021', 'KG', 1.0000, 1.1, 1.45, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000002', 'Bulto x 12 Unidades', 'HAR-PAN-AMA-B12', '7591012300029', 'BULTO', 12, 12.54, 16.01, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000002', @wh_main, 300, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000002', @wh_main, 'Pasillo 1A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000002', @wh_main, 'LOT-HAR-PAN-AMA-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 300, 300, 0, 1.1, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000002', @wh_store, 80, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000002', @wh_store, 'Pasillo 1A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 3: Arroz Primor Clásico Grano Entero 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000003', @company_id, 'ARR-PRI-001', '7591012300038', 'Arroz Primor Clásico Grano Entero 1 Kg', 'Arroz blanco de primera seleccionado',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000002', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Primor', 'KG', 1.15, 1.55, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000003', 'ARR-PRI-001', '7591012300038', 'SKU Principal Arroz Primor Clásico Grano Entero 1 Kg', 1, 1.15, 1.55, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000003', @pl_detal, 1.55, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000003', @pl_mayor, 1.4, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000003', @pl_vip, 1.32, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000003', 'Empaque Individual', 'ARR-PRI-001', '7591012300038', 'KG', 1.0000, 1.15, 1.55, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000003', 'Bulto x 12 Unidades', 'ARR-PRI-001-B12', '7591012300039', 'BULTO', 12, 13.11, 17.11, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000003', @wh_main, 450, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000003', @wh_main, 'Pasillo 1B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000003', @wh_main, 'LOT-ARR-PRI-001-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 450, 450, 0, 1.15, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000003', @wh_store, 100, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000003', @wh_store, 'Pasillo 1B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 4: Arroz Mary Tradicional 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000004', @company_id, 'ARR-MAR-001', '7591012300045', 'Arroz Mary Tradicional 1 Kg', 'Arroz blanco enriquecido con hierro y vitaminas',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000002', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Mary', 'KG', 1.2, 1.6, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000004', 'ARR-MAR-001', '7591012300045', 'SKU Principal Arroz Mary Tradicional 1 Kg', 1, 1.2, 1.6, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000004', @pl_detal, 1.6, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000004', @pl_mayor, 1.44, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000004', @pl_vip, 1.36, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000004', 'Empaque Individual', 'ARR-MAR-001', '7591012300045', 'KG', 1.0000, 1.2, 1.6, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000004', 'Bulto x 12 Unidades', 'ARR-MAR-001-B12', '7591012300049', 'BULTO', 12, 13.68, 17.66, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000004', @wh_main, 400, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000004', @wh_main, 'Pasillo 1B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000004', @wh_main, 'LOT-ARR-MAR-001-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 400, 400, 0, 1.2, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000004', @wh_store, 90, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000004', @wh_store, 'Pasillo 1B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 5: Pasta Primor Spaghetti 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000005', @company_id, 'PAS-PRI-SPA', '7591012300052', 'Pasta Primor Spaghetti 1 Kg', 'Pasta larga de sémola de trigo durum',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000003', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Primor', 'KG', 1.3, 1.75, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000005', 'PAS-PRI-SPA', '7591012300052', 'SKU Principal Pasta Primor Spaghetti 1 Kg', 1, 1.3, 1.75, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000005', @pl_detal, 1.75, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000005', @pl_mayor, 1.57, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000005', @pl_vip, 1.49, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000005', 'Empaque Individual', 'PAS-PRI-SPA', '7591012300052', 'KG', 1.0000, 1.3, 1.75, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000005', 'Bulto x 12 Unidades', 'PAS-PRI-SPA-B12', '7591012300059', 'BULTO', 12, 14.82, 19.32, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000005', @wh_main, 380, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000005', @wh_main, 'Pasillo 1C', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000005', @wh_main, 'LOT-PAS-PRI-SPA-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 380, 380, 0, 1.3, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000005', @wh_store, 110, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000005', @wh_store, 'Pasillo 1C', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 6: Pasta Ronco Corta Plumas 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000006', @company_id, 'PAS-RON-PLU', '7591012300069', 'Pasta Ronco Corta Plumas 1 Kg', 'Pasta corta tipo plumas para guisados',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000003', NULL, 'sup11111-0000-0000-0000-000000000011',
  'Ronco', 'KG', 1.25, 1.7, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000006', 'PAS-RON-PLU', '7591012300069', 'SKU Principal Pasta Ronco Corta Plumas 1 Kg', 1, 1.25, 1.7, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000006', @pl_detal, 1.7, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000006', @pl_mayor, 1.53, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000006', @pl_vip, 1.44, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000006', 'Empaque Individual', 'PAS-RON-PLU', '7591012300069', 'KG', 1.0000, 1.25, 1.7, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000006', 'Bulto x 12 Unidades', 'PAS-RON-PLU-B12', '7591012300069', 'BULTO', 12, 14.25, 18.77, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000006', @wh_main, 320, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000006', @wh_main, 'Pasillo 1C', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000006', @wh_main, 'LOT-PAS-RON-PLU-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 320, 320, 0, 1.25, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000006', @wh_store, 75, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000006', @wh_store, 'Pasillo 1C', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 7: Aceite Mazeite Puro de Maíz 1 Litro
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000007', @company_id, 'ACE-MAZ-LIT', '7591012300076', 'Aceite Mazeite Puro de Maíz 1 Litro', 'Aceite vegetal refinado comestible 100% puro maíz',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000004', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Mazeite', 'LITRO', 3.1, 4.1, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000007', 'ACE-MAZ-LIT', '7591012300076', 'SKU Principal Aceite Mazeite Puro de Maíz 1 Litro', 1, 3.1, 4.1, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000007', @pl_detal, 4.1, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000007', @pl_mayor, 3.69, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000007', @pl_vip, 3.48, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000007', 'Empaque Individual', 'ACE-MAZ-LIT', '7591012300076', 'LITRO', 1.0000, 3.1, 4.1, 'USD', 1, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000007', @wh_main, 250, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000007', @wh_main, 'Pasillo 2A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000007', @wh_main, 'LOT-ACE-MAZ-LIT-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 250, 250, 0, 3.1, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000007', @wh_store, 60, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000007', @wh_store, 'Pasillo 2A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 8: Aceite Comestible Diana 1 Litro
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000008', @company_id, 'ACE-DIA-LIT', '7591012300083', 'Aceite Comestible Diana 1 Litro', 'Aceite vegetal comestible mezcla enriquecida',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000004', NULL, 'sup11111-0000-0000-0000-000000000012',
  'Diana', 'LITRO', 2.2, 2.95, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000008', 'ACE-DIA-LIT', '7591012300083', 'SKU Principal Aceite Comestible Diana 1 Litro', 1, 2.2, 2.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000008', @pl_detal, 2.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000008', @pl_mayor, 2.66, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000008', @pl_vip, 2.51, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000008', 'Empaque Individual', 'ACE-DIA-LIT', '7591012300083', 'LITRO', 1.0000, 2.2, 2.95, 'USD', 1, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000008', @wh_main, 220, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000008', @wh_main, 'Pasillo 2A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000008', @wh_main, 'LOT-ACE-DIA-LIT-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 220, 220, 0, 2.2, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000008', @wh_store, 50, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000008', @wh_store, 'Pasillo 2A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 9: Azúcar Refinada Montalbán 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000009', @company_id, 'AZU-MON-001', '7591012300090', 'Azúcar Refinada Montalbán 1 Kg', 'Azúcar refinada blanca de caña de azúcar',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000006', NULL, 'sup11111-0000-0000-0000-000000000010',
  'Montalbán', 'KG', 1.1, 1.5, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000009', 'AZU-MON-001', '7591012300090', 'SKU Principal Azúcar Refinada Montalbán 1 Kg', 1, 1.1, 1.5, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000009', @pl_detal, 1.5, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000009', @pl_mayor, 1.35, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000009', @pl_vip, 1.27, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000009', 'Empaque Individual', 'AZU-MON-001', '7591012300090', 'KG', 1.0000, 1.1, 1.5, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000009', 'Bulto x 12 Unidades', 'AZU-MON-001-B12', '7591012300099', 'BULTO', 12, 12.54, 16.56, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000009', @wh_main, 500, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000009', @wh_main, 'Pasillo 2B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000009', @wh_main, 'LOT-AZU-MON-001-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 500, 500, 0, 1.1, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000009', @wh_store, 150, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000009', @wh_store, 'Pasillo 2B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 10: Caraotas Negras Mary 500g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000010', @company_id, 'GRA-CAR-NEG', '7591012300106', 'Caraotas Negras Mary 500g', 'Granos negros seleccionados cocción rápida',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000002', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Mary', 'PAQ', 1.35, 1.85, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000010', 'GRA-CAR-NEG', '7591012300106', 'SKU Principal Caraotas Negras Mary 500g', 1, 1.35, 1.85, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000010', @pl_detal, 1.85, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000010', @pl_mayor, 1.67, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000010', @pl_vip, 1.57, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000010', 'Empaque Individual', 'GRA-CAR-NEG', '7591012300106', 'PAQ', 1.0000, 1.35, 1.85, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000010', 'Bulto x 12 Unidades', 'GRA-CAR-NEG-B12', '7591012300109', 'BULTO', 12, 15.39, 20.42, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000010', @wh_main, 200, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000010', @wh_main, 'Pasillo 2C', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000010', @wh_main, 'LOT-GRA-CAR-NEG-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 200, 200, 0, 1.35, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000010', @wh_store, 60, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000010', @wh_store, 'Pasillo 2C', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 11: Lentejas La Lucha 500g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000011', @company_id, 'GRA-LEN-LUC', '7591012300113', 'Lentejas La Lucha 500g', 'Lentejas de primera importadas',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000002', NULL, 'sup11111-0000-0000-0000-000000000011',
  'La Lucha', 'PAQ', 1.4, 1.95, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000011', 'GRA-LEN-LUC', '7591012300113', 'SKU Principal Lentejas La Lucha 500g', 1, 1.4, 1.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000011', @pl_detal, 1.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000011', @pl_mayor, 1.75, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000011', @pl_vip, 1.66, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000011', 'Empaque Individual', 'GRA-LEN-LUC', '7591012300113', 'PAQ', 1.0000, 1.4, 1.95, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000011', 'Bulto x 12 Unidades', 'GRA-LEN-LUC-B12', '7591012300119', 'BULTO', 12, 15.96, 21.53, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000011', @wh_main, 180, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000011', @wh_main, 'Pasillo 2C', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000011', @wh_main, 'LOT-GRA-LEN-LUC-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 180, 180, 0, 1.4, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000011', @wh_store, 45, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000011', @wh_store, 'Pasillo 2C', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 12: Café Fama de América Tostado 250g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000012', @company_id, 'CAF-FAM-250', '7591012300120', 'Café Fama de América Tostado 250g', 'Café molido gourmet venezolano aroma intenso',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000006', NULL, 'sup11111-0000-0000-0000-000000000012',
  'Fama de América', 'PAQ', 2.4, 3.25, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000012', 'CAF-FAM-250', '7591012300120', 'SKU Principal Café Fama de América Tostado 250g', 1, 2.4, 3.25, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000012', @pl_detal, 3.25, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000012', @pl_mayor, 2.93, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000012', @pl_vip, 2.76, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000012', 'Empaque Individual', 'CAF-FAM-250', '7591012300120', 'PAQ', 1.0000, 2.4, 3.25, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000012', 'Bulto x 12 Unidades', 'CAF-FAM-250-B12', '7591012300129', 'BULTO', 12, 27.36, 35.88, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000012', @wh_main, 280, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000012', @wh_main, 'Pasillo 3A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000012', @wh_main, 'LOT-CAF-FAM-250-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 280, 280, 0, 2.4, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000012', @wh_store, 70, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000012', @wh_store, 'Pasillo 3A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 13: Atún Margarita en Aceite 140g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000013', @company_id, 'ATU-MAR-ACE', '7591012300137', 'Atún Margarita en Aceite 140g', 'Lomo de atún aleta amarilla en aceite vegetal',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000005', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Primor', 'UNID', 1.45, 1.95, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000013', 'ATU-MAR-ACE', '7591012300137', 'SKU Principal Atún Margarita en Aceite 140g', 1, 1.45, 1.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000013', @pl_detal, 1.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000013', @pl_mayor, 1.75, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000013', @pl_vip, 1.66, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000013', 'Empaque Individual', 'ATU-MAR-ACE', '7591012300137', 'UNID', 1.0000, 1.45, 1.95, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000013', 'Bulto x 12 Unidades', 'ATU-MAR-ACE-B12', '7591012300139', 'BULTO', 12, 16.53, 21.53, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000013', @wh_main, 350, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000013', @wh_main, 'Pasillo 3B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000013', @wh_main, 'LOT-ATU-MAR-ACE-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 350, 350, 0, 1.45, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000013', @wh_store, 90, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000013', @wh_store, 'Pasillo 3B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 14: Sardinas en Aceite La Gaviota 170g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000014', @company_id, 'SAR-GAV-170', '7591012300144', 'Sardinas en Aceite La Gaviota 170g', 'Sardinas enteras en aceite vegetal',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000005', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Primor', 'UNID', 0.65, 0.95, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000014', 'SAR-GAV-170', '7591012300144', 'SKU Principal Sardinas en Aceite La Gaviota 170g', 1, 0.65, 0.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000014', @pl_detal, 0.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000014', @pl_mayor, 0.85, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000014', @pl_vip, 0.81, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000014', 'Empaque Individual', 'SAR-GAV-170', '7591012300144', 'UNID', 1.0000, 0.65, 0.95, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000014', 'Bulto x 12 Unidades', 'SAR-GAV-170-B12', '7591012300149', 'BULTO', 12, 7.41, 10.49, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000014', @wh_main, 400, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000014', @wh_main, 'Pasillo 3B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000014', @wh_main, 'LOT-SAR-GAV-170-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 400, 400, 0, 0.65, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000014', @wh_store, 120, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000014', @wh_store, 'Pasillo 3B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 15: Mayonesa Mavesa Frasco 445g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000015', @company_id, 'MAY-MAV-445', '7591012300151', 'Mayonesa Mavesa Frasco 445g', 'Mayonesa tradicional cremosa',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000008', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Mavesa', 'UNID', 2.6, 3.65, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000015', 'MAY-MAV-445', '7591012300151', 'SKU Principal Mayonesa Mavesa Frasco 445g', 1, 2.6, 3.65, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000015', @pl_detal, 3.65, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000015', @pl_mayor, 3.29, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000015', @pl_vip, 3.1, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000015', 'Empaque Individual', 'MAY-MAV-445', '7591012300151', 'UNID', 1.0000, 2.6, 3.65, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000015', 'Bulto x 12 Unidades', 'MAY-MAV-445-B12', '7591012300159', 'BULTO', 12, 29.64, 40.3, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000015', @wh_main, 260, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000015', @wh_main, 'Pasillo 3C', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000015', @wh_main, 'LOT-MAY-MAV-445-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 260, 260, 0, 2.6, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000015', @wh_store, 65, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000015', @wh_store, 'Pasillo 3C', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 16: Margarina Mavesa con Sal 500g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000016', @company_id, 'MAR-MAV-500', '7591012300168', 'Margarina Mavesa con Sal 500g', 'Margarina untable con sal',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000008', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Mavesa', 'UNID', 1.95, 2.75, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000016', 'MAR-MAV-500', '7591012300168', 'SKU Principal Margarina Mavesa con Sal 500g', 1, 1.95, 2.75, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000016', @pl_detal, 2.75, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000016', @pl_mayor, 2.48, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000016', @pl_vip, 2.34, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000016', 'Empaque Individual', 'MAR-MAV-500', '7591012300168', 'UNID', 1.0000, 1.95, 2.75, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000016', 'Bulto x 12 Unidades', 'MAR-MAV-500-B12', '7591012300169', 'BULTO', 12, 22.23, 30.36, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000016', @wh_main, 300, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000016', @wh_main, 'Pasillo 3C', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000016', @wh_main, 'LOT-MAR-MAV-500-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 300, 300, 0, 1.95, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000016', @wh_store, 80, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000016', @wh_store, 'Pasillo 3C', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 17: Modificador de Leche Toddy 400g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000017', @company_id, 'CHO-TOD-400', '7591012300175', 'Modificador de Leche Toddy 400g', 'Bebida achocolatada instantánea con vitaminas',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000006', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Toddy', 'PAQ', 2.8, 3.9, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000017', 'CHO-TOD-400', '7591012300175', 'SKU Principal Modificador de Leche Toddy 400g', 1, 2.8, 3.9, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000017', @pl_detal, 3.9, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000017', @pl_mayor, 3.51, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000017', @pl_vip, 3.31, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000017', 'Empaque Individual', 'CHO-TOD-400', '7591012300175', 'PAQ', 1.0000, 2.8, 3.9, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000017', 'Bulto x 12 Unidades', 'CHO-TOD-400-B12', '7591012300179', 'BULTO', 12, 31.92, 43.06, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000017', @wh_main, 180, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000017', @wh_main, 'Pasillo 4A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000017', @wh_main, 'LOT-CHO-TOD-400-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 180, 180, 0, 2.8, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000017', @wh_store, 45, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000017', @wh_store, 'Pasillo 4A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 18: Chocolate con Leche Savoy Carré 100g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000018', @company_id, 'CHO-SAV-CAR', '7591012300182', 'Chocolate con Leche Savoy Carré 100g', 'Tableta de chocolate con avellanas troceadas',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000006', NULL, 'sup11111-0000-0000-0000-000000000002',
  'Savoy', 'UNID', 1.85, 2.6, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000018', 'CHO-SAV-CAR', '7591012300182', 'SKU Principal Chocolate con Leche Savoy Carré 100g', 1, 1.85, 2.6, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000018', @pl_detal, 2.6, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000018', @pl_mayor, 2.34, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000018', @pl_vip, 2.21, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000018', 'Empaque Individual', 'CHO-SAV-CAR', '7591012300182', 'UNID', 1.0000, 1.85, 2.6, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000018', 'Bulto x 12 Unidades', 'CHO-SAV-CAR-B12', '7591012300189', 'BULTO', 12, 21.09, 28.7, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000018', @wh_main, 220, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000018', @wh_main, 'Pasillo 4A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000018', @wh_main, 'LOT-CHO-SAV-CAR-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 220, 220, 0, 1.85, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000018', @wh_store, 60, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000018', @wh_store, 'Pasillo 4A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 19: Galletas María Puig Paquete 150g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000019', @company_id, 'GAL-PUI-MAR', '7591012300199', 'Galletas María Puig Paquete 150g', 'Galletas dulces tradicionales de harina de trigo',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000007', NULL, 'sup11111-0000-0000-0000-000000000009',
  'Puig', 'PAQ', 0.85, 1.25, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000019', 'GAL-PUI-MAR', '7591012300199', 'SKU Principal Galletas María Puig Paquete 150g', 1, 0.85, 1.25, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000019', @pl_detal, 1.25, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000019', @pl_mayor, 1.13, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000019', @pl_vip, 1.06, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000019', 'Empaque Individual', 'GAL-PUI-MAR', '7591012300199', 'PAQ', 1.0000, 0.85, 1.25, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000019', 'Bulto x 12 Unidades', 'GAL-PUI-MAR-B12', '7591012300199', 'BULTO', 12, 9.69, 13.8, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000019', @wh_main, 420, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000019', @wh_main, 'Pasillo 4B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000019', @wh_main, 'LOT-GAL-PUI-MAR-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 420, 420, 0, 0.85, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000019', @wh_store, 110, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000019', @wh_store, 'Pasillo 4B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 20: Galletas Club Social Original 6 Pack
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000020', @company_id, 'GAL-CLU-SOC', '7591012300205', 'Galletas Club Social Original 6 Pack', 'Galletas saladas crujientes empacadas individualmente',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000007', NULL, 'sup11111-0000-0000-0000-000000000003',
  'Club Social', 'PAQ', 1.5, 2.1, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000020', 'GAL-CLU-SOC', '7591012300205', 'SKU Principal Galletas Club Social Original 6 Pack', 1, 1.5, 2.1, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000020', @pl_detal, 2.1, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000020', @pl_mayor, 1.89, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000020', @pl_vip, 1.78, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000020', 'Empaque Individual', 'GAL-CLU-SOC', '7591012300205', 'PAQ', 1.0000, 1.5, 2.1, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000020', 'Bulto x 12 Unidades', 'GAL-CLU-SOC-B12', '7591012300209', 'BULTO', 12, 17.1, 23.18, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000020', @wh_main, 360, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000020', @wh_main, 'Pasillo 4B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000020', @wh_main, 'LOT-GAL-CLU-SOC-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 360, 360, 0, 1.5, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000020', @wh_store, 95, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000020', @wh_store, 'Pasillo 4B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 21: Galletas Oreo Chocolate 108g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000021', @company_id, 'GAL-ORE-CHO', '7591012300212', 'Galletas Oreo Chocolate 108g', 'Galletas sándwich rellenas con crema dulce',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000001', 'grp11111-0000-0000-0000-000000000007', NULL, 'sup11111-0000-0000-0000-000000000003',
  'Oreo', 'PAQ', 0.95, 1.4, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000021', 'GAL-ORE-CHO', '7591012300212', 'SKU Principal Galletas Oreo Chocolate 108g', 1, 0.95, 1.4, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000021', @pl_detal, 1.4, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000021', @pl_mayor, 1.26, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000021', @pl_vip, 1.19, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000021', 'Empaque Individual', 'GAL-ORE-CHO', '7591012300212', 'PAQ', 1.0000, 0.95, 1.4, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000021', 'Bulto x 12 Unidades', 'GAL-ORE-CHO-B12', '7591012300219', 'BULTO', 12, 10.83, 15.46, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000021', @wh_main, 300, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000021', @wh_main, 'Pasillo 4B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000021', @wh_main, 'LOT-GAL-ORE-CHO-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 300, 300, 0, 0.95, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000021', @wh_store, 85, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000021', @wh_store, 'Pasillo 4B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 22: Leche en Polvo Completa La Campesina 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000022', @company_id, 'LEC-CAM-1KG', '7591012300229', 'Leche en Polvo Completa La Campesina 1 Kg', 'Leche completa pasteurizada instantánea',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000002', 'grp11111-0000-0000-0000-000000000009', NULL, 'sup11111-0000-0000-0000-000000000001',
  'La Campesina', 'KG', 6.8, 9.3, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000022', 'LEC-CAM-1KG', '7591012300229', 'SKU Principal Leche en Polvo Completa La Campesina 1 Kg', 1, 6.8, 9.3, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000022', @pl_detal, 9.3, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000022', @pl_mayor, 8.37, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000022', @pl_vip, 7.91, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000022', 'Empaque Individual', 'LEC-CAM-1KG', '7591012300229', 'KG', 1.0000, 6.8, 9.3, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000022', 'Bulto x 12 Unidades', 'LEC-CAM-1KG-B12', '7591012300229', 'BULTO', 12, 77.52, 102.67, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000022', @wh_main, 310, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000022', @wh_main, 'Pasillo 5A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000022', @wh_main, 'LOT-LEC-CAM-1KG-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 310, 310, 0, 6.8, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000022', @wh_store, 70, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000022', @wh_store, 'Pasillo 5A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 23: Leche Líquida Pasteurizada Mi Vaca 1 Litro
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000023', @company_id, 'LEC-MIV-LIT', '7591012300236', 'Leche Líquida Pasteurizada Mi Vaca 1 Litro', 'Leche líquida fresca entera refrigerada',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000002', 'grp11111-0000-0000-0000-000000000009', NULL, 'sup11111-0000-0000-0000-000000000008',
  'Mi Vaca', 'LITRO', 1.3, 1.8, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000023', 'LEC-MIV-LIT', '7591012300236', 'SKU Principal Leche Líquida Pasteurizada Mi Vaca 1 Litro', 1, 1.3, 1.8, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000023', @pl_detal, 1.8, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000023', @pl_mayor, 1.62, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000023', @pl_vip, 1.53, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000023', 'Empaque Individual', 'LEC-MIV-LIT', '7591012300236', 'LITRO', 1.0000, 1.3, 1.8, 'USD', 1, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000023', @wh_main, 180, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000023', @wh_main, 'Nevera Lácteos', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000023', @wh_main, 'LOT-LEC-MIV-LIT-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 180, 180, 0, 1.3, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000023', @wh_store, 40, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000023', @wh_store, 'Nevera Lácteos', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 24: Queso Blanco Pasteurizado Paisa 500g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000024', @company_id, 'QUE-PAI-500', '7591012300243', 'Queso Blanco Pasteurizado Paisa 500g', 'Queso blanco semiduro pasteurizado empacado al vacío',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000002', 'grp11111-0000-0000-0000-000000000010', NULL, 'sup11111-0000-0000-0000-000000000008',
  'Paisa', 'PAQ', 3.4, 4.8, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000024', 'QUE-PAI-500', '7591012300243', 'SKU Principal Queso Blanco Pasteurizado Paisa 500g', 1, 3.4, 4.8, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000024', @pl_detal, 4.8, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000024', @pl_mayor, 4.32, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000024', @pl_vip, 4.08, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000024', 'Empaque Individual', 'QUE-PAI-500', '7591012300243', 'PAQ', 1.0000, 3.4, 4.8, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000024', 'Bulto x 12 Unidades', 'QUE-PAI-500-B12', '7591012300249', 'BULTO', 12, 38.76, 52.99, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000024', @wh_main, 150, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000024', @wh_main, 'Nevera Lácteos', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000024', @wh_main, 'LOT-QUE-PAI-500-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 150, 150, 0, 3.4, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000024', @wh_store, 35, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000024', @wh_store, 'Nevera Lácteos', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 25: Queso Amarillo Torondoy Cuña 250g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000025', @company_id, 'QUE-TOR-250', '7591012300250', 'Queso Amarillo Torondoy Cuña 250g', 'Queso tipo gouda madurado nacional',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000002', 'grp11111-0000-0000-0000-000000000010', NULL, 'sup11111-0000-0000-0000-000000000008',
  'Torondoy', 'PAQ', 2.8, 3.95, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000025', 'QUE-TOR-250', '7591012300250', 'SKU Principal Queso Amarillo Torondoy Cuña 250g', 1, 2.8, 3.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000025', @pl_detal, 3.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000025', @pl_mayor, 3.56, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000025', @pl_vip, 3.36, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000025', 'Empaque Individual', 'QUE-TOR-250', '7591012300250', 'PAQ', 1.0000, 2.8, 3.95, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000025', 'Bulto x 12 Unidades', 'QUE-TOR-250-B12', '7591012300259', 'BULTO', 12, 31.92, 43.61, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000025', @wh_main, 120, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000025', @wh_main, 'Nevera Lácteos', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000025', @wh_main, 'LOT-QUE-TOR-250-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 120, 120, 0, 2.8, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000025', @wh_store, 30, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000025', @wh_store, 'Nevera Lácteos', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 26: Jamón Cocido Superior Plumrose 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000026', @company_id, 'JAM-PLU-SUP', '7591012300267', 'Jamón Cocido Superior Plumrose 1 Kg', 'Jamón cocido de pierna selecta pieza para rebanar',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000002', 'grp11111-0000-0000-0000-000000000011', NULL, 'sup11111-0000-0000-0000-000000000007',
  'Plumrose', 'KG', 7.5, 10.5, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000026', 'JAM-PLU-SUP', '7591012300267', 'SKU Principal Jamón Cocido Superior Plumrose 1 Kg', 1, 7.5, 10.5, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000026', @pl_detal, 10.5, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000026', @pl_mayor, 9.45, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000026', @pl_vip, 8.92, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000026', 'Empaque Individual', 'JAM-PLU-SUP', '7591012300267', 'KG', 1.0000, 7.5, 10.5, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000026', 'Bulto x 12 Unidades', 'JAM-PLU-SUP-B12', '7591012300269', 'BULTO', 12, 85.5, 115.92, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000026', @wh_main, 85, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000026', @wh_main, 'Charcutería', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000026', @wh_main, 'LOT-JAM-PLU-SUP-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 85, 85, 0, 7.5, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000026', @wh_store, 25, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000026', @wh_store, 'Charcutería', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 27: Salchichas Viena Plumrose Paquete 8 Unid.
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000027', @company_id, 'SAL-PLU-VIE', '7591012300274', 'Salchichas Viena Plumrose Paquete 8 Unid.', 'Salchichas tradicionales cocidas de cerdo y pollo',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000002', 'grp11111-0000-0000-0000-000000000011', NULL, 'sup11111-0000-0000-0000-000000000007',
  'Plumrose', 'PAQ', 1.7, 2.45, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000027', 'SAL-PLU-VIE', '7591012300274', 'SKU Principal Salchichas Viena Plumrose Paquete 8 Unid.', 1, 1.7, 2.45, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000027', @pl_detal, 2.45, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000027', @pl_mayor, 2.21, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000027', @pl_vip, 2.08, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000027', 'Empaque Individual', 'SAL-PLU-VIE', '7591012300274', 'PAQ', 1.0000, 1.7, 2.45, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000027', 'Bulto x 12 Unidades', 'SAL-PLU-VIE-B12', '7591012300279', 'BULTO', 12, 19.38, 27.05, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000027', @wh_main, 190, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000027', @wh_main, 'Charcutería', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000027', @wh_main, 'LOT-SAL-PLU-VIE-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 190, 190, 0, 1.7, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000027', @wh_store, 50, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000027', @wh_store, 'Charcutería', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 28: Tocineta Ahumada Plumrose 250g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000028', @company_id, 'TOC-PLU-250', '7591012300281', 'Tocineta Ahumada Plumrose 250g', 'Tocineta rebanada curada y ahumada',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000002', 'grp11111-0000-0000-0000-000000000011', NULL, 'sup11111-0000-0000-0000-000000000007',
  'Plumrose', 'PAQ', 2.9, 4.15, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000028', 'TOC-PLU-250', '7591012300281', 'SKU Principal Tocineta Ahumada Plumrose 250g', 1, 2.9, 4.15, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000028', @pl_detal, 4.15, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000028', @pl_mayor, 3.74, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000028', @pl_vip, 3.53, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000028', 'Empaque Individual', 'TOC-PLU-250', '7591012300281', 'PAQ', 1.0000, 2.9, 4.15, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000028', 'Bulto x 12 Unidades', 'TOC-PLU-250-B12', '7591012300289', 'BULTO', 12, 33.06, 45.82, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000028', @wh_main, 110, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000028', @wh_main, 'Charcutería', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000028', @wh_main, 'LOT-TOC-PLU-250-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 110, 110, 0, 2.9, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000028', @wh_store, 30, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000028', @wh_store, 'Charcutería', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 29: Pollo Entero Beneficiado La Morita 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000029', @company_id, 'CAR-POL-ENT', '7591012300298', 'Pollo Entero Beneficiado La Morita 1 Kg', 'Pollo fresco entero beneficiado sin vísceras',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000003', 'grp11111-0000-0000-0000-000000000013', NULL, 'sup11111-0000-0000-0000-000000000016',
  'La Morita', 'KG', 2.1, 2.9, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000029', 'CAR-POL-ENT', '7591012300298', 'SKU Principal Pollo Entero Beneficiado La Morita 1 Kg', 1, 2.1, 2.9, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000029', @pl_detal, 2.9, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000029', @pl_mayor, 2.61, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000029', @pl_vip, 2.46, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000029', 'Empaque Individual', 'CAR-POL-ENT', '7591012300298', 'KG', 1.0000, 2.1, 2.9, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000029', 'Bulto x 12 Unidades', 'CAR-POL-ENT-B12', '7591012300299', 'BULTO', 12, 23.94, 32.02, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000029', @wh_main, 250, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000029', @wh_main, 'Nevera Aves', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000029', @wh_main, 'LOT-CAR-POL-ENT-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 250, 250, 0, 2.1, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000029', @wh_store, 70, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000029', @wh_store, 'Nevera Aves', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 30: Pechuga de Pollo con Hueso 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000030', @company_id, 'CAR-PEC-POL', '7591012300304', 'Pechuga de Pollo con Hueso 1 Kg', 'Pechuga de pollo fresca de primera',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000003', 'grp11111-0000-0000-0000-000000000013', NULL, 'sup11111-0000-0000-0000-000000000016',
  'La Morita', 'KG', 3.4, 4.6, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000030', 'CAR-PEC-POL', '7591012300304', 'SKU Principal Pechuga de Pollo con Hueso 1 Kg', 1, 3.4, 4.6, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000030', @pl_detal, 4.6, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000030', @pl_mayor, 4.14, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000030', @pl_vip, 3.91, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000030', 'Empaque Individual', 'CAR-PEC-POL', '7591012300304', 'KG', 1.0000, 3.4, 4.6, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000030', 'Bulto x 12 Unidades', 'CAR-PEC-POL-B12', '7591012300309', 'BULTO', 12, 38.76, 50.78, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000030', @wh_main, 180, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000030', @wh_main, 'Nevera Aves', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000030', @wh_main, 'LOT-CAR-PEC-POL-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 180, 180, 0, 3.4, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000030', @wh_store, 50, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000030', @wh_store, 'Nevera Aves', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 31: Carne de Res Molida de Primera 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000031', @company_id, 'CAR-RES-MOL', '7591012300311', 'Carne de Res Molida de Primera 1 Kg', 'Carne molida magra de res fresca',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000003', 'grp11111-0000-0000-0000-000000000012', NULL, 'sup11111-0000-0000-0000-000000000017',
  'Frigocentro', 'KG', 5.2, 7.2, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000031', 'CAR-RES-MOL', '7591012300311', 'SKU Principal Carne de Res Molida de Primera 1 Kg', 1, 5.2, 7.2, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000031', @pl_detal, 7.2, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000031', @pl_mayor, 6.48, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000031', @pl_vip, 6.12, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000031', 'Empaque Individual', 'CAR-RES-MOL', '7591012300311', 'KG', 1.0000, 5.2, 7.2, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000031', 'Bulto x 12 Unidades', 'CAR-RES-MOL-B12', '7591012300319', 'BULTO', 12, 59.28, 79.49, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000031', @wh_main, 160, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000031', @wh_main, 'Carnicería', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000031', @wh_main, 'LOT-CAR-RES-MOL-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 160, 160, 0, 5.2, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000031', @wh_store, 40, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000031', @wh_store, 'Carnicería', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 32: Solomo de Cuerito Fresco 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000032', @company_id, 'CAR-RES-SOL', '7591012300328', 'Solomo de Cuerito Fresco 1 Kg', 'Corte parrillero tierno de res nacional',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000003', 'grp11111-0000-0000-0000-000000000012', NULL, 'sup11111-0000-0000-0000-000000000017',
  'Frigocentro', 'KG', 6.8, 9.4, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000032', 'CAR-RES-SOL', '7591012300328', 'SKU Principal Solomo de Cuerito Fresco 1 Kg', 1, 6.8, 9.4, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000032', @pl_detal, 9.4, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000032', @pl_mayor, 8.46, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000032', @pl_vip, 7.99, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000032', 'Empaque Individual', 'CAR-RES-SOL', '7591012300328', 'KG', 1.0000, 6.8, 9.4, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000032', 'Bulto x 12 Unidades', 'CAR-RES-SOL-B12', '7591012300329', 'BULTO', 12, 77.52, 103.78, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000032', @wh_main, 120, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000032', @wh_main, 'Carnicería', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000032', @wh_main, 'LOT-CAR-RES-SOL-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 120, 120, 0, 6.8, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000032', @wh_store, 30, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000032', @wh_store, 'Carnicería', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 33: Cartón de Huevos La Morita 30 Unid.
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000033', @company_id, 'HUE-MOR-CRT', '7591012300335', 'Cartón de Huevos La Morita 30 Unid.', 'Huevos de gallina frescos seleccionados clase A',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000003', 'grp11111-0000-0000-0000-000000000013', NULL, 'sup11111-0000-0000-0000-000000000016',
  'La Morita', 'PAQ', 3.6, 4.8, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000033', 'HUE-MOR-CRT', '7591012300335', 'SKU Principal Cartón de Huevos La Morita 30 Unid.', 1, 3.6, 4.8, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000033', @pl_detal, 4.8, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000033', @pl_mayor, 4.32, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000033', @pl_vip, 4.08, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000033', 'Empaque Individual', 'HUE-MOR-CRT', '7591012300335', 'PAQ', 1.0000, 3.6, 4.8, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000033', 'Bulto x 12 Unidades', 'HUE-MOR-CRT-B12', '7591012300339', 'BULTO', 12, 41.04, 52.99, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000033', @wh_main, 140, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000033', @wh_main, 'Nevera Aves', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000033', @wh_main, 'LOT-HUE-MOR-CRT-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 140, 140, 0, 3.6, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000033', @wh_store, 45, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000033', @wh_store, 'Nevera Aves', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 34: Refresco Pepsi Regular Botella 1.5 Litros
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000034', @company_id, 'BEB-PEP-15L', '7591012300342', 'Refresco Pepsi Regular Botella 1.5 Litros', 'Bebida gaseosa sabor cola regular',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000004', 'grp11111-0000-0000-0000-000000000015', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Pepsi', 'UNID', 1.2, 1.7, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000034', 'BEB-PEP-15L', '7591012300342', 'SKU Principal Refresco Pepsi Regular Botella 1.5 Litros', 1, 1.2, 1.7, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000034', @pl_detal, 1.7, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000034', @pl_mayor, 1.53, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000034', @pl_vip, 1.44, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000034', 'Empaque Individual', 'BEB-PEP-15L', '7591012300342', 'UNID', 1.0000, 1.2, 1.7, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000034', 'Bulto x 12 Unidades', 'BEB-PEP-15L-B12', '7591012300349', 'BULTO', 12, 13.68, 18.77, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000034', @wh_main, 300, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000034', @wh_main, 'Pasillo 6A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000034', @wh_main, 'LOT-BEB-PEP-15L-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 300, 300, 0, 1.2, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000034', @wh_store, 90, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000034', @wh_store, 'Pasillo 6A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 35: Refresco 7Up Lima Limón 1.5 Litros
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000035', @company_id, 'BEB-7UP-15L', '7591012300359', 'Refresco 7Up Lima Limón 1.5 Litros', 'Bebida gaseosa transparente sabor lima-limón',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000004', 'grp11111-0000-0000-0000-000000000015', NULL, 'sup11111-0000-0000-0000-000000000001',
  '7Up', 'UNID', 1.2, 1.7, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000035', 'BEB-7UP-15L', '7591012300359', 'SKU Principal Refresco 7Up Lima Limón 1.5 Litros', 1, 1.2, 1.7, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000035', @pl_detal, 1.7, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000035', @pl_mayor, 1.53, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000035', @pl_vip, 1.44, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000035', 'Empaque Individual', 'BEB-7UP-15L', '7591012300359', 'UNID', 1.0000, 1.2, 1.7, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000035', 'Bulto x 12 Unidades', 'BEB-7UP-15L-B12', '7591012300359', 'BULTO', 12, 13.68, 18.77, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000035', @wh_main, 220, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000035', @wh_main, 'Pasillo 6A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000035', @wh_main, 'LOT-BEB-7UP-15L-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 220, 220, 0, 1.2, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000035', @wh_store, 60, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000035', @wh_store, 'Pasillo 6A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 36: Agua Mineral Minalba sin Gas 1.5 L
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000036', @company_id, 'BEB-AGU-MIN', '7591012300366', 'Agua Mineral Minalba sin Gas 1.5 L', 'Agua mineral natural de manantial sin gas',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000004', 'grp11111-0000-0000-0000-000000000016', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Minalba', 'UNID', 0.7, 1.1, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000036', 'BEB-AGU-MIN', '7591012300366', 'SKU Principal Agua Mineral Minalba sin Gas 1.5 L', 1, 0.7, 1.1, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000036', @pl_detal, 1.1, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000036', @pl_mayor, 0.99, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000036', @pl_vip, 0.94, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000036', 'Empaque Individual', 'BEB-AGU-MIN', '7591012300366', 'UNID', 1.0000, 0.7, 1.1, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000036', 'Bulto x 12 Unidades', 'BEB-AGU-MIN-B12', '7591012300369', 'BULTO', 12, 7.98, 12.14, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000036', @wh_main, 400, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000036', @wh_main, 'Pasillo 6B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000036', @wh_main, 'LOT-BEB-AGU-MIN-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 400, 400, 0, 0.7, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000036', @wh_store, 120, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000036', @wh_store, 'Pasillo 6B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 37: Maltín Polar Botella 250ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000037', @company_id, 'BEB-MAL-POL', '7591012300373', 'Maltín Polar Botella 250ml', 'Bebida de malta energizante sin alcohol',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000004', 'grp11111-0000-0000-0000-000000000017', NULL, 'sup11111-0000-0000-0000-000000000001',
  'Maltín Polar', 'UNID', 0.65, 0.95, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000037', 'BEB-MAL-POL', '7591012300373', 'SKU Principal Maltín Polar Botella 250ml', 1, 0.65, 0.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000037', @pl_detal, 0.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000037', @pl_mayor, 0.85, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000037', @pl_vip, 0.81, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000037', 'Empaque Individual', 'BEB-MAL-POL', '7591012300373', 'UNID', 1.0000, 0.65, 0.95, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000037', 'Bulto x 12 Unidades', 'BEB-MAL-POL-B12', '7591012300379', 'BULTO', 12, 7.41, 10.49, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000037', @wh_main, 550, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000037', @wh_main, 'Pasillo 6B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000037', @wh_main, 'LOT-BEB-MAL-POL-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 550, 550, 0, 0.65, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000037', @wh_store, 150, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000037', @wh_store, 'Pasillo 6B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 38: Cerveza Polar Pilsen Botella 222ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000038', @company_id, 'LIC-CER-PIL', '7591012300380', 'Cerveza Polar Pilsen Botella 222ml', 'Cerveza pilsen tradicional tipo dorada',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000005', 'grp11111-0000-0000-0000-000000000018', NULL, 'sup11111-0000-0000-0000-000000000005',
  'Polar Pilsen', 'UNID', 0.85, 1.25, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000038', 'LIC-CER-PIL', '7591012300380', 'SKU Principal Cerveza Polar Pilsen Botella 222ml', 1, 0.85, 1.25, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000038', @pl_detal, 1.25, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000038', @pl_mayor, 1.13, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000038', @pl_vip, 1.06, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000038', 'Empaque Individual', 'LIC-CER-PIL', '7591012300380', 'UNID', 1.0000, 0.85, 1.25, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000038', 'Bulto x 12 Unidades', 'LIC-CER-PIL-B12', '7591012300389', 'BULTO', 12, 9.69, 13.8, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000038', @wh_main, 600, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000038', @wh_main, 'Pasillo 7A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000038', @wh_main, 'LOT-LIC-CER-PIL-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 600, 600, 0, 0.85, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000038', @wh_store, 180, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000038', @wh_store, 'Pasillo 7A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 39: Cerveza Polar Light Botella 222ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000039', @company_id, 'LIC-CER-LIG', '7591012300397', 'Cerveza Polar Light Botella 222ml', 'Cerveza suave bajo contenido calórico',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000005', 'grp11111-0000-0000-0000-000000000018', NULL, 'sup11111-0000-0000-0000-000000000005',
  'Polar Light', 'UNID', 0.85, 1.25, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000039', 'LIC-CER-LIG', '7591012300397', 'SKU Principal Cerveza Polar Light Botella 222ml', 1, 0.85, 1.25, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000039', @pl_detal, 1.25, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000039', @pl_mayor, 1.13, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000039', @pl_vip, 1.06, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000039', 'Empaque Individual', 'LIC-CER-LIG', '7591012300397', 'UNID', 1.0000, 0.85, 1.25, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000039', 'Bulto x 12 Unidades', 'LIC-CER-LIG-B12', '7591012300399', 'BULTO', 12, 9.69, 13.8, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000039', @wh_main, 500, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000039', @wh_main, 'Pasillo 7A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000039', @wh_main, 'LOT-LIC-CER-LIG-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 500, 500, 0, 0.85, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000039', @wh_store, 140, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000039', @wh_store, 'Pasillo 7A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 40: Cerveza Regional Clara Botella 222ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000040', @company_id, 'LIC-CER-REG', '7591012300403', 'Cerveza Regional Clara Botella 222ml', 'Cerveza clara sabor refrescante',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000005', 'grp11111-0000-0000-0000-000000000018', NULL, 'sup11111-0000-0000-0000-000000000006',
  'Regional', 'UNID', 0.8, 1.2, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000040', 'LIC-CER-REG', '7591012300403', 'SKU Principal Cerveza Regional Clara Botella 222ml', 1, 0.8, 1.2, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000040', @pl_detal, 1.2, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000040', @pl_mayor, 1.08, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000040', @pl_vip, 1.02, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000040', 'Empaque Individual', 'LIC-CER-REG', '7591012300403', 'UNID', 1.0000, 0.8, 1.2, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000040', 'Bulto x 12 Unidades', 'LIC-CER-REG-B12', '7591012300409', 'BULTO', 12, 9.12, 13.25, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000040', @wh_main, 400, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000040', @wh_main, 'Pasillo 7A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000040', @wh_main, 'LOT-LIC-CER-REG-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 400, 400, 0, 0.8, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000040', @wh_store, 110, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000040', @wh_store, 'Pasillo 7A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 41: Ron Añejo Santa Teresa Gran Reserva 750ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000041', @company_id, 'LIC-RON-STR', '7591012300410', 'Ron Añejo Santa Teresa Gran Reserva 750ml', 'Ron añejo venezolano de solera de roble blanco',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000005', 'grp11111-0000-0000-0000-000000000019', NULL, 'sup11111-0000-0000-0000-000000000004',
  'Santa Teresa', 'UNID', 7.2, 10.5, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000041', 'LIC-RON-STR', '7591012300410', 'SKU Principal Ron Añejo Santa Teresa Gran Reserva 750ml', 1, 7.2, 10.5, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000041', @pl_detal, 10.5, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000041', @pl_mayor, 9.45, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000041', @pl_vip, 8.92, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000041', 'Empaque Individual', 'LIC-RON-STR', '7591012300410', 'UNID', 1.0000, 7.2, 10.5, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000041', 'Bulto x 12 Unidades', 'LIC-RON-STR-B12', '7591012300419', 'BULTO', 12, 82.08, 115.92, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000041', @wh_main, 180, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000041', @wh_main, 'Pasillo 7B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000041', @wh_main, 'LOT-LIC-RON-STR-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 180, 180, 0, 7.2, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000041', @wh_store, 45, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000041', @wh_store, 'Pasillo 7B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 42: Ron Cacique Añejo Tradicional 750ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000042', @company_id, 'LIC-RON-CAC', '7591012300427', 'Ron Cacique Añejo Tradicional 750ml', 'Ron dorado venezolano añejado en barricas',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000005', 'grp11111-0000-0000-0000-000000000019', NULL, 'sup11111-0000-0000-0000-000000000004',
  'Cacique', 'UNID', 6.9, 9.8, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000042', 'LIC-RON-CAC', '7591012300427', 'SKU Principal Ron Cacique Añejo Tradicional 750ml', 1, 6.9, 9.8, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000042', @pl_detal, 9.8, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000042', @pl_mayor, 8.82, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000042', @pl_vip, 8.33, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000042', 'Empaque Individual', 'LIC-RON-CAC', '7591012300427', 'UNID', 1.0000, 6.9, 9.8, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000042', 'Bulto x 12 Unidades', 'LIC-RON-CAC-B12', '7591012300429', 'BULTO', 12, 78.66, 108.19, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000042', @wh_main, 150, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000042', @wh_main, 'Pasillo 7B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000042', @wh_main, 'LOT-LIC-RON-CAC-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 150, 150, 0, 6.9, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000042', @wh_store, 40, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000042', @wh_store, 'Pasillo 7B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 43: Crema Dental Colgate Triple Acción 100ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000043', @company_id, 'CP-COL-TRI', '7591012300434', 'Crema Dental Colgate Triple Acción 100ml', 'Protección anticaries, blancura y aliento fresco',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000006', 'grp11111-0000-0000-0000-000000000020', NULL, 'sup11111-0000-0000-0000-000000000013',
  'Colgate', 'UNID', 1.35, 1.95, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000043', 'CP-COL-TRI', '7591012300434', 'SKU Principal Crema Dental Colgate Triple Acción 100ml', 1, 1.35, 1.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000043', @pl_detal, 1.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000043', @pl_mayor, 1.75, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000043', @pl_vip, 1.66, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000043', 'Empaque Individual', 'CP-COL-TRI', '7591012300434', 'UNID', 1.0000, 1.35, 1.95, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000043', 'Bulto x 12 Unidades', 'CP-COL-TRI-B12', '7591012300439', 'BULTO', 12, 15.39, 21.53, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000043', @wh_main, 340, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000043', @wh_main, 'Pasillo 8A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000043', @wh_main, 'LOT-CP-COL-TRI-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 340, 340, 0, 1.35, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000043', @wh_store, 90, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000043', @wh_store, 'Pasillo 8A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 44: Jabón de Tocador Protex Antibacterial 110g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000044', @company_id, 'CP-JAB-PRO', '7591012300441', 'Jabón de Tocador Protex Antibacterial 110g', 'Jabón en barra protección natural antibacteriana',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000006', 'grp11111-0000-0000-0000-000000000020', NULL, 'sup11111-0000-0000-0000-000000000013',
  'Protex', 'UNID', 0.85, 1.25, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000044', 'CP-JAB-PRO', '7591012300441', 'SKU Principal Jabón de Tocador Protex Antibacterial 110g', 1, 0.85, 1.25, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000044', @pl_detal, 1.25, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000044', @pl_mayor, 1.13, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000044', @pl_vip, 1.06, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000044', 'Empaque Individual', 'CP-JAB-PRO', '7591012300441', 'UNID', 1.0000, 0.85, 1.25, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000044', 'Bulto x 12 Unidades', 'CP-JAB-PRO-B12', '7591012300449', 'BULTO', 12, 9.69, 13.8, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000044', @wh_main, 450, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000044', @wh_main, 'Pasillo 8A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000044', @wh_main, 'LOT-CP-JAB-PRO-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 450, 450, 0, 0.85, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000044', @wh_store, 120, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000044', @wh_store, 'Pasillo 8A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 45: Champú Pantene Pro-V Restauración 400ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000045', @company_id, 'CP-CHA-PAN', '7591012300458', 'Champú Pantene Pro-V Restauración 400ml', 'Champú con micro-nutrientes restaurador capilar',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000006', 'grp11111-0000-0000-0000-000000000021', NULL, 'sup11111-0000-0000-0000-000000000014',
  'Pantene', 'UNID', 3.5, 4.95, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000045', 'CP-CHA-PAN', '7591012300458', 'SKU Principal Champú Pantene Pro-V Restauración 400ml', 1, 3.5, 4.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000045', @pl_detal, 4.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000045', @pl_mayor, 4.46, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000045', @pl_vip, 4.21, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000045', 'Empaque Individual', 'CP-CHA-PAN', '7591012300458', 'UNID', 1.0000, 3.5, 4.95, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000045', 'Bulto x 12 Unidades', 'CP-CHA-PAN-B12', '7591012300459', 'BULTO', 12, 39.9, 54.65, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000045', @wh_main, 160, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000045', @wh_main, 'Pasillo 8B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000045', @wh_main, 'LOT-CP-CHA-PAN-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 160, 160, 0, 3.5, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000045', @wh_store, 45, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000045', @wh_store, 'Pasillo 8B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 46: Desodorante Rexona Clinical Aerosol 150ml
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000046', @company_id, 'CP-DES-REX', '7591012300465', 'Desodorante Rexona Clinical Aerosol 150ml', 'Protección antitranspirante 3 veces más eficaz',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000006', 'grp11111-0000-0000-0000-000000000020', NULL, 'sup11111-0000-0000-0000-000000000014',
  'Rexona', 'UNID', 3.2, 4.6, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000046', 'CP-DES-REX', '7591012300465', 'SKU Principal Desodorante Rexona Clinical Aerosol 150ml', 1, 3.2, 4.6, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000046', @pl_detal, 4.6, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000046', @pl_mayor, 4.14, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000046', @pl_vip, 3.91, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000046', 'Empaque Individual', 'CP-DES-REX', '7591012300465', 'UNID', 1.0000, 3.2, 4.6, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000046', 'Bulto x 12 Unidades', 'CP-DES-REX-B12', '7591012300469', 'BULTO', 12, 36.48, 50.78, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000046', @wh_main, 140, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000046', @wh_main, 'Pasillo 8B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000046', @wh_main, 'LOT-CP-DES-REX-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 140, 140, 0, 3.2, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000046', @wh_store, 40, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000046', @wh_store, 'Pasillo 8B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 47: Papel Higiénico Scott Rinde Más 4 Rollos
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000047', @company_id, 'CP-PAP-SCO', '7591012300472', 'Papel Higiénico Scott Rinde Más 4 Rollos', 'Papel higiénico doble hoja suave y resistente',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000006', 'grp11111-0000-0000-0000-000000000022', NULL, 'sup11111-0000-0000-0000-000000000015',
  'Scott', 'PAQ', 1.8, 2.65, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000047', 'CP-PAP-SCO', '7591012300472', 'SKU Principal Papel Higiénico Scott Rinde Más 4 Rollos', 1, 1.8, 2.65, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000047', @pl_detal, 2.65, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000047', @pl_mayor, 2.38, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000047', @pl_vip, 2.25, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000047', 'Empaque Individual', 'CP-PAP-SCO', '7591012300472', 'PAQ', 1.0000, 1.8, 2.65, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000047', 'Bulto x 12 Unidades', 'CP-PAP-SCO-B12', '7591012300479', 'BULTO', 12, 20.52, 29.26, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000047', @wh_main, 280, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000047', @wh_main, 'Pasillo 9A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000047', @wh_main, 'LOT-CP-PAP-SCO-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 280, 280, 0, 1.8, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000047', @wh_store, 75, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000047', @wh_store, 'Pasillo 9A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 48: Detergente en Polvo Ariel Doble Poder 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000048', @company_id, 'LIM-DET-ARI', '7591012300489', 'Detergente en Polvo Ariel Doble Poder 1 Kg', 'Detergente con aceleradores de lavado para ropa blanca y color',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000007', 'grp11111-0000-0000-0000-000000000023', NULL, 'sup11111-0000-0000-0000-000000000014',
  'Ariel', 'KG', 2.7, 3.85, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000048', 'LIM-DET-ARI', '7591012300489', 'SKU Principal Detergente en Polvo Ariel Doble Poder 1 Kg', 1, 2.7, 3.85, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000048', @pl_detal, 3.85, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000048', @pl_mayor, 3.47, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000048', @pl_vip, 3.27, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000048', 'Empaque Individual', 'LIM-DET-ARI', '7591012300489', 'KG', 1.0000, 2.7, 3.85, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000048', 'Bulto x 12 Unidades', 'LIM-DET-ARI-B12', '7591012300489', 'BULTO', 12, 30.78, 42.5, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000048', @wh_main, 290, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000048', @wh_main, 'Pasillo 9B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000048', @wh_main, 'LOT-LIM-DET-ARI-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 290, 290, 0, 2.7, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000048', @wh_store, 80, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000048', @wh_store, 'Pasillo 9B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 49: Cloro Tradicional Blanqueador Clorox 1 Litro
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000049', @company_id, 'LIM-CLO-CLO', '7591012300496', 'Cloro Tradicional Blanqueador Clorox 1 Litro', 'Desinfectante y blanqueador para ropa y superficies',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000007', 'grp11111-0000-0000-0000-000000000024', NULL, 'sup11111-0000-0000-0000-000000000013',
  'Clorox', 'LITRO', 1.1, 1.6, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000049', 'LIM-CLO-CLO', '7591012300496', 'SKU Principal Cloro Tradicional Blanqueador Clorox 1 Litro', 1, 1.1, 1.6, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000049', @pl_detal, 1.6, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000049', @pl_mayor, 1.44, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000049', @pl_vip, 1.36, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000049', 'Empaque Individual', 'LIM-CLO-CLO', '7591012300496', 'LITRO', 1.0000, 1.1, 1.6, 'USD', 1, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000049', @wh_main, 320, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000049', @wh_main, 'Pasillo 10A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000049', @wh_main, 'LOT-LIM-CLO-CLO-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 320, 320, 0, 1.1, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000049', @wh_store, 85, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000049', @wh_store, 'Pasillo 10A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 50: Lavaplatos en Crema Axion Limón 450g
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000050', @company_id, 'LIM-AXI-LIM', '7591012300502', 'Lavaplatos en Crema Axion Limón 450g', 'Crema arrancagrasa concentrada con aroma cítrico',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000007', 'grp11111-0000-0000-0000-000000000025', NULL, 'sup11111-0000-0000-0000-000000000013',
  'Axion', 'UNID', 1.45, 2.15, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000050', 'LIM-AXI-LIM', '7591012300502', 'SKU Principal Lavaplatos en Crema Axion Limón 450g', 1, 1.45, 2.15, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000050', @pl_detal, 2.15, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000050', @pl_mayor, 1.94, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000050', @pl_vip, 1.83, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000050', 'Empaque Individual', 'LIM-AXI-LIM', '7591012300502', 'UNID', 1.0000, 1.45, 2.15, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000050', 'Bulto x 12 Unidades', 'LIM-AXI-LIM-B12', '7591012300509', 'BULTO', 12, 16.53, 23.74, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000050', @wh_main, 260, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000050', @wh_main, 'Pasillo 10A', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000050', @wh_main, 'LOT-LIM-AXI-LIM-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 260, 260, 0, 1.45, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000050', @wh_store, 70, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000050', @wh_store, 'Pasillo 10A', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 51: Desinfectante Multiusos Mistolín Lavanda 1 L
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000051', @company_id, 'LIM-MIS-LAV', '7591012300519', 'Desinfectante Multiusos Mistolín Lavanda 1 L', 'Limpiador líquido aromatizante para pisos',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000007', 'grp11111-0000-0000-0000-000000000024', NULL, 'sup11111-0000-0000-0000-000000000013',
  'Mistolín', 'LITRO', 1.35, 1.95, 'USD',
  @tax_iva16_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000051', 'LIM-MIS-LAV', '7591012300519', 'SKU Principal Desinfectante Multiusos Mistolín Lavanda 1 L', 1, 1.35, 1.95, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000051', @pl_detal, 1.95, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000051', @pl_mayor, 1.75, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000051', @pl_vip, 1.66, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000051', 'Empaque Individual', 'LIM-MIS-LAV', '7591012300519', 'LITRO', 1.0000, 1.35, 1.95, 'USD', 1, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000051', @wh_main, 270, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000051', @wh_main, 'Pasillo 10B', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000051', @wh_main, 'LOT-LIM-MIS-LAV-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 270, 270, 0, 1.35, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000051', @wh_store, 70, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000051', @wh_store, 'Pasillo 10B', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 52: Tomate Manzano Fresco 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000052', @company_id, 'FRU-TOM-MAN', '7591012300526', 'Tomate Manzano Fresco 1 Kg', 'Tomate de perita para ensaladas y salsas',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000008', 'grp11111-0000-0000-0000-000000000026', NULL, 'sup11111-0000-0000-0000-000000000018',
  'La Morita', 'KG', 1.2, 1.85, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000052', 'FRU-TOM-MAN', '7591012300526', 'SKU Principal Tomate Manzano Fresco 1 Kg', 1, 1.2, 1.85, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000052', @pl_detal, 1.85, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000052', @pl_mayor, 1.67, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000052', @pl_vip, 1.57, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000052', 'Empaque Individual', 'FRU-TOM-MAN', '7591012300526', 'KG', 1.0000, 1.2, 1.85, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000052', 'Bulto x 12 Unidades', 'FRU-TOM-MAN-B12', '7591012300529', 'BULTO', 12, 13.68, 20.42, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000052', @wh_main, 150, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000052', @wh_main, 'Área Verduras', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000052', @wh_main, 'LOT-FRU-TOM-MAN-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 150, 150, 0, 1.2, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000052', @wh_store, 50, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000052', @wh_store, 'Área Verduras', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 53: Cebolla Blanca Seleccionada 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000053', @company_id, 'FRU-CEB-BLA', '7591012300533', 'Cebolla Blanca Seleccionada 1 Kg', 'Cebolla blanca nacional de cultivo andino',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000008', 'grp11111-0000-0000-0000-000000000026', NULL, 'sup11111-0000-0000-0000-000000000018',
  'La Morita', 'KG', 1.1, 1.7, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000053', 'FRU-CEB-BLA', '7591012300533', 'SKU Principal Cebolla Blanca Seleccionada 1 Kg', 1, 1.1, 1.7, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000053', @pl_detal, 1.7, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000053', @pl_mayor, 1.53, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000053', @pl_vip, 1.44, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000053', 'Empaque Individual', 'FRU-CEB-BLA', '7591012300533', 'KG', 1.0000, 1.1, 1.7, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000053', 'Bulto x 12 Unidades', 'FRU-CEB-BLA-B12', '7591012300539', 'BULTO', 12, 12.54, 18.77, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000053', @wh_main, 180, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000053', @wh_main, 'Área Verduras', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000053', @wh_main, 'LOT-FRU-CEB-BLA-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 180, 180, 0, 1.1, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000053', @wh_store, 60, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000053', @wh_store, 'Área Verduras', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 54: Papa Blanca de los Andes 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000054', @company_id, 'FRU-PAP-AND', '7591012300540', 'Papa Blanca de los Andes 1 Kg', 'Papa fresca lavada especial para puré y freír',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000008', 'grp11111-0000-0000-0000-000000000026', NULL, 'sup11111-0000-0000-0000-000000000018',
  'La Morita', 'KG', 1.25, 1.9, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000054', 'FRU-PAP-AND', '7591012300540', 'SKU Principal Papa Blanca de los Andes 1 Kg', 1, 1.25, 1.9, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000054', @pl_detal, 1.9, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000054', @pl_mayor, 1.71, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000054', @pl_vip, 1.61, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000054', 'Empaque Individual', 'FRU-PAP-AND', '7591012300540', 'KG', 1.0000, 1.25, 1.9, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000054', 'Bulto x 12 Unidades', 'FRU-PAP-AND-B12', '7591012300549', 'BULTO', 12, 14.25, 20.98, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000054', @wh_main, 220, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000054', @wh_main, 'Área Verduras', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000054', @wh_main, 'LOT-FRU-PAP-AND-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 220, 220, 0, 1.25, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000054', @wh_store, 70, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000054', @wh_store, 'Área Verduras', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

-- Producto 55: Plátano Maduro de Primera 1 Kg
INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  'prd11111-0000-0000-0000-000000000055', @company_id, 'FRU-PLA-MAD', '7591012300557', 'Plátano Maduro de Primera 1 Kg', 'Plátano maduro venezolano racimo seleccionado',
  'physical', 1,
  'dep11111-0000-0000-0000-000000000008', 'grp11111-0000-0000-0000-000000000026', NULL, 'sup11111-0000-0000-0000-000000000018',
  'La Morita', 'KG', 0.9, 1.4, 'USD',
  @tax_exempt_id, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000055', 'FRU-PLA-MAD', '7591012300557', 'SKU Principal Plátano Maduro de Primera 1 Kg', 1, 0.9, 1.4, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), 'prd11111-0000-0000-0000-000000000055', @pl_detal, 1.4, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000055', @pl_mayor, 1.26, 'USD', NOW()),
  (UUID(), 'prd11111-0000-0000-0000-000000000055', @pl_vip, 1.19, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000055', 'Empaque Individual', 'FRU-PLA-MAD', '7591012300557', 'KG', 1.0000, 0.9, 1.4, 'USD', 1, 0, 1);
INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000055', 'Bulto x 12 Unidades', 'FRU-PLA-MAD-B12', '7591012300559', 'BULTO', 12, 10.26, 15.46, 'USD', 0, 0, 1);
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('prd11111-0000-0000-0000-000000000055', @wh_main, 200, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), 'prd11111-0000-0000-0000-000000000055', @wh_main, 'Área Verduras', 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, 'prd11111-0000-0000-0000-000000000055', @wh_main, 'LOT-FRU-PLA-MAD-2026', DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), 200, 200, 0, 0.9, 'ACTIVE', 'Lote de apertura hipermercado');
INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT 'prd11111-0000-0000-0000-000000000055', @wh_store, 60, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), 'prd11111-0000-0000-0000-000000000055', @wh_store, 'Área Verduras', 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;

SET FOREIGN_KEY_CHECKS = 1;


SET FOREIGN_KEY_CHECKS = 1;
