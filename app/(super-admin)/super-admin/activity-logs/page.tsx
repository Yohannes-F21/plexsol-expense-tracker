import React from "react";
import { QueryProvider } from "@/lib/query-provider";
import { ActivityLogsTable } from "@/components/super-admin/activity-logs-table";

export default function SuperAdminActivityLogsPage() {
  return (
    <QueryProvider>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Activity Logs</h1>
        <ActivityLogsTable />
      </div>
    </QueryProvider>
  );
}
