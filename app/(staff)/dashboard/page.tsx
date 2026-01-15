import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Receipt, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function") {
    return x.toNumber();
  }
  return Number(x);
}

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

  let grouped: any[] | null = null;

  try {
    grouped = await (prisma.expense.groupBy as any)({
      by: ["status"],
      where: {
        organizationId: session.organizationId,
        createdByUserId: session.id,
        isActive: true,
      },
      _count: { _all: true },
      _sum: { total: true },
    });
  } catch (e) {
    console.warn("[staff-dashboard] Failed to load dashboard stats", e);
    grouped = null;
  }

  if (!grouped) {
    return (
      <div className="text-sm text-destructive">
        Failed to load dashboard data. Please check your database connection.
      </div>
    );
  }

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

  const kpis = [
    {
      title: "Total Expenses",
      value: total,
      icon: Receipt,
      titleColor: "text-blue-600",
      iconBg: "bg-blue-500",
      iconColor: "text-white",
      helperText: "All submissions",
      helperTextColor: "text-muted-foreground",
    },
    {
      title: "Pending / Warning",
      value: pending,
      icon: AlertTriangle,
      titleColor: "text-yellow-600",
      iconBg: "bg-yellow-500",
      iconColor: "text-white",
      helperText: "Needs review",
      helperTextColor: "text-yellow-600",
    },
    {
      title: "Approved",
      value: approved,
      icon: CheckCircle,
      titleColor: "text-green-700",
      iconBg: "bg-green-500",
      iconColor: "text-white",
      helperText: formatCurrency(approvedTotal),
      helperTextColor: "text-green-600",
    },
    {
      title: "Rejected",
      value: rejected,
      icon: XCircle,
      titleColor: "text-red-600",
      iconBg: "bg-red-500",
      iconColor: "text-white",
      helperText: "Not approved",
      helperTextColor: "text-red-600",
    },
  ];

  const recent = await prisma.expense.findMany({
    where: {
      organizationId: session.organizationId,
      createdByUserId: session.id,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      companyName: true,
      total: true,
      status: true,
      createdAt: true,
      items: {
        take: 1,
        orderBy: { id: "asc" },
        select: { subcategory: { select: { name: true } } },
      },
    },
  });

  const statusColors: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    PENDING: "outline",
    WARNING: "secondary",
    APPROVED: "default",
    REJECTED: "destructive",
  };

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

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.title}
            className="shadow-sm transition-transform duration-200 hover:scale-[1.03]"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${kpi.titleColor}`}>
                {kpi.title}
              </CardTitle>
              <div
                className={
                  "h-11 w-11 rounded-full shadow-md flex items-center justify-center " +
                  kpi.iconBg
                }
              >
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold text-foreground">
                {kpi.value}
              </div>
              <div className={`text-sm ${kpi.helperTextColor}`}>
                {kpi.helperText}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">
            Recent Transactions
          </CardTitle>
          <CardDescription className="text-sm">
            Your last 10 expense submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No recent transactions
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Description
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Category
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Amount</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((expense) => {
                    const categoryName =
                      expense.items[0]?.subcategory?.name ?? "N/A";
                    return (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(expense.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {expense.companyName || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {categoryName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono font-semibold">
                          {asNumber(expense.total).toFixed(2)}
                          <span className="ml-1">ETB</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={statusColors[expense.status] ?? "outline"}
                          >
                            {expense.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
