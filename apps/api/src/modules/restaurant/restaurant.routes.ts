import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateRestaurantTableSchema,
  UpdateRestaurantTableSchema,
  CreatePresetNoteSchema,
  CreateOrderCustomerSchema,
  AddOrderItemSchema,
  UpdateItemStatusSchema,
  AddOrderPaymentSchema,
  OpenOrderSchema,
  CloseTableOrderSchema,
} from '@ero/shared';
import { RestaurantService } from './restaurant.service';
import { authenticate, AppEnv } from '../../middleware/auth';

export const restaurantRouter = new Hono<AppEnv>();

// ==========================================
// MESAS
// ==========================================

// GET /api/restaurant/tables - Listar mesas
restaurantRouter.get('/tables', authenticate, async (c) => {
  const user = c.get('user');
  const branchId = c.req.header('x-branch-id') || user.branchId || 'b1111111-1111-1111-1111-111111111111';
  const zone = c.req.query('zone');
  const waiterId = c.req.query('waiter_id');

  try {
    const tables = await RestaurantService.getTables(user.companyId, branchId, zone, waiterId);
    return c.json({ success: true, data: tables });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// POST /api/restaurant/tables - Crear mesa
restaurantRouter.post(
  '/tables',
  authenticate,
  zValidator('json', CreateRestaurantTableSchema),
  async (c) => {
    const user = c.get('user');
    const branchId = c.req.header('x-branch-id') || user.branchId || 'b1111111-1111-1111-1111-111111111111';
    const body = c.req.valid('json');

    try {
      const table = await RestaurantService.createTable(user.companyId, branchId, body);
      return c.json({ success: true, data: table }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 500);
    }
  }
);

// PUT /api/restaurant/tables/:id - Modificar mesa
restaurantRouter.put(
  '/tables/:id',
  authenticate,
  zValidator('json', UpdateRestaurantTableSchema),
  async (c) => {
    const user = c.get('user');
    const tableId = c.req.param('id');
    const body = c.req.valid('json');

    try {
      const table = await RestaurantService.updateTable(user.companyId, tableId, body);
      return c.json({ success: true, data: table });
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 500);
    }
  }
);

// DELETE /api/restaurant/tables/:id - Eliminar mesa
restaurantRouter.delete('/tables/:id', authenticate, async (c) => {
  const user = c.get('user');
  const tableId = c.req.param('id') as string;

  try {
    const result = await RestaurantService.deleteTable(user.companyId, tableId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// ==========================================
// CATÁLOGO DE PRODUCTOS Y FILTROS
// ==========================================

// GET /api/restaurant/products - Listar productos por departamento / grupo
restaurantRouter.get('/products', authenticate, async (c) => {
  const user = c.get('user');
  const departmentId = c.req.query('department_id');
  const groupId = c.req.query('group_id');
  const cashRegisterId = c.req.query('cash_register_id');

  try {
    const products = await RestaurantService.getRestaurantProducts(
      user.companyId,
      departmentId,
      groupId,
      cashRegisterId
    );
    return c.json({ success: true, data: products });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/restaurant/departments - Departamentos y grupos para filtrado
restaurantRouter.get('/departments', authenticate, async (c) => {
  const user = c.get('user');
  const cashRegisterId = c.req.query('cash_register_id');

  try {
    const structure = await RestaurantService.getRestaurantDepartments(user.companyId, cashRegisterId);
    return c.json({ success: true, data: structure });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// ==========================================
// OBSERVACIONES PREESTABLECIDAS (PRESET NOTES)
// ==========================================

// GET /api/restaurant/preset-notes - Listar observaciones preestablecidas
restaurantRouter.get('/preset-notes', authenticate, async (c) => {
  const user = c.get('user');
  const category = c.req.query('category');

  try {
    const notes = await RestaurantService.getPresetNotes(user.companyId, category);
    return c.json({ success: true, data: notes });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// POST /api/restaurant/preset-notes - Crear nueva observación
restaurantRouter.post(
  '/preset-notes',
  authenticate,
  zValidator('json', CreatePresetNoteSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const note = await RestaurantService.createPresetNote(user.companyId, body);
      return c.json({ success: true, data: note }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 500);
    }
  }
);

// ==========================================
// COMANDAS DE MESA
// ==========================================

// POST /api/restaurant/orders/open - Abrir comanda en mesa
restaurantRouter.post(
  '/orders/open',
  authenticate,
  zValidator('json', OpenOrderSchema),
  async (c) => {
    const user = c.get('user');
    const branchId = c.req.header('x-branch-id') || user.branchId || 'b1111111-1111-1111-1111-111111111111';
    const body = c.req.valid('json');

    try {
      const result = await RestaurantService.openOrder(user.companyId, branchId, {
        ...body,
        waiter_id: body.waiter_id || user.sub,
        waiter_name: body.waiter_name || user.username,
      });
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// GET /api/restaurant/orders/:id - Detalle completo de comanda
restaurantRouter.get('/orders/:id', authenticate, async (c) => {
  const orderId = c.req.param('id') as string;

  try {
    const order = await RestaurantService.getOrder(orderId);
    if (!order) {
      return c.json({ success: false, error: { message: 'Comanda no encontrada' } }, 404);
    }
    return c.json({ success: true, data: order });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/restaurant/orders/table/:tableId - Comanda activa por mesa
restaurantRouter.get('/orders/table/:tableId', authenticate, async (c) => {
  const tableId = c.req.param('tableId') as string;

  try {
    const order = await RestaurantService.getOrderByTableId(tableId);
    return c.json({ success: true, data: order });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// POST /api/restaurant/orders/:id/customers - Agregar cliente a comanda
restaurantRouter.post(
  '/orders/:id/customers',
  authenticate,
  zValidator('json', CreateOrderCustomerSchema),
  async (c) => {
    const orderId = c.req.param('id');
    const body = c.req.valid('json');

    try {
      const order = await RestaurantService.addCustomerToOrder(orderId, body);
      return c.json({ success: true, data: order });
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// POST /api/restaurant/orders/:id/items - Agregar ítem / producto a la comanda
restaurantRouter.post(
  '/orders/:id/items',
  authenticate,
  zValidator('json', AddOrderItemSchema),
  async (c) => {
    const user = c.get('user');
    const orderId = c.req.param('id') as string;
    const body = c.req.valid('json');

    try {
      const result = await RestaurantService.addOrderItem(orderId, user.companyId, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// PUT /api/restaurant/items/:id - Actualizar ítem de comanda
restaurantRouter.put('/items/:id', authenticate, async (c) => {
  const itemId = c.req.param('id') as string;
  const body = await c.req.json();

  try {
    const result = await RestaurantService.updateOrderItem(itemId, body);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// DELETE /api/restaurant/items/:id - Eliminar ítem de comanda
restaurantRouter.delete('/items/:id', authenticate, async (c) => {
  const itemId = c.req.param('id') as string;

  try {
    const result = await RestaurantService.removeOrderItem(itemId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// ==========================================
// KDS - PANTALLA DE COCINA Y BARRA
// ==========================================

// GET /api/restaurant/kds/queue - Cola de preparación remota
restaurantRouter.get('/kds/queue', authenticate, async (c) => {
  const user = c.get('user');
  const branchId = c.req.header('x-branch-id') || user.branchId || 'b1111111-1111-1111-1111-111111111111';
  const station = c.req.query('station') as any;
  const waiterId = c.req.query('waiter_id');
  const tableId = c.req.query('table_id');

  try {
    const queue = await RestaurantService.getPreparationQueue(
      branchId,
      station,
      waiterId,
      tableId
    );
    return c.json({ success: true, data: queue });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// PUT /api/restaurant/kds/items/:id/status - Cambiar estado en cocina/barra
restaurantRouter.put(
  '/kds/items/:id/status',
  authenticate,
  zValidator('json', UpdateItemStatusSchema),
  async (c) => {
    const itemId = c.req.param('id') as string;
    const { status } = c.req.valid('json');

    try {
      const result = await RestaurantService.updateItemPreparationStatus(itemId, status);
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// ==========================================
// PAGOS, SPLIT BILL Y CIERRE DE MESA
// ==========================================

// GET /api/restaurant/orders/:id/breakdown - Desglose de pagos y división de cuenta
restaurantRouter.get('/orders/:id/breakdown', authenticate, async (c) => {
  const orderId = c.req.param('id') as string;

  try {
    const breakdown = await RestaurantService.getOrderPaymentBreakdown(orderId);
    return c.json({ success: true, data: breakdown });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

// POST /api/restaurant/orders/:id/payments - Registrar pago (por persona o mesa)
restaurantRouter.post(
  '/orders/:id/payments',
  authenticate,
  zValidator('json', AddOrderPaymentSchema),
  async (c) => {
    const orderId = c.req.param('id') as string;
    const body = c.req.valid('json');

    try {
      const result = await RestaurantService.addOrderPayment(orderId, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// POST /api/restaurant/orders/:id/close - Cerrar mesa y comanda
restaurantRouter.post(
  '/orders/:id/close',
  authenticate,
  zValidator('json', CloseTableOrderSchema),
  async (c) => {
    const user = c.get('user');
    const orderId = c.req.param('id') as string;
    const body = c.req.valid('json');

    try {
      const result = await RestaurantService.closeTableOrder(orderId, {
        ...body,
        closed_by_user_id: body.closed_by_user_id || user.sub,
        closed_by_user_name: body.closed_by_user_name || (user as any).fullName || user.username,
      });
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// ==========================================
// HISTORIAL DE CIERRES DE MESA
// ==========================================

// GET /api/restaurant/closures - Listar históricos de cierre
restaurantRouter.get('/closures', authenticate, async (c) => {
  const user = c.get('user');
  const branchId = c.req.header('x-branch-id') || user.branchId || 'b1111111-1111-1111-1111-111111111111';
  const tableId = c.req.query('table_id');
  const waiterId = c.req.query('waiter_id');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 50;

  try {
    const closures = await RestaurantService.getTableClosures(user.companyId, branchId, {
      tableId,
      waiterId,
      startDate,
      endDate,
      limit,
    });
    return c.json({ success: true, data: closures });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// GET /api/restaurant/closures/:id - Detalle de un cierre
restaurantRouter.get('/closures/:id', authenticate, async (c) => {
  const closureId = c.req.param('id') as string;

  try {
    const closure = await RestaurantService.getTableClosureById(closureId);
    if (!closure) {
      return c.json({ success: false, error: { message: 'Registro de cierre no encontrado' } }, 404);
    }
    return c.json({ success: true, data: closure });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// ==========================================
// INTEGRACIÓN CON MÓDULO POS (FACTURACIÓN)
// ==========================================

// GET /api/restaurant/orders-unbilled - Comandas cerradas listas para importar al POS
restaurantRouter.get('/orders-unbilled', authenticate, async (c) => {
  const user = c.get('user');
  const branchId = c.req.header('x-branch-id') || user.branchId || 'b1111111-1111-1111-1111-111111111111';

  try {
    const orders = await RestaurantService.getClosedUnbilledOrders(user.companyId, branchId);
    return c.json({ success: true, data: orders });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

// POST /api/restaurant/orders/:id/mark-invoiced - Marcar comanda como facturada por POS
restaurantRouter.post('/orders/:id/mark-invoiced', authenticate, async (c) => {
  const orderId = c.req.param('id') as string;
  const body = await c.req.json().catch(() => ({}));

  try {
    const result = await RestaurantService.markOrderAsInvoiced(orderId, body.invoice_id);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

