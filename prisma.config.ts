// prisma/prisma.config.ts
// Provide datasource connection URLs for Prisma CLI (migrate/get-config).
// Prisma expects the config to include the `datasources` mapping for any
// datasources defined in `prisma/schema.prisma` (for example `db`).
// Keep secrets in environment variables and do not commit them.

import "dotenv/config";
import { defineConfig } from "@prisma/config";

const databaseUrl =
  process.env.PRISMA_MIGRATE_URL ??
  process.env.DATABASE_URL ??
  process.env.DIRECT_URL;

const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Set DATABASE_URL or DIRECT_URL (or PRISMA_MIGRATE_URL) for Prisma migrations."
  );
}

export default defineConfig({
  // Prisma 7 requires a top-level `datasource` entry; include both forms.
  datasource: {
    url: databaseUrl,
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});

// Example usage in PowerShell:
// $Env:PRISMA_MIGRATE_URL='postgresql://user:pass@host:5432/db'
// pnpm prisma migrate dev
