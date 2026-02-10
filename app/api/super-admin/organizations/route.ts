import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const where: Prisma.OrganizationWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { industry: { contains: q, mode: "insensitive" } },
            { createdBy: { name: { contains: q, mode: "insensitive" } } },
            { createdBy: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {};

    const organizations = await prisma.organization.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            expenseBases: true,
          },
        },
        users: {
          where: {
            role: "ORG_ADMIN",
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const orgIds = organizations.map((o) => o.id);
    const activeExpenseCounts = orgIds.length
      ? await prisma.expenseBase.groupBy({
          by: ["organizationId"],
          where: {
            organizationId: { in: orgIds },
            isActive: true,
          },
          _count: { _all: true },
        })
      : [];

    const activeExpenseCountByOrgId = new Map(
      activeExpenseCounts.map(
        (g) => [g.organizationId, g._count._all] as const,
      ),
    );

    console.log("Fetched organizations:", organizations.length);

    return NextResponse.json(
      organizations.map((org) => ({
        ...org,
        activeExpenseBasesCount: activeExpenseCountByOrgId.get(org.id) ?? 0,
      })),
    );
  } catch (error) {
    console.error("Get organizations error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

const createOrgSchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await request.json();
    const validatedData = createOrgSchema.parse(body);

    console.log("Creating organization:", validatedData);

    const organization = await prisma.organization.create({
      data: {
        name: validatedData.name,
        industry: validatedData.industry,
        isActive: true,
        createdById: session.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            expenseBases: true,
          },
        },
      },
    });

    // best-effort activity log (kept outside transaction to avoid timeouts)
    prisma.activityLog
      .create({
        data: {
          userId: session.id,
          organizationId: organization.id,
          actionType: "ORGANIZATION_CREATED",
          entityType: "Organization",
          entityId: organization.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      })
      .catch((e) => {
        console.warn("Failed to write organization activity log", e);
      });

    return NextResponse.json({
      ...organization,
      activeExpenseBasesCount: 0,
    });
  } catch (error) {
    console.error("Create organization error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
