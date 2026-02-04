"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, Clock, Receipt, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpensesChart } from "./expenses-chart";
import { ExpensesByCategoryChart } from "./expenses-by-category-chart";
import { RecentTransactionsTable } from "./recent-transactions-table";

interface Stats {
  totalExpenses: number;
  totalExpenseAmount: number;
  pendingApprovals: number;
  totalStaffs: number;
}

export function OrgAdminDashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["org-admin-stats"],
    queryFn: () => apiClient<Stats>("/api/org-admin/stats"),
  });

  const kpis = [
    {
      title: "Total Expense Amount",
      value: `${(stats?.totalExpenseAmount ?? 0).toLocaleString()} ETB`,
      icon: DollarSign,
      titleColor: "text-primary",
      cardBg: "bg-primary",
      iconBg: "bg-primary",
      iconColor: "text-white",
      helperText: "Approved expenses total",
      helperTextColor: "text-primary",
      interactive: true,
    },
    {
      title: "Total Expenses",
      value: stats?.totalExpenses ?? 0,
      icon: Receipt,
      titleColor: "text-blue-700",
      cardBg: "bg-blue-50",
      iconBg: "bg-blue-500",
      iconColor: "text-white",
      helperText: "All submissions",
      helperTextColor: "text-blue-600",
      interactive: true,
    },
    {
      title: "Pending Approvals",
      value: stats?.pendingApprovals ?? 0,
      icon: Clock,
      titleColor: "text-yellow-600",
      cardBg: "bg-yellow-50",
      iconBg: "bg-yellow-500",
      iconColor: "text-white",
      helperText: "Needs review",
      helperTextColor: "text-yellow-600",
      interactive: true,
    },
    {
      title: "Total Staffs",
      value: stats?.totalStaffs ?? 0,
      icon: Users,
      titleColor: "text-green-700",
      cardBg: "bg-green-50",
      iconBg: "bg-green-500",
      iconColor: "text-white",
      helperText: "Active staff members",
      helperTextColor: "text-green-600",
      interactive: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl  font-bold text-foreground">
          Organization Dashboard
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Monitor your organization's expense activities
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.title}
            className={
              `shadow-sm transition-transform duration-200  ` +
              (kpi.interactive ? "hover:scale-[1.03]" : "")
            }
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 ">
              <CardTitle className={` text-sm font-medium ${kpi.titleColor}`}>
                {kpi.title}
              </CardTitle>
              <div
                className={
                  "h-11 w-11 rounded-xl shadow-md flex items-center justify-center " +
                  kpi.iconBg
                }
              >
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-semibold text-foreground">
                  {kpi.value}
                </div>
              )}
              <div className={`text-xs ${kpi.helperTextColor}`}>
                {kpi.helperText}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              Monthly Expense Trend
            </CardTitle>
            <CardDescription className="text-sm">
              Expenses over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensesChart />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              Expenses by Category
            </CardTitle>
            <CardDescription className="text-sm">
              Breakdown of expenses by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensesByCategoryChart />
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">
            Recent Transactions
          </CardTitle>
          <CardDescription className="text-sm">
            Last 10 expense submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecentTransactionsTable />
        </CardContent>
      </Card>
    </div>
  );
}
