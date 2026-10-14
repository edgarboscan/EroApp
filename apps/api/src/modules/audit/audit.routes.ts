import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { auditLogFilterSchema } from '@ero/shared';
import { AuditService } from './audit.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const auditRouter = new Hono<AppEnv>();

auditRouter.get(
  '/logs',
  authenticate,
  authorize('audit', 'read'),
  zValidator('query', auditLogFilterSchema),
  async (c) => {
    const user = c.get('user');
    const filters = c.req.valid('query');
    try {
      const result = await AuditService.getLogs(user.companyId, filters);
      return c.json({ success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'AUDIT_FETCH_ERROR', message: error.message } }, 500);
    }
  }
);
