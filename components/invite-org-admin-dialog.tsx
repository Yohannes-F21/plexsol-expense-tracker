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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: (data: {
      email: string;
      role: string;
      organizationId: string;
    }) =>
      apiClient<{ invitation: { inviteUrl: string } }>(
        "/api/invitations/send",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      ),
    onSuccess: (data) => {
      toast.success("Invitation sent successfully");
      setInviteUrl(data.invitation.inviteUrl);
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("[v0] Send invitation error:", error);
      toast.error(error.error || "Failed to send invitation");
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
    setInviteUrl(null);
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
        {inviteUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    toast.success("Link copied to clipboard");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with the invited admin. It expires in 7 days.
            </p>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
