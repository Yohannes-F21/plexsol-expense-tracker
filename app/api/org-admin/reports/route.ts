import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VAT_RATE = 0.15;

const REPORT_HEADERS = [
  "VAT Category",
  "Calendar Type",
  "Types of Purchase",
  "TIN",
  "Seller",
  "Date of Purchase",
  "MRC Number",
  "VAT Receipt Number",
  "Description",
  "Unit of Measure",
  "Quantity",
  "Unit Price",
  "Total Value",
  "VAT",
  "Value After VAT",
] as const;

type ReportHeader = (typeof REPORT_HEADERS)[number];
export type ReportRow = Record<ReportHeader, string | number>;

type ReportItem = {
  vatCategory: string;
  quantity: unknown;
  unitPrice: unknown;
  lineTotal: unknown;
  itemName: string;
  receiptExpense: {
    tinNumber: string | null;
    companyName: string;
    purchasedDate: Date;
    mrcNumber: string | null;
    fsNumber: string | null;
  };
  unitOfMeasure: { label: string } | null;
  purchaseType: { label: string } | null;
};

function toNumber(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && "toNumber" in x) {
    const anyX = x as any;
    if (typeof anyX.toNumber === "function") return anyX.toNumber();
  }
  return Number(x);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "";
  // Keep up to 2 decimals but trim trailing zeros
  return n
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function formatDateDMY(value: Date): string {
  // Format as dd/mm/yyyy (matches the sample screenshot)
  return value.toLocaleDateString("en-GB");
}

function normalizeFsNumber(fsNumber: string | null): string {
  const raw = String(fsNumber ?? "").trim();
  if (!raw) return "";
  const stripped = raw.toUpperCase().startsWith("FS") ? raw.slice(2) : raw;
  return `FS${stripped}`;
}

function parseLocalDate(dateStr: string, endOfDay: boolean) {
  // dateStr expected: YYYY-MM-DD
  const base = endOfDay ? `${dateStr}T23:59:59.999` : `${dateStr}T00:00:00.000`;
  const d = new Date(base);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const fromDate = from && to ? parseLocalDate(from, false) : null;
    const toDate = from && to ? parseLocalDate(to, true) : null;

    if ((from && !to) || (!from && to)) {
      // Spec only defines behavior when both are provided; keep it simple.
      return NextResponse.json(
        { error: "Both from and to dates are required" },
        { status: 400 },
      );
    }

    if (from && to && (!fromDate || !toDate)) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 },
      );
    }

    const items = (await (prisma as any).receiptExpenseItem.findMany({
      where: {
        receiptExpense: {
          expenseBase: {
            organizationId: orgId,
            isActive: true,
            expenseType: "RECEIPT",
          },
          ...(fromDate && toDate
            ? { purchasedDate: { gte: fromDate, lte: toDate } }
            : {}),
        },
      },
      include: {
        receiptExpense: {
          select: {
            tinNumber: true,
            companyName: true,
            purchasedDate: true,
            mrcNumber: true,
            fsNumber: true,
          },
        },
        unitOfMeasure: { select: { label: true } },
        purchaseType: { select: { label: true } },
      },
      orderBy: { receiptExpense: { purchasedDate: "desc" } },
    })) as ReportItem[];

    const rows: ReportRow[] = items.map((it) => {
      const qty = toNumber(it.quantity);
      const unitPrice = toNumber(it.unitPrice);
      const subtotal = round2(toNumber(it.lineTotal));
      const vat = round2(subtotal * VAT_RATE);
      const total = round2(subtotal + vat);

      return {
        "VAT Category": String(it.vatCategory),
        "Calendar Type": "G",
        "Types of Purchase": it.purchaseType?.label ?? "",
        TIN: it.receiptExpense.tinNumber ?? "",
        Seller: it.receiptExpense.companyName,
        "Date of Purchase": formatDateDMY(it.receiptExpense.purchasedDate),
        "MRC Number": it.receiptExpense.mrcNumber ?? "",
        "VAT Receipt Number": normalizeFsNumber(it.receiptExpense.fsNumber),
        Description: it.itemName,
        "Unit of Measure": it.unitOfMeasure?.label ?? "",
        Quantity: formatQty(qty),
        "Unit Price": formatMoney(unitPrice),
        "Total Value": formatMoney(subtotal),
        VAT: formatMoney(vat),
        "Value After VAT": formatMoney(total),
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("[v0] Get reports error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
