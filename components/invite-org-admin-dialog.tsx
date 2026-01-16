"use client";

import type React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

type InviteOrgAdminDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
  onSuccess?: () => void;
};

export function InviteOrgAdminDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: InviteOrgAdminDialogProps) {
  const [email, setEmail] = useState("");

  const inviteMutation = useMutation({
    mutationFn: (data: {
      email: string;
      role: string;
      organizationId: string;
    }) =>
      apiClient<{ success: true }>("/api/invitations/send", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      toast.success(`Invitation sent successfully to ${variables.email}`);
      onSuccess?.();
      handleClose();
    },
    onError: (error: any) => {
      const message =
        typeof error === "string"
          ? error
          : error instanceof Error
          ? error.message
          : typeof error?.message === "string"
          ? error.message
          : typeof error?.error === "string"
          ? error.error
          : "Failed to send invitation";

      if (message === "Failed to send invitation") {
        console.error("Send invitation error:", error);
      }

      toast.error(message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    inviteMutation.mutate({
      email,
      role: "ORG_ADMIN",
      organizationId,
    });
  };

  const handleClose = () => {
    setEmail("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Organization Admin</DialogTitle>
          <DialogDescription>
            Send an invitation for an organization administrator
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
