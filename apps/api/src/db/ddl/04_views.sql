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




