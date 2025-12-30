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

    const expenses = await prisma.expense.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: { select: { id: true, name: true } },
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
