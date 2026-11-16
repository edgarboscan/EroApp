/**
 * Utilidades para generación y renderizado de códigos de barras
 * y comandos de impresión nativos para impresoras especializadas (Zebra ZPL, EPL, TSPL).
 */

/**
 * Calcula el dígito verificador de un código EAN-13 usando el algoritmo estándar Modulo 10.
 */
export function calculateEan13CheckDigit(digits12: string): number {
  if (digits12.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Genera un código de barras EAN-13 válido con prefijo estándar.
 * Por defecto usa 759 (Prefijo de Venezuela) + 9 dígitos aleatorios + dígito verificador.
 */
export function generateEan13(prefix = "759"): string {
  const cleanPrefix = prefix.replace(/\D/g, "").slice(0, 3).padEnd(3, "7");
  let middleDigits = "";
  for (let i = 0; i < 9; i++) {
    middleDigits += Math.floor(Math.random() * 10).toString();
  }
  const first12 = cleanPrefix + middleDigits;
  const checkDigit = calculateEan13CheckDigit(first12);
  return first12 + checkDigit.toString();
}

/**
 * Genera un código de barras alfanumérico Code-128 basado en SKU o consecutivo.
 */
export function generateCode128Barcode(sku?: string): string {
  if (sku && sku.trim().length >= 3) {
    // Limpiar caracteres no imprimibles o problemáticos para barcode
    return sku.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, "");
  }
  // Alternativa: EAN-13 estándar
  return generateEan13();
}

/**
 * Patrones de barras Code 128 (Subconjunto B).
 * Cada carácter se representa por 6 módulos de barras y espacios.
 */
const CODE128_PATTERNS: Record<number, string> = {
  0: "212222", 1: "222122", 2: "222221", 3: "121223", 4: "121322",
  5: "131222", 6: "122213", 7: "122312", 8: "132212", 9: "221213",
  10: "221312", 11: "231212", 12: "112232", 13: "122132", 14: "122231",
  15: "113222", 16: "123122", 17: "123221", 18: "223211", 19: "221132",
  20: "221231", 21: "213212", 22: "223112", 23: "312131", 24: "311222",
  25: "321122", 26: "321221", 27: "312212", 28: "322112", 29: "322211",
  30: "212123", 31: "212321", 32: "232121", 33: "111323", 34: "131123",
  35: "131321", 36: "112313", 37: "132113", 38: "132311", 39: "211313",
  40: "231113", 41: "231311", 42: "112133", 43: "112331", 44: "132131",
  45: "113123", 46: "113321", 47: "133121", 48: "313121", 49: "211331",
  50: "231131", 51: "213113", 52: "213311", 53: "213131", 54: "311123",
  55: "311321", 56: "331121", 57: "312113", 58: "312311", 59: "332111",
  60: "314111", 61: "221411", 62: "431111", 63: "111224", 64: "111422",
  65: "121124", 66: "121421", 67: "141122", 68: "141221", 69: "112214",
  70: "112412", 71: "122114", 72: "122411", 73: "142112", 74: "142211",
  75: "241211", 76: "221114", 77: "413111", 78: "241112", 79: "134111",
  80: "111242", 81: "121142", 82: "121241", 83: "114212", 84: "124112",
  85: "124211", 86: "411212", 87: "421112", 88: "421211", 89: "212141",
  90: "214121", 91: "412121", 92: "111143", 93: "111341", 94: "131141",
  95: "114113", 96: "114311", 97: "411113", 98: "411311", 99: "113141",
  100: "114131", 101: "311141", 102: "411131", 103: "211412", 104: "211214",
  105: "211232", 106: "2331112" // STOP
};

/**
 * Convierte un texto en una cadena de módulos binarios (1s y 0s) usando Code-128B.
 */
export function encodeCode128B(text: string): string {
  if (!text) return "";
  const START_B = 104;
  const STOP = 106;

  const charCodes: number[] = [START_B];
  let checkSum = START_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      charCodes.push(code);
      checkSum += code * (i + 1);
    }
  }

  const checkDigit = checkSum % 103;
  charCodes.push(checkDigit);
  charCodes.push(STOP);

  let binaryPattern = "";
  for (let i = 0; i < charCodes.length; i++) {
    const pattern = CODE128_PATTERNS[charCodes[i]];
    if (!pattern) continue;
    let isBar = true;
    for (const char of pattern) {
      const width = parseInt(char, 10);
      binaryPattern += (isBar ? "1" : "0").repeat(width);
      isBar = !isBar;
    }
  }
  return binaryPattern;
}

export interface LabelPrintConfig {
  printerType: "zpl" | "epl" | "tspl" | "web_driver";
  widthMm: number;
  heightMm: number;
  dpi: 203 | 300;
  copies: number;
  showCompanyName: boolean;
  companyName: string;
  showProductName: boolean;
  showBarcodeNumber: boolean;
  showPriceUSD: boolean;
  showPriceVES: boolean;
  showSku: boolean;
  zebraConnection?: "browser_print" | "network_ip" | "windows_printer" | "web_usb";
  zebraIp?: string;
  zebraPort?: number;
  zebraPrinterName?: string;
}

export const DEFAULT_LABEL_CONFIG: LabelPrintConfig = {
  printerType: "web_driver",
  widthMm: 50,
  heightMm: 30,
  dpi: 203,
  copies: 1,
  showCompanyName: true,
  companyName: "DISTRIBUIDORA ERO VE C.A.",
  showProductName: true,
  showBarcodeNumber: true,
  showPriceUSD: true,
  showPriceVES: true,
  showSku: true,
  zebraConnection: "browser_print",
  zebraIp: "192.168.1.200",
  zebraPort: 9100,
  zebraPrinterName: "ZTC GK420t",
};

export interface ProductLabelData {
  name: string;
  sku: string;
  barcode?: string;
  priceUSD?: number;
  priceVES?: number;
  basePrice?: number;
  price?: number;
  unitOfMeasure?: string;
  presentationName?: string;
}

/**
 * Genera comandos ZPL-II nativos para impresoras Zebra (GK420, ZD220, ZD230, ZD421, etc.).
 */
export function generateZpl(data: ProductLabelData, config: LabelPrintConfig): string {
  const dpmm = config.dpi === 300 ? 11.81 : 8.0; // dots per mm
  const widthDots = Math.round(config.widthMm * dpmm);
  const heightDots = Math.round(config.heightMm * dpmm);

  const cleanName = (data?.name || "").replace(/[\^~]/g, "").slice(0, 32);
  const cleanBarcode = (data?.barcode || data?.sku || "000000").replace(/[\^~]/g, "");

  const rawPriceUSD = Number(
    typeof data?.priceUSD === "number" && !isNaN(data.priceUSD)
      ? data.priceUSD
      : typeof (data as any)?.basePrice === "number" && !isNaN((data as any).basePrice)
      ? (data as any).basePrice
      : typeof (data as any)?.price === "number" && !isNaN((data as any).price)
      ? (data as any).price
      : 0
  );
  const rawPriceVES = Number(
    typeof data?.priceVES === "number" && !isNaN(data.priceVES)
      ? data.priceVES
      : 0
  );

  const priceUSDText = `USD $${rawPriceUSD.toFixed(2)}`;
  const priceVESText = `Bs. ${rawPriceVES.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const barcodeHeight = config.heightMm <= 25 ? 35 : 55;
  const barcodeWidth = config.widthMm <= 40 ? 1 : 2;

  let zpl = `^XA\n`;
  zpl += `^PW${widthDots}\n`;
  zpl += `^LL${heightDots}\n`;
  zpl += `^LH0,0\n`;
  zpl += `^CI28\n`; // UTF-8 Encoding

  let currentY = 15;

  if (config.showCompanyName && config.companyName) {
    const compName = config.companyName.slice(0, 30).toUpperCase();
    zpl += `^FO10,${currentY}^A0N,18,18^FB${widthDots - 20},1,0,C^FD${compName}^FS\n`;
    currentY += 24;
  }

  if (config.showProductName) {
    zpl += `^FO10,${currentY}^A0N,22,22^FB${widthDots - 20},2,0,C^FD${cleanName}^FS\n`;
    currentY += config.heightMm <= 25 ? 26 : 42;
  }

  // Código de barras Code-128
  zpl += `^FO15,${currentY}^BY${barcodeWidth},2.5,${barcodeHeight}^BCN,${barcodeHeight},${config.showBarcodeNumber ? "Y" : "N"},N,N^FD${cleanBarcode}^FS\n`;
  currentY += barcodeHeight + (config.showBarcodeNumber ? 25 : 10);

  // SKU justo debajo del código de barras
  if (config.showSku && data.sku) {
    zpl += `^FO10,${currentY}^A0N,18,18^FB${widthDots - 20},1,0,C^FDSKU: ${data.sku}${data.presentationName ? ` (${data.presentationName})` : ""}^FS\n`;
    currentY += 22;
  }

  // Precios
  if (config.showPriceUSD || config.showPriceVES) {
    let priceLine = "";
    if (config.showPriceUSD) priceLine += `${priceUSDText} `;
    if (config.showPriceVES) priceLine += `(${priceVESText})`;

    if (priceLine.trim()) {
      zpl += `^FO10,${currentY}^A0N,24,24^FB${widthDots - 20},1,0,C^FD${priceLine.trim()}^FS\n`;
      currentY += 26;
    }
  }

  zpl += `^PQ${Math.max(1, config.copies)}\n`;
  zpl += `^XZ\n`;

  return zpl;
}

/**
 * Genera comandos TSPL para impresoras TSC, Xprinter, Gprinter.
 */
export function generateTspl(data: ProductLabelData, config: LabelPrintConfig): string {
  const cleanBarcode = (data?.barcode || data?.sku || "000000").replace(/"/g, "");
  const rawPriceUSD = Number(
    typeof data?.priceUSD === "number" && !isNaN(data.priceUSD)
      ? data.priceUSD
      : typeof (data as any)?.basePrice === "number" && !isNaN((data as any).basePrice)
      ? (data as any).basePrice
      : typeof (data as any)?.price === "number" && !isNaN((data as any).price)
      ? (data as any).price
      : 0
  );
  let tspl = `SIZE ${config.widthMm} mm, ${config.heightMm} mm\n`;
  tspl += `GAP 2 mm, 0 mm\n`;
  tspl += `DIRECTION 1\n`;
  tspl += `CLS\n`;

  let y = 10;
  if (config.showCompanyName && config.companyName) {
    tspl += `TEXT 10,${y},"1",0,1,1,"${(config.companyName || "").slice(0, 30)}"\n`;
    y += 20;
  }
  if (config.showProductName) {
    tspl += `TEXT 10,${y},"2",0,1,1,"${(data?.name || "").slice(0, 30)}"\n`;
    y += 28;
  }

  tspl += `BARCODE 15,${y},"128",40,${config.showBarcodeNumber ? 1 : 0},0,2,2,"${cleanBarcode}"\n`;
  y += 50;

  if (config.showSku && data.sku) {
    tspl += `TEXT 10,${y},"2",0,1,1,"SKU: ${data.sku}"\n`;
    y += 22;
  }

  if (config.showPriceUSD) {
    tspl += `TEXT 10,${y},"3",0,1,1,"USD $${rawPriceUSD.toFixed(2)}"\n`;
  }

  tspl += `PRINT ${Math.max(1, config.copies)}\n`;
  return tspl;
}
