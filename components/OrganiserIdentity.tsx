"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import OrganiserRating from "@/components/OrganiserRating";
import type { OrganiserRating as Rating } from "@/lib/reviews";
import { cn } from "@/lib/utils";

type Props = {
  organiserId: string;
  name: string;
  logoUrl?: string | null;
  rating?: Rating | null;
  /** Optional trailing hint beside the rating, e.g. "View profile". */
  action?: string;
  className?: string;
  /**
   * When the parent is already an <a>/<Link>, render a button-styled control
   * instead of a nested link (invalid HTML).
   */
  nestedInLink?: boolean;
};

/**
 * Organiser logo + name + rating, linked to the organiser profile.
 * Shared so event pages and race-history cards present an organiser identically.
 */
export default function OrganiserIdentity({
  organiserId,
  name,
  logoUrl,
  rating,
  action,
  className,
  nestedInLink = false,
}: Props) {
  const router = useRouter();
  const href = `/organisers/${organiserId}`;
  const shellClass = cn(
    "group flex items-center gap-3 -mx-2 px-2 py-2 rounded-lg border border-transparent hover:border-primary/40 hover:bg-white/[0.03] transition-colors text-left",
    className,
  );

  const content = (
    <>
      <span className="relative w-10 h-10 rounded-lg overflow-hidden bg-dark-lighter shrink-0">
        {logoUrl ? (
          <Image src={logoUrl} alt={`${name} logo`} fill className="object-cover" sizes="40px" />
        ) : (
          <span className="w-full h-full flex items-center justify-center font-headline text-base font-black text-primary">
            {name.charAt(0)}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-headline text-base font-black text-light group-hover:text-primary transition-colors leading-tight truncate">
          {name}
        </span>
        {(rating || action) && (
          <span className="flex items-center gap-2 mt-0.5">
            <OrganiserRating rating={rating} />
            {action && (
              <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
                {action}
              </span>
            )}
          </span>
        )}
      </span>
    </>
  );

  if (nestedInLink) {
    return (
      <button
        type="button"
        className={shellClass}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          router.push(href);
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={shellClass}>
      {content}
    </Link>
  );
}
