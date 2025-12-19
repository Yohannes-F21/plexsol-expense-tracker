import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { OrganizationsTable } from "@/components/super-admin/organizations-table";

export default async function OrganizationsPage() {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/signin");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organizations</h1>
        <p className="text-muted-foreground mt-1">
          Manage all organizations in the system
        </p>
      </div>

      <OrganizationsTable />
    </div>
  );
}
