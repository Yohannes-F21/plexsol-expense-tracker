"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Clock, XCircle, AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { ExpensesChart } from "./expenses-chart"
import { ExpensesByCategoryChart } from "./expenses-by-category-chart"
import { RecentTransactionsTable } from "./recent-transactions-table"

interface Stats {
  totalExpenses: number
  totalExpenseAmount: number
  pendingApprovals: number
  rejectedExpenses: number
  warningExpenses: number
}

export function OrgAdminDashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["org-admin-stats"],
    queryFn: () => apiClient<Stats>("/api/org-admin/stats"),
  })

  const kpis = [
    {
      title: "Total Expenses",
      value: `$${(stats?.totalExpenseAmount ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Pending Approvals",
      value: stats?.pendingApprovals ?? 0,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Rejected Expenses",
      value: stats?.rejectedExpenses ?? 0,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Warning Expenses",
      value: stats?.warningExpenses ?? 0,
      icon: AlertTriangle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Organization Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Monitor your organization's expense activities
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`rounded-lg p-2 ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Monthly Expense Trend</CardTitle>
            <CardDescription className="text-sm">Expenses over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensesChart />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Expenses by Category</CardTitle>
            <CardDescription className="text-sm">Breakdown of expenses by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpensesByCategoryChart />
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Recent Transactions</CardTitle>
          <CardDescription className="text-sm">Last 10 expense submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentTransactionsTable />
        </CardContent>
      </Card>
    </div>
  )
}
