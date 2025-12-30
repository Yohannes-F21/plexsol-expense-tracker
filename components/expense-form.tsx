"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z
    .number({ invalid_type_error: "Amount is required" })
    .positive("Amount must be greater than zero"),
  currency: z.string().min(1, "Currency is required"),
  categoryId: z.string().min(1, "Category is required"),
  priority: z.enum(["HIGH", "NORMAL"]),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

type ExpenseFormProps = {
  defaultValues?: Partial<ExpenseFormValues>;
  submitLabel?: string;
  onSubmit: (values: ExpenseFormValues) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  categoriesEnabled?: boolean;
};

export function ExpenseForm({
  defaultValues,
  submitLabel = "Save",
  onSubmit,
  onCancel,
  isSubmitting,
  categoriesEnabled = true,
}: ExpenseFormProps) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: defaultValues?.description ?? "",
      amount: defaultValues?.amount ?? (undefined as unknown as number),
      currency: defaultValues?.currency ?? "Birr",
      categoryId: defaultValues?.categoryId ?? "",
      priority: defaultValues?.priority ?? "NORMAL",
    },
  });

  const {
    data: categoriesData,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery<{ categories: { id: string; name: string }[] }, Error>({
    queryKey: ["org-admin-categories"],
    enabled: categoriesEnabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch("/api/org-admin/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json() as Promise<{
        categories: { id: string; name: string }[];
      }>;
    },
  });

  useEffect(() => {
    if (categoriesError) {
      console.error("[v0] Categories load error:", categoriesError);
      toast.error("Unable to load categories. Please try again.");
    }
  }, [categoriesError]);

  const categories = categoriesData?.categories ?? [];

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error("[v0] Submit expense error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit expense"
      );
    }
  });

  const amountValue = form.watch("amount");
  const amountDisplay = useMemo(
    () => amountValue?.toString() ?? "0",
    [amountValue]
  );

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the expense" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? Number(value) : undefined);
                    }}
                    placeholder="0.00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input placeholder="USD" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isLoadingCategories}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingCategories
                            ? "Loading..."
                            : "Select a category"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Entered amount: {amountDisplay || "0"}</span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
