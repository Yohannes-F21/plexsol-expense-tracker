// Legacy regex-based receipt parsing has been removed.
// Kept as a tiny stub to avoid breaking old imports.

export type ParsedReceipt = {
  companyName?: string;
  tinNumber?: string;
  fsNumber?: string;
  invoiceNumber?: string;
  purchasedDate?: string; // dd/MM/yyyy
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
};

export function parseReceiptText(_rawText: string): ParsedReceipt {
  return { items: [] };
}
