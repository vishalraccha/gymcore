/**
 * Currency utility functions for Indian Rupees (₹)
 */

/**
 * Format number as Indian currency (₹)
 * @param amount - Amount to format
 * @param showDecimals - Whether to show decimal places (default: true)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | string | null | undefined, showDecimals: boolean = true): string {
  if (amount === null || amount === undefined || amount === '') {
    return '₹0';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '₹0';
  }

  // Use Indian number formatting
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return formatter.format(numAmount);
}

/**
 * Format number as Indian currency without symbol (for display with custom symbol)
 * @param amount - Amount to format
 * @param showDecimals - Whether to show decimal places (default: true)
 * @returns Formatted number string
 */
export function formatCurrencyNumber(amount: number | string | null | undefined, showDecimals: boolean = true): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '0';
  }

  // Use Indian number formatting without currency symbol
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return formatter.format(numAmount);
}

/**
 * Convert amount to paise (for Razorpay - multiply by 100)
 * @param amount - Amount in rupees
 * @returns Amount in paise
 */
export function toPaise(amount: number | string): number {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.round(numAmount * 100);
}

/**
 * Convert paise to rupees (for Razorpay - divide by 100)
 * @param paise - Amount in paise
 * @returns Amount in rupees
 */
export function fromPaise(paise: number): number {
  return paise / 100;
}

/**
 * Format currency with ₹ symbol (simple version)
 * @param amount - Amount to format
 * @returns Formatted string with ₹ symbol
 */
export function formatRupees(amount: number | string | null | undefined): string {
  const formatted = formatCurrencyNumber(amount);
  return `₹${formatted}`;
}

