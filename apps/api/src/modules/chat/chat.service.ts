import { query } from '../../db/index';
import crypto from 'crypto';
import { RealtimeService } from '../realtime/realtime.service';

export type ChatUserStatusType = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';

export interface ChatUserSummary {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_name: string;
  last_login_at: string | null;
  status?: ChatUserStatusType;
  status_message?: string | null;
  is_online?: boolean;
  effective_status?: ChatUserStatusType;
}

export interface GroupParticipantSummary {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_name: string;
  is_admin: boolean;
  is_online?: boolean;
  status?: ChatUserStatusType;
  effective_status?: ChatUserStatusType;
}

export interface ConversationSummary {
  id: string;
  company_id: string;
  type: 'DIRECT' | 'GROUP';
  title?: string | null;
  created_by?: string | null;
  other_user: ChatUserSummary | null;
  participants?: GroupParticipantSummary[];
  participant_count?: number;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  company_id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
  sender_name?: string;
  sender_username?: string;
  sender_role?: string;
}

export interface AuditConversationSummary {
  id: string;
  company_id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  created_by?: string | null;
  user1: ChatUserSummary | null;
  user2: ChatUserSummary | null;
  participant_names?: string | null;
  last_message: string | null;
  last_message_at: string;
  total_messages: number;
  created_at: string;
}

export class ChatService {
  /**
   * Determina el estado efectivo considerando la configuración manual y la presencia activa
   */
  static computeEffectiveStatus(manualStatus: ChatUserStatusType, isOnline: boolean): ChatUserStatusType {
    if (manualStatus === 'OFFLINE') return 'OFFLINE';
    if (manualStatus === 'AWAY') return 'AWAY';
    if (manualStatus === 'BUSY') return 'BUSY';
    return isOnline ? 'ONLINE' : 'OFFLINE';
  }

  /**
   * Busca usuarios activos de la empresa para iniciar o buscar chats con su estado de presencia en tiempo real
   */
  static async searchUsers(companyId: string, currentUserId: string, search?: string): Promise<ChatUserSummary[]> {
    let sql = `
      SELECT u.id, u.username, u.full_name, u.email, u.last_login_at,
             COALESCE(r.name, 'Usuario') as role_name,
             COALESCE(ucs.status, 'ONLINE') as status,
             ucs.status_message 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN user_chat_statuses ucs ON ucs.user_id = u.id
      WHERE u.company_id = ?
        AND u.id != ?
        AND u.is_active = 1
        AND u.can_use_chat = 1
    `;
    const params: any[] = [companyId, currentUserId];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY u.full_name ASC LIMIT 50`;
    const rows = await query<any>(sql, params);

    return rows.map((u) => {
      const isOnline = RealtimeService.isUserOnline(u.id);
      const manualStatus = (u.status || 'ONLINE') as ChatUserStatusType;
      const effective_status = this.computeEffectiveStatus(manualStatus, isOnline);

      return {
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        email: u.email,
        role_name: u.role_name,
        last_login_at: u.last_login_at,
        status: manualStatus,
        status_message: u.status_message || null,
        is_online: isOnline,
        effective_status,
      };
    });
  }

  /**
   * Obtiene todas las conversaciones del usuario activo (DIRECT y GROUP), respetando ocultamientos y estado de presencia
   */
  static async getConversations(companyId: string, currentUserId: string): Promise<ConversationSummary[]> {
    const sql = `
      SELECT c.id, c.company_id, c.type, c.title, c.created_by, c.user1_id, c.user2_id,
             c.last_message, c.last_message_at,
             cp.hidden_at,
             (
               SELECT COUNT(*)
               FROM chat_messages m
               WHERE m.conversation_id = c.id
                 AND (m.recipient_id = ? OR (c.type = 'GROUP' AND m.sender_id != ?))
                 AND m.is_read = 0
             ) as unread_count,
             (
               SELECT COUNT(*)
               FROM chat_conversation_participants all_cp
               WHERE all_cp.conversation_id = c.id
             ) as participant_count
      FROM chat_conversations c
      INNER JOIN chat_conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
      WHERE c.company_id = ?
        AND (cp.hidden_at IS NULL OR c.last_message_at > cp.hidden_at)
      ORDER BY c.last_message_at DESC
    `;

    const convRows = await query<any>(sql, [currentUserId, currentUserId, currentUserId, companyId]);
    if (convRows.length === 0) return [];

    const convIds = convRows.map((c) => c.id);

    // Obtener participantes de estas conversaciones
    const participantsSql = `
      SELECT cp.conversation_id, cp.is_admin, cp.joined_at,
             u.id, u.username, u.full_name, u.email, u.last_login_at, u.is_active, u.can_use_chat,
             COALESCE(r.name, 'Usuario') as role_name,
             COALESCE(ucs.status, 'ONLINE') as status,
             ucs.status_message
      FROM chat_conversation_participants cp
      INNER JOIN users u ON cp.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN user_chat_statuses ucs ON ucs.user_id = u.id
      WHERE cp.conversation_id IN (?)
      ORDER BY cp.joined_at ASC
    `;

    const partRows = await query<any>(participantsSql, [convIds]);

    const participantsByConv = new Map<string, any[]>();
    for (const p of partRows) {
      if (!participantsByConv.has(p.conversation_id)) {
        participantsByConv.set(p.conversation_id, []);
      }
      const isOnline = RealtimeService.isUserOnline(p.id);
      const manualStatus = (p.status || 'ONLINE') as ChatUserStatusType;
      const effective_status = this.computeEffectiveStatus(manualStatus, isOnline);

      participantsByConv.get(p.conversation_id)!.push({
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        email: p.email,
        role_name: p.role_name,
        last_login_at: p.last_login_at,
        is_admin: Boolean(p.is_admin),
        is_active: p.is_active,
        can_use_chat: p.can_use_chat,
        is_online: isOnline,
        status: manualStatus,
        status_message: p.status_message || null,
        effective_status,
      });
    }

    const result: ConversationSummary[] = [];

    for (const c of convRows) {
      const parts = participantsByConv.get(c.id) || [];

      if (c.type === 'GROUP') {
        result.push({
          id: c.id,
          company_id: c.company_id,
          type: 'GROUP',
          title: c.title || 'Grupo de Chat',
          created_by: c.created_by,
          other_user: null,
          participants: parts,
          participant_count: Number(c.participant_count || parts.length),
          last_message: c.last_message,
          last_message_at: c.last_message_at,
          unread_count: Number(c.unread_count || 0),
        });
      } else {
        // DIRECT (1-a-1)
        const other = parts.find((p) => p.id !== currentUserId);
        // Exigir que el interlocutor esté activo y con can_use_chat = 1
        if (other && other.is_active === 1 && other.can_use_chat === 1) {
          result.push({
            id: c.id,
            company_id: c.company_id,
            type: 'DIRECT',
            title: other.full_name,
            created_by: null,
            other_user: other,
            participants: parts,
            participant_count: 2,
            last_message: c.last_message,
            last_message_at: c.last_message_at,
            unread_count: Number(c.unread_count || 0),
          });
        }
      }
    }

    return result;
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

    // Validar que el usuario destinatario esté activo y tenga el uso de chat autorizado
    const recipientRows = await query<any>(
      `SELECT id, is_active, can_use_chat FROM users WHERE id = ? AND company_id = ? LIMIT 1`,
      [recipientId, companyId]
    );

    if (
      recipientRows.length === 0 ||
      !recipientRows[0].is_active ||
      recipientRows[0].can_use_chat !== 1
    ) {
      throw new Error(
        'El usuario seleccionado no tiene activo el uso del chat interno o su cuenta se encuentra inactiva.'
      );
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
      // Si el usuario había ocultado la conversación, restaurar visibilidad
      await query(
        `UPDATE chat_conversation_participants SET hidden_at = NULL WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, currentUserId]
      );
    } else {
      conversationId = crypto.randomUUID();
      await query(
        `INSERT INTO chat_conversations (id, company_id, type, user1_id, user2_id, last_message, last_message_at)
         VALUES (?, ?, 'DIRECT', ?, ?, NULL, NOW())`,
        [conversationId, companyId, user1_id, user2_id]
      );

      // Registrar participantes
      await query(
        `INSERT IGNORE INTO chat_conversation_participants (id, conversation_id, company_id, user_id, is_admin, joined_at)
         VALUES (UUID(), ?, ?, ?, 0, NOW()), (UUID(), ?, ?, ?, 0, NOW())`,
        [conversationId, companyId, user1_id, conversationId, companyId, user2_id]
      );
    }

    // Retornar la conversación formateada
    const convs = await this.getConversations(companyId, currentUserId);
    const found = convs.find((c) => c.id === conversationId);
    if (!found) {
      // Fallback
      const otherUserRows = await query<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.last_login_at,
                COALESCE(r.name, 'Usuario') as role_name,
                COALESCE(ucs.status, 'ONLINE') as status,
                ucs.status_message
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         LEFT JOIN user_chat_statuses ucs ON ucs.user_id = u.id
         WHERE u.id = ? LIMIT 1`,
        [recipientId]
      );
      const row = otherUserRows[0];
      const isOnline = RealtimeService.isUserOnline(recipientId);
      const manualStatus = ((row && row.status) || 'ONLINE') as ChatUserStatusType;
      const effective_status: ChatUserStatusType =
        !isOnline || manualStatus === 'OFFLINE' ? 'OFFLINE' : manualStatus;

      const otherUser: ChatUserSummary = {
        id: recipientId,
        username: row ? row.username : '',
        full_name: row ? row.full_name : 'Usuario',
        email: row ? row.email : '',
        role_name: row ? row.role_name : 'Usuario',
        last_login_at: row ? row.last_login_at : null,
        status: manualStatus,
        status_message: row ? row.status_message : null,
        is_online: isOnline,
        effective_status,
      };

      return {
        id: conversationId,
        company_id: companyId,
        type: 'DIRECT',
        title: otherUser.full_name,
        created_by: null,
        other_user: otherUser,
        participant_count: 2,
        last_message: null,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      };
    }

    return found;
  }

  /**
   * Crea un chat tipo grupo con múltiples usuarios autorizados
   */
  static async createGroupConversation(
    companyId: string,
    creatorId: string,
    title: string,
    participantIds: string[]
  ): Promise<ConversationSummary> {
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) {
      throw new Error('El nombre o asunto del grupo es obligatorio.');
    }

    const uniqueIds = Array.from(new Set([creatorId, ...participantIds.filter(Boolean)]));
    if (uniqueIds.length < 2) {
      throw new Error('Un grupo debe incluir al menos a dos colaboradores participantes.');
    }

    // Validar que todos los participantes tengan can_use_chat = 1 y estén activos
    const validUsers = await query<any>(
      `SELECT id, username, full_name, email, is_active, can_use_chat 
       FROM users 
       WHERE company_id = ? AND id IN (?) AND is_active = 1 AND can_use_chat = 1`,
      [companyId, uniqueIds]
    );

    if (validUsers.length < 2) {
      throw new Error(
        'Uno o más de los usuarios seleccionados no tienen autorizado el chat institucional o están inactivos.'
      );
    }

    const conversationId = crypto.randomUUID();

    // 1. Crear registro de conversación grupal
    await query(
      `INSERT INTO chat_conversations (id, company_id, type, title, created_by, user1_id, user2_id, last_message, last_message_at)
       VALUES (?, ?, 'GROUP', ?, ?, NULL, NULL, 'Grupo creado', NOW())`,
      [conversationId, companyId, cleanTitle, creatorId]
    );

    // 2. Asociar todos los integrantes en chat_conversation_participants
    for (const u of validUsers) {
      const isAdmin = u.id === creatorId ? 1 : 0;
      await query(
        `INSERT INTO chat_conversation_participants (id, conversation_id, company_id, user_id, is_admin, joined_at)
         VALUES (UUID(), ?, ?, ?, ?, NOW())`,
        [conversationId, companyId, u.id, isAdmin]
      );
    }

    // 3. Insertar primer mensaje de bienvenida de sistema
    const creatorUser = validUsers.find((u) => u.id === creatorId);
    const welcomeText = `${creatorUser?.full_name || 'Un usuario'} creó el grupo "${cleanTitle}".`;
    await query(
      `INSERT INTO chat_messages (id, conversation_id, company_id, sender_id, recipient_id, message, is_read, created_at)
       VALUES (UUID(), ?, ?, ?, NULL, ?, 1, NOW())`,
      [conversationId, companyId, creatorId, welcomeText]
    );

    // 4. Notificar a los integrantes en tiempo real
    try {
      for (const u of validUsers) {
        if (u.id !== creatorId) {
          RealtimeService.emitToUser(u.id, 'chat:group_created', {
            conversationId,
            title: cleanTitle,
            creatorName: creatorUser?.full_name,
          });
        }
      }
    } catch {}

    const convs = await this.getConversations(companyId, creatorId);
    const found = convs.find((c) => c.id === conversationId);
    if (found) return found;

    return {
      id: conversationId,
      company_id: companyId,
      type: 'GROUP',
      title: cleanTitle,
      created_by: creatorId,
      other_user: null,
      participant_count: validUsers.length,
      last_message: welcomeText,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    };
  }

  /**
   * Agrega participantes adicionales a un grupo existente
   */
  static async addParticipantsToGroup(
    companyId: string,
    conversationId: string,
    requestingUserId: string,
    userIds: string[]
  ): Promise<void> {
    const convRows = await query<any>(
      `SELECT id, type, title FROM chat_conversations WHERE id = ? AND company_id = ? LIMIT 1`,
      [conversationId, companyId]
    );
    if (!convRows.length || convRows[0].type !== 'GROUP') {
      throw new Error('Solo es posible agregar integrantes a conversaciones grupales.');
    }

    // Validar que el usuario solicitante pertenezca al grupo
    const reqPart = await query<any>(
      `SELECT id FROM chat_conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1`,
      [conversationId, requestingUserId]
    );
    if (!reqPart.length) {
      throw new Error('No tienes autorización para gestionar integrantes de este grupo.');
    }

    // Validar usuarios a agregar
    const validUsers = await query<any>(
      `SELECT id, username, full_name FROM users WHERE company_id = ? AND id IN (?) AND is_active = 1 AND can_use_chat = 1`,
      [companyId, userIds]
    );

    for (const u of validUsers) {
      await query(
        `INSERT IGNORE INTO chat_conversation_participants (id, conversation_id, company_id, user_id, is_admin, joined_at)
         VALUES (UUID(), ?, ?, ?, 0, NOW())`,
        [conversationId, companyId, u.id]
      );
    }
  }

  /**
   * Elimina un participante del grupo o permite que un usuario abandone el grupo
   */
  static async removeParticipantFromGroup(
    companyId: string,
    conversationId: string,
    requestingUserId: string,
    targetUserId: string
  ): Promise<void> {
    const convRows = await query<any>(
      `SELECT id, type, created_by FROM chat_conversations WHERE id = ? AND company_id = ? LIMIT 1`,
      [conversationId, companyId]
    );
    if (!convRows.length || convRows[0].type !== 'GROUP') {
      throw new Error('Operación válida solo para conversaciones tipo grupo.');
    }

    if (requestingUserId !== targetUserId) {
      // Solo el creador o admin puede expulsar a otro integrante
      const adminCheck = await query<any>(
        `SELECT is_admin FROM chat_conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1`,
        [conversationId, requestingUserId]
      );
      if (!adminCheck.length || (!adminCheck[0].is_admin && convRows[0].created_by !== requestingUserId)) {
        throw new Error('Solo los administradores del grupo pueden expulsar integrantes.');
      }
    }

    await query(
      `DELETE FROM chat_conversation_participants WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, targetUserId]
    );
  }

  /**
   * Obtiene la lista de integrantes de un grupo con su presencia en tiempo real
   */
  static async getGroupParticipants(companyId: string, conversationId: string): Promise<GroupParticipantSummary[]> {
    const rows = await query<any>(
      `SELECT cp.is_admin, cp.joined_at, u.id, u.username, u.full_name, u.email, u.last_login_at,
              COALESCE(r.name, 'Usuario') as role_name,
              COALESCE(ucs.status, 'ONLINE') as status,
              ucs.status_message
       FROM chat_conversation_participants cp
       INNER JOIN users u ON cp.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_chat_statuses ucs ON ucs.user_id = u.id
       WHERE cp.conversation_id = ? AND cp.company_id = ? AND u.is_active = 1
       ORDER BY cp.is_admin DESC, u.full_name ASC`,
      [conversationId, companyId]
    );

    return rows.map((p) => {
      const isOnline = RealtimeService.isUserOnline(p.id);
      const manualStatus = (p.status || 'ONLINE') as ChatUserStatusType;
      const effective_status = this.computeEffectiveStatus(manualStatus, isOnline);

      return {
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        email: p.email,
        role_name: p.role_name,
        is_admin: Boolean(p.is_admin),
        is_online: isOnline,
        status: manualStatus,
        effective_status,
      };
    });
  }

  /**
   * Elimina u oculta una conversación de la lista del usuario actual
   * (El otro usuario y la bitácora conservan todo el historial)
   */
  static async hideConversation(companyId: string, conversationId: string, userId: string): Promise<void> {
    const conv = await query<any>(
      `SELECT id FROM chat_conversations WHERE id = ? AND company_id = ? LIMIT 1`,
      [conversationId, companyId]
    );

    if (conv.length === 0) {
      throw new Error('Conversación no encontrada.');
    }

    await query(
      `INSERT INTO chat_conversation_participants (id, conversation_id, company_id, user_id, hidden_at)
       VALUES (UUID(), ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE hidden_at = NOW()`,
      [conversationId, companyId, userId]
    );
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
    // Validar pertenencia a la conversación
    const conv = await query<any>(
      `SELECT id, type, user1_id, user2_id FROM chat_conversations WHERE id = ? AND company_id = ? LIMIT 1`,
      [conversationId, companyId]
    );

    if (conv.length === 0) {
      throw new Error('Conversación no encontrada.');
    }

    const convData = conv[0];
    let isMember = false;
    if (convData.type === 'GROUP') {
      const part = await query<any>(
        `SELECT id FROM chat_conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1`,
        [conversationId, currentUserId]
      );
      isMember = part.length > 0;
    } else {
      isMember = convData.user1_id === currentUserId || convData.user2_id === currentUserId;
      if (!isMember) {
        const part = await query<any>(
          `SELECT id FROM chat_conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1`,
          [conversationId, currentUserId]
        );
        isMember = part.length > 0;
      }
    }

    if (!isMember) {
      throw new Error('Acceso no autorizado a esta conversación.');
    }

    // Marcar como leídos los mensajes dirigidos al usuario actual o mensajes grupales enviados por otros
    const updateRes = await query<any>(
      `UPDATE chat_messages 
       SET is_read = 1, read_at = NOW() 
       WHERE conversation_id = ? 
         AND ((recipient_id = ?) OR (recipient_id IS NULL AND sender_id != ?))
         AND is_read = 0`,
      [conversationId, currentUserId, currentUserId]
    );

    // Si se marcaron mensajes como leídos, emitir actualización en tiempo real
    const updateHeader = updateRes as any;
    if (updateHeader && (updateHeader.affectedRows > 0 || updateHeader.changedRows > 0)) {
      try {
        const unreadTotal = await this.getUnreadTotal(companyId, currentUserId);
        RealtimeService.emitToUser(currentUserId, 'chat:unread', { unreadTotal });

        if (convData.type === 'DIRECT') {
          const otherUserId = convData.user1_id === currentUserId ? convData.user2_id : convData.user1_id;
          if (otherUserId) {
            RealtimeService.emitToUser(otherUserId, 'chat:read', {
              conversationId,
              readByUserId: currentUserId,
            });
          }
        }
      } catch {
        // Silencioso
      }
    }

    // Obtener los últimos mensajes con detalle del remitente
    const messages = await query<any>(
      `SELECT m.id, m.conversation_id, m.company_id, m.sender_id, m.recipient_id, m.message, m.is_read, m.read_at, m.created_at,
              u.full_name as sender_name, u.username as sender_username, COALESCE(r.name, 'Usuario') as sender_role
       FROM chat_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE m.conversation_id = ? AND m.company_id = ?
       ORDER BY m.created_at ASC
       LIMIT ?`,
      [conversationId, companyId, limit]
    );

    return messages;
  }

  /**
   * Envía un nuevo mensaje en una conversación (directa o grupal)
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
      `SELECT id, type, title, user1_id, user2_id FROM chat_conversations WHERE id = ? AND company_id = ? LIMIT 1`,
      [conversationId, companyId]
    );

    if (conv.length === 0) {
      throw new Error('Conversación no encontrada.');
    }

    const convData = conv[0];
    let recipientId: string | null = null;
    let participantIds: string[] = [];

    if (convData.type === 'GROUP') {
      const participants = await query<any>(
        `SELECT user_id FROM chat_conversation_participants WHERE conversation_id = ?`,
        [conversationId]
      );
      participantIds = participants.map((p) => p.user_id);
      if (!participantIds.includes(senderId)) {
        throw new Error('No eres participante de este grupo.');
      }
      recipientId = null;
    } else {
      const { user1_id, user2_id } = convData;
      if (user1_id !== senderId && user2_id !== senderId) {
        throw new Error('No eres participante de esta conversación.');
      }
      recipientId = user1_id === senderId ? user2_id : user1_id;
      participantIds = [user1_id, user2_id].filter(Boolean);

      // Validar que el destinatario tenga activo el uso del chat
      const targetUser = await query<any>(
        `SELECT id, is_active, can_use_chat FROM users WHERE id = ? AND company_id = ? LIMIT 1`,
        [recipientId, companyId]
      );
      if (!targetUser.length || !targetUser[0].is_active || targetUser[0].can_use_chat !== 1) {
        throw new Error('El usuario destinatario no tiene habilitado el uso del chat institucional.');
      }
    }

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

    // Desocultar conversación para todos los participantes (un nuevo mensaje la reabre en la lista)
    await query(
      `UPDATE chat_conversation_participants 
       SET hidden_at = NULL 
       WHERE conversation_id = ?`,
      [conversationId]
    );

    const senderRows = await query<any>(
      `SELECT u.id, u.username, u.full_name, COALESCE(r.name, 'Usuario') as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? LIMIT 1`,
      [senderId]
    );
    const sender = senderRows[0] || { id: senderId, username: 'Usuario', full_name: 'Usuario', role_name: 'Usuario' };

    const createdMsg: ChatMessage = {
      id: messageId,
      conversation_id: conversationId,
      company_id: companyId,
      sender_id: senderId,
      recipient_id: recipientId,
      message: text,
      is_read: 0,
      read_at: null,
      created_at: new Date().toISOString(),
      sender_name: sender.full_name || sender.username,
      sender_username: sender.username,
      sender_role: sender.role_name,
    };

    // Emitir eventos en tiempo real
    try {
      if (convData.type === 'DIRECT' && recipientId) {
        const unreadTotal = await this.getUnreadTotal(companyId, recipientId);
        RealtimeService.emitToUser(recipientId, 'chat:message', {
          message: createdMsg,
          conversationId,
          senderId,
          senderName: sender.full_name || sender.username,
          senderUsername: sender.username,
          text,
          unreadTotal,
        });
      } else {
        // En grupo, notificar a cada participante diferente al emisor
        for (const pId of participantIds) {
          if (pId !== senderId) {
            const unreadTotal = await this.getUnreadTotal(companyId, pId);
            RealtimeService.emitToUser(pId, 'chat:message', {
              message: createdMsg,
              conversationId,
              senderId,
              senderName: sender.full_name || sender.username,
              senderUsername: sender.username,
              groupTitle: convData.title || 'Grupo',
              text,
              unreadTotal,
            });
          }
        }
      }

      // Notificar al emisor para sincronizar otras pestañas o ventanas activas
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
   * Total de mensajes no leídos para el usuario (incluyendo directos y grupales)
   */
  static async getUnreadTotal(companyId: string, currentUserId: string): Promise<number> {
    const rows = await query<any>(
      `SELECT COUNT(*) as total 
       FROM chat_messages m
       INNER JOIN chat_conversations c ON m.conversation_id = c.id
       INNER JOIN chat_conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
       WHERE m.company_id = ? 
         AND m.sender_id != ?
         AND (cp.hidden_at IS NULL OR m.created_at > cp.hidden_at)
         AND ((m.recipient_id = ?) OR (m.recipient_id IS NULL))
         AND m.is_read = 0`,
      [currentUserId, companyId, currentUserId, currentUserId]
    );
    return Number(rows[0]?.total || 0);
  }

  // =========================================================================
  // MÓDULO DE AUDITORÍA & BITÁCORA (Acceso restringido con permiso chat.audit)
  // =========================================================================

  /**
   * Obtiene todas las conversaciones de la empresa para supervisión / bitácora
   * IMPORTANTE: No filtra por hidden_at para garantizar auditoría permanente
   */
  static async getAuditConversations(
    companyId: string,
    filters: { search?: string; userId?: string; dateFrom?: string; dateTo?: string }
  ): Promise<AuditConversationSummary[]> {
    let sql = `
      SELECT c.id, c.company_id, c.type, c.title, c.created_by, c.user1_id, c.user2_id, c.last_message, c.last_message_at, c.created_at,
             u1.username as u1_username, u1.full_name as u1_full_name, u1.email as u1_email, u1.last_login_at as u1_last_login,
             COALESCE(r1.name, 'Usuario') as u1_role,
             u2.username as u2_username, u2.full_name as u2_full_name, u2.email as u2_email, u2.last_login_at as u2_last_login,
             COALESCE(r2.name, 'Usuario') as u2_role,
             (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) as total_messages,
             (
               SELECT GROUP_CONCAT(COALESCE(pu.full_name, pu.username) SEPARATOR ', ')
               FROM chat_conversation_participants p
               INNER JOIN users pu ON p.user_id = pu.id
               WHERE p.conversation_id = c.id
             ) as participant_names
      FROM chat_conversations c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN roles r1 ON u1.role_id = r1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN roles r2 ON u2.role_id = r2.id
      WHERE c.company_id = ?
    `;
    const params: any[] = [companyId];

    if (filters.userId) {
      sql += ` AND (c.user1_id = ? OR c.user2_id = ? OR EXISTS (SELECT 1 FROM chat_conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = ?))`;
      params.push(filters.userId, filters.userId, filters.userId);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      sql += ` AND (u1.full_name LIKE ? OR u2.full_name LIKE ? OR c.title LIKE ? OR c.last_message LIKE ?)`;
      params.push(term, term, term, term);
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
      type: r.type || 'DIRECT',
      title: r.title || null,
      created_by: r.created_by || null,
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      total_messages: Number(r.total_messages || 0),
      created_at: r.created_at,
      participant_names: r.participant_names || null,
      user1: r.user1_id
        ? {
            id: r.user1_id,
            username: r.u1_username,
            full_name: r.u1_full_name,
            email: r.u1_email,
            role_name: r.u1_role,
            last_login_at: r.u1_last_login,
          }
        : null,
      user2: r.user2_id
        ? {
            id: r.user2_id,
            username: r.u2_username,
            full_name: r.u2_full_name,
            email: r.u2_email,
            role_name: r.u2_role,
            last_login_at: r.u2_last_login,
          }
        : null,
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
      LEFT JOIN users r ON m.recipient_id = r.id
      LEFT JOIN roles rr ON r.role_id = rr.id
      WHERE m.conversation_id = ? AND m.company_id = ?
      ORDER BY m.created_at ASC
    `;

    return await query<any>(sql, [conversationId, companyId]);
  }

  /**
   * Elimina mensajes de la bitácora de chat por rango de fechas (Solo administradores con chat.audit)
   */
  static async deleteAuditMessagesByDateRange(
    companyId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<{ deletedMessages: number; affectedConversations: number }> {
    if (!dateFrom || !dateTo) {
      throw new Error('Debe especificar tanto la fecha inicial como la final.');
    }

    const startDateTime = `${dateFrom} 00:00:00`;
    const endDateTime = `${dateTo} 23:59:59`;

    // Obtener las conversaciones con mensajes en el rango
    const affectedConvRows = await query<any>(
      `SELECT DISTINCT conversation_id 
       FROM chat_messages 
       WHERE company_id = ? AND created_at >= ? AND created_at <= ?`,
      [companyId, startDateTime, endDateTime]
    );

    // Eliminar los mensajes del rango
    const deleteRes: any = await query(
      `DELETE FROM chat_messages 
       WHERE company_id = ? AND created_at >= ? AND created_at <= ?`,
      [companyId, startDateTime, endDateTime]
    );

    const deletedMessages = Number(deleteRes?.affectedRows || 0);

    // Actualizar el last_message y last_message_at de las conversaciones afectadas
    for (const row of affectedConvRows) {
      const convId = row.conversation_id;
      const latestMsgRows = await query<any>(
        `SELECT message, created_at FROM chat_messages 
         WHERE conversation_id = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [convId]
      );

      if (latestMsgRows.length > 0) {
        await query(
          `UPDATE chat_conversations 
           SET last_message = ?, last_message_at = ?, updated_at = NOW() 
           WHERE id = ?`,
          [latestMsgRows[0].message.substring(0, 500), latestMsgRows[0].created_at, convId]
        );
      } else {
        await query(
          `UPDATE chat_conversations 
           SET last_message = NULL, updated_at = NOW() 
           WHERE id = ?`,
          [convId]
        );
      }
    }

    return {
      deletedMessages,
      affectedConversations: affectedConvRows.length,
    };
  }

  /**
   * Obtiene el estado manual y presencia actual del usuario
   */
  static async getUserStatus(
    companyId: string,
    userId: string
  ): Promise<{
    userId: string;
    status: ChatUserStatusType;
    statusMessage: string | null;
    isOnline: boolean;
    effectiveStatus: ChatUserStatusType;
    updatedAt: string | null;
  }> {
    const rows = await query<any>(
      `SELECT status, status_message, updated_at FROM user_chat_statuses WHERE user_id = ? AND company_id = ? LIMIT 1`,
      [userId, companyId]
    );

    const isOnline = RealtimeService.isUserOnline(userId);
    const manualStatus: ChatUserStatusType = (rows[0]?.status || 'ONLINE') as ChatUserStatusType;
    const statusMessage: string | null = rows[0]?.status_message || null;
    const effectiveStatus = this.computeEffectiveStatus(manualStatus, isOnline);

    return {
      userId,
      status: manualStatus,
      statusMessage,
      isOnline,
      effectiveStatus,
      updatedAt: rows[0]?.updated_at ? new Date(rows[0].updated_at).toISOString() : null,
    };
  }

  /**
   * Configura o actualiza el estado manual del usuario y difunde el cambio a toda la empresa
   */
  static async setUserStatus(
    companyId: string,
    userId: string,
    status: ChatUserStatusType,
    statusMessage?: string | null
  ): Promise<{
    userId: string;
    status: ChatUserStatusType;
    statusMessage: string | null;
    isOnline: boolean;
    effectiveStatus: ChatUserStatusType;
  }> {
    const cleanMessage = statusMessage ? statusMessage.trim().substring(0, 150) : null;

    await query(
      `INSERT INTO user_chat_statuses (user_id, company_id, status, status_message, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), status_message = VALUES(status_message), updated_at = NOW()`,
      [userId, companyId, status, cleanMessage]
    );

    const isOnline = RealtimeService.isUserOnline(userId);
    const effectiveStatus = this.computeEffectiveStatus(status, isOnline);

    const payload = {
      userId,
      status,
      statusMessage: cleanMessage,
      isOnline,
      effectiveStatus,
      timestamp: new Date().toISOString(),
    };

    // Difundir actualización de presencia a la empresa en tiempo real
    RealtimeService.emitToCompany(companyId, 'chat:presence', payload);

    return payload;
  }

  /**
   * Obtiene un mapa de presencia consolidado de todos los usuarios de la empresa
   */
  static async getCompanyPresence(companyId: string): Promise<
    Record<
      string,
      {
        status: ChatUserStatusType;
        statusMessage: string | null;
        isOnline: boolean;
        effectiveStatus: ChatUserStatusType;
      }
    >
  > {
    const rows = await query<any>(
      `SELECT u.id as user_id, COALESCE(ucs.status, 'ONLINE') as status, ucs.status_message
       FROM users u
       LEFT JOIN user_chat_statuses ucs ON ucs.user_id = u.id
       WHERE u.company_id = ? AND u.is_active = 1 AND u.can_use_chat = 1`,
      [companyId]
    );

    const result: Record<string, any> = {};
    for (const r of rows) {
      const isOnline = RealtimeService.isUserOnline(r.user_id);
      const manualStatus = (r.status || 'ONLINE') as ChatUserStatusType;
      const effectiveStatus = this.computeEffectiveStatus(manualStatus, isOnline);

      result[r.user_id] = {
        status: manualStatus,
        statusMessage: r.status_message || null,
        isOnline,
        effectiveStatus,
      };
    }

    return result;
  }
}

