import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, revokeAllSessionsForUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(request: Request, context: any) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params as { id: string };

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID missing" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const data = patchSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, organizationId: true, role: true, isActive: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existing.role !== "STAFF") {
      return NextResponse.json(
        { error: "Only staff members can be activated/deactivated" },
        { status: 400 },
      );
    }

    if (existing.isActive === data.isActive) {
      return NextResponse.json({ success: true });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: data.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (data.isActive === false) {
      await revokeAllSessionsForUser(id);
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Update org-admin user active error:", error);

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
