import crypto from 'crypto';

const HMAC_SALT = process.env.SUPERADMIN_INTEGRITY_SALT || 'ero_erp_superadmin_tamper_protection_salt_2026';
const JWT_SECRET = process.env.JWT_SECRET || 'ero_erp_enterprise_secret_key_2026_very_long_and_secure';

/**
 * Genera la firma criptográfica HMAC-SHA256 autorizada para un Super Administrador legítimo.
 * Solo el servidor en ejecución conoce los secretos internos.
 */
export function computeSuperAdminSignature(userId: string, username: string): string {
  const secret = `${JWT_SECRET}:${HMAC_SALT}`;
  return crypto
    .createHmac('sha256', secret)
    .update(`SUPER_ADMIN:${userId.trim()}:${username.trim().toLowerCase()}`)
    .digest('hex');
}

/**
 * Valida si la firma almacenada corresponde fehacientemente a una elevación legítima.
 */
export function verifySuperAdminSignature(userId: string, username: string, signature?: string | null): boolean {
  if (!signature) return false;
  const expected = computeSuperAdminSignature(userId, username);
  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
