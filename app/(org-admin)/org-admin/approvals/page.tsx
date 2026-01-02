import { ApprovalsManagement } from "@/components/org-admin/approvals-management";

export default function OrgAdminApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approvals</h1>
        <p className="text-muted-foreground mt-1">
          Review and approve expense requests from your team.
        </p>
      </div>

      <ApprovalsManagement />
    </div>
  );
}
