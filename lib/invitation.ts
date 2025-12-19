import { prisma } from "./prisma"
import crypto from "crypto"

export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export async function createInvitation(
  email: string,
  organizationId: string,
  invitedById: string,
  role: "ORG_ADMIN" | "STAFF" = "STAFF",
) {
  const token = generateInvitationToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      email,
      role,
      token,
      expiresAt,
      organizationId,
      invitedById,
      status: "PENDING",
    },
  })

  return invitation
}

export async function verifyInvitationToken(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: true,
      invitedBy: true,
    },
  })

  if (!invitation) {
    return { valid: false, message: "Invalid invitation token" }
  }

  if (invitation.status === "ACCEPTED") {
    return { valid: false, message: "Invitation already accepted" }
  }

  if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
    return { valid: false, message: "Invitation expired" }
  }

  return { valid: true, invitation }
}
