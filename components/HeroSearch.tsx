"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, MapPin, Locate } from "lucide-react";
import EventAutocomplete from "@/components/ui/EventAutocomplete";
import SuburbAutocomplete from "@/components/ui/SuburbAutocomplete";

export default function HeroSearch() {
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");

  function handleSearch() {
    const params = new URLSearchParams();
    if (what.trim())  params.set("what", what.trim());
    if (where.trim()) params.set("where", where.trim());
    router.push(params.toString() ? `/events?${params.toString()}` : "/events");
  }

  // Geocoding + GPS live in EventsListing; here we just land on the events
  // page with the "Current location" marker and let it prompt for the device.
  function handleLocate() {
    const params = new URLSearchParams();
    if (what.trim()) params.set("what", what.trim());
    params.set("where", "Current location");
    router.push(`/events?${params.toString()}`);
  }

  return (
    <div className="w-full mt-6 sm:mt-10">
      {/* Mobile: stacked inputs + full-width button */}
      <div className="flex flex-col sm:hidden gap-2">
        <div className="bg-dark rounded-2xl px-4 py-3 border border-dark-lighter focus-within:border-primary transition-colors">
          <label className="font-headline text-[10px] font-black uppercase tracking-widest text-primary block mb-1.5">
            Event
          </label>
          <div className="flex items-center gap-2">
            <EventAutocomplete
              value={what}
              onChange={setWhat}
              onEnter={handleSearch}
              placeholder="Event name, type or keyword"
              className="search-field w-full bg-transparent border-0 rounded-none p-0 text-light font-headline text-base placeholder:text-muted/40 focus:outline-none focus:ring-0"
            />
            {what && (
              <button onClick={() => setWhat("")} className="text-muted hover:text-light p-1" aria-label="Clear">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="bg-dark rounded-2xl px-4 py-3 border border-dark-lighter focus-within:border-primary transition-colors flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <label className="font-headline text-[10px] font-black uppercase tracking-widest text-primary block mb-1.5">
              Where
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <SuburbAutocomplete
                  value={where}
                  onChange={setWhere}
                  onSelect={() => {}}
                  onEnter={handleSearch}
                  placeholder="State, city, or suburb"
                  className="search-field w-full bg-transparent border-0 rounded-none p-0 text-light font-headline text-base placeholder:text-muted/40 focus:outline-none focus:ring-0"
                />
              </div>
              {where && (
                <button onClick={() => setWhere("")} className="text-muted hover:text-light p-1" aria-label="Clear">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <button onClick={handleLocate} className="text-muted hover:text-primary flex-shrink-0" aria-label="Use my location" title="Use my location">
            <Locate className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 text-dark font-headline text-sm font-black uppercase tracking-widest h-12 rounded-2xl transition-colors active:scale-[0.98]"
        >
          <Search className="w-4 h-4" />
          Find Events Now
        </button>
      </div>

      {/* Desktop: three rounded bubbles in a row. Each field owns a fully closed
          outline, so a focused field's green ring curves right round and meets
          itself rather than running open into the divider. No overflow-hidden
          wrapper: it would clip each bubble's border mid-curve. */}
      <div className="hidden sm:flex items-stretch gap-2">
        <div className="flex-1 px-6 py-4 min-w-0 bg-dark border border-dark-lighter rounded-3xl focus-within:border-primary transition-colors">
          <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-1.5">
            Event
          </label>
          <div className="flex items-center gap-2">
            <EventAutocomplete
              value={what}
              onChange={setWhat}
              onEnter={handleSearch}
              placeholder="Event name, type or keyword"
              className="search-field w-full bg-transparent border-0 rounded-none p-0 text-light font-headline text-xl placeholder:text-muted/40 focus:outline-none focus:ring-0"
            />
            {what && (
              <button onClick={() => setWhat("")} className="text-muted hover:text-light" aria-label="Clear">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* The locate button is a sibling of the label+input stack, not a child
            of the input row, so it centres against the full height of the field
            instead of sitting on the input's baseline. */}
        <div className="flex-1 px-6 py-4 min-w-0 flex items-center gap-3 bg-dark border border-dark-lighter rounded-3xl focus-within:border-primary transition-colors">
          <div className="flex-1 min-w-0">
            <label className="font-headline text-xs font-black uppercase tracking-widest text-primary block mb-1.5">
              Where
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <SuburbAutocomplete
                  value={where}
                  onChange={setWhere}
                  onSelect={() => {}}
                  onEnter={handleSearch}
                  placeholder="State, city, or suburb"
                  className="search-field w-full bg-transparent border-0 rounded-none p-0 text-light font-headline text-xl placeholder:text-muted/40 focus:outline-none focus:ring-0"
                />
              </div>
              {where && (
                <button onClick={() => setWhere("")} className="text-muted hover:text-light" aria-label="Clear">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <button onClick={handleLocate} className="text-muted hover:text-primary flex-shrink-0" aria-label="Use my location" title="Use my location">
            <Locate className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-dark font-headline text-base font-black uppercase tracking-widest px-10 h-auto rounded-3xl flex-shrink-0 transition-colors active:scale-[0.98] [&_svg]:size-5"
        >
          <Search className="w-5 h-5" />
          Find Events Now
        </button>
      </div>
    </div>
  );
}
