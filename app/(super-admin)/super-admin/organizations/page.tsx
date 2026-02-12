import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { OrganizationsTable } from "@/components/super-admin/organizations-table";

export default async function OrganizationsPage() {
  const session = await getSession();

  if (!session) {
    redirect(
      `/api/auth/signout?next=${encodeURIComponent("/unauthorized?code=401")}`,
    );
  }

  if (session.role !== "SUPER_ADMIN") {
    redirect("/unauthorized?code=403");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
        <p className="text-muted-foreground mt-1">
          Manage all organizations in the system
        </p>
      </div>

      <OrganizationsTable />
    </div>
  );
}
