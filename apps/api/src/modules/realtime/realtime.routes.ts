import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import * as jose from 'jose';
import { RealtimeService, RealtimePayload } from './realtime.service';
import { UserTokenPayload } from '@ero/shared';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ero_erp_enterprise_secret_key_2026_very_long_and_secure'
);

export const realtimeRouter = new Hono();

// GET /api/realtime/stream - Canal Server-Sent Events (SSE) en tiempo real
realtimeRouter.get('/stream', async (c) => {
  const authHeader = c.req.header('Authorization');
  const queryToken = c.req.query('token');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;

  if (!token) {
    return c.text('Token de autenticación requerido', 401);
  }

  let user: UserTokenPayload;
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    user = payload as unknown as UserTokenPayload;
  } catch {
    return c.text('Token inválido o expirado', 401);
  }

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    // 1. Notificar conexión inicial
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        userId: user.sub,
        username: user.username,
        connectedAt: new Date().toISOString(),
      }),
    });

    // 2. Suscribir a eventos directos del usuario
    const unsubscribeUser = RealtimeService.subscribeUser(user.sub, async (payload: RealtimePayload) => {
      try {
        await stream.writeSSE({
          event: payload.event,
          data: JSON.stringify(payload.data),
        });
      } catch {
        // En caso de corte o desconexión
      }
    });

    // 3. Suscribir a eventos generales de la empresa
    const unsubscribeCompany = RealtimeService.subscribeCompany(user.companyId, async (payload: RealtimePayload) => {
      try {
        await stream.writeSSE({
          event: payload.event,
          data: JSON.stringify(payload.data),
        });
      } catch {
        // En caso de corte o desconexión
      }
    });

    // 4. Heartbeat cada 20 segundos para mantener el canal vivo
    const pingInterval = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: 'ping',
          data: 'heartbeat',
        });
      } catch {
        clearInterval(pingInterval);
      }
    }, 20000);

    // 5. Limpieza de listeners al abortar el stream
    stream.onAbort(() => {
      clearInterval(pingInterval);
      unsubscribeUser();
      unsubscribeCompany();
    });

    // Mantener la ejecución viva mientras el stream esté activo
    await new Promise<void>((resolve) => {
      stream.onAbort(resolve);
    });
  });
});

