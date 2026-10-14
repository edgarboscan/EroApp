import { describe, it, expect } from 'vitest';
import {
  updateCompanySchema,
  branchSchema,
  warehouseSchema,
  updateBusinessRulesSchema,
  licenseActivationSchema,
  generateLicenseSchema,
  auditLogFilterSchema,
} from '@ero/shared';
import { LicensesService } from '../src/modules/licenses/licenses.service';

describe('Módulo de Configuración Empresarial, Licencias & Auditoría (Paso 10)', () => {
  const validBranchId = '11111111-1111-1111-1111-111111111111';

  describe('Validación de Perfil de Empresa (SENIAT)', () => {
    it('debe validar un perfil de empresa con RIF venezolano válido y condición especial', () => {
      const result = updateCompanySchema.safeParse({
        legalName: 'CORPORACION VENEZOLANA ERO C.A.',
        tradeName: 'ERO DISTRIBUCION',
        rif: 'J-12345678-9',
        fiscalAddress: 'Av. Francisco de Miranda, Torre Cavendes, Caracas',
        phone: '+58 212 555-0199',
        email: 'admin@erove.com',
        isSpecialTaxpayer: true,
        ivaRetentionRate: 75.0,
        currencyBase: 'USD',
        currencySecondary: 'VES',
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar un RIF con formato inválido', () => {
      const result = updateCompanySchema.safeParse({
        legalName: 'EMPRESA PRUEBA',
        rif: '12345678-9', // falta letra de RIF
        fiscalAddress: 'Caracas, Venezuela',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Validación de Sucursales y Almacenes Multi-Sucursal', () => {
    it('debe validar la creación de una sucursal con código y nombre', () => {
      const result = branchSchema.safeParse({
        code: 'SUC-03',
        name: 'Sucursal Valencia Centro',
        address: 'Av. Bolívar Norte, Valencia',
        isMain: false,
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it('debe validar la creación de un depósito asociado a una sucursal', () => {
      const result = warehouseSchema.safeParse({
        branchId: validBranchId,
        code: 'ALM-V01',
        name: 'Almacén Mayorista Valencia',
        isDefault: true,
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar un almacén sin branchId válido', () => {
      const result = warehouseSchema.safeParse({
        branchId: 'invalid-id',
        code: 'ALM-01',
        name: 'Almacén Central',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Validación de Reglas de Negocio Comerciales', () => {
    it('debe validar reglas de negocio con retención fiscal legal mínima de 5 años', () => {
      const result = updateBusinessRulesSchema.safeParse({
        allowCreditSales: true,
        requireApprovalDiscount: true,
        maxDiscountAllowed: 15.0,
        posInvoiceMode: 'fiscal_printer',
        taxAffectsFinalPrice: true,
        enforceCreditLimit: true,
        retentionPeriodYears: 5,
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar un período de retención menor al mínimo legal de 5 años', () => {
      const result = updateBusinessRulesSchema.safeParse({
        allowCreditSales: true,
        retentionPeriodYears: 3, // Menor a 5 años
      });
      expect(result.success).toBe(false);
    });

    it('debe rechazar un porcentaje de descuento superior al 100%', () => {
      const result = updateBusinessRulesSchema.safeParse({
        maxDiscountAllowed: 120.0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Licenciamiento & Hardware Fingerprint', () => {
    it('debe generar un hardware fingerprint determinista y con longitud adecuada', () => {
      const fp1 = LicensesService.getHardwareFingerprint();
      const fp2 = LicensesService.getHardwareFingerprint();
      expect(fp1).toBeDefined();
      expect(fp1.length).toBe(32);
      expect(fp1).toBe(fp2);
    });

    it('debe validar el esquema de activación de licencia con clave y fingerprint', () => {
      const result = licenseActivationSchema.safeParse({
        licenseKey: 'ERO-ENTERPRISE-2026-X992-K821-V44',
        hardwareFingerprint: 'A1B2C3D4E5F60718293A4B5C6D7E8F90',
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar una clave de licencia demasiado corta', () => {
      const result = licenseActivationSchema.safeParse({
        licenseKey: 'KEY-123',
        hardwareFingerprint: 'A1B2C3D4E5F60718293A4B5C6D7E8F90',
      });
      expect(result.success).toBe(false);
    });

    it('debe validar el esquema de emisión de licencia con datos de empresa, usuarios y módulos', () => {
      const result = generateLicenseSchema.safeParse({
        companyName: 'AGROPECUARIA LOS LLANOS C.A.',
        companyRif: 'J-29837461-0',
        hardwareFingerprint: 'A1B2C3D4E5F60718293A4B5C6D7E8F90',
        type: 'temporal',
        durationMonths: 12,
        maxUsers: 25,
        maxBranches: 5,
        hasSupport: true,
        modulesAllowed: ['pos', 'sales', 'inventory', 'pricing', 'reports'],
      });
      expect(result.success).toBe(true);
    });

    it('debe rechazar la emisión de licencia sin módulos o sin RIF', () => {
      const result = generateLicenseSchema.safeParse({
        companyName: 'EMPRESA INCOMPLETA',
        companyRif: '',
        hardwareFingerprint: 'A1B2C3D4E5F60718293A4B5C6D7E8F90',
        type: 'perpetua',
        maxUsers: 10,
        maxBranches: 2,
        hasSupport: true,
        modulesAllowed: [],
      });
      expect(result.success).toBe(false);
    });

    it('debe emitir y firmar criptográficamente un paquete de licencia con verificación íntegra', async () => {
      const currentFp = LicensesService.getHardwareFingerprint();
      const issued = await LicensesService.issueLicense({
        companyName: 'CORPORACION ERO VE C.A.',
        companyRif: 'J-50123456-9',
        hardwareFingerprint: currentFp,
        type: 'temporal',
        durationMonths: 6,
        maxUsers: 30,
        maxBranches: 4,
        hasSupport: true,
        modulesAllowed: ['pos', 'inventory', 'pricing', 'treasury', 'taxes'],
      });

      expect(issued.licenseKey).toMatch(/^ERO-PRO-\d{4}-/);
      expect(issued.licensePackage).toMatch(/^ERO-PKG\./);
      expect(issued.licenseInfo.companyName).toBe('CORPORACION ERO VE C.A.');
      expect(issued.licenseInfo.companyRif).toBe('J-50123456-9');
      expect(issued.licenseInfo.maxUsers).toBe(30);
      expect(issued.licenseInfo.maxBranches).toBe(4);
      expect(issued.licenseInfo.hasSupport).toBe(true);

      const verified = LicensesService.verifyLicensePackage(issued.licensePackage);
      expect(verified).not.toBeNull();
      expect(verified?.companyName).toBe('CORPORACION ERO VE C.A.');
      expect(verified?.fp).toBe(currentFp);
    });
  });

  describe('Filtros de Bitácora de Auditoría', () => {
    it('debe validar filtros de auditoría con paginación', () => {
      const result = auditLogFilterSchema.safeParse({
        module: 'sales',
        action: 'convert_to_invoice',
        page: 1,
        limit: 25,
      });
      expect(result.success).toBe(true);
    });
  });
});
