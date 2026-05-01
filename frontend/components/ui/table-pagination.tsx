"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function TablePagination({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = Math.min((currentPage - 1) * pageSize + 1, totalCount);
  const to = Math.min(currentPage * pageSize, totalCount);

  if (totalCount <= 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4">
      {/* Left: Range + page size selector */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          Mostrando <span className="font-semibold text-foreground">{from}-{to}</span> de{" "}
          <span className="font-semibold text-foreground">{totalCount}</span>
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / pág
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Right: Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
          title="Primera página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
          title="Anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="px-3 text-sm font-medium whitespace-nowrap">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
          title="Siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
          title="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
