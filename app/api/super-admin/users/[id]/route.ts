import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: any) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const body = await request.json();
    const { isActive } = body;

    const params =
      context.params instanceof Promise ? await context.params : context.params;
    const { id } = params;

    // UUID v4 validation regex
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidV4Regex.test(id)) {
      return NextResponse.json(
        { error: "Invalid user id format" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("[v0] Update user error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
