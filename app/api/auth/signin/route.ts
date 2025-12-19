import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword, createSession } from "@/lib/auth"
import { z } from "zod"

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    console.log("[v0] Signin API called")

    const body = await request.json()
    console.log("[v0] Request body parsed")

    const validatedData = signinSchema.parse(body)
    console.log("[v0] Signin attempt for:", validatedData.email)

    try {
      await prisma.$connect()
      console.log("[v0] Database connected")
    } catch (dbError) {
      console.error("[v0] Database connection error:", dbError)
      return NextResponse.json(
        { error: "Database connection failed. Please ensure Prisma is properly configured." },
        { status: 500 },
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (!user) {
      console.log("[v0] User not found")
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    console.log("[v0] User found:", { id: user.id, email: user.email, role: user.role })

    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.passwordHash)

    if (!isValidPassword) {
      console.log("[v0] Invalid password")
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    console.log("[v0] Password verified, creating session")

    // Create session
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    })

    console.log("[v0] Session created successfully")

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    })
  } catch (error) {
    console.error("[v0] Signin error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
