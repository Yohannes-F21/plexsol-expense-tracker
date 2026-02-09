"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

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

const itemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  categoryType: z.enum(["operational", "administrative"]),
  categoryId: z.string().min(1, "Subcategory is required"),
  quantity: z.coerce.number().positive("Qty must be > 0"),
  unitPrice: z.coerce.number().nonnegative("Unit price must be >= 0"),
});

const paymentVoucherSchema = z
  .object({
    purchasedDate: z.string().min(1, "Date is required"),
    paidTo: z.string().min(1, "Paid to is required"),
    tinNumber: z.string().optional(),
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    paymentMethod: paymentMethodSchema,
    checkNumber: z.string().trim().optional(),
    bankAccountId: z.string().trim().optional(),
    items: z.array(itemSchema).min(1, "Add at least one item"),
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

export type PaymentVoucherDetail = {
  id: string;
  expenseType: "PAYMENT_VOUCHER";
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  purchasedDate: string;
  paidTo: string;
  tinNumber?: string | null;
  invoiceNumber: string;
  paymentMethod: z.infer<typeof paymentMethodSchema>;
  checkNumber?: string | null;
  bankAccountId?: string | null;
  items: Array<{
    id?: string;
    itemName: string;
    categoryId: string;
    quantity: number;
    unitPrice: number;
  }>;
};

type PaymentVoucherFormProps = {
  mode: "create" | "edit";
  expenseId?: string;
  role: "STAFF" | "ORG_ADMIN";
  initial?: PaymentVoucherDetail | null;
  onSuccessNavigateTo?: (id: string) => string;
};

export function PaymentVoucherForm({
  mode,
  expenseId,
  initial,
  onSuccessNavigateTo,
}: PaymentVoucherFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof paymentVoucherSchema>>({
    resolver: zodResolver(paymentVoucherSchema),
    defaultValues: {
      purchasedDate:
        toDateInputValue(initial?.purchasedDate) || todayDateInputValue(),
      paidTo: initial?.paidTo ?? "",
      tinNumber: initial?.tinNumber ?? "",
      invoiceNumber: initial?.invoiceNumber ?? "",
      paymentMethod: initial?.paymentMethod ?? "CASH",
      checkNumber: initial?.checkNumber ?? "",
      bankAccountId: initial?.bankAccountId ?? "",
      items: initial?.items?.length
        ? initial.items.map((it) => ({
            itemName: it.itemName,
            categoryType: "operational" as const,
            categoryId: it.categoryId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          }))
        : [
            {
              itemName: "",
              categoryType: "operational" as const,
              categoryId: "",
              quantity: 1,
              unitPrice: 0,
            },
          ],
    },
  });

  useEffect(() => {
    if (!initial) return;
    form.reset({
      purchasedDate:
        toDateInputValue(initial.purchasedDate) || todayDateInputValue(),
      paidTo: initial.paidTo ?? "",
      tinNumber: initial.tinNumber ?? "",
      invoiceNumber: initial.invoiceNumber ?? "",
      paymentMethod: initial.paymentMethod ?? "CASH",
      checkNumber: initial.checkNumber ?? "",
      bankAccountId: initial.bankAccountId ?? "",
      items: initial.items?.length
        ? initial.items.map((it) => ({
            itemName: it.itemName,
            categoryType: "operational" as const,
            categoryId: it.categoryId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          }))
        : [
            {
              itemName: "",
              categoryType: "operational" as const,
              categoryId: "",
              quantity: 1,
              unitPrice: 0,
            },
          ],
    });
  }, [initial, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

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
    const current = form.getValues("items") ?? [];
    if (!current.length) return;

    let changed = false;
    const next = current.map((it) => {
      const cat = categories.find((c) => c.id === it.categoryId);
      if (!cat) return it;
      const inferred = normalizeCategoryType(cat.type);
      if (it.categoryType === inferred) return it;
      changed = true;
      return { ...it, categoryType: inferred };
    });

    if (changed) {
      form.setValue("items", next, { shouldDirty: false, shouldTouch: false });
    }
    // Re-run when `initial` arrives after categories.
  }, [categories, initial?.id, form]);
  const bankAccounts = bankAccountsPayload?.bankAccounts ?? [];
  const activeBankAccounts = useMemo(
    () => bankAccounts.filter((b) => b.isActive),
    [bankAccounts],
  );

  const items = form.watch("items");
  const total = useMemo(() => {
    return (items ?? []).reduce((sum, it) => {
      const qty = Number(it.quantity);
      const price = Number(it.unitPrice);
      const safeQty = Number.isFinite(qty) ? qty : 0;
      const safePrice = Number.isFinite(price) ? price : 0;
      return sum + safeQty * safePrice;
    }, 0);
  }, [items]);

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
      ...(mode === "create" ? { expenseType: "PAYMENT_VOUCHER" } : {}),
      purchasedDate: new Date(values.purchasedDate),
      paidTo: values.paidTo,
      tinNumber: values.tinNumber?.trim() || undefined,
      invoiceNumber: values.invoiceNumber,
      paymentMethod: values.paymentMethod,
      checkNumber:
        values.paymentMethod === "CHECK"
          ? values.checkNumber?.trim() || undefined
          : undefined,
      bankAccountId:
        values.paymentMethod === "BANK_TRANSFER"
          ? values.bankAccountId?.trim() || undefined
          : undefined,
      items: values.items.map(({ categoryType: _ct, ...rest }) => rest),
    };

    await mutation.mutateAsync(payload);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="">
        <Card className="w-[80%] ">
          <Card className="w-[95%] mx-auto">
            <CardHeader>
              <CardTitle>Payment Voucher</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchasedDate"
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
                        <Input placeholder="Vendor name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="INV-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tinNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIN Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter TIN number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <Input
                              placeholder="Enter check number"
                              {...field}
                            />
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
                </div> */}
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
                            <Input
                              placeholder="Enter check number"
                              {...field}
                            />
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

          <Card className="w-[95%] mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  append({
                    itemName: "",
                    categoryType: "operational",
                    categoryId: "",
                    quantity: 1,
                    unitPrice: 0,
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add item
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category Type</TableHead>
                    <TableHead>Subcategory</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                    <TableHead className="w-32">Unit Price</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.itemName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Item name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.categoryType`}
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                value={field.value}
                                onValueChange={(v) => {
                                  field.onChange(v);
                                  form.setValue(
                                    `items.${index}.categoryId`,
                                    "",
                                    {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    },
                                  );
                                  form.clearErrors(`items.${index}.categoryId`);
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
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.categoryId`}
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                onValueChange={(v) => {
                                  field.onChange(v);
                                  form.clearErrors(`items.${index}.categoryId`);
                                  void form.trigger(
                                    `items.${index}.categoryId`,
                                  );
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
                                      const type = normalizeCategoryType(
                                        c.type,
                                      );
                                      return (
                                        type ===
                                        (form.getValues(
                                          `items.${index}.categoryType`,
                                        ) as CategoryTypeUi)
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
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end pt-4 text-sm font-medium">
                Total: {total.toFixed(2)} ETB
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 w-[95%] ">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving..."
                : mode === "edit"
                  ? "Update Expense"
                  : "Submit Expense"}
            </Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}
