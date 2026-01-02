"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

const paymentMethodSchema = z.enum([
  "CASH",
  "CHECK",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "OTHER",
]);

const vatCategorySchema = z.enum(["G", "S"]);

const itemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  subcategoryId: z.string().min(1, "Subcategory is required"),
  vatCategory: vatCategorySchema.optional(),
  unitOfMeasureId: z.string().optional(),
  purchaseTypeId: z.string().optional(),
  quantity: z.coerce.number().positive("Qty must be > 0"),
  unitPrice: z.coerce.number().nonnegative("Unit price must be >= 0"),
});

const receiptSchema = z.object({
  purchasedDate: z.string().min(1, "Purchased date is required"),
  companyName: z.string().min(1, "Company name is required"),
  tinNumber: z.string().min(1, "TIN is required"),
  fsNumber: z.string().min(1, "FS number is required"),
  mrcNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  paymentMethod: paymentMethodSchema,
});

export type ReceiptExpenseItemInput = z.infer<typeof itemSchema>;
export type ReceiptExpenseHeaderInput = z.infer<typeof receiptSchema>;

type CategoryTypeUi = "operational" | "administrative";

function normalizeCategoryType(value: unknown): CategoryTypeUi {
  const s = String(value ?? "");
  const upper = s.toUpperCase();
  if (s === "administrative" || upper === "ADMINISTRATIVE") {
    return "administrative";
  }
  return "operational";
}

export type ReceiptExpenseDetail = {
  id: string;
  purchasedDate: string;
  companyName: string;
  tinNumber: string;
  fsNumber: string;
  mrcNumber: string | null;
  invoiceNumber: string | null;
  paymentMethod: z.infer<typeof paymentMethodSchema>;
  subtotal: any;
  vat: any;
  total: any;
  status: "PENDING" | "WARNING" | "APPROVED" | "REJECTED";
  items: Array<{
    id: string;
    itemName: string;
    subcategoryId: string;
    vatCategory?: z.infer<typeof vatCategorySchema> | null;
    quantity: any;
    unitPrice: any;
    lineTotal: any;
    unitOfMeasureId?: string | null;
    purchaseTypeId?: string | null;
    hasPolicyViolation: boolean;
    subcategory: { id: string; name: string; type?: string | null } | null;
    unitOfMeasure?: { id: string; label: number; code: string } | null;
    purchaseType?: { id: string; label: number; code: string } | null;
  }>;
};

function toDateInputValue(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function asNumber(x: any): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  if (x && typeof x === "object" && typeof x.toNumber === "function")
    return x.toNumber();
  return Number(x);
}

const VAT_RATE = 0.15;

const NONE_OPTION = "__NONE__";

export function ReceiptExpenseForm(props: {
  mode: "create" | "edit";
  role: "ORG_ADMIN" | "STAFF";
  expenseId?: string;
  initial?: ReceiptExpenseDetail | null;
  onSuccessNavigateTo?: (createdOrUpdatedId: string) => string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<
    Array<ReceiptExpenseItemInput & { categoryType: CategoryTypeUi }>
  >(() => {
    if (props.initial?.items?.length) {
      return props.initial.items.map((it) => ({
        itemName: it.itemName,
        categoryType: normalizeCategoryType(it.subcategory?.type),
        subcategoryId: it.subcategoryId,
        vatCategory: (it.vatCategory as any) ?? "G",
        unitOfMeasureId: it.unitOfMeasureId ?? undefined,
        purchaseTypeId: it.purchaseTypeId ?? undefined,
        quantity: asNumber(it.quantity),
        unitPrice: asNumber(it.unitPrice),
      }));
    }
    return [
      {
        itemName: "",
        categoryType: "operational",
        subcategoryId: "",
        vatCategory: "G",
        unitOfMeasureId: undefined,
        purchaseTypeId: undefined,
        quantity: 1,
        unitPrice: 0,
      },
    ];
  });

  const form = useForm<ReceiptExpenseHeaderInput>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      purchasedDate: props.initial?.purchasedDate
        ? toDateInputValue(props.initial.purchasedDate)
        : toDateInputValue(new Date()),
      companyName: props.initial?.companyName ?? "",
      tinNumber: props.initial?.tinNumber ?? "",
      fsNumber: props.initial?.fsNumber ?? "",
      mrcNumber: props.initial?.mrcNumber ?? "",
      invoiceNumber: props.initial?.invoiceNumber ?? "",
      paymentMethod: (props.initial?.paymentMethod as any) ?? "CASH",
    },
  });

  const { data: categoriesPayload, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload.error || "Failed to load categories");
      return payload as {
        categories: Array<{ id: string; name: string; type?: string | null }>;
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const categories = categoriesPayload?.categories ?? [];

  const { data: unitsPayload, isLoading: isLoadingUnits } = useQuery({
    queryKey: ["org-admin-units-of-measure"],
    queryFn: async () => {
      const res = await fetch("/api/org-admin/units-of-measure", {
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load units");
      return payload as {
        units: Array<{
          id: string;
          label: number;
          code: string;
          isActive: boolean;
        }>;
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: purchaseTypesPayload, isLoading: isLoadingPurchaseTypes } =
    useQuery({
      queryKey: ["org-admin-purchase-types"],
      queryFn: async () => {
        const res = await fetch("/api/org-admin/purchase-types", {
          cache: "no-store",
        });
        const payload = await res.json();
        if (!res.ok)
          throw new Error(payload.error || "Failed to load purchase types");
        return payload as {
          purchaseTypes: Array<{
            id: string;
            label: number;
            code: string;
            isActive: boolean;
          }>;
        };
      },
      staleTime: 5 * 60 * 1000,
    });

  const units = unitsPayload?.units ?? [];
  const purchaseTypes = purchaseTypesPayload?.purchaseTypes ?? [];

  const unitById = useMemo(() => {
    return new Map(units.map((u) => [u.id, u] as const));
  }, [units]);

  const purchaseTypeById = useMemo(() => {
    return new Map(purchaseTypes.map((p) => [p.id, p] as const));
  }, [purchaseTypes]);

  const computed = useMemo(() => {
    const lines = items.map((it) => {
      const q = Number.isFinite(it.quantity) ? it.quantity : 0;
      const p = Number.isFinite(it.unitPrice) ? it.unitPrice : 0;
      return round2(q * p);
    });
    const subtotal = round2(lines.reduce((s, v) => s + v, 0));
    const vat = round2(subtotal * VAT_RATE);
    const total = round2(subtotal + vat);
    return { lines, subtotal, vat, total };
  }, [items]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const url =
        props.mode === "edit"
          ? `/api/expenses/${props.expenseId}`
          : "/api/expenses";
      const method = props.mode === "edit" ? "PUT" : "POST";
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
      const destination = props.onSuccessNavigateTo
        ? props.onSuccessNavigateTo(data.expense.id)
        : props.role === "ORG_ADMIN"
        ? `/org-admin/expenses/${data.expense.id}`
        : `/dashboard/expenses/${data.expense.id}`;
      router.push(destination);
      router.refresh();
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to save expense"
      );
    },
  });

  const onSubmit = form.handleSubmit(async (header) => {
    const submitItems = items.map(({ categoryType: _ct, ...rest }) => rest);
    const parsedItems = z.array(itemSchema).min(1).safeParse(submitItems);
    if (!parsedItems.success) {
      toast.error("Please fix the items table errors");
      return;
    }

    const payload = {
      purchasedDate: new Date(header.purchasedDate),
      companyName: header.companyName,
      tinNumber: header.tinNumber,
      fsNumber: header.fsNumber,
      mrcNumber: header.mrcNumber?.trim() || undefined,
      invoiceNumber: header.invoiceNumber?.trim() || undefined,
      paymentMethod: header.paymentMethod,
      items: parsedItems.data,
    };

    await mutation.mutateAsync(payload);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...form}>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="purchasedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchased Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Company" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tinNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TIN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="TIN" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fsNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>FS Number</FormLabel>
                          <FormControl>
                            <Input placeholder="FS" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="mrcNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MRC Number (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="MRC" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Number (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Invoice" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <div className="space-y-6 ">
            <div className=" space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Items</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setItems((prev) => [
                        ...prev,
                        {
                          itemName: "",
                          categoryType: "operational",
                          subcategoryId: "",
                          quantity: 1,
                          unitPrice: 0,
                        },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[1100px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Category Type</TableHead>
                          <TableHead>Subcategory</TableHead>
                          <TableHead>VAT</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead>Purchase Type</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it, idx) => {
                          const lineTotal = computed.lines[idx] ?? 0;
                          const filteredCategories = categories.filter(
                            (c) =>
                              normalizeCategoryType(c.type) === it.categoryType
                          );

                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <Input
                                  value={it.itemName}
                                  onChange={(e) =>
                                    setItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx
                                          ? { ...p, itemName: e.target.value }
                                          : p
                                      )
                                    )
                                  }
                                  placeholder="Item name"
                                />
                              </TableCell>

                              <TableCell>
                                <Select
                                  value={it.categoryType}
                                  onValueChange={(v) =>
                                    setItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx
                                          ? {
                                              ...p,
                                              categoryType: v as CategoryTypeUi,
                                              subcategoryId: "",
                                            }
                                          : p
                                      )
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="operational">
                                      Operational
                                    </SelectItem>
                                    <SelectItem value="administrative">
                                      Administrative
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              <TableCell>
                                <Select
                                  value={it.subcategoryId}
                                  onValueChange={(v) =>
                                    setItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx
                                          ? { ...p, subcategoryId: v }
                                          : p
                                      )
                                    )
                                  }
                                  disabled={isLoadingCategories}
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        isLoadingCategories
                                          ? "Loading..."
                                          : "Select"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {filteredCategories.map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              <TableCell>
                                <Select
                                  value={it.vatCategory ?? "G"}
                                  onValueChange={(v) =>
                                    setItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx
                                          ? {
                                              ...p,
                                              vatCategory: v as any,
                                            }
                                          : p
                                      )
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="VAT" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="G">G</SelectItem>
                                    <SelectItem value="S">S</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              <TableCell>
                                <Select
                                  value={it.unitOfMeasureId ?? NONE_OPTION}
                                  onValueChange={(v) =>
                                    setItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx
                                          ? {
                                              ...p,
                                              unitOfMeasureId:
                                                v === NONE_OPTION
                                                  ? undefined
                                                  : v,
                                            }
                                          : p
                                      )
                                    )
                                  }
                                  disabled={isLoadingUnits}
                                >
                                  <SelectTrigger>
                                    {it.unitOfMeasureId &&
                                    it.unitOfMeasureId !== NONE_OPTION ? (
                                      <span className="truncate">
                                        {unitById.get(it.unitOfMeasureId)
                                          ?.label ?? "Select"}
                                      </span>
                                    ) : (
                                      <SelectValue
                                        placeholder={
                                          isLoadingUnits
                                            ? "Loading..."
                                            : "Select"
                                        }
                                      />
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NONE_OPTION}>
                                      None
                                    </SelectItem>
                                    {units.map((u) => (
                                      <SelectItem
                                        key={u.id}
                                        value={u.id}
                                        disabled={!u.isActive}
                                      >
                                        <div className="flex w-full items-center justify-between gap-2">
                                          <span className="tabular-nums">
                                            {u.label}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {u.code}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              <TableCell>
                                <Select
                                  value={it.purchaseTypeId ?? NONE_OPTION}
                                  onValueChange={(v) =>
                                    setItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx
                                          ? {
                                              ...p,
                                              purchaseTypeId:
                                                v === NONE_OPTION
                                                  ? undefined
                                                  : v,
                                            }
                                          : p
                                      )
                                    )
                                  }
                                  disabled={isLoadingPurchaseTypes}
                                >
                                  <SelectTrigger>
                                    {it.purchaseTypeId &&
                                    it.purchaseTypeId !== NONE_OPTION ? (
                                      <span className="truncate">
                                        {purchaseTypeById.get(it.purchaseTypeId)
                                          ?.label ?? "Select"}
                                      </span>
                                    ) : (
                                      <SelectValue
                                        placeholder={
                                          isLoadingPurchaseTypes
                                            ? "Loading..."
                                            : "Select"
                                        }
                                      />
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NONE_OPTION}>
                                      None
                                    </SelectItem>
                                    {purchaseTypes.map((p) => (
                                      <SelectItem
                                        key={p.id}
                                        value={p.id}
                                        disabled={!p.isActive}
                                      >
                                        <div className="flex w-full items-center justify-between gap-2">
                                          <span className="tabular-nums">
                                            {p.label}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {p.code}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              <TableCell>
                                <Input
                                  className="w-24"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={String(it.quantity ?? "")}
                                  onChange={(e) =>
                                    setItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx
                                          ? {
                                              ...p,
                                              quantity: e.target.value
                                                ? Number(e.target.value)
                                                : ("" as any),
                                            }
                                          : p
                                      )
                                    )
                                  }
                                />
                              </TableCell>

                              <TableCell>
                                <Input
                                  className="w-32"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={String(it.unitPrice ?? "")}
                                  onChange={(e) =>
                                    setItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx
                                          ? {
                                              ...p,
                                              unitPrice: e.target.value
                                                ? Number(e.target.value)
                                                : ("" as any),
                                            }
                                          : p
                                      )
                                    )
                                  }
                                />
                              </TableCell>

                              <TableCell className="text-right tabular-nums">
                                {lineTotal.toFixed(2)}
                              </TableCell>

                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setItems((prev) =>
                                      prev.filter((_, i) => i !== idx)
                                    )
                                  }
                                  disabled={items.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Policy checks run on the server after submit.
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end  ">
              <Card className="md:max-w-sm w-full">
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {props.initial?.status === "WARNING" ? (
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">WARNING</Badge>
                      <span className="text-xs text-muted-foreground">
                        Some items violate policy
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">
                      {computed.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">VAT (15%)</span>
                    <span className="tabular-nums">
                      {computed.vat.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {computed.total.toFixed(2)}
                    </span>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending
                        ? "Saving..."
                        : props.mode === "edit"
                        ? "Save Changes"
                        : "Submit Receipt"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
