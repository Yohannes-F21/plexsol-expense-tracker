import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const approvals = await prisma.expense.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        status: { in: ["PENDING", "WARNING"] },
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
      { status: 500 }
    );
  }
}
