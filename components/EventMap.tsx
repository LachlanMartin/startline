"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef, useSyncExternalStore } from "react";
import Link from "next/link";
import Map, { type MapRef, Marker, NavigationControl } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ExternalLink } from "lucide-react";
import type { UserEvent } from "@/types";
import { EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatEventDate, formatTime } from "@/lib/utils";
import { eventLngLat } from "@/lib/map-events";

const AUSTRALIA_VIEW = {
  latitude: -25.2744,
  longitude: 133.7751,
  zoom: 3.25,
};

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const mapStyle =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ?? "mapbox://styles/mapbox/dark-v11";

function useIsClient() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

interface EventMapProps {
  events: UserEvent[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
  initialCenter?: { lng: number; lat: number; zoom: number };
}

export interface EventMapHandle {
  flyTo: (id: string) => void;
  fitFilteredBounds: () => void;
  stopSpin: () => void;
}

function EventPinCard({ event, expanded }: { event: UserEvent; expanded: boolean }) {
  return (
    <div className="relative mb-1 pointer-events-auto">
      <div
        className={`rounded-xl border bg-dark shadow-2xl ${
          expanded
            ? "w-[min(18rem,calc(100vw-2rem))] border-primary/40 p-4"
            : "w-52 border-dark-lighter p-3"
        }`}
      >
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
          {EVENT_TYPE_LABELS[event.type]}
        </p>
        <p className="font-headline text-sm font-black italic tracking-tight text-light leading-tight mb-1">
          {event.title}
        </p>
        <p className="font-headline text-[11px] uppercase tracking-widest text-muted">
          {event.city}, {STATE_LABELS[event.state]}
        </p>
        <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-1">
          {formatEventDate(event.date)}
          {expanded && ` · ${formatTime(event.time)}`}
        </p>
        {expanded && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              href={`/events/${event.id}`}
              className="inline-flex items-center gap-2 border border-dark-lighter text-muted font-headline text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl hover:border-primary/50 hover:text-light transition-colors"
            >
              More Info
            </Link>
            {event.registrationUrl && (
              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-machined text-dark font-headline text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl machined-button-shadow"
              >
                Register
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
      <div
        className={`absolute left-1/2 top-full -translate-x-1/2 -mt-px h-2.5 w-2.5 rotate-45 border-r border-b bg-dark ${
          expanded ? "border-primary/40" : "border-dark-lighter"
        }`}
        aria-hidden
      />
    </div>
  );
}

const EventMap = forwardRef<EventMapHandle, EventMapProps>(function EventMap(
  { events, selectedId, onMarkerClick, initialCenter },
  ref,
) {
  const mapRef = useRef<MapRef | null>(null);
  const onMarkerClickRef = useRef(onMarkerClick);
  const hasFramedInitial = useRef(false);
  const lastFlownIdRef = useRef<string | null>(null);
  const filterKeyRef = useRef("");
  const isFirstFit = useRef(true);
  const defaultCenter = useRef(initialCenter ?? { lng: AUSTRALIA_VIEW.longitude, lat: AUSTRALIA_VIEW.latitude, zoom: AUSTRALIA_VIEW.zoom });

  const isClient = useIsClient();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeMapStyle, setActiveMapStyle] = useState(mapStyle);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    if (initialCenter) defaultCenter.current = initialCenter;
  }, [initialCenter]);

  const mapEvents = useMemo(
    () => events.filter((e) => eventLngLat(e) !== null),
    [events],
  );

  const frameMapView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;

    if (selectedId) {
      hasFramedInitial.current = true;
      const event = mapEvents.find((e) => e.id === selectedId);
      const ll = event ? eventLngLat(event) : null;
      if (ll && lastFlownIdRef.current !== selectedId) {
        map.flyTo({ center: [ll.lng, ll.lat], zoom: 11, duration: 900 });
        lastFlownIdRef.current = selectedId;
      }
      return;
    }

    lastFlownIdRef.current = null;
    if (hasFramedInitial.current) return;

    if (mapEvents.length === 0) {
      map.flyTo({
        center: [defaultCenter.current.lng, defaultCenter.current.lat],
        zoom: defaultCenter.current.zoom,
        duration: 900,
      });
      return;
    }

    hasFramedInitial.current = true;

    if (mapEvents.length === 1) {
      const ll = eventLngLat(mapEvents[0]);
      if (!ll) return;
      map.flyTo({ center: [ll.lng, ll.lat], zoom: 11, duration: 900 });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    mapEvents.forEach((event) => {
      const ll = eventLngLat(event);
      if (ll) bounds.extend([ll.lng, ll.lat]);
    });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 100, maxZoom: 10, duration: 900 });
    }
  }, [mapEvents, mapLoaded, selectedId]);

  useImperativeHandle(ref, () => ({
    flyTo(id: string) {
      const event = mapEvents.find((e) => e.id === id);
      const ll = event ? eventLngLat(event) : null;
      const map = mapRef.current?.getMap();
      if (!ll || !map) return;
      map.flyTo({ center: [ll.lng, ll.lat], zoom: 11, duration: 1500 });
      lastFlownIdRef.current = id;
    },
    fitFilteredBounds: frameMapView,
    stopSpin() {
      // Mapbox version has no auto-spin; kept for EventsListing compatibility.
    },
  }));

  useEffect(() => {
    frameMapView();
  }, [frameMapView]);

  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target?.closest(".mapboxgl-marker")) return;
      if (target?.closest(".mapboxgl-ctrl")) return;
      setHoveredId(null);
      onMarkerClickRef.current("");
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [mapLoaded]);

  // Auto-fit bounds when filter results change
  useEffect(() => {
    if (!mapLoaded) return;
    const key = events.map((e) => e.id).join(",");
    if (key === filterKeyRef.current) return;
    filterKeyRef.current = key;

    if (isFirstFit.current) {
      isFirstFit.current = false;
      return;
    }

    hasFramedInitial.current = false;
    frameMapView();
  }, [events, mapLoaded, frameMapView]);

  useEffect(() => {
    if (selectedId || !mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({
      center: [defaultCenter.current.lng, defaultCenter.current.lat],
      zoom: defaultCenter.current.zoom,
      duration: 1200,
    });
  }, [selectedId, mapLoaded]);

  if (!mapboxToken) {
    return (
      <div className="flex h-full items-center justify-center bg-dark" data-testid="events-map">
        <div className="max-w-xl px-8 text-center">
          <p className="font-headline text-sm uppercase tracking-widest text-primary mb-2">
            Mapbox Token Missing
          </p>
          <p className="font-headline text-base text-muted leading-relaxed">
            Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment to enable the interactive map.
          </p>
        </div>
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className="flex h-full items-center justify-center bg-dark" data-testid="events-map">
        <p className="font-headline text-sm uppercase tracking-widest text-muted">Loading map...</p>
      </div>
    );
  }

  if (mapEvents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-dark" data-testid="events-map">
        <p className="font-headline text-sm uppercase tracking-widest text-muted text-center px-8">
          No events to show on the map.
        </p>
      </div>
    );
  }

  const startView = initialCenter
    ? { latitude: initialCenter.lat, longitude: initialCenter.lng, zoom: initialCenter.zoom }
    : AUSTRALIA_VIEW;

  return (
    <div className="relative h-full min-h-[320px]" data-testid="events-map">
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={startView}
        style={{ width: "100%", height: "100%" }}
        mapStyle={activeMapStyle}
        onLoad={() => setMapLoaded(true)}
        onError={() => {
          if (activeMapStyle !== "mapbox://styles/mapbox/dark-v11") {
            setActiveMapStyle("mapbox://styles/mapbox/dark-v11");
          }
        }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {mapLoaded &&
          mapEvents.map((event) => {
            const ll = eventLngLat(event);
            if (!ll) return null;
            const isSelected = selectedId === event.id;
            const isHovered = hoveredId === event.id;
            const showCard = isSelected || isHovered;

            return (
              <Marker key={event.id} longitude={ll.lng} latitude={ll.lat} anchor="bottom">
                <div
                  className="flex flex-col items-center pointer-events-auto"
                  onMouseEnter={() => setHoveredId(event.id)}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === event.id ? null : current))
                  }
                >
                  {showCard && <EventPinCard event={event} expanded={isSelected} />}

                  {showCard && (
                    <div
                      className={`w-0.5 h-3 shrink-0 ${isSelected ? "bg-primary" : "bg-primary/50"}`}
                      aria-hidden
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => onMarkerClick(event.id)}
                    className={`shrink-0 rounded-full border-2 border-white/90 shadow-[0_0_0_2px_rgba(0,0,0,0.35)] transition-all ${
                      isSelected
                        ? "w-5 h-5 bg-primary scale-125 shadow-[0_0_0_4px_rgba(179,225,83,0.35)]"
                        : "w-4 h-4 bg-primary hover:scale-110"
                    }`}
                    aria-label={`View ${event.title}`}
                    aria-pressed={isSelected}
                  />
                </div>
              </Marker>
            );
          })}
      </Map>
    </div>
  );
});

export default EventMap;
