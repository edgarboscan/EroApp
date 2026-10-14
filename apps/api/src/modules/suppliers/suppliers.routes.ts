import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { supplierSchema } from '@ero/shared';
import { SuppliersService } from './suppliers.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const suppliersRouter = new Hono<AppEnv>();

// GET /api/suppliers - Listado de proveedores con saldos pendientes CxP
suppliersRouter.get('/', authenticate, authorize('suppliers', 'read'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('q');
  const data = await SuppliersService.getSuppliers(user.companyId, search);
  return c.json({ success: true, data });
});

// GET /api/suppliers/:id - Detalle de un proveedor
suppliersRouter.get('/:id', authenticate, authorize('suppliers', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await SuppliersService.getSupplierById(id!, user.companyId);
  return c.json({ success: true, data });
});

// POST /api/suppliers - Crear nuevo proveedor
suppliersRouter.post('/', authenticate, authorize('suppliers', 'create'), zValidator('json', supplierSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await SuppliersService.createSupplier(user.companyId, body);
  return c.json({ success: true, data }, 201);
});

// PUT /api/suppliers/:id - Actualizar proveedor
suppliersRouter.put('/:id', authenticate, authorize('suppliers', 'update'), zValidator('json', supplierSchema.partial()), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const data = await SuppliersService.updateSupplier(id!, user.companyId, body);
  return c.json({ success: true, data });
});

// GET /api/suppliers/:id/statement - Estado de cuenta del proveedor
suppliersRouter.get('/:id/statement', authenticate, authorize('suppliers', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await SuppliersService.getSupplierStatement(id!, user.companyId);
  return c.json({ success: true, data });
});
