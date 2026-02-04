import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const approvals = await prisma.expenseBase.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        status: { in: ["PENDING", "WARNING"] },
        ...(q
          ? {
              OR: [
                { createdBy: { name: { contains: q, mode: "insensitive" } } },
                { createdBy: { email: { contains: q, mode: "insensitive" } } },
                {
                  receiptExpense: {
                    companyName: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  receiptExpense: {
                    fsNumber: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  receiptExpense: {
                    tinNumber: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  receiptExpense: {
                    mrcNumber: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  paymentVoucherExpense: {
                    paidTo: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  paymentVoucherExpense: {
                    invoiceNumber: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  paymentVoucherExpense: {
                    tinNumber: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  generalExpense: {
                    paidTo: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  generalExpense: {
                    description: { contains: q, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        expenseType: true,
        status: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        receiptExpense: {
          select: {
            purchasedDate: true,
            companyName: true,
            tinNumber: true,
            fsNumber: true,
            total: true,
          },
        },
        paymentVoucherExpense: {
          select: {
            purchasedDate: true,
            paidTo: true,
            invoiceNumber: true,
            totalAmount: true,
          },
        },
        generalExpense: {
          select: {
            paymentDate: true,
            paidTo: true,
            description: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const mapped = approvals
      .map((row) => {
        if (row.expenseType === "RECEIPT" && row.receiptExpense) {
          return {
            id: row.id,
            expenseType: row.expenseType,
            date: row.receiptExpense.purchasedDate,
            vendor: row.receiptExpense.companyName,
            reference: row.receiptExpense.fsNumber,
            total: row.receiptExpense.total,
            status: row.status,
            createdAt: row.createdAt,
            createdByUser: row.createdBy,
          };
        }

        if (
          row.expenseType === "PAYMENT_VOUCHER" &&
          row.paymentVoucherExpense
        ) {
          return {
            id: row.id,
            expenseType: row.expenseType,
            date: row.paymentVoucherExpense.purchasedDate,
            vendor: row.paymentVoucherExpense.paidTo,
            reference: row.paymentVoucherExpense.invoiceNumber,
            total: row.paymentVoucherExpense.totalAmount,
            status: row.status,
            createdAt: row.createdAt,
            createdByUser: row.createdBy,
          };
        }

        if (row.expenseType === "GENERAL" && row.generalExpense) {
          return {
            id: row.id,
            expenseType: row.expenseType,
            date: row.generalExpense.paymentDate,
            vendor: row.generalExpense.paidTo,
            reference: row.generalExpense.description,
            total: row.generalExpense.amount,
            status: row.status,
            createdAt: row.createdAt,
            createdByUser: row.createdBy,
          };
        }

        return null;
      })
      .filter(Boolean);

    return NextResponse.json({ approvals: mapped });
  } catch (error) {
    console.error("[org-admin] Get approvals error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
