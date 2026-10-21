import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { customerSchema, blockCustomerSchema, rateCustomerSchema } from '@ero/shared';
import { CustomersService } from './customers.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const customersRouter = new Hono<AppEnv>();

// GET /api/customers - Listado de clientes con saldos pendientes y filtros
customersRouter.get('/', authenticate, authorize(['customers.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const search = c.req.query('q') || c.req.query('search');
  const filter = c.req.query('filter');
  const data = await CustomersService.getCustomers(user.companyId, search, filter);
  return c.json({ success: true, data });
});

// GET /api/customers/:id - Detalle de un cliente
customersRouter.get('/:id', authenticate, authorize(['customers.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await CustomersService.getCustomerById(id!, user.companyId);
  return c.json({ success: true, data });
});

// GET /api/customers/:id/history - Historial comercial y estadísticas del cliente
customersRouter.get('/:id/history', authenticate, authorize(['customers.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await CustomersService.getCustomerHistory(id!, user.companyId);
  return c.json({ success: true, data });
});

// POST /api/customers - Crear nuevo cliente
customersRouter.post('/', authenticate, authorize(['customers.create', 'pos.create', 'sales.create']), zValidator('json', customerSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const data = await CustomersService.createCustomer(user.companyId, body);
  return c.json({ success: true, data }, 201);
});

// PUT /api/customers/:id - Actualizar datos del cliente
customersRouter.put('/:id', authenticate, authorize('customers', 'update'), zValidator('json', customerSchema.partial()), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const data = await CustomersService.updateCustomer(id!, user.companyId, body);
  return c.json({ success: true, data });
});

// POST /api/customers/:id/block - Bloquear o desbloquear cliente
customersRouter.post('/:id/block', authenticate, authorize('customers', 'update'), zValidator('json', blockCustomerSchema), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const data = await CustomersService.blockCustomer(id!, user.companyId, body.isBlocked, body.blockReason);
  return c.json({ success: true, data });
});

// POST /api/customers/:id/rate - Calificar cliente (puntuación, categoría y notas)
customersRouter.post('/:id/rate', authenticate, authorize('customers', 'update'), zValidator('json', rateCustomerSchema), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const data = await CustomersService.rateCustomer(id!, user.companyId, body.ratingScore, body.ratingTier, body.ratingNotes);
  return c.json({ success: true, data });
});

// GET /api/customers/:id/statement - Estado de cuenta y facturas pendientes
customersRouter.get('/:id/statement', authenticate, authorize('customers', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await CustomersService.getCustomerStatement(id!, user.companyId);
  return c.json({ success: true, data });
});
