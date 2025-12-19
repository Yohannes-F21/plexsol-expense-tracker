"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Receipt, Clock, CheckCircle, XCircle, DollarSign, Plus } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { CreateExpenseDialog } from "@/components/create-expense-dialog"
import { EditExpenseDialog } from "@/components/edit-expense-dialog"
import { format } from "date-fns"

type Stats = {
  totalExpenses: number
  pendingExpenses: number
  approvedExpenses: number
  rejectedExpenses: number
  totalExpenseAmount: number
}

type Expense = {
  id: string
  title: string
  description: string | null
  amount: number
  date: string
  status: "PENDING" | "APPROVED" | "REJECTED"
}

export function StaffDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, expensesRes] = await Promise.all([fetch("/api/expenses/stats"), fetch("/api/expenses")])

      if (!statsRes.ok || !expensesRes.ok) {
        toast.error("Failed to load dashboard data")
        return
      }

      const statsData = await statsRes.json()
      const expensesData = await expensesRes.json()

      setStats(statsData)
      setExpenses(expensesData.expenses)
    } catch (error) {
      console.error("[v0] Fetch data error:", error)
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return

    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || "Failed to delete expense")
        return
      }

      toast.success("Expense deleted")
      fetchData()
    } catch (error) {
      console.error("[v0] Delete expense error:", error)
      toast.error("An error occurred")
    }
  }

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    router.push("/signin")
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Expenses</h1>
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalExpenses || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingExpenses || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.approvedExpenses || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.rejectedExpenses || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats?.totalExpenseAmount.toFixed(2) || "0.00"}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Expense Requests</CardTitle>
              <CardDescription>Track and manage your expense submissions</CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Expense
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses yet. Create your first expense request!</p>
              ) : (
                expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{expense.title}</h3>
                        <Badge
                          variant={
                            expense.status === "APPROVED"
                              ? "default"
                              : expense.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {expense.status}
                        </Badge>
                      </div>
                      {expense.description && (
                        <p className="text-sm text-muted-foreground mt-1">{expense.description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>${expense.amount.toFixed(2)}</span>
                        <span>{format(new Date(expense.date), "MMM dd, yyyy")}</span>
                      </div>
                    </div>
                    {expense.status === "PENDING" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingExpense(expense)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(expense.id)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <CreateExpenseDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={fetchData} />
      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          open={!!editingExpense}
          onOpenChange={(open) => !open && setEditingExpense(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
