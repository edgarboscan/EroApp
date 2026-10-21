export interface AppNavRoute {
  path: string;
  module: string;
  action: string;
}

/**
 * Orden de prioridad de las rutas principales del ERP.
 * Si el usuario posee permisos para el Dashboard ('dashboards.read'), será dirigido allí.
 * De lo contrario, se redirige al primer módulo que tenga permitido (por ejemplo POS para cajeros).
 */
export const APP_ROUTES_PRIORITY: AppNavRoute[] = [
  { path: '/dashboard', module: 'dashboards', action: 'read' },
  { path: '/pos/caja', module: 'pos', action: 'read' },
  { path: '/pos/cierre', module: 'pos', action: 'close_register' },
  { path: '/pos/auditoria-arqueos', module: 'pos', action: 'audit_shifts' },
  { path: '/sales/quotations', module: 'sales', action: 'read' },
  { path: '/sales/deliveries', module: 'sales', action: 'read' },
  { path: '/customers', module: 'customers', action: 'read' },
  { path: '/receivables', module: 'receivables', action: 'read' },
  { path: '/purchases/orders', module: 'purchases', action: 'read' },
  { path: '/purchases/receipts', module: 'purchases', action: 'read' },
  { path: '/suppliers', module: 'suppliers', action: 'read' },
  { path: '/payables', module: 'payables', action: 'read' },
  { path: '/inventory/products', module: 'inventory', action: 'read' },
  { path: '/inventory/hierarchy', module: 'inventory', action: 'read' },
  { path: '/inventory/locations', module: 'inventory', action: 'read' },
  { path: '/inventory/kardex', module: 'inventory', action: 'read' },
  { path: '/inventory/adjustments', module: 'inventory', action: 'adjust' },
  { path: '/inventory/transfers', module: 'inventory', action: 'transfer' },
  { path: '/pricing/bulk-update', module: 'pricing', action: 'bulk_update' },
  { path: '/pricing/tax-rates', module: 'pricing', action: 'apply_tax' },
  { path: '/treasury', module: 'treasury', action: 'read' },
  { path: '/taxes/withholdings', module: 'taxes', action: 'read' },
  { path: '/taxes/books/purchases', module: 'taxes', action: 'read' },
  { path: '/taxes/books/sales', module: 'taxes', action: 'read' },
  { path: '/taxes/arcv', module: 'taxes', action: 'read' },
  { path: '/reports', module: 'reports', action: 'read' },
  { path: '/config/company', module: 'config', action: 'read' },
  { path: '/config/payment-methods', module: 'config', action: 'read' },
  { path: '/config/users', module: 'config', action: 'read' },
  { path: '/config/licenses', module: 'config', action: 'read' },
  { path: '/audit/logs', module: 'audit', action: 'read' },
];

/**
 * Obtiene la ruta inicial por defecto según los permisos del usuario activo.
 */
export function getDefaultAppRoute(hasPermission: (module: string, action: string) => boolean): string {
  for (const item of APP_ROUTES_PRIORITY) {
    if (hasPermission(item.module, item.action)) {
      return item.path;
    }
  }
  return '/pos/caja'; // Fallback seguro
}
