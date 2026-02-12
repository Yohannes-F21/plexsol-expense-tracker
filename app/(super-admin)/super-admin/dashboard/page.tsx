import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SuperAdminDashboard } from "@/components/super-admin/dashboard";

export default async function SuperAdminPage() {
  const session = await getSession();

  if (!session) {
    redirect(
      `/api/auth/signout?next=${encodeURIComponent("/unauthorized?code=401")}`,
    );
  }

  if (session.role !== "SUPER_ADMIN") {
    redirect("/unauthorized?code=403");
  }

  return <SuperAdminDashboard />;
}
