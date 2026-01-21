import { BackButton } from "@/components/back-button";
import { PurchaseTypesManagement } from "@/components/org-admin/purchase-types-management";

export default function OrgAdminPurchaseTypesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <BackButton href="/org-admin/settings" />
        <div className="pt-0.5">
          <h1 className="text-2xl font-semibold">Purchase Types</h1>
          <p className="text-sm text-muted-foreground">
            Manage purchase types used on expense line items.
          </p>
        </div>
      </div>

      <PurchaseTypesManagement />
    </div>
  );
}
