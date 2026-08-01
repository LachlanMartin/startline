"use client";

import { useState, useEffect, Suspense, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Star, Eye, EyeOff, BadgeCheck, Trash2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

type Filter = "all" | "published" | "hidden";

interface ReviewRow {
  id: string;
  overallRating: number;
  atmosphereRating: number | null;
  organisationRating: number | null;
  experienceRating: number | null;
  title: string;
  body: string;
  reviewerName: string;
  eventTitle: string | null;
  isVerified: boolean;
  isPublished: boolean;
  createdAt: string;
  organiser: { id: string; orgName: string | null; email: string };
}

const TABS: { filter: Filter; label: string }[] = [
  { filter: "all",       label: "All"       },
  { filter: "published", label: "Published" },
  { filter: "hidden",    label: "Hidden"    },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-dark-lighter"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  onChanged,
  onDeleted,
}: {
  review: ReviewRow;
  onChanged: (r: ReviewRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const organiserName = review.organiser.orgName || review.organiser.email;

  const patch = async (data: { isPublished?: boolean; isVerified?: boolean }) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json() as { isPublished: boolean; isVerified: boolean };
        onChanged({ ...review, ...updated });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this review permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(review.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`border-b border-white/[0.06] last:border-0 px-5 py-4 ${!review.isPublished ? "bg-white/[0.02]" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
            <Stars value={review.overallRating} />
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-light">
              {review.title}
            </span>
            {review.isVerified && (
              <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
                <BadgeCheck className="w-3.5 h-3.5" /> Verified
              </span>
            )}
            {!review.isPublished && (
              <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
                <EyeOff className="w-3.5 h-3.5" /> Hidden
              </span>
            )}
          </div>

          <p className="text-[14px] text-muted leading-relaxed mb-2">{review.body}</p>

          <div className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">
            {review.reviewerName}
            {review.eventTitle && <span className="text-dark-lighter"> · {review.eventTitle}</span>}
            <span className="text-dark-lighter"> · for {organiserName}</span>
            <span className="text-dark-lighter"> · {formatDate(review.createdAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => patch({ isPublished: !review.isPublished })}
            disabled={busy}
            title={review.isPublished ? "Hide review" : "Publish review"}
            className="flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest border border-dark-lighter text-muted px-2.5 py-2 rounded-md hover:bg-dark-light hover:text-light transition-colors disabled:opacity-40"
          >
            {review.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {review.isPublished ? "Hide" : "Publish"}
          </button>
          <button
            onClick={() => patch({ isVerified: !review.isVerified })}
            disabled={busy}
            title={review.isVerified ? "Remove verification" : "Mark verified"}
            className={`flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest border px-2.5 py-2 rounded-md transition-colors disabled:opacity-40
              ${review.isVerified
                ? "border-primary/40 text-primary hover:bg-primary/10"
                : "border-dark-lighter text-muted hover:bg-dark-light hover:text-light"
              }`}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            {review.isVerified ? "Verified" : "Verify"}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            title="Delete review"
            className="p-2 text-muted-dark hover:text-red-400 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminReviewsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const filterParam  = (searchParams.get("filter") ?? "all").toLowerCase() as Filter;
  const activeFilter = TABS.find((t) => t.filter === filterParam)?.filter ?? "all";

  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const loading = reviews === null;

  const fetchReviews = (filter: Filter) => {
    fetch(`/api/admin/reviews?filter=${filter}`)
      .then(r => r.json())
      .then(data => { setReviews(Array.isArray(data) ? data : []); });
  };

  useEffect(() => {
    startTransition(() => fetchReviews(activeFilter));
  }, [activeFilter]);

  const switchFilter = (filter: Filter) => {
    router.push(`/admin/reviews?filter=${filter}`, { scroll: false });
  };

  const handleChanged = (updated: ReviewRow) => {
    setReviews((prev) =>
      activeFilter === "all"
        ? (prev ?? []).map((r) => (r.id === updated.id ? updated : r))
        : (prev ?? []).filter((r) =>
            activeFilter === "published" ? updated.isPublished : !updated.isPublished,
          ),
    );
  };

  const handleDeleted = (id: string) => {
    setReviews((prev) => (prev ?? []).filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-dark-darker">


      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-light">
                Reviews.
              </h1>
            </div>
            <button
              onClick={() => fetchReviews(activeFilter)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-dark-lighter">
            {TABS.map(({ filter, label }) => (
              <button
                key={filter}
                onClick={() => switchFilter(filter)}
                className={`font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 border-b-2 transition-colors -mb-px
                  ${activeFilter === filter
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-light"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {loading && <TableSkeleton rows={6} cols={4} className="p-6" />}

            {!loading && reviews.length === 0 && (
              <div className="p-12 text-center">
                <div className="font-headline text-lg font-black italic text-light mb-1">No reviews</div>
                <div className="text-muted text-sm">
                  {activeFilter === "all" ? "No reviews have been submitted yet." : `No ${activeFilter} reviews.`}
                </div>
              </div>
            )}

            {!loading && reviews.map((r) => (
              <ReviewCard key={r.id} review={r} onChanged={handleChanged} onDeleted={handleDeleted} />
            ))}
          </Card>

          {!loading && reviews.length > 0 && (
            <div className="mt-4 font-headline text-[12px] uppercase tracking-widest text-muted text-right">
              {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminReviewsPage() {
  return (
    <Suspense>
      <AdminReviewsContent />
    </Suspense>
  );
}
