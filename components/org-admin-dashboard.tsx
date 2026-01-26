"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Receipt,
  Clock,
  CheckCircle,
  DollarSign,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Loader } from "@/components/loader";
import { useRouter } from "next/navigation";
import { InviteUserDialog } from "@/components/invite-user-dialog";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

type Stats = {
  totalUsers: number;
  totalExpenses: number;
  pendingExpenses: number;
  approvedExpenses: number;
  totalExpenseAmount: number;
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  createdAt: string;
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  priority: "HIGH" | "NORMAL";
  category: { id: string; name: string } | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  _count: {
    expenses: number;
  };
};

export function OrgAdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, expensesRes, usersRes] = await Promise.all([
        fetch("/api/org-admin/stats"),
        fetch("/api/org-admin/expenses"),
        fetch("/api/org-admin/users"),
      ]);

      if (!statsRes.ok || !expensesRes.ok || !usersRes.ok) {
        toast.error("Failed to load dashboard data");
        return;
      }

      const statsData = await statsRes.json();
      const expensesData = await expensesRes.json();
      const usersData = await usersRes.json();

      setStats(statsData);
      setExpenses(expensesData.expenses);
      setUsers(usersData.users);
    } catch (error) {
      console.error("[v0] Fetch data error:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (expenseId: string) => {
    try {
      const response = await fetch(
        `/api/org-admin/expenses/${expenseId}/approve`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        toast.error("Failed to approve expense");
        return;
      }

      toast.success("Expense approved");
      fetchData();
    } catch (error) {
      console.error("[v0] Approve expense error:", error);
      toast.error("An error occurred");
    }
  };

  const handleReject = async (expenseId: string) => {
    try {
      const response = await fetch(
        `/api/org-admin/expenses/${expenseId}/reject`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        toast.error("Failed to reject expense");
        return;
      }

      toast.success("Expense rejected");
      fetchData();
    } catch (error) {
      console.error("[v0] Reject expense error:", error);
      toast.error("An error occurred");
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader size="md" ariaLabel="Loading Dashboard" showLabel />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Organization Admin</h1>
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Team Members
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Expenses
              </CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalExpenses || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.pendingExpenses || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.approvedExpenses || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Amount
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalExpenseAmount || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="users">Team</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Expense Requests</CardTitle>
                <CardDescription>
                  Review and manage expense submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expenses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No expenses yet
                    </p>
                  ) : (
                    expenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {expense.description}
                            </h3>
                            <Badge
                              variant={
                                expense.status === "APPROVED"
                                  ? "default"
                                  : expense.status === "REJECTED"
                                  ? "destructive"
                                  : expense.status === "WARNING"
                                  ? "outline"
                                  : "secondary"
                              }
                            >
                              {expense.status}
                            </Badge>
                            <Badge
                              variant={
                                expense.priority === "HIGH"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {expense.priority === "HIGH" ? "High" : "Normal"}
                            </Badge>
                            {expense.category?.name ? (
                              <Badge variant="secondary">
                                {expense.category.name}
                              </Badge>
                            ) : null}
                          </div>
                          {expense.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {expense.description}
                            </p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                            <span>
                              By: {expense.user.name || expense.user.email}
                            </span>
                            <span>{formatCurrency(expense.amount)}</span>
                            <span>
                              {format(
                                new Date(expense.createdAt),
                                "MMM dd, yyyy"
                              )}
                            </span>
                          </div>
                        </div>
                        {(expense.status === "PENDING" ||
                          expense.status === "WARNING") && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(expense.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(expense.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage your organization's users
                  </CardDescription>
                </div>
                <Button onClick={() => setShowInviteDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No users yet
                    </p>
                  ) : (
                    users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <h3 className="font-semibold">
                            {user.name || user.email}
                          </h3>
                          <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                            <span>{user.email}</span>
                            <Badge variant="outline">{user.role}</Badge>
                            <span>{user._count.expenses} expenses</span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Joined{" "}
                          {format(new Date(user.createdAt), "MMM dd, yyyy")}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={fetchData}
      />
    </div>
  );
}
