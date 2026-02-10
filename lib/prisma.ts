import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPgPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

type PrismaAdapterMode = "auto" | "pg" | "neon";

function getAdapterMode(): PrismaAdapterMode {
  const raw = (process.env.PRISMA_ADAPTER ?? "auto").toLowerCase();
  if (raw === "pg" || raw === "neon" || raw === "auto") return raw;
  return "auto";
}

function isNeonUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("neon.tech");
  } catch {
    return false;
  }
}

function configureNeonForNode() {
  // Neon serverless driver uses WebSockets. In Node.js, ensure a WebSocket
  // implementation is available.
  // (Node 22+ provides a global WebSocket, but older Node versions don't.)
  if (typeof (globalThis as any).WebSocket === "undefined") {
    neonConfig.webSocketConstructor = WebSocket as any;
  }
}

function shouldUseNeonAdapter(url: string) {
  const mode = getAdapterMode();
  if (mode === "neon") return true;
  if (mode === "pg") return false;

  // AUTO mode: prefer TCP (pg) unless explicitly opted into Neon.
  // Some networks/proxies block WebSocket upgrades, which causes
  // "Received network error or non-101 status code".
  void url;
  return false;
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
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

    try {
      const adapter = (() => {
        if (useNeonAdapter) {
          configureNeonForNode();
          return new PrismaNeon({ connectionString });
        }
        const pool = getPgPool(connectionString);
        return new PrismaPg(pool);
      })() as any;

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
          error,
        );
      }
      return new PrismaClient({ log });
    }
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
