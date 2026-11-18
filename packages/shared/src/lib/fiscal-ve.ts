/**
 * Librería de Utilidades Fiscales Venezolanas (SENIAT)
 * Cálculos normados de IVA, IGTF, Retenciones ISLR/IVA y redondeos.
 */

export interface FiscalCalculationItem {
  quantity: number;
  unitPrice: number;
  taxRate: number; // Ej: 16.00
  taxInclusive: boolean;
  discountPercent?: number;
}

export interface FiscalCalculationSummary {
  baseExempt: number;
  baseTaxable: number;
  taxAmount: number;
  subtotalGross: number;
  discountAmount: number;
  subtotalNet: number;
  total: number;
}

/**
 * Calcula la base imponible y el IVA exacto según la modalidad inclusiva o exclusiva
 */
export function calculateFiscalItem(item: FiscalCalculationItem): {
  unitBasePrice: number;
  unitTaxAmount: number;
  unitFinalPrice: number;
  itemBaseAmount: number;
  itemTaxAmount: number;
  itemTotalAmount: number;
} {
  const discountFactor = 1 - (item.discountPercent || 0) / 100;
  const rateFactor = item.taxRate / 100;

  let unitBasePrice = item.unitPrice;
  let unitTaxAmount = 0;
  let unitFinalPrice = item.unitPrice;

  if (item.taxRate === 0) {
    unitTaxAmount = 0;
    unitBasePrice = item.unitPrice;
    unitFinalPrice = item.unitPrice;
  } else if (item.taxInclusive) {
    // Si incluye IVA: Base = Precio / (1 + Tasa)
    unitBasePrice = Number((item.unitPrice / (1 + rateFactor)).toFixed(4));
    unitTaxAmount = Number((item.unitPrice - unitBasePrice).toFixed(4));
    unitFinalPrice = item.unitPrice;
  } else {
    // Si no incluye IVA: Base = Precio, IVA = Base * Tasa
    unitBasePrice = item.unitPrice;
    unitTaxAmount = Number((item.unitPrice * rateFactor).toFixed(4));
    unitFinalPrice = Number((item.unitPrice + unitTaxAmount).toFixed(4));
  }

  const effectiveUnitBase = unitBasePrice * discountFactor;
  const itemBaseAmount = Number((effectiveUnitBase * item.quantity).toFixed(2));
  const itemTaxAmount = Number((itemBaseAmount * rateFactor).toFixed(2));
  const itemTotalAmount = Number((itemBaseAmount + itemTaxAmount).toFixed(2));

  return {
    unitBasePrice,
    unitTaxAmount,
    unitFinalPrice,
    itemBaseAmount,
    itemTaxAmount,
    itemTotalAmount,
  };
}

/**
 * Calcula el IGTF (Impuesto a las Grandes Transacciones Financieras - 3%)
 * Aplicable a pagos en divisas / efectivo / criptomonedas no custodiadas en bancos nacionales.
 */
export function calculateIGTF(paymentAmountUSD: number, igtfRate = 3.0): number {
  return Number(((paymentAmountUSD * igtfRate) / 100).toFixed(2));
}

/**
 * Calcula la Retención de IVA (Art. 11 de la Ley de IVA - Providencia SNAT/2015/0049)
 * @param ivaAmount Monto total del IVA facturado
 * @param percentage Porcentaje de retención (75% estándar o 100% especial)
 */
export function calculateIVARetention(ivaAmount: number, percentage: 75 | 100 = 75): number {
  return Number(((ivaAmount * percentage) / 100).toFixed(2));
}

/**
 * Aplica regla de redondeo comercial / fiscal
 */
export function applyRounding(value: number, roundingFactor: number): number {
  if (!roundingFactor || roundingFactor <= 0) return Number(value.toFixed(2));
  const multiplier = 1 / roundingFactor;
  return Number((Math.round(value * multiplier) / multiplier).toFixed(2));
}

/**
 * Genera el número de comprobante de retención SENIAT (YYYYMM + 8 dígitos correlativos)
 */
export function generateSENIATVoucherNumber(year: number, month: number, sequence: number): string {
  const yyyy = year.toString();
  const mm = month.toString().padStart(2, '0');
  const seq = sequence.toString().padStart(8, '0');
  return `${yyyy}${mm}${seq}`;
}

/**
 * Calcula la Retención de ISLR (Decreto 1808)
 * @param taxableBaseAmount Base imponible sujeta a retención
 * @param ratePercentage Porcentaje de retención (ej. 1, 2, 3, 5%)
 * @param subtractingFactor Sustraendo en Bs (para PN Residentes)
 */
export function calculateISLRRetention(
  taxableBaseAmount: number,
  ratePercentage: number,
  subtractingFactor: number = 0
): number {
  const gross = (taxableBaseAmount * ratePercentage) / 100;
  const net = Math.max(0, gross - subtractingFactor);
  return Number(net.toFixed(2));
}

export interface RifAnalysisResult {
  rawRif: string;
  cleanRif: string;
  formattedRif: string;
  prefix: 'V' | 'E' | 'J' | 'G' | 'P' | 'C';
  number: string;
  checkDigit: string;
  isValidFormat: boolean;
  isValidChecksum: boolean;
  expectedCheckDigit: number;
  isPersonNatural: boolean;
  isResident: boolean;
  personType: 'NATURAL' | 'JURIDICA' | 'GUBERNAMENTAL' | 'COMUNAL';
  seniatPortalUrl: string;
}

/**
 * Valida, formatea y analiza un RIF venezolano según el algoritmo Módulo 11 oficial del SENIAT.
 */
export function analyzeRif(rawRif: string): RifAnalysisResult {
  const clean = (rawRif || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const defaultRes: RifAnalysisResult = {
    rawRif,
    cleanRif: clean,
    formattedRif: clean,
    prefix: 'J',
    number: '',
    checkDigit: '',
    isValidFormat: false,
    isValidChecksum: false,
    expectedCheckDigit: -1,
    isPersonNatural: false,
    isResident: true,
    personType: 'JURIDICA',
    seniatPortalUrl: `https://contribuyente.seniat.gob.ve/BuscaRif/BuscaRif.jsp?p_rif=${clean}`,
  };

  if (!clean || clean.length < 2) return defaultRes;

  const prefixChar = clean[0] as 'V' | 'E' | 'J' | 'G' | 'P' | 'C';
  const prefixMap: Record<string, number> = { V: 1, E: 2, J: 3, P: 4, G: 5, C: 6 };

  if (!(prefixChar in prefixMap)) return defaultRes;

  const digitsOnly = clean.slice(1);
  if (!/^\d+$/.test(digitsOnly)) return defaultRes;

  const isPersonNatural = prefixChar === 'V' || prefixChar === 'E';
  const isResident = prefixChar !== 'P' && prefixChar !== 'E';
  const personType =
    prefixChar === 'V' || prefixChar === 'E'
      ? 'NATURAL'
      : prefixChar === 'G'
        ? 'GUBERNAMENTAL'
        : prefixChar === 'C'
          ? 'COMUNAL'
          : 'JURIDICA';

  if (clean.length < 9) {
    return {
      ...defaultRes,
      prefix: prefixChar,
      number: digitsOnly,
      formattedRif: `${prefixChar}-${digitsOnly}`,
      isPersonNatural,
      isResident,
      personType,
    };
  }

  let coreNumber: string;
  let checkDigitStr: string;

  if (clean.length === 9) {
    coreNumber = digitsOnly.slice(0, -1).padStart(8, '0');
    checkDigitStr = digitsOnly.slice(-1);
  } else {
    coreNumber = digitsOnly.slice(0, 8);
    checkDigitStr = digitsOnly.slice(8, 9);
  }

  const padded10 = `${prefixChar}${coreNumber}${checkDigitStr}`;
  const weights = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = prefixMap[prefixChar] * weights[0];
  for (let i = 1; i < 9; i++) {
    sum += parseInt(padded10[i], 10) * weights[i];
  }

  const residue = sum % 11;
  let expectedCheckDigit = 11 - residue;
  if (expectedCheckDigit >= 10) expectedCheckDigit = 0;

  const providedDigit = parseInt(checkDigitStr, 10);
  const isValidChecksum = expectedCheckDigit === providedDigit;
  const formattedRif = `${prefixChar}-${coreNumber}-${checkDigitStr}`;

  return {
    rawRif,
    cleanRif: padded10,
    formattedRif,
    prefix: prefixChar,
    number: coreNumber,
    checkDigit: checkDigitStr,
    isValidFormat: true,
    isValidChecksum,
    expectedCheckDigit,
    isPersonNatural,
    isResident,
    personType,
    seniatPortalUrl: `https://contribuyente.seniat.gob.ve/BuscaRif/BuscaRif.jsp?p_rif=${padded10}`,
  };
}

