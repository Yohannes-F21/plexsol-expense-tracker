"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type CreateExpenseDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess: () => void;
  trigger?: React.ReactNode;
};

export function CreateExpenseDialog({
  open,
  onOpenChange,
  onSuccess,
  trigger,
}: CreateExpenseDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<
    "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL"
  >("RECEIPT");

  const isControlled = typeof open === "boolean";
  const actualOpen = isControlled ? (open as boolean) : internalOpen;
  const setOpen = useMemo(() => {
    return (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    };
  }, [isControlled, onOpenChange]);

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Expense</DialogTitle>
          <DialogDescription>
            Choose the expense type to continue
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select
            value={expenseType}
            onValueChange={(value) =>
              setExpenseType(value as "RECEIPT" | "PAYMENT_VOUCHER" | "GENERAL")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select expense type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RECEIPT">Receipt</SelectItem>
              <SelectItem value="PAYMENT_VOUCHER">Payment Voucher</SelectItem>
              <SelectItem value="GENERAL">General Expense</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const next = `/expenses/new?type=${expenseType}`;
                setOpen(false);
                onSuccess();
                router.push(next);
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
