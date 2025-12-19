"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Log = {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user: { id: string; name: string | null; role: string };
  organization: { id: string; name: string } | null;
  actionTypeDescription?: string;
};

export function ActivityLogsTable() {
  const [organizationId, setOrganizationId] = useState<string | undefined>(
    undefined
  );
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [actionType, setActionType] = useState<string | undefined>(undefined);
  const [start, setStart] = useState<string | undefined>(undefined);
  const [end, setEnd] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery<
    { total: number; logs: Log[] },
    Error,
    { total: number; logs: Log[] }
  >({
    queryKey: [
      "super-admin-activity",
      organizationId,
      userId,
      actionType,
      start,
      end,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      if (userId) params.set("userId", userId);
      if (actionType) params.set("actionType", actionType);
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await apiClient<{ total: number; logs: Log[] }>(
        `/api/super-admin/activity-logs?${params.toString()}`
      );
      return res;
    },
    // keepPreviousData omitted to satisfy project react-query typings
  });

  const logs: Log[] = data?.logs || [];
  const total = data?.total || 0;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Organization ID"
          value={organizationId || ""}
          onChange={(e) => setOrganizationId(e.target.value || undefined)}
        />
        <Input
          placeholder="User ID"
          value={userId || ""}
          onChange={(e) => setUserId(e.target.value || undefined)}
        />
        <Input
          placeholder="Action Type"
          value={actionType || ""}
          onChange={(e) => setActionType(e.target.value || undefined)}
        />
        <Input
          type="date"
          value={start || ""}
          onChange={(e) => setStart(e.target.value || undefined)}
        />
        <Input
          type="date"
          value={end || ""}
          onChange={(e) => setEnd(e.target.value || undefined)}
        />
        <Button onClick={() => setPage(1)}>Apply</Button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-muted-foreground">
          No activity logs found
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Description</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {new Date(l.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{l.user?.name || "-"}</TableCell>
                  <TableCell>{l.user?.role}</TableCell>
                  <TableCell>{l.organization?.name || "-"}</TableCell>
                  <TableCell>{l.actionType}</TableCell>
                  <TableCell>{l.entityType}</TableCell>
                  <TableCell>{l.entityId}</TableCell>
                  <TableCell>{l.actionTypeDescription || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <div>
              Showing {(page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, total)} of {total}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
