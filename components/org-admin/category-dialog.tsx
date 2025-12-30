"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  type: z.enum(["operational", "administrative"], {
    required_error: "Category type is required",
  }),
  description: z.string().optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export type CategoryDialogMode = "create" | "edit";

type CategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CategoryDialogMode;
  defaultValues?: Partial<CategoryFormValues>;
  isSubmitting?: boolean;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
};

export function CategoryDialog({
  open,
  onOpenChange,
  mode,
  defaultValues,
  isSubmitting,
  onSubmit,
}: CategoryDialogProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      type: defaultValues?.type,
      description: defaultValues?.description ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        name: defaultValues?.name ?? "",
        type: defaultValues?.type,
        description: defaultValues?.description ?? "",
      });
    }
  }, [
    open,
    form,
    defaultValues?.name,
    defaultValues?.type,
    defaultValues?.description,
  ]);

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  const title = mode === "create" ? "Create Category" : "Edit Category";
  const description =
    mode === "create"
      ? "Add a new category and assign its type."
      : "Update the category details.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>Category Type</Label>
            <Select
              value={form.watch("type") ?? ""}
              onValueChange={(v) =>
                form.setValue("type", v as CategoryFormValues["type"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="administrative">Administrative</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.type ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.type.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              placeholder="e.g., Travel, Meals, Equipment"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what expenses belong in this category"
              rows={3}
              {...form.register("description")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
