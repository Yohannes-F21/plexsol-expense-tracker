import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

/**
 * Format a number as a localized currency string.
 * Defaults to ETB if no currency code is provided.
 */
export function formatCurrency(
  amount: number,
  currency = "ETB",
  locale = "en-US"
) {
  try {
    const key = `${locale}|${currency}`;
    let formatter = currencyFormatterCache.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      });
      currencyFormatterCache.set(key, formatter);
    }
    return formatter.format(amount);
  } catch (e) {
    // Fallback simple formatting
    return `${currency} ${amount.toFixed(2)}`;
  }
}
