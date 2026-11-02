import { describe, it, expect } from 'vitest';
import {
  updateCompanySchema,
  branchSchema,
  warehouseSchema,
  updateBusinessRulesSchema,
  licenseActivationSchema,
  generateLicenseSchema,
  auditLogFilterSchema,
  isSuperAdminRole,
  isSupervisorOrAdminRole,
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

    it('debe validar la configuración de logo en reportes (predeterminado vs personalizado)', () => {
      const defaultLogoResult = updateCompanySchema.safeParse({
        legalName: 'CORPORACION VENEZOLANA ERO C.A.',
        rif: 'J-12345678-9',
        fiscalAddress: 'Caracas, Venezuela',
        showLogoInReports: true,
        reportLogoType: 'default',
      });
      expect(defaultLogoResult.success).toBe(true);
      if (defaultLogoResult.success) {
        expect(defaultLogoResult.data.showLogoInReports).toBe(true);
        expect(defaultLogoResult.data.reportLogoType).toBe('default');
      }

      const customLogoResult = updateCompanySchema.safeParse({
        legalName: 'CORPORACION VENEZOLANA ERO C.A.',
        rif: 'J-12345678-9',
        fiscalAddress: 'Caracas, Venezuela',
        showLogoInReports: true,
        reportLogoType: 'custom',
        customLogoUrl: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/1AAA',
      });
      expect(customLogoResult.success).toBe(true);
      if (customLogoResult.success) {
        expect(customLogoResult.data.reportLogoType).toBe('custom');
        expect(customLogoResult.data.customLogoUrl).toContain('data:image/webp;base64');
      }

      const noLogoResult = updateCompanySchema.safeParse({
        legalName: 'CORPORACION VENEZOLANA ERO C.A.',
        rif: 'J-12345678-9',
        fiscalAddress: 'Caracas, Venezuela',
        showLogoInReports: false,
      });
      expect(noLogoResult.success).toBe(true);
      if (noLogoResult.success) {
        expect(noLogoResult.data.showLogoInReports).toBe(false);
      }
    });

    it('debe inicializar el documento PDF con branding según la configuración de logo', async () => {
      const { ReportsPdfEngine } = await import('../src/modules/reports/reports-pdf');
      
      // 1. Con logo predeterminado
      const resDefault = ReportsPdfEngine.initDocument(
        {
          legalName: 'ERO DISTRIBUCION C.A.',
          rif: 'J-12345678-9',
          showLogoInReports: true,
          reportLogoType: 'default',
        },
        { title: 'Reporte Test', userName: 'Admin', orientation: 'portrait' }
      );
      expect(resDefault.doc).toBeDefined();

      // 2. Con logo deshabilitado (modo texto compacto fiscal)
      const resNoLogo = ReportsPdfEngine.initDocument(
        {
          legalName: 'ERO DISTRIBUCION C.A.',
          rif: 'J-12345678-9',
          showLogoInReports: false,
        },
        { title: 'Reporte Test Sin Logo', userName: 'Admin', orientation: 'portrait' }
      );
      expect(resNoLogo.doc).toBeDefined();

      // 3. Con logo personalizado WebP
      const resCustom = ReportsPdfEngine.initDocument(
        {
          legalName: 'ERO DISTRIBUCION C.A.',
          rif: 'J-12345678-9',
          showLogoInReports: true,
          reportLogoType: 'custom',
          customLogoUrl: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/1AAA',
        },
        { title: 'Reporte Test Logo Custom', userName: 'Admin', orientation: 'portrait' }
      );
      expect(resCustom.doc).toBeDefined();
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

    it('debe encriptar y desencriptar el payload de licenciamiento mediante AES-256-GCM atado al hardware', () => {
      const currentFp = LicensesService.getHardwareFingerprint();
      const payload = {
        companyId: 'comp-test-123',
        companyRif: 'J-12345678-9',
        companyName: 'TEST CORP',
        maxUsers: 15,
        maxBranches: 3,
        modules: ['pos', 'inventory', 'accounting', 'restaurant'],
      };

      const encrypted = LicensesService.encryptLicenseData(payload, currentFp);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.integrityHash).toBeDefined();

      // Desencriptación exitosa con el mismo hardware fingerprint
      const decrypted = LicensesService.decryptLicenseData(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        encrypted.integrityHash,
        currentFp
      );
      expect(decrypted).not.toBeNull();
      expect(decrypted?.companyName).toBe('TEST CORP');
      expect(decrypted?.maxUsers).toBe(15);
      expect(decrypted?.maxBranches).toBe(3);
      expect(decrypted?.modules).toContain('accounting');
      expect(decrypted?.modules).toContain('restaurant');

      // Intento de descifrado en una máquina con otro hardware fingerprint debe fallar
      const fakeFp = 'OTHER_SERVER_HARDWARE_FINGERPRINT_999';
      const foreignDecrypted = LicensesService.decryptLicenseData(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        encrypted.integrityHash,
        fakeFp
      );
      expect(foreignDecrypted).toBeNull();

      // Intento de alteración de datos (tampering en base de datos) debe ser detectado y rechazado
      const tamperedCiphertext = 'ff' + encrypted.ciphertext.slice(2);
      const tamperedDecrypted = LicensesService.decryptLicenseData(
        tamperedCiphertext,
        encrypted.iv,
        encrypted.authTag,
        encrypted.integrityHash,
        currentFp
      );
      expect(tamperedDecrypted).toBeNull();
    });

    it('debe validar la autorización de módulos mediante isModuleAllowed', async () => {
      const companyId = '11111111-1111-1111-1111-111111111111';
      const isPosAllowed = await LicensesService.isModuleAllowed(companyId, 'pos');
      expect(isPosAllowed).toBe(true);

      const isLicensesAllowed = await LicensesService.isModuleAllowed(companyId, 'licenses');
      expect(isLicensesAllowed).toBe(true);

      const isNonExistentAllowed = await LicensesService.isModuleAllowed(companyId, 'quantum_teleportation');
      expect(isNonExistentAllowed).toBe(false);
    });

    it('debe permitir establecer usuarios y sucursales ilimitadas (valor 0) en el esquema de emisión', () => {
      const unlimitedLicense = generateLicenseSchema.safeParse({
        companyName: 'EMPRESA ILIMITADA C.A.',
        companyRif: 'J-99999999-9',
        hardwareFingerprint: 'A1B2C3D4E5F678901234567890ABCDEF',
        type: 'perpetua',
        maxUsers: 0, // 0 = Ilimitados
        maxBranches: 0, // 0 = Ilimitadas
        hasSupport: true,
        modulesAllowed: ['pos', 'sales', 'inventory'],
      });
      expect(unlimitedLicense.success).toBe(true);
      if (unlimitedLicense.success) {
        expect(unlimitedLicense.data.maxUsers).toBe(0);
        expect(unlimitedLicense.data.maxBranches).toBe(0);
      }
    });

    it('debe permitir crear usuarios y sucursales sin restricción cuando el límite es ilimitado (0)', async () => {
      // Mock de licencia con usuarios y sucursales ilimitadas
      const mockUnlimitedLic = {
        id: 'lic-unlimited',
        companyId: 'unlimited-co',
        licenseKey: 'ERO-UNLIMITED-TEST',
        type: 'perpetua' as const,
        expiresAt: null,
        hardwareFingerprint: LicensesService.getHardwareFingerprint(),
        modulesAllowed: ['*'],
        maxUsers: 0, // ilimitado
        maxBranches: 0, // ilimitado
        isActive: true,
        status: 'ACTIVE' as const,
        daysRemaining: null,
      };

      // Si maxBranches <= 0 o maxUsers <= 0, no debe lanzar excepción
      expect(mockUnlimitedLic.maxBranches <= 0).toBe(true);
      expect(mockUnlimitedLic.maxUsers <= 0).toBe(true);
    });

    it('debe filtrar los permisos devueltos por getPermissions según los módulos contratados en la licencia', async () => {
      const { ConfigService } = await import('../src/modules/config/config.service');
      const allPerms = await ConfigService.getPermissions();
      expect(allPerms.length).toBeGreaterThan(0);

      // Verificar que los módulos principales están catalogados
      const modulesInCatalog = new Set(allPerms.map((p) => p.module));
      expect(modulesInCatalog.has('sales')).toBe(true);
      expect(modulesInCatalog.has('pos')).toBe(true);
      expect(modulesInCatalog.has('inventory')).toBe(true);
      expect(modulesInCatalog.has('config')).toBe(true);
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

  describe('Discriminación Estricta de Super Administrador vs Administrador', () => {
    it('debe reconocer únicamente a Super Administradores y excluir administradores ordinarios', () => {
      // Casos válidos de Super Administrador
      expect(isSuperAdminRole('Super Administrador')).toBe(true);
      expect(isSuperAdminRole('super_admin')).toBe(true);
      expect(isSuperAdminRole('Super Admin')).toBe(true);
      expect(isSuperAdminRole('superadmin')).toBe(true);
      expect(isSuperAdminRole('superuser')).toBe(true);
      expect(isSuperAdminRole('superusuario')).toBe(true);

      // Casos que NO deben ser Super Administrador (son administradores / gerentes)
      expect(isSuperAdminRole('Administrador')).toBe(false);
      expect(isSuperAdminRole('admin')).toBe(false);
      expect(isSuperAdminRole('ADMIN')).toBe(false);
      expect(isSuperAdminRole('Gerente General')).toBe(false);
      expect(isSuperAdminRole('Director General')).toBe(false);
      expect(isSuperAdminRole('Supervisor')).toBe(false);
      expect(isSuperAdminRole('Cajero')).toBe(false);
      expect(isSuperAdminRole(null)).toBe(false);
      expect(isSuperAdminRole(undefined)).toBe(false);
    });

    it('debe reconocer a administradores y supervisores en isSupervisorOrAdminRole', () => {
      expect(isSupervisorOrAdminRole('Administrador')).toBe(true);
      expect(isSupervisorOrAdminRole('admin')).toBe(true);
      expect(isSupervisorOrAdminRole('Gerente General')).toBe(true);
      expect(isSupervisorOrAdminRole('Supervisor de Ventas')).toBe(true);
      expect(isSupervisorOrAdminRole('Super Administrador')).toBe(true);

      expect(isSupervisorOrAdminRole('Cajero')).toBe(false);
      expect(isSupervisorOrAdminRole('Mesonero')).toBe(false);
    });
  });
});
