"use client";

import { useState } from "react";
import { ApprovalsManagement } from "@/components/org-admin/approvals-management";
import { ApprovalsHistory } from "@/components/org-admin/approvals-history";

type ApprovalsViewMode = "pending" | "history";

export function ApprovalsView() {
  const [mode, setMode] = useState<ApprovalsViewMode>("pending");

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode("pending")}
          className={
            mode === "pending"
              ? "rounded-full bg-background px-4 py-2 text-sm font-medium"
              : "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground"
          }
        >
          Pending Approvals
        </button>
        <button
          type="button"
          onClick={() => setMode("history")}
          className={
            mode === "history"
              ? "rounded-full bg-background px-4 py-2 text-sm font-medium"
              : "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground"
          }
        >
          Approval History
        </button>
      </div>

      {mode === "pending" ? <ApprovalsManagement /> : <ApprovalsHistory />}
    </div>
  );
}
