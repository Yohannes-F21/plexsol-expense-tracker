"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  Eye,
  Filter,
  Pencil,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";

interface Category {
  id: string;
  name: string;
  type: "operational" | "administrative";
}

interface ExpensePolicy {
  id: string;
  policyName: string;
  description: string | null;
  maxAmount: number | null;
  allowedCategories: string[] | null;
  requiresReceipt: boolean;
  autoApprove: boolean;
  isActive: boolean;
  createdAt: string;
}

interface PolicyFormState {
  policyName: string;
  description: string;
  ruleDescription: string;
  categoryType: "operational" | "administrative" | "";
  categoryId: string;
  maxAmount: string;
  isActive: boolean;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function PolicyFormDialog({
  mode,
  open,
  onOpenChange,
  categories,
  initial,
  onSubmit,
}: {
  mode: "create" | "edit" | "view";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  initial?: ExpensePolicy;
  onSubmit: (values: PolicyFormState) => Promise<void>;
}) {
  const deriveTypeFromCategoryId = (categoryId: string) => {
    if (!categoryId) return "" as const;
    return categories.find((c) => c.id === categoryId)?.type ?? ("" as const);
  };

  const [state, setState] = useState<PolicyFormState>(() => ({
    policyName: initial?.policyName ?? "",
    description: initial?.description ?? "",
    ruleDescription: initial?.description ? "" : "",
    categoryType: deriveTypeFromCategoryId(
      initial?.allowedCategories?.[0] ?? ""
    ),
    categoryId: initial?.allowedCategories?.[0] ?? "",
    maxAmount: initial?.maxAmount?.toString() ?? "",
    isActive: initial?.isActive ?? true,
  }));
  const [submitting, setSubmitting] = useState(false);
  const readOnly = mode === "view";

  useEffect(() => {
    if (open) {
      const initialCategoryId = initial?.allowedCategories?.[0] ?? "";
      setState({
        policyName: initial?.policyName ?? "",
        description: initial?.description ?? "",
        ruleDescription: "",
        categoryType: deriveTypeFromCategoryId(initialCategoryId),
        categoryId: initialCategoryId,
        maxAmount: initial?.maxAmount?.toString() ?? "",
        isActive: initial?.isActive ?? true,
      });
    }
  }, [open, initial, categories]);

  const filteredCategories = useMemo(() => {
    if (!state.categoryType) return [];
    return categories
      .filter((c) => c.type === state.categoryType)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, state.categoryType]);

  const handleSave = async () => {
    if (readOnly) return;
    if (!state.policyName.trim()) {
      toast.error("Policy name is required");
      return;
    }
    if (!state.categoryType) {
      toast.error("Category type is required");
      return;
    }
    if (!state.categoryId) {
      toast.error("Category is required");
      return;
    }
    const amountNumber = Number(state.maxAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Max amount must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ ...state, maxAmount: amountNumber.toString() });
      toast.success(mode === "edit" ? "Policy updated" : "Policy created");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" && "Create Policy"}
            {mode === "edit" && "Edit Policy"}
            {mode === "view" && "View Policy"}
          </DialogTitle>
          <DialogDescription>
            Define spending rules for your organization. Fields marked with *
            are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="policyName">Policy Name *</Label>
            <Input
              id="policyName"
              value={state.policyName}
              onChange={(e) =>
                setState((s) => ({ ...s, policyName: e.target.value }))
              }
              placeholder="e.g. Travel Expenses"
              disabled={readOnly}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="categoryType">Category Type *</Label>
              <Select
                disabled={readOnly}
                value={state.categoryType}
                onValueChange={(val) =>
                  setState((s) => ({
                    ...s,
                    categoryType: val as PolicyFormState["categoryType"],
                    categoryId: "",
                  }))
                }
              >
                <SelectTrigger id="categoryType">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                disabled={readOnly}
                value={state.categoryId}
                onValueChange={(val) =>
                  setState((s) => ({ ...s, categoryId: val }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue
                    placeholder={
                      state.categoryType
                        ? "Select a category"
                        : "Select a category type first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={state.description}
              onChange={(e) =>
                setState((s) => ({ ...s, description: e.target.value }))
              }
              placeholder="Briefly describe what this policy covers"
              disabled={readOnly}
            />
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Policy Rules</p>
                <p className="text-xs text-muted-foreground">
                  Start with a maximum amount rule; more rules can be added
                  later.
                </p>
              </div>
              <Badge variant="outline" className="text-[11px]">
                MAX_AMOUNT
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxAmount">Maximum Amount *</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={state.maxAmount}
                  onChange={(e) =>
                    setState((s) => ({ ...s, maxAmount: e.target.value }))
                  }
                  placeholder="Enter limit (e.g. 500)"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ruleDescription">Rule Description</Label>
                <Input
                  id="ruleDescription"
                  value={state.ruleDescription}
                  onChange={(e) =>
                    setState((s) => ({ ...s, ruleDescription: e.target.value }))
                  }
                  placeholder="e.g. Per trip cap"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Activate policy immediately</p>
              <p className="text-xs text-muted-foreground">
                Deactivating keeps it saved but not enforced.
              </p>
            </div>
            <Switch
              checked={state.isActive}
              onCheckedChange={(val) =>
                setState((s) => ({ ...s, isActive: val }))
              }
              disabled={readOnly}
            />
          </div>
        </div>

        {mode !== "view" && (
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting
                ? "Saving..."
                : mode === "edit"
                ? "Save changes"
                : "Create policy"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PolicyCard({
  policy,
  categoryLabel,
  onView,
  onEdit,
  onDelete,
}: {
  policy: ExpensePolicy;
  categoryLabel: string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rules = useMemo(() => {
    const lines: string[] = [];

    if (
      typeof policy.maxAmount === "number" &&
      Number.isFinite(policy.maxAmount)
    ) {
      lines.push(`Limit: Maximum amount $${policy.maxAmount}`);
    }

    if (policy.requiresReceipt) {
      lines.push("Requirement: Receipt required");
    }

    if (policy.autoApprove) {
      lines.push("Requirement: Auto-approve eligible expenses");
    }

    if (lines.length === 0) {
      lines.push("No rules configured");
    }

    return lines;
  }, [policy.autoApprove, policy.maxAmount, policy.requiresReceipt]);

  const visibleRules = rules.slice(0, 2);
  const moreCount = Math.max(0, rules.length - visibleRules.length);

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base md:text-lg">
                {policy.policyName}
              </CardTitle>
              <Badge variant={policy.isActive ? "default" : "secondary"}>
                {policy.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline">{categoryLabel}</Badge>
            </div>
            <CardDescription>
              {policy.description || "No description provided"}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={onView}
              aria-label="View"
              className="h-9 w-9"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              aria-label="Edit"
              className="h-9 w-9"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              aria-label="Delete"
              className="h-9 w-9"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:gap-8">
          <div className="flex items-center gap-2">
            <span>Updated: {formatDate(policy.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>— violations</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>— compliance</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground">
          POLICY RULES:
        </div>
        <div className="space-y-2">
          {visibleRules.map((line) => (
            <div
              key={line}
              className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground"
            >
              {line}
            </div>
          ))}

          {moreCount > 0 ? (
            <div className="text-sm text-muted-foreground">
              +{moreCount} more rules
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PoliciesPage() {
  const queryClient = useQueryClient();
  const [filterMode, setFilterMode] = useState<"all" | "active" | "inactive">(
    "all"
  );
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">(
    "create"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activePolicy, setActivePolicy] = useState<ExpensePolicy | undefined>(
    undefined
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpensePolicy | null>(null);

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{
    categories: Category[];
  }>({
    queryKey: ["org-admin-categories"],
    queryFn: () => apiClient("/api/org-admin/categories"),
  });

  const { data: policiesData, isLoading: policiesLoading } = useQuery<{
    policies: ExpensePolicy[];
  }>({
    queryKey: ["org-admin-policies"],
    queryFn: () => apiClient("/api/org-admin/policies"),
  });

  const categories = categoriesData?.categories ?? [];
  const policies = policiesData?.policies ?? [];

  const filteredPolicies = useMemo(() => {
    if (filterMode === "active") return policies.filter((p) => p.isActive);
    if (filterMode === "inactive") return policies.filter((p) => !p.isActive);
    return policies;
  }, [filterMode, policies]);

  const createMutation = useMutation({
    mutationFn: (payload: PolicyFormState) =>
      apiClient("/api/org-admin/policies", {
        method: "POST",
        body: JSON.stringify({
          policyName: payload.policyName,
          description: payload.description || payload.ruleDescription || "",
          categoryId: payload.categoryId,
          maxAmount: Number(payload.maxAmount),
          isActive: payload.isActive,
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["org-admin-policies"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PolicyFormState }) =>
      apiClient(`/api/org-admin/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          policyName: data.policyName,
          description: data.description || data.ruleDescription || "",
          categoryId: data.categoryId,
          maxAmount: Number(data.maxAmount),
          isActive: data.isActive,
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["org-admin-policies"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/org-admin/policies/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["org-admin-policies"] }),
  });

  const openCreate = () => {
    setActivePolicy(undefined);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openEdit = (policy: ExpensePolicy) => {
    setActivePolicy(policy);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const openView = (policy: ExpensePolicy) => {
    setActivePolicy(policy);
    setDialogMode("view");
    setDialogOpen(true);
  };

  const handleSubmit = async (values: PolicyFormState) => {
    if (dialogMode === "edit" && activePolicy) {
      await updateMutation.mutateAsync({ id: activePolicy.id, data: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const handleDeleteClick = (policy: ExpensePolicy) => {
    setDeleteTarget(policy);
    setDeleteOpen(true);
  };

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl">Expense Policies</CardTitle>
            <CardDescription>
              Manage and configure your organization's expense policies
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={filterMode}
              onValueChange={(val) => setFilterMode(val as typeof filterMode)}
            >
              <SelectTrigger className="w-40">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="All Policies" />
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Policies</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={openCreate}>Create Policy</Button>
          </div>
        </CardHeader>

        <CardContent>
          {policiesLoading || categoriesLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="rounded-lg border p-6 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10" />
                </div>
              ))}
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-lg font-semibold">No policies created yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first policy to start enforcing spend rules for your
                team.
              </p>
              <Button onClick={openCreate}>Create Policy</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPolicies.map((policy) => {
                const categoryId = policy.allowedCategories?.[0];
                const categoryLabel =
                  categories.find((c) => c.id === categoryId)?.name ||
                  "Uncategorized";
                return (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    categoryLabel={categoryLabel}
                    onView={() => openView(policy)}
                    onEdit={() => openEdit(policy)}
                    onDelete={() => handleDeleteClick(policy)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !isBusy) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
          if (open) setDeleteOpen(true);
        }}
        title="Delete policy?"
        description="This will deactivate the policy and remove it from active use."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMutation.mutateAsync(deleteTarget.id);
          toast.success("Policy deleted");
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
      />

      <PolicyFormDialog
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !isBusy) setDialogOpen(false);
        }}
        categories={categories}
        initial={activePolicy}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
