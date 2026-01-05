"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeleteConfirmationDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const {
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    onConfirm,
  } = props;

  const [isWorking, setIsWorking] = React.useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isWorking) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isWorking}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isWorking}
            onClick={async () => {
              try {
                setIsWorking(true);
                await onConfirm();
              } finally {
                setIsWorking(false);
              }
            }}
          >
            {isWorking ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
