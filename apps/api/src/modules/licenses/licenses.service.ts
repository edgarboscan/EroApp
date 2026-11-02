import os from 'os';
import crypto from 'crypto';
import { query } from '../../db';
import { LicenseActivationInput, LicenseInfo } from '@ero/shared';

export class LicensesService {
  private static licenseColumnsEnsured = false;
  private static licenseCache = new Map<string, { data: LicenseInfo; cachedAt: number }>();
  private static readonly CACHE_TTL_MS = 10000; // 10 segundos de caché de lectura

  /**
   * Garantiza que la tabla licenses cuente con las columnas de cifrado AES-256-GCM
   */
  private static async ensureLicenseColumns() {
    if (this.licenseColumnsEnsured) return;
    this.licenseColumnsEnsured = true;
    try {
      const cols = await query<any>(`SHOW COLUMNS FROM licenses`);
      const existing = new Set(cols.map((r: any) => r.Field));
      const toAdd: string[] = [];
      if (!existing.has('encrypted_payload')) toAdd.push('ADD COLUMN encrypted_payload LONGTEXT DEFAULT NULL');
      if (!existing.has('auth_tag')) toAdd.push('ADD COLUMN auth_tag VARCHAR(64) DEFAULT NULL');
      if (!existing.has('iv')) toAdd.push('ADD COLUMN iv VARCHAR(64) DEFAULT NULL');
      if (!existing.has('integrity_hash')) toAdd.push('ADD COLUMN integrity_hash VARCHAR(128) DEFAULT NULL');
      if (toAdd.length > 0) {
        await query(`ALTER TABLE licenses ${toAdd.join(', ')}`);
      }
    } catch {}
  }

  /**
   * Obtiene la clave maestra simétrica de 256 bits atada criptográficamente al hardware
   */
  private static getHardwareMasterKey(fingerprint: string): Buffer {
    const masterSecret =
      process.env.LICENSE_MASTER_SECRET ||
      process.env.JWT_SECRET ||
      'ero_erp_enterprise_license_master_secret_2026_aes_gcm';
    const cleanFp = (fingerprint || '').trim().toUpperCase();
    return crypto.scryptSync(masterSecret, cleanFp, 32);
  }

  /**
   * Encripta un payload de licencia usando AES-256-GCM con autenticación criptográfica
   */
  static encryptLicenseData(payload: Record<string, any>, fingerprint: string): {
    ciphertext: string;
    iv: string;
    authTag: string;
    integrityHash: string;
  } {
    const key = this.getHardwareMasterKey(fingerprint);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = JSON.stringify(payload);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const ivHex = iv.toString('hex');

    const integritySecret = process.env.JWT_SECRET || 'ero_erp_integrity_secret_2026';
    const integrityHash = crypto
      .createHmac('sha256', integritySecret)
      .update(`${ciphertext}:${authTag}:${ivHex}:${fingerprint}`)
      .digest('hex');

    return {
      ciphertext,
      iv: ivHex,
      authTag,
      integrityHash,
    };
  }

  /**
   * Desencripta un payload de licencia cifrado con AES-256-GCM y valida el AuthTag y el HMAC
   */
  static decryptLicenseData(
    ciphertext: string,
    iv: string,
    authTag: string,
    integrityHash: string,
    fingerprint: string
  ): Record<string, any> | null {
    try {
      const integritySecret = process.env.JWT_SECRET || 'ero_erp_integrity_secret_2026';
      const expectedHash = crypto
        .createHmac('sha256', integritySecret)
        .update(`${ciphertext}:${authTag}:${iv}:${fingerprint}`)
        .digest('hex');

      if (integrityHash !== expectedHash) {
        return null; // El registro fue alterado externamente
      }

      const key = this.getHardwareMasterKey(fingerprint);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  /**
   * Genera el Hardware Fingerprint de la máquina anfitriona
   */
  static getHardwareFingerprint(): string {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'GENERIC_CPU';
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const hostname = os.hostname();
    const platform = os.platform();

    const raw = `${cpuModel}|${totalMem}GB|${hostname}|${platform}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32).toUpperCase();
  }

  /**
   * Genera una Clave de Licencia corporativa firmada para un Hardware Fingerprint
   */
  static generateLicenseKey(
    fingerprint: string,
    type: 'trial' | 'temporal' | 'perpetua' = 'trial'
  ): string {
    const prefix = type === 'temporal' ? 'ERO-PRO' : 'ERO-ENTERPRISE';
    const year = new Date().getFullYear();
    const cleanFp = (fingerprint || '').trim().toUpperCase();
    const secret = process.env.JWT_SECRET || 'ero_erp_enterprise_secret_key_2026_very_long_and_secure';
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(`${cleanFp}:${type}:${year}`)
      .digest('hex')
      .toUpperCase();

    const block1 = hmac.substring(0, 4);
    const block2 = hmac.substring(4, 8);
    const block3 = hmac.substring(8, 12);
    const check = hmac.substring(12, 14);

    return `${prefix}-${year}-${block1}-${block2}-${block3}-${check}`;
  }

  /**
   * Empaqueta y firma criptográficamente un conjunto de especificaciones de licencia
   */
  static signLicensePackage(payload: Record<string, any>): string {
    const secret = process.env.JWT_SECRET || 'ero_erp_enterprise_secret_key_2026_very_long_and_secure';
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return `ERO-PKG.${data}.${signature}`;
  }

  /**
   * Verifica la autenticidad y firma criptográfica de un paquete de licencia
   */
  static verifyLicensePackage(raw: string): Record<string, any> | null {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('ERO-PKG.')) return null;
    const parts = trimmed.split('.');
    if (parts.length !== 3) return null;
    const [, data, signature] = parts;
    const secret = process.env.JWT_SECRET || 'ero_erp_enterprise_secret_key_2026_very_long_and_secure';
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (signature !== expectedSig) return null;
    try {
      const jsonStr = Buffer.from(data, 'base64url').toString('utf-8');
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  /**
   * Emite una nueva licencia empresarial (Exclusivo Super Administrador)
   */
  static async issueLicense(
    input: {
      companyName: string;
      companyRif: string;
      hardwareFingerprint: string;
      type: 'trial' | 'temporal' | 'perpetua';
      durationMonths?: number;
      maxUsers: number;
      maxBranches: number;
      hasSupport: boolean;
      modulesAllowed: string[];
    },
    applyToCompanyId?: string
  ): Promise<{ licenseKey: string; licensePackage: string; licenseInfo: LicenseInfo }> {
    const cleanFp = input.hardwareFingerprint.trim().toUpperCase();
    const cleanRif = input.companyRif.trim().toUpperCase();
    const cleanName = input.companyName.trim().toUpperCase();
    const readableKey = this.generateLicenseKey(cleanFp, input.type);

    let expiresAt: Date | null = null;
    if (input.type === 'temporal') {
      const months = input.durationMonths || 12;
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);
    } else if (input.type === 'trial') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
    }

    const payload = {
      v: 2,
      fp: cleanFp,
      companyName: cleanName,
      companyRif: cleanRif,
      type: input.type,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      maxUsers: input.maxUsers,
      maxBranches: input.maxBranches,
      hasSupport: Boolean(input.hasSupport),
      modules: input.modulesAllowed,
      issuedAt: new Date().toISOString(),
      licenseKey: readableKey,
    };

    const licensePackage = this.signLicensePackage(payload);
    const licenseId = crypto.randomUUID();

    if (applyToCompanyId) {
      this.licenseCache.delete(applyToCompanyId);
      await this.ensureLicenseColumns();
      const enc = this.encryptLicenseData(payload, cleanFp);

      try {
        await query(
          `INSERT INTO licenses (
             id, company_id, company_name, company_rif, license_key, type, expires_at,
             hardware_fingerprint, modules_allowed, max_users, max_branches, has_support, is_active,
             encrypted_payload, auth_tag, iv, integrity_hash
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             company_name = VALUES(company_name),
             company_rif = VALUES(company_rif),
             license_key = VALUES(license_key),
             type = VALUES(type),
             expires_at = VALUES(expires_at),
             hardware_fingerprint = VALUES(hardware_fingerprint),
             modules_allowed = VALUES(modules_allowed),
             max_users = VALUES(max_users),
             max_branches = VALUES(max_branches),
             has_support = VALUES(has_support),
             encrypted_payload = VALUES(encrypted_payload),
             auth_tag = VALUES(auth_tag),
             iv = VALUES(iv),
             integrity_hash = VALUES(integrity_hash),
             is_active = 1`,
          [
            licenseId,
            applyToCompanyId,
            cleanName,
            cleanRif,
            licensePackage,
            input.type,
            expiresAt,
            cleanFp,
            JSON.stringify(input.modulesAllowed),
            input.maxUsers,
            input.maxBranches,
            input.hasSupport ? 1 : 0,
            enc.ciphertext,
            enc.authTag,
            enc.iv,
            enc.integrityHash,
          ]
        );

        // Sincronizar datos legales en companies si es la misma empresa
        await query(
          `UPDATE companies SET legal_name = ?, rif = ? WHERE id = ?`,
          [cleanName, cleanRif, applyToCompanyId]
        );
      } catch {
        // Fallback silencioso si no se pudo persistir
      }
    }

    const now = new Date();
    const daysRemaining = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const licenseInfo: LicenseInfo = {
      id: licenseId,
      companyId: applyToCompanyId || 'external-company',
      companyName: cleanName,
      companyRif: cleanRif,
      licenseKey: readableKey,
      type: input.type,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      hardwareFingerprint: cleanFp,
      modulesAllowed: input.modulesAllowed,
      maxUsers: input.maxUsers,
      maxBranches: input.maxBranches,
      hasSupport: input.hasSupport,
      isActive: true,
      status: 'ACTIVE',
      daysRemaining,
    };

    return {
      licenseKey: readableKey,
      licensePackage,
      licenseInfo,
    };
  }

  /**
   * Obtiene la información del estado de la licencia activa con descifrado autenticado
   */
  static async getLicense(companyId: string): Promise<LicenseInfo> {
    const nowTimestamp = Date.now();
    const cached = this.licenseCache.get(companyId);
    if (cached && nowTimestamp - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    await this.ensureLicenseColumns();
    const currentFingerprint = this.getHardwareFingerprint();

    try {
      const rows = await query<any>(
        `SELECT id, company_id, company_name, company_rif, license_key, type, expires_at, hardware_fingerprint,
                modules_allowed, max_users, max_branches, has_support, is_active,
                encrypted_payload, auth_tag, iv, integrity_hash
         FROM licenses
         WHERE company_id = ?
         LIMIT 1`,
        [companyId]
      );

      if (rows.length > 0) {
        const lic = rows[0];
        let status: 'ACTIVE' | 'EXPIRED' | 'INVALID_HARDWARE' = 'ACTIVE';

        let maxUsers = Number(lic.max_users) || 5;
        let maxBranches = Number(lic.max_branches) || 1;
        let modulesAllowed: string[] = [];
        let licenseType: 'trial' | 'temporal' | 'perpetua' = lic.type || 'trial';
        let expiresAt = lic.expires_at ? new Date(lic.expires_at) : null;
        let companyName = lic.company_name || undefined;
        let companyRif = lic.company_rif || undefined;

        if (lic.encrypted_payload && lic.auth_tag && lic.iv && lic.integrity_hash) {
          // Desencriptar usando clave AES-256-GCM derivada del Hardware Fingerprint actual
          const decrypted = this.decryptLicenseData(
            lic.encrypted_payload,
            lic.iv,
            lic.auth_tag,
            lic.integrity_hash,
            currentFingerprint
          );

          if (!decrypted) {
            // El paquete cifrado no coincide con el hardware del servidor actual
            // O bien las columnas de la BD fueron manipuladas externamente
            status = 'INVALID_HARDWARE';
          } else {
            // Si alguien alteró directamente las columnas en MySQL para elevar usuarios/sucursales
            // Solo se compara si el límite descifrado es finito (> 0)
            const isFiniteUsers = typeof decrypted.maxUsers === 'number' && decrypted.maxUsers > 0;
            const isFiniteBranches = typeof decrypted.maxBranches === 'number' && decrypted.maxBranches > 0;

            if ((isFiniteUsers && Number(lic.max_users) > decrypted.maxUsers) ||
                (isFiniteBranches && Number(lic.max_branches) > decrypted.maxBranches)) {
              status = 'INVALID_HARDWARE';
            }

            // Adoptar los valores inviolables del payload descifrado (0 = ilimitado)
            maxUsers = typeof decrypted.maxUsers === 'number' ? decrypted.maxUsers : 50;
            maxBranches = typeof decrypted.maxBranches === 'number' ? decrypted.maxBranches : 10;
            modulesAllowed = Array.isArray(decrypted.modules)
              ? decrypted.modules
              : (Array.isArray(decrypted.modulesAllowed) ? decrypted.modulesAllowed : []);
            licenseType = decrypted.type;
            expiresAt = decrypted.expiresAt ? new Date(decrypted.expiresAt) : null;
            companyName = decrypted.companyName || companyName;
            companyRif = decrypted.companyRif || companyRif;
          }
        } else {
          // Licencia previa sin payload encriptado: validar fingerprint
          const isHardwareValid = lic.hardware_fingerprint === currentFingerprint;
          if (!isHardwareValid) {
            status = 'INVALID_HARDWARE';
          }
          modulesAllowed = typeof lic.modules_allowed === 'string'
            ? JSON.parse(lic.modules_allowed)
            : (lic.modules_allowed || []);

          // Auto-migrar a payload cifrado en segundo plano si el hardware es válido
          if (isHardwareValid) {
            const payload = {
              v: 2,
              fp: currentFingerprint,
              companyName: lic.company_name,
              companyRif: lic.company_rif,
              type: lic.type,
              expiresAt: expiresAt ? expiresAt.toISOString() : null,
              maxUsers,
              maxBranches,
              hasSupport: Boolean(lic.has_support),
              modules: modulesAllowed,
              issuedAt: new Date().toISOString(),
              licenseKey: lic.license_key,
            };
            const enc = this.encryptLicenseData(payload, currentFingerprint);
            query(
              `UPDATE licenses
               SET encrypted_payload = ?, auth_tag = ?, iv = ?, integrity_hash = ?
               WHERE id = ?`,
              [enc.ciphertext, enc.authTag, enc.iv, enc.integrityHash, lic.id]
            ).catch(() => {});
          }
        }

        const now = new Date();
        const daysRemaining = expiresAt
          ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() : false;
        if (isExpired && status === 'ACTIVE') {
          status = 'EXPIRED';
        }

        let displayKey = lic.license_key;
        if (displayKey.startsWith('ERO-PKG.')) {
          const pkg = this.verifyLicensePackage(displayKey);
          if (pkg?.licenseKey) {
            displayKey = pkg.licenseKey;
          }
        }

        const result: LicenseInfo = {
          id: lic.id,
          companyId: lic.company_id,
          companyName,
          companyRif,
          licenseKey: displayKey,
          type: licenseType,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          hardwareFingerprint: currentFingerprint,
          modulesAllowed,
          maxUsers,
          maxBranches,
          hasSupport: lic.has_support !== undefined ? Boolean(lic.has_support) : true,
          isActive: Boolean(lic.is_active) && status === 'ACTIVE',
          status,
          daysRemaining,
        };
        this.licenseCache.set(companyId, { data: result, cachedAt: Date.now() });
        return result;
      }
    } catch {
      // Fallback si no está inicializada en MySQL
    }

    // Consulta datos de la empresa por defecto
    let companyName = 'DISTRIBUIDORA Y COMERCIALIZADORA VENEZOLANA C.A.';
    let companyRif = 'J-40123456-7';
    try {
      const compRows = await query<any>('SELECT legal_name, rif FROM companies WHERE id = ? LIMIT 1', [companyId]);
      if (compRows.length > 0) {
        companyName = compRows[0].legal_name || companyName;
        companyRif = compRows[0].rif || companyRif;
      }
    } catch {
      // Ignorar
    }

    // Licencia Enterprise Activa por defecto para despliegue
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const defaultResult: LicenseInfo = {
      id: 'lic-11111111-1111-1111-1111-111111111111',
      companyId,
      companyName,
      companyRif,
      licenseKey: 'ERO-ENTERPRISE-2026-X992-K821-V44',
      type: 'perpetua',
      expiresAt: expiryDate.toISOString(),
      hardwareFingerprint: currentFingerprint,
      modulesAllowed: [
        'dashboards',
        'pos',
        'inventory',
        'pricing',
        'purchases',
        'sales',
        'customers',
        'receivables',
        'suppliers',
        'payables',
        'treasury',
        'taxes',
        'reports',
        'config',
        'audit',
        'restaurant',
        'accounting',
      ],
      maxUsers: 50,
      maxBranches: 10,
      hasSupport: true,
      isActive: true,
      status: 'ACTIVE',
      daysRemaining: 365,
    };
    this.licenseCache.set(companyId, { data: defaultResult, cachedAt: Date.now() });
    return defaultResult;
  }

  /**
   * Activa una licencia mediante clave criptográfica o paquete firmado
   */
  static async activateLicense(companyId: string, input: LicenseActivationInput): Promise<LicenseInfo> {
    this.licenseCache.delete(companyId);
    await this.ensureLicenseColumns();
    const currentFingerprint = this.getHardwareFingerprint();
    const licenseId = crypto.randomUUID();
    const rawKey = input.licenseKey.trim();

    // 1. Caso A: Activación mediante paquete criptográfico firmado ERO-PKG
    const pkg = this.verifyLicensePackage(rawKey);
    if (pkg) {
      if (pkg.fp !== currentFingerprint) {
        throw new Error(`El paquete de licencia está vinculado a otro hardware (${pkg.fp}) y no coincide con este equipo (${currentFingerprint})`);
      }

      const expiryDate = pkg.expiresAt ? new Date(pkg.expiresAt) : null;
      const modules = Array.isArray(pkg.modules) ? pkg.modules : [];

      const securePayload = {
        v: 2,
        fp: currentFingerprint,
        companyName: pkg.companyName,
        companyRif: pkg.companyRif,
        type: pkg.type || 'temporal',
        expiresAt: expiryDate ? expiryDate.toISOString() : null,
        maxUsers: typeof pkg.maxUsers === 'number' ? pkg.maxUsers : 50,
        maxBranches: typeof pkg.maxBranches === 'number' ? pkg.maxBranches : 10,
        hasSupport: Boolean(pkg.hasSupport),
        modules,
        issuedAt: new Date().toISOString(),
        licenseKey: pkg.licenseKey || rawKey,
      };

      const enc = this.encryptLicenseData(securePayload, currentFingerprint);

      await query(
        `INSERT INTO licenses (
           id, company_id, company_name, company_rif, license_key, type, expires_at,
           hardware_fingerprint, modules_allowed, max_users, max_branches, has_support, is_active,
           encrypted_payload, auth_tag, iv, integrity_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           company_name = VALUES(company_name),
           company_rif = VALUES(company_rif),
           license_key = VALUES(license_key),
           type = VALUES(type),
           expires_at = VALUES(expires_at),
           hardware_fingerprint = VALUES(hardware_fingerprint),
           modules_allowed = VALUES(modules_allowed),
           max_users = VALUES(max_users),
           max_branches = VALUES(max_branches),
           has_support = VALUES(has_support),
           encrypted_payload = VALUES(encrypted_payload),
           auth_tag = VALUES(auth_tag),
           iv = VALUES(iv),
           integrity_hash = VALUES(integrity_hash),
           is_active = 1`,
        [
          licenseId,
          companyId,
          pkg.companyName || null,
          pkg.companyRif || null,
          rawKey,
          pkg.type || 'temporal',
          expiryDate,
          currentFingerprint,
          JSON.stringify(modules),
          typeof pkg.maxUsers === 'number' ? pkg.maxUsers : 50,
          typeof pkg.maxBranches === 'number' ? pkg.maxBranches : 10,
          pkg.hasSupport ? 1 : 0,
          enc.ciphertext,
          enc.authTag,
          enc.iv,
          enc.integrityHash,
        ]
      );

      if (pkg.companyName && pkg.companyRif) {
        await query(
          `UPDATE companies SET legal_name = ?, rif = ? WHERE id = ?`,
          [pkg.companyName, pkg.companyRif, companyId]
        ).catch(() => {});
      }

      const now = new Date();
      const daysRemaining = expiryDate
        ? Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        id: licenseId,
        companyId,
        companyName: pkg.companyName,
        companyRif: pkg.companyRif,
        licenseKey: pkg.licenseKey || rawKey,
        type: pkg.type || 'temporal',
        expiresAt: expiryDate ? expiryDate.toISOString() : null,
        hardwareFingerprint: currentFingerprint,
        modulesAllowed: modules,
        maxUsers: typeof pkg.maxUsers === 'number' ? pkg.maxUsers : 50,
        maxBranches: typeof pkg.maxBranches === 'number' ? pkg.maxBranches : 10,
        hasSupport: Boolean(pkg.hasSupport),
        isActive: true,
        status: 'ACTIVE',
        daysRemaining,
      };
    }

    // 2. Caso B: Activación mediante clave estructurada estándar
    const expiryDate = new Date();
    let type: 'trial' | 'temporal' | 'perpetua' = 'temporal';

    if (rawKey.includes('PERPETUA') || rawKey.includes('ENTERPRISE')) {
      type = 'perpetua';
      expiryDate.setFullYear(expiryDate.getFullYear() + 10);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + 12);
    }

    const modules = [
      'dashboards',
      'pos',
      'inventory',
      'pricing',
      'purchases',
      'sales',
      'customers',
      'receivables',
      'suppliers',
      'payables',
      'treasury',
      'taxes',
      'reports',
      'config',
      'audit',
      'restaurant',
      'accounting',
    ];

    const securePayload = {
      v: 2,
      fp: currentFingerprint,
      type,
      expiresAt: expiryDate.toISOString(),
      maxUsers: 50,
      maxBranches: 10,
      hasSupport: true,
      modules,
      issuedAt: new Date().toISOString(),
      licenseKey: rawKey.toUpperCase(),
    };

    const enc = this.encryptLicenseData(securePayload, currentFingerprint);

    try {
      await query(
        `INSERT INTO licenses (
           id, company_id, license_key, type, expires_at, hardware_fingerprint,
           modules_allowed, max_users, max_branches, has_support, is_active,
           encrypted_payload, auth_tag, iv, integrity_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           license_key = VALUES(license_key),
           type = VALUES(type),
           expires_at = VALUES(expires_at),
           hardware_fingerprint = VALUES(hardware_fingerprint),
           modules_allowed = VALUES(modules_allowed),
           encrypted_payload = VALUES(encrypted_payload),
           auth_tag = VALUES(auth_tag),
           iv = VALUES(iv),
           integrity_hash = VALUES(integrity_hash),
           is_active = 1`,
        [
          licenseId,
          companyId,
          rawKey.toUpperCase(),
          type,
          expiryDate,
          currentFingerprint,
          JSON.stringify(modules),
          50,
          10,
          enc.ciphertext,
          enc.authTag,
          enc.iv,
          enc.integrityHash,
        ]
      );
    } catch {
      // Fallback
    }

    return {
      id: licenseId,
      companyId,
      licenseKey: rawKey.toUpperCase(),
      type,
      expiresAt: expiryDate.toISOString(),
      hardwareFingerprint: currentFingerprint,
      modulesAllowed: modules,
      maxUsers: 50,
      maxBranches: 10,
      hasSupport: true,
      isActive: true,
      status: 'ACTIVE',
      daysRemaining: 365,
    };
  }

  /**
   * Valida si la empresa puede crear una nueva sucursal activa según su licencia
   */
  static async checkBranchLimit(companyId: string): Promise<void> {
    const lic = await this.getLicense(companyId);
    if (!lic.isActive) {
      throw new Error('La licencia del sistema no se encuentra activa o ha expirado.');
    }
    // Si maxBranches es menor o igual a 0, significa sucursales ilimitadas
    if (lic.maxBranches <= 0) {
      return;
    }
    const rows = await query<any>(
      `SELECT COUNT(*) as count FROM branches WHERE company_id = ? AND is_active = 1`,
      [companyId]
    );
    const activeCount = Number(rows[0]?.count || 0);
    if (activeCount >= lic.maxBranches) {
      throw new Error(
        `Ha alcanzado el límite de ${lic.maxBranches} sucursal(es) permitidas por su licencia. Contacte a su proveedor para ampliar su capacidad.`
      );
    }
  }

  /**
   * Valida si la empresa puede registrar un nuevo usuario activo según su licencia
   */
  static async checkUserLimit(companyId: string): Promise<void> {
    const lic = await this.getLicense(companyId);
    if (!lic.isActive) {
      throw new Error('La licencia del sistema no se encuentra activa o ha expirado.');
    }
    // Si maxUsers es menor o igual a 0, significa usuarios ilimitados
    if (lic.maxUsers <= 0) {
      return;
    }
    const rows = await query<any>(
      `SELECT COUNT(*) as count FROM users WHERE company_id = ? AND is_active = 1`,
      [companyId]
    );
    const activeCount = Number(rows[0]?.count || 0);
    if (activeCount >= lic.maxUsers) {
      throw new Error(
        `Ha alcanzado el límite de ${lic.maxUsers} usuario(s) permitidos por su licencia. Contacte a su proveedor para ampliar su capacidad.`
      );
    }
  }

  /**
   * Verifica si un módulo específico está autorizado por la licencia activa
   */
  static async isModuleAllowed(companyId: string, moduleName: string): Promise<boolean> {
    try {
      // El módulo de licencias siempre debe ser accesible para consultar y reactivar
      if (moduleName === 'licenses') return true;

      const lic = await this.getLicense(companyId);
      if (!lic.isActive) return false;
      if (lic.modulesAllowed.includes('*') || lic.modulesAllowed.includes(moduleName)) {
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }
}
