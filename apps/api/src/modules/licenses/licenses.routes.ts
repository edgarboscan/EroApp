import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { licenseActivationSchema, generateLicenseSchema, isSuperAdminRole } from '@ero/shared';
import { LicensesService } from './licenses.service';
import { authenticate, AppEnv } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';

export const licensesRouter = new Hono<AppEnv>();

licensesRouter.get('/status', authenticate, authorize('config', 'read'), async (c) => {
  const user = c.get('user');
  try {
    const license = await LicensesService.getLicense(user.companyId);
    return c.json({ success: true, data: license });
  } catch (error: any) {
    return c.json({ success: false, error: { code: 'LICENSE_FETCH_ERROR', message: error.message } }, 500);
  }
});

licensesRouter.get('/fingerprint', authenticate, authorize('config', 'read'), async (c) => {
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

licensesRouter.post('/generate-key', authenticate, authorize('config', 'read'), async (c) => {
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
  authorize('config', 'update'),
  zValidator('json', licenseActivationSchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const license = await LicensesService.activateLicense(user.companyId, input);
      return c.json({ success: true, data: license });
    } catch (error: any) {
      return c.json({ success: false, error: { code: 'LICENSE_ACTIVATION_ERROR', message: error.message } }, 500);
    }
  }
);
