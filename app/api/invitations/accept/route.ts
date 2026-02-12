import { NextResponse } from "next/server";
import { verifyInvitationToken } from "@/lib/invitation";
import { hashPassword, createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const acceptSchema = z.object({
  token: z.string(),
  name: z.string().min(1),
  password: z.string().min(8),
  phoneNumber: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = acceptSchema.parse(body);

    // Verify token
    const verification = await verifyInvitationToken(validatedData.token);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.message },
        { status: 400 },
      );
    }

    const { invitation } = verification;

    // Hash password
    const passwordHash = await hashPassword(validatedData.password);

    // Create user and update invitation in a single transaction
    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: {
          email: invitation!.email,
          name: validatedData.name,
          phoneNumber: validatedData.phoneNumber,
          passwordHash,
          role: invitation!.role,
          organizationId: invitation!.organizationId,
        },
      }),
      prisma.invitation.update({
        where: { id: invitation!.id },
        data: { status: "ACCEPTED" },
      }),
    ]);

    // Create activity log referencing the created user can make it a stand alone component
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          organizationId: invitation!.organizationId ?? null,
          actionType: "INVITATION_ACCEPTED",
          entityType: "Invitation",
          entityId: invitation!.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    } catch (e) {
      console.warn(" Failed to create activity log after invite accept", e);
    }

    // Create session for the new user
    await createSession(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
      request,
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
