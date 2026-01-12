export type LlmReceiptResult = {
  companyName: string | null;
  tinNumber: string | null;
  fsNumber: string | null;
  invoiceNumber: string | null;
  purchasedDate: string | null; // dd/MM/yyyy
  paymentMethod:
    | "cash"
    | "check"
    | "credit_card"
    | "bank_transfer"
    | "other"
    | null;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
};

const FALLBACK: LlmReceiptResult = {
  companyName: null,
  tinNumber: null,
  fsNumber: null,
  invoiceNumber: null,
  purchasedDate: null,
  paymentMethod: null,
  items: [],
};

function normalizeForLlm(raw: string) {
  let t = String(raw ?? "");
  // Required normalization
  t = t.replace(/Ø/g, "0");

  // Be conservative: only replace standalone I when it looks numeric-related.
  // Example from receipts: "I .00" -> "1.00"
  t = t.replace(/\bI\s*\.\s*(\d{2})\b/g, "1.$1");
  t = t.replace(/\bI\b(?=\s*[0-9])/g, "1");

  t = t.replace(/\r\n/g, "\n");
  t = t.replace(/[\t ]+/g, " ");
  return t.trim();
}

function coerceStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
}

function coercePaymentMethod(
  value: unknown
): LlmReceiptResult["paymentMethod"] {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "cash") return "cash";
  if (v === "check") return "check";
  if (v === "credit_card") return "credit_card";
  if (v === "bank_transfer") return "bank_transfer";
  if (v === "other") return "other";
  return null;
}

function coerceItems(value: unknown): LlmReceiptResult["items"] {
  if (!Array.isArray(value)) return [];
  const out: LlmReceiptResult["items"] = [];
  for (const it of value) {
    if (!it || typeof it !== "object") continue;
    const name = coerceStringOrNull((it as any).name);
    const quantity = Number((it as any).quantity);
    const unitPrice = Number((it as any).unitPrice);
    if (!name) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
    out.push({ name, quantity, unitPrice });
  }
  return out;
}

function sanitizeResult(json: any): LlmReceiptResult {
  if (!json || typeof json !== "object") return FALLBACK;
  return {
    companyName: coerceStringOrNull(json.companyName),
    tinNumber: coerceStringOrNull(json.tinNumber),
    fsNumber: coerceStringOrNull(json.fsNumber),
    invoiceNumber: coerceStringOrNull(json.invoiceNumber),
    purchasedDate: coerceStringOrNull(json.purchasedDate),
    paymentMethod: coercePaymentMethod(json.paymentMethod),
    items: coerceItems(json.items),
  };
}

async function callOpenAiJson(args: {
  apiKey: string;
  ocrText: string;
  timeoutMs: number;
}): Promise<LlmReceiptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a strict information extraction function. Return ONLY valid JSON. No prose, no markdown.",
          },
          {
            role: "user",
            content: [
              "Extract receipt fields from OCR text.",
              "Return JSON ONLY with EXACT keys and types:",
              "{",
              '  "companyName": string|null,',
              '  "tinNumber": string|null,',
              '  "fsNumber": string|null,',
              '  "invoiceNumber": string|null,',
              '  "purchasedDate": string|null,',
              '  "paymentMethod": "cash"|"check"|"credit_card"|"bank_transfer"|"other"|null,',
              '  "items": [{"name": string, "quantity": number, "unitPrice": number}]',
              "}",
              "Rules:",
              "- Use null when missing/uncertain. Do NOT guess.",
              "- purchasedDate must be in dd/MM/yyyy if present.",
              "- Items: only real purchased items. Exclude totals, subtotal, VAT/tax, payment lines, cashier/buyer lines, item count.",
              "- Do NOT calculate VAT/subtotal/total.",
              "- Do NOT infer categories/purchase types/policies.",
              "OCR TEXT:",
              args.ocrText,
            ].join("\n"),
          },
        ],
      }),
      signal: controller.signal,
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return FALLBACK;

    try {
      const parsed = JSON.parse(content);
      return sanitizeResult(parsed);
    } catch {
      return FALLBACK;
    }
  } catch {
    return FALLBACK;
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseReceiptWithLLM(
  ocrText: string
): Promise<LlmReceiptResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return FALLBACK;

  const normalized = normalizeForLlm(ocrText);
  if (!normalized) return FALLBACK;

  // Keep payload bounded; OCR can be huge.
  const clipped =
    normalized.length > 12_000 ? normalized.slice(0, 12_000) : normalized;

  const result = await callOpenAiJson({
    apiKey,
    ocrText: clipped,
    timeoutMs: 15_000,
  });

  return result ?? FALLBACK;
}

export function getReceiptLlmFallback(): LlmReceiptResult {
  return { ...FALLBACK, items: [] };
}
