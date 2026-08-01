"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type FormSelectOption = { value: string; label: string };

/** Dark-themed select so open menus match the UI (native <select> uses OS chrome). */
export default function FormSelect({
  id,
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  placement = "bottom",
  className = "",
  triggerClassName = "",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  "aria-label"?: string;
  /** Open the menu above the trigger (e.g. sticky bottom bars). */
  placement?: "bottom" | "top";
  className?: string;
  /** Extra classes merged onto the trigger button. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-dark border rounded-lg px-3 py-2.5 text-[14px] text-light text-left focus:outline-none ${
          open ? "border-primary" : "border-dark-lighter focus:border-primary"
        } ${triggerClassName}`}
      >
        <span className="truncate">{selected?.label ?? "-"}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className={`absolute z-50 w-full max-h-56 overflow-auto rounded-lg border border-dark-lighter bg-dark py-1 shadow-lg ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value || "__empty__"} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-[14px] transition-colors ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-light hover:bg-white/[0.06]"
                  }`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
