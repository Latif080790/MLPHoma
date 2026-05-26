/**
 * Skeleton — content placeholder with shimmer animation
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />                  // inline
 *   <SkeletonCard />                                    // card shape
 *   <SkeletonTable rows={5} cols={4} />                 // table rows
 *   <SkeletonKPI />                                     // KPI tile
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Base Skeleton
// ---------------------------------------------------------------------------
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Round pill shape (default: rounded-md) */
  pill?: boolean;
}

export function Skeleton({ className, pill, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading…"
      className={cn(
        "animate-shimmer bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:400%_100%] dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800",
        pill ? "rounded-full" : "rounded-md",
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// KPI Tile skeleton
// ---------------------------------------------------------------------------
export function SkeletonKPI({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card skeleton
// ---------------------------------------------------------------------------
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm space-y-3", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" pill />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" pill />
        <Skeleton className="h-6 w-20 rounded-full" pill />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------
interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  const colWidths = ["w-1/4", "w-1/3", "w-1/5", "w-1/6", "w-1/4"];
  return (
    <div className={cn("space-y-0 overflow-hidden rounded-xl border", className)}>
      {/* Header */}
      <div className="flex gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3.5", colWidths[i % colWidths.length])} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex gap-4 border-b px-4 py-3 last:border-0"
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton
              key={col}
              className={cn("h-3.5", colWidths[(col + row) % colWidths.length])}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List row skeleton
// ---------------------------------------------------------------------------
export function SkeletonListRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 border-b last:border-0", className)}>
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" pill />
    </div>
  );
}
