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

export function formatError(error: unknown) {
  if (error instanceof Error) return error.message;

  // ErrorEvent (e.g. WebSocket/network failures) often stringifies to "[object ErrorEvent]".
  if (typeof error === "object" && error !== null) {
    const anyErr = error as any;

    if (typeof anyErr.message === "string" && anyErr.message)
      return anyErr.message;
    if (typeof anyErr.type === "string" && anyErr.type)
      return `ErrorEvent(${anyErr.type})`;
    if (typeof anyErr.code === "string" && anyErr.code) return anyErr.code;
    if (typeof anyErr.name === "string" && anyErr.name) return anyErr.name;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
