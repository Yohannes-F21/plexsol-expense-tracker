/*
Ensures the `.prisma` generated client package is resolvable from the project root.

Why this exists:
- `@prisma/client` re-exports from the module specifier `.prisma/client/*`.
- Under pnpm (especially on Windows), Prisma may generate `.prisma` inside pnpm's
  virtual store (e.g. `node_modules/.pnpm/.../node_modules/.prisma`) and *not*
  materialize `node_modules/.prisma` at the project root.
- TypeScript often resolves modules using symlink paths, so the generated client
  types can appear stale/missing (e.g. `prisma.session` not found).

This script creates a root `node_modules/.prisma` link (junction on Windows)
pointing at the real generated `.prisma` directory used by `@prisma/client`.
*/

const fs = require("fs");
const path = require("path");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function safeLstat(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

function main() {
  const projectRoot = process.cwd();
  const rootNodeModules = path.join(projectRoot, "node_modules");
  const rootDotPrisma = path.join(rootNodeModules, ".prisma");

  if (!exists(rootNodeModules)) {
    // Nothing to do (install likely failed or node_modules not present).
    return;
  }

  // Resolve @prisma/client location and realpath (pnpm uses junctions/symlinks).
  let prismaClientPkgJson;
  try {
    prismaClientPkgJson = require.resolve("@prisma/client/package.json", {
      paths: [projectRoot],
    });
  } catch (e) {
    console.warn(
      "[ensure-prisma-dot-prisma] @prisma/client not resolvable; skipping",
    );
    return;
  }

  const prismaClientPkgJsonReal = fs.realpathSync(prismaClientPkgJson);
  const prismaClientDirReal = path.dirname(prismaClientPkgJsonReal);

  // .../node_modules/@prisma/client -> go up to .../node_modules
  const virtualStoreNodeModulesDir = path.resolve(
    prismaClientDirReal,
    "..",
    "..",
  );
  const targetDotPrisma = path.join(virtualStoreNodeModulesDir, ".prisma");

  if (!exists(targetDotPrisma)) {
    console.warn(
      `[ensure-prisma-dot-prisma] Target .prisma not found at ${targetDotPrisma}; skipping`,
    );
    return;
  }

  // If root .prisma exists already, leave it alone.
  const existing = safeLstat(rootDotPrisma);
  if (existing) {
    return;
  }

  try {
    // On Windows, use junctions for directory links.
    const type = process.platform === "win32" ? "junction" : "dir";
    fs.symlinkSync(targetDotPrisma, rootDotPrisma, type);
  } catch (e) {
    console.warn(
      `[ensure-prisma-dot-prisma] Failed to link ${rootDotPrisma} -> ${targetDotPrisma}: ${e.message}`,
    );
  }
}

main();
