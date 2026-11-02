import { query } from './index';

export const SYSTEM_PERMISSIONS = [
  // POS
  { id: 'perm-pos-001', module: 'pos', action: 'read', description: 'Acceso a pantalla de caja y terminal POS' },
  { id: 'perm-pos-002', module: 'pos', action: 'create', description: 'Apertura y operaciones de caja' },
  { id: 'perm-pos-003', module: 'pos', action: 'close_register', description: 'Realizar cierre de caja y arqueo' },
  { id: 'perm-pos-004', module: 'pos', action: 'authorize', description: 'Autorizar operaciones restringidas en caja (Stock negativo, precios)' },
  { id: 'perm-pos-005', module: 'pos', action: 'audit_shifts', description: 'Auditar, verificar arqueos de caja y registrar depósitos bancarios de recaudación' },

  // Ventas
  { id: 'perm-sales-001', module: 'sales', action: 'read', description: 'Ver ventas, facturas, cotizaciones y notas de entrega' },
  { id: 'perm-sales-002', module: 'sales', action: 'create', description: 'Facturar y procesar ventas' },
  { id: 'perm-sales-003', module: 'sales', action: 'update', description: 'Modificar cotizaciones y documentos de venta' },
  { id: 'perm-sales-004', module: 'sales', action: 'delete', description: 'Anular documentos de venta' },
  { id: 'perm-sales-005', module: 'sales', action: 'approve', description: 'Aprobar ventas especiales y autorizaciones de caja' },
  { id: 'perm-sales-006', module: 'sales', action: 'approve_discount', description: 'Aprobar descuentos comerciales' },
  { id: 'perm-sales-007', module: 'sales', action: 'credit_notes', description: 'Emitir, consultar y anular Notas de Crédito y Débito' },

  // Clientes
  { id: 'perm-cust-001', module: 'customers', action: 'read', description: 'Consultar directorio de clientes y estados de cuenta' },
  { id: 'perm-cust-002', module: 'customers', action: 'create', description: 'Registrar nuevos clientes' },
  { id: 'perm-cust-003', module: 'customers', action: 'update', description: 'Modificar datos de clientes y límites de crédito' },
  { id: 'perm-cust-004', module: 'customers', action: 'delete', description: 'Anular o desactivar clientes' },

  // Cuentas por Cobrar (CxC)
  { id: 'perm-cxc-001', module: 'receivables', action: 'read', description: 'Consultar cuentas por cobrar y análisis de vencimiento' },
  { id: 'perm-cxc-002', module: 'receivables', action: 'create', description: 'Registrar cobros y abonos CxC' },

  // Compras
  { id: 'perm-purch-001', module: 'purchases', action: 'read', description: 'Consultar compras, órdenes y recepciones' },
  { id: 'perm-purch-002', module: 'purchases', action: 'create', description: 'Registrar compras y facturas de proveedor' },
  { id: 'perm-purch-003', module: 'purchases', action: 'update', description: 'Modificar órdenes de compra' },
  { id: 'perm-purch-004', module: 'purchases', action: 'delete', description: 'Anular órdenes de compra' },

  // Proveedores
  { id: 'perm-supp-001', module: 'suppliers', action: 'read', description: 'Consultar catálogo y estados de cuenta de proveedores' },
  { id: 'perm-supp-002', module: 'suppliers', action: 'create', description: 'Registrar nuevos proveedores' },
  { id: 'perm-supp-003', module: 'suppliers', action: 'update', description: 'Modificar datos de proveedores' },

  // Cuentas por Pagar (CxP)
  { id: 'perm-cxp-001', module: 'payables', action: 'read', description: 'Consultar cuentas por pagar y análisis de vencimiento' },
  { id: 'perm-cxp-002', module: 'payables', action: 'create', description: 'Registrar pagos y amortizaciones a proveedores' },
  { id: 'perm-cxp-003', module: 'payables', action: 'update', description: 'Modificar o anular pagos a proveedores' },

  // Inventario
  { id: 'perm-inv-001', module: 'inventory', action: 'read', description: 'Ver catálogo, stock y ubicaciones' },
  { id: 'perm-inv-002', module: 'inventory', action: 'create', description: 'Crear productos, marcas y jerarquías' },
  { id: 'perm-inv-003', module: 'inventory', action: 'update', description: 'Modificar productos y ubicaciones' },
  { id: 'perm-inv-004', module: 'inventory', action: 'adjust', description: 'Realizar ajustes de inventario' },
  { id: 'perm-inv-005', module: 'inventory', action: 'transfer', description: 'Realizar traslados entre depósitos' },
  { id: 'perm-inv-006', module: 'inventory', action: 'approve', description: 'Aprobar operaciones especiales de inventario' },
  { id: 'perm-inv-007', module: 'inventory', action: 'counts', description: 'Realizar conteos físicos y auditoría de existencias por depósito' },

  // Precios
  { id: 'perm-price-001', module: 'pricing', action: 'read', description: 'Ver listas y reglas de precios' },
  { id: 'perm-price-002', module: 'pricing', action: 'bulk_update', description: 'Ejecutar actualización masiva de precios' },
  { id: 'perm-price-003', module: 'pricing', action: 'exchange_rate', description: 'Modificar tasa de cambio oficial BCV' },
  { id: 'perm-price-004', module: 'pricing', action: 'apply_tax', description: 'Modificar tasas de impuesto con afectación' },

  // Tesorería
  { id: 'perm-tres-001', module: 'treasury', action: 'read', description: 'Consultar saldos bancarios y movimientos' },
  { id: 'perm-tres-002', module: 'treasury', action: 'create', description: 'Registrar movimientos y transferencias bancarias' },
  { id: 'perm-tres-003', module: 'treasury', action: 'reconcile', description: 'Ejecutar conciliación bancaria por extracto' },

  // Impuestos / SENIAT
  { id: 'perm-tax-001', module: 'taxes', action: 'read', description: 'Consultar retenciones y libros SENIAT' },
  { id: 'perm-tax-002', module: 'taxes', action: 'create', description: 'Emitir y anular retenciones SENIAT' },

  // Reportes
  { id: 'perm-rep-001', module: 'reports', action: 'read', description: 'Consultar catálogo general de reportes' },
  { id: 'perm-rep-002', module: 'reports', action: 'export_pdf', description: 'Exportar reportes en formato PDF' },
  { id: 'perm-rep-003', module: 'reports', action: 'export_excel', description: 'Exportar reportes en Excel / CSV' },
  { id: 'perm-rep-004', module: 'reports', action: 'sales', description: 'Acceso a Reporte General de Ventas' },
  { id: 'perm-rep-005', module: 'reports', action: 'cash_shifts', description: 'Acceso a Reporte de Cierres de Caja & Arqueos (X / Z)' },
  { id: 'perm-rep-006', module: 'reports', action: 'sales_by_cashier', description: 'Acceso a Reporte de Rendimiento y Desempeño por Cajero' },
  { id: 'perm-rep-007', module: 'reports', action: 'sales_by_product', description: 'Acceso a Reporte de Ventas y Rotación por Producto' },
  { id: 'perm-rep-008', module: 'reports', action: 'inventory_hierarchy', description: 'Acceso a Reporte de Jerarquía & Stock Valorizado' },
  { id: 'perm-rep-009', module: 'reports', action: 'restaurant_tips', description: 'Acceso a Reporte de Propinas de Restaurante por Mesero' },
  { id: 'perm-rep-010', module: 'reports', action: 'receivables_aging', description: 'Acceso a Reporte de Antigüedad de Cartera (CxC)' },
  { id: 'perm-rep-011', module: 'reports', action: 'payables_aging', description: 'Acceso a Reporte de Antigüedad de Deudas (CxP)' },
  { id: 'perm-rep-012', module: 'reports', action: 'treasury_balances', description: 'Acceso a Reporte de Posición Global de Saldos y Liquidez Bancaria' },
  { id: 'perm-rep-013', module: 'reports', action: 'bank_movements', description: 'Acceso a Reporte de Libro Auxiliar & Movimientos Bancarios' },
  { id: 'perm-rep-014', module: 'reports', action: 'bank_reconciliation', description: 'Acceso a Reporte de Conciliación Bancaria Certificada' },
  { id: 'perm-rep-015', module: 'reports', action: 'cash_flow', description: 'Acceso a Reporte de Flujo de Caja Operativo de Tesorería' },

  // Configuración
  { id: 'perm-cfg-001', module: 'config', action: 'read', description: 'Consultar configuración del sistema, empresa y sucursales' },
  { id: 'perm-cfg-002', module: 'config', action: 'write', description: 'Modificar configuración del sistema, usuarios y roles' },

  // Dashboards
  { id: 'perm-dash-001', module: 'dashboards', action: 'read', description: 'Ver dashboards e indicadores' },
  { id: 'perm-dash-002', module: 'dashboards', action: 'update', description: 'Personalizar layout de widgets' },

  // Auditoría
  { id: 'perm-aud-001', module: 'audit', action: 'read', description: 'Consultar bitácora y registros de auditoría' },

  // Restaurante & Comandas (KDS)
  { id: 'perm-rest-001', module: 'restaurant', action: 'read', description: 'Consultar mesas, comandas, consumo y catálogo de restaurante' },
  { id: 'perm-rest-002', module: 'restaurant', action: 'write', description: 'Abrir comandas, asignar meseros y tomar pedidos de mesa' },
  { id: 'perm-rest-003', module: 'restaurant', action: 'items', description: 'Agregar, modificar observaciones y anular ítems de comanda' },
  { id: 'perm-rest-004', module: 'restaurant', action: 'payments', description: 'Registrar pagos y división de cuenta (Split bill) por cliente' },
  { id: 'perm-rest-005', module: 'restaurant', action: 'close', description: 'Cerrar mesa, emitir cuenta, liberar mesa y reporte de propinas' },
  { id: 'perm-rest-006', module: 'restaurant', action: 'tables', description: 'Administrar plano de mesas, capacidades y zonas de salón' },
  { id: 'perm-rest-007', module: 'restaurant', action: 'kds', description: 'Monitoreo y despacho de comandas en Cocina y Barra (KDS)' },
  { id: 'perm-rest-008', module: 'restaurant', action: 'settings', description: 'Configurar tickets, comanderas y parámetros de restaurante' },

  // Contabilidad Senior VEN-NIF
  { id: 'perm-acc-001', module: 'accounting', action: 'read', description: 'Ver plan de cuentas, comprobantes de diario, mayor y estados financieros' },
  { id: 'perm-acc-002', module: 'accounting', action: 'write', description: 'Crear y modificar cuentas contables y comprobantes de diario en borrador' },
  { id: 'perm-acc-003', module: 'accounting', action: 'post', description: 'Asentar legalmente comprobantes en el libro diario (Aprobación)' },
  { id: 'perm-acc-004', module: 'accounting', action: 'close', description: 'Ejecutar procesos de cierre mensual/anual y ajuste por inflación' },

  // Notificaciones y Alertas
  { id: 'perm-notif-001', module: 'notifications', action: 'read', description: 'Consultar centro de notificaciones y alertas' },
  { id: 'perm-notif-002', module: 'notifications', action: 'write', description: 'Configurar preferencias y compartir reportes por correo' },
];

export async function syncSystemPermissions(): Promise<void> {
  for (const p of SYSTEM_PERMISSIONS) {
    await query(
      `INSERT INTO permissions (id, module, action, description) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [p.id, p.module, p.action, p.description]
    );
  }

  // Vincular a roles administrativos existentes
  await query(`
    INSERT IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name IN ('Super Admin', 'Administrador', 'General Manager', 'super_admin')
  `).catch(() => {});

  // Vincular permisos de restaurante al rol Mesero si existe
  await query(`
    INSERT IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE p.module = 'restaurant'
      AND (r.name LIKE '%Mesero%' OR r.name LIKE '%Camarero%' OR r.name LIKE '%Restaurante%')
  `).catch(() => {});
}

// Ejecutar solo si es invocado directamente vía CLI
if (process.argv[1] && (process.argv[1].endsWith('seedPermissions.ts') || process.argv[1].endsWith('seedPermissions.js'))) {
  syncSystemPermissions()
    .then(() => {
      console.log('Permisos sincronizados correctamente en la base de datos.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error al sincronizar permisos:', err);
      process.exit(1);
    });
}

