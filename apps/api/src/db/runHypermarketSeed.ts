import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'erp_admin',
  password: process.env.DB_PASSWORD || 'SecurePassword_2026!',
  database: process.env.DB_NAME || 'ero_erp_db',
  multipleStatements: true,
};

export async function runHypermarketSeed() {
  console.log('🚀 Iniciando conexión con base de datos MySQL:', dbConfig.database);
  const conn = await mysql.createConnection(dbConfig);

  try {
    // 1. Obtener Empresa y Sucursales existentes
    const [companies]: any = await conn.query('SELECT id, legal_name FROM companies LIMIT 1');
    if (!companies || companies.length === 0) {
      throw new Error('No se encontró ninguna empresa en la base de datos para asociar los datos.');
    }
    const companyId = companies[0].id;

    const [branches]: any = await conn.query(
      'SELECT id, name FROM branches WHERE company_id = ? ORDER BY is_main DESC LIMIT 1',
      [companyId]
    );
    const branchId = branches.length > 0 ? branches[0].id : null;

    const [warehouses]: any = await conn.query(
      'SELECT id, code, name FROM warehouses WHERE branch_id = ? ORDER BY is_default DESC',
      [branchId]
    );
    const mainWhId = warehouses.length > 0 ? warehouses[0].id : null;
    const storeWhId = warehouses.length > 1 ? warehouses[1].id : mainWhId;

    const [users]: any = await conn.query('SELECT id FROM users WHERE company_id = ? LIMIT 1', [companyId]);
    const adminUserId = users.length > 0 ? users[0].id : null;

    console.log(`🏢 Empresa detectada: ${companies[0].legal_name} (${companyId})`);
    console.log(`📍 Sucursal detectada: ${branches[0]?.name || 'N/A'} (${branchId})`);
    console.log(`📦 Almacén Principal: ${mainWhId}, Piso de Venta: ${storeWhId}`);

    // 2. Obtener o crear tasas de impuestos
    let [taxExemptRows]: any = await conn.query(
      "SELECT id FROM tax_rates WHERE company_id = ? AND type = 'EXENTO' LIMIT 1",
      [companyId]
    );
    let taxExemptId = taxExemptRows.length > 0 ? taxExemptRows[0].id : null;
    if (!taxExemptId) {
      taxExemptId = 't4444444-4444-4444-4444-444444444444';
      await conn.query(
        "INSERT INTO tax_rates (id, company_id, code, name, rate, type, is_active) VALUES (?, ?, 'EXENTO', 'Productos y Servicios Exentos', 0.00, 'EXENTO', 1) ON DUPLICATE KEY UPDATE rate=0",
        [taxExemptId, companyId]
      );
    }

    let [taxIvaRows]: any = await conn.query(
      "SELECT id FROM tax_rates WHERE company_id = ? AND type = 'IVA' AND rate = 16.00 LIMIT 1",
      [companyId]
    );
    let taxIvaGenId = taxIvaRows.length > 0 ? taxIvaRows[0].id : null;
    if (!taxIvaGenId) {
      taxIvaGenId = 't1111111-1111-1111-1111-111111111111';
      await conn.query(
        "INSERT INTO tax_rates (id, company_id, code, name, rate, type, is_active) VALUES (?, ?, 'IVA_16', 'IVA Alícuota General (16%)', 16.00, 'IVA', 1) ON DUPLICATE KEY UPDATE rate=16",
        [taxIvaGenId, companyId]
      );
    }

    console.log('🧹 3. Limpiando datos transaccionales, productos y entidades operativas anteriores...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const tablesToClean = [
      'sales_payments',
      'sales_invoice_items',
      'sales_invoices',
      'sales_quotation_items',
      'sales_quotations',
      'delivery_note_items',
      'delivery_notes',
      'customer_note_applications',
      'customer_note_items',
      'customer_notes',
      'receivables',
      'purchase_payments',
      'purchase_invoice_items',
      'purchase_invoices',
      'payables',
      'supplier_note_applications',
      'supplier_note_items',
      'supplier_notes',
      'goods_receipt_items',
      'goods_receipts',
      'purchase_order_items',
      'purchase_orders',
      'tax_withholdings_iva',
      'tax_withholdings_islr',
      'cash_shift_deposits',
      'cash_audit_notifications',
      'cash_movements',
      'fiscal_reports',
      'cash_shifts',
      'inventory_movements',
      'inventory_adjustment_items',
      'inventory_adjustments',
      'inventory_transfer_items',
      'inventory_transfers',
      'product_lots',
      'product_stocks',
      'product_prices',
      'product_locations',
      'product_presentations',
      'product_skus',
      'supplier_products',
      'price_history',
      'price_change_items',
      'price_change_batches',
      'price_lists',
      'products',
      'presentations',
      'units_of_measure',
      'brands',
      'subgroups',
      'groups',
      'departments',
      'bank_reconciliations',
      'bank_movements',
      'bank_accounts',
      'banks',
      'customers',
      'suppliers',
      'restaurant_order_items',
      'restaurant_orders',
      'restaurant_table_closures',
      'accounting_journal_lines',
      'accounting_journal_entries',
      'notifications',
      'user_notification_preferences',
      'email_logs'
    ];

    for (const table of tablesToClean) {
      try {
        await conn.query(`DELETE FROM \`${table}\``);
      } catch (err: any) {
        // Ignorar si alguna tabla opcional no existe
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✨ Tablas limpiadas exitosamente. Usuarios y configuración preservados.');

    // 4. Insertar Bancos Oficiales Venezolanos
    console.log('🏦 4. Creando Bancos Venezolanos SUDEBAN...');
    const banks = [
      { id: 'b0134000-0000-0000-0000-000000000134', code: '0134', name: 'Banesco Banco Universal' },
      { id: 'b0102000-0000-0000-0000-000000000102', code: '0102', name: 'Banco de Venezuela S.A.' },
      { id: 'b0105000-0000-0000-0000-000000000105', code: '0105', name: 'Banco Mercantil C.A.' },
      { id: 'b0108000-0000-0000-0000-000000000108', code: '0108', name: 'BBVA Banco Provincial' },
      { id: 'b0172000-0000-0000-0000-000000000172', code: '0172', name: 'Bancamiga Banco Universal' },
      { id: 'b0191000-0000-0000-0000-000000000191', code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
      { id: 'b0114000-0000-0000-0000-000000000114', code: '0114', name: 'Bancaribe C.A.' },
      { id: 'b0115000-0000-0000-0000-000000000115', code: '0115', name: 'Banco Exterior C.A.' },
    ];

    for (const b of banks) {
      await conn.query('INSERT INTO banks (id, code, name, is_active) VALUES (?, ?, ?, 1)', [b.id, b.code, b.name]);
    }

    // 5. Insertar Cuentas Bancarias Operativas
    console.log('💳 5. Creando Cuentas Bancarias Operativas (VES y USD)...');
    const bankAccounts = [
      {
        id: 'acc11111-0000-0000-0000-000000000001',
        bankId: banks[0].id,
        number: '01340012345678901234',
        type: 'CURRENT',
        currency: 'VES',
        desc: 'Banesco Operativa Principal (Bolívares)',
        balance: 154850.0,
      },
      {
        id: 'acc11111-0000-0000-0000-000000000002',
        bankId: banks[1].id,
        number: '01020199881234567890',
        type: 'CURRENT',
        currency: 'VES',
        desc: 'Banco de Venezuela Cuenta Recaudadora y Puntos (VES)',
        balance: 89300.0,
      },
      {
        id: 'acc11111-0000-0000-0000-000000000003',
        bankId: banks[2].id,
        number: '01050033229876543210',
        type: 'CURRENT',
        currency: 'VES',
        desc: 'Banco Mercantil Cuenta Operativa y Proveedores (VES)',
        balance: 45200.0,
      },
      {
        id: 'acc11111-0000-0000-0000-000000000004',
        bankId: banks[4].id,
        number: '01720111441122334455',
        type: 'CUSTODY_USD',
        currency: 'USD',
        desc: 'Bancamiga Cuenta Custodia / Libre Convertibilidad ($)',
        balance: 18500.0,
      },
      {
        id: 'acc11111-0000-0000-0000-000000000005',
        bankId: banks[0].id,
        number: '01340999559988776655',
        type: 'CUSTODY_USD',
        currency: 'USD',
        desc: 'Banesco Moneda Extranjera Custodia Divisas ($)',
        balance: 9400.0,
      },
    ];

    for (const acc of bankAccounts) {
      await conn.query(
        `INSERT INTO bank_accounts (id, company_id, bank_id, branch_id, account_number, account_type, currency, description, current_balance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [acc.id, companyId, acc.bankId, branchId, acc.number, acc.type, acc.currency, acc.desc, acc.balance]
      );

      // Movimiento inicial de apertura
      await conn.query(
        `INSERT INTO bank_movements (id, account_id, user_id, movement_type, amount, balance_after, reference_number, concept, is_reconciled)
         VALUES (UUID(), ?, ?, 'DEPOSIT', ?, ?, 'DEP-INI-001', 'Aporte y saldo inicial operativo', 1)`,
        [acc.id, adminUserId, acc.balance, acc.balance]
      );
    }

    // 6. Proveedores Venezolanos de Consumo Masivo
    console.log('🏭 6. Creando Proveedores Venezolanos de Consumo Masivo...');
    const suppliers = [
      { id: 'sup11111-0000-0000-0000-000000000001', rif: 'J-00041372-8', name: 'ALIMENTOS POLAR COMERCIAL C.A.', address: 'Av. Los Cortijos, Edif. Fundación Polar, Caracas', phone: '+58 212 202-3111', email: 'pedidos@empresaspolar.com', creditLimit: 50000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000002', rif: 'J-00012926-2', name: 'NESTLÉ VENEZUELA S.A.', address: 'Av. Eugenio Mendoza, Edif. Nestlé, La Castellana, Caracas', phone: '+58 212 208-7111', email: 'ventas@ve.nestle.com', creditLimit: 40000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000003', rif: 'J-00033322-1', name: 'MONDELEZ VENEZUELA C.A.', address: 'Zona Industrial San Diego, Valencia, Edo. Carabobo', phone: '+58 241 876-5432', email: 'cuentas@mondelezinternational.com', creditLimit: 30000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000004', rif: 'J-00032549-0', name: 'C.A. RON SANTA TERESA', address: 'Hacienda Santa Teresa, El Consejo, Edo. Aragua', phone: '+58 244 395-5111', email: 'ventas@ronsantateresa.com', creditLimit: 25000, days: 21 },
      { id: 'sup11111-0000-0000-0000-000000000005', rif: 'J-00006372-9', name: 'CERVECERÍA POLAR C.A.', address: 'Planta San Joaquín, Autopista Regional del Centro, Edo. Carabobo', phone: '+58 241 850-2000', email: 'distribucion@cerveceriapolar.com', creditLimit: 35000, days: 15 },
      { id: 'sup11111-0000-0000-0000-000000000006', rif: 'J-00035124-7', name: 'CERVECERÍA REGIONAL C.A.', address: 'Av. Los Haticos, Maracaibo, Edo. Zulia', phone: '+58 261 765-4321', email: 'atencion@regional.com.ve', creditLimit: 20000, days: 15 },
      { id: 'sup11111-0000-0000-0000-000000000007', rif: 'J-00045231-6', name: 'EMBUTIDOS PLUMROSE LATINOAMERICANA C.A.', address: 'Zona Industrial El Trébol, Cagua, Edo. Aragua', phone: '+58 244 447-8100', email: 'ventas@plumrose.com', creditLimit: 30000, days: 21 },
      { id: 'sup11111-0000-0000-0000-000000000008', rif: 'J-00028741-0', name: 'PASTEURIZADORA TÁCHIRA C.A. (PAISA)', address: 'Zona Industrial Paramillo, San Cristóbal, Edo. Táchira', phone: '+58 276 343-2211', email: 'pedidos@paisa.com.ve', creditLimit: 25000, days: 21 },
      { id: 'sup11111-0000-0000-0000-000000000009', rif: 'J-00038592-3', name: 'DISTRIBUIDORA GALLETERA PUIG C.A.', address: 'Av. San Martín, Calle Los Andes, Caracas', phone: '+58 212 461-8899', email: 'distribucion@galletaspuig.com', creditLimit: 15000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000010', rif: 'J-00016843-8', name: 'CENTRAL EL PALMAR S.A.', address: 'Hacienda El Palmar, San Mateo, Edo. Aragua', phone: '+58 244 395-8800', email: 'azucar@centralelpalmar.com.ve', creditLimit: 20000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000011', rif: 'J-00055210-8', name: 'CARGILL DE VENEZUELA S.R.L.', address: 'Torre Seguros Sud América, El Rosal, Caracas', phone: '+58 212 958-3000', email: 'atencion@cargill.com', creditLimit: 30000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000012', rif: 'G-20008542-1', name: 'INDUSTRIAS DIANA C.A.', address: 'Av. Michelena, Zona Industrial Carabobo, Valencia', phone: '+58 241 832-1144', email: 'ventas@industriasdiana.gob.ve', creditLimit: 15000, days: 15 },
      { id: 'sup11111-0000-0000-0000-000000000013', rif: 'J-00012588-7', name: 'COLGATE-PALMOLIVE C.A.', address: 'Av. Don Julio Centeno, Valencia, Edo. Carabobo', phone: '+58 241 871-9111', email: 'pedidos@colgate.com.ve', creditLimit: 35000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000014', rif: 'J-00014287-0', name: 'PROCTER & GAMBLE DE VENEZUELA S.C.A.', address: 'Torre P&G, Urb. La Trinidad, Caracas', phone: '+58 212 903-5111', email: 'contacto@pg.com.ve', creditLimit: 40000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000015', rif: 'J-00108549-2', name: 'KIMBERLY-CLARK VENEZUELA C.A.', address: 'Carretera Nacional Maracay-Mariara, Edo. Carabobo', phone: '+58 243 240-8000', email: 'ventas@kcc.com', creditLimit: 25000, days: 30 },
      { id: 'sup11111-0000-0000-0000-000000000016', rif: 'J-29841520-1', name: 'DISTRIBUIDORA AVÍCOLA LA MORITA C.A.', address: 'Zona Industrial La Morita, Turmero, Edo. Aragua', phone: '+58 244 663-1288', email: 'avicola@lamorita.com.ve', creditLimit: 20000, days: 15 },
      { id: 'sup11111-0000-0000-0000-000000000017', rif: 'J-30589124-3', name: 'FRIGORÍFICO INDUSTRIAL DEL CENTRO C.A.', address: 'Carretera Vieja de Tocuyito, Valencia, Edo. Carabobo', phone: '+58 241 848-1990', email: 'carnes@frigocentro.com.ve', creditLimit: 30000, days: 15 },
      { id: 'sup11111-0000-0000-0000-000000000018', rif: 'J-31045892-4', name: 'ASOCIACIÓN HORTÍCOLA DE LOS ANDES', address: 'Pueblo Llano, Edo. Mérida', phone: '+58 274 888-2100', email: 'hortalizas@losandes.com.ve', creditLimit: 15000, days: 7 },
    ];

    for (const s of suppliers) {
      await conn.query(
        `INSERT INTO suppliers (id, company_id, rif, name, fiscal_address, phone, email, is_resident, islr_concept_code, credit_limit, payment_terms_days, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'SERV_IND', ?, ?, 1)`,
        [s.id, companyId, s.rif, s.name, s.address, s.phone, s.email, s.creditLimit, s.days]
      );
    }

    // 7. Clientes Venezolanos Diversificados
    console.log('👥 7. Creando Clientes Venezolanos Diversificados...');
    const customers = [
      { id: 'cli11111-0000-0000-0000-000000000001', docType: 'J', docNumber: '401298456', name: 'AUTOMERCADOS Y BODEGONES SAN ANTONIO C.A.', address: 'Av. Las Delicias, Maracay, Edo. Aragua', phone: '+58 243 241-9988', email: 'compras@sanantonio.com.ve', isSpecial: 1, creditEnabled: 1, creditLimit: 15000, days: 21 },
      { id: 'cli11111-0000-0000-0000-000000000002', docType: 'J', docNumber: '409812345', name: 'BODEGÓN Y RESTAURANT EL PORTÓN GOURMET C.A.', address: 'Calle 72 con Av. Bella Vista, Maracaibo, Zulia', phone: '+58 261 792-8811', email: 'elportongourmet@gmail.com', isSpecial: 0, creditEnabled: 1, creditLimit: 8000, days: 15 },
      { id: 'cli11111-0000-0000-0000-000000000003', docType: 'J', docNumber: '501239874', name: 'INVERSIONES RESTAURANTE EL ASADOR CARACAS C.A.', address: 'Av. Blandín, CC San Ignacio, Caracas', phone: '+58 212 263-4455', email: 'administracion@elasador.com.ve', isSpecial: 1, creditEnabled: 1, creditLimit: 12000, days: 15 },
      { id: 'cli11111-0000-0000-0000-000000000004', docType: 'J', docNumber: '314567890', name: 'PANADERÍA Y PASTELERÍA FLOR DE LIS C.A.', address: 'Av. Bolívar Norte, Valencia, Edo. Carabobo', phone: '+58 241 821-6677', email: 'flordelispan@gmail.com', isSpecial: 0, creditEnabled: 1, creditLimit: 5000, days: 15 },
      { id: 'cli11111-0000-0000-0000-000000000005', docType: 'J', docNumber: '412398456', name: 'COMERCIALIZADORA ALIMENTOS MARGARITA S.A.', address: 'Av. 4 de Mayo, Porlamar, Edo. Nueva Esparta', phone: '+58 295 264-1122', email: 'margaritacompras@gmail.com', isSpecial: 1, creditEnabled: 1, creditLimit: 20000, days: 30 },
      { id: 'cli11111-0000-0000-0000-000000000006', docType: 'V', docNumber: '14567890', name: 'CARLOS ENRIQUE MENDOZA PÉREZ', address: 'Urb. Santa Mónica, Caracas', phone: '+58 414 111-2233', email: 'cmendoza@gmail.com', isSpecial: 0, creditEnabled: 1, creditLimit: 500, days: 15 },
      { id: 'cli11111-0000-0000-0000-000000000007', docType: 'V', docNumber: '18901234', name: 'MARÍA ALEJANDRA RODRÍGUEZ SILVA', address: 'Urb. El Rosal, Chacao, Caracas', phone: '+58 412 333-4455', email: 'mrodriguez@gmail.com', isSpecial: 0, creditEnabled: 1, creditLimit: 800, days: 15 },
      { id: 'cli11111-0000-0000-0000-000000000008', docType: 'V', docNumber: '12345678', name: 'GABRIEL JOSÉ HERNÁNDEZ SÁNCHEZ', address: 'Urb. La Trigaleña, Valencia, Carabobo', phone: '+58 414 777-8899', email: 'ghernandez@hotmail.com', isSpecial: 0, creditEnabled: 0, creditLimit: 0, days: 0 },
      { id: 'cli11111-0000-0000-0000-000000000009', docType: 'V', docNumber: '21345678', name: 'ANDREÍNA CHIRINOS ALVARADO', address: 'Av. Fuerzas Armadas, Maracaibo, Zulia', phone: '+58 424 666-5544', email: 'achirinos@gmail.com', isSpecial: 0, creditEnabled: 0, creditLimit: 0, days: 0 },
      { id: 'cli11111-0000-0000-0000-000000000010', docType: 'V', docNumber: '10987654', name: 'ROBERTO ANTONIO SALAZAR GÓMEZ', address: 'Sector Tierra Negra, Maracaibo, Zulia', phone: '+58 416 888-9900', email: 'rsalazar@yahoo.com', isSpecial: 0, creditEnabled: 1, creditLimit: 300, days: 10 },
    ];

    for (const c of customers) {
      await conn.query(
        `INSERT INTO customers (id, company_id, doc_type, doc_number, name, address, phone, email, is_special_taxpayer, credit_enabled, credit_limit, payment_terms_days, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [c.id, companyId, c.docType, c.docNumber, c.name, c.address, c.phone, c.email, c.isSpecial, c.creditEnabled, c.creditLimit, c.days]
      );
    }

    // 8. Departamentos, Grupos y Marcas de Hipermercado
    console.log('🗂️ 8. Creando Departamentos, Grupos y Marcas...');
    const departments = [
      { id: 'dep11111-0000-0000-0000-000000000001', code: 'DEP-VIV', name: 'Víveres y Despensa', desc: 'Granos, harinas, pastas, aceites, enlatados y abarrotes' },
      { id: 'dep11111-0000-0000-0000-000000000002', code: 'DEP-REF', name: 'Lácteos y Refrigerados', desc: 'Leches, quesos, embutidos y derivados' },
      { id: 'dep11111-0000-0000-0000-000000000003', code: 'DEP-CAR', name: 'Carnicería y Aves', desc: 'Carnes de res, pollo beneficiado, cerdo y charcutería fresca' },
      { id: 'dep11111-0000-0000-0000-000000000004', code: 'DEP-BEB', name: 'Bebidas y Refrescos', desc: 'Gaseosas, aguas, jugos y maltas' },
      { id: 'dep11111-0000-0000-0000-000000000005', code: 'DEP-LIC', name: 'Licores y Cervezas', desc: 'Cervezas nacionales, rones venezolanos y licores' },
      { id: 'dep11111-0000-0000-0000-000000000006', code: 'DEP-CP', name: 'Cuidado Personal y Farmacia', desc: 'Cuidado oral, jabones, champús y toallas higiénicas' },
      { id: 'dep11111-0000-0000-0000-000000000007', code: 'DEP-LIM', name: 'Limpieza del Hogar', desc: 'Detergentes, cloros, lavaplatos y desinfectantes' },
      { id: 'dep11111-0000-0000-0000-000000000008', code: 'DEP-FRU', name: 'Frutas y Hortalizas', desc: 'Frutas frescas, verduras, tubérculos y legumbres' },
    ];

    for (const d of departments) {
      await conn.query(
        'INSERT INTO departments (id, company_id, code, name, description, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [d.id, companyId, d.code, d.name, d.desc]
      );
    }

    const groups = [
      { id: 'grp11111-0000-0000-0000-000000000001', deptId: departments[0].id, code: 'GRP-HAR', name: 'Harinas y Mezclas' },
      { id: 'grp11111-0000-0000-0000-000000000002', deptId: departments[0].id, code: 'GRP-ARR', name: 'Arroces y Granos' },
      { id: 'grp11111-0000-0000-0000-000000000003', deptId: departments[0].id, code: 'GRP-PAS', name: 'Pastas Alimenticias' },
      { id: 'grp11111-0000-0000-0000-000000000004', deptId: departments[0].id, code: 'GRP-ACE', name: 'Aceites y Mantecas' },
      { id: 'grp11111-0000-0000-0000-000000000005', deptId: departments[0].id, code: 'GRP-ENL', name: 'Enlatados y Conservas' },
      { id: 'grp11111-0000-0000-0000-000000000006', deptId: departments[0].id, code: 'GRP-DUL', name: 'Azúcar, Café y Chocolates' },
      { id: 'grp11111-0000-0000-0000-000000000007', deptId: departments[0].id, code: 'GRP-GAL', name: 'Galletas y Confitería' },
      { id: 'grp11111-0000-0000-0000-000000000008', deptId: departments[0].id, code: 'GRP-SAL', name: 'Salsas y Condimentos' },
      { id: 'grp11111-0000-0000-0000-000000000009', deptId: departments[1].id, code: 'GRP-LEC', name: 'Leches y Lácteos' },
      { id: 'grp11111-0000-0000-0000-000000000010', deptId: departments[1].id, code: 'GRP-QUE', name: 'Quesos y Mantequillas' },
      { id: 'grp11111-0000-0000-0000-000000000011', deptId: departments[1].id, code: 'GRP-EMB', name: 'Embutidos y Madurados' },
      { id: 'grp11111-0000-0000-0000-000000000012', deptId: departments[2].id, code: 'GRP-RES', name: 'Carne de Res' },
      { id: 'grp11111-0000-0000-0000-000000000013', deptId: departments[2].id, code: 'GRP-AVE', name: 'Pollo y Huevos' },
      { id: 'grp11111-0000-0000-0000-000000000014', deptId: departments[2].id, code: 'GRP-CER', name: 'Cerdo y Cortes' },
      { id: 'grp11111-0000-0000-0000-000000000015', deptId: departments[3].id, code: 'GRP-REF', name: 'Refrescos y Gaseosas' },
      { id: 'grp11111-0000-0000-0000-000000000016', deptId: departments[3].id, code: 'GRP-AGU', name: 'Aguas y Jugos' },
      { id: 'grp11111-0000-0000-0000-000000000017', deptId: departments[3].id, code: 'GRP-MAL', name: 'Maltas' },
      { id: 'grp11111-0000-0000-0000-000000000018', deptId: departments[4].id, code: 'GRP-CERV', name: 'Cervezas' },
      { id: 'grp11111-0000-0000-0000-000000000019', deptId: departments[4].id, code: 'GRP-RON', name: 'Rones y Espirituosos' },
      { id: 'grp11111-0000-0000-0000-000000000020', deptId: departments[5].id, code: 'GRP-HIG', name: 'Higiene y Cuidado Oral' },
      { id: 'grp11111-0000-0000-0000-000000000021', deptId: departments[5].id, code: 'GRP-CAP', name: 'Cuidado Capilar' },
      { id: 'grp11111-0000-0000-0000-000000000022', deptId: departments[5].id, code: 'GRP-PAP', name: 'Papel Higiénico y Pañales' },
      { id: 'grp11111-0000-0000-0000-000000000023', deptId: departments[6].id, code: 'GRP-DET', name: 'Detergentes y Jabones' },
      { id: 'grp11111-0000-0000-0000-000000000024', deptId: departments[6].id, code: 'GRP-DESI', name: 'Desinfectantes y Cloros' },
      { id: 'grp11111-0000-0000-0000-000000000025', deptId: departments[6].id, code: 'GRP-LAV', name: 'Lavaplatos y Limpieza Cocina' },
      { id: 'grp11111-0000-0000-0000-000000000026', deptId: departments[7].id, code: 'GRP-HOR', name: 'Verduras y Hortalizas' },
    ];

    for (const g of groups) {
      await conn.query(
        'INSERT INTO `groups` (id, department_id, code, name, is_active) VALUES (?, ?, ?, ?, 1)',
        [g.id, g.deptId, g.code, g.name]
      );
    }

    const brands = [
      'P.A.N.', 'Mavesa', 'Primor', 'Mary', 'Mazeite', 'Diana', 'Ronco', 'La Lucha',
      'Montalbán', 'Fama de América', 'Toddy', 'Savoy', 'Puig', 'Club Social', 'Oreo',
      'La Campesina', 'Mi Vaca', 'Paisa', 'Torondoy', 'Plumrose', 'La Morita', 'Frigocentro',
      'Pepsi', '7Up', 'Minalba', 'Maltín Polar', 'Polar Pilsen', 'Polar Light', 'Regional',
      'Santa Teresa', 'Cacique', 'Colgate', 'Protex', 'Pantene', 'Rexona', 'Scott',
      'Ariel', 'Clorox', 'Axion', 'Mistolín'
    ];

    for (const b of brands) {
      await conn.query(
        'INSERT INTO brands (id, company_id, name, is_active) VALUES (UUID(), ?, ?, 1)',
        [companyId, b]
      );
    }

    // 9. Catálogo Extenso de Productos de Hipermercado (56 Productos Reales)
    console.log('🛒 9. Creando Catálogo Amplio de 56 Productos de Hipermercado con Lotes y Precios...');

    const priceListDetalId = 'pl111111-0000-0000-0000-000000000001';
    const priceListMayorId = 'pl111111-0000-0000-0000-000000000002';
    const priceListVipId   = 'pl111111-0000-0000-0000-000000000003';

    await conn.query(
      `INSERT INTO price_lists (id, company_id, code, name, currency, is_default, is_active)
       VALUES 
       (?, ?, 'PL-DETAL', 'Precio Detal / Al Mayor', 'USD', 1, 1),
       (?, ?, 'PL-MAYOR', 'Precio Mayorista', 'USD', 0, 1),
       (?, ?, 'PL-ESPECIAL', 'Precio Cliente Especial', 'USD', 0, 1)
       ON DUPLICATE KEY UPDATE name=VALUES(name), currency=VALUES(currency), is_default=VALUES(is_default)`,
      [priceListDetalId, companyId, priceListMayorId, companyId, priceListVipId, companyId]
    );

    const productsDef = [
      // VÍVERES BÁSICOS
      { sku: 'HAR-PAN-BLA', ean: '7591012300014', name: 'Harina P.A.N. Blanca 1 Kg', desc: 'Harina de maíz precocida blanca tradicional', dept: 0, grp: 0, brand: 'P.A.N.', unit: 'KG', cost: 1.05, price: 1.40, sup: 0, tax: taxExemptId, stock1: 500, stock2: 120, aisle: 'Pasillo 1A' },
      { sku: 'HAR-PAN-AMA', ean: '7591012300021', name: 'Harina P.A.N. Amarilla 1 Kg', desc: 'Harina de maíz precocida amarilla', dept: 0, grp: 0, brand: 'P.A.N.', unit: 'KG', cost: 1.10, price: 1.45, sup: 0, tax: taxExemptId, stock1: 300, stock2: 80, aisle: 'Pasillo 1A' },
      { sku: 'ARR-PRI-001', ean: '7591012300038', name: 'Arroz Primor Clásico Grano Entero 1 Kg', desc: 'Arroz blanco de primera seleccionado', dept: 0, grp: 1, brand: 'Primor', unit: 'KG', cost: 1.15, price: 1.55, sup: 0, tax: taxExemptId, stock1: 450, stock2: 100, aisle: 'Pasillo 1B' },
      { sku: 'ARR-MAR-001', ean: '7591012300045', name: 'Arroz Mary Tradicional 1 Kg', desc: 'Arroz blanco enriquecido con hierro y vitaminas', dept: 0, grp: 1, brand: 'Mary', unit: 'KG', cost: 1.20, price: 1.60, sup: 0, tax: taxExemptId, stock1: 400, stock2: 90, aisle: 'Pasillo 1B' },
      { sku: 'PAS-PRI-SPA', ean: '7591012300052', name: 'Pasta Primor Spaghetti 1 Kg', desc: 'Pasta larga de sémola de trigo durum', dept: 0, grp: 2, brand: 'Primor', unit: 'KG', cost: 1.30, price: 1.75, sup: 0, tax: taxExemptId, stock1: 380, stock2: 110, aisle: 'Pasillo 1C' },
      { sku: 'PAS-RON-PLU', ean: '7591012300069', name: 'Pasta Ronco Corta Plumas 1 Kg', desc: 'Pasta corta tipo plumas para guisados', dept: 0, grp: 2, brand: 'Ronco', unit: 'KG', cost: 1.25, price: 1.70, sup: 10, tax: taxExemptId, stock1: 320, stock2: 75, aisle: 'Pasillo 1C' },
      { sku: 'ACE-MAZ-LIT', ean: '7591012300076', name: 'Aceite Mazeite Puro de Maíz 1 Litro', desc: 'Aceite vegetal refinado comestible 100% puro maíz', dept: 0, grp: 3, brand: 'Mazeite', unit: 'LITRO', cost: 3.10, price: 4.10, sup: 0, tax: taxExemptId, stock1: 250, stock2: 60, aisle: 'Pasillo 2A' },
      { sku: 'ACE-DIA-LIT', ean: '7591012300083', name: 'Aceite Comestible Diana 1 Litro', desc: 'Aceite vegetal comestible mezcla enriquecida', dept: 0, grp: 3, brand: 'Diana', unit: 'LITRO', cost: 2.20, price: 2.95, sup: 11, tax: taxExemptId, stock1: 220, stock2: 50, aisle: 'Pasillo 2A' },
      { sku: 'AZU-MON-001', ean: '7591012300090', name: 'Azúcar Refinada Montalbán 1 Kg', desc: 'Azúcar refinada blanca de caña de azúcar', dept: 0, grp: 5, brand: 'Montalbán', unit: 'KG', cost: 1.10, price: 1.50, sup: 9, tax: taxExemptId, stock1: 500, stock2: 150, aisle: 'Pasillo 2B' },
      { sku: 'GRA-CAR-NEG', ean: '7591012300106', name: 'Caraotas Negras Mary 500g', desc: 'Granos negros seleccionados cocción rápida', dept: 0, grp: 1, brand: 'Mary', unit: 'PAQ', cost: 1.35, price: 1.85, sup: 0, tax: taxExemptId, stock1: 200, stock2: 60, aisle: 'Pasillo 2C' },
      { sku: 'GRA-LEN-LUC', ean: '7591012300113', name: 'Lentejas La Lucha 500g', desc: 'Lentejas de primera importadas', dept: 0, grp: 1, brand: 'La Lucha', unit: 'PAQ', cost: 1.40, price: 1.95, sup: 10, tax: taxExemptId, stock1: 180, stock2: 45, aisle: 'Pasillo 2C' },
      { sku: 'CAF-FAM-250', ean: '7591012300120', name: 'Café Fama de América Tostado 250g', desc: 'Café molido gourmet venezolano aroma intenso', dept: 0, grp: 5, brand: 'Fama de América', unit: 'PAQ', cost: 2.40, price: 3.25, sup: 11, tax: taxExemptId, stock1: 280, stock2: 70, aisle: 'Pasillo 3A' },
      { sku: 'ATU-MAR-ACE', ean: '7591012300137', name: 'Atún Margarita en Aceite 140g', desc: 'Lomo de atún aleta amarilla en aceite vegetal', dept: 0, grp: 4, brand: 'Primor', unit: 'UNID', cost: 1.45, price: 1.95, sup: 0, tax: taxExemptId, stock1: 350, stock2: 90, aisle: 'Pasillo 3B' },
      { sku: 'SAR-GAV-170', ean: '7591012300144', name: 'Sardinas en Aceite La Gaviota 170g', desc: 'Sardinas enteras en aceite vegetal', dept: 0, grp: 4, brand: 'Primor', unit: 'UNID', cost: 0.65, price: 0.95, sup: 0, tax: taxExemptId, stock1: 400, stock2: 120, aisle: 'Pasillo 3B' },

      // GRAVADOS: SALSAS Y DULCES
      { sku: 'MAY-MAV-445', ean: '7591012300151', name: 'Mayonesa Mavesa Frasco 445g', desc: 'Mayonesa tradicional cremosa', dept: 0, grp: 7, brand: 'Mavesa', unit: 'UNID', cost: 2.60, price: 3.65, sup: 0, tax: taxIvaGenId, stock1: 260, stock2: 65, aisle: 'Pasillo 3C' },
      { sku: 'MAR-MAV-500', ean: '7591012300168', name: 'Margarina Mavesa con Sal 500g', desc: 'Margarina untable con sal', dept: 0, grp: 7, brand: 'Mavesa', unit: 'UNID', cost: 1.95, price: 2.75, sup: 0, tax: taxIvaGenId, stock1: 300, stock2: 80, aisle: 'Pasillo 3C' },
      { sku: 'CHO-TOD-400', ean: '7591012300175', name: 'Modificador de Leche Toddy 400g', desc: 'Bebida achocolatada instantánea con vitaminas', dept: 0, grp: 5, brand: 'Toddy', unit: 'PAQ', cost: 2.80, price: 3.90, sup: 0, tax: taxIvaGenId, stock1: 180, stock2: 45, aisle: 'Pasillo 4A' },
      { sku: 'CHO-SAV-CAR', ean: '7591012300182', name: 'Chocolate con Leche Savoy Carré 100g', desc: 'Tableta de chocolate con avellanas troceadas', dept: 0, grp: 5, brand: 'Savoy', unit: 'UNID', cost: 1.85, price: 2.60, sup: 1, tax: taxIvaGenId, stock1: 220, stock2: 60, aisle: 'Pasillo 4A' },
      { sku: 'GAL-PUI-MAR', ean: '7591012300199', name: 'Galletas María Puig Paquete 150g', desc: 'Galletas dulces tradicionales de harina de trigo', dept: 0, grp: 6, brand: 'Puig', unit: 'PAQ', cost: 0.85, price: 1.25, sup: 8, tax: taxIvaGenId, stock1: 420, stock2: 110, aisle: 'Pasillo 4B' },
      { sku: 'GAL-CLU-SOC', ean: '7591012300205', name: 'Galletas Club Social Original 6 Pack', desc: 'Galletas saladas crujientes empacadas individualmente', dept: 0, grp: 6, brand: 'Club Social', unit: 'PAQ', cost: 1.50, price: 2.10, sup: 2, tax: taxIvaGenId, stock1: 360, stock2: 95, aisle: 'Pasillo 4B' },
      { sku: 'GAL-ORE-CHO', ean: '7591012300212', name: 'Galletas Oreo Chocolate 108g', desc: 'Galletas sándwich rellenas con crema dulce', dept: 0, grp: 6, brand: 'Oreo', unit: 'PAQ', cost: 0.95, price: 1.40, sup: 2, tax: taxIvaGenId, stock1: 300, stock2: 85, aisle: 'Pasillo 4B' },

      // LÁCTEOS Y EMBUTIDOS
      { sku: 'LEC-CAM-1KG', ean: '7591012300229', name: 'Leche en Polvo Completa La Campesina 1 Kg', desc: 'Leche completa pasteurizada instantánea', dept: 1, grp: 8, brand: 'La Campesina', unit: 'KG', cost: 6.80, price: 9.30, sup: 0, tax: taxExemptId, stock1: 310, stock2: 70, aisle: 'Pasillo 5A' },
      { sku: 'LEC-MIV-LIT', ean: '7591012300236', name: 'Leche Líquida Pasteurizada Mi Vaca 1 Litro', desc: 'Leche líquida fresca entera refrigerada', dept: 1, grp: 8, brand: 'Mi Vaca', unit: 'LITRO', cost: 1.30, price: 1.80, sup: 7, tax: taxExemptId, stock1: 180, stock2: 40, aisle: 'Nevera Lácteos' },
      { sku: 'QUE-PAI-500', ean: '7591012300243', name: 'Queso Blanco Pasteurizado Paisa 500g', desc: 'Queso blanco semiduro pasteurizado empacado al vacío', dept: 1, grp: 9, brand: 'Paisa', unit: 'PAQ', cost: 3.40, price: 4.80, sup: 7, tax: taxExemptId, stock1: 150, stock2: 35, aisle: 'Nevera Lácteos' },
      { sku: 'QUE-TOR-250', ean: '7591012300250', name: 'Queso Amarillo Torondoy Cuña 250g', desc: 'Queso tipo gouda madurado nacional', dept: 1, grp: 9, brand: 'Torondoy', unit: 'PAQ', cost: 2.80, price: 3.95, sup: 7, tax: taxIvaGenId, stock1: 120, stock2: 30, aisle: 'Nevera Lácteos' },
      { sku: 'JAM-PLU-SUP', ean: '7591012300267', name: 'Jamón Cocido Superior Plumrose 1 Kg', desc: 'Jamón cocido de pierna selecta pieza para rebanar', dept: 1, grp: 10, brand: 'Plumrose', unit: 'KG', cost: 7.50, price: 10.50, sup: 6, tax: taxIvaGenId, stock1: 85, stock2: 25, aisle: 'Charcutería' },
      { sku: 'SAL-PLU-VIE', ean: '7591012300274', name: 'Salchichas Viena Plumrose Paquete 8 Unid.', desc: 'Salchichas tradicionales cocidas de cerdo y pollo', dept: 1, grp: 10, brand: 'Plumrose', unit: 'PAQ', cost: 1.70, price: 2.45, sup: 6, tax: taxIvaGenId, stock1: 190, stock2: 50, aisle: 'Charcutería' },
      { sku: 'TOC-PLU-250', ean: '7591012300281', name: 'Tocineta Ahumada Plumrose 250g', desc: 'Tocineta rebanada curada y ahumada', dept: 1, grp: 10, brand: 'Plumrose', unit: 'PAQ', cost: 2.90, price: 4.15, sup: 6, tax: taxIvaGenId, stock1: 110, stock2: 30, aisle: 'Charcutería' },

      // CARNICERÍA Y AVÍCOLA
      { sku: 'CAR-POL-ENT', ean: '7591012300298', name: 'Pollo Entero Beneficiado La Morita 1 Kg', desc: 'Pollo fresco entero beneficiado sin vísceras', dept: 2, grp: 12, brand: 'La Morita', unit: 'KG', cost: 2.10, price: 2.90, sup: 15, tax: taxExemptId, stock1: 250, stock2: 70, aisle: 'Nevera Aves' },
      { sku: 'CAR-PEC-POL', ean: '7591012300304', name: 'Pechuga de Pollo con Hueso 1 Kg', desc: 'Pechuga de pollo fresca de primera', dept: 2, grp: 12, brand: 'La Morita', unit: 'KG', cost: 3.40, price: 4.60, sup: 15, tax: taxExemptId, stock1: 180, stock2: 50, aisle: 'Nevera Aves' },
      { sku: 'CAR-RES-MOL', ean: '7591012300311', name: 'Carne de Res Molida de Primera 1 Kg', desc: 'Carne molida magra de res fresca', dept: 2, grp: 11, brand: 'Frigocentro', unit: 'KG', cost: 5.20, price: 7.20, sup: 16, tax: taxExemptId, stock1: 160, stock2: 40, aisle: 'Carnicería' },
      { sku: 'CAR-RES-SOL', ean: '7591012300328', name: 'Solomo de Cuerito Fresco 1 Kg', desc: 'Corte parrillero tierno de res nacional', dept: 2, grp: 11, brand: 'Frigocentro', unit: 'KG', cost: 6.80, price: 9.40, sup: 16, tax: taxExemptId, stock1: 120, stock2: 30, aisle: 'Carnicería' },
      { sku: 'HUE-MOR-CRT', ean: '7591012300335', name: 'Cartón de Huevos La Morita 30 Unid.', desc: 'Huevos de gallina frescos seleccionados clase A', dept: 2, grp: 12, brand: 'La Morita', unit: 'PAQ', cost: 3.60, price: 4.80, sup: 15, tax: taxExemptId, stock1: 140, stock2: 45, aisle: 'Nevera Aves' },

      // BEBIDAS Y REFRESCOS
      { sku: 'BEB-PEP-15L', ean: '7591012300342', name: 'Refresco Pepsi Regular Botella 1.5 Litros', desc: 'Bebida gaseosa sabor cola regular', dept: 3, grp: 14, brand: 'Pepsi', unit: 'UNID', cost: 1.20, price: 1.70, sup: 0, tax: taxIvaGenId, stock1: 300, stock2: 90, aisle: 'Pasillo 6A' },
      { sku: 'BEB-7UP-15L', ean: '7591012300359', name: 'Refresco 7Up Lima Limón 1.5 Litros', desc: 'Bebida gaseosa transparente sabor lima-limón', dept: 3, grp: 14, brand: '7Up', unit: 'UNID', cost: 1.20, price: 1.70, sup: 0, tax: taxIvaGenId, stock1: 220, stock2: 60, aisle: 'Pasillo 6A' },
      { sku: 'BEB-AGU-MIN', ean: '7591012300366', name: 'Agua Mineral Minalba sin Gas 1.5 L', desc: 'Agua mineral natural de manantial sin gas', dept: 3, grp: 15, brand: 'Minalba', unit: 'UNID', cost: 0.70, price: 1.10, sup: 0, tax: taxExemptId, stock1: 400, stock2: 120, aisle: 'Pasillo 6B' },
      { sku: 'BEB-MAL-POL', ean: '7591012300373', name: 'Maltín Polar Botella 250ml', desc: 'Bebida de malta energizante sin alcohol', dept: 3, grp: 16, brand: 'Maltín Polar', unit: 'UNID', cost: 0.65, price: 0.95, sup: 0, tax: taxIvaGenId, stock1: 550, stock2: 150, aisle: 'Pasillo 6B' },

      // CERVEZAS Y LICORES
      { sku: 'LIC-CER-PIL', ean: '7591012300380', name: 'Cerveza Polar Pilsen Botella 222ml', desc: 'Cerveza pilsen tradicional tipo dorada', dept: 4, grp: 17, brand: 'Polar Pilsen', unit: 'UNID', cost: 0.85, price: 1.25, sup: 4, tax: taxIvaGenId, stock1: 600, stock2: 180, aisle: 'Pasillo 7A' },
      { sku: 'LIC-CER-LIG', ean: '7591012300397', name: 'Cerveza Polar Light Botella 222ml', desc: 'Cerveza suave bajo contenido calórico', dept: 4, grp: 17, brand: 'Polar Light', unit: 'UNID', cost: 0.85, price: 1.25, sup: 4, tax: taxIvaGenId, stock1: 500, stock2: 140, aisle: 'Pasillo 7A' },
      { sku: 'LIC-CER-REG', ean: '7591012300403', name: 'Cerveza Regional Clara Botella 222ml', desc: 'Cerveza clara sabor refrescante', dept: 4, grp: 17, brand: 'Regional', unit: 'UNID', cost: 0.80, price: 1.20, sup: 5, tax: taxIvaGenId, stock1: 400, stock2: 110, aisle: 'Pasillo 7A' },
      { sku: 'LIC-RON-STR', ean: '7591012300410', name: 'Ron Añejo Santa Teresa Gran Reserva 750ml', desc: 'Ron añejo venezolano de solera de roble blanco', dept: 4, grp: 18, brand: 'Santa Teresa', unit: 'UNID', cost: 7.20, price: 10.50, sup: 3, tax: taxIvaGenId, stock1: 180, stock2: 45, aisle: 'Pasillo 7B' },
      { sku: 'LIC-RON-CAC', ean: '7591012300427', name: 'Ron Cacique Añejo Tradicional 750ml', desc: 'Ron dorado venezolano añejado en barricas', dept: 4, grp: 18, brand: 'Cacique', unit: 'UNID', cost: 6.90, price: 9.80, sup: 3, tax: taxIvaGenId, stock1: 150, stock2: 40, aisle: 'Pasillo 7B' },

      // CUIDADO PERSONAL
      { sku: 'CP-COL-TRI', ean: '7591012300434', name: 'Crema Dental Colgate Triple Acción 100ml', desc: 'Protección anticaries, blancura y aliento fresco', dept: 5, grp: 19, brand: 'Colgate', unit: 'UNID', cost: 1.35, price: 1.95, sup: 12, tax: taxIvaGenId, stock1: 340, stock2: 90, aisle: 'Pasillo 8A' },
      { sku: 'CP-JAB-PRO', ean: '7591012300441', name: 'Jabón de Tocador Protex Antibacterial 110g', desc: 'Jabón en barra protección natural antibacteriana', dept: 5, grp: 19, brand: 'Protex', unit: 'UNID', cost: 0.85, price: 1.25, sup: 12, tax: taxIvaGenId, stock1: 450, stock2: 120, aisle: 'Pasillo 8A' },
      { sku: 'CP-CHA-PAN', ean: '7591012300458', name: 'Champú Pantene Pro-V Restauración 400ml', desc: 'Champú con micro-nutrientes restaurador capilar', dept: 5, grp: 20, brand: 'Pantene', unit: 'UNID', cost: 3.50, price: 4.95, sup: 13, tax: taxIvaGenId, stock1: 160, stock2: 45, aisle: 'Pasillo 8B' },
      { sku: 'CP-DES-REX', ean: '7591012300465', name: 'Desodorante Rexona Clinical Aerosol 150ml', desc: 'Protección antitranspirante 3 veces más eficaz', dept: 5, grp: 19, brand: 'Rexona', unit: 'UNID', cost: 3.20, price: 4.60, sup: 13, tax: taxIvaGenId, stock1: 140, stock2: 40, aisle: 'Pasillo 8B' },
      { sku: 'CP-PAP-SCO', ean: '7591012300472', name: 'Papel Higiénico Scott Rinde Más 4 Rollos', desc: 'Papel higiénico doble hoja suave y resistente', dept: 5, grp: 21, brand: 'Scott', unit: 'PAQ', cost: 1.80, price: 2.65, sup: 14, tax: taxIvaGenId, stock1: 280, stock2: 75, aisle: 'Pasillo 9A' },

      // LIMPIEZA DEL HOGAR
      { sku: 'LIM-DET-ARI', ean: '7591012300489', name: 'Detergente en Polvo Ariel Doble Poder 1 Kg', desc: 'Detergente con aceleradores de lavado para ropa blanca y color', dept: 6, grp: 22, brand: 'Ariel', unit: 'KG', cost: 2.70, price: 3.85, sup: 13, tax: taxIvaGenId, stock1: 290, stock2: 80, aisle: 'Pasillo 9B' },
      { sku: 'LIM-CLO-CLO', ean: '7591012300496', name: 'Cloro Tradicional Blanqueador Clorox 1 Litro', desc: 'Desinfectante y blanqueador para ropa y superficies', dept: 6, grp: 23, brand: 'Clorox', unit: 'LITRO', cost: 1.10, price: 1.60, sup: 12, tax: taxIvaGenId, stock1: 320, stock2: 85, aisle: 'Pasillo 10A' },
      { sku: 'LIM-AXI-LIM', ean: '7591012300502', name: 'Lavaplatos en Crema Axion Limón 450g', desc: 'Crema arrancagrasa concentrada con aroma cítrico', dept: 6, grp: 24, brand: 'Axion', unit: 'UNID', cost: 1.45, price: 2.15, sup: 12, tax: taxIvaGenId, stock1: 260, stock2: 70, aisle: 'Pasillo 10A' },
      { sku: 'LIM-MIS-LAV', ean: '7591012300519', name: 'Desinfectante Multiusos Mistolín Lavanda 1 L', desc: 'Limpiador líquido aromatizante para pisos', dept: 6, grp: 23, brand: 'Mistolín', unit: 'LITRO', cost: 1.35, price: 1.95, sup: 12, tax: taxIvaGenId, stock1: 270, stock2: 70, aisle: 'Pasillo 10B' },

      // FRUTAS Y HORTALIZAS
      { sku: 'FRU-TOM-MAN', ean: '7591012300526', name: 'Tomate Manzano Fresco 1 Kg', desc: 'Tomate de perita para ensaladas y salsas', dept: 7, grp: 25, brand: 'La Morita', unit: 'KG', cost: 1.20, price: 1.85, sup: 17, tax: taxExemptId, stock1: 150, stock2: 50, aisle: 'Área Verduras' },
      { sku: 'FRU-CEB-BLA', ean: '7591012300533', name: 'Cebolla Blanca Seleccionada 1 Kg', desc: 'Cebolla blanca nacional de cultivo andino', dept: 7, grp: 25, brand: 'La Morita', unit: 'KG', cost: 1.10, price: 1.70, sup: 17, tax: taxExemptId, stock1: 180, stock2: 60, aisle: 'Área Verduras' },
      { sku: 'FRU-PAP-AND', ean: '7591012300540', name: 'Papa Blanca de los Andes 1 Kg', desc: 'Papa fresca lavada especial para puré y freír', dept: 7, grp: 25, brand: 'La Morita', unit: 'KG', cost: 1.25, price: 1.90, sup: 17, tax: taxExemptId, stock1: 220, stock2: 70, aisle: 'Área Verduras' },
      { sku: 'FRU-PLA-MAD', ean: '7591012300557', name: 'Plátano Maduro de Primera 1 Kg', desc: 'Plátano maduro venezolano racimo seleccionado', dept: 7, grp: 25, brand: 'La Morita', unit: 'KG', cost: 0.90, price: 1.40, sup: 17, tax: taxExemptId, stock1: 200, stock2: 60, aisle: 'Área Verduras' },
    ];

    for (let i = 0; i < productsDef.length; i++) {
      const p = productsDef[i];
      const prodId = `prd11111-0000-0000-0000-${String(i + 1).padStart(12, '0')}`;
      const deptId = departments[p.dept].id;
      const grpId = groups[p.grp].id;
      const supId = suppliers[p.sup].id;

      // Inserción en products
      await conn.query(
        `INSERT INTO products (
          id, company_id, sku, barcode, name, description,
          product_type, tracks_inventory,
          department_id, group_id, subgroup_id, supplier_id,
          brand, unit_of_measure, cost_price, base_price, currency,
          default_tax_rate_id, tax_inclusive, min_stock, max_stock,
          has_batches, has_serials, is_active
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          'physical', 1,
          ?, ?, NULL, ?,
          ?, ?, ?, ?, 'USD',
          ?, 0, 20, 1000,
          1, 0, 1
        )`,
        [
          prodId, companyId, p.sku, p.ean, p.name, p.desc,
          deptId, grpId, supId,
          p.brand, p.unit, p.cost, p.price,
          p.tax
        ]
      );

      // SKU principal
      await conn.query(
        `INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
         VALUES (UUID(), ?, ?, ?, ?, 1, ?, ?, 'USD', 1)`,
        [prodId, p.sku, p.ean, `SKU Principal ${p.name}`, p.cost, p.price]
      );

      // Precios por Lista (Detal, Mayor, VIP)
      await conn.query(
        `INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
         VALUES 
         (UUID(), ?, ?, ?, 'USD', NOW()),
         (UUID(), ?, ?, ?, 'USD', NOW()),
         (UUID(), ?, ?, ?, 'USD', NOW())`,
        [
          prodId, priceListDetalId, p.price,
          prodId, priceListMayorId, Number((p.price * 0.90).toFixed(2)),
          prodId, priceListVipId, Number((p.price * 0.85).toFixed(2))
        ]
      );

      // Presentación predeterminada (Unidad / Empaque individual)
      await conn.query(
        `INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
         VALUES (UUID(), ?, 'Empaque Individual', ?, ?, ?, 1.0000, ?, ?, 'USD', 1, 0, 1)`,
        [prodId, p.sku, p.ean, p.unit, p.cost, p.price]
      );

      // Presentación por Bulto / Caja para víveres seleccionados
      if (p.unit === 'KG' || p.unit === 'PAQ' || p.unit === 'UNID') {
        const bultoMultiplier = 12;
        const bultoCost = Number((p.cost * bultoMultiplier * 0.95).toFixed(2));
        const bultoPrice = Number((p.price * bultoMultiplier * 0.92).toFixed(2));
        await conn.query(
          `INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
           VALUES (UUID(), ?, 'Bulto x 12 Unidades', ?, ?, 'BULTO', ?, ?, ?, 'USD', 0, 0, 1)`,
          [prodId, `${p.sku}-B12`, `759${p.ean.slice(3, -1)}9`, bultoMultiplier, bultoCost, bultoPrice]
        );
      }

      // Stock en Almacén Principal
      if (mainWhId) {
        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
           VALUES (?, ?, ?, 0, NOW())`,
          [prodId, mainWhId, p.stock1]
        );

        await conn.query(
          `INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
           VALUES (UUID(), ?, ?, ?, 'Estante 01', 'Nivel 1', 'Sector Hipermercado')`,
          [prodId, mainWhId, p.aisle]
        );

        // Lote inicial con fecha de vencimiento realista
        await conn.query(
          `INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
           VALUES (UUID(), ?, ?, ?, ?, DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), ?, ?, 0, ?, 'ACTIVE', 'Lote de apertura hipermercado')`,
          [companyId, prodId, mainWhId, `LOT-${p.sku}-2026`, p.stock1, p.stock1, p.cost]
        );
      }

      // Stock en Piso de Venta
      if (storeWhId && storeWhId !== mainWhId) {
        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
           VALUES (?, ?, ?, 0, NOW())`,
          [prodId, storeWhId, p.stock2]
        );

        await conn.query(
          `INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
           VALUES (UUID(), ?, ?, ?, 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición')`,
          [prodId, storeWhId, p.aisle]
        );
      }
    }

    console.log(`✅ ¡Inicialización de Hipermercado completada con éxito! (${productsDef.length} productos insertados).`);
  } catch (error: any) {
    console.error('❌ Error durante la inicialización:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

// Si se ejecuta directamente desde línea de comandos
if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.toLowerCase().includes('runhypermarketseed')
) {
  runHypermarketSeed()
    .then(() => {
      console.log('🏁 Proceso finalizado correctamente.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Error fatal en el proceso:', err);
      process.exit(1);
    });
}
