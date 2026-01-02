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

    const history = await prisma.approvalHistory.findMany({
      where: {
        expense: { organizationId: session.organizationId },
      },
      select: {
        id: true,
        action: true,
        comment: true,
        createdAt: true,
        performedBy: { select: { id: true, name: true, email: true } },
        expense: {
          select: {
            id: true,
            companyName: true,
            total: true,
            createdAt: true,
            createdByUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("[org-admin] Get approvals history error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
