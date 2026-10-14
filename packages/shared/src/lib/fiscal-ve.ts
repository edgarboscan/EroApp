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

