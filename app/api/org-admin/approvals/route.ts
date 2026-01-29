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

    const approvals = await prisma.expense.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        status: { in: ["PENDING", "WARNING"] },
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
        tinNumber: true,
        fsNumber: true,
        total: true,
        status: true,
        createdAt: true,
        createdByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ approvals });
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
