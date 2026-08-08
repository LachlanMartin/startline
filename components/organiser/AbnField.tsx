"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { digitsOnlyAbn, isAbnAcceptableForPaid } from "@/lib/abn";

export type AbnLookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "not_found" }
  | { status: "found"; entityName: string; entityStatus: string; active: boolean };

export { isAbnAcceptableForPaid };

interface AbnFieldProps {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  required?: boolean;
  id?: string;
  /** When true, show the paid-events restriction note */
  showPaidNote?: boolean;
  onLookupChange?: (state: AbnLookupState) => void;
}

export default function AbnField({
  value,
  onChange,
  inputClassName,
  required,
  id = "abn",
  showPaidNote = true,
  onLookupChange,
}: AbnFieldProps) {
  const [lookup, setLookup] = useState<AbnLookupState>({ status: "idle" });

  useEffect(() => {
    onLookupChange?.(lookup);
  }, [lookup, onLookupChange]);

  useEffect(() => {
    const clean = digitsOnlyAbn(value);
    if (clean.length < 9) {
      setLookup({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLookup({ status: "loading" });
      try {
        const res = await fetch(`/api/abn?abn=${encodeURIComponent(clean)}`, {
          signal: controller.signal,
        });
        if (res.status === 503) {
          setLookup({
            status: "unavailable",
            message: "ABN lookup unavailable — enter your ABN and continue. Verification runs when ABR is configured.",
          });
          return;
        }
        if (res.status === 404 || !res.ok) {
          setLookup({ status: "not_found" });
          return;
        }
        const data = (await res.json()) as {
          entityName?: string;
          status?: string;
        };
        const entityStatus = data.status ?? "";
        const active = entityStatus.toLowerCase() === "active";
        setLookup({
          status: "found",
          entityName: data.entityName || "Registered entity",
          entityStatus,
          active,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setLookup({
          status: "unavailable",
          message: "Could not verify ABN right now. You can still save it and try again later.",
        });
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  return (
    <div>
      <label
        htmlFor={id}
        className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light block mb-2"
      >
        ABN {required && <span className="text-red-400">*</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="12 345 678 901"
        className={inputClassName}
      />

      {lookup.status === "loading" && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up ABN…
        </p>
      )}
      {lookup.status === "found" && (
        <p
          className={`mt-1.5 flex items-start gap-1.5 text-[11px] ${
            lookup.active ? "text-primary" : "text-orange-400"
          }`}
        >
          {lookup.active ? (
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          )}
          <span>
            {lookup.entityName}
            {lookup.entityStatus ? ` · ${lookup.entityStatus}` : ""}
          </span>
        </p>
      )}
      {lookup.status === "not_found" && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-orange-400">
          <XCircle className="w-3.5 h-3.5" /> ABN not found in the ABR. Check the number and try again.
        </p>
      )}
      {lookup.status === "unavailable" && (
        <p className="mt-1.5 text-[11px] text-muted-dark">{lookup.message}</p>
      )}

      {showPaidNote && (
        <p className="text-[11px] text-muted-dark mt-1.5">
          Required to host paid events on Startline. Without an ABN you can still list free or external-registration events.
        </p>
      )}
    </div>
  );
}
