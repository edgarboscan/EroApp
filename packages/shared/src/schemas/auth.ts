import { z } from 'zod';

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(3, 'Usuario o email requerido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  totpCode: z.string().length(6, 'El código 2FA debe tener 6 dígitos').optional(),
  branchId: z.string().uuid('ID de sucursal inválido').optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const userTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  role: z.string(),
  companyId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  permissions: z.array(z.string()),
  branches: z.array(z.string().uuid()),
  warehouses: z.array(z.string().uuid()),
});

export type UserTokenPayload = z.infer<typeof userTokenPayloadSchema>;

export const verify2faSchema = z.object({
  userId: z.string().min(1, 'ID de usuario requerido'),
  code: z.string().length(6, 'El código 2FA debe tener 6 dígitos'),
  branchId: z.string().optional(),
});

export type Verify2faInput = z.infer<typeof verify2faSchema>;
