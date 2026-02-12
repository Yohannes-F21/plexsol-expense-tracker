import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const organizations = await prisma.organization.findMany({
      where: q
        ? {
            name: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {},
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
      take: 500,
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("[super-admin] Get organization options error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
