import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPgPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

function shouldUseNeonAdapter(url: string) {
  // IMPORTANT: PrismaNeon uses WebSockets. In many Node.js environments (local dev,
  // corporate proxies, some hosting setups), the WS upgrade can fail with
  // "Received network error or non-101 status code".
  //
  // Only enable the Neon adapter explicitly.
  void url;
  return process.env.PRISMA_ADAPTER === "neon";
}

const useNeonAdapter = shouldUseNeonAdapter(connectionString);

function shouldUseSsl(url: string) {
  try {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get("sslmode");
    if (sslMode === "require" || sslMode === "verify-full") return true;
    if (parsed.hostname.endsWith("neon.tech")) return true;
    return false;
  } catch {
    // If parsing fails, don't force SSL.
    return false;
  }
}

function normalizeConnectionStringForPg(url: string) {
  // pg/pg-connection-string currently treats sslmode=require/prefer/verify-ca as verify-full
  // and warns about upcoming semantics changes. Normalizing to verify-full preserves current
  // behavior and removes the warning without requiring users to edit their env vars.
  try {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get("sslmode");
    if (
      sslMode === "require" ||
      sslMode === "prefer" ||
      sslMode === "verify-ca"
    ) {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }
  } catch {
    // ignore
  }
  return url;
}

function getPgPool(connectionString: string) {
  if (globalForPrisma.prismaPgPool) return globalForPrisma.prismaPgPool;

  const normalizedConnectionString =
    normalizeConnectionStringForPg(connectionString);

  const pool = new Pool({
    connectionString: normalizedConnectionString,
    ...(shouldUseSsl(normalizedConnectionString)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });

  globalForPrisma.prismaPgPool = pool;

  return pool;
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const log: Prisma.LogLevel[] =
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"];

    // If Prisma Client is running with engine type "client" (common with driver adapters
    // and some Next.js/Turbopack environments), it requires an adapter.
    // Prefer a TCP-based adapter (pg) to avoid Neon WebSocket upgrade issues.
    const pool = getPgPool(connectionString);

    try {
      const adapter = (
        useNeonAdapter
          ? new PrismaNeon({ connectionString })
          : new PrismaPg(pool)
      ) as any;

      return new PrismaClient({
        adapter,
        log,
      });
    } catch (error) {
      // Fallback for setups where Prisma is using the binary/library engine and does not
      // accept driver adapters.
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[prisma] Falling back to non-adapter PrismaClient",
          error
        );
      }
      return new PrismaClient({ log });
    }
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
