import crypto from 'crypto';
import { query, withTransaction, pool } from './index';
import { AccountingAutoPostingService } from '../modules/accounting/accounting-auto-posting.service';

const COMPANY_ID = 'c366fec3-d5ef-486a-9806-792c9629e6aa';
const BRANCH_ID = 'f16d3705-ad17-46bb-a559-ea191f7c9434';
const WH_CENTRAL = 'd3c46bb3-fc45-4462-9c84-d71e2ac6b339'; // Depósito General Central
const WH_PISO = '1e781952-43f8-4532-84de-b7aeaa535339';    // Piso De Ventas
const WH_AVERIAS = '89aa754c-1ce1-479e-b35c-1195cdb8e24e'; // Averías
const USER_ID = 'd7bbdfc5-de79-4158-bcdb-39c09fec8b72';    // Contador / Admin
const BANK_VES_ID = '08ee6a26-2520-460f-b2fe-bf934fa6caa6';
const BANK_USD_ID = '0980d20f-0739-4564-9c48-490bc8612352';
const CASH_REG_ID = '30d97e54-a796-4312-a521-16d90c835dff';

const SUPPLIER_POLAR = 'b295a63a-ad80-446f-ad1b-da0be1c73a80';
const CUSTOMER_EDGAR = '4e09212e-4772-470d-be73-4c00bba350f7';

const PROD_HARINA = 'fd564a2a-ec3d-466b-b075-45b164dfd4b2';
const PROD_MANTE1 = '4572327b-6f03-47fb-a443-17f233039602';

async function main() {
  console.log('Iniciando generación de data de demostración (Últimos 3 meses: Sep, Oct, Nov 2026)...');

  // 1. Verificar / crear entidades complementarias para demo rica (2do proveedor cárnico, 3er cliente jurídico, 3 productos cárnicos)
  const supplierCarnesId = 'd0000000-0000-4000-8000-202600000001';
  const customerJurId = 'd0000000-0000-4000-8000-202600000002';
  const prodCanalId = 'd0000000-0000-4000-8000-202600000101';
  const prodLomitoId = 'd0000000-0000-4000-8000-202600000102';
  const prodPrimeraId = 'd0000000-0000-4000-8000-202600000103';

  const existingDemo = await query<any>(
    `SELECT id FROM customer_notes WHERE company_id = ? AND note_number = 'NDC-DEMO-1101' LIMIT 1`,
    [COMPANY_ID]
  );
  if (existingDemo.length > 0) {
    console.log('La data de demostración de los últimos 3 meses ya está completa en esta empresa.');
    await pool.end();
    return;
  }

  // Limpiar si quedó ejecución parcial previa (solo meses sin completar)
  const sepDone = await query<any>(
    `SELECT id FROM sales_invoices WHERE branch_id = ? AND invoice_number = 'FV-DEMO-0901' LIMIT 1`,
    [BRANCH_ID]
  );
  const startMonthIdx = sepDone.length > 0 ? 1 : 0;

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT IGNORE INTO suppliers (id, company_id, rif, name, commercial_name, fiscal_address, phone, email, is_person_natural, is_resident, payment_terms_days, is_active, bank_name, account_number, account_type)
       VALUES (?, ?, 'J-40112233-5', 'FRIGORÍFICO EL LLANO, C.A.', 'El Llano Carnes', 'Zona Industrial Sur, Valencia', '0241-8321100', 'ventas@el-llano.test', 0, 1, 15, 1, 'BNC', '01910099112233445566', 'CURRENT')`,
      [supplierCarnesId, COMPANY_ID]
    );

    await conn.query(
      `INSERT IGNORE INTO customers (id, company_id, doc_type, doc_number, name, address, phone, email, is_special_taxpayer, credit_enabled, credit_limit, payment_terms_days, is_active)
       VALUES (?, ?, 'J', '40555666-1', 'INVERSIONES LA ROCA C.A.', 'Av. 5 de Julio, Maracaibo', '0261-7410022', 'compras@laroca.test', 1, 1, 15000.00, 15, 1)`,
      [customerJurId, COMPANY_ID]
    );

    const [deptRows]: any = await conn.query(`SELECT id FROM departments WHERE company_id = ? LIMIT 1`, [COMPANY_ID]);
    const deptId = deptRows[0]?.id || null;
    const [grpRows]: any = deptId ? await conn.query(`SELECT id FROM \`groups\` WHERE department_id = ? LIMIT 1`, [deptId]) : [[]];
    const grpId = grpRows[0]?.id || null;
    const [subRows]: any = grpId ? await conn.query(`SELECT id FROM subgroups WHERE group_id = ? LIMIT 1`, [grpId]) : [[]];
    const subId = subRows[0]?.id || null;

    await conn.query(
      `INSERT IGNORE INTO products (
        id, company_id, sku, name, product_type, tracks_inventory, department_id, group_id, subgroup_id,
        unit_of_measure, cost_price, base_price, currency, is_active, allows_waste, is_butchery_base, is_butchery_yield, expected_waste_pct
      ) VALUES
        (?, ?, 'CARN-CANAL', 'Res en Canal (Kg)', 'raw_material', 1, ?, ?, ?, 'KG', 4.2000, 0.0000, 'USD', 1, 1, 1, 0, 15.00),
        (?, ?, 'CARN-LOMITO', 'Lomito de Res Limpio (Kg)', 'physical', 1, ?, ?, ?, 'KG', 7.5000, 13.5000, 'USD', 1, 0, 0, 1, 0.00),
        (?, ?, 'CARN-PRIMERA', 'Pulpa Negra / Primera (Kg)', 'physical', 1, ?, ?, ?, 'KG', 5.8000, 10.2000, 'USD', 1, 0, 0, 1, 0.00)`,
      [
        prodCanalId, COMPANY_ID, deptId, grpId, subId,
        prodLomitoId, COMPANY_ID, deptId, grpId, subId,
        prodPrimeraId, COMPANY_ID, deptId, grpId, subId,
      ]
    );

    // Asegurar stock inicial mínimo en WH_CENTRAL si estaba en 0
    for (const [pid, qty] of [[PROD_HARINA, 100], [PROD_MANTE1, 80], [prodCanalId, 200], [prodLomitoId, 20], [prodPrimeraId, 30]] as const) {
      await conn.query(
        `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
         VALUES (?, ?, ?, '2026-09-01 08:00:00')
         ON DUPLICATE KEY UPDATE current_stock = current_stock + VALUES(current_stock)`,
        [pid, WH_CENTRAL, qty]
      );
    }
  });

  const reasonRows = await query<any>(`SELECT id, code FROM waste_reasons WHERE company_id = ?`, [COMPANY_ID]);
  const reasonMap = new Map<string, string>(reasonRows.map((r: any) => [r.code, r.id]));
  const wasteHuesoId = reasonMap.get('HUESO_GRASA') || reasonRows[0]?.id;
  const wasteDeshidId = reasonMap.get('DESHIDRATACION') || reasonRows[0]?.id;

  const months = [
    { m: 9, mm: '09', label: 'Septiembre', rate: 48.20, inpc: 123.10 },
    { m: 10, mm: '10', label: 'Octubre', rate: 50.65, inpc: 127.40 },
    { m: 11, mm: '11', label: 'Noviembre', rate: 53.10, inpc: 131.90 },
  ];

  for (const cfg of months.slice(startMonthIdx)) {
    const { m, mm, label, rate, inpc } = cfg;
    console.log(`Generando operaciones para ${label} 2026 (Tasa BCV: ${rate})...`);

    // A. Tasa BCV e Índice INPC del mes
    await query(
      `INSERT INTO exchange_rates (id, company_id, rate, currency_base, currency_secondary, effective_date, source, user_id, created_by_name)
       VALUES (?, ?, ?, 'VES', 'USD', ?, 'BCV', ?, 'Demo Seeder')`,
      [crypto.randomUUID(), COMPANY_ID, rate, `2026-${mm}-02`, USER_ID]
    );
    await query(
      `INSERT INTO accounting_inflation_indices (id, year, month, inpc_value, variation_monthly, published_date)
       VALUES (?, 2026, ?, ?, 3.50, ?)
       ON DUPLICATE KEY UPDATE inpc_value = VALUES(inpc_value)`,
      [crypto.randomUUID(), m, inpc, `2026-${mm}-28`]
    );

    const hasOc = (await query<any>(`SELECT id FROM purchase_orders WHERE company_id = ? AND order_number = ? LIMIT 1`, [COMPANY_ID, `OC-DEMO-${mm}01`])).length > 0;
    const hasProd = (await query<any>(`SELECT id FROM production_orders WHERE company_id = ? AND order_number = ? LIMIT 1`, [COMPANY_ID, `PROD-DM-${mm}01`])).length > 0;
    const hasTr = (await query<any>(`SELECT id FROM inventory_transfers WHERE company_id = ? AND transfer_number = ? LIMIT 1`, [COMPANY_ID, `TR-DEMO-${mm}01`])).length > 0;
    const hasPrice = (await query<any>(`SELECT id FROM price_change_batches WHERE company_id = ? AND batch_number = ? LIMIT 1`, [COMPANY_ID, `PR-DEMO-${mm}01`])).length > 0;

    // B. Orden de Compra + Factura de Compra + CxP + Retenciones SENIAT + Pago Parcial/Total + Nota de Proveedor
    if (!hasOc) await withTransaction(async (conn) => {
      const poId = crypto.randomUUID();
      const poNum = `OC-DEMO-${mm}01`;
      const poDate = `2026-${mm}-04 09:30:00`;

      await conn.query(
        `INSERT INTO purchase_orders (id, company_id, branch_id, supplier_id, user_id, order_number, order_date, expected_delivery_date, currency, exchange_rate, subtotal_amount, tax_amount, total_amount, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, 760.00, 48.00, 808.00, 'RECEIVED', ?, ?)`,
        [poId, COMPANY_ID, BRANCH_ID, supplierCarnesId, USER_ID, poNum, poDate, `2026-${mm}-06`, rate, `Abastecimiento ${label} 2026`, poDate]
      );
      await conn.query(
        `INSERT INTO purchase_order_items (id, order_id, product_id, quantity_ordered, quantity_received, unit_cost, tax_rate, tax_amount, subtotal, total)
         VALUES (?, ?, ?, 110, 110, 4.1818, 0, 0, 460.00, 460.00),
                (?, ?, ?, 250, 250, 1.2000, 16, 48.00, 300.00, 348.00)`,
        [crypto.randomUUID(), poId, prodCanalId, crypto.randomUUID(), poId, PROD_MANTE1]
      );

      const pInvId = crypto.randomUUID();
      const pInvNum = `FC-DEMO-${mm}01`;
      const pInvDate = `2026-${mm}-06`;

      await conn.query(
        `INSERT INTO purchase_invoices (
          id, branch_id, warehouse_id, supplier_id, user_id, invoice_number, control_number,
          invoice_date, currency, exchange_rate, base_exempt_amount, base_taxable_amount,
          tax_amount, igtf_amount, discount_amount, total_amount, is_credit, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, 460.00, 300.00, 48.00, 0, 0, 808.00, 1, ?, ?)`,
        [pInvId, BRANCH_ID, WH_CENTRAL, supplierCarnesId, USER_ID, pInvNum, `00-DM${mm}01`, pInvDate, rate, m === 11 ? 'PENDING' : 'PAID', `${pInvDate} 11:00:00`]
      );
      await conn.query(
        `INSERT INTO purchase_invoice_items (id, invoice_id, product_id, quantity, unit_price, tax_rate, discount_percent, tax_amount, subtotal, total)
         VALUES (?, ?, ?, 110, 4.1818, 0, 0, 0, 460.00, 460.00),
                (?, ?, ?, 250, 1.2000, 16, 0, 48.00, 300.00, 348.00)`,
        [crypto.randomUUID(), pInvId, prodCanalId, crypto.randomUUID(), pInvId, PROD_MANTE1]
      );

      for (const [pid, qty, uCost] of [[prodCanalId, 110, 4.1818], [PROD_MANTE1, 250, 1.20]] as const) {
        const [st]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [pid, WH_CENTRAL]);
        const prev = Number(st[0]?.current_stock || 0);
        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
           VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = VALUES(last_movement_at)`,
          [pid, WH_CENTRAL, prev + qty, `${pInvDate} 11:00:00`]
        );
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'PURCHASE', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), BRANCH_ID, WH_CENTRAL, pid, USER_ID, qty, uCost, Number((qty * uCost).toFixed(4)), prev, prev + qty, pInvNum, `Compra ${label}`, `${pInvDate} 11:00:00`]
        );
      }

      // SENIAT: Retención IVA 75% e ISLR 2%
      await conn.query(
        `INSERT INTO tax_withholdings_iva (id, company_id, branch_id, supplier_id, purchase_invoice_id, voucher_number, tax_period, fortnight, invoice_number, control_number, invoice_date, total_invoice_amount, exempt_amount, taxable_base_amount, tax_rate, iva_amount, retained_percentage, iva_retained_amount, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 16.00, ?, 75.00, ?, 'EMITTED', ?)`,
        [
          crypto.randomUUID(), COMPANY_ID, BRANCH_ID, supplierCarnesId, pInvId,
          `2026${mm}00009001`, `2026-${mm}`, pInvNum, `00-DM${mm}01`, pInvDate,
          Number((808 * rate).toFixed(2)), Number((460 * rate).toFixed(2)), Number((300 * rate).toFixed(2)),
          Number((48 * rate).toFixed(2)), Number((36 * rate).toFixed(2)), `${pInvDate} 11:30:00`
        ]
      );
      await conn.query(
        `INSERT INTO tax_withholdings_islr (id, company_id, branch_id, supplier_id, purchase_invoice_id, voucher_number, tax_period, concept_code, concept_description, person_type, total_invoice_amount, taxable_base_amount, rate_percentage, subtracting_factor, islr_retained_amount, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '055', 'Compra de mercancías y suministros', 'PJD', ?, ?, 2.00, 0, ?, 'EMITTED', ?)`,
        [
          crypto.randomUUID(), COMPANY_ID, BRANCH_ID, supplierCarnesId, pInvId,
          `ISLR-2026${mm}-01`, `2026-${mm}`, Number((808 * rate).toFixed(2)), Number((300 * rate).toFixed(2)),
          Number((6 * rate).toFixed(2)), `${pInvDate} 11:35:00`
        ]
      );

      // CxP + Pago (En Noviembre dejamos una factura verificada lista en Tesorería para demostrar el pago en vivo!)
      const payableId = crypto.randomUUID();
      const paidAmt = m === 11 ? 300.00 : 808.00;
      const pStatus = m === 11 ? 'PARTIAL' : 'PAID';

      await conn.query(
        `INSERT INTO payables (id, branch_id, supplier_id, invoice_id, amount_total, amount_paid, due_date, status, is_verified, verified_at, verified_by, created_at)
         VALUES (?, ?, ?, ?, 808.00, ?, ?, ?, 1, ?, ?, ?)`,
        [payableId, BRANCH_ID, supplierCarnesId, pInvId, paidAmt, `2026-${mm}-25`, pStatus, `${pInvDate} 12:00:00`, USER_ID, `${pInvDate} 11:00:00`]
      );

      await AccountingAutoPostingService.postPurchaseInvoice(conn, pInvId, USER_ID);

      // Pago desde Tesorería (alternando BNC Dólares y BNC Bolívares)
      const paymentId = crypto.randomUUID();
      const useUsd = m % 2 === 1;
      const bankAccId = useUsd ? BANK_USD_ID : BANK_VES_ID;
      const payVes = Number((paidAmt * rate).toFixed(2));
      const payMethod = useUsd ? 'TRANSFER_USD' : 'TRANSFER_VES';
      const payTimestamp = `2026-${mm}-10 10:15:00`;

      await conn.query(
        `INSERT INTO purchase_payments (id, invoice_id, payable_id, bank_account_id, method, amount_ves, amount_usd, exchange_rate, reference_number, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, pInvId, payableId, bankAccId, payMethod, payVes, paidAmt, rate, `PAG-DEMO-${mm}01`, `Abono proveedor ${label}`, payTimestamp]
      );

      const [bk]: any = await conn.query(`SELECT current_balance FROM bank_accounts WHERE id = ? FOR UPDATE`, [bankAccId]);
      const bankDelta = useUsd ? paidAmt : payVes;
      const nextBankBal = Number((Number(bk[0].current_balance) - bankDelta).toFixed(2));
      await conn.query(`UPDATE bank_accounts SET current_balance = ? WHERE id = ?`, [nextBankBal, bankAccId]);
      await conn.query(
        `INSERT INTO bank_movements (id, account_id, user_id, movement_type, amount, balance_after, movement_date, reference_number, concept, is_reconciled, created_at)
         VALUES (?, ?, ?, 'WITHDRAWAL', ?, ?, ?, ?, ?, 1, ?)`,
        [crypto.randomUUID(), bankAccId, USER_ID, bankDelta, nextBankBal, payTimestamp, `PAG-DEMO-${mm}01`, `Pago a Frigorífico El Llano (${pInvNum})`, payTimestamp]
      );

      await AccountingAutoPostingService.postPayablePayment(conn, paymentId, USER_ID);

      // Nota de Crédito de Proveedor en Octubre (Descuento $40)
      if (m === 10) {
        const snId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO supplier_notes (id, company_id, branch_id, supplier_id, user_id, warehouse_id, affected_invoice_id, type, note_number, control_number, note_date, currency, exchange_rate, subtotal_amount, tax_amount, total_amount, available_balance, reason_type, reason_description, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'CREDIT', 'NCP-DEMO-1001', '00-NCP1001', '2026-10-12 14:00:00', 'USD', ?, 40.00, 0, 40.00, 40.00, 'DISCOUNT', 'Descuento por volumen en compra Octubre', 'ACTIVE', '2026-10-12 14:00:00')`,
          [snId, COMPANY_ID, BRANCH_ID, supplierCarnesId, USER_ID, WH_CENTRAL, pInvId, rate]
        );
        await conn.query(
          `INSERT INTO supplier_note_items (id, note_id, product_id, description, quantity, unit_cost, tax_rate, tax_amount, subtotal, total, return_from_inventory)
           VALUES (?, ?, ?, 'Descuento comercial por volumen', 1, 40.00, 0, 0, 40.00, 40.00, 0)`,
          [crypto.randomUUID(), snId, prodCanalId]
        );
      }
    });

    // C. Producción / Desposte y Merma
    if (!hasProd) await withTransaction(async (conn) => {
      const poId = crypto.randomUUID();
      const orderNum = `PROD-DM-${mm}01`;
      const prodDate = `2026-${mm}-12 09:00:00`;
      const wasteLogId = crypto.randomUUID();

      const [stC]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [prodCanalId, WH_CENTRAL]);
      const prevC = Number(stC[0]?.current_stock || 0);
      await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevC - 100, prodDate, prodCanalId, WH_CENTRAL]);
      await conn.query(
        `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
         VALUES (?, ?, ?, ?, ?, 'OUT', 100, 4.20, 420.00, ?, ?, ?, 'Consumo Desposte Carnicería', ?)`,
        [crypto.randomUUID(), BRANCH_ID, WH_CENTRAL, prodCanalId, USER_ID, prevC, prevC - 100, orderNum, prodDate]
      );

      for (const [outId, outQty, uCost] of [[prodLomitoId, 55, 4.9412], [prodPrimeraId, 30, 4.9412]] as const) {
        const [stO]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [outId, WH_CENTRAL]);
        const prevO = Number(stO[0]?.current_stock || 0);
        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
           VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = VALUES(last_movement_at)`,
          [outId, WH_CENTRAL, prevO + outQty, prodDate]
        );
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, 'Ingreso Corte Final Desposte', ?)`,
          [crypto.randomUUID(), BRANCH_ID, WH_CENTRAL, outId, USER_ID, outQty, uCost, Number((outQty * uCost).toFixed(4)), prevO, prevO + outQty, orderNum, prodDate]
        );
      }

      const method = m === 11 ? 'EQUAL_UNIT' : 'BY_WEIGHT';
      await conn.query(
        `INSERT INTO production_orders (id, company_id, branch_id, warehouse_id, order_number, process_type, source_product_id, source_quantity, source_unit_cost, source_total_cost, total_output_quantity, waste_quantity, waste_pct, waste_reason_id, waste_cost, cost_allocation_method, status, notes, created_by, completed_by, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'WHOLE_CARCASS', ?, 100, 4.20, 420.00, 85, 15, 15.00, ?, 63.00, ?, 'COMPLETED', ?, ?, ?, ?, ?)`,
        [poId, COMPANY_ID, BRANCH_ID, WH_CENTRAL, orderNum, prodCanalId, wasteHuesoId, method, `Desposte ${label}`, USER_ID, USER_ID, prodDate, prodDate]
      );
      await conn.query(
        `INSERT INTO production_order_outputs (id, order_id, product_id, output_type, quantity, yield_pct, allocated_unit_cost, allocated_total_cost)
         VALUES (?, ?, ?, 'FINAL_CUT', 55, 55.00, 4.9412, 271.76),
                (?, ?, ?, 'FINAL_CUT', 30, 30.00, 4.9412, 148.24)`,
        [crypto.randomUUID(), poId, prodLomitoId, crypto.randomUUID(), poId, prodPrimeraId]
      );
      await conn.query(
        `INSERT INTO production_waste_logs (id, company_id, branch_id, warehouse_id, production_order_id, product_id, waste_reason_id, quantity, unit_cost, total_cost, notes, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 15, 4.20, 63.00, ?, ?, ?)`,
        [wasteLogId, COMPANY_ID, BRANCH_ID, WH_CENTRAL, poId, prodCanalId, wasteHuesoId, `Hueso y grasa de desposte ${label}`, USER_ID, prodDate]
      );

      if (method === 'EQUAL_UNIT') {
        await AccountingAutoPostingService.postInventoryWaste(conn, {
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          userId: USER_ID,
          wasteLogId,
          productName: 'Res en Canal (Kg)',
          reasonName: 'Hueso y Grasa no comercializable',
          totalCostUsd: 63.00,
          referenceDoc: orderNum,
          entryDate: `2026-${mm}-12`,
        });
      }
    });

    // D. Traslado entre Almacenes (Depósito General Central -> Piso De Ventas) y Ajuste de Inventario
    if (!hasTr) await withTransaction(async (conn) => {
      const trId = crypto.randomUUID();
      const trNum = `TR-DEMO-${mm}01`;
      const trDate = `2026-${mm}-14 10:00:00`;

      await conn.query(
        `INSERT INTO inventory_transfers (id, company_id, transfer_number, origin_branch_id, origin_warehouse_id, destination_branch_id, destination_warehouse_id, shipped_by_user_id, received_by_user_id, total_items, total_cost, status, shipped_at, received_at, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 412.50, 'RECEIVED', ?, ?, ?, ?)`,
        [trId, COMPANY_ID, trNum, BRANCH_ID, WH_CENTRAL, BRANCH_ID, WH_PISO, USER_ID, USER_ID, trDate, trDate, `Reposición piso de ventas ${label}`, trDate]
      );
      await conn.query(
        `INSERT INTO inventory_transfer_items (id, transfer_id, product_id, quantity_sent, quantity_received, unit_cost)
         VALUES (?, ?, ?, 40, 40, 7.50), (?, ?, ?, 50, 50, 1.20)`,
        [crypto.randomUUID(), trId, prodLomitoId, crypto.randomUUID(), trId, PROD_MANTE1]
      );

      for (const [pid, qty, uCost] of [[prodLomitoId, 40, 7.50], [PROD_MANTE1, 50, 1.20]] as const) {
        const [stO]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [pid, WH_CENTRAL]);
        const prevO = Number(stO[0]?.current_stock || 0);
        await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevO - qty, trDate, pid, WH_CENTRAL]);
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'TRANSFER_OUT', ?, ?, ?, ?, ?, ?, 'Despacho a Piso de Ventas', ?)`,
          [crypto.randomUUID(), BRANCH_ID, WH_CENTRAL, pid, USER_ID, qty, uCost, qty * uCost, prevO, prevO - qty, trNum, trDate]
        );

        const [stD]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [pid, WH_PISO]);
        const prevD = Number(stD[0]?.current_stock || 0);
        await conn.query(
          `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, last_movement_at)
           VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE current_stock = VALUES(current_stock), last_movement_at = VALUES(last_movement_at)`,
          [pid, WH_PISO, prevD + qty, trDate]
        );
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'TRANSFER_IN', ?, ?, ?, ?, ?, ?, 'Recepción desde Depósito Central', ?)`,
          [crypto.randomUUID(), BRANCH_ID, WH_PISO, pid, USER_ID, qty, uCost, qty * uCost, prevD, prevD + qty, trNum, trDate]
        );
      }

      // Ajuste de inventario en Noviembre (avería de 4 unidades de Mantequilla)
      if (m === 11) {
        const adjId = crypto.randomUUID();
        const adjDate = `2026-11-18 16:00:00`;
        const [stA]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [PROD_MANTE1, WH_PISO]);
        const prevA = Number(stA[0]?.current_stock || 0);
        await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevA - 4, adjDate, PROD_MANTE1, WH_PISO]);

        await conn.query(
          `INSERT INTO inventory_adjustments (id, company_id, branch_id, warehouse_id, user_id, adjustment_number, type, adjustment_date, total_cost_impact, reason, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'AJ-DEMO-1101', 'DAMAGE_SPOILED', ?, 4.80, 'Empaques dañados en piso de ventas', 'APPLIED', ?)`,
          [adjId, COMPANY_ID, BRANCH_ID, WH_PISO, USER_ID, adjDate, adjDate]
        );
        await conn.query(
          `INSERT INTO inventory_adjustment_items (id, adjustment_id, product_id, movement_type, previous_stock, quantity, new_stock, unit_cost, total_cost, notes)
           VALUES (?, ?, ?, 'ADJUST_OUT', ?, 4, ?, 1.20, 4.80, 'Envase roto')`,
          [crypto.randomUUID(), adjId, PROD_MANTE1, prevA, prevA - 4]
        );
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'ADJUST_OUT', 4, 1.20, 4.80, ?, ?, 'AJ-DEMO-1101', 'Ajuste por mercancía dañada', ?)`,
          [crypto.randomUUID(), BRANCH_ID, WH_PISO, PROD_MANTE1, USER_ID, prevA, prevA - 4, adjDate]
        );

        // Merma directa adicional de 5 kg por deshidratación en Noviembre
        const dwId = crypto.randomUUID();
        const [stDw]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [prodCanalId, WH_CENTRAL]);
        const prevDw = Number(stDw[0]?.current_stock || 0);
        await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevDw - 5, adjDate, prodCanalId, WH_CENTRAL]);
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'ADJUST_OUT', 5, 4.20, 21.00, ?, ?, 'MERMA', 'Merma Directa: Pérdida por Deshidratación', ?)`,
          [crypto.randomUUID(), BRANCH_ID, WH_CENTRAL, prodCanalId, USER_ID, prevDw, prevDw - 5, adjDate]
        );
        await conn.query(
          `INSERT INTO production_waste_logs (id, company_id, branch_id, warehouse_id, production_order_id, product_id, waste_reason_id, quantity, unit_cost, total_cost, notes, user_id, created_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, 5, 4.20, 21.00, 'Deshidratación en cámara frigorífica', ?, ?)`,
          [dwId, COMPANY_ID, BRANCH_ID, WH_CENTRAL, prodCanalId, wasteDeshidId, USER_ID, adjDate]
        );
        await AccountingAutoPostingService.postInventoryWaste(conn, {
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          userId: USER_ID,
          wasteLogId: dwId,
          productName: 'Res en Canal (Kg)',
          reasonName: 'Pérdida por Deshidratación / Refrigeración',
          totalCostUsd: 21.00,
          referenceDoc: 'MERMA',
          entryDate: '2026-11-18',
        });
      }
    });

    // E. Aumento de Precios en Octubre (+8%) y Noviembre (+6%)
    if (m >= 10 && !hasPrice) {
      await withTransaction(async (conn) => {
        const batchId = crypto.randomUUID();
        const pct = m === 10 ? 8 : 6;
        const appDate = `2026-${mm}-15 08:00:00`;
        await conn.query(
          `INSERT INTO price_change_batches (id, company_id, user_id, batch_number, mode, mode_value, rounding_rule, tax_affects_final_price, price_mode, criteria_json, affected_products_count, status, approved_by, approved_at, applied_at, reason, created_at)
           VALUES (?, ?, ?, ?, 'PERCENTAGE_INCREASE', ?, 0.05, 1, 'BASE_PRICE', '{}', 2, 'APPLIED', ?, ?, ?, ?, ?)`,
          [batchId, COMPANY_ID, USER_ID, `PR-DEMO-${mm}01`, pct, USER_ID, appDate, appDate, `Ajuste inflacionario ${label} (+${pct}%)`, appDate]
        );
        await conn.query(
          `INSERT INTO price_change_items (id, batch_id, product_id, cost_price, old_base_price, new_base_price, old_final_price, new_final_price, tax_rate)
           VALUES (?, ?, ?, 7.50, 13.50, ?, 13.50, ?, 0.00),
                  (?, ?, ?, 1.20, 1.56, ?, 1.81, ?, 16.00)`,
          [
            crypto.randomUUID(), batchId, prodLomitoId, Number((13.50 * (1 + pct / 100)).toFixed(2)), Number((13.50 * (1 + pct / 100)).toFixed(2)),
            crypto.randomUUID(), batchId, PROD_MANTE1, Number((1.56 * (1 + pct / 100)).toFixed(2)), Number((1.81 * (1 + pct / 100)).toFixed(2)),
          ]
        );
      });
    }

    // F. Ventas POS (Contado Mixto + IGTF 3%), Ventas Crédito CxC, Notas de Crédito (Devolución) y Débito
    await withTransaction(async (conn) => {
      const shiftId = crypto.randomUUID();
      const sInv1 = crypto.randomUUID();
      const sDate = `2026-${mm}-20`;
      const sTs = `${sDate} 15:30:00`;

      await conn.query(
        `INSERT INTO cash_shifts (id, branch_id, cash_register_id, user_id, opened_at, closed_at, initial_cash_ves, initial_cash_usd, final_cash_ves_expected, final_cash_usd_expected, final_cash_ves_counted, final_cash_usd_counted, status)
         VALUES (?, ?, ?, ?, ?, ?, 2000, 100, 2000, 200, 2000, 200, 'CLOSED')`,
        [shiftId, BRANCH_ID, CASH_REG_ID, USER_ID, `${sDate} 08:00:00`, `${sDate} 19:00:00`]
      );

      // Venta 1: Contado POS (25 kg Lomito exento $337.50 + 30 und Mantequilla gravada $46.80 + IVA $7.49 + IGTF $3.00 sobre $100 USD)
      const totalV1 = 394.79;
      await conn.query(
        `INSERT INTO sales_invoices (
          id, branch_id, warehouse_id, customer_id, user_id, invoice_number, control_number,
          invoice_date, invoice_mode, currency, exchange_rate, base_exempt_amount, base_taxable_amount,
          tax_amount, igtf_amount, discount_amount, total_amount, is_credit, shift_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FISCAL', 'USD', ?, 337.50, 46.80, 7.49, 3.00, 0, ?, 0, ?, 'PAID', ?)`,
        [sInv1, BRANCH_ID, WH_PISO, CUSTOMER_EDGAR, USER_ID, `FV-DEMO-${mm}01`, `00-V${mm}01`, sDate, rate, totalV1, shiftId, sTs]
      );
      await conn.query(
        `INSERT INTO sales_invoice_items (id, invoice_id, product_id, quantity, unit_price, unit_cost, tax_rate, discount_percent, tax_amount, subtotal, total)
         VALUES (?, ?, ?, 25, 13.50, 7.50, 0, 0, 0, 337.50, 337.50),
                (?, ?, ?, 30, 1.56, 1.20, 16, 0, 7.49, 46.80, 54.29)`,
        [crypto.randomUUID(), sInv1, prodLomitoId, crypto.randomUUID(), sInv1, PROD_MANTE1]
      );

      for (const [pid, qty, uCost] of [[prodLomitoId, 25, 7.50], [PROD_MANTE1, 30, 1.20]] as const) {
        const [st]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [pid, WH_PISO]);
        const prev = Number(st[0]?.current_stock || 0);
        await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prev - qty, sTs, pid, WH_PISO]);
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'SALE', ?, ?, ?, ?, ?, ?, 'Venta POS', ?)`,
          [crypto.randomUUID(), BRANCH_ID, WH_PISO, pid, USER_ID, qty, uCost, qty * uCost, prev, prev - qty, `FV-DEMO-${mm}01`, sTs]
        );
      }

      const vesPayUsd = 291.79;
      const vesPayBs = Number((vesPayUsd * rate).toFixed(2));
      await conn.query(
        `INSERT INTO sales_payments (id, invoice_id, method, amount_ves, amount_usd, exchange_rate, applies_igtf, igtf_amount_ves, igtf_amount_usd, reference_number, bank_account_id, created_at)
         VALUES (?, ?, 'CASH_USD', ?, 103.00, ?, 1, ?, 3.00, NULL, NULL, ?),
                (?, ?, 'TRANSFER_VES', ?, ?, ?, 0, 0, 0, ?, ?, ?)`,
        [
          crypto.randomUUID(), sInv1, Number((103 * rate).toFixed(2)), rate, Number((3 * rate).toFixed(2)), sTs,
          crypto.randomUUID(), sInv1, vesPayBs, vesPayUsd, rate, `COB-DEMO-${mm}01`, BANK_VES_ID, sTs,
        ]
      );

      const [bkV]: any = await conn.query(`SELECT current_balance FROM bank_accounts WHERE id = ? FOR UPDATE`, [BANK_VES_ID]);
      const nextBkV = Number((Number(bkV[0].current_balance) + vesPayBs).toFixed(2));
      await conn.query(`UPDATE bank_accounts SET current_balance = ? WHERE id = ?`, [nextBkV, BANK_VES_ID]);
      await conn.query(
        `INSERT INTO bank_movements (id, account_id, user_id, movement_type, amount, balance_after, movement_date, reference_number, concept, is_reconciled, created_at)
         VALUES (?, ?, ?, 'DEPOSIT', ?, ?, ?, ?, ?, 1, ?)`,
        [crypto.randomUUID(), BANK_VES_ID, USER_ID, vesPayBs, nextBkV, sTs, `COB-DEMO-${mm}01`, `Ingreso venta POS FV-DEMO-${mm}01`, sTs]
      );

      await AccountingAutoPostingService.postSaleInvoice(conn, sInv1, USER_ID);

      // Venta 2: Crédito CxC a Inversiones La Roca C.A. ($255.00)
      const sInv2 = crypto.randomUUID();
      await conn.query(
        `INSERT INTO sales_invoices (
          id, branch_id, warehouse_id, customer_id, user_id, invoice_number, control_number,
          invoice_date, invoice_mode, currency, exchange_rate, base_exempt_amount, base_taxable_amount,
          tax_amount, igtf_amount, discount_amount, total_amount, is_credit, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FISCAL', 'USD', ?, 255.00, 0, 0, 0, 0, 255.00, 1, 'PENDING', ?)`,
        [sInv2, BRANCH_ID, WH_CENTRAL, customerJurId, USER_ID, `FCR-DEMO-${mm}02`, `00-C${mm}02`, sDate, rate, sTs]
      );
      await conn.query(
        `INSERT INTO sales_invoice_items (id, invoice_id, product_id, quantity, unit_price, unit_cost, tax_rate, discount_percent, tax_amount, subtotal, total)
         VALUES (?, ?, ?, 25, 10.20, 5.80, 0, 0, 0, 255.00, 255.00)`,
        [crypto.randomUUID(), sInv2, prodPrimeraId]
      );
      const [stPr]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [prodPrimeraId, WH_CENTRAL]);
      const prevPr = Number(stPr[0]?.current_stock || 0);
      await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevPr - 25, sTs, prodPrimeraId, WH_CENTRAL]);
      await conn.query(
        `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
         VALUES (?, ?, ?, ?, ?, 'SALE', 25, 5.80, 145.00, ?, ?, ?, 'Venta a Crédito CxC', ?)`,
        [crypto.randomUUID(), BRANCH_ID, WH_CENTRAL, prodPrimeraId, USER_ID, prevPr, prevPr - 25, `FCR-DEMO-${mm}02`, sTs]
      );
      await conn.query(
        `INSERT INTO receivables (id, branch_id, customer_id, invoice_id, document_type, amount_total, amount_paid, due_date, status, created_at)
         VALUES (?, ?, ?, ?, 'INVOICE', 255.00, ?, ?, ?, ?)`,
        [crypto.randomUUID(), BRANCH_ID, customerJurId, sInv2, m === 9 ? 255.00 : 100.00, `2026-${mm}-28`, m === 9 ? 'PAID' : 'PARTIAL', sTs]
      );
      await AccountingAutoPostingService.postSaleInvoice(conn, sInv2, USER_ID);

      // Nota de Crédito con devolución a inventario en Octubre, y Nota de Débito en Noviembre
      if (m === 10) {
        const cnId = crypto.randomUUID();
        const cnDate = `2026-10-22 11:00:00`;
        await conn.query(
          `INSERT INTO customer_notes (id, company_id, branch_id, customer_id, user_id, warehouse_id, affected_invoice_id, type, note_number, control_number, issue_date, due_date, reason_type, reason_description, currency, exchange_rate, base_exempt_amount, base_taxable_amount, tax_amount, total_amount, amount_applied, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'CREDIT', 'NCC-DEMO-1001', '00-NCC1001', ?, '2026-10-30', 'RETURN', 'Devolución parcial de 5 kg Pulpa Negra', 'USD', ?, 51.00, 0, 0, 51.00, 0, 'ACTIVE', ?)`,
          [cnId, COMPANY_ID, BRANCH_ID, customerJurId, USER_ID, WH_CENTRAL, sInv2, cnDate, rate, cnDate]
        );
        await conn.query(
          `INSERT INTO customer_note_items (id, note_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, subtotal, return_to_inventory)
           VALUES (?, ?, ?, 'Pulpa Negra devuelta', 5, 10.20, 0, 0, 51.00, 1)`,
          [crypto.randomUUID(), cnId, prodPrimeraId]
        );
        const [stDev]: any = await conn.query(`SELECT current_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE`, [prodPrimeraId, WH_CENTRAL]);
        const prevDev = Number(stDev[0]?.current_stock || 0);
        await conn.query(`UPDATE product_stocks SET current_stock = ?, last_movement_at = ? WHERE product_id = ? AND warehouse_id = ?`, [prevDev + 5, cnDate, prodPrimeraId, WH_CENTRAL]);
        await conn.query(
          `INSERT INTO inventory_movements (id, branch_id, warehouse_id, product_id, user_id, movement_type, quantity, unit_cost, total_cost, previous_stock, new_stock, reference_document, reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'IN', 5, 5.80, 29.00, ?, ?, 'NCC-DEMO-1001', 'Devolución Nota de Crédito Cliente', ?)`,
          [crypto.randomUUID(), BRANCH_ID, WH_CENTRAL, prodPrimeraId, USER_ID, prevDev, prevDev + 5, cnDate]
        );
      }

      if (m === 11) {
        const dnId = crypto.randomUUID();
        const dnDate = `2026-11-22 11:00:00`;
        await conn.query(
          `INSERT INTO customer_notes (id, company_id, branch_id, customer_id, user_id, warehouse_id, affected_invoice_id, type, note_number, control_number, issue_date, due_date, reason_type, reason_description, currency, exchange_rate, base_exempt_amount, base_taxable_amount, tax_amount, total_amount, amount_applied, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'DEBIT', 'NDC-DEMO-1101', '00-NDC1101', ?, '2026-11-30', 'LATE_FEE', 'Intereses por mora en factura vencida', 'USD', ?, 15.00, 0, 0, 15.00, 0, 'ACTIVE', ?)`,
          [dnId, COMPANY_ID, BRANCH_ID, customerJurId, USER_ID, WH_CENTRAL, sInv2, dnDate, rate, dnDate]
        );
        await conn.query(
          `INSERT INTO customer_note_items (id, note_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, subtotal, return_to_inventory)
           VALUES (?, ?, NULL, 'Recargo administrativo por mora', 1, 15.00, 0, 0, 15.00, 0)`,
          [crypto.randomUUID(), dnId]
        );
      }
    });
  }

  console.log('Data de demostración de los últimos 3 meses generada exitosamente para Ero Test.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Error generando data demo:', err);
  await pool.end();
  process.exit(1);
});
