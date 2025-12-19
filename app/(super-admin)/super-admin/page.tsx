import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { SuperAdminDashboard } from "@/components/super-admin/dashboard"

export default async function SuperAdminPage() {
  const session = await getSession()

  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/signin")
  }

  return <SuperAdminDashboard />
}
