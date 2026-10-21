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
