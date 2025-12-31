/* eslint-disable no-console */

// Repairs Prisma migrate checksum drift when migration.sql files were modified
// after being applied (e.g., BOM/line-ending fixes).
//
// This updates the _prisma_migrations.checksum values to match the current
// migration.sql file bytes, allowing prisma migrate commands to proceed
// without requiring a destructive reset.

require("dotenv/config");

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { neon } = require("@neondatabase/serverless");

const url =
  process.env.PRISMA_MIGRATE_URL ||
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL;

if (!url) {
  throw new Error("Missing PRISMA_MIGRATE_URL / DATABASE_URL / DIRECT_URL");
}

const sql = neon(url);

const migrations = [
  {
    name: "20251230120000_baseline",
    file: path.join(
      __dirname,
      "..",
      "prisma",
      "migrations",
      "20251230120000_baseline",
      "migration.sql"
    ),
  },
  {
    name: "20251230121500_add_category_type",
    file: path.join(
      __dirname,
      "..",
      "prisma",
      "migrations",
      "20251230121500_add_category_type",
      "migration.sql"
    ),
  },
];

(async () => {
  for (const m of migrations) {
    const buf = fs.readFileSync(m.file);
    const checksum = crypto.createHash("sha256").update(buf).digest("hex");

    console.log(`${m.name}: ${checksum}`);

    await sql(
      'UPDATE "_prisma_migrations" SET checksum = $1 WHERE migration_name = $2',
      [checksum, m.name]
    );
  }

  console.log("Done. Checksums updated.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
