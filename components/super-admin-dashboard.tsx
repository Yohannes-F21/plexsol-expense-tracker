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
import {
  Building2,
  Users,
  Receipt,
  Clock,
  DollarSign,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CreateOrganizationDialog } from "./create-organization-dialog";
import { InviteOrgAdminDialog } from "./invite-org-admin-dialog";

type Stats = {
  totalOrganizations: number;
  totalUsers: number;
  totalExpenses: number;
  pendingExpenses: number;
  totalExpenseAmount: number;
};

type Organization = {
  id: string;
  name: string;
  industry: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    users: number;
    expenses: number;
  };
  users: {
    id: string;
    name: string | null;
    email: string;
  }[];
};

export function SuperAdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, orgsRes] = await Promise.all([
        fetch("/api/super-admin/stats"),
        fetch("/api/super-admin/organizations"),
      ]);

      if (!statsRes.ok || !orgsRes.ok) {
        toast.error("Failed to load dashboard data");
        return;
      }

      const statsData = await statsRes.json();
      const orgsData = await orgsRes.json();

      setStats(statsData);
      setOrganizations(orgsData.organizations);
    } catch (error) {
      console.error("[v0] Fetch data error:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
  };

  const handleInviteAdmin = (orgId: string) => {
    setSelectedOrgId(orgId);
    setShowInviteDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
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
                Organizations
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalOrganizations || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
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
              <CardTitle className="text-sm font-medium">
                Total Amount
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats?.totalExpenseAmount.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Organizations</CardTitle>
                <CardDescription>
                  Manage all organizations in the system
                </CardDescription>
              </div>
              <Button onClick={() => setShowCreateOrgDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {organizations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No organizations yet
                </p>
              ) : (
                organizations.map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{org.name}</h3>
                      {org.industry && (
                        <p className="text-sm text-muted-foreground">
                          {org.industry}
                        </p>
                      )}
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{org._count.users} users</span>
                        <span>{org._count.expenses} expenses</span>
                      </div>
                      {org.users.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Admin: {org.users[0].name || org.users[0].email}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground text-right">
                        <div>
                          {new Date(org.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs">
                          Created by {org.createdBy.name}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInviteAdmin(org.id)}
                      >
                        Invite Admin
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <CreateOrganizationDialog
        open={showCreateOrgDialog}
        onOpenChange={setShowCreateOrgDialog}
        onSuccess={fetchData}
      />

      <InviteOrgAdminDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        organizationId={selectedOrgId ?? undefined}
        onSuccess={fetchData}
      />
    </div>
  );
}
