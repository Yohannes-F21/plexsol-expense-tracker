import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const url = new URL(request.url);
    const search = url.searchParams;

    const organizationId = search.get("organizationId") || undefined;
    const q = search.get("q")?.trim() || "";
    const expenseType = search.get("expenseType") || undefined;
    const status = search.get("status") || undefined;
    const start = search.get("start");
    const end = search.get("end");
    const page = Math.max(1, Number(search.get("page") || "1"));
    const pageSize = Math.min(100, Number(search.get("pageSize") || "20"));

    const where: any = { isActive: true };
    if (organizationId) where.organizationId = organizationId;
    if (expenseType) {
      const allowed = ["RECEIPT", "PAYMENT_VOUCHER", "GENERAL"];
      if (!allowed.includes(expenseType)) {
        return NextResponse.json(
          { error: "Invalid expenseType" },
          { status: 400 },
        );
      }
      where.expenseType = expenseType;
    }
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { organization: { name: { contains: q, mode: "insensitive" } } },
        { createdBy: { name: { contains: q, mode: "insensitive" } } },
        { createdBy: { email: { contains: q, mode: "insensitive" } } },
        { receiptExpense: { fsNumber: { contains: q, mode: "insensitive" } } },
        {
          receiptExpense: {
            invoiceNumber: { contains: q, mode: "insensitive" },
          },
        },
        {
          paymentVoucherExpense: {
            invoiceNumber: { contains: q, mode: "insensitive" },
          },
        },
      ];
    }
    if (start || end) where.createdAt = {};
    if (start) where.createdAt.gte = new Date(start);
    if (end) where.createdAt.lte = new Date(end);

    const [total, expenses] = await Promise.all([
      prisma.expenseBase.count({ where }),
      prisma.expenseBase.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          receiptExpense: {
            select: {
              companyName: true,
              purchasedDate: true,
              fsNumber: true,
              paymentMethod: true,
              total: true,
            },
          },
          paymentVoucherExpense: {
            select: {
              purchasedDate: true,
              paidTo: true,
              invoiceNumber: true,
              paymentMethod: true,
              totalAmount: true,
            },
          },
          generalExpense: {
            select: {
              paymentDate: true,
              paidTo: true,
              description: true,
              paymentMethod: true,
              amount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const mapped = expenses.map((e) => {
      if (e.expenseType === "RECEIPT" && e.receiptExpense) {
        return {
          id: e.id,
          expenseType: e.expenseType,
          status: e.status,
          createdAt: e.createdAt,
          organization: e.organization,
          createdByUser: e.createdBy,
          date: e.receiptExpense.purchasedDate,
          vendor: e.receiptExpense.companyName,
          reference: e.receiptExpense.fsNumber,
          paymentMethod: e.receiptExpense.paymentMethod,
          total: e.receiptExpense.total,
        };
      }

      if (e.expenseType === "PAYMENT_VOUCHER" && e.paymentVoucherExpense) {
        return {
          id: e.id,
          expenseType: e.expenseType,
          status: e.status,
          createdAt: e.createdAt,
          organization: e.organization,
          createdByUser: e.createdBy,
          date: e.paymentVoucherExpense.purchasedDate,
          vendor: e.paymentVoucherExpense.paidTo,
          reference: e.paymentVoucherExpense.invoiceNumber,
          paymentMethod: e.paymentVoucherExpense.paymentMethod,
          total: e.paymentVoucherExpense.totalAmount,
        };
      }

      if (e.expenseType === "GENERAL" && e.generalExpense) {
        return {
          id: e.id,
          expenseType: e.expenseType,
          status: e.status,
          createdAt: e.createdAt,
          organization: e.organization,
          createdByUser: e.createdBy,
          date: e.generalExpense.paymentDate,
          vendor: e.generalExpense.paidTo,
          reference: null,
          paymentMethod: e.generalExpense.paymentMethod,
          total: e.generalExpense.amount,
        };
      }

      return {
        id: e.id,
        expenseType: e.expenseType,
        status: e.status,
        createdAt: e.createdAt,
        organization: e.organization,
        createdByUser: e.createdBy,
        date: e.createdAt,
        vendor: "-",
        reference: null,
        paymentMethod: "-",
        total: 0,
      };
    });

    return NextResponse.json({ total, expenses: mapped, page, pageSize });
  } catch (error) {
    console.error("[super-admin] Get expenses error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
