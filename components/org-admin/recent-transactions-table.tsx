"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Expense {
  id: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  user: {
    name: string;
  };
  category?: {
    name: string;
  };
}

export function RecentTransactionsTable() {
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["org-admin-recent-transactions"],
    queryFn: () => apiClient<Expense[]>("/api/org-admin/recent-transactions"),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (expenses.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        No recent transactions
      </div>
    );
  }

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
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Date</TableHead>
            <TableHead className="whitespace-nowrap">Staff</TableHead>
            <TableHead className="whitespace-nowrap">Category</TableHead>
            <TableHead className="whitespace-nowrap">Amount</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(expense.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {expense.user.name}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {expense.category?.name || "N/A"}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono font-semibold">
                {expense.amount.toFixed(2)}
                <span className="ml-1 ">ETB</span>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={statusColors[expense.status]}>
                  {expense.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
