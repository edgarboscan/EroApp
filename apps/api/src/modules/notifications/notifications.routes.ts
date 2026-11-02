import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  shareReportSchema,
  sendEmailReportSchema,
  updateNotificationPreferencesSchema,
} from '@ero/shared';
import { NotificationsService } from './notifications.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const notificationsRouter = new Hono<AppEnv>();

// ==========================================
// 1. Notificaciones del Usuario Activo
// ==========================================

// GET /api/notifications - Listar notificaciones
notificationsRouter.get('/', authenticate, async (c) => {
  const user = c.get('user');
  const onlyUnread = c.req.query('onlyUnread') === 'true';
  try {
    const list = await NotificationsService.getNotifications(user.companyId, user.sub, onlyUnread);
    const unreadCount = await NotificationsService.getUnreadCount(user.companyId, user.sub);
    return c.json({ success: true, data: list, unreadCount });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'NOTIFICATIONS_FETCH_ERROR', message: error.message } }, 500);
  }
});

// GET /api/notifications/unread-count - Contador rápido de no leídas
notificationsRouter.get('/unread-count', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const count = await NotificationsService.getUnreadCount(user.companyId, user.sub);
    return c.json({ success: true, data: { count } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'NOTIFICATIONS_COUNT_ERROR', message: error.message } }, 500);
  }
});

// PUT /api/notifications/:id/read - Marcar una notificación como leída
notificationsRouter.put('/:id/read', authenticate, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const success = await NotificationsService.markAsRead(user.companyId, user.sub, id);
    const unreadCount = await NotificationsService.getUnreadCount(user.companyId, user.sub);
    return c.json({ success, data: { unreadCount } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'NOTIFICATION_MARK_READ_ERROR', message: error.message } }, 500);
  }
});

// PUT /api/notifications/read-all - Marcar todas las notificaciones como leídas
notificationsRouter.put('/read-all', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const success = await NotificationsService.markAllAsRead(user.companyId, user.sub);
    return c.json({ success, data: { unreadCount: 0 } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'NOTIFICATIONS_READ_ALL_ERROR', message: error.message } }, 500);
  }
});

// DELETE /api/notifications/:id - Eliminar una notificación
notificationsRouter.delete('/:id', authenticate, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const success = await NotificationsService.deleteNotification(user.companyId, user.sub, id);
    const unreadCount = await NotificationsService.getUnreadCount(user.companyId, user.sub);
    return c.json({ success, data: { unreadCount } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'NOTIFICATION_DELETE_ERROR', message: error.message } }, 500);
  }
});

// ==========================================
// 2. Preferencias de Notificación
// ==========================================

// GET /api/notifications/preferences - Preferencias del usuario autenticado
notificationsRouter.get('/preferences', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const preferences = await NotificationsService.getPreferences(user.companyId, user.sub);
    return c.json({ success: true, data: preferences });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PREFERENCES_FETCH_ERROR', message: error.message } }, 500);
  }
});

// PUT /api/notifications/preferences - Actualizar preferencias del usuario autenticado
notificationsRouter.put(
  '/preferences',
  authenticate,
  zValidator('json', updateNotificationPreferencesSchema, (result, c) => {
    if (!result.success) {
      const msg = result.error.issues[0]?.message || 'Error en las preferencias enviadas';
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
    }
  }),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const updated = await NotificationsService.updatePreferences(user.companyId, user.sub, input.preferences);
      return c.json({ success: true, data: updated });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'PREFERENCES_UPDATE_ERROR', message: error.message } }, 500);
    }
  }
);

// GET /api/notifications/preferences/:userId - Ver preferencias de un usuario específico (Admin)
notificationsRouter.get('/preferences/:userId', authenticate, authorize('config', 'read'), async (c) => {
  const user = c.get('user');
  const targetUserId = c.req.param('userId')!;
  try {
    const preferences = await NotificationsService.getPreferences(user.companyId, targetUserId);
    return c.json({ success: true, data: preferences });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ADMIN_PREFERENCES_FETCH_ERROR', message: error.message } }, 500);
  }
});

// PUT /api/notifications/preferences/:userId - Actualizar preferencias de un usuario específico (Admin)
notificationsRouter.put(
  '/preferences/:userId',
  authenticate,
  authorize('config', 'update'),
  zValidator('json', updateNotificationPreferencesSchema, (result, c) => {
    if (!result.success) {
      const msg = result.error.issues[0]?.message || 'Error en las preferencias enviadas';
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
    }
  }),
  async (c) => {
    const user = c.get('user');
    const targetUserId = c.req.param('userId')!;
    const input = c.req.valid('json');
    try {
      const updated = await NotificationsService.updatePreferences(user.companyId, targetUserId, input.preferences);
      return c.json({ success: true, data: updated });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'ADMIN_PREFERENCES_UPDATE_ERROR', message: error.message } }, 500);
    }
  }
);

// ==========================================
// 3. Compartir Reporte con Otros Usuarios
// ==========================================

// POST /api/notifications/share-report - Compartir reporte con usuarios seleccionados
notificationsRouter.post(
  '/share-report',
  authenticate,
  zValidator('json', shareReportSchema, (result, c) => {
    if (!result.success) {
      const msg = result.error.issues[0]?.message || 'Datos para compartir reporte incompletos';
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
    }
  }),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const sender = {
        id: user.sub,
        name: user.username || user.email || 'Usuario',
        email: user.email || '',
      };
      const result = await NotificationsService.shareReport(user.companyId, sender, input);
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'SHARE_REPORT_ERROR', message: error.message } }, 500);
    }
  }
);

// ==========================================
// 4. Enviar Reportes por Correo Electrónico
// ==========================================

// POST /api/notifications/send-email-report - Enviar reporte por correo a cliente, proveedor o externo
notificationsRouter.post(
  '/send-email-report',
  authenticate,
  zValidator('json', sendEmailReportSchema, (result, c) => {
    if (!result.success) {
      const msg = result.error.issues[0]?.message || 'Datos de correo electrónico inválidos';
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: msg } }, 400);
    }
  }),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const sender = {
        id: user.sub,
        name: user.username || user.email || 'Usuario',
        email: user.email || '',
      };
      const result = await NotificationsService.sendEmailReport(user.companyId, sender, input);
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'SEND_EMAIL_REPORT_ERROR', message: error.message } }, 500);
    }
  }
);

// GET /api/notifications/email-logs - Historial de correos enviados
notificationsRouter.get('/email-logs', authenticate, authorize('reports', 'read'), async (c) => {
  const user = c.get('user');
  try {
    const logs = await NotificationsService.getEmailLogs(user.companyId);
    return c.json({ success: true, data: logs });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'EMAIL_LOGS_FETCH_ERROR', message: error.message } }, 500);
  }
});
