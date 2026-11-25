import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  wasteReasonSchema,
  updateWasteReasonSchema,
  productWasteConfigSchema,
  createProductionOrderSchema,
  registerDirectWasteSchema,
} from '@ero/shared';
import { ProductionService } from './production.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const productionRouter = new Hono<AppEnv>();

// ==========================================
// ALMACENES, PRODUCTOS Y CONFIGURACIÓN DE MERMA
// ==========================================

productionRouter.get('/warehouses', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const data = await ProductionService.getWarehouses(user.companyId);
  return c.json({ success: true, data });
});

productionRouter.get('/products', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const warehouseId = c.req.query('warehouseId');
  const data = await ProductionService.getProductsForProduction(user.companyId, warehouseId);
  return c.json({ success: true, data });
});

productionRouter.put(
  '/products/:productId/waste-config',
  authenticate,
  authorize('inventory', 'update'),
  zValidator('json', productWasteConfigSchema),
  async (c) => {
    const user = c.get('user');
    const productId = c.req.param('productId');
    const body = c.req.valid('json');
    try {
      const data = await ProductionService.updateProductWasteConfig(user.companyId, productId, body);
      return c.json({ success: true, data });
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// ==========================================
// MOTIVOS DE MERMA
// ==========================================

productionRouter.get('/waste-reasons', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const data = await ProductionService.getWasteReasons(user.companyId);
  return c.json({ success: true, data });
});

productionRouter.post(
  '/waste-reasons',
  authenticate,
  authorize('inventory', 'adjust'),
  zValidator('json', wasteReasonSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    try {
      const data = await ProductionService.createWasteReason(user.companyId, body);
      return c.json({ success: true, data }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

productionRouter.put(
  '/waste-reasons/:id',
  authenticate,
  authorize('inventory', 'adjust'),
  zValidator('json', updateWasteReasonSchema),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const body = c.req.valid('json');
    try {
      const data = await ProductionService.updateWasteReason(user.companyId, id, body);
      return c.json({ success: true, data });
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// ==========================================
// ÓRDENES DE PRODUCCIÓN / DESPOSTE
// ==========================================

productionRouter.get('/orders', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const status = c.req.query('status');
  const processType = c.req.query('processType');
  const warehouseId = c.req.query('warehouseId');
  const search = c.req.query('search');
  const data = await ProductionService.listProductionOrders(user.companyId, {
    status,
    processType,
    warehouseId,
    search,
  });
  return c.json({ success: true, data });
});

productionRouter.post(
  '/orders',
  authenticate,
  authorize('inventory', 'adjust'),
  zValidator('json', createProductionOrderSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    try {
      const data = await ProductionService.createProductionOrder(user.companyId, user.sub, body);
      return c.json({ success: true, data }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

productionRouter.post(
  '/orders/:id/process',
  authenticate,
  authorize('inventory', 'adjust'),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id')!;
    try {
      const data = await ProductionService.processProductionOrder(user.companyId, user.sub, id);
      return c.json({ success: true, data });
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

productionRouter.post(
  '/orders/:id/cancel',
  authenticate,
  authorize('inventory', 'adjust'),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id')!;
    try {
      const data = await ProductionService.cancelProductionOrder(user.companyId, id);
      return c.json({ success: true, data });
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);

// ==========================================
// BITÁCORA Y REGISTRO DIRECTO DE MERMAS
// ==========================================

productionRouter.get('/waste-logs', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const warehouseId = c.req.query('warehouseId');
  const wasteReasonId = c.req.query('wasteReasonId');
  const productId = c.req.query('productId');
  const data = await ProductionService.listWasteLogs(user.companyId, {
    warehouseId,
    wasteReasonId,
    productId,
  });
  return c.json({ success: true, data });
});

productionRouter.post(
  '/waste-logs',
  authenticate,
  authorize('inventory', 'adjust'),
  zValidator('json', registerDirectWasteSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    try {
      const data = await ProductionService.registerDirectWaste(user.companyId, user.sub, body);
      return c.json({ success: true, data }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { message: error.message } }, 400);
    }
  }
);
