"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, FileText, Search } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

type Expense = {
  id: string
  amount: number
  description: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  date: string
  user: {
    id: string
    name: string
    email: string
  }
  receiptUrl?: string | null
}

export function ExpensesManagement() {
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const { data, isLoading } = useQuery({
    queryKey: ["org-admin-expenses"],
    queryFn: async () => {
      const res = await fetch("/api/admin/expenses")
      if (!res.ok) throw new Error("Failed to fetch expenses")
      return res.json() as Promise<{ expenses: Expense[] }>
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const res = await fetch(`/api/admin/expenses/${expenseId}/approve`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to approve expense")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-admin-expenses"] })
      queryClient.invalidateQueries({ queryKey: ["org-admin-stats"] })
      toast.success("Expense approved successfully")
    },
    onError: () => {
      toast.error("Failed to approve expense")
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const res = await fetch(`/api/admin/expenses/${expenseId}/reject`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to reject expense")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-admin-expenses"] })
      queryClient.invalidateQueries({ queryKey: ["org-admin-stats"] })
      toast.success("Expense rejected")
    },
    onError: () => {
      toast.error("Failed to reject expense")
    },
  })

  const columns: ColumnDef<Expense>[] = [
    {
      accessorKey: "user.name",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.user.name}</div>
          <div className="text-sm text-muted-foreground">{row.original.user.email}</div>
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatCurrency(row.getValue("amount")),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => new Date(row.getValue("date")).toLocaleDateString(),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return (
          <Badge variant={status === "APPROVED" ? "default" : status === "REJECTED" ? "destructive" : "secondary"}>
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "receiptUrl",
      header: "Receipt",
      cell: ({ row }) =>
        row.original.receiptUrl ? (
          <a
            href={row.original.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            <FileText className="h-4 w-4" />
            View
          </a>
        ) : (
          <span className="text-muted-foreground">No receipt</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const expense = row.original
        if (expense.status !== "PENDING") return null

        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => approveMutation.mutate(expense.id)}
              disabled={approveMutation.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => rejectMutation.mutate(expense.id)}
              disabled={rejectMutation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  const filteredData =
    data?.expenses.filter((expense) => (statusFilter === "all" ? true : expense.status === statusFilter)) || []

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading expenses...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Expenses Management</h1>
        <p className="text-muted-foreground">Review and approve expense requests from your team</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Requests</CardTitle>
          <CardDescription>
            Total: {filteredData.length} expense{filteredData.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee or description..."
                value={(table.getColumn("description")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("description")?.setFilterValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="whitespace-nowrap">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No expenses found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
