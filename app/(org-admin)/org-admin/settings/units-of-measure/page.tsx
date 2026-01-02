import Link from "next/link";

import { Button } from "@/components/ui/button";
import { UnitsOfMeasureManagement } from "@/components/org-admin/units-of-measure-management";

export default function OrgAdminUnitsOfMeasurePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Units of Measure</h1>
          <p className="text-sm text-muted-foreground">
            Manage units used on expense line items.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/org-admin/settings">Back</Link>
        </Button>
      </div>

      <UnitsOfMeasureManagement />
    </div>
  );
}
