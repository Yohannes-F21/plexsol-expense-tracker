import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UsersTable } from "@/components/super-admin/users-table";

export default async function UsersPage() {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/signin");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage all users across organizations
        </p>
      </div>

      <UsersTable />
    </div>
  );
}
