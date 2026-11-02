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
