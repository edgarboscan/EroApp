import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  licenseActivationSchema,
  generateLicenseSchema,
  updateLicensePricingRatesSchema,
  isSuperAdminRole,
  isSupervisorOrAdminRole,
  LicenseInfo,
  LicenseCostBreakdown,
  LicensePricingRates,
} from '@ero/shared';
import { LicensesService } from './licenses.service';
import { authenticate, AppEnv } from '../../middleware/auth';

export const licensesRouter = new Hono<AppEnv>();

licensesRouter.get('/status', authenticate, async (c) => {
  const user = c.get('user');
  const userPerms = user.permissions || [];
  const isPrivileged =
    isSuperAdminRole(user.role) ||
    isSupervisorOrAdminRole(user.role) ||
    userPerms.includes('config.read') ||
    userPerms.includes('config.write');

  try {
    const license = await LicensesService.getLicense(user.companyId);
    if (isPrivileged) {
      return c.json({ success: true, data: license });
    }

    // Para usuarios operativos (Cajeros, Vendedores, etc.), retornar el estado de actividad de la licencia
    return c.json({
      success: true,
      data: {
        isActive: license.isActive,
        status: license.status,
        type: license.type,
        daysRemaining: license.daysRemaining,
        expiresAt: license.expiresAt,
        companyId: license.companyId,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'LICENSE_FETCH_ERROR', message: error.message } }, 500);
  }
});

licensesRouter.get('/fingerprint', authenticate, async (c) => {
  const user = c.get('user');
  const userPerms = user.permissions || [];
  const canRead =
    isSuperAdminRole(user.role) ||
    isSupervisorOrAdminRole(user.role) ||
    userPerms.includes('config.read') ||
    userPerms.includes('config.write');

  if (!canRead) {
    return c.json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'No posee privilegios para consultar el fingerprint del hardware' },
    }, 403);
  }

  try {
    const fingerprint = LicensesService.getHardwareFingerprint();
    return c.json({ success: true, data: { hardwareFingerprint: fingerprint } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'FINGERPRINT_ERROR', message: error.message } }, 500);
  }
});

/**
 * Emite una nueva licencia empresarial firmada criptográficamente (Exclusivo Super Administrador)
 */
licensesRouter.post(
  '/generate',
  authenticate,
  zValidator('json', generateLicenseSchema),
  async (c) => {
    const user = c.get('user');
    if (!isSuperAdminRole(user.role)) {
      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Solo el Super Administrador tiene autorización para emitir licencias empresariales',
        },
      }, 403);
    }

    const input = c.req.valid('json');
    const body = await c.req.json().catch(() => ({}));
    const applyNow = Boolean(body.applyNow);

    try {
      const result = await LicensesService.issueLicense(
        input,
        applyNow ? user.companyId : undefined
      );
      return c.json({ success: true, data: result });
    } catch (error: any) {
      return c.json({
        success: false,
        error: { code: 'LICENSE_ISSUE_ERROR', message: error.message || 'Error al emitir licencia' },
      }, 500);
    }
  }
);

/**
 * Obtiene la configuración tarifaria de licenciamiento del sistema
 */
licensesRouter.get('/pricing-rates', authenticate, async (c) => {
  const user = c.get('user');
  const userPerms = user.permissions || [];
  const canView =
    isSuperAdminRole(user.role) ||
    isSupervisorOrAdminRole(user.role) ||
    userPerms.includes('config.read') ||
    userPerms.includes('config.write');

  if (!canView) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
  }

  try {
    const rates = await LicensesService.getPricingRates();
    return c.json({ success: true, data: rates });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PRICING_RATES_ERROR', message: error.message } }, 500);
  }
});

/**
 * Actualiza la configuración tarifaria de licenciamiento del sistema (Exclusivo Super Administrador)
 */
licensesRouter.put(
  '/pricing-rates',
  authenticate,
  zValidator('json', updateLicensePricingRatesSchema),
  async (c) => {
    const user = c.get('user');
    if (!isSuperAdminRole(user.role)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Solo el Super Administrador puede configurar las tarifas de licenciamiento',
          },
        },
        403
      );
    }

    try {
      const input = c.req.valid('json') as LicensePricingRates;
      const saved = await LicensesService.savePricingRates(input, user.username);
      return c.json({ success: true, data: saved });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'PRICING_SAVE_ERROR', message: error.message } }, 500);
    }
  }
);

/**
 * Calcula la estimación de costos de licencia según parámetros
 */
licensesRouter.post('/estimate-cost', authenticate, async (c) => {
  const user = c.get('user');
  const userPerms = user.permissions || [];
  const canCalculate =
    isSuperAdminRole(user.role) ||
    isSupervisorOrAdminRole(user.role) ||
    userPerms.includes('config.read') ||
    userPerms.includes('config.write');

  if (!canCalculate) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const currentRates = await LicensesService.getPricingRates();
    const breakdown = LicensesService.calculateCostBreakdown({
      type: body.type || 'temporal',
      durationMonths: body.durationMonths ? Number(body.durationMonths) : 12,
      maxUsers: body.maxUsers !== undefined ? Number(body.maxUsers) : 5,
      maxBranches: body.maxBranches !== undefined ? Number(body.maxBranches) : 1,
      hasSupport: body.hasSupport !== undefined ? Boolean(body.hasSupport) : true,
      modulesAllowed: Array.isArray(body.modulesAllowed) ? body.modulesAllowed : [],
      manualTotalCost: body.manualTotalCost !== undefined ? Number(body.manualTotalCost) : undefined,
      discount: body.discount !== undefined ? Number(body.discount) : undefined,
      rates: body.rates || currentRates,
    });
    return c.json({ success: true, data: breakdown });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'ESTIMATE_ERROR', message: error.message } }, 500);
  }
});

/**
 * Genera y descarga el Certificado Oficial de Licencia en PDF para la empresa activa
 */
licensesRouter.get('/certificate-pdf', authenticate, async (c) => {
  const user = c.get('user');
  const userPerms = user.permissions || [];
  const canView =
    isSuperAdminRole(user.role) ||
    isSupervisorOrAdminRole(user.role) ||
    userPerms.includes('config.read') ||
    userPerms.includes('config.write');

  if (!canView) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No autorizado para descargar certificado' } }, 403);
  }

  const targetCompanyId = (isSuperAdminRole(user.role) && c.req.query('companyId'))
    ? c.req.query('companyId')!
    : user.companyId;

  try {
    const pdfBuffer = await LicensesService.getCertificatePDF(targetCompanyId);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', 'inline; filename="Certificado_Licencia_ERO_ERP.pdf"');
    return c.body(pdfBuffer as any);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PDF_GENERATION_FAILED', message: error.message } }, 500);
  }
});

/**
 * Genera el Certificado Oficial de Licencia en PDF a partir de datos arbitrarios de licencia
 */
licensesRouter.post('/certificate-pdf', authenticate, async (c) => {
  const user = c.get('user');
  if (!isSuperAdminRole(user.role) && !isSupervisorOrAdminRole(user.role)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
  }

  try {
    const body = await c.req.json();
    const licenseInfo: LicenseInfo = body.licenseInfo || body.license;
    const costBreakdown: LicenseCostBreakdown = body.costBreakdown || licenseInfo?.costBreakdown || null;
    const licensePackage: string = body.licensePackage || '';

    if (!licenseInfo) {
      throw new Error('Información de licencia requerida para generar certificado');
    }

    const pdfBuffer = LicensesService.generateCertificatePDFFromData(licenseInfo, costBreakdown, licensePackage);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="Certificado_Licencia_${licenseInfo.companyRif || 'ERO'}.pdf"`);
    return c.body(pdfBuffer as any);
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'PDF_GENERATION_FAILED', message: error.message } }, 500);
  }
});

licensesRouter.post('/generate-key', authenticate, async (c) => {
  const user = c.get('user');
  if (!isSuperAdminRole(user.role)) {
    return c.json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Solo el Super Administrador tiene autorización para generar claves de licencia',
      },
    }, 403);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const fingerprint = body.hardwareFingerprint || LicensesService.getHardwareFingerprint();
    const type = body.type || 'enterprise';
    const key = LicensesService.generateLicenseKey(fingerprint, type);
    return c.json({
      success: true,
      data: {
        licenseKey: key,
        hardwareFingerprint: fingerprint,
        type,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'LICENSE_GENERATE_ERROR', message: error.message } }, 500);
  }
});

licensesRouter.post(
  '/activate',
  authenticate,
  zValidator('json', licenseActivationSchema),
  async (c) => {
    const user = c.get('user');
    const userPerms = user.permissions || [];
    const canActivate =
      isSuperAdminRole(user.role) ||
      isSupervisorOrAdminRole(user.role) ||
      userPerms.includes('config.write') ||
      userPerms.includes('config.read');

    if (!canActivate) {
      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Solo los administradores o usuarios autorizados pueden activar licencias en el sistema',
        },
      }, 403);
    }

    const input = c.req.valid('json');
    try {
      const license = await LicensesService.activateLicense(user.companyId, input);
      return c.json({ success: true, data: license });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'LICENSE_ACTIVATION_ERROR', message: error.message } }, 500);
    }
  }
);
