import { z } from 'zod';

// ==========================================
// 1. Configuración de Empresa (Company Profile)
// ==========================================
export const updateCompanySchema = z.object({
  legalName: z.string().min(2, 'La razón social debe tener al menos 2 caracteres').max(150),
  tradeName: z.string().max(150).optional().nullable(),
  rif: z.string().regex(/^[JVEGjveg]-[0-9]{8}-[0-9]$/, 'El formato del RIF debe ser válido (ej. J-12345678-9)'),
  fiscalAddress: z.string().min(5, 'La dirección fiscal es obligatoria'),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email('Correo electrónico no válido').optional().nullable(),
  isSpecialTaxpayer: z.boolean().default(true),
  ivaRetentionRate: z.number().min(0).max(100).default(75.0),
  currencyBase: z.enum(['USD', 'VES']).default('USD'),
  currencySecondary: z.enum(['USD', 'VES']).default('VES'),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ==========================================
// 2. Sucursales (Branches)
// ==========================================
export const branchSchema = z.object({
  code: z.string().min(2, 'El código debe tener al menos 2 caracteres').max(20),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  address: z.string().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  isMain: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type BranchInput = z.infer<typeof branchSchema>;

export const updateBranchSchema = branchSchema.partial();
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

// ==========================================
// 3. Depósitos / Almacenes (Warehouses)
// ==========================================
export const warehouseSchema = z.object({
  branchId: z.string().uuid('ID de sucursal requerido'),
  code: z.string().min(2, 'El código debe tener al menos 2 caracteres').max(20),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;

export const updateWarehouseSchema = warehouseSchema.partial();
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

// ==========================================
// 4. Reglas de Negocio (Business Rules)
// ==========================================
export const updateBusinessRulesSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  allowCreditSales: z.boolean().default(true),
  requireApprovalDiscount: z.boolean().default(true),
  maxDiscountAllowed: z.number().min(0).max(100).default(10.0),
  posInvoiceMode: z.enum(['normal_printer', 'fiscal_printer', 'electronic']).default('normal_printer'),
  salesInvoiceMode: z.enum(['fiscal_printer', 'free_form', 'no_fiscal']).default('free_form'),
  taxAffectsFinalPrice: z.boolean().default(true),
  enforceCreditLimit: z.boolean().default(true),
  requireApprovalCreditExceeded: z.boolean().default(true),
  allowNegativeStock: z.boolean().default(true),
  requireApprovalNegativeStock: z.boolean().default(true),
  retentionPeriodYears: z.number().int().min(5, 'El período mínimo de auditoría fiscal es de 5 años').default(5),
});

export type UpdateBusinessRulesInput = z.infer<typeof updateBusinessRulesSchema>;

// ==========================================
// 5. Licenciamiento & Hardware Fingerprint
// ==========================================
export const licenseActivationSchema = z.object({
  licenseKey: z.string().min(16, 'La clave de activación debe tener al menos 16 caracteres'),
  hardwareFingerprint: z.string().min(8, 'Identificador de hardware requerido'),
});

export type LicenseActivationInput = z.infer<typeof licenseActivationSchema>;

export const generateLicenseSchema = z.object({
  companyName: z.string().min(2, 'El nombre de la empresa es requerido'),
  companyRif: z.string().min(3, 'El RIF o Cédula es requerido'),
  hardwareFingerprint: z.string().min(8, 'Identificador de hardware requerido'),
  type: z.enum(['trial', 'temporal', 'perpetua']),
  durationMonths: z.number().int().min(1).max(120).optional(),
  maxUsers: z.number().int().min(1, 'Mínimo 1 usuario').max(10000),
  maxBranches: z.number().int().min(1, 'Mínimo 1 sucursal').max(1000),
  hasSupport: z.boolean().default(true),
  modulesAllowed: z.array(z.string()).min(1, 'Debe incluir al menos un módulo'),
});

export type GenerateLicenseInput = z.infer<typeof generateLicenseSchema>;

export interface LicenseInfo {
  id: string;
  companyId: string;
  companyName?: string;
  companyRif?: string;
  licenseKey: string;
  type: 'trial' | 'temporal' | 'perpetua';
  expiresAt: string | null;
  hardwareFingerprint: string;
  modulesAllowed: string[];
  maxUsers: number;
  maxBranches: number;
  hasSupport?: boolean;
  isActive: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'INVALID_HARDWARE';
  daysRemaining: number | null;
}

// ==========================================
// 6. Auditoría Integral (Audit Logs)
// ==========================================
export const auditLogFilterSchema = z.object({
  module: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
});

export type AuditLogFilterInput = z.infer<typeof auditLogFilterSchema>;

export interface AuditLogEntry {
  id: string;
  companyId: string;
  branchId?: string | null;
  userId?: string | null;
  userName?: string | null;
  module: string;
  action: string;
  entity: string;
  entityId?: string | null;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

// ==========================================
// 7. Gestión de Usuarios y Permisos
// ==========================================
export const createUserSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(50),
  email: z.string().email('Correo electrónico no válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  fullName: z.string().min(2, 'El nombre completo es requerido').max(100),
  roleId: z.string().min(1, 'El rol es requerido'),
  is2faEnabled: z.boolean().default(false),
  isActive: z.boolean().default(true),
  allBranches: z.boolean().default(true),
  canSwitchWarehouses: z.boolean().default(true),
  branchIds: z.array(z.string()).optional(),
  warehouseIds: z.array(z.string()).optional(),
  warehouseByBranch: z.record(z.string(), z.string()).optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().or(z.literal('')),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

