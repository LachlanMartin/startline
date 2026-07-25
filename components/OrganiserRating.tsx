import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganiserRating as Rating } from "@/lib/reviews";

type Props = {
  rating: Rating | null | undefined;
  className?: string;
  /** Slightly denser chip for event cards */
  size?: "sm" | "md";
};

/** Minimal star + average + (count). Returns null when there are no reviews. */
export default function OrganiserRating({ rating, className, size = "sm" }: Props) {
  if (!rating || rating.count <= 0) return null;

  const starClass = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  const textClass =
    size === "md"
      ? "font-headline text-xs font-bold"
      : "font-headline text-[10px] font-bold";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-light shrink-0",
        textClass,
        className
      )}
      aria-label={`Rated ${rating.average.toFixed(1)} out of 5 from ${rating.count} reviews`}
    >
      <Star className={cn(starClass, "text-primary fill-primary shrink-0")} />
      <span>{rating.average.toFixed(1)}</span>
      <span className="font-normal text-muted">({rating.count})</span>
    </span>
  );
}
