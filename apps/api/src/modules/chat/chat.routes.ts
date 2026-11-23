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

// GET /api/chat/my-status - Estado manual y presencia del usuario actual
chatRouter.get('/my-status', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  try {
    const statusData = await ChatService.getUserStatus(user.companyId, user.sub);
    return c.json({ success: true, data: statusData });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_STATUS_ERROR', message: error.message } }, 500);
  }
});

const updateStatusSchema = z.object({
  status: z.enum(['ONLINE', 'AWAY', 'BUSY', 'OFFLINE']),
  message: z.string().max(150).nullable().optional(),
});

// PUT /api/chat/my-status - Actualizar estado manual del usuario
chatRouter.put(
  '/my-status',
  authenticate,
  requireChatAccess,
  zValidator('json', updateStatusSchema),
  async (c) => {
    const user = c.get('user');
    const { status, message } = c.req.valid('json');
    try {
      const updated = await ChatService.setUserStatus(user.companyId, user.sub, status, message);
      return c.json({ success: true, data: updated });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CHAT_UPDATE_STATUS_ERROR', message: error.message } }, 500);
    }
  }
);

// POST /api/chat/status - Alias para actualizar estado
chatRouter.post(
  '/status',
  authenticate,
  requireChatAccess,
  zValidator('json', updateStatusSchema),
  async (c) => {
    const user = c.get('user');
    const { status, message } = c.req.valid('json');
    try {
      const updated = await ChatService.setUserStatus(user.companyId, user.sub, status, message);
      return c.json({ success: true, data: updated });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CHAT_UPDATE_STATUS_ERROR', message: error.message } }, 500);
    }
  }
);

// GET /api/chat/presence - Presencia consolidada de usuarios de la empresa
chatRouter.get('/presence', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  try {
    const presenceMap = await ChatService.getCompanyPresence(user.companyId);
    return c.json({ success: true, data: presenceMap });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_PRESENCE_ERROR', message: error.message } }, 500);
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

// POST /api/chat/groups - Crear una conversación grupal con múltiples participantes
const createGroupSchema = z.object({
  title: z.string().min(2, 'El título del grupo debe tener al menos 2 caracteres').max(150),
  participantIds: z.array(z.string()).min(1, 'Debe incluir al menos un participante adicional'),
});

chatRouter.post(
  '/groups',
  authenticate,
  requireChatAccess,
  zValidator('json', createGroupSchema),
  async (c) => {
    const user = c.get('user');
    const { title, participantIds } = c.req.valid('json');

    try {
      const conv = await ChatService.createGroupConversation(user.companyId, user.sub, title, participantIds);
      return c.json({ success: true, data: conv });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CHAT_CREATE_GROUP_ERROR', message: error.message } }, 400);
    }
  }
);

// DELETE /api/chat/conversations/:id - Ocultar o eliminar chat de la lista personal del usuario
chatRouter.delete('/conversations/:id', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('id')!;

  try {
    await ChatService.hideConversation(user.companyId, conversationId, user.sub);
    return c.json({ success: true, message: 'Conversación eliminada de su lista personal.' });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_HIDE_ERROR', message: error.message } }, 400);
  }
});

// GET /api/chat/conversations/:id/participants - Listar participantes de un grupo
chatRouter.get('/conversations/:id/participants', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('id')!;

  try {
    const participants = await ChatService.getGroupParticipants(user.companyId, conversationId);
    return c.json({ success: true, data: participants });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_PARTICIPANTS_ERROR', message: error.message } }, 400);
  }
});

// POST /api/chat/conversations/:id/participants - Agregar participantes a un grupo
const addParticipantsSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Debe indicar al menos un usuario para agregar'),
});

chatRouter.post(
  '/conversations/:id/participants',
  authenticate,
  requireChatAccess,
  zValidator('json', addParticipantsSchema),
  async (c) => {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;
    const { userIds } = c.req.valid('json');

    try {
      await ChatService.addParticipantsToGroup(user.companyId, conversationId, user.sub, userIds);
      return c.json({ success: true, message: 'Participantes agregados correctamente al grupo.' });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CHAT_ADD_PARTICIPANTS_ERROR', message: error.message } }, 400);
    }
  }
);

// DELETE /api/chat/conversations/:id/participants/:userId - Expulsar o abandonar grupo
chatRouter.delete('/conversations/:id/participants/:userId', authenticate, requireChatAccess, async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('id')!;
  const targetUserId = c.req.param('userId')!;

  try {
    await ChatService.removeParticipantFromGroup(user.companyId, conversationId, user.sub, targetUserId);
    return c.json({ success: true, message: 'Participante removido del grupo.' });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'CHAT_REMOVE_PARTICIPANT_ERROR', message: error.message } }, 400);
  }
});

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

// DELETE /api/chat/audit/range - Eliminar historial de bitácora por rango de fecha (Superadmin / Auditor)
const deleteAuditRangeSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
});

chatRouter.delete(
  '/audit/range',
  authenticate,
  authorize('chat', 'audit'),
  zValidator('json', deleteAuditRangeSchema),
  async (c) => {
    const user = c.get('user');
    const { dateFrom, dateTo } = c.req.valid('json');

    try {
      const result = await ChatService.deleteAuditMessagesByDateRange(user.companyId, dateFrom, dateTo);
      return c.json({
        success: true,
        data: result,
        message: `Se eliminaron ${result.deletedMessages} mensajes en ${result.affectedConversations} conversaciones.`,
      });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'CHAT_AUDIT_DELETE_ERROR', message: error.message } }, 400);
    }
  }
);

