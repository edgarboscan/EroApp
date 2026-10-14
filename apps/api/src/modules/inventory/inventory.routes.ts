import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  departmentSchema,
  groupSchema,
  subgroupSchema,
  productSchema,
  productLocationSchema,
  inventoryMovementSchema,
  createInventoryAdjustmentSchema,
  createInventoryTransferSchema,
  receiveInventoryTransferSchema,
  kardexFilterSchema,
} from '@ero/shared';
import { InventoryService } from './inventory.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const inventoryRouter = new Hono<AppEnv>();

// ==========================================
// Rutas de Jerarquía: Departamentos, Grupos, Subgrupos
// ==========================================

inventoryRouter.get('/departments', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const result = await InventoryService.getDepartments(user.companyId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/departments', authenticate, authorize('inventory', 'create'), zValidator('json', departmentSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await InventoryService.createDepartment(body);
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.get('/groups', authenticate, authorize('inventory', 'read'), async (c) => {
  const departmentId = c.req.query('departmentId');
  const result = await InventoryService.getGroups(departmentId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/groups', authenticate, authorize('inventory', 'create'), zValidator('json', groupSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await InventoryService.createGroup(body);
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.get('/subgroups', authenticate, authorize('inventory', 'read'), async (c) => {
  const groupId = c.req.query('groupId');
  const result = await InventoryService.getSubgroups(groupId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/subgroups', authenticate, authorize('inventory', 'create'), zValidator('json', subgroupSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await InventoryService.createSubgroup(body);
  return c.json({ success: true, data: result }, 201);
});

// ==========================================
// Rutas de Ubicación Física Opcional
// ==========================================

inventoryRouter.get('/products/:id/locations', authenticate, authorize('inventory', 'read'), async (c) => {
  const productId = c.req.param('id');
  const result = await InventoryService.getProductLocations(productId!);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/products/:id/locations', authenticate, authorize('inventory', 'update'), zValidator('json', productLocationSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await InventoryService.setProductLocation(body);
  return c.json({ success: true, data: result });
});

inventoryRouter.get('/locations/search', authenticate, authorize('inventory', 'read'), async (c) => {
  const warehouseId = c.req.query('warehouse_id');
  const aisle = c.req.query('aisle');
  const shelf = c.req.query('shelf');
  const compartment = c.req.query('compartment');
  const result = await InventoryService.searchLocations({ warehouseId, aisle, shelf, compartment });
  return c.json({ success: true, data: result });
});

// ==========================================
// Rutas de Catálogo de Productos y Kardex
// ==========================================

inventoryRouter.get('/products', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const departmentId = c.req.query('departmentId');
  const groupId = c.req.query('groupId');
  const subgroupId = c.req.query('subgroupId');
  const search = c.req.query('search');
  const warehouseId = c.req.query('warehouseId') || c.get('activeWarehouseId');

  const result = await InventoryService.getProducts(user.companyId, { departmentId, groupId, subgroupId, search, warehouseId });
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/products', authenticate, authorize('inventory', 'create'), zValidator('json', productSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await InventoryService.createProduct(body);
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.post('/movements', authenticate, authorize('inventory', 'adjust'), zValidator('json', inventoryMovementSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await InventoryService.recordMovement(body, user.sub);
  return c.json({ success: true, data: result }, 201);
});

// ==========================================
// Kardex Valorizado Detallado
// ==========================================
inventoryRouter.get('/kardex', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const warehouseId = c.req.query('warehouseId');
  const productId = c.req.query('productId');
  const movementType = c.req.query('movementType') as any;
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  try {
    const result = await InventoryService.getKardex(user.companyId, {
      branchId,
      warehouseId,
      productId,
      movementType,
      startDate,
      endDate,
    });
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'KARDEX_FETCH_FAILED', message: error.message } }, 500);
  }
});

// ==========================================
// Alertas de Stock Crítico y Reorden
// ==========================================
inventoryRouter.get('/stock-alerts', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const warehouseId = c.req.query('warehouseId');

  try {
    const alerts = await InventoryService.getStockAlerts(user.companyId, branchId, warehouseId);
    return c.json({ success: true, data: alerts });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'STOCK_ALERTS_FETCH_FAILED', message: error.message } }, 500);
  }
});

// ==========================================
// Ajustes de Inventario (Merma / Sobrante / Conteo)
// ==========================================
inventoryRouter.get('/adjustments', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const warehouseId = c.req.query('warehouseId');

  try {
    const list = await InventoryService.getAdjustmentsHistory(user.companyId, branchId, warehouseId);
    return c.json({ success: true, data: list });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ADJUSTMENTS_FETCH_FAILED', message: error.message } }, 500);
  }
});

inventoryRouter.post(
  '/adjustments',
  authenticate,
  authorize('inventory', 'adjust'),
  zValidator('json', createInventoryAdjustmentSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await InventoryService.createAdjustment(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'ADJUSTMENT_CREATION_FAILED', message: error.message } }, 400);
    }
  }
);

// ==========================================
// Traslados entre Depósitos y Sucursales
// ==========================================
inventoryRouter.get('/transfers', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const status = c.req.query('status');

  try {
    const list = await InventoryService.getTransfers(user.companyId, branchId, status);
    return c.json({ success: true, data: list });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'TRANSFERS_FETCH_FAILED', message: error.message } }, 500);
  }
});

inventoryRouter.post(
  '/transfers',
  authenticate,
  authorize('inventory', 'transfer'),
  zValidator('json', createInventoryTransferSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await InventoryService.createTransfer(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'TRANSFER_CREATION_FAILED', message: error.message } }, 400);
    }
  }
);

inventoryRouter.post(
  '/transfers/receive',
  authenticate,
  authorize('inventory', 'transfer'),
  zValidator('json', receiveInventoryTransferSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await InventoryService.receiveTransfer(user.companyId, user.sub, body);
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'TRANSFER_RECEIVE_FAILED', message: error.message } }, 400);
    }
  }
);

