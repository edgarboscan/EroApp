import { query } from '../../db/index';
import crypto from 'crypto';
import { RealtimeService } from '../realtime/realtime.service';

export interface ChatUserSummary {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_name: string;
  last_login_at: string | null;
}

export interface ConversationSummary {
  id: string;
  company_id: string;
  other_user: ChatUserSummary;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  company_id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
}

export interface AuditConversationSummary {
  id: string;
  company_id: string;
  user1: ChatUserSummary;
  user2: ChatUserSummary;
  last_message: string | null;
  last_message_at: string;
  total_messages: number;
  created_at: string;
}

export class ChatService {
  /**
   * Busca usuarios activos de la empresa para iniciar o buscar chats
   */
  static async searchUsers(companyId: string, currentUserId: string, search?: string): Promise<ChatUserSummary[]> {
    let sql = `
      SELECT u.id, u.username, u.full_name, u.email, u.last_login_at,
             COALESCE(r.name, 'Usuario') as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.company_id = ?
        AND u.id != ?
        AND u.is_active = 1
        AND (u.can_use_chat = 1 OR u.can_use_chat IS NULL)
    `;
    const params: any[] = [companyId, currentUserId];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY u.full_name ASC LIMIT 50`;
    return await query<ChatUserSummary>(sql, params);
  }

  /**
   * Obtiene todas las conversaciones del usuario activo con el detalle del interlocutor y mensajes no leídos
   */
  static async getConversations(companyId: string, currentUserId: string): Promise<ConversationSummary[]> {
    const sql = `
      SELECT c.id, c.company_id, c.user1_id, c.user2_id, c.last_message, c.last_message_at,
             u.id as other_id, u.username as other_username, u.full_name as other_full_name,
             u.email as other_email, u.last_login_at as other_last_login_at,
             COALESCE(r.name, 'Usuario') as other_role_name,
             (
               SELECT COUNT(*)
               FROM chat_messages m
               WHERE m.conversation_id = c.id
                 AND m.recipient_id = ?
                 AND m.is_read = 0
             ) as unread_count
      FROM chat_conversations c
      INNER JOIN users u ON u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE c.company_id = ?
        AND (c.user1_id = ? OR c.user2_id = ?)
      ORDER BY c.last_message_at DESC
    `;

    const rows = await query<any>(sql, [currentUserId, currentUserId, companyId, currentUserId, currentUserId]);

    return rows.map((r) => ({
      id: r.id,
      company_id: r.company_id,
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      unread_count: Number(r.unread_count || 0),
      other_user: {
        id: r.other_id,
        username: r.other_username,
        full_name: r.other_full_name,
        email: r.other_email,
        role_name: r.other_role_name,
        last_login_at: r.other_last_login_at,
      },
    }));
  }

  /**
   * Obtiene o inicializa una conversación 1-a-1 entre dos usuarios
   */
  static async getOrCreateConversation(
    companyId: string,
    currentUserId: string,
    recipientId: string
  ): Promise<ConversationSummary> {
    if (currentUserId === recipientId) {
      throw new Error('No es posible crear una conversación consigo mismo.');
    }

    // Orden determinista para garantizar unicidad independientemente de quién inicie
    const [user1_id, user2_id] = [currentUserId, recipientId].sort();

    // Buscar si ya existe
    const existing = await query<any>(
      `SELECT id FROM chat_conversations WHERE company_id = ? AND user1_id = ? AND user2_id = ? LIMIT 1`,
      [companyId, user1_id, user2_id]
    );

    let conversationId: string;

    if (existing.length > 0) {
      conversationId = existing[0].id;
    } else {
      conversationId = crypto.randomUUID();
      await query(
        `INSERT INTO chat_conversations (id, company_id, user1_id, user2_id, last_message, last_message_at)
         VALUES (?, ?, ?, ?, NULL, NOW())`,
        [conversationId, companyId, user1_id, user2_id]
      );
    }

    // Retornar la conversación formateada
    const convs = await this.getConversations(companyId, currentUserId);
    const found = convs.find((c) => c.id === conversationId);
    if (!found) {
      // Fallback si todavía no tiene mensajes y no salió por orden
      const otherUserRows = await query<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.last_login_at, COALESCE(r.name, 'Usuario') as role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = ? LIMIT 1`,
        [recipientId]
      );
      const otherUser = otherUserRows[0] || {
        id: recipientId,
        username: '',
        full_name: 'Usuario',
        email: '',
        role_name: 'Usuario',
        last_login_at: null,
      };

      return {
        id: conversationId,
        company_id: companyId,
        other_user: otherUser,
        last_message: null,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      };
    }

    return found;
  }

  /**
   * Obtiene los mensajes de una conversación y marca como leídos los recibidos por el usuario activo
   */
  static async getMessages(
    companyId: string,
    conversationId: string,
    currentUserId: string,
    limit = 100
  ): Promise<ChatMessage[]> {
    // Validar pertenencia
    const conv = await query<any>(
      `SELECT id, user1_id, user2_id FROM chat_conversations WHERE id = ? AND company_id = ? LIMIT 1`,
      [conversationId, companyId]
    );

    if (conv.length === 0) {
      throw new Error('Conversación no encontrada.');
    }

    const { user1_id, user2_id } = conv[0];
    if (user1_id !== currentUserId && user2_id !== currentUserId) {
      throw new Error('Acceso no autorizado a esta conversación.');
    }

    // Marcar como leídos los mensajes dirigidos al usuario actual
    const updateRes = await query<any>(
      `UPDATE chat_messages 
       SET is_read = 1, read_at = NOW() 
       WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0`,
      [conversationId, currentUserId]
    );

    // Si se marcaron mensajes como leídos, emitir actualización en tiempo real
    const updateHeader = updateRes as any;
    if (updateHeader && (updateHeader.affectedRows > 0 || updateHeader.changedRows > 0)) {
      try {
        const unreadTotal = await this.getUnreadTotal(companyId, currentUserId);
        RealtimeService.emitToUser(currentUserId, 'chat:unread', { unreadTotal });

        const otherUserId = user1_id === currentUserId ? user2_id : user1_id;
        RealtimeService.emitToUser(otherUserId, 'chat:read', {
          conversationId,
          readByUserId: currentUserId,
        });
      } catch {
        // Silencioso
      }
    }

    // Obtener los últimos mensajes
    const messages = await query<ChatMessage>(
      `SELECT id, conversation_id, company_id, sender_id, recipient_id, message, is_read, read_at, created_at
       FROM chat_messages
       WHERE conversation_id = ? AND company_id = ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [conversationId, companyId, limit]
    );

    return messages;
  }

  /**
   * Envía un nuevo mensaje en una conversación
   */
  static async sendMessage(
    companyId: string,
    conversationId: string,
    senderId: string,
    messageText: string
  ): Promise<ChatMessage> {
    const text = (messageText || '').trim();
    if (!text) {
      throw new Error('El mensaje no puede estar vacío.');
    }

    const conv = await query<any>(
      `SELECT id, user1_id, user2_id FROM chat_conversations WHERE id = ? AND company_id = ? LIMIT 1`,
      [conversationId, companyId]
    );

    if (conv.length === 0) {
      throw new Error('Conversación no encontrada.');
    }

    const { user1_id, user2_id } = conv[0];
    if (user1_id !== senderId && user2_id !== senderId) {
      throw new Error('No eres participante de esta conversación.');
    }

    const recipientId = user1_id === senderId ? user2_id : user1_id;
    const messageId = crypto.randomUUID();

    // Insertar mensaje
    await query(
      `INSERT INTO chat_messages (id, conversation_id, company_id, sender_id, recipient_id, message, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [messageId, conversationId, companyId, senderId, recipientId, text]
    );

    // Actualizar conversación
    await query(
      `UPDATE chat_conversations 
       SET last_message = ?, last_message_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [text.substring(0, 500), conversationId]
    );

    const createdRows = await query<ChatMessage>(
      `SELECT id, conversation_id, company_id, sender_id, recipient_id, message, is_read, read_at, created_at
       FROM chat_messages WHERE id = ? LIMIT 1`,
      [messageId]
    );

    const createdMsg = createdRows[0];

    // Emitir eventos en tiempo real al destinatario y al emisor
    try {
      const senderRows = await query<any>(
        `SELECT id, username, full_name FROM users WHERE id = ? LIMIT 1`,
        [senderId]
      );
      const sender = senderRows[0] || { id: senderId, username: 'Usuario', full_name: 'Usuario' };
      const unreadTotal = await this.getUnreadTotal(companyId, recipientId);

      // 1. Notificar al destinatario con payload completo para alertas, audio y popup
      RealtimeService.emitToUser(recipientId, 'chat:message', {
        message: createdMsg,
        conversationId,
        senderId,
        senderName: sender.full_name || sender.username,
        senderUsername: sender.username,
        text,
        unreadTotal,
      });

      // 2. Notificar al emisor para sincronizar otras pestañas o ventanas activas
      RealtimeService.emitToUser(senderId, 'chat:sent', {
        message: createdMsg,
        conversationId,
      });
    } catch (realtimeErr) {
      console.error('[ChatService] Error al emitir evento de tiempo real:', realtimeErr);
    }

    return createdMsg;
  }

  /**
   * Total de mensajes no leídos para el usuario
   */
  static async getUnreadTotal(companyId: string, currentUserId: string): Promise<number> {
    const rows = await query<any>(
      `SELECT COUNT(*) as total FROM chat_messages WHERE company_id = ? AND recipient_id = ? AND is_read = 0`,
      [companyId, currentUserId]
    );
    return Number(rows[0]?.total || 0);
  }

  // =========================================================================
  // MÓDULO DE AUDITORÍA & BITÁCORA (Acceso restringido con permiso chat.audit)
  // =========================================================================

  /**
   * Obtiene todas las conversaciones de la empresa para supervisión / bitácora
   */
  static async getAuditConversations(
    companyId: string,
    filters: { search?: string; userId?: string; dateFrom?: string; dateTo?: string }
  ): Promise<AuditConversationSummary[]> {
    let sql = `
      SELECT c.id, c.company_id, c.user1_id, c.user2_id, c.last_message, c.last_message_at, c.created_at,
             u1.username as u1_username, u1.full_name as u1_full_name, u1.email as u1_email, u1.last_login_at as u1_last_login,
             COALESCE(r1.name, 'Usuario') as u1_role,
             u2.username as u2_username, u2.full_name as u2_full_name, u2.email as u2_email, u2.last_login_at as u2_last_login,
             COALESCE(r2.name, 'Usuario') as u2_role,
             (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) as total_messages
      FROM chat_conversations c
      INNER JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN roles r1 ON u1.role_id = r1.id
      INNER JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN roles r2 ON u2.role_id = r2.id
      WHERE c.company_id = ?
    `;
    const params: any[] = [companyId];

    if (filters.userId) {
      sql += ` AND (c.user1_id = ? OR c.user2_id = ?)`;
      params.push(filters.userId, filters.userId);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      sql += ` AND (u1.full_name LIKE ? OR u2.full_name LIKE ? OR c.last_message LIKE ?)`;
      params.push(term, term, term);
    }

    if (filters.dateFrom) {
      sql += ` AND c.last_message_at >= ?`;
      params.push(`${filters.dateFrom} 00:00:00`);
    }

    if (filters.dateTo) {
      sql += ` AND c.last_message_at <= ?`;
      params.push(`${filters.dateTo} 23:59:59`);
    }

    sql += ` ORDER BY c.last_message_at DESC LIMIT 100`;

    const rows = await query<any>(sql, params);

    return rows.map((r) => ({
      id: r.id,
      company_id: r.company_id,
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      total_messages: Number(r.total_messages || 0),
      created_at: r.created_at,
      user1: {
        id: r.user1_id,
        username: r.u1_username,
        full_name: r.u1_full_name,
        email: r.u1_email,
        role_name: r.u1_role,
        last_login_at: r.u1_last_login,
      },
      user2: {
        id: r.user2_id,
        username: r.u2_username,
        full_name: r.u2_full_name,
        email: r.u2_email,
        role_name: r.u2_role,
        last_login_at: r.u2_last_login,
      },
    }));
  }

  /**
   * Obtiene la transcripción completa de mensajes para auditoría
   */
  static async getAuditMessages(companyId: string, conversationId: string): Promise<any[]> {
    const sql = `
      SELECT m.id, m.conversation_id, m.company_id, m.sender_id, m.recipient_id,
             m.message, m.is_read, m.read_at, m.created_at,
             s.full_name as sender_name, s.username as sender_username, COALESCE(sr.name, 'Usuario') as sender_role,
             r.full_name as recipient_name, r.username as recipient_username, COALESCE(rr.name, 'Usuario') as recipient_role
      FROM chat_messages m
      INNER JOIN users s ON m.sender_id = s.id
      LEFT JOIN roles sr ON s.role_id = sr.id
      INNER JOIN users r ON m.recipient_id = r.id
      LEFT JOIN roles rr ON r.role_id = rr.id
      WHERE m.conversation_id = ? AND m.company_id = ?
      ORDER BY m.created_at ASC
    `;

    return await query<any>(sql, [conversationId, companyId]);
  }
}

