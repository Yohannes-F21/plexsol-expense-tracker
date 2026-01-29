"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import {
  CategoryDialog,
  type CategoryFormValues,
} from "@/components/org-admin/category-dialog";
import { Layers, PencilLine, Trash2 } from "lucide-react";

type CategoryType = "operational" | "administrative";

type Category = {
  id: string;
  name: string;
  description: string | null;
  type: CategoryType;
  isActive: boolean;
};

const CATEGORIES_QUERY_KEY = ["org-admin-categories"] as const;

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export function CategoriesManagement() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Category | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const categoriesQuery = useQuery<{ categories: Category[] }>({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/org-admin/categories", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json() as Promise<{ categories: Category[] }>;
    },
  });

  const categories = categoriesQuery.data?.categories ?? [];

  const { operationalCategories, administrativeCategories } = useMemo(() => {
    const active = categories.filter((c) => c.isActive !== false);
    const operational = active
      .filter((c) => c.type === "operational")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const administrative = active
      .filter((c) => c.type === "administrative")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      operationalCategories: operational,
      administrativeCategories: administrative,
    };
  }, [categories]);

  const createMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const response = await fetch("/api/org-admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          type: values.type,
          description: values.description || null,
        }),
      });

      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || "A category with that name already exists",
        );
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create category");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      toast.success("Category created");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; values: CategoryFormValues }) => {
      const response = await fetch(`/api/org-admin/categories/${args.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: args.values.name,
          type: args.values.type,
          description: args.values.description || null,
        }),
      });

      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || "A category with that name already exists",
        );
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update category");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      toast.success("Category updated");
      setDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/org-admin/categories/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete category");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      toast.success("Category deleted");
      setDeleteOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreateDialog() {
    setSelected(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function openEditDialog(category: Category) {
    setSelected(category);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  function openDeleteDialog(category: Category) {
    setDeleteTarget(category);
    setDeleteOpen(true);
  }

  async function handleSubmit(values: CategoryFormValues) {
    const existing = categories
      .filter((c) => c.isActive !== false)
      .some(
        (c) =>
          c.id !== selected?.id &&
          c.type === values.type &&
          normalizeName(c.name) === normalizeName(values.name),
      );
    if (existing) {
      throw new Error("A category with that name already exists");
    }

    if (dialogMode === "create") {
      await createMutation.mutateAsync(values);
      return;
    }

    if (!selected) throw new Error("No category selected");
    await updateMutation.mutateAsync({ id: selected.id, values });
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const dialogDefaults: Partial<CategoryFormValues> | undefined = selected
    ? {
        name: selected.name,
        description: selected.description ?? "",
        type: selected.type,
      }
    : { type: undefined };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage expense categories. Only organization admins can make
            changes.
          </p>
        </div>

        <Button onClick={openCreateDialog}>New Category</Button>
      </div>

      {categoriesQuery.isError ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Unable to load categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {(categoriesQuery.error as Error).message}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Operational Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoriesQuery.isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : operationalCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No operational categories yet
                </p>
              ) : (
                <div className="space-y-4">
                  {operationalCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{category.name}</p>
                        {category.description ? (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {category.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(category)}
                          aria-label="Edit"
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDeleteDialog(category)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Administrative Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoriesQuery.isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : administrativeCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No administrative categories yet
                </p>
              ) : (
                <div className="space-y-4">
                  {administrativeCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{category.name}</p>
                        {category.description ? (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {category.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(category)}
                          aria-label="Edit"
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDeleteDialog(category)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        defaultValues={dialogDefaults}
        isSubmitting={isSubmitting}
        onSubmit={async (values: CategoryFormValues) => {
          try {
            await handleSubmit(values);
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Something went wrong",
            );
          }
        }}
      />

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteTarget(null);
        }}
        title="Delete category?"
        description="This will remove the category from active use. Existing expenses will keep their history."
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMutation.mutateAsync(deleteTarget.id);
        }}
      />
    </div>
  );
}
