import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { StaffDashboard } from "@/components/staff-dashboard"

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/signin")
  }

  if (session.role === "SUPER_ADMIN") {
    redirect("/super-admin")
  }

  if (session.role === "ORG_ADMIN") {
    redirect("/admin")
  }

  return <StaffDashboard />
}
