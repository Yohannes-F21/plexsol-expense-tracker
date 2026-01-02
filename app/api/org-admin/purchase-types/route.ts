import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createPurchaseTypeSchema = z.object({
  label: z.coerce.number().int().positive(),
  code: z.string().min(1),
});

export async function GET() {
  try {
    const session = await requireRole(["ORG_ADMIN", "STAFF"]);

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const purchaseTypes = await prisma.purchaseType.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isActive: "desc" }, { label: "asc" }, { code: "asc" }],
      select: {
        id: true,
        label: true,
        code: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, purchaseTypes });
  } catch (error) {
    console.error("[v0] List purchase types error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = createPurchaseTypeSchema.parse(body);

    const duplicate = await prisma.purchaseType.findFirst({
      where: {
        organizationId: orgId,
        code: { equals: data.code, mode: "insensitive" },
      },
      select: { id: true, isActive: true },
    });

    if (duplicate) {
      if (!duplicate.isActive) {
        return NextResponse.json(
          {
            error:
              "A purchase type with this name already exists but is inactive.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "A purchase type with this name already exists." },
        { status: 409 }
      );
    }

    const purchaseType = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseType.create({
        data: {
          organizationId: orgId,
          label: data.label,
          code: data.code,
        },
        select: {
          id: true,
          label: true,
          code: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          organizationId: orgId,
          actionType: "PURCHASE_TYPE_CREATED",
          entityType: "PurchaseType",
          entityId: created.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, purchaseType });
  } catch (error) {
    console.error("[v0] Create purchase type error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A purchase type with this code already exists." },
        { status: 409 }
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
