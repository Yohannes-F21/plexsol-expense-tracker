import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import prisma from "@/lib/prisma";

const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "STAFF";
  organizationId: string | null;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function getIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim() || undefined;

  return undefined;
}

export async function createSession(
  user: SessionUser,
  request: Request,
): Promise<string> {
  const rawToken = generateSessionToken();
  const tokenHash = sha256Hex(rawToken);

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const userAgent = request.headers.get("user-agent") || undefined;
  const ipAddress = getIpAddress(request);

  await prisma.session.create({
    data: {
      userId: user.id,
      sessionTokenHash: tokenHash,
      expiresAt,
      userAgent,
      ipAddress,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return rawToken;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) return null;

  try {
    const headersList = await headers();
    const currentUserAgent = headersList.get("user-agent") || "";

    const tokenHash = sha256Hex(rawToken);

    const session = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
      select: {
        id: true,
        userAgent: true,
        expiresAt: true,
        isRevoked: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            organizationId: true,
            isActive: true,
            organization: {
              select: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    console.log("Session:", session);

    if (!session) {
      return null;
    }

    if (session.isRevoked) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      console.log("Session expired. Revoking session.");
      try {
        await prisma.session.updateMany({
          where: { id: session.id, isRevoked: false },
          data: { isRevoked: true },
        });
      } catch {
        // best effort
      }
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    if (session.userAgent && session.userAgent !== currentUserAgent) {
      console.log(
        "User agent mismatch. Possible session hijacking attempt. Revoking session.",
      );

      try {
        await prisma.session.updateMany({
          where: { id: session.id, isRevoked: false },
          data: { isRevoked: true },
        });
      } catch {
        // best effort
      }
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    if (!session.user.isActive) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    if (
      session.user.organizationId &&
      session.user.organization &&
      !session.user.organization.isActive
    ) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      organizationId: session.user.organizationId,
    };
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = sha256Hex(rawToken);
    await prisma.session.updateMany({
      where: { sessionTokenHash: tokenHash, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });
}

export async function rotateSession(
  user: SessionUser,
  request: Request,
): Promise<string> {
  await revokeAllSessionsForUser(user.id);
  return createSession(user, request);
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(
  allowedRoles: ("SUPER_ADMIN" | "ORG_ADMIN" | "STAFF")[],
): Promise<SessionUser> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.role)) {
    throw new Error("Forbidden");
  }
  return session;
}
