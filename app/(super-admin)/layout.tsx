import type React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { QueryProvider } from "@/lib/query-provider";
import type { NavItem } from "@/components/app-sidebar";

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/super-admin",
    icon: "layout-dashboard",
  },
  {
    title: "Organizations",
    href: "/super-admin/organizations",
    icon: "building-2",
  },
  {
    title: "Users",
    href: "/super-admin/users",
    icon: "users",
  },
  {
    title: "Expenses",
    href: "/super-admin/expenses",
    icon: "receipt",
  },
  {
    title: "Activity Logs",
    href: "/super-admin/activity-logs",
    icon: "activity",
  },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/signin");
  }

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar navItems={navItems} role="SUPER_ADMIN" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader user={session} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
