"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon, X, Play } from "lucide-react";

interface Props {
  photos:       string[];
  isOrganiser?: boolean;
  onUpload?:    (file: File) => void;
  uploading?:   boolean;
}

function isVideo(src: string) {
  return /\.(mp4|webm|mov|avi|ogv)(\?.*)?$/i.test(src);
}

export default function PhotoCarousel({ photos, isOrganiser, onUpload, uploading }: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
  };

  if (!photos.length && !isOrganiser) return null;

  return (
    <>
      <div className="relative group/photos">
        {/* Nav arrows */}
        {photos.length > 4 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-all opacity-0 group-hover/photos:opacity-100 shadow-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-all opacity-0 group-hover/photos:opacity-100 shadow-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {photos.length === 0 ? (
          /* Empty state — only shown to organiser */
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
            <ImageIcon className="w-8 h-8 text-gray-300" />
            <div>
              <div className="font-headline text-[13px] font-bold text-gray-900">No photos or videos yet</div>
              <div className="text-[12px] text-gray-400 mt-0.5">Add photos and videos from your past events to showcase your work.</div>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="font-headline text-[11px] font-bold uppercase tracking-widest bg-lime-400 text-gray-900 px-4 py-2 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload photo / video"}
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f && onUpload) onUpload(f); }} />
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {photos.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightbox(src)}
                className="relative flex-none w-[320px] h-[220px] rounded-lg overflow-hidden border border-dark-lighter hover:border-primary/50 transition-all group/photo card-hover"
              >
                {isVideo(src) ? (
                  <>
                    <video
                      src={src}
                      className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/photo:bg-black/30 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                        <Play className="w-5 h-5 text-gray-900 ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <Image
                    src={src}
                    alt={`Photo ${i + 1}`}
                    fill
                    className="object-cover group-hover/photo:scale-105 transition-transform duration-300"
                    sizes="320px"
                  />
                )}
              </button>
            ))}

            {/* Upload more — organiser only */}
            {isOrganiser && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex-none w-[320px] h-[220px] rounded-lg border border-dashed border-gray-200 hover:border-lime-400 flex flex-col items-center justify-center gap-2 transition-colors group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 group-hover:bg-lime-50 flex items-center justify-center transition-colors">
                    <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-lime-600 transition-colors" />
                  </div>
                  <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-lime-600 transition-colors">
                    {uploading ? "Uploading…" : "Add photo / video"}
                  </span>
                </button>
                <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f && onUpload) onUpload(f); }} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-dark-darker/95 backdrop-blur-sm flex items-center justify-center p-4 overlay-in"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          {isVideo(lightbox) ? (
            <video
              src={lightbox}
              controls
              autoPlay
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <Image
              src={lightbox}
              alt="Event photo"
              fill
              unoptimized
              className="object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  );
}
