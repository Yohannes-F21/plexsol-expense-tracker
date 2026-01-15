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
    href: "/policies",
    icon: "shield",
  },
];

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || session.role !== "STAFF") {
    redirect("/signin");
  }

  let organization: { name: string } | null = null;
  if (session.organizationId) {
    try {
      organization = await prisma.organization.findUnique({
        where: { id: session.organizationId },
        select: { name: true },
      });
    } catch (e) {
      console.warn("[staff-layout] Failed to load organization", e);
      organization = null;
    }
  }

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar navItems={navItems} role="STAFF" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader user={session} organizationName={organization?.name} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  );
}
