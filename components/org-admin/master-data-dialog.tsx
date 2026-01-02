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

const masterDataSchema = z.object({
  label: z.coerce
    .number({ invalid_type_error: "Label is required" })
    .int("Label must be a whole number")
    .positive("Label must be > 0"),
  code: z.string().min(1, "Code is required"),
});

export type MasterDataFormValues = z.infer<typeof masterDataSchema>;

export type MasterDataDialogMode = "create" | "edit";

type MasterDataDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MasterDataDialogMode;
  entityLabel: string;
  defaultValues?: Partial<MasterDataFormValues>;
  isSubmitting?: boolean;
  onSubmit: (values: MasterDataFormValues) => Promise<void>;
};

export function MasterDataDialog({
  open,
  onOpenChange,
  mode,
  entityLabel,
  defaultValues,
  isSubmitting,
  onSubmit,
}: MasterDataDialogProps) {
  const form = useForm<MasterDataFormValues>({
    resolver: zodResolver(masterDataSchema),
    defaultValues: {
      label:
        typeof defaultValues?.label === "number"
          ? defaultValues.label
          : defaultValues?.label
          ? Number(defaultValues.label)
          : 1,
      code: defaultValues?.code ?? "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        label:
          typeof defaultValues?.label === "number"
            ? defaultValues.label
            : defaultValues?.label
            ? Number(defaultValues.label)
            : 1,
        code: defaultValues?.code ?? "",
      });
    }
  }, [open, form, defaultValues?.label, defaultValues?.code]);

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  const title =
    mode === "create" ? `Create ${entityLabel}` : `Edit ${entityLabel}`;
  const description =
    mode === "create"
      ? `Add a new ${entityLabel.toLowerCase()}.`
      : `Update the ${entityLabel.toLowerCase()}.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              type="number"
              step="1"
              min="1"
              placeholder="Enter label"
              {...form.register("label")}
            />
            {form.formState.errors.label ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.label.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              placeholder="Enter code"
              {...form.register("code")}
            />
            {form.formState.errors.code ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.code.message}
              </p>
            ) : null}
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
