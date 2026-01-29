import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const statusParam = searchParams.get("status");
    const status =
      statusParam &&
      ["PENDING", "WARNING", "APPROVED", "REJECTED"].includes(statusParam)
        ? statusParam
        : undefined;

    const expenses = await prisma.expense.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { companyName: { contains: q, mode: "insensitive" } },
                {
                  createdByUser: {
                    name: { contains: q, mode: "insensitive" },
                  },
                },
                {
                  createdByUser: {
                    email: { contains: q, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        purchasedDate: true,
        companyName: true,
        total: true,
        status: true,
        createdAt: true,
        createdByUser: { select: { id: true, name: true, email: true } },
        items: {
          take: 1,
          orderBy: { id: "asc" },
          select: { subcategory: { select: { id: true, name: true } } },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("[v0] Get expenses error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
