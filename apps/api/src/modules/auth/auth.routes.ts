import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { loginSchema, verify2faSchema } from '@ero/shared';
import { AuthService } from './auth.service';
import { authenticate, AppEnv } from '../../middleware/auth';

export const authRouter = new Hono<AppEnv>();

// POST /api/auth/login
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const body = c.req.valid('json');
  try {
    const result = await AuthService.login(body);
    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'AUTH_FAILED', message: error.message },
    }, 400);
  }
});

// POST /api/auth/2fa/verify
authRouter.post('/2fa/verify', zValidator('json', verify2faSchema), async (c) => {
  const body = c.req.valid('json');
  try {
    const result = await AuthService.verify2FA(body);
    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: '2FA_FAILED', message: error.message },
    }, 400);
  }
});

// POST /api/auth/change-password
authRouter.post('/change-password', async (c) => {
  try {
    const body = await c.req.json();
    const result = await AuthService.changePassword(body);
    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'CHANGE_PASSWORD_FAILED', message: error.message },
    }, 400);
  }
});

// POST /api/auth/recover-password
authRouter.post('/recover-password', async (c) => {
  try {
    const body = await c.req.json();
    const result = await AuthService.recoverPassword(body);
    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: { code: 'RECOVER_PASSWORD_FAILED', message: error.message },
    }, 400);
  }
});

// GET /api/auth/branches - Obtiene las sucursales y depósitos disponibles para el usuario
authRouter.get('/branches', authenticate, async (c) => {
  const user = c.get('user');
  const all = c.req.query('all') === 'true';
  const branches = await AuthService.getBranches(user.companyId, user, { all });
  return c.json({
    success: true,
    data: branches,
  });
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    data: user,
  });
});
