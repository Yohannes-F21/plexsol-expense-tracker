import { NextResponse } from "next/server"
import { verifyInvitationToken } from "@/lib/invitation"
import { hashPassword, createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const acceptSchema = z.object({
  token: z.string(),
  name: z.string().min(1),
  password: z.string().min(8),
  phoneNumber: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = acceptSchema.parse(body)

    // Verify token
    const verification = await verifyInvitationToken(validatedData.token)

    if (!verification.valid) {
      return NextResponse.json({ error: verification.message }, { status: 400 })
    }

    const { invitation } = verification

    // Hash password
    const passwordHash = await hashPassword(validatedData.password)

    const user = await prisma.user.create({
      data: {
        email: invitation!.email,
        name: validatedData.name,
        phoneNumber: validatedData.phoneNumber,
        passwordHash,
        role: invitation!.role,
        organizationId: invitation!.organizationId,
      },
    })

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation!.id },
      data: {
        status: "ACCEPTED",
      },
    })

    // Create session
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("[v0] Accept invitation error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
