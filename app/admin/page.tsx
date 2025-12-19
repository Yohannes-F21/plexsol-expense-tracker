import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { OrgAdminDashboard } from "@/components/org-admin-dashboard"

export default async function AdminPage() {
  const session = await getSession()

  if (!session || session.role !== "ORG_ADMIN") {
    redirect("/signin")
  }

  return <OrgAdminDashboard />
}
