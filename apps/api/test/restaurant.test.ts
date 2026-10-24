import { describe, it, expect } from 'vitest';
import { RestaurantService } from '../src/modules/restaurant/restaurant.service';

const COMPANY_ID = 'c1111111-1111-1111-1111-111111111111';
const BRANCH_ID = 'b1111111-1111-1111-1111-111111111111';

describe('Restaurant & Kitchen Display (KDS) Module', () => {
  let createdTableId: string;
  let activeOrderId: string;
  let customer1Id: string;
  let customer2Id: string;
  let itemKitchenId: string;
  let itemBarId: string;

  it('debe listar mesas y crear una nueva mesa', async () => {
    const tableNumber = `TEST-${Date.now().toString().slice(-4)}`;
    const table = await RestaurantService.createTable(COMPANY_ID, BRANCH_ID, {
      table_number: tableNumber,
      name: `Mesa de Prueba ${tableNumber}`,
      zone: 'Salón Principal',
      capacity: 4,
    });

    expect(table).toBeDefined();
    expect(table.table_number).toBe(tableNumber);
    expect(table.status).toBe('AVAILABLE');
    createdTableId = table.id;

    const tables = await RestaurantService.getTables(COMPANY_ID, BRANCH_ID);
    expect(tables.length).toBeGreaterThan(0);
    const found = tables.find((t) => t.id === createdTableId);
    expect(found).toBeDefined();
  });

  it('debe obtener catálogo de notas preestablecidas y crear una nueva', async () => {
    const noteText = `Nota Test ${Date.now()}`;
    const newNote = await RestaurantService.createPresetNote(COMPANY_ID, {
      category: 'COCINA',
      note_text: noteText,
    });
    expect(newNote).toBeDefined();
    expect(newNote.note_text).toBe(noteText);

    const notes = await RestaurantService.getPresetNotes(COMPANY_ID, 'COCINA');
    expect(notes.some((n: any) => n.note_text === noteText)).toBe(true);
  });

  it('debe filtrar productos de restaurante por departamento o grupo', async () => {
    const products = await RestaurantService.getRestaurantProducts(COMPANY_ID);
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    const first = products[0];
    expect(first).toHaveProperty('price_usd');
    expect(first).toHaveProperty('price_ves');
    expect(first).toHaveProperty('suggested_station');
  });

  it('debe abrir una comanda con múltiples clientes y ocupar la mesa', async () => {
    const openResult = await RestaurantService.openOrder(COMPANY_ID, BRANCH_ID, {
      table_id: createdTableId,
      waiter_id: 'u1111111-1111-1111-1111-111111111111',
      waiter_name: 'Ing. Edgar Boscán',
      initial_customers: ['Carlos Mendoza', 'Valentina Ruiz'],
      notes: 'Mesa de aniversario',
    });

    expect(openResult.order_id).toBeDefined();
    expect(openResult.order_number).toMatch(/^CMD-\d{8}-\d{4}$/);
    activeOrderId = openResult.order_id;

    // Verificar orden
    const order = await RestaurantService.getOrder(activeOrderId);
    expect(order).toBeDefined();
    expect(order.status).toBe('OPEN');
    expect(order.customers.length).toBe(2);
    expect(order.customers[0].customer_name).toBe('Carlos Mendoza');
    expect(order.customers[1].customer_name).toBe('Valentina Ruiz');

    customer1Id = order.customers[0].id;
    customer2Id = order.customers[1].id;

    // Verificar que la mesa ahora está ocupada
    const table = await RestaurantService.getTableById(COMPANY_ID, createdTableId);
    expect(table.status).toBe('OCCUPIED');
    expect(table.active_order_id).toBe(activeOrderId);
  });

  it('debe agregar ítem de cocina para Cliente 1 con observaciones', async () => {
    const itemRes = await RestaurantService.addOrderItem(activeOrderId, COMPANY_ID, {
      order_customer_id: customer1Id,
      product_name: 'Hamburguesa Especial de la Casa',
      quantity: 2,
      unit_price_usd: 9.5,
      station: 'KITCHEN',
      notes: 'Sin cebolla, término medio',
      save_as_preset_note: true,
    });

    expect(itemRes.item_id).toBeDefined();
    itemKitchenId = itemRes.item_id;

    const order = await RestaurantService.getOrder(activeOrderId);
    expect(order.items.length).toBe(1);
    expect(order.items[0].product_name).toBe('Hamburguesa Especial de la Casa');
    expect(order.items[0].subtotal_usd).toBe(19.0);
    expect(order.total_usd).toBe(19.0);

    // Total del cliente 1
    const cust1 = order.customers.find((c: any) => c.id === customer1Id);
    expect(cust1.total_usd).toBe(19.0);
  });

  it('debe agregar ítem de barra para Cliente 2 (producto ad-hoc / fuera de carta)', async () => {
    const itemRes = await RestaurantService.addOrderItem(activeOrderId, COMPANY_ID, {
      order_customer_id: customer2Id,
      product_name: 'Cóctel Mojito de Fresa Especial',
      quantity: 1,
      unit_price_usd: 7.0,
      station: 'BAR',
      notes: 'Hielo aparte, poco dulce',
    });

    expect(itemRes.item_id).toBeDefined();
    itemBarId = itemRes.item_id;

    const order = await RestaurantService.getOrder(activeOrderId);
    expect(order.items.length).toBe(2);
    expect(order.total_usd).toBe(26.0); // 19.0 + 7.0

    const cust2 = order.customers.find((c: any) => c.id === customer2Id);
    expect(cust2.total_usd).toBe(7.0);
  });

  it('debe reflejar los pedidos en la cola de KDS separando Cocina y Barra', async () => {
    // Cola cocina
    const kitchenQueue = await RestaurantService.getPreparationQueue(BRANCH_ID, 'KITCHEN');
    const kitchenItem = kitchenQueue.find((k: any) => k.id === itemKitchenId);
    expect(kitchenItem).toBeDefined();
    expect(kitchenItem.station).toBe('KITCHEN');
    expect(kitchenItem.status).toBe('PENDING');

    // Cola barra
    const barQueue = await RestaurantService.getPreparationQueue(BRANCH_ID, 'BAR');
    const barItem = barQueue.find((b: any) => b.id === itemBarId);
    expect(barItem).toBeDefined();
    expect(barItem.station).toBe('BAR');

    // Actualizar estado de preparación
    await RestaurantService.updateItemPreparationStatus(itemKitchenId, 'PREPARING');
    await RestaurantService.updateItemPreparationStatus(itemKitchenId, 'READY');

    const updatedOrder = await RestaurantService.getOrder(activeOrderId);
    const updatedKitchenItem = updatedOrder.items.find((i: any) => i.id === itemKitchenId);
    expect(updatedKitchenItem.status).toBe('READY');
  });

  it('debe calcular la división de cuenta (Split bill) por cliente y por mesa', async () => {
    const breakdown = await RestaurantService.getOrderPaymentBreakdown(activeOrderId);
    expect(breakdown.total_usd).toBe(26.0);
    expect(breakdown.customer_breakdowns.length).toBe(2);

    const c1 = breakdown.customer_breakdowns.find((c: any) => c.customer_id === customer1Id);
    const c2 = breakdown.customer_breakdowns.find((c: any) => c.customer_id === customer2Id);

    expect(c1.total_usd).toBe(19.0);
    expect(c1.remaining_usd).toBe(19.0);
    expect(c2.total_usd).toBe(7.0);
    expect(c2.remaining_usd).toBe(7.0);
  });

  it('debe registrar pago individual de Cliente 1 (efectivo USD)', async () => {
    const payRes = await RestaurantService.addOrderPayment(activeOrderId, {
      order_customer_id: customer1Id,
      payment_method_name: 'Efectivo Divisas ($)',
      currency: 'USD',
      amount: 19.0,
      notes: 'Billete de $20 entregado, vuelto $1',
    });

    expect(payRes.payment_id).toBeDefined();

    const breakdown = await RestaurantService.getOrderPaymentBreakdown(activeOrderId);
    const c1 = breakdown.customer_breakdowns.find((c: any) => c.customer_id === customer1Id);
    expect(c1.paid_usd).toBe(19.0);
    expect(c1.remaining_usd).toBe(0.0);
    expect(c1.is_paid).toBe(true);
  });

  it('debe registrar pago de Cliente 2 con Crédito Comercial (CxC)', async () => {
    // Asegurar que exista un cliente en customers para probar crédito
    const { query } = await import('../src/db/index');
    let erpCust = await query<any>('SELECT id FROM customers WHERE company_id = ? LIMIT 1', [COMPANY_ID]);
    let erpCustomerId = erpCust[0]?.id;
    if (!erpCustomerId) {
      erpCustomerId = 'c1111111-2222-3333-4444-555555555555';
      await query(
        `INSERT INTO customers (id, company_id, doc_type, doc_number, name, credit_enabled, credit_limit)
         VALUES (?, ?, 'V', '12345678', 'Cliente Frecuente Prueba', 1, 1000.00)`,
        [erpCustomerId, COMPANY_ID]
      );
    }

    const erpCustomerRes = await RestaurantService.addOrderPayment(activeOrderId, {
      order_customer_id: customer2Id,
      payment_method_name: 'Crédito en Cuenta Corriente',
      currency: 'USD',
      amount: 7.0,
      is_credit: true,
      customer_id: erpCustomerId,
      due_date: '2026-11-15',
      notes: 'Autorizado por gerencia para pago a 15 días',
      order_notes: 'Cliente frecuente VIP',
    });

    expect(erpCustomerRes.payment_id).toBeDefined();
    expect(erpCustomerRes.receivable_id).toBeDefined();

    const breakdown = await RestaurantService.getOrderPaymentBreakdown(activeOrderId);
    expect(breakdown.is_fully_paid).toBe(true);
    expect(breakdown.remaining_usd).toBe(0.0);
  });

  it('debe cerrar la comanda, registrar histórico de cierre de mesa y liberar la mesa', async () => {
    const closeRes = await RestaurantService.closeTableOrder(activeOrderId, {
      closed_by_user_id: 'u1111111-1111-1111-1111-111111111111',
      closed_by_user_name: 'Mesero / Cajero Test',
      tip_usd: 2.50,
      notes: 'Mesa atendida con éxito, clientes satisfechos',
    });

    expect(closeRes.success).toBe(true);
    expect(closeRes.closure_id).toBeDefined();

    const closedOrder = await RestaurantService.getOrder(activeOrderId);
    expect(closedOrder.status).toBe('PAID');

    const table = await RestaurantService.getTableById(COMPANY_ID, createdTableId);
    expect(table.status).toBe('AVAILABLE');
    expect(table.active_order_id).toBeNull();

    // Validar histórico de cierres de mesa
    const closures = await RestaurantService.getTableClosures(COMPANY_ID, BRANCH_ID, {
      tableId: createdTableId,
    });
    expect(closures.length).toBeGreaterThan(0);
    const closure = closures.find((c) => c.order_id === activeOrderId);
    expect(closure).toBeDefined();
    expect(closure?.tip_usd).toBe(2.50);
    expect(closure?.customer_count).toBeGreaterThanOrEqual(2);
    expect(closure?.order_number).toBeDefined();

    // Validar comanda lista para importar en el módulo POS
    const unbilledOrders = await RestaurantService.getClosedUnbilledOrders(COMPANY_ID, BRANCH_ID);
    expect(unbilledOrders.some((o: any) => o.id === activeOrderId)).toBe(true);

    // Marcar como facturada por POS
    const invoiceId = 'inv-test-12345';
    const markRes = await RestaurantService.markOrderAsInvoiced(activeOrderId, invoiceId);
    expect(markRes.success).toBe(true);

    const afterInvoiced = await RestaurantService.getClosedUnbilledOrders(COMPANY_ID, BRANCH_ID);
    expect(afterInvoiced.some((o: any) => o.id === activeOrderId)).toBe(false);
  });

  it('debe filtrar departamentos y productos según la caja registradora asignada', async () => {
    const { query } = await import('../src/db/index');
    // Crear caja de prueba
    const testRegisterId = 'reg-test-' + Date.now();
    await query(
      `INSERT INTO cash_registers (id, branch_id, code, name, is_active)
       VALUES (?, ?, ?, 'Caja Bar Terraza', 1)`,
      [testRegisterId, BRANCH_ID, 'TEST-BAR']
    );

    // Obtener un departamento existente
    const depts = await query<any>('SELECT id FROM departments WHERE company_id = ? LIMIT 2', [COMPANY_ID]);
    if (depts.length >= 1) {
      const allowedDeptId = depts[0].id;
      // Asociar la caja con sólo este departamento
      await query(
        `INSERT INTO cash_register_departments (cash_register_id, department_id) VALUES (?, ?)`,
        [testRegisterId, allowedDeptId]
      );

      // Consultar estructura con filtro de caja
      const filteredStructure = await RestaurantService.getRestaurantDepartments(COMPANY_ID, testRegisterId);
      expect(filteredStructure.departments.every((d: any) => d.id === allowedDeptId)).toBe(true);

      // Consultar productos con filtro de caja
      const filteredProds = await RestaurantService.getRestaurantProducts(COMPANY_ID, undefined, undefined, testRegisterId);
      expect(filteredProds.every((p: any) => p.department_id === allowedDeptId)).toBe(true);
    }
  });

  it('debe reservar stock en product_stocks al agregar productos y liberarlo al facturar', async () => {
    const { query } = await import('../src/db/index');
    // Buscar un almacén y producto existente
    const whRows = await query<any>('SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 LIMIT 1', [BRANCH_ID]);
    const prodRows = await query<any>('SELECT id, name, base_price FROM products WHERE company_id = ? LIMIT 1', [COMPANY_ID]);

    if (whRows.length > 0 && prodRows.length > 0) {
      const warehouseId = whRows[0].id;
      const product = prodRows[0];

      // Obtener stock reservado inicial
      const initStockRows = await query<any>(
        'SELECT reserved_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ?',
        [product.id, warehouseId]
      );
      const initialReserved = Number(initStockRows[0]?.reserved_stock || 0);

      // Abrir mesa temporal
      const openRes = await RestaurantService.openOrder(COMPANY_ID, BRANCH_ID, {
        table_id: createdTableId,
        waiter_name: 'Mozo Stock Test',
        initial_customers: ['Comensal Stock'],
      });

      // Agregar ítem con producto del catálogo
      const addRes = await RestaurantService.addOrderItem(openRes.order_id, COMPANY_ID, {
        product_id: product.id,
        product_name: product.name,
        quantity: 3,
        unit_price_usd: Number(product.base_price) || 10.0,
      });

      // Validar que reserved_stock se incrementó en 3
      const afterAddRows = await query<any>(
        'SELECT reserved_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ?',
        [product.id, warehouseId]
      );
      expect(Number(afterAddRows[0]?.reserved_stock)).toBe(initialReserved + 3);

      // Modificar cantidad a 5 (+2)
      await RestaurantService.updateOrderItem(addRes.item_id, { quantity: 5 });
      const afterUpdateRows = await query<any>(
        'SELECT reserved_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ?',
        [product.id, warehouseId]
      );
      expect(Number(afterUpdateRows[0]?.reserved_stock)).toBe(initialReserved + 5);

      // Facturar comanda y verificar que el stock reservado se liberó
      await RestaurantService.markOrderAsInvoiced(openRes.order_id, 'inv-stock-test');
      const afterInvoiceRows = await query<any>(
        'SELECT reserved_stock FROM product_stocks WHERE product_id = ? AND warehouse_id = ?',
        [product.id, warehouseId]
      );
      expect(Number(afterInvoiceRows[0]?.reserved_stock)).toBe(initialReserved);
    }
  });
});

