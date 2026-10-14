import { Context, Next } from 'hono';
import { query } from '../db';
import crypto from 'crypto';

export interface AuditOptions {
  module: string;
  action: string;
  entity: string;
}

/**
 * Registra cambios en la bitácora `audit_logs`
 */
export async function logAudit(
  companyId: string,
  userId: string | null,
  branchId: string | null,
  module: string,
  action: string,
  entity: string,
  entityId: string | null,
  beforeJson: any = null,
  afterJson: any = null,
  ip: string = '',
  userAgent: string = ''
) {
  try {
    await query(
      `INSERT INTO audit_logs (
        id, company_id, branch_id, user_id, module, action, entity, entity_id, 
        before_json, after_json, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        crypto.randomUUID(),
        companyId,
        branchId,
        userId,
        module,
        action,
        entity,
        entityId,
        beforeJson ? JSON.stringify(beforeJson) : null,
        afterJson ? JSON.stringify(afterJson) : null,
        ip,
        userAgent,
      ]
    );
  } catch (err) {
    // Evitar romper la transacción si falla el log secundario, pero registrar en consola
    console.error('Error al registrar auditoría en BD:', err);
  }
}
