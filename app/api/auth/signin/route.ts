import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { z } from "zod";

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    console.log("Signin API called");

    const body = await request.json();
    console.log("Request body parsed");

    const validatedData = signinSchema.parse(body);
    console.log("Signin attempt for:", validatedData.email);

    try {
      await prisma.$connect();
      console.log("Database connected");
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return NextResponse.json(
        {
          error:
            "Database connection failed. Please ensure Prisma is properly configured.",
        },
        { status: 500 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: {
        organization: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      console.log("User not found");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    console.log("User found:", {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Verify password
    const isValidPassword = await verifyPassword(
      validatedData.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      console.log("Invalid password");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Enforce blocking rules
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Your account is blocked" },
        { status: 403 }
      );
    }
    if (
      user.organizationId &&
      user.organization &&
      !user.organization.isActive
    ) {
      return NextResponse.json(
        { error: "Your organization is blocked" },
        { status: 403 }
      );
    }

    console.log("Password verified, creating session");

    // Create session
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    });

    console.log("Session created successfully");

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
