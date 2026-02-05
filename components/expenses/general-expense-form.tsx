"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function todayDateInputValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const paymentMethodSchema = z.enum([
  "CASH",
  "CHECK",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "OTHER",
]);

type CategoryTypeUi = "operational" | "administrative";

function normalizeCategoryType(value: unknown): CategoryTypeUi {
  const s = String(value ?? "");
  const upper = s.toUpperCase();
  if (s === "administrative" || upper === "ADMINISTRATIVE") {
    return "administrative";
  }
  return "operational";
}

const generalExpenseSchema = z
  .object({
    paymentDate: z.string().min(1, "Date is required"),
    paidTo: z.string().min(1, "Paid to is required"),
    description: z.string().min(1, "Description is required"),
    amount: z.coerce.number().positive("Amount must be > 0"),
    paymentMethod: paymentMethodSchema,
    checkNumber: z.string().trim().optional(),
    bankAccountId: z.string().trim().optional(),
    categoryType: z.enum(["operational", "administrative"]),
    categoryId: z.string().min(1, "Subcategory is required"),
  })
  .superRefine((values, ctx) => {
    if (values.paymentMethod === "CHECK") {
      if (!values.checkNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["checkNumber"],
          message: "Check number is required",
        });
      }
    }

    if (values.paymentMethod === "BANK_TRANSFER") {
      if (!values.bankAccountId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankAccountId"],
          message: "Bank account is required",
        });
      }
    }
  });

export type GeneralExpenseDetail = {
  id: string;
  expenseType: "GENERAL";
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  paymentDate: string;
  paidTo: string;
  description: string;
  amount: number;
  paymentMethod: z.infer<typeof paymentMethodSchema>;
  checkNumber?: string | null;
  bankAccountId?: string | null;
  categoryId: string;
};

type GeneralExpenseFormProps = {
  mode: "create" | "edit";
  expenseId?: string;
  role: "STAFF" | "ORG_ADMIN";
  initial?: GeneralExpenseDetail | null;
  onSuccessNavigateTo?: (id: string) => string;
};

export function GeneralExpenseForm({
  mode,
  expenseId,
  initial,
  onSuccessNavigateTo,
}: GeneralExpenseFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof generalExpenseSchema>>({
    resolver: zodResolver(generalExpenseSchema),
    defaultValues: {
      paymentDate:
        toDateInputValue(initial?.paymentDate) || todayDateInputValue(),
      paidTo: initial?.paidTo ?? "",
      description: initial?.description ?? "",
      amount: initial?.amount ?? 0,
      paymentMethod: initial?.paymentMethod ?? "CASH",
      checkNumber: initial?.checkNumber ?? "",
      bankAccountId: initial?.bankAccountId ?? "",
      categoryType: "operational",
      categoryId: initial?.categoryId ?? "",
    },
  });

  const watchedCategoryType = form.watch("categoryType");
  const watchedCategoryId = form.watch("categoryId");

  useEffect(() => {
    if (!initial) return;
    form.reset({
      paymentDate:
        toDateInputValue(initial.paymentDate) || todayDateInputValue(),
      paidTo: initial.paidTo ?? "",
      description: initial.description ?? "",
      amount: initial.amount ?? 0,
      paymentMethod: initial.paymentMethod ?? "CASH",
      checkNumber: initial.checkNumber ?? "",
      bankAccountId: initial.bankAccountId ?? "",
      categoryType: "operational",
      categoryId: initial.categoryId ?? "",
    });
  }, [initial, form]);

  const { data: categoriesData, isLoading: loadingCategories } = useQuery<
    { categories: { id: string; name: string; type?: string }[] },
    Error
  >({
    queryKey: ["org-admin-categories"],
    queryFn: async () => {
      const res = await fetch("/api/org-admin/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json() as Promise<{
        categories: { id: string; name: string }[];
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: bankAccountsPayload, isLoading: isLoadingBankAccounts } =
    useQuery({
      queryKey: ["org-admin-bank-accounts"],
      queryFn: async () => {
        const res = await fetch("/api/org-admin/bank-accounts", {
          cache: "no-store",
        });
        const payload = await res.json();
        if (!res.ok)
          throw new Error(payload.error || "Failed to load bank accounts");
        return payload as {
          bankAccounts: Array<{
            id: string;
            bankName: string;
            accountHolderName: string;
            accountNumber: string;
            isActive: boolean;
          }>;
        };
      },
      staleTime: 5 * 60 * 1000,
    });

  const categories = categoriesData?.categories ?? [];

  useEffect(() => {
    if (!categories.length) return;
    if (!watchedCategoryId) return;
    const cat = categories.find((c) => c.id === watchedCategoryId);
    if (!cat) return;
    const inferred = normalizeCategoryType(cat.type);
    if (form.getValues("categoryType") === inferred) return;
    form.setValue("categoryType", inferred, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [categories, watchedCategoryId, form]);
  const bankAccounts = bankAccountsPayload?.bankAccounts ?? [];
  const activeBankAccounts = bankAccounts.filter((b) => b.isActive);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const url =
        mode === "edit" ? `/api/expenses/${expenseId}` : "/api/expenses";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data as { expense: { id: string } };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({
        queryKey: ["expense", data.expense.id],
      });
      toast.success(mode === "edit" ? "Expense updated" : "Expense created");
      const destination = onSuccessNavigateTo
        ? onSuccessNavigateTo(data.expense.id)
        : `/expenses/${data.expense.id}`;
      router.push(destination);
      router.refresh();
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to save expense",
      );
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      ...(mode === "create" ? { expenseType: "GENERAL" } : {}),
      paymentDate: new Date(values.paymentDate),
      paidTo: values.paidTo,
      description: values.description,
      amount: values.amount,
      paymentMethod: values.paymentMethod,
      checkNumber:
        values.paymentMethod === "CHECK"
          ? values.checkNumber?.trim() || undefined
          : undefined,
      bankAccountId:
        values.paymentMethod === "BANK_TRANSFER"
          ? values.bankAccountId?.trim() || undefined
          : undefined,
      categoryId: values.categoryId,
    };

    await mutation.mutateAsync(payload);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="w-[85%] ">
          <CardHeader>
            <CardTitle>General Expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paidTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid To</FormLabel>
                    <FormControl>
                      <Input placeholder="Payee" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                        min="0"
                        step="0.01"
                        {...field}
                        value={(field.value ?? "") as any}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categoryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          form.setValue("categoryId", "", {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          form.clearErrors("categoryId");
                        }}
                        disabled={loadingCategories}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="operational">
                            Operational
                          </SelectItem>
                          <SelectItem value="administrative">
                            Administrative
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subcategory</FormLabel>
                      <Select
                        onValueChange={(v) => {
                          field.onChange(v);
                          form.clearErrors("categoryId");
                          void form.trigger("categoryId");
                        }}
                        value={field.value}
                        disabled={loadingCategories}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                loadingCategories
                                  ? "Loading..."
                                  : "Select subcategory"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories
                            .filter((c) => {
                              const type = normalizeCategoryType(c.type);
                              return (
                                type === (watchedCategoryType as CategoryTypeUi)
                              );
                            })
                            .map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="CHECK">Check</SelectItem>
                          <SelectItem value="CREDIT_CARD">
                            Credit Card
                          </SelectItem>
                          <SelectItem value="BANK_TRANSFER">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("paymentMethod") === "CHECK" ? (
                  <FormField
                    control={form.control}
                    name="checkNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter check number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {form.watch("paymentMethod") === "BANK_TRANSFER" ? (
                  <FormField
                    control={form.control}
                    name="bankAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Account</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isLoadingBankAccounts}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  isLoadingBankAccounts
                                    ? "Loading bank accounts..."
                                    : "Select bank account"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {activeBankAccounts.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {`${b.bankName} — ${b.accountHolderName} — ${b.accountNumber}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 w-[85%] ">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Saving..."
              : mode === "edit"
                ? "Update Expense"
                : "Submit Expense"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
