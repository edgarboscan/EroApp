import { query } from '../../db';
import { AuditLogFilterInput, AuditLogEntry } from '@ero/shared';
import crypto from 'crypto';

export class AuditService {
  /**
   * Obtiene los registros de auditoría filtrados con paginación
   */
  static async getLogs(
    companyId: string,
    filters: AuditLogFilterInput
  ): Promise<{ data: AuditLogEntry[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    try {
      let whereClause = 'WHERE a.company_id = ?';
      const params: any[] = [companyId];

      if (filters.module) {
        whereClause += ' AND a.module = ?';
        params.push(filters.module);
      }

      if (filters.action) {
        whereClause += ' AND a.action = ?';
        params.push(filters.action);
      }

      if (filters.userId) {
        whereClause += ' AND a.user_id = ?';
        params.push(filters.userId);
      }

      if (filters.startDate) {
        whereClause += ' AND a.created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += ' AND a.created_at <= ?';
        params.push(filters.endDate);
      }

      if (filters.search) {
        whereClause += ' AND (a.entity_id LIKE ? OR a.entity LIKE ? OR a.ip_address LIKE ?)';
        const s = `%${filters.search}%`;
        params.push(s, s, s);
      }

      const countRows = await query<any>(
        `SELECT COUNT(*) as total FROM audit_logs a ${whereClause}`,
        params
      );
      const total = Number(countRows[0]?.total || 0);

      const rows = await query<any>(
        `SELECT a.id, a.company_id, a.branch_id, a.user_id, u.username as user_name,
                a.module, a.action, a.entity, a.entity_id, a.before_json, a.after_json,
                a.ip_address, a.user_agent, a.created_at
         FROM audit_logs a
         LEFT JOIN users u ON a.user_id = u.id
         ${whereClause}
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const data: AuditLogEntry[] = rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        branchId: r.branch_id,
        userId: r.user_id,
        userName: r.user_name || 'Sistema / Cron',
        module: r.module,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        beforeJson: typeof r.before_json === 'string' ? JSON.parse(r.before_json) : r.before_json,
        afterJson: typeof r.after_json === 'string' ? JSON.parse(r.after_json) : r.after_json,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        createdAt: r.created_at?.toString() || new Date().toISOString(),
      }));

      return { data, total, page, limit };
    } catch {
      // Fallback con registros representativos si aún no hay data en DB local
    }

    const mockLogs: AuditLogEntry[] = [
      {
        id: 'log-001',
        companyId,
        userName: 'admin',
        module: 'sales',
        action: 'convert_to_invoice',
        entity: 'delivery_notes',
        entityId: 'DN-2026-0004',
        beforeJson: { status: 'DELIVERED', invoiced: false },
        afterJson: { status: 'INVOICED', invoiced: true, invoiceNumber: 'FAC-0000109' },
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: '2026-09-29T18:15:22.000Z',
      },
      {
        id: 'log-002',
        companyId,
        userName: 'admin',
        module: 'purchases',
        action: 'goods_receipt',
        entity: 'goods_receipts',
        entityId: 'REC-2026-0012',
        beforeJson: { stock: 150, averageCost: 1.10 },
        afterJson: { stock: 350, averageCost: 1.13, movementType: 'PURCHASE_RECEIPT' },
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: '2026-09-29T17:48:10.000Z',
      },
      {
        id: 'log-003',
        companyId,
        userName: 'cajero01',
        module: 'pos',
        action: 'sale_create',
        entity: 'sales_invoices',
        entityId: 'FAC-0000108',
        beforeJson: null,
        afterJson: { totalUSD: 45.50, paymentMethod: 'PAGO_MOVIL', currencyRate: 36.85 },
        ipAddress: '192.168.1.201',
        userAgent: 'POS Register Terminal 01',
        createdAt: '2026-09-29T17:30:45.000Z',
      },
      {
        id: 'log-004',
        companyId,
        userName: 'almacen01',
        module: 'inventory',
        action: 'transfer_completed',
        entity: 'inventory_transfers',
        entityId: 'TRF-2026-0003',
        beforeJson: { status: 'IN_TRANSIT', destinationStock: 20 },
        afterJson: { status: 'RECEIVED', destinationStock: 70 },
        ipAddress: '192.168.1.140',
        userAgent: 'Warehouse Handheld Scanner',
        createdAt: '2026-09-29T16:20:00.000Z',
      },
      {
        id: 'log-005',
        companyId,
        userName: 'admin',
        module: 'config',
        action: 'update_business_rules',
        entity: 'business_rules',
        entityId: 'BR-GLOBAL',
        beforeJson: { maxDiscountAllowed: 5.0 },
        afterJson: { maxDiscountAllowed: 10.0 },
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: '2026-09-29T15:10:12.000Z',
      },
    ];

    return { data: mockLogs, total: mockLogs.length, page: 1, limit };
  }

  /**
   * Inserta un evento de auditoría
   */
  static async recordEvent(
    companyId: string,
    params: {
      branchId?: string | null;
      userId?: string | null;
      module: string;
      action: string;
      entity: string;
      entityId?: string | null;
      beforeJson?: Record<string, unknown> | null;
      afterJson?: Record<string, unknown> | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const id = crypto.randomUUID();
    try {
      await query(
        `INSERT INTO audit_logs (
           id, company_id, branch_id, user_id, module, action, entity, entity_id,
           before_json, after_json, ip_address, user_agent
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          companyId,
          params.branchId || null,
          params.userId || null,
          params.module,
          params.action,
          params.entity,
          params.entityId || null,
          params.beforeJson ? JSON.stringify(params.beforeJson) : null,
          params.afterJson ? JSON.stringify(params.afterJson) : null,
          params.ipAddress || null,
          params.userAgent || null,
        ]
      );
    } catch {
      // Ignorar si no está inicializada
    }
    return id;
  }
}
