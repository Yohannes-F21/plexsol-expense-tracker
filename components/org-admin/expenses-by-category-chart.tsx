"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartData {
  category: string;
  amount: number;
}

function formatTooltipNumber(value: unknown) {
  if (typeof value === "number") return value.toLocaleString();
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value ?? "");
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ExpensesByCategoryChart() {
  const { data, isLoading } = useQuery<ChartData[]>({
    queryKey: ["org-admin-expenses-by-category"],
    queryFn: () =>
      apiClient<ChartData[]>("/api/org-admin/charts/expenses-by-category"),
  });

  const total = (data ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0);

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
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            stroke="var(--background)"
            strokeWidth={6}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatTooltipNumber(value)} />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-6 w-full grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
        {data.map((item, index) => {
          const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
          return (
            <div key={item.category} className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-foreground">
                {item.category}: {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
