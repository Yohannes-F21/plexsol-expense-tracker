import type React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { QueryProvider } from "@/lib/query-provider";
import prisma from "@/lib/prisma";
import type { NavItem } from "@/components/app-sidebar";

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: "layout-dashboard",
  },
  {
    title: "Expenses",
    href: "/admin/expenses",
    icon: "receipt",
  },
  {
    title: "Approvals",
    href: "/admin/approvals",
    icon: "check-square",
  },
  {
    title: "Policies",
    href: "/admin/policies",
    icon: "shield",
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: "users",
  },
];

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || session.role !== "ORG_ADMIN") {
    redirect("/signin");
  }

  const organization = session.organizationId
    ? await prisma.organization.findUnique({
        where: { id: session.organizationId },
      })
    : null;

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar navItems={navItems} role="ORG_ADMIN" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader user={session} organizationName={organization?.name} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
