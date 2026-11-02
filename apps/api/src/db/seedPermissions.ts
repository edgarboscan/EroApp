import { query } from './index';

export const SYSTEM_PERMISSIONS = [
  // POS
  { id: 'perm-pos-001', module: 'pos', action: 'read', description: 'Menú Ventas > Punto de Venta (POS) - Acceso a pantalla y operación de facturación en caja' },
  { id: 'perm-pos-002', module: 'pos', action: 'create', description: 'Menú Ventas > Punto de Venta (POS) - Apertura de turno de caja e inicio de operaciones' },
  { id: 'perm-pos-003', module: 'pos', action: 'close_register', description: 'Menú Ventas > Cierre de Caja & Arqueo - Realizar corte X / Z, arqueo ciego y cierre de turno' },
  { id: 'perm-pos-004', module: 'pos', action: 'authorize', description: 'Menú Ventas > POS - Autorizar operaciones restringidas (Venta con stock negativo, precios especiales, descuentos)' },
  { id: 'perm-pos-005', module: 'pos', action: 'audit_shifts', description: 'Menú Ventas > Verificación de Arqueos - Auditar arqueos de caja, dictaminar diferencias y registrar depósitos bancarios' },

  // Ventas
  { id: 'perm-sales-001', module: 'sales', action: 'read', description: 'Menú Ventas > Cotizaciones y Facturas - Consultar documentos de venta, despachos y presupuestos' },
  { id: 'perm-sales-002', module: 'sales', action: 'create', description: 'Menú Ventas - Crear y emitir facturas de venta, cotizaciones y notas de entrega' },
  { id: 'perm-sales-003', module: 'sales', action: 'update', description: 'Menú Ventas - Editar y modificar cotizaciones y notas de venta en borrador' },
  { id: 'perm-sales-004', module: 'sales', action: 'delete', description: 'Menú Ventas - Anular facturas, cotizaciones y notas de entrega' },
  { id: 'perm-sales-005', module: 'sales', action: 'approve', description: 'Menú Ventas - Autorizar ventas a crédito o con condiciones especiales' },
  { id: 'perm-sales-006', module: 'sales', action: 'approve_discount', description: 'Menú Ventas - Aprobar descuentos comerciales y promociones en ventas' },
  { id: 'perm-sales-007', module: 'sales', action: 'credit_notes', description: 'Menú Ventas > Notas de Crédito & Débito - Emitir devoluciones, notas de crédito y notas de débito' },

  // Clientes
  { id: 'perm-cust-001', module: 'customers', action: 'read', description: 'Menú Ventas > Directorio de Clientes - Consultar catálogo, fichas y datos de clientes' },
  { id: 'perm-cust-002', module: 'customers', action: 'create', description: 'Menú Ventas > Clientes - Crear y registrar nuevos clientes en el directorio' },
  { id: 'perm-cust-003', module: 'customers', action: 'update', description: 'Menú Ventas > Clientes - Editar datos fiscales, contactos y límites de crédito de clientes' },
  { id: 'perm-cust-004', module: 'customers', action: 'delete', description: 'Menú Ventas > Clientes - Anular, desactivar o eliminar clientes del directorio' },

  // Cuentas por Cobrar (CxC)
  { id: 'perm-cxc-001', module: 'receivables', action: 'read', description: 'Menú Ventas > Cuentas por Cobrar (CxC) - Consultar facturas pendientes, estados de cuenta y cartera' },
  { id: 'perm-cxc-002', module: 'receivables', action: 'create', description: 'Menú Ventas > Cuentas por Cobrar (CxC) - Registrar cobros, abonos e ingresos de clientes' },

  // Compras
  { id: 'perm-purch-001', module: 'purchases', action: 'read', description: 'Menú Compras > Órdenes de Compra - Consultar historial de compras y recepciones' },
  { id: 'perm-purch-002', module: 'purchases', action: 'create', description: 'Menú Compras - Crear órdenes de compra y registrar recepciones de mercancía con factura' },
  { id: 'perm-purch-003', module: 'purchases', action: 'update', description: 'Menú Compras - Editar y modificar órdenes de compra en estado borrador' },
  { id: 'perm-purch-004', module: 'purchases', action: 'delete', description: 'Menú Compras - Anular órdenes de compra o recepciones de proveedor' },

  // Proveedores
  { id: 'perm-supp-001', module: 'suppliers', action: 'read', description: 'Menú Compras > Directorio de Proveedores - Consultar catálogo, fichas y cuentas de proveedores' },
  { id: 'perm-supp-002', module: 'suppliers', action: 'create', description: 'Menú Compras > Proveedores - Crear y registrar nuevos proveedores en el catálogo' },
  { id: 'perm-supp-003', module: 'suppliers', action: 'update', description: 'Menú Compras > Proveedores - Editar datos fiscales, comerciales y formas de pago de proveedores' },

  // Cuentas por Pagar (CxP)
  { id: 'perm-cxp-001', module: 'payables', action: 'read', description: 'Menú Compras > Cuentas por Pagar (CxP) - Consultar deudas pendientes y compromisos con proveedores' },
  { id: 'perm-cxp-002', module: 'payables', action: 'create', description: 'Menú Compras > Cuentas por Pagar (CxP) - Registrar pagos, transferencias y amortizaciones a proveedores' },
  { id: 'perm-cxp-003', module: 'payables', action: 'update', description: 'Menú Compras > Cuentas por Pagar (CxP) - Modificar o anular comprobantes de pago a proveedores' },

  // Inventario
  { id: 'perm-inv-001', module: 'inventory', action: 'read', description: 'Menú Inventario > Catálogo & Kardex - Consultar productos, existencias por almacén y movimientos' },
  { id: 'perm-inv-002', module: 'inventory', action: 'create', description: 'Menú Inventario > Catálogo - Crear nuevos productos, departamentos, grupos y subgrupos' },
  { id: 'perm-inv-003', module: 'inventory', action: 'update', description: 'Menú Inventario > Catálogo - Editar y modificar datos, PVP, costos, impuestos y ubicaciones de productos' },
  { id: 'perm-inv-004', module: 'inventory', action: 'adjust', description: 'Menú Inventario > Ajustes de Inventario - Registrar entradas y salidas por ajustes físicos o mermas' },
  { id: 'perm-inv-005', module: 'inventory', action: 'transfer', description: 'Menú Inventario > Traslados entre Depósitos - Crear y procesar transferencias de stock entre depósitos' },
  { id: 'perm-inv-006', module: 'inventory', action: 'approve', description: 'Menú Inventario - Autorizar ajustes extraordinarios, transferencias críticas y mermas' },
  { id: 'perm-inv-007', module: 'inventory', action: 'counts', description: 'Menú Inventario > Conteo de Productos - Toma física de inventario, registro de conteos y cálculo de mermas' },

  // Precios
  { id: 'perm-price-001', module: 'pricing', action: 'read', description: 'Menú Precios - Consultar listas de precios, reglas de margen y alícuotas fiscales' },
  { id: 'perm-price-002', module: 'pricing', action: 'bulk_update', description: 'Menú Precios > Cambio Masivo de Precios - Modificar masivamente precios de venta por departamento o grupo' },
  { id: 'perm-price-003', module: 'pricing', action: 'exchange_rate', description: 'Menú Configuración > Monedas & Tasa BCV - Modificar y sincronizar la tasa de cambio oficial BCV' },
  { id: 'perm-price-004', module: 'pricing', action: 'apply_tax', description: 'Menú Precios > Tasas de Impuestos - Configurar alícuotas de IVA y asociarlas a los productos' },

  // Tesorería
  { id: 'perm-tres-001', module: 'treasury', action: 'read', description: 'Menú Tesorería > Posición Bancaria - Consultar cuentas bancarias, saldos y movimientos' },
  { id: 'perm-tres-002', module: 'treasury', action: 'create', description: 'Menú Tesorería > Movimientos Bancarios - Registrar transferencias, depósitos y comisiones' },
  { id: 'perm-tres-003', module: 'treasury', action: 'reconcile', description: 'Menú Tesorería > Conciliación Bancaria - Importar extractos y ejecutar conciliación de cuentas' },

  // Impuestos / SENIAT
  { id: 'perm-tax-001', module: 'taxes', action: 'read', description: 'Menú Tributos SENIAT - Consultar retenciones de IVA/ISLR y libros fiscales de compras y ventas' },
  { id: 'perm-tax-002', module: 'taxes', action: 'create', description: 'Menú Tributos SENIAT - Emitir y anular comprobantes de retención de IVA e ISLR' },
  { id: 'perm-tax-003', module: 'taxes', action: 'export_seniat', description: 'Menú Tributos SENIAT - Exportar archivos XML/TXT para declaración legal en el portal SENIAT' },

  // Reportes
  { id: 'perm-rep-001', module: 'reports', action: 'read', description: 'Menú Reportes - Acceso al módulo y visualizador general de reportes' },
  { id: 'perm-rep-002', module: 'reports', action: 'export_pdf', description: 'Menú Reportes - Exportar y descargar reportes oficiales en formato PDF' },
  { id: 'perm-rep-003', module: 'reports', action: 'export_excel', description: 'Menú Reportes - Exportar reportes en formato Excel / CSV' },
  { id: 'perm-rep-004', module: 'reports', action: 'sales', description: 'Menú Reportes > Ventas Generales - Reporte detallado de ventas, bases gravables, IVA, IGTF y formas de cobro' },
  { id: 'perm-rep-005', module: 'reports', action: 'cash_shifts', description: 'Menú Reportes > Cierres de Caja - Reporte de cierres de lote POS, cuadres X/Z y depósitos de recaudación' },
  { id: 'perm-rep-006', module: 'reports', action: 'sales_by_cashier', description: 'Menú Reportes > Desempeño por Cajero - Rendimiento, facturas procesadas y volumen por cajero' },
  { id: 'perm-rep-007', module: 'reports', action: 'sales_by_product', description: 'Menú Reportes > Ventas por Producto - Ranking de rotación, cantidades vendidas y volumen facturado' },
  { id: 'perm-rep-008', module: 'reports', action: 'inventory_hierarchy', description: 'Menú Reportes > Jerarquía & Stock Valorizado - Existencias y valoración por departamento, grupo y subgrupo' },
  { id: 'perm-rep-009', module: 'reports', action: 'restaurant_tips', description: 'Menú Reportes > Propinas de Restaurante - Reporte de propinas recaudadas por mesero en comandas' },
  { id: 'perm-rep-010', module: 'reports', action: 'receivables_aging', description: 'Menú Reportes > Antigüedad Cartera (CxC) - Vencimientos de facturas a crédito por cobrar a clientes' },
  { id: 'perm-rep-011', module: 'reports', action: 'payables_aging', description: 'Menú Reportes > Antigüedad Deudas (CxP) - Vencimientos de cuentas por pagar a proveedores' },
  { id: 'perm-rep-012', module: 'reports', action: 'treasury_balances', description: 'Menú Reportes > Posición Bancaria & Liquidez - Saldos consolidados de cuentas bancarias en Bs y USD' },
  { id: 'perm-rep-013', module: 'reports', action: 'bank_movements', description: 'Menú Reportes > Movimientos de Cuenta - Libro auxiliar cronológico de cargos y abonos bancarios' },
  { id: 'perm-rep-014', module: 'reports', action: 'bank_reconciliation', description: 'Menú Reportes > Acta de Conciliación - Dictamen formal y partidas en tránsito de conciliación bancaria' },
  { id: 'perm-rep-015', module: 'reports', action: 'cash_flow', description: 'Menú Reportes > Flujo de Caja Operativo - Entradas y salidas de liquidez de tesorería' },

  // Configuración
  { id: 'perm-cfg-001', module: 'config', action: 'read', description: 'Menú Configuración - Consultar datos de empresa, sucursales y parámetros generales' },
  { id: 'perm-cfg-002', module: 'config', action: 'write', description: 'Menú Configuración > Usuarios & Permisos - Crear y editar usuarios, sucursales y matriz de roles y permisos' },

  // Dashboards
  { id: 'perm-dash-001', module: 'dashboards', action: 'read', description: 'Menú Inicio > Dashboards - Consultar paneles e indicadores ejecutivos del negocio' },
  { id: 'perm-dash-002', module: 'dashboards', action: 'update', description: 'Menú Inicio > Dashboards - Personalizar y configurar widgets del panel' },

  // Auditoría
  { id: 'perm-aud-001', module: 'audit', action: 'read', description: 'Menú Configuración > Bitácora de Auditoría - Consultar registros y trazabilidad de operaciones del sistema' },

  // Restaurante & Comandas (KDS)
  { id: 'perm-rest-001', module: 'restaurant', action: 'read', description: 'Menú Restaurante > Toma de Pedidos - Ver plano de mesas, comandas abiertas y estados de salón' },
  { id: 'perm-rest-002', module: 'restaurant', action: 'write', description: 'Menú Restaurante > Comandas - Crear y abrir nuevas comandas de salón, barra o delivery' },
  { id: 'perm-rest-003', module: 'restaurant', action: 'items', description: 'Menú Restaurante > Comandas - Agregar platos, bebidas, observaciones y anular ítems' },
  { id: 'perm-rest-004', module: 'restaurant', action: 'payments', description: 'Menú Restaurante > Cobro de Comandas - Cobrar cuentas, procesar pagos y división de cuenta (Split Bill)' },
  { id: 'perm-rest-005', module: 'restaurant', action: 'close', description: 'Menú Restaurante > Cierre de Mesa - Cerrar cuenta, emitir ticket fiscal/pre-cuenta y liberar mesas' },
  { id: 'perm-rest-006', module: 'restaurant', action: 'tables', description: 'Menú Restaurante > Salones & Mesas - Diseñar y editar planos de salón y distribución de mesas' },
  { id: 'perm-rest-007', module: 'restaurant', action: 'kds', description: 'Menú Restaurante > Cocina & Barra (KDS) - Pantalla de comandas para preparar y despachar pedidos' },
  { id: 'perm-rest-008', module: 'restaurant', action: 'settings', description: 'Menú Restaurante > Configuración - Parámetros operativos, comanderas y tickets de restaurante' },

  // Contabilidad Senior VEN-NIF
  { id: 'perm-acc-001', module: 'accounting', action: 'read', description: 'Menú Contabilidad - Consultar plan de cuentas, diario, mayor, balance y estados financieros' },
  { id: 'perm-acc-002', module: 'accounting', action: 'write', description: 'Menú Contabilidad - Crear y modificar cuentas contables y asientos de diario en borrador' },
  { id: 'perm-acc-003', module: 'accounting', action: 'post', description: 'Menú Contabilidad - Asentar y aprobar legalmente asientos en el libro diario contable' },
  { id: 'perm-acc-004', module: 'accounting', action: 'close', description: 'Menú Contabilidad > Cierres & Ajuste Inflación - Ejecutar cierres mensuales/anuales y ajuste por inflación DPC-10' },

  // Notificaciones y Alertas
  { id: 'perm-notif-001', module: 'notifications', action: 'read', description: 'Barra Superior > Notificaciones - Ver centro de notificaciones y alertas operativas' },
  { id: 'perm-notif-002', module: 'notifications', action: 'write', description: 'Barra Superior > Notificaciones - Gestionar preferencias y descartar notificaciones' },

  // Chat Interno & Bitácora de Conversaciones
  { id: 'perm-chat-001', module: 'chat', action: 'read', description: 'Barra Superior > Chat Interno - Enviar y recibir mensajes directos con otros usuarios, usar emoticones y mantener conversaciones' },
  { id: 'perm-chat-002', module: 'chat', action: 'audit', description: 'Menú Configuración > Bitácora de Chat - Visualizar historial y bitácora completa de conversaciones entre todos los usuarios del sistema' },
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

