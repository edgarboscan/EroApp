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
  `fiscal_address` TEXT DEFAULT NULL,
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

DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `sku` VARCHAR(50) NOT NULL,
  `barcode` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `product_type` ENUM('physical', 'service', 'kit', 'raw_material') NOT NULL DEFAULT 'physical',
  
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

-- 6. UBICACIÓN FÍSICA OPCIONAL DEL PRODUCTO EN DEPÓSITOS (NUEVO)
DROP TABLE IF EXISTS `product_locations`;
CREATE TABLE `product_locations` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
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
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sp_invoice` (`invoice_id`),
  CONSTRAINT `fk_sp_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE
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

-- 9.1 CAJAS, TURNOS Y REPORTES FISCALES SENIAT
DROP TABLE IF EXISTS `cash_registers`;
CREATE TABLE `cash_registers` (
  `id` CHAR(36) NOT NULL,
  `branch_id` CHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL, -- ej: 'CAJA-01'
  `name` VARCHAR(100) NOT NULL, -- ej: 'Caja Principal Piso de Venta'
  `fiscal_printer_serial` VARCHAR(50) DEFAULT NULL, -- ej: 'Z5A1234567'
  `invoice_mode` VARCHAR(30) NOT NULL DEFAULT 'normal_printer',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cr_branch_code` (`branch_id`, `code`),
  CONSTRAINT `fk_cr_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT
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
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cs_register_status` (`cash_register_id`, `status`),
  KEY `idx_cs_branch_date` (`branch_id`, `opened_at`),
  CONSTRAINT `fk_cs_register` FOREIGN KEY (`cash_register_id`) REFERENCES `cash_registers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cs_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
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
  `invoice_id` CHAR(36) NOT NULL,
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
  CONSTRAINT `fk_rec_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rec_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rec_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices` (`id`) ON DELETE CASCADE
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
  `tax_affects_final_price` TINYINT(1) NOT NULL DEFAULT 1,
  `enforce_credit_limit` TINYINT(1) NOT NULL DEFAULT 1,
  `retention_period_years` INT NOT NULL DEFAULT 5,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_br_company_branch` (`company_id`, `branch_id`),
  CONSTRAINT `fk_br_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
