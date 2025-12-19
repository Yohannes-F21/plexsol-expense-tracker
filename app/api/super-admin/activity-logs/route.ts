import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const url = new URL(request.url);
    const search = url.searchParams;

    const organizationId = search.get("organizationId") || undefined;
    const userId = search.get("userId") || undefined;
    const actionType = search.get("actionType") || undefined;
    const start = search.get("start");
    const end = search.get("end");
    const page = Math.max(1, Number(search.get("page") || "1"));
    const pageSize = Math.min(100, Number(search.get("pageSize") || "20"));

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (userId) where.userId = userId;
    if (actionType) where.actionType = actionType;
    if (start || end) where.createdAt = {};
    if (start) where.createdAt.gte = new Date(start);
    if (end) where.createdAt.lte = new Date(end);

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, role: true } },
          organization: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({ total, logs, page, pageSize });
  } catch (error) {
    console.error("[super-admin] Get activity logs error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
