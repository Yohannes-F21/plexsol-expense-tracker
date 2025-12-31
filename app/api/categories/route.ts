import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toApiCategoryType(type: string) {
  const upper = type.toUpperCase();
  if (upper === "ADMINISTRATIVE") return "administrative";
  return "operational";
}

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const categories = await prisma.category.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      categories: categories.map((c) => ({
        ...c,
        type: toApiCategoryType(String(c.type)),
      })),
    });
  } catch (error) {
    console.error("[v0] Get categories error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
