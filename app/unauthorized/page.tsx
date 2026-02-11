import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";

function getDashboardHref(role: string | undefined): string {
  if (role === "SUPER_ADMIN") return "/super-admin/dashboard";
  if (role === "ORG_ADMIN") return "/org-admin/dashboard";
  if (role === "STAFF") return "/dashboard";
  return "/signin";
}

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams?: Promise<{ code?: string }>;
}) {
  const session = await getSession();
  const resolvedSearchParams = (await searchParams) ?? {};

  const codeFromQuery = Number(resolvedSearchParams.code);
  const code = Number.isFinite(codeFromQuery)
    ? codeFromQuery
    : session
      ? 403
      : 401;

  const dashboardHref = getDashboardHref(session?.role);
  const codeText = String(code);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="w-full max-w-xl text-center">
        <div className="flex items-baseline justify-center gap-2 select-none">
          {codeText.split("").map((ch, idx) => (
            <span
              key={`${ch}-${idx}`}
              className={
                idx === 1
                  ? "text-7xl font-extrabold tracking-tight text-primary sm:text-8xl md:text-9xl"
                  : "text-7xl font-extrabold tracking-tight text-muted-foreground sm:text-8xl md:text-9xl"
              }
            >
              {ch}
            </span>
          ))}
        </div>

        <div className="mt-6 text-xs font-semibold tracking-[0.3em] text-muted-foreground">
          UNAUTHORIZED
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          You don&apos;t have permission to access this page.
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild className="px-10">
            <Link href={dashboardHref}>Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
