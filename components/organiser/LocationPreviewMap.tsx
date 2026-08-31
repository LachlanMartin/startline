"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Map, { type MapRef, Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const mapStyle =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ?? "mapbox://styles/mapbox/dark-v11";

function useIsClient() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

interface Props {
  latitude: number | null;
  longitude: number | null;
  label?: string;
  className?: string;
}

function hasValidCoords(latitude: number | null, longitude: number | null): boolean {
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

export default function LocationPreviewMap({
  latitude,
  longitude,
  label,
  className = "",
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const isClient = useIsClient();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeMapStyle, setActiveMapStyle] = useState(mapStyle);

  const hasCoords = hasValidCoords(latitude, longitude);

  useEffect(() => {
    if (!hasCoords || !mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({
      center: [longitude!, latitude!],
      zoom: 14,
      duration: 800,
    });
  }, [latitude, longitude, hasCoords, mapLoaded]);

  const containerClass = `relative overflow-hidden rounded-xl border border-dark-lighter bg-dark min-h-[220px] ${className}`;

  // Empty state first — before an address is selected there's nothing to
  // show on a map, so this renders regardless of the Mapbox token.
  if (!hasCoords) {
    return (
      <div className={containerClass} data-testid="location-preview-empty">
        <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 px-6 text-center">
          <MapPin className="w-5 h-5 text-light" />
          <p className="font-headline text-[11px] uppercase tracking-widest text-light">
            Select an address above to preview the location
          </p>
        </div>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className={containerClass}>
        <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center">
          <p className="font-headline text-[11px] uppercase tracking-widest text-light">
            Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to preview the map
          </p>
        </div>
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className={containerClass}>
        <div className="flex h-full min-h-[220px] items-center justify-center">
          <p className="font-headline text-[11px] uppercase tracking-widest text-light">
            Loading map...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass} data-testid="location-preview-map">
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          latitude: latitude!,
          longitude: longitude!,
          zoom: 14,
        }}
        style={{ width: "100%", height: "100%", minHeight: 220 }}
        mapStyle={activeMapStyle}
        onLoad={() => setMapLoaded(true)}
        onError={() => {
          if (activeMapStyle !== "mapbox://styles/mapbox/dark-v11") {
            setActiveMapStyle("mapbox://styles/mapbox/dark-v11");
          }
        }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Marker longitude={longitude!} latitude={latitude!} anchor="bottom">
          <div className="flex flex-col items-center pointer-events-none">
            {label && (
              <div className="mb-1 max-w-[14rem] rounded-lg border border-dark-lighter bg-dark px-3 py-2 shadow-md">
                <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">
                  Event location
                </p>
                <p className="font-headline text-xs font-bold text-light leading-tight">
                  {label}
                </p>
              </div>
            )}
            <div className="h-3 w-0.5 bg-primary" aria-hidden />
            <div
              className="h-4 w-4 rounded-full border-2 border-dark bg-primary shadow-md"
              aria-hidden
            />
          </div>
        </Marker>
      </Map>
    </div>
  );
}
