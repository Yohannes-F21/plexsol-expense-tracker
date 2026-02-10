"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, Plus, Trash2 } from "lucide-react";

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
  vatCategory: vatCategorySchema,
  unitOfMeasureId: z.string().min(1, "Unit of measure is required"),
  purchaseTypeId: z.string().min(1, "Purchase type is required"),
  quantity: z.coerce.number().positive("Qty must be > 0"),
  unitPrice: z.coerce.number().nonnegative("Unit price must be >= 0"),
});

const receiptSchema = z
  .object({
    purchasedDate: z.string().min(1, "Purchased date is required"),
    companyName: z.string().min(1, "Company name is required"),
    tinNumber: z
      .string()
      .min(10, "TIN is required and must be at least 10 characters"),
    fsNumber: z.string().min(1, "FS number is required"),
    mrcNumber: z.string().trim().min(1, "MRC number is required"),
    invoiceNumber: z.string().optional(),
    paymentMethod: paymentMethodSchema,
    checkNumber: z.string().trim().optional(),
    bankAccountId: z.string().trim().optional(),
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

export type ReceiptExpenseItemInput = z.infer<typeof itemSchema>;
export type ReceiptExpenseHeaderInput = z.infer<typeof receiptSchema>;

type OcrReceiptResponse = {
  companyName?: string;
  tinNumber?: string;
  fsNumber?: string;
  invoiceNumber?: string;
  purchasedDate?: string; // dd/MM/yyyy (from OCR)
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
};

function guessImageMimeTypeFromFilename(name: string): string | null {
  const n = String(name ?? "")
    .toLowerCase()
    .trim();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".heif")) return "image/heif";
  return null;
}

function normalizeCapturedImageFile(file: File): File {
  // Some mobile browsers provide captured photos with an empty MIME type.
  // Our API validates content-type strictly, so we best-effort infer from filename.
  if (file.type && file.type.trim()) return file;

  const guessed = guessImageMimeTypeFromFilename(file.name);
  if (!guessed) return file;
  return new File([file], file.name || "receipt", {
    type: guessed,
    lastModified: file.lastModified,
  });
}

async function downscaleToJpeg(
  file: File,
  opts?: { maxSide?: number; quality?: number },
) {
  // Camera captures can be very large; keep output small so OCR doesn't time out.
  const initialMaxSide = opts?.maxSide ?? 1024;
  const initialQuality = opts?.quality ?? 0.75;
  const targetMaxBytes = 600_000; // ~0.6MB (reduces OCR.space timeout risk)

  // Keep original if already reasonably small.
  if (file.size > 0 && file.size <= 450_000 && file.type === "image/jpeg") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load captured image"));
      el.src = objectUrl;
    });

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return file;

    const attempts: Array<{ maxSide: number; quality: number }> = [
      { maxSide: initialMaxSide, quality: initialQuality },
      { maxSide: Math.min(1024, initialMaxSide), quality: 0.7 },
      { maxSide: 900, quality: 0.65 },
      { maxSide: 768, quality: 0.6 },
      { maxSide: 640, quality: 0.55 },
      { maxSide: 576, quality: 0.5 },
      { maxSide: 512, quality: 0.45 },
    ];

    let best: Blob | null = null;

    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxSide / Math.max(srcW, srcH));
      const dstW = Math.max(1, Math.round(srcW * scale));
      const dstH = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, dstW, dstH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", attempt.quality),
      );

      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= targetMaxBytes) {
        best = blob;
        break;
      }
    }

    // Still too big? Make one last aggressive attempt.
    if (best && best.size > targetMaxBytes) {
      const scale = Math.min(1, 480 / Math.max(srcW, srcH));
      const dstW = Math.max(1, Math.round(srcW * scale));
      const dstH = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, dstW, dstH);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.42),
        );
        if (blob && blob.size < best.size) best = blob;
      }
    }

    if (!best) return file;

    // Preserve a sensible filename.
    const baseName = (file.name || "receipt").replace(/\.[^/.]+$/, "");
    const outName = `${baseName || "receipt"}.jpg`;

    return new File([best], outName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
  expenseType: "RECEIPT";
  purchasedDate: string;
  companyName: string;
  tinNumber: string;
  fsNumber: string;
  mrcNumber: string | null;
  invoiceNumber: string | null;
  paymentMethod: z.infer<typeof paymentMethodSchema>;
  checkNumber?: string | null;
  bankAccountId?: string | null;
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
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(
    null,
  );
  const [isSubmittingCapture, setIsSubmittingCapture] = useState(false);

  useEffect(() => {
    if (!capturedFile) {
      setCapturedPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(capturedFile);
    setCapturedPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [capturedFile]);

  const [items, setItems] = useState<
    Array<ReceiptExpenseItemInput & { categoryType: CategoryTypeUi }>
  >(() => {
    if (props.initial?.items?.length) {
      return props.initial.items.map((it) => ({
        itemName: it.itemName,
        categoryType: normalizeCategoryType(it.subcategory?.type),
        subcategoryId: it.subcategoryId,
        vatCategory: (it.vatCategory as any) ?? "G",
        unitOfMeasureId: it.unitOfMeasureId ?? "",
        purchaseTypeId: it.purchaseTypeId ?? "",
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
        unitOfMeasureId: "",
        purchaseTypeId: "",
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
      checkNumber: props.initial?.checkNumber ?? "",
      bankAccountId: props.initial?.bankAccountId ?? "",
    },
  });

  const paymentMethod = form.watch("paymentMethod");

  useEffect(() => {
    if (paymentMethod !== "CHECK") {
      form.setValue("checkNumber", "");
    }
    if (paymentMethod !== "BANK_TRANSFER") {
      form.setValue("bankAccountId", "");
    }
  }, [paymentMethod, form]);

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

  const units = unitsPayload?.units ?? [];
  const purchaseTypes = purchaseTypesPayload?.purchaseTypes ?? [];
  const bankAccounts = bankAccountsPayload?.bankAccounts ?? [];
  const activeBankAccounts = useMemo(
    () => bankAccounts.filter((b) => b.isActive),
    [bankAccounts],
  );

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({
          queryKey: ["expense", data.expense.id],
        }),
      ]);
      toast.success(
        props.mode === "edit" ? "Expense updated" : "Expense created",
      );
      const destination = props.onSuccessNavigateTo
        ? props.onSuccessNavigateTo(data.expense.id)
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

  const ocrMutation = useMutation({
    mutationFn: async (file: File) => {
      const normalizedFile = normalizeCapturedImageFile(file);
      const fd = new FormData();
      fd.append("file", normalizedFile);

      const res = await fetch("/api/ocr/receipt", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      // API returns 200 even on upstream OCR errors (best-effort),
      // but non-2xx means our request was invalid (e.g., unsupported file type).
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as any).error)
            : "OCR request failed";
        throw new Error(msg);
      }

      return data as OcrReceiptResponse;
    },
    onSuccess: (data) => {
      const setIfEmpty = (
        key: keyof ReceiptExpenseHeaderInput,
        value: string | undefined,
      ) => {
        const v = String(value ?? "").trim();
        if (!v) return;
        const current = String(form.getValues(key) ?? "").trim();
        if (!current) form.setValue(key, v as any, { shouldDirty: true });
      };

      setIfEmpty("companyName", data.companyName);
      setIfEmpty("tinNumber", data.tinNumber);
      setIfEmpty("fsNumber", data.fsNumber);
      setIfEmpty("invoiceNumber", data.invoiceNumber);

      // Convert dd/MM/yyyy -> yyyy-mm-dd for <input type="date">
      if (data.purchasedDate) {
        const m = String(data.purchasedDate).match(
          /^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/,
        );
        if (m) {
          const dd = m[1];
          const mm = m[2];
          const yyyy = m[3];
          form.setValue("purchasedDate", `${yyyy}-${mm}-${dd}` as any, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
      }

      const parsedItems = Array.isArray(data.items) ? data.items : [];
      if (parsedItems.length) {
        setItems((prev) => {
          const isBlankStarter =
            prev.length === 1 &&
            !String(prev[0].itemName ?? "").trim() &&
            !String(prev[0].subcategoryId ?? "").trim();

          const base = isBlankStarter ? [] : prev;
          const mapped = parsedItems
            .filter((it) => String(it.name ?? "").trim())
            .slice(0, 25)
            .map((it) => ({
              itemName: String(it.name).trim(),
              categoryType: "operational" as CategoryTypeUi,
              subcategoryId: "",
              vatCategory: "G" as any,
              unitOfMeasureId: "",
              purchaseTypeId: "",
              quantity:
                Number.isFinite(it.quantity) && it.quantity > 0
                  ? it.quantity
                  : 1,
              unitPrice:
                Number.isFinite(it.unitPrice) && it.unitPrice >= 0
                  ? it.unitPrice
                  : 0,
            }));

          return mapped.length ? [...base, ...mapped] : prev;
        });
      }

      // Non-blocking confidence warning (heuristic)
      const filledHeader = [
        data.companyName,
        data.tinNumber,
        data.fsNumber,
        data.invoiceNumber,
        data.purchasedDate,
      ].filter((v) => String(v ?? "").trim()).length;

      if (filledHeader <= 1 && parsedItems.length === 0) {
        toast.warning(
          "OCR couldn't extract fields. Try a clearer photo; you can still fill manually.",
        );
      } else {
        toast.success("Receipt scanned. Please review before submitting.");
      }

      // If this came from mobile/tablet capture, close preview dialog.
      setCaptureOpen(false);
      setCapturedFile(null);
    },
    onError: (err) => {
      toast.warning(
        err instanceof Error
          ? `OCR failed: ${err.message}`
          : "OCR failed. You can still enter details manually.",
      );
    },
  });

  const onSubmit = form.handleSubmit(async (header) => {
    const submitItems = items.map(({ categoryType: _ct, ...rest }) => rest);
    const parsedItems = z.array(itemSchema).min(1).safeParse(submitItems);
    if (!parsedItems.success) {
      const first = parsedItems.error.issues?.[0];
      toast.error(first?.message || "Please complete all item fields");
      return;
    }

    const checkNumber = header.checkNumber?.trim();
    const bankAccountId = header.bankAccountId?.trim();

    const payload = {
      ...(props.mode === "create" ? { expenseType: "RECEIPT" } : {}),
      purchasedDate: new Date(header.purchasedDate),
      companyName: header.companyName,
      tinNumber: header.tinNumber,
      fsNumber: header.fsNumber,
      mrcNumber: header.mrcNumber.trim(),
      invoiceNumber: header.invoiceNumber?.trim() || undefined,
      paymentMethod: header.paymentMethod,
      checkNumber: header.paymentMethod === "CHECK" ? checkNumber : undefined,
      bankAccountId:
        header.paymentMethod === "BANK_TRANSFER" ? bankAccountId : undefined,
      items: parsedItems.data,
    };

    await mutation.mutateAsync(payload);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Receipt Info</CardTitle>
            {props.mode === "create" ? (
              <div className="flex items-center gap-2">
                {/* Desktop upload flow (unchanged) */}
                <div className="hidden lg:block">
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      ocrMutation.mutate(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => scanInputRef.current?.click()}
                    disabled={ocrMutation.isPending}
                  >
                    {ocrMutation.isPending ? "Uploading..." : "Upload Receipt"}
                  </Button>
                </div>

                {/* Mobile/tablet camera capture flow */}
                <div className="lg:hidden">
                  <input
                    ref={captureInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      setCapturedFile(f);
                      setCaptureOpen(true);
                    }}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => captureInputRef.current?.click()}
                    disabled={ocrMutation.isPending}
                  >
                    Scan Receipt
                  </Button>

                  <Dialog
                    open={captureOpen}
                    onOpenChange={(open) => {
                      setCaptureOpen(open);
                      if (!open) setCapturedFile(null);
                    }}
                  >
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Receipt Preview</DialogTitle>
                      </DialogHeader>

                      {capturedPreviewUrl ? (
                        <div className="space-y-3">
                          <div className="overflow-hidden rounded-md border">
                            <img
                              src={capturedPreviewUrl}
                              alt="Receipt preview"
                              className="h-auto w-full object-contain"
                            />
                          </div>

                          {ocrMutation.isPending ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Processing receipt…
                            </div>
                          ) : null}

                          {isSubmittingCapture && !ocrMutation.isPending ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Preparing image…
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No image selected.
                        </div>
                      )}

                      <DialogFooter className="flex w-full flex-row items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => captureInputRef.current?.click()}
                          disabled={
                            ocrMutation.isPending || isSubmittingCapture
                          }
                        >
                          Retake
                        </Button>
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!capturedFile) return;
                            try {
                              setIsSubmittingCapture(true);

                              // Camera-captured images are often very large (and/or HEIC).
                              // Downscale + convert to JPEG to reduce OCR timeouts.
                              const normalized =
                                normalizeCapturedImageFile(capturedFile);
                              const prepared =
                                await downscaleToJpeg(normalized);
                              await ocrMutation.mutateAsync(prepared);
                            } finally {
                              setIsSubmittingCapture(false);
                            }
                          }}
                          disabled={
                            !capturedFile ||
                            ocrMutation.isPending ||
                            isSubmittingCapture
                          }
                        >
                          {ocrMutation.isPending ? "Submitting…" : "Submit"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : null}
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
                      <FormLabel>MRC Number</FormLabel>
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

                <div className="grid grid-cols-1 gap-4">
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
                            <SelectTrigger className="">
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

                  {paymentMethod === "CHECK" ? (
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

                  {paymentMethod === "BANK_TRANSFER" ? (
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
            </Form>
          </CardContent>
        </Card>
      </div>

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
                  vatCategory: "G",
                  unitOfMeasureId: "",
                  purchaseTypeId: "",
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
            <Table className="min-w-275">
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
                    (c) => normalizeCategoryType(c.type) === it.categoryType,
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
                                  : p,
                              ),
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
                                  : p,
                              ),
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
                                i === idx ? { ...p, subcategoryId: v } : p,
                              ),
                            )
                          }
                          disabled={isLoadingCategories}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isLoadingCategories ? "Loading..." : "Select"
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
                                i === idx ? { ...p, vatCategory: v as any } : p,
                              ),
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
                          value={it.unitOfMeasureId || ""}
                          onValueChange={(v) =>
                            setItems((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      unitOfMeasureId: v,
                                    }
                                  : p,
                              ),
                            )
                          }
                          disabled={isLoadingUnits}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isLoadingUnits ? "Loading..." : "Select"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
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
                          value={it.purchaseTypeId || ""}
                          onValueChange={(v) =>
                            setItems((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      purchaseTypeId: v,
                                    }
                                  : p,
                              ),
                            )
                          }
                          disabled={isLoadingPurchaseTypes}
                        >
                          <SelectTrigger className="w-full">
                            {it.purchaseTypeId ? (
                              <span
                                data-slot="select-value"
                                className="line-clamp-1 flex items-center gap-2"
                              >
                                <span className="tabular-nums">
                                  {purchaseTypeById.get(it.purchaseTypeId)
                                    ?.label ?? ""}
                                </span>
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
                                  : p,
                              ),
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
                                  : p,
                              ),
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
                            setItems((prev) => prev.filter((_, i) => i !== idx))
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

      <div className="flex justify-end">
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
              <span className="tabular-nums">{computed.vat.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Total</span>
              <span className="tabular-nums">{computed.total.toFixed(2)}</span>
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
    </form>
  );
}
