import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createInvitation } from "@/lib/invitation";
import { getEmailErrorSummary, sendInviteEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const invitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ORG_ADMIN", "STAFF"]),
  organizationId: z.string().optional(), // Optional for super admins
});

export async function POST(request: Request) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ORG_ADMIN"]);
    const body = await request.json();
    const validatedData = invitationSchema.parse(body);

    let organizationId: string;
    let organizationName: string;

    if (session.role === "SUPER_ADMIN") {
      // Super Admin must specify org and can only invite ORG_ADMIN
      if (!validatedData.organizationId) {
        return NextResponse.json(
          { error: "Organization ID required for Super Admin" },
          { status: 400 },
        );
      }
      if (validatedData.role !== "ORG_ADMIN") {
        return NextResponse.json(
          { error: "Super Admin can only invite Org Admins" },
          { status: 400 },
        );
      }
      organizationId = validatedData.organizationId;

      // Verify organization exists
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 },
        );
      }

      organizationName = org.name;
    } else {
      // Org Admin can only invite STAFF to their own organization
      if (!session.organizationId) {
        return NextResponse.json(
          { error: "Organization ID missing" },
          { status: 400 },
        );
      }
      if (validatedData.role !== "STAFF") {
        return NextResponse.json(
          { error: "Org Admin can only invite Staff members" },
          { status: 400 },
        );
      }
      organizationId = session.organizationId;

      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });

      if (!org) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 },
        );
      }

      organizationName = org.name;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 },
      );
    }

    // Check for pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: validatedData.email,
        organizationId,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "Invitation already sent to this email" },
        { status: 400 },
      );
    }

    // Create invitation and activity log in a transaction
    const invitation = await createInvitation(
      validatedData.email,
      organizationId,
      session.id,
      validatedData.role,
    );

    const appUrlFromEnv = process.env.NEXT_PUBLIC_APP_URL;
    const baseUrl = (appUrlFromEnv ?? new URL(request.url).origin).replace(
      /\/$/,
      "",
    );
    const inviteUrl = `${baseUrl}/accept-invite?token=${invitation.token}`;

    try {
      await sendInviteEmail({
        to: invitation.email,
        inviteUrl,
        organizationName,
        role: validatedData.role,
        expiresAt: invitation.expiresAt,
      });
    } catch (e) {
      console.error(" Failed to send invite email", e);
      try {
        await prisma.invitation.delete({ where: { id: invitation.id } });
      } catch (cleanupError) {
        console.warn(
          "Failed to cleanup invitation after email failure",
          cleanupError,
        );
      }

      return NextResponse.json(
        {
          error: getEmailErrorSummary(e),
        },
        { status: 500 },
      );
    }

    try {
      await prisma.activityLog.create({
        data: {
          userId: session.id,
          organizationId,
          actionType: "INVITATION_SENT",
          entityType: "Invitation",
          entityId: invitation.id,
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
        },
      });
    } catch (e) {
      console.warn(" Failed to create activity log for invitation", e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(" Send invitation error:", error);
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
