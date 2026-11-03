import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { isSuperAdminRole } from '@ero/shared';
import { ChatService } from './chat.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const chatRouter = new Hono<AppEnv>();

// Middleware para verificar que el usuario tenga acceso operativo al chat
const requireChatAccess = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, 401);
  }
  if (user.canUseChat === false) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CHAT_DISABLED_FOR_USER',
          message:
            'El uso del chat interno no está autorizado para su cuenta de usuario. Contacte al administrador.',
        },
      },
      403
    );
  }

  const isSuperAdmin = isSuperAdminRole(user.role);
  const isExplicitlyAllowed = user.canUseChat === true;
  const hasRolePermission = Array.isArray(user.permissions) && user.permissions.includes('chat.read');

  if (!isSuperAdmin && !isExplicitlyAllowed && !hasRolePermission) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permiso denegado: requiere autorización de chat o permiso chat.read',
        },
      },
      403
    );
  }
  await next();
};

// ==========================================
// 1. CHAT OPERATIVO DE USUARIOS (chat.read o canUseChat)
// ==========================================

// GET /api/chat/unread-total - Total de no leídos para badges
chatRouter.get('/unread-total', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  try {
    const total = await ChatService.getUnreadTotal(user.companyId, user.sub);
    return c.json({ success: true, data: { unreadTotal: total } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_UNREAD_COUNT_ERROR', message: error.message } }, 500);
  }
});

// GET /api/chat/users - Buscar usuarios del sistema para iniciar chat
chatRouter.get('/users', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  const search = c.req.query('search') || '';
  try {
    const users = await ChatService.searchUsers(user.companyId, user.sub, search);
    return c.json({ success: true, data: users });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_USERS_ERROR', message: error.message } }, 500);
  }
});

// GET /api/chat/conversations - Listar conversaciones activas del usuario
chatRouter.get('/conversations', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  try {
    const conversations = await ChatService.getConversations(user.companyId, user.sub);
    return c.json({ success: true, data: conversations });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_CONVERSATIONS_ERROR', message: error.message } }, 500);
  }
});

// POST /api/chat/conversations - Iniciar o abrir conversación con otro usuario
const createConversationSchema = z.object({
  recipientId: z.string().min(1, 'El ID de destinatario es requerido'),
});

chatRouter.post(
  '/conversations',
  authenticate,
  requireChatAccess,
  zValidator('json', createConversationSchema),
  async (c) => {
    const user = c.get('user');
    const { recipientId } = c.req.valid('json');

    try {
      const conv = await ChatService.getOrCreateConversation(user.companyId, user.sub, recipientId);
      return c.json({ success: true, data: conv });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CHAT_START_ERROR', message: error.message } }, 400);
    }
  }
);

// GET /api/chat/conversations/:id/messages - Obtener mensajes de la conversación y marcar leídos
chatRouter.get('/conversations/:id/messages', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('id')!;
  const limit = parseInt(c.req.query('limit') || '100', 10);

  try {
    const messages = await ChatService.getMessages(user.companyId, conversationId, user.sub, limit);
    return c.json({ success: true, data: messages });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_MESSAGES_ERROR', message: error.message } }, 400);
  }
});

// POST /api/chat/conversations/:id/messages - Enviar mensaje en una conversación
const sendMessageSchema = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío').max(4000, 'Mensaje demasiado largo'),
});

chatRouter.post(
  '/conversations/:id/messages',
  authenticate,
  requireChatAccess,
  zValidator('json', sendMessageSchema),
  async (c) => {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;
    const { message } = c.req.valid('json');

    try {
      const createdMessage = await ChatService.sendMessage(user.companyId, conversationId, user.sub, message);
      return c.json({ success: true, data: createdMessage });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CHAT_SEND_ERROR', message: error.message } }, 400);
    }
  }
);

// =========================================================================
// 2. AUDITORÍA Y BITÁCORA DE CHAT (chat.audit)
// =========================================================================

// GET /api/chat/audit/conversations - Listar conversaciones auditables de la empresa
chatRouter.get('/audit/conversations', authenticate, authorize('chat', 'audit'), async (c) => {
  const user = c.get('user');
  const search = c.req.query('search');
  const userId = c.req.query('userId');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  try {
    const rows = await ChatService.getAuditConversations(user.companyId, { search, userId, dateFrom, dateTo });
    return c.json({ success: true, data: rows });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_AUDIT_LIST_ERROR', message: error.message } }, 500);
  }
});

// GET /api/chat/audit/conversations/:id/messages - Transcripción completa para auditoría
chatRouter.get('/audit/conversations/:id/messages', authenticate, authorize('chat', 'audit'), async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('id')!;

  try {
    const messages = await ChatService.getAuditMessages(user.companyId, conversationId);
    return c.json({ success: true, data: messages });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_AUDIT_MESSAGES_ERROR', message: error.message } }, 400);
  }
});

