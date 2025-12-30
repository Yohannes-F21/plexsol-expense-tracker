"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface ExpenseData {
  month: string;
  total: number;
  count: number;
}

export function ExpensesChart() {
  const { data, isLoading } = useQuery<ExpenseData[]>({
    queryKey: ["expenses-chart"],
    queryFn: () =>
      apiClient<ExpenseData[]>("/api/super-admin/charts/expenses-over-time"),
  });

  if (isLoading) {
    return <Skeleton className="h-75 w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-75 items-center justify-center text-muted-foreground">
        No expense data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
