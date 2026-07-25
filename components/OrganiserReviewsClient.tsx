"use client";

import { useCallback, useState } from "react";
import ReviewsSection, { type Review, type ReviewEventOption } from "@/components/organiser/ReviewsSection";
import type { PublicReview } from "@/lib/reviews";

type Props = {
  organiserId: string;
  initialReviews: PublicReview[];
  events: ReviewEventOption[];
  readOnly?: boolean;
};

export default function OrganiserReviewsClient({
  organiserId,
  initialReviews,
  events,
  readOnly = false,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);

  const onNewReview = useCallback((r: Review) => {
    setReviews((prev) => [r, ...prev]);
  }, []);

  return (
    <div className="mt-10">
      <ReviewsSection
        reviews={reviews}
        organiserId={organiserId}
        events={events}
        loading={false}
        onNewReview={onNewReview}
        readOnly={readOnly}
      />
    </div>
  );
}
