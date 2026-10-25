import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  departmentSchema,
  updateDepartmentSchema,
  groupSchema,
  updateGroupSchema,
  subgroupSchema,
  updateSubgroupSchema,
  productSchema,
  updateProductSchema,
  brandSchema,
  updateBrandSchema,
  unitOfMeasureSchema,
  updateUnitOfMeasureSchema,
  presentationSchema,
  updatePresentationSchema,
  productLocationSchema,
  warehouseLocationSchema,
  updateWarehouseLocationSchema,
  inventoryMovementSchema,
  createInventoryAdjustmentSchema,
  createInventoryTransferSchema,
  receiveInventoryTransferSchema,
  kardexFilterSchema,
  productLotSchema,
} from '@ero/shared';
import { InventoryService } from './inventory.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { query } from '../../db';
import {
  generateKardexReportPDF,
  generateInventoryAdjustmentPDF,
  generateInventoryTransferPDF,
  generateProductsReportPDF,
} from '../reports/reports-pdf';
import { ReportsService } from '../reports/reports.service';

export const inventoryRouter = new Hono<AppEnv>();

// ==========================================
// Rutas de Jerarquía: Departamentos, Grupos, Subgrupos
// ==========================================

inventoryRouter.get('/departments', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const result = await InventoryService.getDepartments(user.companyId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/departments', authenticate, authorize('inventory', 'create'), zValidator('json', departmentSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await InventoryService.createDepartment({
    ...body,
    companyId: body.companyId || user.companyId,
  });
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.put('/departments/:id', authenticate, authorize('inventory', 'update'), zValidator('json', updateDepartmentSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.updateDepartment(id!, body);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'DEPARTMENT_UPDATE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.delete('/departments/:id', authenticate, authorize('inventory', 'delete'), async (c) => {
  const id = c.req.param('id');
  try {
    const result = await InventoryService.deleteDepartment(id!);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'DEPARTMENT_DELETE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.get('/groups', authenticate, authorize('inventory', 'read'), async (c) => {
  const departmentId = c.req.query('departmentId');
  const result = await InventoryService.getGroups(departmentId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/groups', authenticate, authorize('inventory', 'create'), zValidator('json', groupSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await InventoryService.createGroup(body);
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.put('/groups/:id', authenticate, authorize('inventory', 'update'), zValidator('json', updateGroupSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.updateGroup(id!, body);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'GROUP_UPDATE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.delete('/groups/:id', authenticate, authorize('inventory', 'delete'), async (c) => {
  const id = c.req.param('id');
  try {
    const result = await InventoryService.deleteGroup(id!);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'GROUP_DELETE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.get('/subgroups', authenticate, authorize('inventory', 'read'), async (c) => {
  const groupId = c.req.query('groupId');
  const result = await InventoryService.getSubgroups(groupId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/subgroups', authenticate, authorize('inventory', 'create'), zValidator('json', subgroupSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await InventoryService.createSubgroup(body);
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.put('/subgroups/:id', authenticate, authorize('inventory', 'update'), zValidator('json', updateSubgroupSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.updateSubgroup(id!, body);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'SUBGROUP_UPDATE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.delete('/subgroups/:id', authenticate, authorize('inventory', 'delete'), async (c) => {
  const id = c.req.param('id');
  try {
    const result = await InventoryService.deleteSubgroup(id!);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'SUBGROUP_DELETE_ERROR', message: error.message } }, 400);
  }
});

// ==========================================
// Rutas de Ubicación Física (Pasillo, Estante, Compartimiento)
// ==========================================

inventoryRouter.get('/warehouse-locations', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const warehouseId = c.req.query('warehouseId');
  const result = await InventoryService.getWarehouseLocations(user.companyId, warehouseId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/warehouse-locations', authenticate, authorize('inventory', 'create'), zValidator('json', warehouseLocationSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.createWarehouseLocation(user.companyId, body);
    return c.json({ success: true, data: result }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'LOCATION_CREATE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.put('/warehouse-locations/:id', authenticate, authorize('inventory', 'update'), zValidator('json', updateWarehouseLocationSchema), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.updateWarehouseLocation(user.companyId, id, body);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'LOCATION_UPDATE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.delete('/warehouse-locations/:id', authenticate, authorize('inventory', 'delete'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const result = await InventoryService.deleteWarehouseLocation(user.companyId, id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'LOCATION_DELETE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.get('/products/:id/locations', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read']), async (c) => {
  const productId = c.req.param('id');
  const result = await InventoryService.getProductLocations(productId!);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/products/:id/locations', authenticate, authorize('inventory', 'update'), zValidator('json', productLocationSchema), async (c) => {
  const body = c.req.valid('json');
  const result = await InventoryService.setProductLocation(body);
  return c.json({ success: true, data: result });
});

inventoryRouter.get('/locations/search', authenticate, authorize('inventory', 'read'), async (c) => {
  const warehouseId = c.req.query('warehouse_id');
  const aisle = c.req.query('aisle');
  const shelf = c.req.query('shelf');
  const compartment = c.req.query('compartment');
  const result = await InventoryService.searchLocations({ warehouseId, aisle, shelf, compartment });
  return c.json({ success: true, data: result });
});

// ==========================================
// Rutas de Catálogo de Productos y Kardex
// ==========================================

inventoryRouter.get('/products', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read', 'purchases.read', 'purchases.create']), async (c) => {
  const user = c.get('user');
  const departmentId = c.req.query('departmentId');
  const groupId = c.req.query('groupId');
  const subgroupId = c.req.query('subgroupId');
  const search = c.req.query('search');
  const warehouseId = c.req.query('warehouseId') || c.get('activeWarehouseId');

  const result = await InventoryService.getProducts(user.companyId, { departmentId, groupId, subgroupId, search, warehouseId });
  return c.json({ success: true, data: result });
});

inventoryRouter.get('/products/pdf', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const departmentId = c.req.query('departmentId');
  const groupId = c.req.query('groupId');
  const subgroupId = c.req.query('subgroupId');
  const search = c.req.query('search');
  const warehouseId = c.req.query('warehouseId') || c.get('activeWarehouseId');

  try {
    const [products, company, userName] = await Promise.all([
      InventoryService.getProducts(user.companyId, { departmentId, groupId, subgroupId, search, warehouseId }),
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateProductsReportPDF({
      company,
      products,
      userName,
      options: {
        filterSummary: search ? `Búsqueda: "${search}"` : undefined,
      },
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'inline; filename="catalogo_productos.pdf"');
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Products PDF Error]', error);
    return c.json({ success: false, error: { code: 'PRODUCTS_PDF_FAILED', message: error.message } }, 500);
  }
});

inventoryRouter.get('/products/:id', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  const result = await InventoryService.getProductById(user.companyId, id);
  if (!result) {
    return c.json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' } }, 404);
  }
  return c.json({ success: true, data: result });
});

// GET /api/inventory/products/:id/stock-by-warehouse - Existencias desglosadas por depósito
inventoryRouter.get('/products/:id/stock-by-warehouse', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const productId = c.req.param('id')!;
  try {
    const data = await InventoryService.getProductStockByWarehouse(user.companyId, productId);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PRODUCT_STOCK_FETCH_ERROR', message: error.message } }, 400);
  }
});

// GET /api/inventory/products/:id/lots - Lotes y vencimientos de un producto
inventoryRouter.get('/products/:id/lots', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const productId = c.req.param('id')!;
  const warehouseId = c.req.query('warehouseId') || undefined;
  try {
    const data = await InventoryService.getProductLots(user.companyId, productId, warehouseId);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PRODUCT_LOTS_FETCH_ERROR', message: error.message } }, 400);
  }
});

// POST /api/inventory/products/:id/lots - Registrar o ajustar lote de producto
inventoryRouter.post('/products/:id/lots', authenticate, authorize('inventory', 'update'), zValidator('json', productLotSchema, (result, c) => {
  if (!result.success) {
    const errorMsg = result.error.errors.map(e => `${e.path.join('.') || 'campo'}: ${e.message}`).join(' | ');
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMsg, details: result.error.errors } }, 400);
  }
}), async (c) => {
  const user = c.get('user');
  const productId = c.req.param('id')!;
  const body = c.req.valid('json');
  try {
    const data = await InventoryService.createOrAdjustProductLot(user.companyId, user.sub, {
      ...body,
      productId,
    });
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PRODUCT_LOT_CREATE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.post('/products', authenticate, authorize('inventory', 'create'), zValidator('json', productSchema, (result, c) => {
  if (!result.success) {
    const errorMsg = result.error.errors.map(e => `${e.path.join('.') || 'campo'}: ${e.message}`).join(' | ');
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMsg, details: result.error.errors } }, 400);
  }
}), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.createProduct({
      ...body,
      companyId: user.companyId,
    });
    return c.json({ success: true, data: result }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PRODUCT_CREATE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.put('/products/:id', authenticate, authorize('inventory', 'update'), zValidator('json', updateProductSchema, (result, c) => {
  if (!result.success) {
    const errorMsg = result.error.errors.map(e => `${e.path.join('.') || 'campo'}: ${e.message}`).join(' | ');
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMsg, details: result.error.errors } }, 400);
  }
}), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.updateProduct(user.companyId, id, body);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PRODUCT_UPDATE_ERROR', message: error.message } }, 400);
  }
});

inventoryRouter.delete('/products/:id', authenticate, authorize('inventory', 'delete'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const result = await InventoryService.deleteProduct(user.companyId, id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PRODUCT_DELETE_ERROR', message: error.message } }, 400);
  }
});

// ==========================================
// Rutas de Marcas de Productos
// ==========================================
inventoryRouter.get('/brands', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const result = await InventoryService.getBrands(user.companyId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/brands', authenticate, authorize('inventory', 'create'), zValidator('json', brandSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await InventoryService.createBrand({ ...body, companyId: user.companyId });
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.put('/brands/:id', authenticate, authorize('inventory', 'update'), zValidator('json', updateBrandSchema), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.updateBrand(user.companyId, id, body);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: { code: 'BRAND_UPDATE_ERROR', message: err.message } }, 400);
  }
});

inventoryRouter.delete('/brands/:id', authenticate, authorize('inventory', 'delete'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const result = await InventoryService.deleteBrand(user.companyId, id);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: { code: 'BRAND_DELETE_ERROR', message: err.message } }, 400);
  }
});

// ==========================================
// Rutas de Unidades de Medida
// ==========================================
inventoryRouter.get('/units', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const result = await InventoryService.getUnitsOfMeasure(user.companyId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/units', authenticate, authorize('inventory', 'create'), zValidator('json', unitOfMeasureSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await InventoryService.createUnitOfMeasure({ ...body, companyId: user.companyId });
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.put('/units/:id', authenticate, authorize('inventory', 'update'), zValidator('json', updateUnitOfMeasureSchema), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.updateUnitOfMeasure(user.companyId, id, body);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: { code: 'UNIT_UPDATE_ERROR', message: err.message } }, 400);
  }
});

inventoryRouter.delete('/units/:id', authenticate, authorize('inventory', 'delete'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const result = await InventoryService.deleteUnitOfMeasure(user.companyId, id);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: { code: 'UNIT_DELETE_ERROR', message: err.message } }, 400);
  }
});

// ==========================================
// Rutas de Catálogo de Presentaciones
// ==========================================
inventoryRouter.get('/presentations', authenticate, authorize(['inventory.read', 'pos.read', 'sales.read']), async (c) => {
  const user = c.get('user');
  const result = await InventoryService.getPresentations(user.companyId);
  return c.json({ success: true, data: result });
});

inventoryRouter.post('/presentations', authenticate, authorize('inventory', 'create'), zValidator('json', presentationSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await InventoryService.createPresentation({ ...body, companyId: user.companyId });
  return c.json({ success: true, data: result }, 201);
});

inventoryRouter.put('/presentations/:id', authenticate, authorize('inventory', 'update'), zValidator('json', updatePresentationSchema), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  const body = c.req.valid('json');
  try {
    const result = await InventoryService.updatePresentation(user.companyId, id, body);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: { code: 'PRESENTATION_UPDATE_ERROR', message: err.message } }, 400);
  }
});

inventoryRouter.delete('/presentations/:id', authenticate, authorize('inventory', 'delete'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id')!;
  try {
    const result = await InventoryService.deletePresentation(user.companyId, id);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: { code: 'PRESENTATION_DELETE_ERROR', message: err.message } }, 400);
  }
});

inventoryRouter.post('/movements', authenticate, authorize('inventory', 'adjust'), zValidator('json', inventoryMovementSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await InventoryService.recordMovement(body, user.sub);
  return c.json({ success: true, data: result }, 201);
});

// ==========================================
// Kardex Valorizado Detallado
// ==========================================
inventoryRouter.get('/kardex', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const warehouseId = c.req.query('warehouseId');
  const productId = c.req.query('productId');
  const movementType = c.req.query('movementType') as any;
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const format = c.req.query('format');

  try {
    const result = await InventoryService.getKardex(user.companyId, {
      branchId,
      warehouseId,
      productId,
      movementType,
      startDate,
      endDate,
    });

    if (format === 'pdf') {
      const [company, userName] = await Promise.all([
        ReportsService.getCompanyPdfInfo(user.companyId),
        ReportsService.getUserFullName(user.sub),
      ]);

      const movementList = result.movements || [];
      const pdfBuffer = await generateKardexReportPDF({
        company,
        filter: {
          startDate,
          endDate,
          warehouseName: warehouseId ? movementList[0]?.warehouseName : undefined,
          branchName: branchId ? movementList[0]?.branchName : undefined,
          productName: productId ? movementList[0]?.productName : undefined,
          movementType,
        },
        movements: movementList.map((m: any) => ({
          date: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
          productSku: m.sku || 'N/A',
          productName: m.productName,
          warehouseName: m.warehouseName,
          movementType: m.movementType,
          quantity: Number(m.quantity || 0),
          unitCost: Number(m.unitCost || 0),
          totalCost: Number(m.totalCost || 0),
          previousStock: Number(m.previousStock || 0),
          newStock: Number(m.newStock || 0),
          referenceDocument: m.referenceDocument || undefined,
        })),
        userName,
      });

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="kardex_inventario_${new Date().toISOString().slice(0, 10)}.pdf"`);
      return c.body(new Uint8Array(pdfBuffer));
    }

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Kardex PDF Error]', error);
    return c.json({ success: false, error: { code: 'KARDEX_FETCH_FAILED', message: error.message } }, 500);
  }
});

// ==========================================
// Alertas de Stock Crítico y Reorden
// ==========================================
inventoryRouter.get('/stock-alerts', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const warehouseId = c.req.query('warehouseId');

  try {
    const alerts = await InventoryService.getStockAlerts(user.companyId, branchId, warehouseId);
    return c.json({ success: true, data: alerts });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'STOCK_ALERTS_FETCH_FAILED', message: error.message } }, 500);
  }
});

// ==========================================
// Ajustes de Inventario (Merma / Sobrante / Conteo)
// ==========================================
inventoryRouter.get('/adjustments', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const warehouseId = c.req.query('warehouseId');

  try {
    const list = await InventoryService.getAdjustmentsHistory(user.companyId, branchId, warehouseId);
    return c.json({ success: true, data: list });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ADJUSTMENTS_FETCH_FAILED', message: error.message } }, 500);
  }
});

inventoryRouter.post(
  '/adjustments',
  authenticate,
  authorize('inventory', 'adjust'),
  zValidator('json', createInventoryAdjustmentSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await InventoryService.createAdjustment(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'ADJUSTMENT_CREATION_FAILED', message: error.message } }, 400);
    }
  }
);

// ==========================================
// Traslados entre Depósitos y Sucursales
// ==========================================
inventoryRouter.get('/transfers', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const branchId = c.req.query('branchId') || user.branchId;
  const status = c.req.query('status');

  try {
    const list = await InventoryService.getTransfers(user.companyId, branchId, status);
    return c.json({ success: true, data: list });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'TRANSFERS_FETCH_FAILED', message: error.message } }, 500);
  }
});

inventoryRouter.post(
  '/transfers',
  authenticate,
  authorize('inventory', 'transfer'),
  zValidator('json', createInventoryTransferSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await InventoryService.createTransfer(user.companyId, user.sub, body);
      return c.json({ success: true, data: result }, 201);
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'TRANSFER_CREATION_FAILED', message: error.message } }, 400);
    }
  }
);

inventoryRouter.post(
  '/transfers/receive',
  authenticate,
  authorize('inventory', 'transfer'),
  zValidator('json', receiveInventoryTransferSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    try {
      const result = await InventoryService.receiveTransfer(user.companyId, user.sub, body);
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'TRANSFER_RECEIVE_FAILED', message: error.message } }, 400);
    }
  }
);

// GET /api/inventory/adjustments/:id/pdf - Descarga / Visualización de Comprobante de Ajuste de Inventario
inventoryRouter.get('/adjustments/:id/pdf', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const adjustmentId = c.req.param('id')!;

  try {
    const adjustment = await InventoryService.getAdjustmentById(user.companyId, adjustmentId);
    if (!adjustment) {
      return c.json({ success: false, error: { code: 'ADJUSTMENT_NOT_FOUND', message: 'Ajuste de inventario no encontrado' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateInventoryAdjustmentPDF({
      company,
      adjustment,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="ajuste_inventario_${adjustment.adjustmentNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Adjustment PDF Error]', error);
    return c.json({ success: false, error: { code: 'ADJUSTMENT_PDF_FAILED', message: error.message } }, 500);
  }
});

// GET /api/inventory/transfers/:id/pdf - Descarga / Visualización de Guía de Traslado de Mercancía
inventoryRouter.get('/transfers/:id/pdf', authenticate, authorize('inventory', 'read'), async (c) => {
  const user = c.get('user');
  const transferId = c.req.param('id')!;

  try {
    const transfer = await InventoryService.getTransferById(user.companyId, transferId);
    if (!transfer) {
      return c.json({ success: false, error: { code: 'TRANSFER_NOT_FOUND', message: 'Traslado no encontrado' } }, 404);
    }

    const [company, userName] = await Promise.all([
      ReportsService.getCompanyPdfInfo(user.companyId),
      ReportsService.getUserFullName(user.sub),
    ]);

    const pdfBuffer = await generateInventoryTransferPDF({
      company,
      transfer,
      userName,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="guia_traslado_${transfer.transferNumber}.pdf"`);
    return c.body(new Uint8Array(pdfBuffer));
  } catch (error: any) {
    console.error('[Transfer PDF Error]', error);
    return c.json({ success: false, error: { code: 'TRANSFER_PDF_FAILED', message: error.message } }, 500);
  }
});

