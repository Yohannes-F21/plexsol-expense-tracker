import { ApprovalsView } from "@/components/org-admin/approvals-view";

export default function OrgAdminApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-muted-foreground mt-1">
          Review and approve expense requests from your team.
        </p>
      </div>

      <ApprovalsView />
    </div>
  );
}
