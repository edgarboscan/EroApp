-- ========================================================
-- ERO ERP VE - TRIGGERS DE AUTOMATIZACIÓN Y AUDITORÍA (MySQL 8)
-- ========================================================

USE `ero_erp_db`;

DELIMITER $$

-- 1. Actualización Automática de Stock por Movimientos de Inventario
DROP TRIGGER IF EXISTS `trg_inventory_movements_after_insert`$$
CREATE TRIGGER `trg_inventory_movements_after_insert`
AFTER INSERT ON `inventory_movements`
FOR EACH ROW
BEGIN
  -- Insertar o actualizar stock del depósito
  INSERT INTO `product_stocks` (`product_id`, `warehouse_id`, `current_stock`, `last_movement_at`)
  VALUES (
    NEW.product_id, 
    NEW.warehouse_id, 
    CASE 
      WHEN NEW.movement_type IN ('IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE') THEN NEW.quantity
      ELSE -NEW.quantity
    END,
    NOW()
  )
  ON DUPLICATE KEY UPDATE
    `current_stock` = CASE 
      WHEN NEW.movement_type IN ('IN', 'ADJUST_IN', 'TRANSFER_IN', 'PURCHASE') THEN `current_stock` + NEW.quantity
      ELSE `current_stock` - NEW.quantity
    END,
    `last_movement_at` = NOW();
END$$

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

-- 4. Descuento Automático de Stock al Insertar Renglones de Factura POS
DROP TRIGGER IF EXISTS `trg_sales_invoice_items_after_insert`$$
CREATE TRIGGER `trg_sales_invoice_items_after_insert`
AFTER INSERT ON `sales_invoice_items`
FOR EACH ROW
BEGIN
  DECLARE v_branch_id CHAR(36);
  DECLARE v_warehouse_id CHAR(36);
  DECLARE v_user_id CHAR(36);
  
  SELECT `branch_id`, `warehouse_id`, `user_id`
  INTO v_branch_id, v_warehouse_id, v_user_id
  FROM `sales_invoices`
  WHERE `id` = NEW.invoice_id;

  -- Registrar movimiento de salida por venta
  INSERT INTO `inventory_movements` (
    `id`,
    `branch_id`,
    `warehouse_id`,
    `product_id`,
    `user_id`,
    `movement_type`,
    `quantity`,
    `unit_cost`,
    `total_cost`,
    `reference_document`,
    `reason`,
    `created_at`
  ) VALUES (
    UUID(),
    v_branch_id,
    v_warehouse_id,
    NEW.product_id,
    v_user_id,
    'SALE',
    NEW.quantity,
    NEW.unit_cost,
    (NEW.quantity * NEW.unit_cost),
    NEW.invoice_id,
    'Venta en Punto de Venta / Factura Comercial',
    NOW()
  );
END$$

DELIMITER ;
