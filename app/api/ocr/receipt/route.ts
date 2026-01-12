import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getReceiptLlmFallback,
  parseReceiptWithLLM,
} from "@/services/ocr/parseReceiptWithLLM";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const OCR_TIMEOUT_MS = 20_000;

function fileTypeFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m === "image/png") return "PNG";
  if (m === "image/jpeg" || m === "image/jpg") return "JPG";
  if (m === "image/webp") return "WEBP";
  if (m === "image/heic" || m === "image/heif") return "HEIC";
  return undefined;
}

function isAllowedContentType(ct: string | null) {
  if (!ct) return false;
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  return allowed.includes(ct.toLowerCase());
}

type OcrSpaceResponse = {
  ParsedResults?: Array<{ ParsedText?: string }>;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
};

function asErrorMessage(msg: unknown): string | undefined {
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg))
    return msg.filter((x) => typeof x === "string").join("; ");
  return undefined;
}

export async function POST(req: Request) {
  try {
    await requireRole(["ORG_ADMIN", "STAFF"]);

    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OCR is not configured" },
        { status: 500 }
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!isAllowedContentType(file.type)) {
      return NextResponse.json(
        {
          error: "Unsupported file type",
          supported: ["image/jpeg", "image/png", "image/webp", "image/heic"],
        },
        { status: 415 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large", maxBytes: MAX_BYTES },
        { status: 413 }
      );
    }

    // Forward to OCR.space (backend-only; do not expose API key to client)
    const upstream = new FormData();
    upstream.append("apikey", apiKey);
    upstream.append("OCREngine", "2");
    upstream.append("language", "auto");
    upstream.append("scale", "true");
    upstream.append("detectOrientation", "true");
    upstream.append("isTable", "true");
    const ft = fileTypeFromMime(file.type);
    if (ft) upstream.append("filetype", ft);
    upstream.append("file", file, file.name);

    const controller = new AbortController();
    const startedAt = Date.now();

    const fetchPromise = fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: upstream,
      headers: {
        // Some OCR.space docs recommend sending the key via header.
        apikey: apiKey,
      },
      signal: controller.signal,
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        try {
          controller.abort();
        } finally {
          resolve(null);
        }
      }, OCR_TIMEOUT_MS);
    });

    const maybeRes = await Promise.race([fetchPromise, timeoutPromise]);
    if (maybeRes === null) {
      console.warn(`[ocr] OCR.space timed out after ${OCR_TIMEOUT_MS}ms`);
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const res = maybeRes;

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > 5_000) {
      console.log(`[ocr] OCR.space request took ${elapsedMs}ms`);
    }

    const json = (await res.json()) as OcrSpaceResponse;

    const parsedText = json.ParsedResults?.[0]?.ParsedText ?? "";
    const parsed = await parseReceiptWithLLM(parsedText);

    // If OCR.space errored, still return any parsed data we managed to extract.
    // Never block expense creation due to OCR failure.
    if (!res.ok || json.IsErroredOnProcessing) {
      const message = asErrorMessage(json.ErrorMessage) ?? "OCR provider error";
      return NextResponse.json(
        {
          ...parsed,
          items: parsed.items ?? [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ...parsed,
      items: parsed.items ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return a successful fallback payload so the UI can proceed.
    return NextResponse.json(getReceiptLlmFallback(), { status: 200 });
  }
}
