import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PurchaseTypesManagement } from "@/components/org-admin/purchase-types-management";

export default function OrgAdminPurchaseTypesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Types</h1>
          <p className="text-sm text-muted-foreground">
            Manage purchase types used on expense line items.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/org-admin/settings">Back</Link>
        </Button>
      </div>

      <PurchaseTypesManagement />
    </div>
  );
}
