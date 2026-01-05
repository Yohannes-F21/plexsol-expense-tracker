import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrgAdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage organization master data used in expense items.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/org-admin/settings/units-of-measure" className="block">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Units of Measure</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Create and manage units (e.g., pcs, kg, L).
            </CardContent>
          </Card>
        </Link>

        <Link href="/org-admin/settings/purchase-types" className="block">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Purchase Types</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Create and manage purchase types (e.g., local, import).
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
