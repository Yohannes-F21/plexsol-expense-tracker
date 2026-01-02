import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const url = new URL(request.url);
    const search = url.searchParams;

    const organizationId = search.get("organizationId") || undefined;
    const status = search.get("status") || undefined;
    const start = search.get("start");
    const end = search.get("end");
    const page = Math.max(1, Number(search.get("page") || "1"));
    const pageSize = Math.min(100, Number(search.get("pageSize") || "20"));

    const where: any = { isActive: true };
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (start || end) where.createdAt = {};
    if (start) where.createdAt.gte = new Date(start);
    if (end) where.createdAt.lte = new Date(end);

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          createdByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({ total, expenses, page, pageSize });
  } catch (error) {
    console.error("[super-admin] Get expenses error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
