/**
 * Centralized numeric and monetary formatters for EroApp ERP.
 * Standardizes formatting based on the client computer's locale with a fallback to Venezuela ('es-VE').
 */

export function getAppLocale(): string {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    try {
      const stored = window.localStorage?.getItem('ero_preferred_locale');
      if (stored) return stored;
    } catch {
      // localStorage may fail in restricted/private contexts
    }

    if (navigator.languages && navigator.languages.length > 0 && navigator.languages[0]) {
      return navigator.languages[0];
    }
    if (navigator.language) {
      return navigator.language;
    }
  }
  return 'es-VE';
}

export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

/**
 * Formats a generic numeric value using the detected client locale or 'es-VE'.
 * @param value Number or numeric string
 * @param options Format options or shorthand minimumFractionDigits (default 2)
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: FormatNumberOptions | number
): string {
  let num: number;
  if (value === null || value === undefined || value === '') {
    num = 0;
  } else {
    num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) {
      num = 0;
    }
  }

  const locale = getAppLocale();
  const minDigits = typeof options === 'number' ? options : (options?.minimumFractionDigits ?? 2);
  const maxDigits = typeof options === 'number' ? options : (options?.maximumFractionDigits ?? Math.max(minDigits, 2));
  const useGrouping = typeof options === 'object' && options?.useGrouping !== undefined ? options.useGrouping : true;

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
      useGrouping,
    }).format(num);
  } catch {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
      useGrouping,
    }).format(num);
  }
}

/**
 * Formats a currency amount with currency symbol or prefix according to ERP standards.
 * @param value Monetary value
 * @param currency 'USD' | 'VES' | string
 * @param decimals Default 2
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency: 'USD' | 'VES' | string = 'USD',
  decimals = 2
): string {
  const formatted = formatNumber(value, decimals);
  const curr = (currency || 'USD').toUpperCase().trim();

  if (curr === 'USD' || curr === '$') {
    return `$ ${formatted}`;
  }
  if (curr === 'VES' || curr === 'BS' || curr === 'BS.' || curr === 'BS.S') {
    return `Bs. ${formatted}`;
  }
  return `${currency} ${formatted}`;
}

/**
 * Shorthand for formatting USD monetary values ($ 1.234,56 in es-VE).
 */
export function formatMoneyUSD(value: number | string | null | undefined, decimals = 2): string {
  return formatCurrency(value, 'USD', decimals);
}

/**
 * Shorthand for formatting VES monetary values (Bs. 1.234,56 in es-VE).
 */
export function formatMoneyVES(value: number | string | null | undefined, decimals = 2): string {
  return formatCurrency(value, 'VES', decimals);
}

/**
 * Formats exchange rates (usually 4 decimal places for BCV, e.g. 54,2345).
 */
export function formatExchangeRate(value: number | string | null | undefined, decimals = 4): string {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: decimals });
}

/**
 * Formats percentage values (e.g. 16,00%).
 */
export function formatPercent(value: number | string | null | undefined, decimals = 2): string {
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Safely parses a user-entered monetary or numeric string into a float number.
 * Correctly distinguishes between thousands separators and decimal separators:
 * - "1.500,50" -> 1500.50
 * - "1,500.50" -> 1500.50
 * - "1.500"    -> 1500 (dot followed by 3 digits is thousands)
 * - "1500,50"  -> 1500.50
 * - "1500.50"  -> 1500.50
 * - "100,00"   -> 100
 * - "100.00"   -> 100
 * - "100"      -> 100
 * - 100        -> 100
 */
export function parseFormattedNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  let str = String(value).trim();
  if (!str) return 0;

  // Remove currency prefixes, spaces and non-numeric chars except . and , and -
  str = str.replace(/[^\d.,-]/g, '');
  if (!str || str === '-') return 0;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // European / Latin: 1.500,50 -> dot is thousands, comma is decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US standard: 1,500.50 -> comma is thousands, dot is decimal
      str = str.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const parts = str.split(',');
    if (parts.length > 2) {
      // Multiple commas: 1,000,000
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (!hasComma && hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      // Multiple dots: 1.000.000
      str = str.replace(/\./g, '');
    } else if (parts.length === 2) {
      // Single dot: e.g. "1.500" (three digits, thousands in VE) vs "150.50" (two digits, decimal)
      if (parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3) {
        str = parts[0] + parts[1];
      }
    }
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Number(parsed.toFixed(4));
}
