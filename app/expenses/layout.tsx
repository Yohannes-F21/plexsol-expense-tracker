import type React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { QueryProvider } from "@/lib/query-provider";
import type { NavItem } from "@/components/app-sidebar";

const staffNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "layout-dashboard",
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: "receipt",
  },
  {
    title: "Policies",
    href: "/dashboard/policies",
    icon: "shield",
  },
];

const orgAdminNavItems: NavItem[] = [
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
    title: "Settings",
    href: "/org-admin/settings",
    icon: "settings",
  },
];

export default async function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || (session.role !== "STAFF" && session.role !== "ORG_ADMIN")) {
    redirect("/signin");
  }

  const role = session.role;

  let organization: { name: string } | null = null;
  if (session.organizationId) {
    try {
      organization = await prisma.organization.findUnique({
        where: { id: session.organizationId },
        select: { name: true },
      });
    } catch (e) {
      console.warn("[expenses-layout] Failed to load organization", e);
      organization = null;
    }
  }

  const navItems = role === "ORG_ADMIN" ? orgAdminNavItems : staffNavItems;

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar navItems={navItems} role={role} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader user={session} organizationName={organization?.name} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
