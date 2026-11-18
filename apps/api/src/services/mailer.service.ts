import nodemailer, { type Transporter, type SendMailOptions as NodemailerSendMailOptions } from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { query } from '../db';

export interface MailAttachment {
  filename: string;
  content: string | Buffer; // Buffer o string (base64 o utf8)
  contentType?: string;
  encoding?: string;
}

export interface SendMailOptions {
  to: string | string[];
  toName?: string | null;
  subject: string;
  text?: string | null;
  html?: string | null;
  attachments?: MailAttachment[];
  fromName?: string;
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
  replyTo?: string | null;
}

export interface MailerStatus {
  configured: boolean;
  host: string;
  port: number;
  user: string;
  senderName: string;
  source: 'company' | 'env' | 'none';
}

export class MailerService {
  private static getMasterKey(): Buffer {
    const secret = process.env.JWT_SECRET || 'ero_erp_smtp_master_secret_key_2026';
    return crypto.scryptSync(secret, 'smtp_salt_ero_erp_key', 32);
  }

  /**
   * Cifra la contraseña SMTP con AES-256-GCM para almacenamiento seguro en BD
   */
  static encryptPassword(plaintext: string): string {
    if (!plaintext) return '';
    try {
      const key = this.getMasterKey();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `enc:${iv.toString('hex')}:${authTag}:${ciphertext}`;
    } catch {
      return plaintext;
    }
  }

  /**
   * Descifra la contraseña SMTP almacenada en BD
   */
  static decryptPassword(ciphertext: string): string {
    if (!ciphertext) return '';
    if (!ciphertext.startsWith('enc:')) return ciphertext;
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 4) return ciphertext;
      const [, ivHex, authTagHex, encHex] = parts;
      const key = this.getMasterKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '';
    }
  }

  /**
   * Obtiene la configuración de conexión SMTP (priorizando Empresa en BD, con fallback a .env)
   */
  static async getConfig(companyId?: string): Promise<{
    host: string;
    port: number;
    user: string;
    pass: string;
    senderName: string;
    secure: boolean;
    isConfigured: boolean;
    source: 'company' | 'env' | 'none';
  }> {
    // 1. Prioridad: Revisar configuración SMTP en la Empresa (Base de Datos)
    if (companyId) {
      try {
        const rows = await query<any>(
          `SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_secure, smtp_enabled
           FROM companies
           WHERE id = ? LIMIT 1`,
          [companyId]
        );
        if (rows.length > 0) {
          const c = rows[0];
          const host = (c.smtp_host || '').trim();
          const user = (c.smtp_user || '').trim();
          const pass = c.smtp_password ? this.decryptPassword(c.smtp_password).replace(/\s+/g, '').trim() : '';
          const port = Number(c.smtp_port) || 587;
          const senderName = (c.smtp_from_name || '').trim() || 'ERO ERP VE - Sistema Empresarial';
          const secure = c.smtp_secure === 'ssl' || port === 465;
          const enabled = Boolean(c.smtp_enabled);

          if (enabled && host && user && pass) {
            return {
              host,
              port,
              user,
              pass,
              senderName,
              secure,
              isConfigured: true,
              source: 'company',
            };
          }
        }
      } catch {
        // Fallback si la tabla aún no tiene las columnas o falla la consulta
      }
    }

    // 2. Fallback: Variables de Entorno del Servidor (.env)
    if (!process.env.smtp_server && !process.env.SMTP_SERVER) {
      try {
        const candidatePaths = [
          path.resolve(process.cwd(), '.env'),
          path.resolve(process.cwd(), '../../.env'),
          path.resolve(process.cwd(), '../.env'),
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            dotenv.config({ path: p });
          }
        }
      } catch {
        // Silencioso
      }
    }

    const host = (process.env.smtp_server || process.env.SMTP_SERVER || process.env.SMTP_HOST || '').trim();
    const port = parseInt(process.env.smtp_port || process.env.SMTP_PORT || '587', 10);
    const user = (process.env.auth_username || process.env.AUTH_USERNAME || process.env.SMTP_USER || '').trim();
    const rawPass = process.env.auth_password || process.env.AUTH_PASSWORD || process.env.SMTP_PASS || '';
    const pass = rawPass.replace(/\s+/g, '').trim();
    const senderName = process.env.MAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'ERO ERP VE - Sistema Empresarial';
    const isConfigured = Boolean(host && user && pass);

    return {
      host,
      port,
      user,
      pass,
      senderName,
      secure: port === 465,
      isConfigured,
      source: isConfigured ? 'env' : 'none',
    };
  }

  /**
   * Retorna una instancia del transporter de nodemailer
   */
  static async getTransporter(companyId?: string): Promise<Transporter> {
    const config = await this.getConfig(companyId);

    if (!config.isConfigured) {
      throw new Error(
        'El servicio de correo SMTP no está configurado ni en la empresa ni en las variables de entorno (.env).'
      );
    }

    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Prueba una conexión con parámetros arbitrarios (útil para el botón 'Probar Conexión' antes de guardar)
   */
  static async testCustomConnection(params: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure?: boolean;
  }): Promise<{ ok: boolean; message: string }> {
    try {
      const cleanPass = params.pass.replace(/\s+/g, '').trim();
      const transporter = nodemailer.createTransport({
        host: params.host.trim(),
        port: params.port,
        secure: params.secure ?? params.port === 465,
        auth: {
          user: params.user.trim(),
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.verify();
      return {
        ok: true,
        message: `Conexión SMTP establecida exitosamente con ${params.host}:${params.port}`,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `Error al autenticar en el servidor SMTP: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Verifica el estado actual de la configuración y la conexión al servidor SMTP
   */
  static async checkStatus(companyId?: string): Promise<{ status: MailerStatus; connection: { ok: boolean; message: string } }> {
    const config = await this.getConfig(companyId);

    const maskedUser = config.user
      ? config.user.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => `${first}${'*'.repeat(Math.min(middle.length, 5))}${domain}`)
      : 'No configurado';

    const status: MailerStatus = {
      configured: config.isConfigured,
      host: config.host || 'No configurado',
      port: config.port,
      user: maskedUser,
      senderName: config.senderName,
      source: config.source,
    };

    if (!config.isConfigured) {
      return {
        status,
        connection: {
          ok: false,
          message: 'Parámetros SMTP no configurados ni en la empresa ni en el archivo .env',
        },
      };
    }

    try {
      const transporter = await this.getTransporter(companyId);
      await transporter.verify();
      const sourceLabel = config.source === 'company' ? 'Configuración de Empresa (BD)' : 'Servidor (.env)';
      return {
        status,
        connection: {
          ok: true,
          message: `Conexión SMTP establecida exitosamente con ${config.host}:${config.port} [Origen: ${sourceLabel}]`,
        },
      };
    } catch (err: any) {
      return {
        status,
        connection: {
          ok: false,
          message: `Error al autenticar en el servidor SMTP: ${err.message || String(err)}`,
        },
      };
    }
  }

  /**
   * Construye una plantilla HTML corporativa para los correos de ERO ERP
   */
  static buildHtmlTemplate(options: {
    recipientName?: string | null;
    subject: string;
    bodyText: string;
    senderDisplayName: string;
    hasAttachment?: boolean;
    attachmentName?: string;
  }): string {
    const greeting = options.recipientName
      ? `Estimado(a) <strong>${options.recipientName}</strong>,`
      : 'Estimado(a) cliente / colaborador,';

    // Formatear saltos de línea a párrafos
    const paragraphs = options.bodyText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #374151; font-size: 14px;">${p}</p>`)
      .join('');

    const attachmentBadge = options.hasAttachment
      ? `
      <div style="margin: 16px 0; padding: 12px 16px; background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; display: inline-block;">
        <span style="color: #166534; font-size: 13px; font-weight: bold;">
          📎 Archivo Oficial Adjunto: ${options.attachmentName || 'Documento Oficial en PDF'}
        </span>
      </div>
      `
      : '';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <!-- Cabecera -->
          <tr>
            <td style="background-color: #1E293B; padding: 20px 24px; border-bottom: 3px solid #007BFF;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #FFFFFF; letter-spacing: 0.5px;">
                      ERO ERP VE
                    </h1>
                    <span style="font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">
                      Sistema de Gestión Comercial y Fiscal
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; color: #CBD5E1; background-color: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 4px;">
                      Emisión Oficial
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 28px 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #111827;">
                ${options.subject}
              </h2>

              <p style="margin: 0 0 14px 0; color: #1F2937; font-size: 14px;">
                ${greeting}
              </p>

              ${paragraphs}

              ${attachmentBadge}

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0; font-size: 13px; color: #4B5563;">Atentamente,</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: bold; color: #111827;">${options.senderDisplayName}</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #6B7280;">ERO Enterprise Resource Planning Software</p>
              </div>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 16px 24px; border-top: 1px solid #E2E8F0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B; line-height: 1.4;">
                Este correo fue generado automáticamente por ERO ERP conforme a los datos registrados por el operador emisor.
                Si no esperaba este mensaje, por favor ignórelo o comuníquese con el administrador del sistema.
              </p>
              <p style="margin: 6px 0 0 0; font-size: 10px; color: #94A3B8;">
                © ${new Date().getFullYear()} ERO ERP VE. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Envía un correo electrónico directo mediante el transporter configurado
   */
  static async sendMail(options: SendMailOptions, companyId?: string): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    simulated: boolean;
  }> {
    const config = await this.getConfig(companyId);

    if (!config.isConfigured) {
      throw new Error(
        'El servidor SMTP no está configurado. Configure los parámetros SMTP en Configuración de Empresa o en el archivo .env.'
      );
    }

    const transporter = await this.getTransporter(companyId);

    const fromAddress = `"${options.fromName || config.senderName}" <${config.user}>`;

    const htmlContent =
      options.html ||
      this.buildHtmlTemplate({
        recipientName: options.toName,
        subject: options.subject,
        bodyText: options.text || 'Sin contenido adicional.',
        senderDisplayName: options.fromName || config.senderName,
        hasAttachment: options.attachments && options.attachments.length > 0,
        attachmentName: options.attachments?.[0]?.filename,
      });

    const mailData: NodemailerSendMailOptions = {
      from: fromAddress,
      to: options.to,
      cc: options.cc || undefined,
      bcc: options.bcc || undefined,
      replyTo: options.replyTo || config.user,
      subject: options.subject,
      text: options.text || '',
      html: htmlContent,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        encoding: att.encoding,
      })),
    };

    const info = await transporter.sendMail(mailData);

    return {
      messageId: info.messageId,
      accepted: (info.accepted as string[]) || [],
      rejected: (info.rejected as string[]) || [],
      simulated: false,
    };
  }
}
