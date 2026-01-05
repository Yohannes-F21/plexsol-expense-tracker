import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/signin");
  }

  if (session.role === "SUPER_ADMIN") {
    redirect("/super-admin/dashboard");
  }

  if (session.role === "ORG_ADMIN") {
    redirect("/org-admin/dashboard");
  }

  if (session.role !== "STAFF") {
    redirect("/signin");
  }

  if (!session.organizationId) {
    return (
      <div className="text-sm text-destructive">
        Organization not found for this user.
      </div>
    );
  }

  const grouped = await prisma.expense.groupBy({
    by: ["status"],
    where: {
      organizationId: session.organizationId,
      createdByUserId: session.id,
      isActive: true,
    },
    _count: { _all: true },
    _sum: { total: true },
  });

  const countByStatus = new Map<string, number>();
  const sumTotalByStatus = new Map<string, number>();

  for (const row of grouped) {
    countByStatus.set(row.status, row._count._all);
    const sumValue = row._sum.total;
    sumTotalByStatus.set(
      row.status,
      typeof sumValue === "number" ? sumValue : sumValue ? Number(sumValue) : 0
    );
  }

  const pending =
    (countByStatus.get("PENDING") ?? 0) + (countByStatus.get("WARNING") ?? 0);
  const approved = countByStatus.get("APPROVED") ?? 0;
  const rejected = countByStatus.get("REJECTED") ?? 0;
  const total = pending + approved + rejected;
  const approvedTotal = sumTotalByStatus.get("APPROVED") ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your expense submissions.
          </p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">New Expense</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Pending / Warning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{approved}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(approvedTotal)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{rejected}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/expenses">View Expenses</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/policies">View Policies</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
