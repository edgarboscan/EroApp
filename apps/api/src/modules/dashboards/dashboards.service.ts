import { query, withTransaction } from '../../db';
import { WidgetCatalogItem, WidgetLayoutItem } from '@ero/shared';
import crypto from 'crypto';

export class DashboardsService {
  /**
   * Obtiene el catálogo de widgets disponibles filtrado por los permisos del usuario
   */
  static async getWidgetCatalog(userPermissions: string[], isSuperAdmin = false): Promise<WidgetCatalogItem[]> {
    const widgets = await query<any>(
      `SELECT id, code, module, title, description, type, config_json as configJson,
              default_width as defaultWidth, default_height as defaultHeight,
              required_permission as requiredPermission, is_default as isDefault
       FROM dashboard_widgets
       ORDER BY module, title`
    );

    if (isSuperAdmin) return widgets;

    return widgets.filter((w) => userPermissions.includes(w.requiredPermission));
  }

  /**
   * Obtiene el dashboard activo del usuario o genera uno automático según sus permisos
   */
  static async getUserDashboard(userId: string, companyId: string, userPermissions: string[], isSuperAdmin = false) {
    // 1. Buscar si el usuario tiene un dashboard guardado
    const dashboards = await query<any>(
      `SELECT id, name FROM dashboards WHERE user_id = ? AND is_default = 1 LIMIT 1`,
      [userId]
    );

    let dashboardId = dashboards[0]?.id;
    let items: WidgetLayoutItem[] = [];

    if (dashboardId) {
      // Cargar items guardados
      const layoutRows = await query<any>(
        `SELECT dl.widget_id as widgetId, w.code as widgetCode, dl.pos_x as x, dl.pos_y as y,
                dl.width as w, dl.height as h, w.required_permission
         FROM dashboard_layout dl
         INNER JOIN dashboard_widgets w ON dl.widget_id = w.id
         WHERE dl.dashboard_id = ?
         ORDER BY dl.pos_y ASC, dl.pos_x ASC`,
        [dashboardId]
      );

      // Filtrar items a los que el usuario aún tenga permiso
      items = layoutRows
        .filter((r) => isSuperAdmin || userPermissions.includes(r.required_permission))
        .map((r) => ({
          widgetId: r.widgetId,
          widgetCode: r.widgetCode,
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
        }));
    }

    // Fallback: Si no tiene items o no tiene dashboard, auto-generar uno con los widgets por defecto permitidos
    if (items.length === 0) {
      const allowedWidgets = await this.getWidgetCatalog(userPermissions, isSuperAdmin);
      let curX = 0;
      let curY = 0;

      items = allowedWidgets.map((w) => {
        const item: WidgetLayoutItem = {
          widgetId: w.id,
          widgetCode: w.code,
          x: curX,
          y: curY,
          w: w.defaultWidth,
          h: w.defaultHeight,
        };

        curX += w.defaultWidth;
        if (curX >= 12) {
          curX = 0;
          curY += w.defaultHeight;
        }
        return item;
      });
    }

    return {
      dashboardId: dashboardId || 'default-auto',
      name: dashboards[0]?.name || 'Dashboard Principal',
      items,
    };
  }

  /**
   * Guarda o actualiza el layout personalizado del dashboard del usuario
   */
  static async saveUserDashboard(userId: string, companyId: string, name: string, items: WidgetLayoutItem[]) {
    return await withTransaction(async (conn) => {
      // 1. Obtener o crear el registro en `dashboards`
      const [existing]: any = await conn.query(
        `SELECT id FROM dashboards WHERE user_id = ? AND is_default = 1 LIMIT 1`,
        [userId]
      );

      let dashboardId = existing[0]?.id;

      if (!dashboardId) {
        dashboardId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO dashboards (id, company_id, name, scope, user_id, is_default)
           VALUES (?, ?, ?, 'user', ?, 1)`,
          [dashboardId, companyId, name, userId]
        );
      } else {
        await conn.query(`UPDATE dashboards SET name = ? WHERE id = ?`, [name, dashboardId]);
      }

      // 2. Limpiar layout anterior
      await conn.query(`DELETE FROM dashboard_layout WHERE dashboard_id = ?`, [dashboardId]);

      // 3. Insertar nuevos items
      for (const it of items) {
        await conn.query(
          `INSERT INTO dashboard_layout (id, dashboard_id, widget_id, pos_x, pos_y, width, height)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), dashboardId, it.widgetId, it.x, it.y, it.w, it.h]
        );
      }

      return { dashboardId, name, itemsCount: items.length };
    });
  }

  /**
   * Obtiene la data en vivo para un widget específico
   */
  static async getWidgetData(code: string, branchId?: string) {
    switch (code) {
      case 'WIDGET_SALES_TODAY': {
        const rows = await query<any>(
          `SELECT COALESCE(SUM(total_amount), 0) AS totalUSD,
                  COALESCE(SUM(total_amount * exchange_rate), 0) AS totalVES,
                  COUNT(id) AS countInvoices
           FROM sales_invoices
           WHERE DATE(invoice_date) = CURRENT_DATE() AND status <> 'ANNULLED'
             AND (? IS NULL OR branch_id = ?)`,
          [branchId, branchId]
        );
        return {
          title: 'Ventas de Hoy',
          totalUSD: Number(rows[0]?.totalUSD || 0).toFixed(2),
          totalVES: Number(rows[0]?.totalVES || 0).toFixed(2),
          invoicesCount: rows[0]?.countInvoices || 0,
        };
      }

      case 'WIDGET_TICKET_AVG': {
        const rows = await query<any>(
          `SELECT COALESCE(AVG(total_amount), 0) AS avgTicketUSD
           FROM sales_invoices
           WHERE invoice_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status <> 'ANNULLED'
             AND (? IS NULL OR branch_id = ?)`,
          [branchId, branchId]
        );
        return {
          title: 'Ticket Promedio (7 días)',
          avgTicketUSD: Number(rows[0]?.avgTicketUSD || 0).toFixed(2),
        };
      }

      case 'WIDGET_CRITICAL_STOCK': {
        const rows = await query<any>(
          `SELECT p.sku, p.name, p.min_stock AS minStock, ps.current_stock AS currentStock, w.name AS warehouseName
           FROM products p
           INNER JOIN product_stocks ps ON p.id = ps.product_id
           INNER JOIN warehouses w ON ps.warehouse_id = w.id
           WHERE ps.current_stock <= p.min_stock AND p.is_active = 1
           ORDER BY ps.current_stock ASC
           LIMIT 10`
        );
        return {
          title: 'Productos en Stock Crítico',
          items: rows,
        };
      }

      case 'WIDGET_CXC_AGING': {
        const rows = await query<any>(
          `SELECT 
             SUM(current_due) AS currentDue,
             SUM(days_1_30) AS days1to30,
             SUM(days_31_60) AS days31to60,
             SUM(days_61_90) AS days61to90,
             SUM(days_90_plus) AS days90Plus
           FROM v_cxc_aging
           WHERE (? IS NULL OR branch_id = ?)`,
          [branchId, branchId]
        );
        const data = rows[0] || {};
        return {
          title: 'Distribución CxC',
          series: [
            { name: 'Al Día', value: Number(data.currentDue || 0) },
            { name: '1-30 Días', value: Number(data.days1to30 || 0) },
            { name: '31-60 Días', value: Number(data.days31to60 || 0) },
            { name: '61-90 Días', value: Number(data.days61to90 || 0) },
            { name: '+90 Días', value: Number(data.days90Plus || 0) },
          ],
        };
      }

      case 'WIDGET_TAX_SUMMARY': {
        const rows = await query<any>(
          `SELECT 
             COALESCE(SUM(tax_amount), 0) AS totalIVA,
             COALESCE(SUM(igtf_amount), 0) AS totalIGTF
           FROM sales_invoices
           WHERE MONTH(invoice_date) = MONTH(CURRENT_DATE())
             AND YEAR(invoice_date) = YEAR(CURRENT_DATE())
             AND status <> 'ANNULLED'
             AND (? IS NULL OR branch_id = ?)`,
          [branchId, branchId]
        );
        return {
          title: 'Impuestos Facturados del Mes',
          ivaTotalUSD: Number(rows[0]?.totalIVA || 0).toFixed(2),
          igtfTotalUSD: Number(rows[0]?.totalIGTF || 0).toFixed(2),
        };
      }

      default:
        return {
          title: code,
          message: 'Widget data placeholder',
          updatedAt: new Date().toISOString(),
        };
    }
  }
}
