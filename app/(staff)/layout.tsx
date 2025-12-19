import type React from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { QueryProvider } from "@/lib/query-provider"
import prisma from "@/lib/prisma"

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "layout-dashboard",
  } as const,
  {
    title: "Expenses",
    href: "/dashboard/expenses",
    icon: "receipt",
  } as const,
  {
    title: "Policies",
    href: "/dashboard/policies",
    icon: "shield",
  } as const,
]

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session || session.role !== "STAFF") {
    redirect("/signin")
  }

  const organization = session.organizationId
    ? await prisma.organization.findUnique({
        where: { id: session.organizationId },
      })
    : null

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar navItems={navItems} role="STAFF" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader user={session} organizationName={organization?.name} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </QueryProvider>
  )
}
