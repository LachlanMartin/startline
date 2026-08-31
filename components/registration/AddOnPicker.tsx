"use client";

import Image from "next/image";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_ADDON_QUANTITY } from "@/lib/add-ons";

export interface AddOnVariantOption {
  id: string;
  label: string;
  /** Units left, derived server-side. Caps the stepper. */
  remaining: number;
}

export interface AddOnProduct {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  optionLabel: string;
  variants: AddOnVariantOption[];
}

/** variantId → quantity, for one participant. */
export type AddOnSelection = Record<string, number>;

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const stepperBtnCls =
  "w-[26px] h-[26px] p-0 rounded-full border-2 border-dark-lighter grid place-items-center leading-none text-light hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none";

/**
 * Optional extras for one participant, shown under their details form.
 *
 * Sits per-participant rather than per-order because sizes are inherently per
 * person: the organiser has to know who gets the M. Quantities are capped by the
 * lower of the remaining stock and the per-line limit, so the athlete cannot
 * build a basket that checkout will reject.
 */
export default function AddOnPicker({
  addOns,
  selection,
  onChange,
  athletePaysFee,
  participantLabel,
}: {
  addOns: AddOnProduct[];
  selection: AddOnSelection;
  onChange: (variantId: string, quantity: number) => void;
  /** Drives the fee note only; the server is the authority on the total. */
  athletePaysFee: boolean;
  /** e.g. "Ticket 2". Keeps aria labels unambiguous in a group booking. */
  participantLabel?: string;
}) {
  const sellable = addOns.filter((a) => a.variants.length > 0);
  if (sellable.length === 0) return null;

  const chosenCents = sellable.reduce((sum, addOn) => {
    const units = addOn.variants.reduce((n, v) => n + (selection[v.id] ?? 0), 0);
    return sum + units * addOn.priceCents;
  }, 0);

  return (
    <div className="mt-4 border border-dark-lighter rounded-[14px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-dark-light">
        <div className="font-headline text-[12px] font-bold uppercase tracking-[0.13em] text-light flex items-center gap-2">
          <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Add extras
          <span className="text-muted-dark font-normal normal-case tracking-normal text-[12px]">
            optional
          </span>
        </div>
        {chosenCents > 0 && (
          <div className="font-headline text-[13px] font-bold text-primary tabular-nums">
            {money(chosenCents)}
          </div>
        )}
      </div>

      <div className="divide-y divide-dark-lighter">
        {sellable.map((addOn) => {
          const soldOut = addOn.variants.every((v) => v.remaining <= 0);
          return (
            <div key={addOn.id} className="px-5 py-4">
              <div className="flex gap-3.5">
                {addOn.imageUrl && (
                  <div className="relative w-[64px] h-[64px] rounded-lg overflow-hidden shrink-0 bg-dark-light">
                    <Image
                      src={addOn.imageUrl}
                      alt={addOn.name}
                      fill
                      sizes="64px"
                      className={cn("object-cover", soldOut && "opacity-40")}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-headline text-[14px] font-bold text-light">{addOn.name}</div>
                    <div
                      className={cn(
                        "font-headline text-[15px] font-bold italic tracking-[-0.02em] shrink-0",
                        soldOut ? "text-muted-dark" : "text-primary",
                      )}
                    >
                      {money(addOn.priceCents)}
                    </div>
                  </div>
                  {addOn.description && (
                    <p className="text-[12.5px] leading-[1.5] text-muted mt-1">{addOn.description}</p>
                  )}
                  {soldOut && (
                    <div className="font-headline text-[10px] font-bold uppercase tracking-[0.13em] text-red-400 mt-1.5">
                      Sold out
                    </div>
                  )}
                </div>
              </div>

              {!soldOut && (
                <div className="mt-3">
                  <div className="font-headline text-[10px] uppercase tracking-[0.14em] text-muted-dark mb-2">
                    {addOn.optionLabel}
                  </div>
                  <div className="space-y-1.5">
                    {addOn.variants.map((variant) => {
                      const qty = selection[variant.id] ?? 0;
                      const cap = Math.min(variant.remaining, MAX_ADDON_QUANTITY);
                      const variantSoldOut = variant.remaining <= 0;
                      const who = participantLabel ? `${participantLabel} ` : "";
                      return (
                        <div
                          key={variant.id}
                          className="flex items-center justify-between gap-3 py-1"
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            <span
                              className={cn(
                                "font-headline text-[13px] font-bold",
                                variantSoldOut ? "text-muted-dark line-through" : "text-light",
                              )}
                            >
                              {variant.label}
                            </span>
                            {!variantSoldOut && variant.remaining <= 5 && (
                              <span className="font-headline text-[10px] font-bold uppercase tracking-[0.13em] text-amber-400">
                                Only {variant.remaining} left
                              </span>
                            )}
                            {variantSoldOut && (
                              <span className="font-headline text-[10px] font-bold uppercase tracking-[0.13em] text-red-400">
                                Sold out
                              </span>
                            )}
                          </div>
                          {!variantSoldOut && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                aria-label={`${who}remove one ${addOn.name} ${variant.label}`}
                                onClick={() => onChange(variant.id, Math.max(0, qty - 1))}
                                disabled={qty === 0}
                                className={stepperBtnCls}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span
                                aria-label={`${who}${addOn.name} ${variant.label} quantity`}
                                className={cn(
                                  "w-5 text-center font-headline text-[14px] font-bold tabular-nums",
                                  qty > 0 ? "text-light" : "text-muted-dark",
                                )}
                              >
                                {qty}
                              </span>
                              <button
                                type="button"
                                aria-label={`${who}add one ${addOn.name} ${variant.label}`}
                                onClick={() => onChange(variant.id, Math.min(cap, qty + 1))}
                                disabled={qty >= cap}
                                className={stepperBtnCls}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {athletePaysFee && chosenCents > 0 && (
        <p className="px-5 py-3 bg-dark-light font-headline text-[10px] uppercase tracking-[0.13em] text-muted-dark">
          Booking fee on extras is a percentage only, with no fixed charge.
        </p>
      )}
    </div>
  );
}
