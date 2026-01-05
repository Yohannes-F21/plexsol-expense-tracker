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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Files } from "lucide-react";
import { ServerDataTablePagination } from "@/components/data-table-pagination";

type Log = {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  previousValue: any;
  newValue: any;
  createdAt: string;
  user: { id: string; name: string | null; role: string };
  organization: { id: string; name: string } | null;
  actionTypeDescription?: string;
};

type ChangeRow = {
  field: string;
  previous: string;
  updated: string;
};

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function toDisplayValue(v: unknown) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function toTitleCase(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function getChanges(previousValue: unknown, newValue: unknown): ChangeRow[] {
  const prevObj = isPlainObject(previousValue) ? previousValue : undefined;
  const nextObj = isPlainObject(newValue) ? newValue : undefined;

  if (!prevObj && !nextObj) {
    const prev = toDisplayValue(previousValue);
    const next = toDisplayValue(newValue);
    if (prev === next) return [];
    return [{ field: "Value", previous: prev, updated: next }];
  }

  const keys = new Set<string>([
    ...Object.keys(prevObj ?? {}),
    ...Object.keys(nextObj ?? {}),
  ]);

  const rows: ChangeRow[] = [];
  for (const key of Array.from(keys).sort()) {
    const prev = toDisplayValue(prevObj ? prevObj[key] : undefined);
    const next = toDisplayValue(nextObj ? nextObj[key] : undefined);
    if (prev !== next) {
      rows.push({ field: toTitleCase(key), previous: prev, updated: next });
    }
  }
  return rows;
}

function DetailsDialog({ log }: { log: Log }) {
  const [open, setOpen] = useState(false);
  const changes = getChanges(log.previousValue, log.newValue);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Files className="h-4 w-4" />
      </Button>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Transaction Update Log</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          Found {changes.length} change{changes.length === 1 ? "" : "s"}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Previous Value</TableHead>
              <TableHead>Updated Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No field changes captured
                </TableCell>
              </TableRow>
            ) : (
              changes.map((c) => (
                <TableRow key={c.field}>
                  <TableCell className="font-medium">{c.field}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.previous}
                  </TableCell>
                  <TableCell className="text-green-600">{c.updated}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

export function ActivityLogsTable() {
  const [organizationId, setOrganizationId] = useState<string | undefined>(
    undefined
  );
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [actionType, setActionType] = useState<string | undefined>(undefined);
  const [start, setStart] = useState<string | undefined>(undefined);
  const [end, setEnd] = useState<string | undefined>(undefined);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

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
      pageIndex,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      if (userId) params.set("userId", userId);
      if (actionType) params.set("actionType", actionType);
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      params.set("page", String(pageIndex + 1));
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
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-2">
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
          <Button onClick={() => setPageIndex(0)}>Apply</Button>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-muted-foreground">
            No activity logs found
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
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
                      <TableCell>
                        <DetailsDialog log={l} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ServerDataTablePagination
              totalCount={total}
              pageIndex={pageIndex}
              pageSize={pageSize}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPageIndex(0);
              }}
              storageKey="super-admin-activity-logs-page-size"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
