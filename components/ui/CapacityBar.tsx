import { cn } from "@/lib/utils";

/** Design.md capacity gauge: &lt;70% green · 70–89% amber · ≥90% red. */
export function capacityBarColor(pct: number): string {
  if (pct >= 90) return "bg-red-400";
  if (pct >= 70) return "bg-amber-400";
  return "bg-primary";
}

export default function CapacityBar({
  count,
  cap,
  className,
  label,
}: {
  count: number;
  cap: number | null | undefined;
  className?: string;
  label?: string;
}) {
  if (cap == null || cap <= 0) return null;
  const pct = Math.min(100, Math.round((count / cap) * 100));
  return (
    <div
      className={cn(
        "h-1.5 rounded-full bg-dark-lighter overflow-hidden",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${pct}% full`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${capacityBarColor(pct)}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
