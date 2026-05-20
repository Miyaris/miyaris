"use client";

import { useState } from "react";

import type { WatchImage } from "@/lib/types";

interface Props {
  images: WatchImage[];
  alt: string;
}

export function WatchGallery({ images, alt }: Props) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-ivory-200 flex items-center justify-center text-charcoal-300 eyebrow">
        Görsel yok
      </div>
    );
  }

  const current = images[active];

  return (
    <div>
      <div className="aspect-square bg-ivory-200 mb-4 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={alt}
          className="w-full h-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={`aspect-square overflow-hidden border transition-colors ${
                i === active ? "border-brass" : "border-transparent hover:border-line"
              }`}
              aria-label={`${alt} görsel ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
