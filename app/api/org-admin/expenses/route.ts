import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ExpenseStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const organizationId = session.organizationId;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const allowedStatuses = [
      "PENDING",
      "WARNING",
      "APPROVED",
      "REJECTED",
    ] as const satisfies readonly ExpenseStatus[];

    const status: ExpenseStatus | undefined =
      statusParam &&
      (allowedStatuses as readonly string[]).includes(statusParam)
        ? (statusParam as ExpenseStatus)
        : undefined;

    const expenses = await prisma.expenseBase.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                {
                  createdBy: {
                    is: { name: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  createdBy: {
                    is: { email: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  receiptExpense: {
                    is: { companyName: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  receiptExpense: {
                    is: { fsNumber: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  receiptExpense: {
                    is: {
                      invoiceNumber: { contains: q, mode: "insensitive" },
                    },
                  },
                },
                {
                  receiptExpense: {
                    is: { tinNumber: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  receiptExpense: {
                    is: { mrcNumber: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  paymentVoucherExpense: {
                    is: { paidTo: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  paymentVoucherExpense: {
                    is: {
                      invoiceNumber: { contains: q, mode: "insensitive" },
                    },
                  },
                },
                {
                  paymentVoucherExpense: {
                    is: { tinNumber: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  generalExpense: {
                    is: { paidTo: { contains: q, mode: "insensitive" } },
                  },
                },
                {
                  generalExpense: {
                    is: { description: { contains: q, mode: "insensitive" } },
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
            fsNumber: true,
            tinNumber: true,
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
    });

    const mapped = expenses
      .map((e) => {
        if (e.expenseType === "RECEIPT" && e.receiptExpense) {
          return {
            id: e.id,
            expenseType: e.expenseType,
            date: e.receiptExpense.purchasedDate,
            vendor: e.receiptExpense.companyName,
            reference: e.receiptExpense.fsNumber,
            total: e.receiptExpense.total,
            status: e.status,
            createdAt: e.createdAt,
            createdByUser: e.createdBy,
          };
        }

        if (e.expenseType === "PAYMENT_VOUCHER" && e.paymentVoucherExpense) {
          return {
            id: e.id,
            expenseType: e.expenseType,
            date: e.paymentVoucherExpense.purchasedDate,
            vendor: e.paymentVoucherExpense.paidTo,
            reference: e.paymentVoucherExpense.invoiceNumber,
            total: e.paymentVoucherExpense.totalAmount,
            status: e.status,
            createdAt: e.createdAt,
            createdByUser: e.createdBy,
          };
        }

        if (e.expenseType === "GENERAL" && e.generalExpense) {
          return {
            id: e.id,
            expenseType: e.expenseType,
            date: e.generalExpense.paymentDate,
            vendor: e.generalExpense.paidTo,
            reference: e.generalExpense.description,
            total: e.generalExpense.amount,
            status: e.status,
            createdAt: e.createdAt,
            createdByUser: e.createdBy,
          };
        }

        return null;
      })
      .filter(Boolean);

    return NextResponse.json({ expenses: mapped });
  } catch (error) {
    console.error(" Get expenses error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
