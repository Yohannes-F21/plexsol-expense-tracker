import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatError } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Policy = {
  id: string;
  policyName: string;
  description: string | null;
  maxAmount: number | null;
  allowedCategories: unknown;
  requiresReceipt: boolean;
  autoApprove: boolean;
  isActive: boolean;
  createdAt: Date;
};

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [];
}

export default async function StaffPoliciesPage() {
  const session = await getSession();

  if (!session) {
    redirect(
      `/api/auth/signout?next=${encodeURIComponent("/unauthorized?code=401")}`,
    );
  }

  if (session.role !== "STAFF") {
    redirect("/unauthorized?code=403");
  }

  if (!session.organizationId) {
    return (
      <div className="text-sm text-destructive">
        Organization not found for this user.
      </div>
    );
  }

  let policies: Policy[] = [];
  try {
    policies = (await prisma.expensePolicy.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        policyName: true,
        description: true,
        maxAmount: true,
        allowedCategories: true,
        requiresReceipt: true,
        autoApprove: true,
        isActive: true,
        createdAt: true,
      },
    })) as Policy[];
  } catch (e) {
    console.warn("[staff-policies] Failed to load policies:", formatError(e));
    return (
      <div className="text-sm text-destructive">
        Failed to load policies. Please check your database connection.
      </div>
    );
  }

  const categoryIds = Array.from(
    new Set(policies.flatMap((p) => asStringArray(p.allowedCategories))),
  );

  let categories: Array<{ id: string; name: string; type: string }> = [];
  if (categoryIds.length) {
    try {
      categories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds },
          organizationId: session.organizationId,
          isActive: true,
        },
        select: { id: true, name: true, type: true },
      });
    } catch (e) {
      console.warn(
        "[staff-policies] Failed to load categories:",
        formatError(e),
      );
      categories = [];
    }
  }

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Policies</h1>
        <p className="text-sm text-muted-foreground">
          Active spending rules for your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Policies</CardTitle>
          <CardDescription>
            These rules apply when you submit expenses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No active policies found.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {policies.map((p) => {
                const allowed = asStringArray(p.allowedCategories)
                  .map((id) => categoryNameById.get(id) ?? null)
                  .filter(Boolean) as string[];

                return (
                  <Card key={p.id}>
                    <CardHeader className="space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base">
                          {p.policyName}
                        </CardTitle>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                      {p.description ? (
                        <div className="text-sm text-muted-foreground">
                          {p.description}
                        </div>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {typeof p.maxAmount === "number" ? (
                          <Badge variant="outline">Max: {p.maxAmount}</Badge>
                        ) : null}
                        <Badge variant="outline">
                          Receipt:{" "}
                          {p.requiresReceipt ? "Required" : "Not required"}
                        </Badge>
                        <Badge variant="outline">
                          Auto-approve: {p.autoApprove ? "Yes" : "No"}
                        </Badge>
                      </div>

                      <div className="text-sm">
                        <div className="text-muted-foreground">Categories</div>
                        {allowed.length ? (
                          <div className="mt-1">{allowed.join(", ")}</div>
                        ) : (
                          <div className="mt-1 text-muted-foreground">All</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
