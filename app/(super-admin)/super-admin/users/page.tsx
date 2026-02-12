import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UsersTable } from "@/components/super-admin/users-table";

export default async function UsersPage() {
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
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage all users across organizations
        </p>
      </div>

      <UsersTable />
    </div>
  );
}
