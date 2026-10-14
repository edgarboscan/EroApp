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
