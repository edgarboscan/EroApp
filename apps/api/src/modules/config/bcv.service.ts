import https from 'node:https';
import zlib from 'node:zlib';

export interface BcvRateInfo {
  rate: number;
  effectiveDate: string;
  formattedDate?: string;
  source: string;
  fetchedAt: string;
}

export class BcvService {
  private static cachedResult: BcvRateInfo | null = null;
  private static lastFetchTime = 0;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache en memoria
  private static lastErrorDetail: string | null = null;
  private static lastAttemptAt: string | null = null;

  /**
   * Obtiene la descripcion amigable y precisa de un error de conexion o parsing
   */
  static parseFriendlyError(err: any): string {
    if (!err) return 'Error desconocido de comunicacion';
    const msg = typeof err === 'string' ? err : err.message || String(err);

    if (msg.includes('Timeout') || msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
      return 'Tiempo de espera agotado al conectar con el servidor oficial (Timeout)';
    }
    if (msg.includes('ENOTFOUND') || msg.includes('EAI_AGAIN') || msg.includes('getaddrinfo')) {
      return 'Sin conexion a internet o fallo de resolucion DNS del portal';
    }
    if (msg.includes('ECONNREFUSED')) {
      return 'Conexion rechazada por el servidor oficial';
    }
    if (msg.includes('CERT_') || msg.includes('unable to verify')) {
      return 'Fallo en la validacion de certificado SSL del portal';
    }
    if (msg.includes('status 502') || msg.includes('status 503') || msg.includes('status 504')) {
      return 'El servidor oficial se encuentra temporalmente fuera de servicio';
    }
    if (msg.includes('Contenedor id="dolar"') || msg.includes('Tasa numérica inválida') || msg.includes('no valida')) {
      return 'Cambio o estructura inesperada en el portal oficial del BCV';
    }

    return msg;
  }

  /**
   * Retorna el ultimo detalle de error registrado
   */
  static getLastError(): { message: string | null; attemptedAt: string | null } {
    return {
      message: this.lastErrorDetail,
      attemptedAt: this.lastAttemptAt,
    };
  }

  /**
   * Obtiene la tasa oficial del dolar desde el Banco Central de Venezuela.
   * Consulta directamente el portal del BCV con reintentos y fallback a mirror oficial.
   */
  static async getOfficialRate(forceRefresh = false): Promise<BcvRateInfo> {
    const now = Date.now();
    if (!forceRefresh && this.cachedResult && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedResult;
    }

    this.lastAttemptAt = new Date().toISOString();

    try {
      const direct = await this.scrapeDirect();
      this.cachedResult = direct;
      this.lastFetchTime = now;
      this.lastErrorDetail = null;
      return direct;
    } catch (directErr: any) {
      const directMsg = this.parseFriendlyError(directErr);
      console.warn('[BcvService] Fallback scraping BCV directo:', directMsg);

      try {
        const mirror = await this.fetchDolarApiMirror();
        this.cachedResult = mirror;
        this.lastFetchTime = now;
        this.lastErrorDetail = null;
        return mirror;
      } catch (mirrorErr: any) {
        const mirrorMsg = this.parseFriendlyError(mirrorErr);
        const compositeError = `Portal oficial BCV: ${directMsg}. Servicio alternativo: ${mirrorMsg}`;
        this.lastErrorDetail = compositeError;

        throw new Error(
          `No fue posible obtener la tasa oficial del dólar desde el BCV. Causa: ${compositeError}`
        );
      }
    }
  }

  /**
   * Scrape directo a la pagina web del Banco Central de Venezuela
   */
  private static async scrapeDirect(): Promise<BcvRateInfo> {
    return new Promise((resolve, reject) => {
      const agent = new https.Agent({ rejectUnauthorized: false });
      const req = https.get(
        'https://www.bcv.org.ve/',
        {
          agent,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
          },
          timeout: 10000,
        },
        (res) => {
          let stream: NodeJS.ReadableStream = res;
          const encoding = res.headers['content-encoding'];
          if (encoding === 'gzip') {
            stream = res.pipe(zlib.createGunzip());
          } else if (encoding === 'deflate') {
            stream = res.pipe(zlib.createInflate());
          }

          let data = '';
          stream.on('data', (chunk) => {
            data += chunk;
          });

          stream.on('end', () => {
            try {
              const dollarMatch = data.match(
                /id=["']dolar["'][\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i
              );
              const dateMatch =
                data.match(/class=["']date-display-single["'][^>]*content=["']([^"']+)["']/i) ||
                data.match(/Fecha Valor:\s*<span[^>]*>([^<]+)<\/span>/i);
              const formattedDateMatch = data.match(
                /class=["']date-display-single["'][^>]*>([^<]+)<\/span>/i
              );

              if (!dollarMatch) {
                return reject(new Error('Contenedor id="dolar" no localizado en portal BCV'));
              }

              const rawRate = dollarMatch[1].trim().replace(',', '.');
              const rate = parseFloat(rawRate);
              if (isNaN(rate) || rate <= 0) {
                return reject(new Error('Tasa numérica inválida extraída del portal BCV'));
              }

              let effectiveDate = new Date().toISOString().split('T')[0];
              if (dateMatch && dateMatch[1]) {
                const parsedDate = new Date(dateMatch[1]);
                if (!isNaN(parsedDate.getTime())) {
                  effectiveDate = parsedDate.toISOString().split('T')[0];
                }
              }

              resolve({
                rate: Number(rate.toFixed(4)),
                effectiveDate,
                formattedDate: formattedDateMatch ? formattedDateMatch[1].trim() : undefined,
                source: 'Banco Central de Venezuela (BCV)',
                fetchedAt: new Date().toISOString(),
              });
            } catch (err) {
              reject(err);
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de conexión con https://www.bcv.org.ve/'));
      });
    });
  }

  /**
   * Respaldo mediante API espejo oficial del BCV
   */
  private static async fetchDolarApiMirror(): Promise<BcvRateInfo> {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`DolarApi respondió con status ${res.status}`);
    }

    const json: any = await res.json();
    if (!json || typeof json.promedio !== 'number' || json.promedio <= 0) {
      throw new Error('DolarApi devolvió una tasa no válida');
    }

    const effectiveDate = json.fechaActualizacion
      ? new Date(json.fechaActualizacion).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    return {
      rate: Number(json.promedio.toFixed(4)),
      effectiveDate,
      source: 'Banco Central de Venezuela (BCV)',
      fetchedAt: new Date().toISOString(),
    };
  }
}
