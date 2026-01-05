"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from "@/hooks/use-local-storage";

const DEFAULT_PAGE_SIZES = [10, 20, 30, 40, 50];

type PaginationUIProps = {
  selectedCount: number;
  totalCount: number;
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  gotoFirstPage: () => void;
  gotoPreviousPage: () => void;
  gotoNextPage: () => void;
  gotoLastPage: () => void;
  pageSizeOptions?: number[];
};

function PaginationUI({
  selectedCount,
  totalCount,
  pageIndex,
  pageCount,
  pageSize,
  onPageSizeChange,
  canPreviousPage,
  canNextPage,
  gotoFirstPage,
  gotoPreviousPage,
  gotoNextPage,
  gotoLastPage,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: PaginationUIProps) {
  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        {selectedCount} of {totalCount} row(s) selected.
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={gotoFirstPage}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">Go to first page</span>
            <DoubleArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={gotoPreviousPage}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={gotoNextPage}
            disabled={!canNextPage}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={gotoLastPage}
            disabled={!canNextPage}
          >
            <span className="sr-only">Go to last page</span>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DataTablePagination<TData>({
  table,
  storageKey = "data-table-page-size",
  pageSizeOptions,
}: {
  table: Table<TData>;
  storageKey?: string;
  pageSizeOptions?: number[];
}) {
  const [storedPageSize, setStoredPageSize] = useLocalStorage<number>(
    storageKey,
    table.getState().pagination.pageSize
  );

  React.useEffect(() => {
    if (table.getState().pagination.pageSize !== storedPageSize) {
      table.setPageSize(storedPageSize);
    }
  }, [storedPageSize, table]);

  return (
    <PaginationUI
      selectedCount={table.getFilteredSelectedRowModel().rows.length}
      totalCount={table.getFilteredRowModel().rows.length}
      pageIndex={table.getState().pagination.pageIndex}
      pageCount={table.getPageCount()}
      pageSize={table.getState().pagination.pageSize}
      onPageSizeChange={(size) => {
        table.setPageSize(size);
        setStoredPageSize(size);
      }}
      canPreviousPage={table.getCanPreviousPage()}
      canNextPage={table.getCanNextPage()}
      gotoFirstPage={() => table.setPageIndex(0)}
      gotoPreviousPage={() => table.previousPage()}
      gotoNextPage={() => table.nextPage()}
      gotoLastPage={() =>
        table.setPageIndex(Math.max(0, table.getPageCount() - 1))
      }
      pageSizeOptions={pageSizeOptions}
    />
  );
}

export function ServerDataTablePagination({
  totalCount,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  storageKey = "server-data-table-page-size",
  pageSizeOptions,
}: {
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  storageKey?: string;
  pageSizeOptions?: number[];
}) {
  const pageCount = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0;

  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex + 1 < pageCount;

  const [storedPageSize, setStoredPageSize] = useLocalStorage<number>(
    storageKey,
    pageSize
  );

  React.useEffect(() => {
    if (storedPageSize !== pageSize) {
      onPageSizeChange(storedPageSize);
    }
  }, [onPageSizeChange, pageSize, storedPageSize]);

  return (
    <PaginationUI
      selectedCount={0}
      totalCount={totalCount}
      pageIndex={pageIndex}
      pageCount={pageCount}
      pageSize={pageSize}
      onPageSizeChange={(size) => {
        onPageSizeChange(size);
        setStoredPageSize(size);
      }}
      canPreviousPage={canPreviousPage}
      canNextPage={canNextPage}
      gotoFirstPage={() => onPageIndexChange(0)}
      gotoPreviousPage={() => onPageIndexChange(Math.max(0, pageIndex - 1))}
      gotoNextPage={() => onPageIndexChange(pageIndex + 1)}
      gotoLastPage={() => onPageIndexChange(Math.max(0, pageCount - 1))}
      pageSizeOptions={pageSizeOptions}
    />
  );
}
