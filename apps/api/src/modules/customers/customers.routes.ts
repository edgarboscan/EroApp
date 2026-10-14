import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { customerSchema } from '@ero/shared';
import { CustomersService } from './customers.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const customersRouter = new Hono<AppEnv>();

// GET /api/customers - Listado de clientes con saldos pendientes
customersRouter.get('/', authenticate, authorize('customers', 'read'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('q');
  const data = await CustomersService.getCustomers(user.companyId, search);
  return c.json({ success: true, data });
});

// GET /api/customers/:id - Detalle de un cliente
customersRouter.get('/:id', authenticate, authorize('customers', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await CustomersService.getCustomerById(id!, user.companyId);
  return c.json({ success: true, data });
});

// POST /api/customers - Crear nuevo cliente
customersRouter.post('/', authenticate, authorize('customers', 'create'), zValidator('json', customerSchema), async (c) => {
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

// GET /api/customers/:id/statement - Estado de cuenta y facturas pendientes
customersRouter.get('/:id/statement', authenticate, authorize('customers', 'read'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const data = await CustomersService.getCustomerStatement(id!, user.companyId);
  return c.json({ success: true, data });
});
