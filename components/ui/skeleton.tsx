import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pulsing block used to build content-fetch skeletons. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded bg-dark-lighter", className)}
      aria-hidden
      {...props}
    />
  );
}

/** Eyebrow + title + subtitle, optional action pills on the right. */
export function PageHeaderSkeleton({
  actions = 2,
  className,
}: {
  actions?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8", className)}>
      <div className="space-y-3">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-9 w-64 sm:w-80" />
        <Skeleton className="h-3 w-40" />
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Table-shaped rows for admin / organiser list panels. */
export function TableSkeleton({
  rows = 6,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("p-4 space-y-3", className)} role="status" aria-label="Loading">
      <div className="flex gap-3 pb-2 border-b border-white/5">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className={cn("h-3", i === 0 ? "w-32 flex-1" : "w-20")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3 py-1">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton
              key={c}
              className={cn("h-4", c === 0 ? "w-36 flex-1" : "w-16", c === cols - 1 && "w-20")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Stacked cards for listings / registration grids. */
export function CardListSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border border-dark-lighter rounded-xl overflow-hidden bg-dark">
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16 hidden sm:block" />
              <Skeleton className="h-4 w-28 hidden md:block" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full shrink-0" />
          </div>
          <div className="border-t border-white/5 px-3 py-2 space-y-2">
            <Skeleton className="h-9 w-full rounded-lg opacity-80" />
            <Skeleton className="h-9 w-full rounded-lg opacity-60" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-page shell used while a route's primary data is fetching. */
export function PageShellSkeleton({
  children,
  maxWidth = "max-w-[1240px]",
  className,
}: {
  children?: ReactNode;
  maxWidth?: string;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-dark-darker">
      <main className={cn(maxWidth, "mx-auto px-4 sm:px-6 pt-20 pb-16", className)}>
        {children ?? (
          <>
            <Skeleton className="h-3 w-28 mb-6" />
            <PageHeaderSkeleton />
            <Skeleton className="h-14 w-full rounded-2xl mb-6" />
            <div className="bg-dark border border-dark-lighter rounded-2xl p-4 sm:p-5">
              <CardListSkeleton />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
