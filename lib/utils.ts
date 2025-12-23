import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as a localized currency string.
 * Defaults to USD if no currency code is provided.
 */
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US"
) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch (e) {
    // Fallback simple formatting
    return `${currency} ${amount.toFixed(2)}`;
  }
}
