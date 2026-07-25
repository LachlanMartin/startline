"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import OrganiserRating from "@/components/OrganiserRating";
import type { OrganiserRating as Rating } from "@/lib/reviews";

type Props = {
  organiserId: string;
  name: string;
  rating?: Rating | null;
  className?: string;
  /** Stop card click handlers when the organiser control is used */
  stopPropagation?: boolean;
  /**
   * When the parent is already an <a>/<Link>, render a button-styled control
   * instead of a nested link (invalid HTML).
   */
  nestedInLink?: boolean;
};

/** Organiser name (linked) with optional star rating beside it. */
export default function OrganiserCardMeta({
  organiserId,
  name,
  rating,
  className,
  stopPropagation = false,
  nestedInLink = false,
}: Props) {
  const router = useRouter();
  const href = `/organisers/${organiserId}`;
  const nameClass =
    "font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors truncate min-w-0 text-left";

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      {nestedInLink ? (
        <button
          type="button"
          className={nameClass}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            router.push(href);
          }}
        >
          {name}
        </button>
      ) : (
        <Link
          href={href}
          onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
          className={nameClass}
        >
          {name}
        </Link>
      )}
      <OrganiserRating rating={rating} />
    </div>
  );
}
