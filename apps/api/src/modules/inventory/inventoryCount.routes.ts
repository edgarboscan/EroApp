import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createInventoryCountSchema,
  batchUpdateCountItemsSchema,
  scanProductBarcodeSchema,
  reconcileInventoryCountSchema,
  warehouseStockFilterSchema,
} from '@ero/shared';
import { InventoryCountService } from './inventoryCount.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const inventoryCountRouter = new Hono<AppEnv>();

// ==========================================
// 1. Consulta en vivo de stock de productos por depósito (con filtros y buscador)
// ==========================================
inventoryCountRouter.get(
  '/products-stock',
  authenticate,
  authorize('inventory', 'read'),
  zValidator('query', warehouseStockFilterSchema),
  async (c) => {
    const user = c.get('user');
    const queryParams = c.req.valid('query');

    try {
      const products = await InventoryCountService.getWarehouseProductsStock(user.companyId, {
        branchId: queryParams.branchId,
        warehouseId: queryParams.warehouseId,
        departmentId: queryParams.departmentId || undefined,
        groupId: queryParams.groupId || undefined,
        subgroupId: queryParams.subgroupId || undefined,
        search: queryParams.search || undefined,
        stockFilter: queryParams.stockFilter as any,
      });

      return c.json({
        success: true,
        data: products,
        meta: {
          total: products.length,
        },
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            code: 'WAREHOUSE_STOCK_FETCH_FAILED',
            message: error.message || 'Error al consultar stock del depósito',
          },
        },
        500
      );
    }
  }
);

// ==========================================
// 2. Listar sesiones de conteo de inventario
// ==========================================
inventoryCountRouter.get(
  '/',
  authenticate,
  authorize('inventory', 'read'),
  async (c) => {
    const user = c.get('user');
    const branchId = c.req.query('branchId');
    const warehouseId = c.req.query('warehouseId');
    const status = c.req.query('status');
    const search = c.req.query('search');

    try {
      const counts = await InventoryCountService.getInventoryCounts(user.companyId, {
        branchId: branchId || undefined,
        warehouseId: warehouseId || undefined,
        status: status || undefined,
        search: search || undefined,
      });

      return c.json({ success: true, data: counts });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVENTORY_COUNTS_FETCH_FAILED',
            message: error.message || 'Error al listar conteos de inventario',
          },
        },
        500
      );
    }
  }
);

// ==========================================
// 3. Detalle de una sesión de conteo con renglones
// ==========================================
inventoryCountRouter.get(
  '/:id',
  authenticate,
  authorize('inventory', 'read'),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id')!;

    try {
      const count = await InventoryCountService.getInventoryCountById(user.companyId, id);
      if (!count) {
        return c.json(
          {
            success: false,
            error: {
              code: 'COUNT_NOT_FOUND',
              message: 'Sesión de conteo no encontrada',
            },
          },
          404
        );
      }

      return c.json({ success: true, data: count });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            code: 'COUNT_DETAIL_FETCH_FAILED',
            message: error.message || 'Error al consultar detalle del conteo',
          },
        },
        500
      );
    }
  }
);

// ==========================================
// 4. Crear nueva sesión de conteo de inventario
// ==========================================
inventoryCountRouter.post(
  '/',
  authenticate,
  authorize('inventory', 'create'),
  zValidator('json', createInventoryCountSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const created = await InventoryCountService.createInventoryCount(user.companyId, user.sub, body);
      return c.json({ success: true, data: created }, 201);
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            code: 'COUNT_CREATION_FAILED',
            message: error.message || 'Error al crear sesión de conteo',
          },
        },
        400
      );
    }
  }
);

// ==========================================
// 5. Actualización por lotes de renglones contados
// ==========================================
inventoryCountRouter.put(
  '/:id/items',
  authenticate,
  authorize('inventory', 'update'),
  zValidator('json', batchUpdateCountItemsSchema),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id')!;
    const body = c.req.valid('json');

    try {
      const updated = await InventoryCountService.batchUpdateCountItems(user.companyId, id, user.sub, body.items);
      return c.json({ success: true, data: updated });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            code: 'COUNT_UPDATE_FAILED',
            message: error.message || 'Error al actualizar renglones de conteo',
          },
        },
        400
      );
    }
  }
);

// ==========================================
// 6. Escaneo rápido de código de barras o SKU
// ==========================================
inventoryCountRouter.post(
  '/:id/scan',
  authenticate,
  authorize('inventory', 'update'),
  zValidator('json', scanProductBarcodeSchema),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id')!;
    const body = c.req.valid('json');

    try {
      const result = await InventoryCountService.scanBarcode(
        user.companyId,
        id,
        user.sub,
        body.barcodeOrSku,
        body.incrementBy,
        body.setExactQuantity
      );

      return c.json({
        success: true,
        data: result.count,
        scannedItem: result.scannedItem,
        action: result.action,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            code: 'BARCODE_SCAN_FAILED',
            message: error.message || 'Error al escanear producto',
          },
        },
        400
      );
    }
  }
);

// ==========================================
// 7. Conciliar y aplicar ajuste contable automático
// ==========================================
inventoryCountRouter.post(
  '/:id/reconcile',
  authenticate,
  authorize('inventory', 'adjust'),
  zValidator('json', reconcileInventoryCountSchema),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id')!;
    const body = c.req.valid('json');

    try {
      const result = await InventoryCountService.reconcileAndApplyAdjustment(user.companyId, user.sub, id, body);
      return c.json({
        success: true,
        data: result.count,
        adjustment: result.adjustment,
        message: 'Ajuste de inventario aplicado exitosamente',
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: {
            code: 'COUNT_RECONCILIATION_FAILED',
            message: error.message || 'Error al conciliar la sesión de conteo',
          },
        },
        400
      );
    }
  }
);

// ==========================================
// 8. Hoja de Conteo Imprimible para Operarios
// ==========================================
inventoryCountRouter.get(
  '/:id/sheet-html',
  authenticate,
  authorize('inventory', 'read'),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id')!;

    try {
      const count = await InventoryCountService.getInventoryCountById(user.companyId, id);
      if (!count) {
        return c.text('Sesión de conteo no encontrada', 404);
      }

      const rowsHtml = (count.items || [])
        .map(
          (it, idx) => `
            <tr>
              <td style="text-align: center; font-size: 11px;">${idx + 1}</td>
              <td style="font-family: monospace; font-size: 12px; font-weight: bold;">${it.sku}</td>
              <td style="font-family: monospace; font-size: 11px;">${it.barcode || '-'}</td>
              <td>
                <div style="font-weight: 600; font-size: 12px;">${it.productName}</div>
                <div style="font-size: 10px; color: #555;">${it.departmentName || 'General'} | Unidad: ${it.unitOfMeasure}</div>
              </td>
              <td style="text-align: center; font-size: 11px;">
                ${it.aisle ? `Pasillo: ${it.aisle}` : ''} ${it.shelf ? `| Est: ${it.shelf}` : ''}
              </td>
              ${
                !count.blindCount
                  ? `<td style="text-align: right; font-family: monospace; font-size: 12px;">${it.systemStock}</td>`
                  : ''
              }
              <td style="border: 1px solid #333; width: 90px; height: 26px; text-align: center; font-weight: bold;">
                ${it.countedStock !== null ? it.countedStock : ''}
              </td>
              <td style="border: 1px solid #ccc; width: 140px;">
                ${it.notes || ''}
              </td>
            </tr>
          `
        )
        .join('');

      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Planilla de Conteo Físico #${count.countNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
            .header { border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start; }
            .title { font-size: 18px; font-weight: bold; margin: 0; }
            .subtitle { font-size: 13px; color: #444; margin-top: 4px; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; font-size: 11px; background: #f8f9fa; padding: 10px; border-radius: 6px; }
            .meta-item strong { display: block; color: #666; font-size: 10px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #eee; font-size: 10px; text-transform: uppercase; padding: 6px 8px; border-bottom: 2px solid #333; text-align: left; }
            td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
            .footer-sign { display: flex; justify-content: space-around; margin-top: 50px; page-break-inside: avoid; }
            .sign-box { border-top: 1px solid #222; width: 220px; text-align: center; font-size: 11px; padding-top: 6px; }
            @media print {
              body { margin: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 15px; text-align: right;">
            <button onclick="window.print()" style="padding: 8px 16px; font-size: 13px; font-weight: bold; cursor: pointer; background: #0284c7; color: white; border: none; border-radius: 4px;">Imprimir Planilla</button>
          </div>

          <div class="header">
            <div>
              <h1 class="title">PLANILLA DE CONTEO FÍSICO DE ALMACÉN</h1>
              <div class="subtitle">${count.title} (${count.countNumber})</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 14px;">${count.warehouseName}</div>
              <div style="font-size: 11px; color: #555;">${count.branchName}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <strong>Número de Control:</strong>
              ${count.countNumber}
            </div>
            <div class="meta-item">
              <strong>Fecha Inicio:</strong>
              ${new Date(count.startedAt).toLocaleString()}
            </div>
            <div class="meta-item">
              <strong>Modalidad:</strong>
              ${count.blindCount ? 'Conteo a Ciegas (Auditoría)' : 'Conteo Asistido'}
            </div>
            <div class="meta-item">
              <strong>Total Ítems a Contar:</strong>
              ${count.totalProducts} productos
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th style="width: 90px;">Código SKU</th>
                <th style="width: 100px;">Cód. Barras</th>
                <th>Descripción del Producto</th>
                <th style="width: 110px; text-align: center;">Ubicación</th>
                ${!count.blindCount ? '<th style="width: 75px; text-align: right;">Stock Sist.</th>' : ''}
                <th style="width: 90px; text-align: center; background: #e0f2fe;">Físico Contado</th>
                <th style="width: 140px;">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer-sign">
            <div class="sign-box">Responsable de Conteo (Firma y Nombre)</div>
            <div class="sign-box">Supervisor de Almacén (Firma y Sello)</div>
          </div>
        </body>
        </html>
      `;

      return c.html(html);
    } catch (error: any) {
      return c.text(error.message || 'Error al generar planilla', 500);
    }
  }
);
