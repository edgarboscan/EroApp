// Constantes del Sistema ERO ERP VE

export const MODULES = {
  AUTH: 'auth',
  USERS: 'users',
  BRANCHES: 'branches',
  WAREHOUSES: 'warehouses',
  INVENTORY: 'inventory',
  PRODUCTS: 'products',
  PRICING: 'pricing',
  TAX_RATES: 'tax-rates',
  PURCHASES: 'purchases',
  SUPPLIERS: 'suppliers',
  CUSTOMERS: 'customers',
  SALES: 'sales',
  POS: 'pos',
  RECEIVABLES: 'receivables',
  PAYABLES: 'payables',
  TREASURY: 'treasury',
  TAXES: 'taxes',
  REPORTS: 'reports',
  CONFIG: 'config',
  AUDIT: 'audit',
  LICENSES: 'licenses',
  DASHBOARDS: 'dashboards',
} as const;

export type ModuleType = (typeof MODULES)[keyof typeof MODULES];

export const ACTIONS = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  EXPORT_PDF: 'export_pdf',
  EXPORT_EXCEL: 'export_excel',
  EXPORT_CSV: 'export_csv',
  ADJUST: 'adjust',
  TRANSFER: 'transfer',
  BULK_UPDATE: 'bulk_update',
  APPROVE: 'approve',
  AUTHORIZE: 'authorize',
  CLOSE_REGISTER: 'close_register',
  RECONCILE: 'reconcile',
  APPLY_TAX: 'apply_tax',
} as const;

export type ActionType = (typeof ACTIONS)[keyof typeof ACTIONS];

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  GENERAL_MANAGER: 'general_manager',
  BRANCH_MANAGER: 'branch_manager',
  ACCOUNTANT: 'accountant',
  INVENTORY_SUPERVISOR: 'inventory_supervisor',
  CASHIER: 'cashier',
  SALES_REP: 'sales_rep',
  PURCHASING_AGENT: 'purchasing_agent',
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

/**
 * Determina si una cadena de rol corresponde a Super Administrador o Administrador del ERP.
 * Normaliza y tolera variaciones como 'Super Administrador', 'super_admin', 'super admin', 'admin', 'administrador'.
 */
export function isSuperAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim().replace(/[\s_-]+/g, '');
  return (
    r === 'superadmin' ||
    r === 'superadministrador' ||
    r === 'admin' ||
    r === 'administrador' ||
    r === 'superuser' ||
    r === 'superusuario' ||
    r === 'directorgeneral' ||
    r === 'gerentegeneral' ||
    r === 'generalmanager'
  );
}

/**
 * Determina si una cadena de rol corresponde a un cargo de Administración o Supervisión
 * con jerarquía para autorizar operaciones restringidas (descuentos, stock negativo, presentaciones).
 */
export function isSupervisorOrAdminRole(role?: string | null): boolean {
  if (!role) return false;
  if (isSuperAdminRole(role)) return true;
  const r = role.toLowerCase().trim().replace(/[\s_-]+/g, '');
  return (
    r.includes('supervisor') ||
    r.includes('gerente') ||
    r.includes('director') ||
    r.includes('coordinador') ||
    r.includes('jefe') ||
    r.includes('encargado') ||
    r.includes('manager')
  );
}

/**
 * Determina si un usuario posee rango de administrador o permisos explícitos de autorización
 * (ej. pos.authorize, sales.approve, inventory.approve, sales.approve_discount).
 */
export function canAuthorizeOperations(
  role?: string | null,
  permissions?: Array<string | { module: string; action: string }> | null
): boolean {
  if (isSupervisorOrAdminRole(role)) return true;
  if (!permissions || !Array.isArray(permissions)) return false;

  const authActions = ['authorize', 'approve', 'approve_discount'];
  const authModules = ['pos', 'sales', 'inventory'];

  return permissions.some((p) => {
    if (typeof p === 'string') {
      const parts = p.toLowerCase().split(/[:.]/).map((s) => s.trim());
      if (parts.length === 2) {
        const [mod, act] = parts;
        return authModules.includes(mod) && authActions.includes(act);
      }
      return authActions.includes(p.toLowerCase());
    }
    if (p && typeof p === 'object' && p.module && p.action) {
      const mod = p.module.toLowerCase();
      const act = p.action.toLowerCase();
      return authModules.includes(mod) && authActions.includes(act);
    }
    return false;
  });
}

// Impuestos Venezolanos
export const TAX_TYPES = {
  IVA: 'IVA',
  IGTF: 'IGTF',
  ISLR: 'ISLR',
  MUNICIPAL: 'MUNICIPAL',
  EXENTO: 'EXENTO',
  EXONERADO: 'EXONERADO',
} as const;

export type TaxType = (typeof TAX_TYPES)[keyof typeof TAX_TYPES];

// Monedas
export const CURRENCIES = {
  USD: 'USD',
  VES: 'VES',
  EUR: 'EUR',
} as const;

export type CurrencyType = (typeof CURRENCIES)[keyof typeof CURRENCIES];

// Modos de Afectación de Precios e Impuestos
export const PRICE_MODES = {
  TAX_INCLUSIVE: 'tax_inclusive', // El precio mostrado ya incluye impuesto
  TAX_EXCLUSIVE: 'tax_exclusive', // El precio mostrado es base imponible
} as const;

export type PriceMode = (typeof PRICE_MODES)[keyof typeof PRICE_MODES];

// Modos de Actualización Masiva de Precios
export const BULK_PRICE_UPDATE_MODES = {
  PERCENTAGE: 'percentage',           // +/- %
  FIXED_AMOUNT: 'fixed_amount',       // +/- Monto
  ABSOLUTE_PRICE: 'absolute_price',   // Nuevo precio fijo
  MARGIN_OVER_COST: 'margin_over_cost', // Costo + Margen %
  ROUNDING_ONLY: 'rounding_only',     // Aplicar solo regla de redondeo
} as const;

export type BulkPriceUpdateMode = (typeof BULK_PRICE_UPDATE_MODES)[keyof typeof BULK_PRICE_UPDATE_MODES];

// Reglas de Redondeo
export const ROUNDING_RULES = {
  NONE: 0,
  CENTS_05: 0.05,
  CENTS_10: 0.10,
  CENTS_50: 0.50,
  INTEGER_100: 1.00,
} as const;

export type RoundingRule = (typeof ROUNDING_RULES)[keyof typeof ROUNDING_RULES];

// Tipos de Widgets para Dashboards
export const WIDGET_TYPES = {
  KPI: 'kpi',
  CHART_LINE: 'chart_line',
  CHART_BAR: 'chart_bar',
  CHART_PIE: 'chart_pie',
  TABLE: 'table',
  LIST: 'list',
  GAUGE: 'gauge',
} as const;

export type WidgetType = (typeof WIDGET_TYPES)[keyof typeof WIDGET_TYPES];

// Modos de Impresión / Facturación POS
export const POS_INVOICE_MODES = {
  FISCAL_PRINTER: 'fiscal_printer',
  FISCAL_EMAIL: 'fiscal_email',
  NORMAL_PRINTER: 'normal_printer',
  NORMAL_EMAIL: 'normal_email',
} as const;

export type POSInvoiceMode = (typeof POS_INVOICE_MODES)[keyof typeof POS_INVOICE_MODES];
