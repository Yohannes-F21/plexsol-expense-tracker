import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

function shouldUseNeonAdapter(url: string) {
  if (process.env.PRISMA_ADAPTER === "neon") return true;
  if (process.env.PRISMA_ADAPTER === "none") return false;

  // Heuristic: PrismaNeon uses WebSockets and is intended for Neon-hosted Postgres.
  // Local Postgres / many hosted Postgres URLs will fail the WS upgrade (non-101).
  try {
    const host = new URL(url).host.toLowerCase();
    return (
      host.includes("neon.tech") ||
      host.includes("neon") ||
      host.includes("pooler")
    );
  } catch {
    return false;
  }
}

const useNeonAdapter = shouldUseNeonAdapter(connectionString);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(useNeonAdapter
      ? { adapter: new PrismaNeon({ connectionString }) }
      : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
