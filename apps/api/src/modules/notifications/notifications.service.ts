import crypto from 'crypto';
import { query } from '../../db';
import {
  NotificationItem,
  NotificationType,
  notificationTypes,
  notificationTypeLabels,
  ShareReportInput,
  SendEmailReportInput,
  SendDirectEmailInput,
  UserNotificationPreferenceItem,
  EmailLogItem,
} from '@ero/shared';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MailerService, MailAttachment } from '../../services/mailer.service';

export class NotificationsService {
  private static tablesEnsured = false;

  /**
   * Garantiza que las tablas del módulo de notificaciones y correo existan
   */
  static async ensureTables() {
    if (this.tablesEnsured) return;
    this.tablesEnsured = true;

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(36) NOT NULL,
          company_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSON DEFAULT NULL,
          is_read TINYINT(1) NOT NULL DEFAULT 0,
          read_at DATETIME DEFAULT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_notif_user (company_id, user_id, is_read, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS user_notification_preferences (
          id VARCHAR(36) NOT NULL,
          company_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          notification_type VARCHAR(50) NOT NULL,
          in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
          email_enabled TINYINT(1) NOT NULL DEFAULT 0,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_user_notif_pref (company_id, user_id, notification_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id VARCHAR(36) NOT NULL,
          company_id VARCHAR(36) NOT NULL,
          sender_user_id VARCHAR(36) DEFAULT NULL,
          sender_name VARCHAR(255) DEFAULT NULL,
          recipient_email VARCHAR(255) NOT NULL,
          recipient_name VARCHAR(255) DEFAULT NULL,
          recipient_type VARCHAR(50) DEFAULT 'custom',
          subject VARCHAR(255) NOT NULL,
          body TEXT,
          report_title VARCHAR(255) DEFAULT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'SENT',
          error_message TEXT DEFAULT NULL,
          has_attachments TINYINT(1) NOT NULL DEFAULT 0,
          attachments_count INT NOT NULL DEFAULT 0,
          attachment_names TEXT DEFAULT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_email_company (company_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Migración progresiva de columnas para adjuntos en email_logs
      try {
        const cols = await query<any>(`SHOW COLUMNS FROM email_logs LIKE 'has_attachments'`);
        if (cols.length === 0) {
          await query(`ALTER TABLE email_logs ADD COLUMN has_attachments TINYINT(1) NOT NULL DEFAULT 0`);
          await query(`ALTER TABLE email_logs ADD COLUMN attachments_count INT NOT NULL DEFAULT 0`);
          await query(`ALTER TABLE email_logs ADD COLUMN attachment_names TEXT DEFAULT NULL`);
          // Retroalimentar registros previos de reportes oficiales
          await query(`
            UPDATE email_logs
            SET has_attachments = 1,
                attachments_count = 1,
                attachment_names = CONCAT(IFNULL(report_title, 'documento_oficial'), '.pdf')
            WHERE report_title IS NOT NULL AND report_title != 'Mensaje Directo' AND has_attachments = 0
          `);
        }
      } catch (alterErr: any) {
        console.warn('[NotificationsService] Nota al asegurar columnas de adjuntos:', alterErr.message);
      }
    } catch (err: any) {
      console.error('[NotificationsService] Error al asegurar tablas:', err.message);
    }
  }

  /**
   * Obtiene la lista de notificaciones para un usuario
   */
  static async getNotifications(companyId: string, userId: string, onlyUnread = false): Promise<NotificationItem[]> {
    await this.ensureTables();

    try {
      let sql = `
        SELECT id, company_id, user_id, type, title, message, data, is_read, read_at, created_at
        FROM notifications
        WHERE company_id = ? AND user_id = ?
      `;
      const params: any[] = [companyId, userId];

      if (onlyUnread) {
        sql += ` AND is_read = 0`;
      }

      sql += ` ORDER BY created_at DESC LIMIT 60`;

      const rows = await query<any>(sql, params);

      return rows.map((r: any) => ({
        id: r.id,
        companyId: r.company_id,
        userId: r.user_id,
        type: r.type as NotificationType,
        title: r.title,
        message: r.message,
        data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data || null,
        isRead: Boolean(r.is_read),
        readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    } catch (error: any) {
      console.error('[NotificationsService] Error al obtener notificaciones:', error.message);
      return [];
    }
  }

  /**
   * Retorna el número de notificaciones no leídas para el usuario
   */
  static async getUnreadCount(companyId: string, userId: string): Promise<number> {
    await this.ensureTables();

    try {
      const rows = await query<any>(
        `SELECT COUNT(*) as count FROM notifications WHERE company_id = ? AND user_id = ? AND is_read = 0`,
        [companyId, userId]
      );
      return Number(rows[0]?.count || 0);
    } catch {
      return 0;
    }
  }

  /**
   * Marca una notificación específica como leída
   */
  static async markAsRead(companyId: string, userId: string, notificationId: string): Promise<boolean> {
    await this.ensureTables();

    try {
      await query(
        `UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND company_id = ? AND user_id = ?`,
        [notificationId, companyId, userId]
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Marca todas las notificaciones del usuario como leídas
   */
  static async markAllAsRead(companyId: string, userId: string): Promise<boolean> {
    await this.ensureTables();

    try {
      await query(
        `UPDATE notifications SET is_read = 1, read_at = NOW() WHERE company_id = ? AND user_id = ? AND is_read = 0`,
        [companyId, userId]
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Elimina una notificación
   */
  static async deleteNotification(companyId: string, userId: string, notificationId: string): Promise<boolean> {
    await this.ensureTables();

    try {
      await query(
        `DELETE FROM notifications WHERE id = ? AND company_id = ? AND user_id = ?`,
        [notificationId, companyId, userId]
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene las preferencias de notificación de un usuario
   */
  static async getPreferences(companyId: string, userId: string): Promise<UserNotificationPreferenceItem[]> {
    await this.ensureTables();

    try {
      const rows = await query<any>(
        `SELECT notification_type, in_app_enabled, email_enabled
         FROM user_notification_preferences
         WHERE company_id = ? AND user_id = ?`,
        [companyId, userId]
      );

      const map = new Map<string, { inApp: boolean; email: boolean }>();
      for (const r of rows) {
        map.set(r.notification_type, {
          inApp: Boolean(r.in_app_enabled),
          email: Boolean(r.email_enabled),
        });
      }

      // Devolver lista completa asegurando que todos los tipos estén presentes
      return notificationTypes.map((type) => {
        const saved = map.get(type);
        return {
          type,
          inApp: saved ? saved.inApp : true, // En app activo por defecto
          email: saved ? saved.email : (type === 'REPORT_SHARED' || type === 'LOW_STOCK'), // Por defecto activo para reportes y stock
        };
      });
    } catch (error: any) {
      console.error('[NotificationsService] Error al obtener preferencias:', error.message);
      return notificationTypes.map((type) => ({
        type,
        inApp: true,
        email: false,
      }));
    }
  }

  /**
   * Actualiza las preferencias de notificación de un usuario
   */
  static async updatePreferences(
    companyId: string,
    userId: string,
    preferences: UserNotificationPreferenceItem[]
  ): Promise<UserNotificationPreferenceItem[]> {
    await this.ensureTables();

    for (const item of preferences) {
      const id = crypto.randomUUID();
      await query(
        `INSERT INTO user_notification_preferences (id, company_id, user_id, notification_type, in_app_enabled, email_enabled)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE in_app_enabled = VALUES(in_app_enabled), email_enabled = VALUES(email_enabled)`,
        [id, companyId, userId, item.type, item.inApp ? 1 : 0, item.email ? 1 : 0]
      );
    }

    return this.getPreferences(companyId, userId);
  }

  /**
   * Crea una notificación para un usuario si tiene habilitada la preferencia correspondiente
   */
  static async createNotification(
    companyId: string,
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: Record<string, any> | null = null
  ): Promise<NotificationItem | null> {
    await this.ensureTables();

    try {
      // Verificar si el usuario tiene habilitada la notificación en la aplicación
      const prefRows = await query<any>(
        `SELECT in_app_enabled, email_enabled FROM user_notification_preferences WHERE company_id = ? AND user_id = ? AND notification_type = ?`,
        [companyId, userId, type]
      );

      const inAppEnabled = prefRows.length > 0 ? Boolean(prefRows[0].in_app_enabled) : true;
      const emailEnabled = prefRows.length > 0 ? Boolean(prefRows[0].email_enabled) : false;

      if (!inAppEnabled && !emailEnabled) {
        return null; // El usuario desactivó este tipo de notificación
      }

      let createdItem: NotificationItem | null = null;

      if (inAppEnabled) {
        const id = crypto.randomUUID();
        const jsonStr = data ? JSON.stringify(data) : null;

        await query(
          `INSERT INTO notifications (id, company_id, user_id, type, title, message, data, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
          [id, companyId, userId, type, title, message, jsonStr]
        );

        createdItem = {
          id,
          companyId,
          userId,
          type,
          title,
          message,
          data,
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
      }

      // Si tiene habilitado correo y existe información de email, logueamos el envío
      if (emailEnabled) {
        const userRows = await query<any>(`SELECT email, full_name FROM users WHERE id = ?`, [userId]);
        if (userRows.length > 0 && userRows[0].email) {
          const emailLogId = crypto.randomUUID();
          await query(
            `INSERT INTO email_logs (id, company_id, sender_user_id, sender_name, recipient_email, recipient_name, recipient_type, subject, body, report_title, status, created_at)
             VALUES (?, ?, NULL, 'Sistema ERO ERP', ?, ?, 'custom', ?, ?, ?, 'SENT', NOW())`,
            [emailLogId, companyId, userRows[0].email, userRows[0].full_name || 'Usuario', title, message, data?.reportTitle || null]
          );
        }
      }

      // Si se generó notificación en app, emitir evento en tiempo real
      if (createdItem) {
        try {
          const unreadCount = await this.getUnreadCount(companyId, userId);
          RealtimeService.emitToUser(userId, 'notification:new', {
            notification: createdItem,
            unreadCount,
          });
        } catch {
          // Silencioso
        }
      }

      return createdItem;
    } catch (err: any) {
      console.error('[NotificationsService] Error al crear notificación:', err.message);
      return null;
    }
  }

  /**
   * Comparte un reporte desde el visor a uno o varios usuarios del sistema
   */
  static async shareReport(
    companyId: string,
    senderUser: { id: string; name: string; email: string },
    input: ShareReportInput
  ): Promise<{ success: boolean; sharedCount: number; recipients: string[] }> {
    await this.ensureTables();

    const senderDisplayName = senderUser.name || senderUser.email;
    const recipients: string[] = [];

    for (const targetUserId of input.targetUserIds) {
      const title = `Reporte Compartido: ${input.reportTitle}`;
      let message = `${senderDisplayName} te ha compartido el reporte "${input.reportTitle}".`;
      if (input.message && input.message.trim()) {
        message += `\nNota: "${input.message.trim()}"`;
      }

      const notifData = {
        reportEndpoint: input.reportEndpoint,
        reportTitle: input.reportTitle,
        sharedBy: senderDisplayName,
        sharedByUserId: senderUser.id,
        note: input.message?.trim() || null,
        sharedAt: new Date().toISOString(),
      };

      await this.createNotification(
        companyId,
        targetUserId,
        'REPORT_SHARED',
        title,
        message,
        notifData
      );

      recipients.push(targetUserId);
    }

    // Registrar en auditoría
    try {
      await AuditService.recordEvent(companyId, {
        userId: senderUser.id,
        module: 'reports',
        action: 'share_report',
        entity: 'reports',
        entityId: input.reportTitle,
        afterJson: {
          reportTitle: input.reportTitle,
          reportEndpoint: input.reportEndpoint,
          recipientsCount: input.targetUserIds.length,
        },
      });
    } catch {}

    return {
      success: true,
      sharedCount: input.targetUserIds.length,
      recipients,
    };
  }

  /**
   * Envía un reporte por correo electrónico a clientes, proveedores o correos externos con el PDF adjunto
   */
  static async sendEmailReport(
    companyId: string,
    senderUser: { id: string; name: string; email: string },
    input: SendEmailReportInput,
    authToken?: string
  ): Promise<{ success: boolean; emailLogId: string; status: 'SENT' | 'SIMULATED' | 'FAILED'; recipientEmail: string; messageId?: string }> {
    await this.ensureTables();

    const emailLogId = crypto.randomUUID();
    const senderDisplayName = senderUser.name || senderUser.email;
    const config = await MailerService.getConfig(companyId);

    const defaultBody = `Estimado(a) ${input.recipientName},\n\nLe hacemos llegar el documento oficial correspondiente a "${input.reportTitle || 'Reporte Oficial'}" emitido por el sistema empresarial ERO ERP.\n\n${input.message ? `Mensaje adjunto:\n${input.message}\n\n` : ''}Para cualquier consulta, por favor comuníquese con nuestra administración.\n\nAtentamente,\n${senderDisplayName}\nERO ERP Enterprise`;

    const finalBody = input.message && input.message.trim() ? input.message.trim() : defaultBody;

    // Procesar adjuntos si se solicita PDF
    const attachments: MailAttachment[] = [];
    if (input.attachPdf !== false) {
      if (input.pdfBase64) {
        const cleanName = (input.pdfFilename || input.reportTitle || 'documento_oficial')
          .replace(/[^a-zA-Z0-9_\-.]/g, '_');
        attachments.push({
          filename: cleanName.endsWith('.pdf') ? cleanName : `${cleanName}.pdf`,
          content: Buffer.from(input.pdfBase64, 'base64'),
          contentType: 'application/pdf',
        });
      } else if (input.reportEndpoint) {
        try {
          const port = process.env.PORT || 3000;
          const fetchUrl = input.reportEndpoint.startsWith('http')
            ? input.reportEndpoint
            : `http://127.0.0.1:${port}${input.reportEndpoint}`;

          const res = await fetch(fetchUrl, {
            headers: authToken ? { Authorization: authToken } : {},
          });

          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const cleanName = (input.reportTitle || 'documento_oficial')
              .replace(/[^a-zA-Z0-9_\-.]/g, '_');
            attachments.push({
              filename: `${cleanName}.pdf`,
              content: Buffer.from(arrayBuffer),
              contentType: 'application/pdf',
            });
          }
        } catch (fetchErr: any) {
          console.warn('[NotificationsService] No se pudo obtener el PDF interno para adjuntar:', fetchErr.message);
        }
      }
    }

    const hasAttachments = attachments.length > 0;
    const attachmentsCount = attachments.length;
    const attachmentNames = attachments.map((a) => a.filename).join(', ');

    let status: 'SENT' | 'SIMULATED' | 'FAILED' = 'SENT';
    let errorMessage: string | null = null;
    let messageId: string | undefined = undefined;

    if (config.isConfigured) {
      try {
        const mailRes = await MailerService.sendMail({
          to: input.recipientEmail.trim(),
          toName: input.recipientName.trim(),
          subject: input.subject.trim(),
          text: finalBody,
          fromName: senderDisplayName,
          attachments: attachments.length > 0 ? attachments : undefined,
        }, companyId);
        messageId = mailRes.messageId;
        status = 'SENT';
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err.message || String(err);
      }
    } else {
      status = 'SIMULATED';
    }

    // SIEMPRE registrar en email_logs, tanto envíos exitosos como simulados o fallidos
    await query(
      `INSERT INTO email_logs (
        id, company_id, sender_user_id, sender_name, recipient_email, recipient_name,
        recipient_type, subject, body, report_title, status, error_message,
        has_attachments, attachments_count, attachment_names, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        emailLogId,
        companyId,
        senderUser.id,
        senderDisplayName,
        input.recipientEmail.trim().toLowerCase(),
        input.recipientName.trim(),
        input.recipientType,
        input.subject.trim(),
        finalBody,
        input.reportTitle || 'Reporte Oficial',
        status,
        errorMessage,
        hasAttachments ? 1 : 0,
        attachmentsCount,
        attachmentNames || null,
      ]
    );

    // Registro en auditoría
    try {
      await AuditService.recordEvent(companyId, {
        userId: senderUser.id,
        module: 'reports',
        action: 'send_email_report',
        entity: 'reports',
        entityId: emailLogId,
        afterJson: {
          reportTitle: input.reportTitle,
          recipientEmail: input.recipientEmail,
          recipientType: input.recipientType,
          status,
          hasAttachments,
          attachmentsCount,
          attachmentNames,
          errorMessage,
        },
      });
    } catch {}

    if (errorMessage && status === 'FAILED') {
      throw new Error(`Error en el servidor de correo SMTP: ${errorMessage}`);
    }

    return {
      success: true,
      emailLogId,
      status,
      recipientEmail: input.recipientEmail,
      messageId,
    };
  }

  /**
   * Envía un correo directo desde el Redactor de Emails dentro de la aplicación
   */
  static async sendDirectEmail(
    companyId: string,
    senderUser: { id: string; name: string; email: string },
    input: SendDirectEmailInput
  ): Promise<{ success: boolean; emailLogId: string; status: 'SENT' | 'SIMULATED' | 'FAILED'; recipientEmail: string; messageId?: string }> {
    await this.ensureTables();

    const emailLogId = crypto.randomUUID();
    const senderDisplayName = senderUser.name || senderUser.email;
    const config = await MailerService.getConfig(companyId);

    const attachments: MailAttachment[] = [];
    if (input.attachments && input.attachments.length > 0) {
      for (const att of input.attachments) {
        attachments.push({
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.contentType || 'application/octet-stream',
        });
      }
    }

    const hasAttachments = attachments.length > 0;
    const attachmentsCount = attachments.length;
    const attachmentNames = attachments.map((a) => a.filename).join(', ');

    let status: 'SENT' | 'SIMULATED' | 'FAILED' = 'SENT';
    let errorMessage: string | null = null;
    let messageId: string | undefined = undefined;

    if (config.isConfigured) {
      try {
        const mailRes = await MailerService.sendMail({
          to: input.recipientEmail.trim(),
          toName: input.recipientName?.trim(),
          cc: input.cc?.trim() || undefined,
          bcc: input.bcc?.trim() || undefined,
          subject: input.subject.trim(),
          text: input.message.trim(),
          fromName: senderDisplayName,
          attachments: attachments.length > 0 ? attachments : undefined,
        }, companyId);
        messageId = mailRes.messageId;
        status = 'SENT';
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err.message || String(err);
      }
    } else {
      status = 'SIMULATED';
    }

    await query(
      `INSERT INTO email_logs (
        id, company_id, sender_user_id, sender_name, recipient_email, recipient_name,
        recipient_type, subject, body, report_title, status, error_message,
        has_attachments, attachments_count, attachment_names, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        emailLogId,
        companyId,
        senderUser.id,
        senderDisplayName,
        input.recipientEmail.trim().toLowerCase(),
        input.recipientName?.trim() || input.recipientEmail.trim(),
        input.recipientType || 'custom',
        input.subject.trim(),
        input.message.trim(),
        'Mensaje Directo',
        status,
        errorMessage,
        hasAttachments ? 1 : 0,
        attachmentsCount,
        attachmentNames || null,
      ]
    );

    // Registro en auditoría
    try {
      await AuditService.recordEvent(companyId, {
        userId: senderUser.id,
        module: 'notifications',
        action: 'send_direct_email',
        entity: 'email_logs',
        entityId: emailLogId,
        afterJson: {
          recipientEmail: input.recipientEmail,
          subject: input.subject,
          status,
          hasAttachments,
          attachmentsCount,
          attachmentNames,
          errorMessage,
        },
      });
    } catch {}

    if (errorMessage && status === 'FAILED') {
      throw new Error(`Error al enviar correo vía SMTP: ${errorMessage}`);
    }

    return {
      success: true,
      emailLogId,
      status,
      recipientEmail: input.recipientEmail,
      messageId,
    };
  }

  /**
   * Obtiene el estado actual de la configuración del servidor de correo
   */
  static async getMailStatus(companyId?: string) {
    return MailerService.checkStatus(companyId);
  }

  /**
   * Obtiene el historial de correos enviados en la empresa
   */
  static async getEmailLogs(companyId: string, limit = 50): Promise<EmailLogItem[]> {
    await this.ensureTables();

    try {
      const rows = await query<any>(
        `SELECT id, company_id, sender_user_id, sender_name, recipient_email, recipient_name,
                recipient_type, subject, body, report_title, status, error_message,
                has_attachments, attachments_count, attachment_names, created_at
         FROM email_logs
         WHERE company_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [companyId, limit]
      );

      return rows.map((r: any) => {
        const attachmentNames = r.attachment_names
          ? r.attachment_names.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
        const hasAttachments = Boolean(r.has_attachments) || attachmentNames.length > 0;
        const attachmentsCount = r.attachments_count || (hasAttachments ? 1 : 0);
        const createdAtIso = r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString();

        return {
          id: r.id,
          companyId: r.company_id,
          senderUserId: r.sender_user_id,
          senderName: r.sender_name,
          recipientEmail: r.recipient_email || '',
          recipientName: r.recipient_name || '',
          recipientType: r.recipient_type,
          subject: r.subject || '',
          body: r.body,
          reportTitle: r.report_title,
          status: r.status,
          errorMessage: r.error_message,
          hasAttachments,
          attachmentsCount,
          attachmentNames,
          createdAt: createdAtIso,
          // Compatibilidad retroactiva snake_case
          recipient_email: r.recipient_email || '',
          recipient_name: r.recipient_name || '',
          report_title: r.report_title,
          error_message: r.error_message,
          sender_name: r.sender_name,
          created_at: createdAtIso,
          has_attachments: hasAttachments,
          attachments_count: attachmentsCount,
        };
      });
    } catch (error: any) {
      console.error('[NotificationsService] Error al obtener email logs:', error.message);
      return [];
    }
  }
}
