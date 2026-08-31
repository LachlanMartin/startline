"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingBag, RefreshCw, Package, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardListSkeleton } from "@/components/ui/skeleton";
import AddOnEditor, { uploadAddOnImages } from "@/components/organiser/AddOnEditor";
import {
  type AddOnDraft,
  draftsFromCatalogue,
  draftsToPayload,
  draftValidationError,
} from "@/lib/add-on-drafts";
import { addOnStockLabel } from "@/lib/add-ons";
import { STOCK_HOLDING_STATUSES } from "@/lib/add-on-stock";

export interface RegistrationAddOnView {
  id: string;
  name: string;
  optionLabel: string;
  variantLabel: string;
  variantId: string;
  quantity: number;
  amountCents: number;
  platformFeeCents: number;
  feeStructure: string;
  status: string;
  refundRequestedAt: string | null;
  refundReason: string | null;
  refundAmountCents: number | null;
  refundDeclinedAt: string | null;
  refundDeclineReason: string | null;
}

export interface AddOnsTabRegistration {
  id: string;
  name: string;
  email: string;
  addOns?: RegistrationAddOnView[];
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const HOLDS: readonly string[] = STOCK_HOLDING_STATUSES;

/**
 * Everything an organiser does with merchandise after the event is live: edit
 * the catalogue, work the refund queue, and read the picking list.
 *
 * The catalogue editor is the same component the event wizard uses, and it saves
 * through the add-ons route, which has no DRAFT lock. That is the point: stock
 * and products change after publication.
 */
export default function AddOnsTab({
  eventId,
  registrations,
  feeStructure,
  onRefetch,
}: {
  eventId: string;
  registrations: AddOnsTabRegistration[];
  feeStructure: "athlete" | "organiser";
  /** Reload the registrations so a decided refund leaves the queue. */
  onRefetch: () => void;
}) {
  const [drafts, setDrafts] = useState<AddOnDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deciding, setDeciding] = useState<string | null>(null);

  const loadCatalogue = useCallback(() => {
    fetch(`/api/organiser/events/${eventId}/add-ons`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load add-ons.");
        setDrafts(draftsFromCatalogue(json.addOns ?? []));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(loadCatalogue, [loadCatalogue]);

  const save = async () => {
    setError("");
    setMessage("");
    const validationError = draftValidationError(drafts);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const withImages = await uploadAddOnImages(drafts);
      setDrafts(withImages);
      const res = await fetch(`/api/organiser/events/${eventId}/add-ons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addOns: draftsToPayload(withImages) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save your add-ons.");
      setDrafts(draftsFromCatalogue(json.addOns ?? []));
      setMessage("Add-ons saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your add-ons.");
    } finally {
      setSaving(false);
    }
  };

  // ── Refund queue ─────────────────────────────────────────────────────────
  const refundQueue = useMemo(
    () =>
      registrations.flatMap((r) =>
        (r.addOns ?? [])
          .filter((a) => a.status === "REFUND_REQUESTED")
          .map((a) => ({ ...a, athleteName: r.name, athleteEmail: r.email })),
      ),
    [registrations],
  );

  const decide = async (itemId: string, decision: "approve" | "decline") => {
    setDeciding(itemId);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/organiser/events/${eventId}/add-ons/refunds/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not record that decision.");
      setMessage(decision === "approve" ? "Refund approved and sent." : "Refund request declined.");
      onRefetch();
      loadCatalogue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that decision.");
    } finally {
      setDeciding(null);
    }
  };

  // ── Picking list ─────────────────────────────────────────────────────────
  // What actually has to be in the van, by option. Refunded items drop out.
  const fulfilment = useMemo(() => {
    const totals = new Map<string, { label: string; units: number; athletes: number }>();
    for (const registration of registrations) {
      for (const addOn of registration.addOns ?? []) {
        if (!HOLDS.includes(addOn.status)) continue;
        const label = addOnStockLabel(addOn.name, addOn.variantLabel);
        const prior = totals.get(addOn.variantId) ?? { label, units: 0, athletes: 0 };
        totals.set(addOn.variantId, {
          label,
          units: prior.units + addOn.quantity,
          athletes: prior.athletes + 1,
        });
      }
    }
    return [...totals.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [registrations]);

  const totalUnits = fulfilment.reduce((sum, row) => sum + row.units, 0);

  if (loading) return <CardListSkeleton />;

  return (
    <>
      {(error || message) && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-[13px] ${
            error ? "bg-red-500/10 text-red-300" : "bg-primary/10 text-primary"
          }`}
        >
          {error || message}
        </div>
      )}

      {/* ── Refund queue ── */}
      <Card className="mb-6">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-1.5">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.5} /> Add-on refund requests
          </div>
          <p className="text-[13px] text-muted leading-relaxed max-w-[640px] mb-4">
            Merchandise refunds are separate from entry refunds and carry no policy percentage.
            Approving one sends the money back straight away and returns the item to stock.
            Declining leaves the purchase exactly as it was.
          </p>

          {refundQueue.length === 0 ? (
            <p className="text-[13px] text-muted-dark">No add-on refund requests right now.</p>
          ) : (
            <div className="space-y-2">
              {refundQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-headline text-[13px] font-bold text-white/90">
                      {item.quantity} x {addOnStockLabel(item.name, item.variantLabel)}
                    </div>
                    <div className="text-[12px] text-muted truncate">
                      {item.athleteName} · {item.athleteEmail}
                      {item.refundReason ? ` · "${item.refundReason}"` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-headline text-[14px] font-bold text-primary tabular-nums">
                      {money(item.refundAmountCents ?? 0)}
                    </span>
                    <Button
                      size="sm"
                      disabled={deciding === item.id}
                      onClick={() => decide(item.id, "approve")}
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deciding === item.id}
                      onClick={() => decide(item.id, "decline")}
                    >
                      <X className="w-3.5 h-3.5" /> Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Picking list ── */}
      <Card className="mb-6">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-1.5">
            <Package className="w-3.5 h-3.5" strokeWidth={2.5} /> What to bring
          </div>
          <p className="text-[13px] text-muted leading-relaxed max-w-[640px] mb-4">
            Everything sold and not refunded, by option. Items with a refund still pending are
            included, because until you decide they are still the athlete&apos;s.
          </p>

          {fulfilment.length === 0 ? (
            <p className="text-[13px] text-muted-dark">Nothing sold yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Item", "Units", "Athletes"].map((h) => (
                      <th
                        key={h}
                        className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark text-left px-3 py-2.5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fulfilment.map((row) => (
                    <tr key={row.label} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2.5 font-headline text-[13.5px] font-bold text-white/90">
                        {row.label}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-light tabular-nums">{row.units}</td>
                      <td className="px-3 py-2.5 text-[13px] text-muted tabular-nums">{row.athletes}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-3 py-2.5 font-headline text-[11px] uppercase tracking-widest text-muted-dark">
                      Total
                    </td>
                    <td className="px-3 py-2.5 font-headline text-[13.5px] font-bold text-primary tabular-nums">
                      {totalUnits}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Catalogue ── */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-1.5">
            <ShoppingBag className="w-3.5 h-3.5" strokeWidth={2.5} /> Merchandise
          </div>
          <p className="text-[13px] text-muted leading-relaxed max-w-[640px] mb-4">
            Add products, restock a size or retire a line at any time, including after your event is
            live. Anything already bought can be retired but not deleted, so orders and receipts stay
            intact. Stock cannot be set below what has already sold.
          </p>

          <AddOnEditor
            addOns={drafts}
            onChange={setDrafts}
            feeStructure={feeStructure}
            disabled={saving}
          />

          <div className="flex justify-end mt-4">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save merchandise"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
