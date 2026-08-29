"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SLIDES = [
  { url: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1920&q=80", alt: "Runners racing" },
  { url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80", alt: "CrossFit competition" },
  { url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920&q=80", alt: "Fitness athletes" },
  { url: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1920&q=80", alt: "Road race" },
  { url: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1920&q=80", alt: "Fitness race event" },
];

const INTERVAL_MS = 5000;
const FADE_MS = 1000;

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % SLIDES.length);
        setFading(false);
      }, FADE_MS);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {SLIDES.map((slide, i) => (
        <Image
          key={slide.url}
          src={slide.url}
          alt={slide.alt}
          fill
          className="object-cover"
          style={{
            opacity: i === current ? (fading ? 0 : 1) : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
            filter: "grayscale(40%) brightness(0.45)",
          }}
          sizes="100vw"
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-dark-darker/90 via-dark-darker/60 to-dark-darker/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-transparent to-dark-darker/40" />
    </div>
  );
}
