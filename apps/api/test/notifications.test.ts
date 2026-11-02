import { describe, it, expect, beforeAll } from 'vitest';
import {
  shareReportSchema,
  sendEmailReportSchema,
  updateNotificationPreferencesSchema,
  notificationTypes,
} from '@ero/shared';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('Módulo de Notificaciones y Envío de Reportes (Paso 9)', () => {
  const companyId = 'c1111111-1111-1111-1111-111111111111';
  const userId = 'u1111111-1111-1111-1111-111111111111';
  const targetUserId = 'u2222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    await NotificationsService.ensureTables();
    const { query } = await import('../src/db');
    await query(`DELETE FROM notifications WHERE user_id IN (?, ?)`, [userId, targetUserId]);
    await query(`DELETE FROM user_notification_preferences WHERE user_id IN (?, ?)`, [userId, targetUserId]);
  });

  describe('Validación de Esquemas Zod', () => {
    it('debe validar un payload correcto para compartir reporte', () => {
      const res = shareReportSchema.safeParse({
        targetUserIds: [targetUserId],
        reportTitle: 'Cierres de Caja & Arqueos (X / Z)',
        reportEndpoint: '/api/reports/cash-shifts/pdf?from=2026-10-01&to=2026-10-31',
        message: 'Por favor auditar diferencias de turnos de la sucursal Caracas',
      });
      expect(res.success).toBe(true);
    });

    it('debe rechazar compartir reporte sin usuarios destinatarios', () => {
      const res = shareReportSchema.safeParse({
        targetUserIds: [],
        reportTitle: 'Ventas por Producto',
        reportEndpoint: '/api/reports/sales-by-product/pdf',
      });
      expect(res.success).toBe(false);
    });

    it('debe validar un payload correcto para enviar reporte por correo', () => {
      const res = sendEmailReportSchema.safeParse({
        recipientEmail: 'cliente@corporacion.com',
        recipientName: 'Inversiones Los Andes C.A.',
        recipientType: 'customer',
        subject: 'Reporte Estado de Cuenta - ERO ERP',
        message: 'Adjunto enviamos su relación de facturas y notas de entrega del mes.',
        reportEndpoint: '/api/customers/c123/statement/pdf',
        reportTitle: 'Estado de Cuenta Cliente',
        attachPdf: true,
      });
      expect(res.success).toBe(true);
    });

    it('debe rechazar correo electrónico con formato inválido', () => {
      const res = sendEmailReportSchema.safeParse({
        recipientEmail: 'correo-no-valido',
        recipientName: 'Proveedor Prueba',
        recipientType: 'supplier',
        subject: 'Orden de Compra',
        reportEndpoint: '/api/purchases/orders/1/pdf',
        reportTitle: 'Orden de Compra',
      });
      expect(res.success).toBe(false);
    });

    it('debe validar actualización de preferencias de notificación', () => {
      const res = updateNotificationPreferencesSchema.safeParse({
        preferences: [
          { type: 'REPORT_SHARED', inApp: true, email: true },
          { type: 'LOW_STOCK', inApp: true, email: false },
          { type: 'CASH_SHIFT_CLOSED', inApp: false, email: false },
        ],
      });
      expect(res.success).toBe(true);
    });
  });

  describe('Servicio de Notificaciones y Preferencias en Base de Datos', () => {
    it('debe obtener y actualizar preferencias de notificación por usuario', async () => {
      const updated = await NotificationsService.updatePreferences(companyId, userId, [
        { type: 'REPORT_SHARED', inApp: true, email: true },
        { type: 'LOW_STOCK', inApp: true, email: false },
      ]);

      expect(Array.isArray(updated)).toBe(true);
      expect(updated.length).toBe(notificationTypes.length);

      const reportPref = updated.find((p) => p.type === 'REPORT_SHARED');
      expect(reportPref?.inApp).toBe(true);
      expect(reportPref?.email).toBe(true);
    });

    it('debe crear y listar notificaciones internas para un usuario', async () => {
      const notif = await NotificationsService.createNotification(
        companyId,
        userId,
        'SYSTEM',
        'Bienvenido a ERO ERP',
        'Sistema de notificaciones activado exitosamente.',
        { version: '1.0.0' }
      );

      expect(notif).not.toBeNull();
      if (notif) {
        expect(notif.title).toBe('Bienvenido a ERO ERP');
        expect(notif.isRead).toBe(false);

        // Contador de no leídas
        const count = await NotificationsService.getUnreadCount(companyId, userId);
        expect(count).toBeGreaterThan(0);

        // Marcar como leída
        const readOk = await NotificationsService.markAsRead(companyId, userId, notif.id);
        expect(readOk).toBe(true);
      }
    });

    it('debe compartir un reporte a un usuario y registrar la notificación con metadata', async () => {
      const sender = {
        id: userId,
        name: 'Administrador Demo',
        email: 'admin@erove.com',
      };

      const shareResult = await NotificationsService.shareReport(companyId, sender, {
        targetUserIds: [targetUserId],
        reportTitle: 'Ranking de Ventas por Producto',
        reportEndpoint: '/api/reports/sales-by-product/pdf?from=2026-10-01&to=2026-10-31',
        message: 'Revisar productos con baja rotación en el almacén central',
      });

      expect(shareResult.success).toBe(true);
      expect(shareResult.sharedCount).toBe(1);

      // El usuario destino debe tener la notificación
      const targetNotifs = await NotificationsService.getNotifications(companyId, targetUserId, true);
      const sharedNotif = targetNotifs.find((n) => n.type === 'REPORT_SHARED');
      expect(sharedNotif).toBeDefined();
      expect(sharedNotif?.data?.reportEndpoint).toBe('/api/reports/sales-by-product/pdf?from=2026-10-01&to=2026-10-31');
      expect(sharedNotif?.data?.sharedBy).toBe('Administrador Demo');
    });

    it('debe registrar el envío de un reporte por correo y consultar el historial de email logs', async () => {
      const sender = {
        id: userId,
        name: 'Administrador Demo',
        email: 'admin@erove.com',
      };

      const emailResult = await NotificationsService.sendEmailReport(companyId, sender, {
        recipientEmail: 'proveedor@distribuidora.com',
        recipientName: 'Distribuidora Alimentos Polar C.A.',
        recipientType: 'supplier',
        subject: 'Comprobante de Retención IVA / ISLR',
        message: 'Estimados, adjuntamos comprobante legal de retención correspondiente a su factura.',
        reportEndpoint: '/api/taxes/withholdings/ret-001/pdf',
        reportTitle: 'Comprobante de Retención IVA',
        attachPdf: true,
      });

      expect(emailResult.success).toBe(true);
      expect(emailResult.recipientEmail).toBe('proveedor@distribuidora.com');
      expect(['SENT', 'SIMULATED']).toContain(emailResult.status);

      // Consultar historial de correos
      const logs = await NotificationsService.getEmailLogs(companyId, 10);
      expect(Array.isArray(logs)).toBe(true);
      const polarLog = logs.find((l) => l.recipientEmail === 'proveedor@distribuidora.com');
      expect(polarLog).toBeDefined();
      expect(polarLog?.recipientType).toBe('supplier');
      expect(polarLog?.reportTitle).toBe('Comprobante de Retención IVA');
    });
  });
});

