"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   SELECT MENU
   Native <select> option lists are painted by the OS and ignore the
   dark theme, so every user-facing dropdown uses this popover, which
   mirrors the event-creation date picker.
   ══════════════════════════════════════════════════════════════ */

export interface SelectOption {
  value: string;
  label: string;
  /** Optional second line, e.g. the full state name behind "NSW". */
  hint?: string;
}

const TRIGGER_SIZE = {
  md: "rounded-md px-4 py-3 text-[15px]",
  sm: "rounded-[10px] px-[13px] py-[11px] text-[13.5px]",
} as const;

export interface SelectMenuProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: keyof typeof TRIGGER_SIZE;
  invalid?: boolean;
  ariaLabel?: string;
}

export default function SelectMenu({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  size = "md",
  invalid = false,
  ariaLabel,
}: SelectMenuProps) {
  const [open, setOpen]       = useState(false);
  const [dropUp, setDropUp]   = useState(false);
  const [active, setActive]   = useState(0);
  const ref     = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId  = useId();
  const domId   = id ?? baseId;
  const listId  = `${domId}-listbox`;

  const selected      = options.find(o => o.value === value);
  const selectedIndex = options.findIndex(o => o.value === value);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openMenu = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setDropUp(window.innerHeight - rect.bottom < 280 && rect.top > 280);
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const commit = (v: string) => { onChange(v); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown")      { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === "Home")      { e.preventDefault(); setActive(0); }
    else if (e.key === "End")       { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = options[active];
      if (option) commit(option.value);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "w-full bg-dark-light border font-headline text-left flex items-center justify-between gap-2 transition-colors",
          TRIGGER_SIZE[size],
          invalid
            ? "border-red-500/70"
            : open ? "border-primary" : "border-dark-lighter hover:border-primary/40",
          selected ? "text-light" : "text-muted-dark",
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-dark shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-activedescendant={`${domId}-opt-${active}`}
          className={cn(
            "absolute left-0 z-50 w-full max-h-[240px] overflow-y-auto bg-dark border border-dark-lighter rounded-xl shadow-xl p-1.5 modal-in",
            dropUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                id={`${domId}-opt-${i}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(option.value)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-lg font-headline text-[13px] transition-colors",
                  isSelected ? "text-primary bg-primary/10"
                    : i === active ? "text-light bg-white/5"
                    : "text-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5">{option.hint}</span>
                  )}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
