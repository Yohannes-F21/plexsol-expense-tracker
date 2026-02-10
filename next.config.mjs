/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // Prisma Client is generated code under node_modules and does not play well
  // with Turbopack bundling/caching. Keep it external to avoid stale schema.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
