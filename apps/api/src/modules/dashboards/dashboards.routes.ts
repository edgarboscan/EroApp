import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { dashboardLayoutSaveSchema, isSuperAdminRole } from '@ero/shared';
import { DashboardsService } from './dashboards.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const dashboardsRouter = new Hono<AppEnv>();

// GET /api/dashboards/me - Carga el dashboard y widgets según los permisos del usuario
dashboardsRouter.get('/me', authenticate, authorize('dashboards', 'read'), async (c) => {
  const user = c.get('user');
  const isSuperAdmin = isSuperAdminRole(user.role);
  const result = await DashboardsService.getUserDashboard(user.sub, user.companyId, user.permissions, isSuperAdmin);
  return c.json({ success: true, data: result });
});

// PUT /api/dashboards/me/layout - Guarda la personalización de posiciones y widgets
dashboardsRouter.put('/me/layout', authenticate, authorize('dashboards', 'update'), zValidator('json', dashboardLayoutSaveSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await DashboardsService.saveUserDashboard(user.sub, user.companyId, body.name, body.items);
  return c.json({ success: true, data: result });
});

// GET /api/dashboards/widgets - Obtiene el catálogo de widgets disponibles para el usuario
dashboardsRouter.get('/widgets', authenticate, authorize('dashboards', 'read'), async (c) => {
  const user = c.get('user');
  const isSuperAdmin = isSuperAdminRole(user.role);
  const result = await DashboardsService.getWidgetCatalog(user.permissions, isSuperAdmin);
  return c.json({ success: true, data: result });
});

// GET /api/dashboards/widgets/:code/data - Carga la data en vivo para un widget
dashboardsRouter.get('/widgets/:code/data', authenticate, async (c) => {
  const code = c.req.param('code');
  const queryBranch = c.req.query('branchId');
  const branchId = queryBranch && queryBranch !== 'ALL' ? queryBranch : c.get('activeBranchId');
  const result = await DashboardsService.getWidgetData(code!, branchId || undefined);
  return c.json({ success: true, data: result });
});
