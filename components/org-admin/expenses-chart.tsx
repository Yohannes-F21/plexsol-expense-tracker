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

interface ChartData {
  month: string;
  amount: number;
}

function formatTooltipNumber(value: unknown) {
  if (typeof value === "number") return value.toLocaleString();
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value ?? "");
}

export function ExpensesChart() {
  const { data, isLoading } = useQuery<ChartData[]>({
    queryKey: ["org-admin-expenses-chart"],
    queryFn: () =>
      apiClient<ChartData[]>("/api/org-admin/charts/expenses-over-time"),
  });

  if (isLoading) {
    return <Skeleton className="h-75 w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-75 items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip formatter={(value) => formatTooltipNumber(value)} />
        <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
