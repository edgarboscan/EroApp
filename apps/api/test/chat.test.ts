import { describe, it, expect, beforeAll } from 'vitest';
import { ChatService } from '../src/modules/chat/chat.service';
import { query } from '../src/db';

describe('Módulo de Chat Interno y Bitácora de Conversaciones', () => {
  const companyId = 'c1111111-1111-1111-1111-111111111111';
  let user1Id: string;
  let user2Id: string;
  let conversationId: string;

  beforeAll(async () => {
    // Buscar dos usuarios reales de la empresa de prueba
    const users = await query<any>(
      `SELECT id, username, full_name FROM users WHERE company_id = ? AND is_active = 1 LIMIT 2`,
      [companyId]
    );

    if (users.length >= 2) {
      user1Id = users[0].id;
      user2Id = users[1].id;
    } else {
      user1Id = 'u1111111-1111-1111-1111-111111111111';
      user2Id = 'u2222222-2222-2222-2222-222222222222';
    }

    // Limpiar mensajes y conversaciones anteriores de prueba entre estos usuarios
    const [u1, u2] = [user1Id, user2Id].sort();
    const existing = await query<any>(
      `SELECT id FROM chat_conversations WHERE company_id = ? AND user1_id = ? AND user2_id = ?`,
      [companyId, u1, u2]
    );
    if (existing.length > 0) {
      await query(`DELETE FROM chat_messages WHERE conversation_id = ?`, [existing[0].id]);
      await query(`DELETE FROM chat_conversations WHERE id = ?`, [existing[0].id]);
    }
  });

  describe('Búsqueda de Usuarios y Creación de Conversaciones', () => {
    it('debe buscar usuarios activos de la empresa excluyendo al usuario que consulta', async () => {
      const results = await ChatService.searchUsers(companyId, user1Id);
      expect(Array.isArray(results)).toBe(true);
      expect(results.every((u) => u.id !== user1Id)).toBe(true);
    });

    it('debe crear o recuperar una conversación 1-a-1 de manera determinista', async () => {
      const conv = await ChatService.getOrCreateConversation(companyId, user1Id, user2Id);
      expect(conv).toBeDefined();
      expect(conv.id).toBeDefined();
      expect(conv.other_user.id).toBe(user2Id);
      conversationId = conv.id;

      // Al llamar de nuevo desde el otro usuario, debe devolver el mismo ID de conversación
      const sameConv = await ChatService.getOrCreateConversation(companyId, user2Id, user1Id);
      expect(sameConv.id).toBe(conversationId);
      expect(sameConv.other_user.id).toBe(user1Id);
    });

    it('debe impedir crear una conversación de un usuario consigo mismo', async () => {
      await expect(
        ChatService.getOrCreateConversation(companyId, user1Id, user1Id)
      ).rejects.toThrow('No es posible crear una conversación consigo mismo.');
    });
  });

  describe('Envío de Mensajes y Emoticones', () => {
    it('debe enviar un mensaje con texto plano y emoticones correctamente', async () => {
      const messageText = '¡Hola colega! 👋 ¿Revisaste el arqueo de caja? 📊 Todo cuadra perfecto ✅ 👍';
      const created = await ChatService.sendMessage(companyId, conversationId, user1Id, messageText);

      expect(created).toBeDefined();
      expect(created.message).toBe(messageText);
      expect(created.sender_id).toBe(user1Id);
      expect(created.recipient_id).toBe(user2Id);
      expect(created.is_read).toBe(0);
    });

    it('debe rechazar mensajes vacíos o solo espacios', async () => {
      await expect(
        ChatService.sendMessage(companyId, conversationId, user1Id, '    ')
      ).rejects.toThrow('El mensaje no puede estar vacío.');
    });

    it('debe rechazar envío si el usuario no pertenece a la conversación', async () => {
      const intruderId = 'u9999999-9999-9999-9999-999999999999';
      await expect(
        ChatService.sendMessage(companyId, conversationId, intruderId, 'Intento no autorizado')
      ).rejects.toThrow('No eres participante de esta conversación.');
    });
  });

  describe('Lectura de Mensajes y Marcado de Leídos', () => {
    it('debe reportar mensaje no leído para el destinatario antes de abrir la conversación', async () => {
      const unreadCount = await ChatService.getUnreadTotal(companyId, user2Id);
      expect(unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('debe obtener mensajes y marcar automáticamente como leídos los recibidos por el usuario', async () => {
      const msgs = await ChatService.getMessages(companyId, conversationId, user2Id);
      expect(Array.isArray(msgs)).toBe(true);
      expect(msgs.length).toBeGreaterThanOrEqual(1);

      // Ahora el contador de no leídos debe ser 0
      const unreadAfter = await ChatService.getUnreadTotal(companyId, user2Id);
      expect(unreadAfter).toBe(0);
    });
  });

  describe('Auditoría y Bitácora Institucional (chat.audit)', () => {
    it('debe listar conversaciones en la bitácora de auditoría con participantes y conteos', async () => {
      const auditList = await ChatService.getAuditConversations(companyId, {});
      expect(Array.isArray(auditList)).toBe(true);
      const found = auditList.find((c) => c.id === conversationId);
      expect(found).toBeDefined();
      expect(found?.total_messages).toBeGreaterThanOrEqual(1);
      expect(found?.user1.full_name).toBeDefined();
      expect(found?.user2.full_name).toBeDefined();
    });

    it('debe obtener la transcripción completa de mensajes para auditoría con detalle de emisor y receptor', async () => {
      const transcript = await ChatService.getAuditMessages(companyId, conversationId);
      expect(Array.isArray(transcript)).toBe(true);
      expect(transcript.length).toBeGreaterThanOrEqual(1);
      expect(transcript[0].sender_name).toBeDefined();
      expect(transcript[0].recipient_name).toBeDefined();
      expect(transcript[0].message).toContain('¡Hola colega! 👋');
    });
  });
});

