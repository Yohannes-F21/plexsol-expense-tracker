// NOTE: If you're still seeing a "uuid = text" error,
// you may need to regenerate your Prisma client by running:
// npx prisma generate

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const { searchParams } = new URL(request.url);

    const organizationId = searchParams.get("organizationId");
    const isActiveParam = searchParams.get("isActive");
    const q = searchParams.get("q")?.trim();

    // UUID v4 validation regex
    // const uuidV4Regex =
    //   /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const whereClause: Prisma.UserWhereInput = {};
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }
    if (isActiveParam === "true") whereClause.isActive = true;
    if (isActiveParam === "false") whereClause.isActive = false;
    if (q) {
      whereClause.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { organization: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            expenses: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("[v0] Get users error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
