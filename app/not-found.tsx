import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";

function getDashboardHref(role: string | undefined): string {
  if (role === "SUPER_ADMIN") return "/super-admin/dashboard";
  if (role === "ORG_ADMIN") return "/org-admin/dashboard";
  if (role === "STAFF") return "/dashboard";
  return "/signin";
}

export default async function NotFound() {
  const session = await getSession();
  const dashboardHref = getDashboardHref(session?.role);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="w-full max-w-xl text-center">
        <div className="flex items-baseline justify-center gap-2 select-none">
          <span className="text-7xl font-extrabold tracking-tight text-muted-foreground sm:text-8xl md:text-9xl">
            4
          </span>
          <span className="text-7xl font-extrabold tracking-tight text-primary sm:text-8xl md:text-9xl">
            0
          </span>
          <span className="text-7xl font-extrabold tracking-tight text-muted-foreground sm:text-8xl md:text-9xl">
            4
          </span>
        </div>

        <div className="mt-6 text-xs font-semibold tracking-[0.3em] text-muted-foreground">
          OOPS! PAGE NOT FOUND
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
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
