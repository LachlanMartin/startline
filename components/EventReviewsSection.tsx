import Link from "next/link";
import { CheckCircle, Star } from "lucide-react";
import OrganiserRating from "@/components/OrganiserRating";
import type { OrganiserRating as Rating, PublicReview } from "@/lib/reviews";
import { formatLongDate } from "@/lib/utils";

type Props = {
  organiserId: string;
  organiserName: string;
  rating: Rating | null;
  reviews: PublicReview[];
};

function ReviewStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i <= Math.round(value) ? "text-primary fill-primary" : "text-dark-lighter"
          }`}
        />
      ))}
    </div>
  );
}

/** Display-only organiser reviews under the event gallery. */
export default function EventReviewsSection({
  organiserId,
  organiserName,
  rating,
  reviews,
}: Props) {
  if (!reviews.length || !rating) return null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-1">
            Reviews
          </h2>
          <p className="font-headline text-sm text-muted">
            Reviews for{" "}
            <Link
              href={`/organisers/${organiserId}`}
              className="text-light hover:text-primary transition-colors"
            >
              {organiserName}
            </Link>
          </p>
          <div className="mt-2">
            <OrganiserRating rating={rating} size="md" />
          </div>
        </div>
        <Link
          href={`/organisers/${organiserId}#reviews`}
          className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
        >
          View all on organiser profile &rarr;
        </Link>
      </div>

      <div className="space-y-3">
        {reviews.map((r) => (
          <article
            key={r.id}
            className="bg-dark border border-dark-lighter rounded-xl p-4 sm:p-5 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-headline text-sm font-bold text-light">
                    {r.reviewerName}
                  </span>
                  {r.isVerified && (
                    <span className="inline-flex items-center gap-1 font-headline text-[9px] font-bold uppercase tracking-widest text-primary">
                      <CheckCircle className="w-2.5 h-2.5" /> Verified
                    </span>
                  )}
                </div>
                {r.eventTitle && (
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted mt-0.5">
                    {r.eventTitle}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <ReviewStars value={r.overallRating} />
                <p className="font-headline text-[10px] uppercase tracking-widest text-muted mt-1">
                  {formatLongDate(r.createdAt.slice(0, 10))}
                </p>
              </div>
            </div>
            <h3 className="font-headline text-sm font-bold text-light">{r.title}</h3>
            <p className="text-sm text-muted leading-relaxed line-clamp-4">{r.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
