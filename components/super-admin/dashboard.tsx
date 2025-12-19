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
import { Building2, Users, Receipt, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpensesChart } from "./expenses-chart";
import { ExpensesByOrgChart } from "./expenses-by-org-chart";

interface Stats {
  totalOrganizations: number;
  totalUsers: number;
  totalExpenses: number;
  pendingApprovals: number;
}

export function SuperAdminDashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["super-admin-stats"],
    queryFn: () => apiClient<Stats>("/api/super-admin/stats"),
  });

  const kpis = [
    {
      title: "Total Organizations",
      value: stats?.totalOrganizations ?? 0,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Users",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Expenses",
      value: stats?.totalExpenses ?? 0,
      icon: Receipt,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Pending Approvals",
      value: stats?.pendingApprovals ?? 0,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Super Admin Dashboard
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Monitor system-wide activities and performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-foreground">
                  {kpi.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              Expenses Over Time
            </CardTitle>
            <CardDescription className="text-sm">
              Monthly expense trends across all organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensesChart />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              Expenses by Organization
            </CardTitle>
            <CardDescription className="text-sm">
              Total expenses grouped by organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensesByOrgChart />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
