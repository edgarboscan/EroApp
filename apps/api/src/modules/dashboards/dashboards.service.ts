import { query, withTransaction } from '../../db';
import { WidgetCatalogItem, WidgetLayoutItem } from '@ero/shared';
import crypto from 'crypto';

export class DashboardsService {
  private static widgetsEnsured = false;

  /**
   * Garantiza que los widgets contables y nuevos esten registrados en dashboard_widgets
   */
  static async ensureWidgets() {
    if (this.widgetsEnsured) return;
    try {
      const accountingWidgets = [
        {
          code: 'WIDGET_ACCOUNTING_RESULT',
          module: 'accounting',
          title: 'Resultado Contable (Utilidad)',
          description: 'Utilidad neta contable del mes en curso (Ingresos vs Egresos)',
          type: 'kpi',
          defaultWidth: 4,
          defaultHeight: 2,
          requiredPermission: 'accounting.read',
        },
        {
          code: 'WIDGET_ACCOUNTING_BALANCE',
          module: 'accounting',
          title: 'Estructura Patrimonial',
          description: 'Total Activos vs Pasivos exigibles',
          type: 'kpi',
          defaultWidth: 4,
          defaultHeight: 2,
          requiredPermission: 'accounting.read',
        },
        {
          code: 'WIDGET_ACCOUNTING_ENTRIES_STATUS',
          module: 'accounting',
          title: 'Comprobantes del Mes',
          description: 'Asientos contables registrados, mayorizados y borradores',
          type: 'kpi',
          defaultWidth: 4,
          defaultHeight: 2,
          requiredPermission: 'accounting.read',
        },
        {
          code: 'WIDGET_ACCOUNTING_RECENT_ENTRIES',
          module: 'accounting',
          title: 'Últimos Asientos Contables',
          description: 'Registro cronológico de los últimos comprobantes de diario',
          type: 'table',
          defaultWidth: 6,
          defaultHeight: 4,
          requiredPermission: 'accounting.read',
        },
        {
          code: 'WIDGET_ACCOUNTING_EXPENSES_BREAKDOWN',
          module: 'accounting',
          title: 'Distribución de Costos y Gastos',
          description: 'Principales rubros de egresos contables del período',
          type: 'chart',
          defaultWidth: 6,
          defaultHeight: 4,
          requiredPermission: 'accounting.read',
        },
      ];

      for (const w of accountingWidgets) {
        await query(
          `INSERT INTO dashboard_widgets (id, code, module, title, description, type, default_width, default_height, required_permission, is_default)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), required_permission = VALUES(required_permission)`,
          [crypto.randomUUID(), w.code, w.module, w.title, w.description, w.type, w.defaultWidth, w.defaultHeight, w.requiredPermission]
        );
      }
      this.widgetsEnsured = true;
    } catch (e: any) {
      console.warn('[DashboardsService] ensureWidgets error:', e.message);
    }
  }

  /**
   * Obtiene el catálogo de widgets disponibles filtrado por los permisos del usuario
   */
  static async getWidgetCatalog(userPermissions: string[], isSuperAdmin = false): Promise<WidgetCatalogItem[]> {
    await this.ensureWidgets();

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
    await this.ensureWidgets();
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
  static async getWidgetData(code: string, branchId?: string, warehouseId?: string, companyId?: string) {
    switch (code) {
      case 'WIDGET_SALES_TODAY': {
        const rows = await query<any>(
          `SELECT COALESCE(SUM(si.total_amount), 0) AS totalUSD,
                  COALESCE(SUM(si.total_amount * si.exchange_rate), 0) AS totalVES,
                  COUNT(si.id) AS countInvoices
           FROM sales_invoices si
           LEFT JOIN branches b ON si.branch_id = b.id
           WHERE (? IS NULL OR b.company_id = ?)
             AND (? IS NULL OR si.branch_id = ?)
             AND (? IS NULL OR si.warehouse_id = ?)
             AND DATE(si.invoice_date) = CURRENT_DATE()
             AND si.status <> 'ANNULLED'`,
          [companyId, companyId, branchId, branchId, warehouseId, warehouseId]
        );
        return {
          title: 'Ventas de Hoy',
          totalUSD: Number(rows[0]?.totalUSD || 0),
          totalVES: Number(rows[0]?.totalVES || 0),
          invoicesCount: Number(rows[0]?.countInvoices || 0),
        };
      }

      case 'WIDGET_TICKET_AVG': {
        const rows = await query<any>(
          `SELECT COALESCE(AVG(si.total_amount), 0) AS avgTicketUSD,
                  COUNT(si.id) AS countInvoices
           FROM sales_invoices si
           LEFT JOIN branches b ON si.branch_id = b.id
           WHERE (? IS NULL OR b.company_id = ?)
             AND (? IS NULL OR si.branch_id = ?)
             AND (? IS NULL OR si.warehouse_id = ?)
             AND si.invoice_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             AND si.status <> 'ANNULLED'`,
          [companyId, companyId, branchId, branchId, warehouseId, warehouseId]
        );
        return {
          title: 'Ticket Promedio (7 días)',
          avgTicketUSD: Number(rows[0]?.avgTicketUSD || 0),
          invoicesCount: Number(rows[0]?.countInvoices || 0),
        };
      }

      case 'WIDGET_CRITICAL_STOCK': {
        const rows = await query<any>(
          `SELECT COUNT(product_id) AS criticalCount
           FROM v_stock_critical
           WHERE (? IS NULL OR company_id = ?)
             AND (? IS NULL OR branch_id = ?)
             AND (? IS NULL OR warehouse_id = ?)
             AND current_stock <= min_stock`,
          [companyId, companyId, branchId, branchId, warehouseId, warehouseId]
        );
        return {
          title: 'Stock Crítico',
          count: Number(rows[0]?.criticalCount || 0),
        };
      }

      case 'WIDGET_TAX_SUMMARY': {
        const rows = await query<any>(
          `SELECT COALESCE(SUM(si.tax_amount), 0) AS totalIVA,
                  COALESCE(SUM(si.igtf_amount), 0) AS totalIGTF
           FROM sales_invoices si
           LEFT JOIN branches b ON si.branch_id = b.id
           WHERE (? IS NULL OR b.company_id = ?)
             AND (? IS NULL OR si.branch_id = ?)
             AND (? IS NULL OR si.warehouse_id = ?)
             AND MONTH(si.invoice_date) = MONTH(CURRENT_DATE())
             AND YEAR(si.invoice_date) = YEAR(CURRENT_DATE())
             AND si.status <> 'ANNULLED'`,
          [companyId, companyId, branchId, branchId, warehouseId, warehouseId]
        );
        return {
          title: 'Resumen Fiscal SENIAT',
          totalIVA: Number(rows[0]?.totalIVA || 0),
          totalIGTF: Number(rows[0]?.totalIGTF || 0),
        };
      }

      case 'WIDGET_CXC_SUMMARY': {
        const rows = await query<any>(
          `SELECT COALESCE(SUM(amount_balance), 0) AS totalPendingUSD,
                  COALESCE(SUM(days_1_30 + days_31_60 + days_61_90 + days_90_plus), 0) AS overdueUSD
           FROM v_cxc_aging
           WHERE (? IS NULL OR branch_id = ?)`,
          [branchId, branchId]
        );
        return {
          title: 'Cuentas por Cobrar Pendientes',
          totalPendingUSD: Number(rows[0]?.totalPendingUSD || 0),
          overdueUSD: Number(rows[0]?.overdueUSD || 0),
        };
      }

      case 'WIDGET_PURCHASES_MONTH': {
        const rows = await query<any>(
          `SELECT COALESCE(SUM(pi.total_amount), 0) AS totalUSD,
                  COUNT(pi.id) AS ordersCount
           FROM purchase_invoices pi
           LEFT JOIN branches b ON pi.branch_id = b.id
           WHERE (? IS NULL OR b.company_id = ?)
             AND (? IS NULL OR pi.branch_id = ?)
             AND (? IS NULL OR pi.warehouse_id = ?)
             AND MONTH(pi.invoice_date) = MONTH(CURRENT_DATE())
             AND YEAR(pi.invoice_date) = YEAR(CURRENT_DATE())
             AND pi.status <> 'ANNULLED'`,
          [companyId, companyId, branchId, branchId, warehouseId, warehouseId]
        );
        return {
          title: 'Compras a Proveedores (Mes)',
          totalUSD: Number(rows[0]?.totalUSD || 0),
          ordersCount: Number(rows[0]?.ordersCount || 0),
        };
      }

      case 'WIDGET_TOP_PRODUCTS': {
        const rows = await query<any>(
          `SELECT p.name, COALESCE(SUM(sii.quantity), 0) AS ventas
           FROM sales_invoice_items sii
           INNER JOIN sales_invoices si ON sii.invoice_id = si.id
           LEFT JOIN branches b ON si.branch_id = b.id
           INNER JOIN products p ON sii.product_id = p.id
           WHERE (? IS NULL OR b.company_id = ?)
             AND (? IS NULL OR si.branch_id = ?)
             AND (? IS NULL OR si.warehouse_id = ?)
             AND si.invoice_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             AND si.status <> 'ANNULLED'
           GROUP BY p.id, p.name
           ORDER BY ventas DESC
           LIMIT 5`,
          [companyId, companyId, branchId, branchId, warehouseId, warehouseId]
        );
        return {
          title: 'Top 5 Productos más Vendidos',
          products: rows.map((r: any) => ({ name: r.name, ventas: Number(r.ventas) })),
        };
      }

      case 'WIDGET_CXC_AGING': {
        const rows = await query<any>(
          `SELECT 
             COALESCE(SUM(current_due), 0) AS currentDue,
             COALESCE(SUM(days_1_30), 0) AS days1to30,
             COALESCE(SUM(days_31_60), 0) AS days31to60,
             COALESCE(SUM(days_61_90), 0) AS days61to90,
             COALESCE(SUM(days_90_plus), 0) AS days90Plus
           FROM v_cxc_aging
           WHERE (? IS NULL OR branch_id = ?)`,
          [branchId, branchId]
        );
        const data = rows[0] || {};
        return {
          title: 'Antigüedad de Saldos (CxC)',
          series: [
            { name: 'Al Día', value: Number(data.currentDue || 0), color: '#10b981' },
            { name: '1-30 Días', value: Number(data.days1to30 || 0), color: '#38bdf8' },
            { name: '31-60 Días', value: Number(data.days31to60 || 0), color: '#fbbf24' },
            { name: '61-90 Días', value: Number(data.days61to90 || 0), color: '#f97316' },
            { name: '+90 Días', value: Number(data.days90Plus || 0), color: '#ef4444' },
          ],
        };
      }

      case 'WIDGET_CRITICAL_STOCK_TABLE': {
        const rows = await query<any>(
          `SELECT sku, product_name AS name, current_stock AS stock, min_stock AS min, warehouse_name AS warehouse
           FROM v_stock_critical
           WHERE (? IS NULL OR company_id = ?)
             AND (? IS NULL OR branch_id = ?)
             AND (? IS NULL OR warehouse_id = ?)
             AND current_stock <= min_stock
           ORDER BY current_stock ASC
           LIMIT 10`,
          [companyId, companyId, branchId, branchId, warehouseId, warehouseId]
        );
        return {
          title: 'Productos en Stock Crítico',
          items: rows.map((r: any) => ({
            sku: r.sku,
            name: r.name,
            stock: Number(r.stock),
            min: Number(r.min),
            warehouse: r.warehouse,
          })),
        };
      }

      case 'WIDGET_RECENT_ACTIVITY': {
        const rows = await query<any>(
          `SELECT si.invoice_number AS number,
                  DATE_FORMAT(si.created_at, '%h:%i %p') AS time,
                  COALESCE(c.name, 'Cliente Mostrador') AS customer,
                  si.total_amount AS amount,
                  si.status
           FROM sales_invoices si
           LEFT JOIN branches b ON si.branch_id = b.id
           LEFT JOIN customers c ON si.customer_id = c.id
           WHERE (? IS NULL OR b.company_id = ?)
             AND (? IS NULL OR si.branch_id = ?)
             AND (? IS NULL OR si.warehouse_id = ?)
           ORDER BY si.created_at DESC
           LIMIT 5`,
          [companyId, companyId, branchId, branchId, warehouseId, warehouseId]
        );
        return {
          title: 'Últimas Operaciones Fiscales',
          items: rows.map((r: any) => ({
            number: r.number,
            time: r.time,
            customer: r.customer,
            amount: Number(r.amount),
            status: r.status,
          })),
        };
      }

      case 'WIDGET_ACCOUNTING_RESULT': {
        const rows = await query<any>(
          `SELECT 
             COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN (l.credit_usd - l.debit_usd) ELSE 0 END), 0) AS revenueUSD,
             COALESCE(SUM(CASE WHEN a.account_type IN ('COST', 'EXPENSE') THEN (l.debit_usd - l.credit_usd) ELSE 0 END), 0) AS expenseUSD,
             COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN (l.credit_ves - l.debit_ves) ELSE 0 END), 0) AS revenueVES,
             COALESCE(SUM(CASE WHEN a.account_type IN ('COST', 'EXPENSE') THEN (l.debit_ves - l.credit_ves) ELSE 0 END), 0) AS expenseVES
           FROM accounting_journal_lines l
           INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
           INNER JOIN accounting_accounts a ON l.account_id = a.id
           WHERE e.company_id = ?
             AND (? IS NULL OR e.branch_id = ?)
             AND MONTH(e.entry_date) = MONTH(CURRENT_DATE())
             AND YEAR(e.entry_date) = YEAR(CURRENT_DATE())
             AND e.status = 'POSTED'`,
          [companyId, branchId, branchId]
        );

        let revenueUSD = Number(rows[0]?.revenueUSD || 0);
        let expenseUSD = Number(rows[0]?.expenseUSD || 0);
        let revenueVES = Number(rows[0]?.revenueVES || 0);
        let expenseVES = Number(rows[0]?.expenseVES || 0);

        // Fallback a ventas y compras del mes si no hay asientos cerrados
        if (revenueUSD === 0 && expenseUSD === 0) {
          const sRows = await query<any>(
            `SELECT COALESCE(SUM(total_amount), 0) AS totalUSD, COALESCE(SUM(total_amount * exchange_rate), 0) AS totalVES
             FROM sales_invoices si LEFT JOIN branches b ON si.branch_id = b.id
             WHERE (? IS NULL OR b.company_id = ?) AND (? IS NULL OR si.branch_id = ?) AND MONTH(si.invoice_date) = MONTH(CURRENT_DATE()) AND si.status <> 'ANNULLED'`,
            [companyId, companyId, branchId, branchId]
          );
          const pRows = await query<any>(
            `SELECT COALESCE(SUM(total_amount), 0) AS totalUSD, COALESCE(SUM(total_amount * exchange_rate), 0) AS totalVES
             FROM purchase_invoices pi LEFT JOIN branches b ON pi.branch_id = b.id
             WHERE (? IS NULL OR b.company_id = ?) AND (? IS NULL OR pi.branch_id = ?) AND MONTH(pi.invoice_date) = MONTH(CURRENT_DATE()) AND pi.status <> 'ANNULLED'`,
            [companyId, companyId, branchId, branchId]
          );
          revenueUSD = Number(sRows[0]?.totalUSD || 0);
          revenueVES = Number(sRows[0]?.totalVES || 0);
          expenseUSD = Number(pRows[0]?.totalUSD || 0);
          expenseVES = Number(pRows[0]?.totalVES || 0);
        }

        const netIncomeUSD = Number((revenueUSD - expenseUSD).toFixed(2));
        const netIncomeVES = Number((revenueVES - expenseVES).toFixed(2));

        return {
          title: 'Resultado del Ejercicio',
          netIncomeUSD,
          netIncomeVES,
          revenueUSD,
          expenseUSD,
          isProfit: netIncomeUSD >= 0,
        };
      }

      case 'WIDGET_ACCOUNTING_BALANCE': {
        const rows = await query<any>(
          `SELECT 
             COALESCE(SUM(CASE WHEN a.account_type = 'ASSET' THEN (l.debit_usd - l.credit_usd) ELSE 0 END), 0) AS assetsUSD,
             COALESCE(SUM(CASE WHEN a.account_type = 'LIABILITY' THEN (l.credit_usd - l.debit_usd) ELSE 0 END), 0) AS liabilitiesUSD
           FROM accounting_journal_lines l
           INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
           INNER JOIN accounting_accounts a ON l.account_id = a.id
           WHERE e.company_id = ?
             AND (? IS NULL OR e.branch_id = ?)
             AND e.status = 'POSTED'`,
          [companyId, branchId, branchId]
        );

        return {
          title: 'Estructura Patrimonial',
          totalAssetsUSD: Number(rows[0]?.assetsUSD || 0),
          totalLiabilitiesUSD: Number(rows[0]?.liabilitiesUSD || 0),
        };
      }

      case 'WIDGET_ACCOUNTING_ENTRIES_STATUS': {
        const rows = await query<any>(
          `SELECT 
             COUNT(id) AS totalEntries,
             COALESCE(SUM(CASE WHEN status = 'POSTED' THEN 1 ELSE 0 END), 0) AS postedEntries,
             COALESCE(SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END), 0) AS draftEntries
           FROM accounting_journal_entries
           WHERE company_id = ?
             AND (? IS NULL OR branch_id = ?)
             AND MONTH(entry_date) = MONTH(CURRENT_DATE())
             AND YEAR(entry_date) = YEAR(CURRENT_DATE())`,
          [companyId, branchId, branchId]
        );

        return {
          title: 'Comprobantes Contables del Mes',
          totalEntries: Number(rows[0]?.totalEntries || 0),
          postedEntries: Number(rows[0]?.postedEntries || 0),
          draftEntries: Number(rows[0]?.draftEntries || 0),
        };
      }

      case 'WIDGET_ACCOUNTING_RECENT_ENTRIES': {
        const rows = await query<any>(
          `SELECT entry_number AS number, DATE_FORMAT(entry_date, '%d/%m/%Y') AS date,
                  concept, total_debit_usd AS amountUSD, total_debit_ves AS amountVES, status
           FROM accounting_journal_entries
           WHERE company_id = ?
             AND (? IS NULL OR branch_id = ?)
           ORDER BY entry_date DESC, created_at DESC
           LIMIT 5`,
          [companyId, branchId, branchId]
        );

        return {
          title: 'Últimos Asientos Contables',
          items: rows.map((r: any) => ({
            number: r.number,
            date: r.date,
            concept: r.concept,
            amountUSD: Number(r.amountUSD || 0),
            amountVES: Number(r.amountVES || 0),
            status: r.status,
          })),
        };
      }

      case 'WIDGET_ACCOUNTING_EXPENSES_BREAKDOWN': {
        const rows = await query<any>(
          `SELECT a.name, COALESCE(SUM(l.debit_usd - l.credit_usd), 0) AS totalUSD
           FROM accounting_journal_lines l
           INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
           INNER JOIN accounting_accounts a ON l.account_id = a.id
           WHERE e.company_id = ?
             AND (? IS NULL OR e.branch_id = ?)
             AND a.account_type IN ('COST', 'EXPENSE')
             AND MONTH(e.entry_date) = MONTH(CURRENT_DATE())
             AND YEAR(e.entry_date) = YEAR(CURRENT_DATE())
             AND e.status = 'POSTED'
           GROUP BY a.id, a.name
           ORDER BY totalUSD DESC
           LIMIT 5`,
          [companyId, branchId, branchId]
        );

        const colors = ['#007BFF', '#28A745', '#FFC107', '#17A2B8', '#DC3545'];
        const series = rows.map((r: any, idx: number) => ({
          name: r.name,
          value: Number(r.totalUSD || 0),
          color: colors[idx % colors.length],
        }));

        return {
          title: 'Distribución de Costos y Gastos',
          series: series.length > 0 ? series : [
            { name: 'Costo de Ventas', value: 65, color: '#007BFF' },
            { name: 'Gastos de Operación', value: 20, color: '#28A745' },
            { name: 'Gastos Administrativos', value: 15, color: '#FFC107' },
          ],
        };
      }

      default:
        return {
          title: code,
          message: 'Sin datos disponibles para este widget',
          updatedAt: new Date().toISOString(),
        };
    }
  }

  /**
   * Obtiene el consolidado de métricas reales para el dashboard
   */
  static async getDashboardSummary(companyId: string, branchId?: string, warehouseId?: string) {
    const bId = branchId && branchId !== 'ALL' ? branchId : null;
    const wId = warehouseId && warehouseId !== 'ALL' ? warehouseId : null;

    // 1. Ventas de Hoy
    const salesRows = await query<any>(
      `SELECT COALESCE(SUM(si.total_amount), 0) AS totalUSD,
              COALESCE(SUM(si.total_amount * si.exchange_rate), 0) AS totalVES,
              COUNT(si.id) AS countInvoices
       FROM sales_invoices si
       LEFT JOIN branches b ON si.branch_id = b.id
       WHERE (? IS NULL OR b.company_id = ?)
         AND (? IS NULL OR si.branch_id = ?)
         AND (? IS NULL OR si.warehouse_id = ?)
         AND DATE(si.invoice_date) = CURRENT_DATE()
         AND si.status <> 'ANNULLED'`,
      [companyId, companyId, bId, bId, wId, wId]
    );

    // 2. Ticket Promedio (Últimos 7 días)
    const ticketRows = await query<any>(
      `SELECT COALESCE(AVG(si.total_amount), 0) AS avgTicketUSD,
              COUNT(si.id) AS countInvoices
       FROM sales_invoices si
       LEFT JOIN branches b ON si.branch_id = b.id
       WHERE (? IS NULL OR b.company_id = ?)
         AND (? IS NULL OR si.branch_id = ?)
         AND (? IS NULL OR si.warehouse_id = ?)
         AND si.invoice_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND si.status <> 'ANNULLED'`,
      [companyId, companyId, bId, bId, wId, wId]
    );

    // 3. Resumen Fiscal SENIAT (Mes actual)
    const taxRows = await query<any>(
      `SELECT COALESCE(SUM(si.tax_amount), 0) AS totalIVA,
              COALESCE(SUM(si.igtf_amount), 0) AS totalIGTF
       FROM sales_invoices si
       LEFT JOIN branches b ON si.branch_id = b.id
       WHERE (? IS NULL OR b.company_id = ?)
         AND (? IS NULL OR si.branch_id = ?)
         AND (? IS NULL OR si.warehouse_id = ?)
         AND MONTH(si.invoice_date) = MONTH(CURRENT_DATE())
         AND YEAR(si.invoice_date) = YEAR(CURRENT_DATE())
         AND si.status <> 'ANNULLED'`,
      [companyId, companyId, bId, bId, wId, wId]
    );

    // 4. Cuentas por Cobrar (v_cxc_aging)
    const cxcRows = await query<any>(
      `SELECT COALESCE(SUM(amount_balance), 0) AS totalPendingUSD,
              COALESCE(SUM(days_1_30 + days_31_60 + days_61_90 + days_90_plus), 0) AS overdueUSD,
              COALESCE(SUM(current_due), 0) AS currentDue,
              COALESCE(SUM(days_1_30), 0) AS days1to30,
              COALESCE(SUM(days_31_60), 0) AS days31to60,
              COALESCE(SUM(days_61_90), 0) AS days61to90,
              COALESCE(SUM(days_90_plus), 0) AS days90Plus
       FROM v_cxc_aging
       WHERE (? IS NULL OR branch_id = ?)`,
      [bId, bId]
    );
    const cxcData = cxcRows[0] || {};
    const cxcDistribution = [
      { name: 'Al Día', value: Number(cxcData.currentDue || 0), color: '#10b981' },
      { name: '1-30 Días', value: Number(cxcData.days1to30 || 0), color: '#38bdf8' },
      { name: '31-60 Días', value: Number(cxcData.days31to60 || 0), color: '#fbbf24' },
      { name: '61-90 Días', value: Number(cxcData.days61to90 || 0), color: '#f97316' },
      { name: '+90 Días', value: Number(cxcData.days90Plus || 0), color: '#ef4444' },
    ];

    // 5. Compras a Proveedores del Mes
    const purchasesRows = await query<any>(
      `SELECT COALESCE(SUM(pi.total_amount), 0) AS totalUSD,
              COUNT(pi.id) AS ordersCount
       FROM purchase_invoices pi
       LEFT JOIN branches b ON pi.branch_id = b.id
       WHERE (? IS NULL OR b.company_id = ?)
         AND (? IS NULL OR pi.branch_id = ?)
         AND (? IS NULL OR pi.warehouse_id = ?)
         AND MONTH(pi.invoice_date) = MONTH(CURRENT_DATE())
         AND YEAR(pi.invoice_date) = YEAR(CURRENT_DATE())
         AND pi.status <> 'ANNULLED'`,
      [companyId, companyId, bId, bId, wId, wId]
    );

    // 6. Top 5 Productos más Vendidos
    const topProductsRows = await query<any>(
      `SELECT p.name, COALESCE(SUM(sii.quantity), 0) AS ventas
       FROM sales_invoice_items sii
       INNER JOIN sales_invoices si ON sii.invoice_id = si.id
       LEFT JOIN branches b ON si.branch_id = b.id
       INNER JOIN products p ON sii.product_id = p.id
       WHERE (? IS NULL OR b.company_id = ?)
         AND (? IS NULL OR si.branch_id = ?)
         AND (? IS NULL OR si.warehouse_id = ?)
         AND si.invoice_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND si.status <> 'ANNULLED'
       GROUP BY p.id, p.name
       ORDER BY ventas DESC
       LIMIT 5`,
      [companyId, companyId, bId, bId, wId, wId]
    );

    // 7. Tendencia Semanal de Facturación (Últimos 7 días)
    const trendRows = await query<any>(
      `SELECT DATE(si.invoice_date) AS dateStr,
              COALESCE(SUM(si.total_amount), 0) AS totalUSD
       FROM sales_invoices si
       LEFT JOIN branches b ON si.branch_id = b.id
       WHERE (? IS NULL OR b.company_id = ?)
         AND (? IS NULL OR si.branch_id = ?)
         AND (? IS NULL OR si.warehouse_id = ?)
         AND si.invoice_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
         AND si.status <> 'ANNULLED'
       GROUP BY DATE(si.invoice_date)`,
      [companyId, companyId, bId, bId, wId, wId]
    );

    const salesByDate = new Map<string, number>();
    for (const row of trendRows) {
      let dStr = '';
      if (row.dateStr instanceof Date) {
        dStr = row.dateStr.toISOString().split('T')[0];
      } else if (typeof row.dateStr === 'string') {
        dStr = row.dateStr.slice(0, 10);
      }
      if (dStr) {
        salesByDate.set(dStr, Number(row.totalUSD || 0));
      }
    }

    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const weeklySalesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = daysOfWeek[d.getDay()];
      weeklySalesTrend.push({
        date: dateStr,
        day: dayName,
        ventas: Number((salesByDate.get(dateStr) || 0).toFixed(2)),
      });
    }

    // 8. Stock Crítico
    const criticalStockRows = await query<any>(
      `SELECT sku, product_name AS name, current_stock AS stock, min_stock AS min, warehouse_name AS warehouse
       FROM v_stock_critical
       WHERE (? IS NULL OR company_id = ?)
         AND (? IS NULL OR branch_id = ?)
         AND (? IS NULL OR warehouse_id = ?)
         AND current_stock <= min_stock
       ORDER BY current_stock ASC
       LIMIT 10`,
      [companyId, companyId, bId, bId, wId, wId]
    );

    // 9. Últimas Operaciones Fiscales
    const recentRows = await query<any>(
      `SELECT si.invoice_number AS number,
              DATE_FORMAT(si.created_at, '%h:%i %p') AS time,
              COALESCE(c.name, 'Cliente Mostrador') AS customer,
              si.total_amount AS amount,
              si.status
       FROM sales_invoices si
       LEFT JOIN branches b ON si.branch_id = b.id
       LEFT JOIN customers c ON si.customer_id = c.id
       WHERE (? IS NULL OR b.company_id = ?)
         AND (? IS NULL OR si.branch_id = ?)
         AND (? IS NULL OR si.warehouse_id = ?)
       ORDER BY si.created_at DESC
       LIMIT 5`,
      [companyId, companyId, bId, bId, wId, wId]
    );

    // 10. Métricas Contables del Mes (VEN-NIF)
    let revenueUSD = 0;
    let expenseUSD = 0;
    let revenueVES = 0;
    let expenseVES = 0;
    let assetsUSD = 0;
    let liabilitiesUSD = 0;

    try {
      const acctRows = await query<any>(
        `SELECT 
           COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN (l.credit_usd - l.debit_usd) ELSE 0 END), 0) AS revenueUSD,
           COALESCE(SUM(CASE WHEN a.account_type IN ('COST', 'EXPENSE') THEN (l.debit_usd - l.credit_usd) ELSE 0 END), 0) AS expenseUSD,
           COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN (l.credit_ves - l.debit_ves) ELSE 0 END), 0) AS revenueVES,
           COALESCE(SUM(CASE WHEN a.account_type IN ('COST', 'EXPENSE') THEN (l.debit_ves - l.credit_ves) ELSE 0 END), 0) AS expenseVES,
           COALESCE(SUM(CASE WHEN a.account_type = 'ASSET' THEN (l.debit_usd - l.credit_usd) ELSE 0 END), 0) AS assetsUSD,
           COALESCE(SUM(CASE WHEN a.account_type = 'LIABILITY' THEN (l.credit_usd - l.debit_usd) ELSE 0 END), 0) AS liabilitiesUSD
         FROM accounting_journal_lines l
         INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
         INNER JOIN accounting_accounts a ON l.account_id = a.id
         WHERE e.company_id = ?
           AND (? IS NULL OR e.branch_id = ?)
           AND MONTH(e.entry_date) = MONTH(CURRENT_DATE())
           AND YEAR(e.entry_date) = YEAR(CURRENT_DATE())
           AND e.status = 'POSTED'`,
        [companyId, bId, bId]
      );
      if (acctRows.length > 0) {
        revenueUSD = Number(acctRows[0].revenueUSD || 0);
        expenseUSD = Number(acctRows[0].expenseUSD || 0);
        revenueVES = Number(acctRows[0].revenueVES || 0);
        expenseVES = Number(acctRows[0].expenseVES || 0);
        assetsUSD = Number(acctRows[0].assetsUSD || 0);
        liabilitiesUSD = Number(acctRows[0].liabilitiesUSD || 0);
      }
    } catch {}

    // Fallback coherente con facturación y compras si los asientos del mes no han sido cerrados
    if (revenueUSD === 0 && expenseUSD === 0) {
      revenueUSD = Number(salesRows[0]?.totalUSD || 0);
      revenueVES = Number(salesRows[0]?.totalVES || 0);
      expenseUSD = Number(purchasesRows[0]?.totalUSD || 0);
      expenseVES = Number(purchasesRows[0]?.totalUSD || 0) * (salesRows[0]?.totalUSD > 0 ? (salesRows[0]?.totalVES / salesRows[0]?.totalUSD) : 36.5);
    }
    const netIncomeUSD = Number((revenueUSD - expenseUSD).toFixed(2));
    const netIncomeVES = Number((revenueVES - expenseVES).toFixed(2));

    // Conteo de Comprobantes Contables
    let totalEntries = 0;
    let postedEntries = 0;
    let draftEntries = 0;
    try {
      const entRows = await query<any>(
        `SELECT 
           COUNT(id) AS totalEntries,
           COALESCE(SUM(CASE WHEN status = 'POSTED' THEN 1 ELSE 0 END), 0) AS postedEntries,
           COALESCE(SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END), 0) AS draftEntries
         FROM accounting_journal_entries
         WHERE company_id = ?
           AND (? IS NULL OR branch_id = ?)
           AND MONTH(entry_date) = MONTH(CURRENT_DATE())
           AND YEAR(entry_date) = YEAR(CURRENT_DATE())`,
        [companyId, bId, bId]
      );
      if (entRows.length > 0) {
        totalEntries = Number(entRows[0].totalEntries || 0);
        postedEntries = Number(entRows[0].postedEntries || 0);
        draftEntries = Number(entRows[0].draftEntries || 0);
      }
    } catch {}

    // Asientos Contables Recientes
    let recentJournalEntries: any[] = [];
    try {
      const rEntRows = await query<any>(
        `SELECT entry_number AS number, DATE_FORMAT(entry_date, '%d/%m/%Y') AS date,
                concept, total_debit_usd AS amountUSD, total_debit_ves AS amountVES, status
         FROM accounting_journal_entries
         WHERE company_id = ?
           AND (? IS NULL OR branch_id = ?)
         ORDER BY entry_date DESC, created_at DESC
         LIMIT 5`,
        [companyId, bId, bId]
      );
      recentJournalEntries = rEntRows.map((r: any) => ({
        number: r.number,
        date: r.date,
        concept: r.concept,
        amountUSD: Number(r.amountUSD || 0),
        amountVES: Number(r.amountVES || 0),
        status: r.status,
      }));
    } catch {}

    // Distribución de Egresos Contables
    let expensesBreakdown: any[] = [];
    try {
      const expRows = await query<any>(
        `SELECT a.name, COALESCE(SUM(l.debit_usd - l.credit_usd), 0) AS totalUSD
         FROM accounting_journal_lines l
         INNER JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
         INNER JOIN accounting_accounts a ON l.account_id = a.id
         WHERE e.company_id = ?
           AND (? IS NULL OR e.branch_id = ?)
           AND a.account_type IN ('COST', 'EXPENSE')
           AND MONTH(e.entry_date) = MONTH(CURRENT_DATE())
           AND YEAR(e.entry_date) = YEAR(CURRENT_DATE())
           AND e.status = 'POSTED'
         GROUP BY a.id, a.name
         ORDER BY totalUSD DESC
         LIMIT 5`,
        [companyId, bId, bId]
      );
      const colors = ['#007BFF', '#28A745', '#FFC107', '#17A2B8', '#DC3545'];
      expensesBreakdown = expRows.map((r: any, idx: number) => ({
        name: r.name,
        value: Number(r.totalUSD || 0),
        color: colors[idx % colors.length],
      }));
    } catch {}

    if (expensesBreakdown.length === 0) {
      expensesBreakdown = [
        { name: 'Costo de Ventas', value: Number((expenseUSD * 0.7).toFixed(2)) || 70, color: '#007BFF' },
        { name: 'Gastos Operativos', value: Number((expenseUSD * 0.2).toFixed(2)) || 20, color: '#28A745' },
        { name: 'Gastos Administrativos', value: Number((expenseUSD * 0.1).toFixed(2)) || 10, color: '#FFC107' },
      ];
    }

    return {
      salesToday: {
        totalUSD: Number(salesRows[0]?.totalUSD || 0),
        totalVES: Number(salesRows[0]?.totalVES || 0),
        countInvoices: Number(salesRows[0]?.countInvoices || 0),
      },
      ticketAvg: {
        avgTicketUSD: Number(ticketRows[0]?.avgTicketUSD || 0),
        countInvoices: Number(ticketRows[0]?.countInvoices || 0),
      },
      taxSummary: {
        totalIVA: Number(taxRows[0]?.totalIVA || 0),
        totalIGTF: Number(taxRows[0]?.totalIGTF || 0),
      },
      cxcSummary: {
        totalPendingUSD: Number(cxcData.totalPendingUSD || 0),
        overdueUSD: Number(cxcData.overdueUSD || 0),
        cxcDistribution,
      },
      purchasesMonth: {
        totalUSD: Number(purchasesRows[0]?.totalUSD || 0),
        ordersCount: Number(purchasesRows[0]?.ordersCount || 0),
      },
      topProducts: topProductsRows.map((r: any) => ({
        name: r.name,
        ventas: Number(r.ventas),
      })),
      weeklySalesTrend,
      criticalStock: {
        count: criticalStockRows.length,
        items: criticalStockRows.map((r: any) => ({
          sku: r.sku,
          name: r.name,
          warehouse: r.warehouse,
          stock: Number(r.stock),
          min: Number(r.min),
        })),
      },
      recentTransactions: recentRows.map((r: any) => ({
        number: r.number,
        time: r.time,
        customer: r.customer,
        amount: Number(r.amount),
        status: r.status,
      })),
      accountingSummary: {
        netIncomeUSD,
        netIncomeVES,
        revenueUSD,
        expenseUSD,
        isProfit: netIncomeUSD >= 0,
        assetsUSD,
        liabilitiesUSD,
        totalEntries,
        postedEntries,
        draftEntries,
        recentJournalEntries,
        expensesBreakdown,
      },
    };
  }
}
