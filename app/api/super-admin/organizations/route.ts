import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const organizations = await prisma.organization.findMany({
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
            expenses: true,
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

    console.log("Fetched organizations:", organizations.length);

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("Get organizations error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
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
            expenses: true,
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

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Create organization error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
