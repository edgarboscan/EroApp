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
INSERT INTO `warehouses` (`id`, `branch_id`, `code`, `name`, `is_default`, `is_active`)
VALUES 
  (@wh_main_id, @branch_main_id, 'ALM-01', 'Almacén Central Mayorista', 1, 1),
  (@wh_store_id, @branch_main_id, 'TIENDA-01', 'Depósito Piso de Venta', 0, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

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
  (UUID(), 'reports', 'read', 'Consultar catálogo de reportes'),
  (UUID(), 'reports', 'export_pdf', 'Exportar reportes en PDF'),
  (UUID(), 'reports', 'export_excel', 'Exportar reportes en Excel/CSV'),
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
  (UUID(), 'sales', 'approve_discount', 'Aprobar descuentos comerciales'),
  (UUID(), 'purchases', 'update', 'Modificar órdenes de compra'),
  (UUID(), 'purchases', 'delete', 'Anular órdenes de compra');

-- Asignar todos los permisos al Super Administrador
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT @role_admin_id, id FROM `permissions`;

-- Asignar permisos básicos a Cajero (POS + Sales + Customers + Inventory + Pricing)
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




