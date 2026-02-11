import type React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  LayoutDashboard,
  Receipt,
  CheckSquare,
  Users,
  Tag,
  Shield,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { QueryProvider } from "@/lib/query-provider";
import prisma from "@/lib/prisma";
import type { NavItem } from "@/components/app-sidebar";
import { formatError } from "@/lib/utils";

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/org-admin/dashboard",
    icon: "layout-dashboard",
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: "receipt",
  },
  {
    title: "Approvals",
    href: "/org-admin/approvals",
    icon: "check-square",
  },
  {
    title: "Refund",
    href: "/org-admin/refunds",
    icon: "arrow-left-right",
  },
  {
    title: "Staff",
    href: "/org-admin/team",
    icon: "users",
  },
  {
    title: "Categories",
    href: "/org-admin/categories",
    icon: "tag",
  },
  {
    title: "Policies",
    href: "/org-admin/policies",
    icon: "shield",
  },
  {
    title: "Reports",
    href: "/org-admin/reports",
    icon: "activity",
  },
  {
    title: "Settings",
    href: "/org-admin/settings",
    icon: "settings",
  },
];

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || session.role !== "ORG_ADMIN") {
    redirect(`/unauthorized?code=${session ? 403 : 401}`);
  }

  let organization: { name: string } | null = null;
  if (session.organizationId) {
    try {
      organization = await prisma.organization.findUnique({
        where: { id: session.organizationId },
        select: { name: true },
      });
    } catch (e) {
      console.warn(
        "[org-admin-layout] Failed to load organization:",
        formatError(e),
      );
      organization = null;
    }
  }

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar navItems={navItems} role="ORG_ADMIN" />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AppHeader user={session} organizationName={organization?.name} />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
