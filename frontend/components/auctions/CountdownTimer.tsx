"use client";

import { useEffect, useState } from "react";

interface Props {
  endsAt: string;
  /** İsteğe bağlı: anti-sniping nedeniyle uzatılan bitiş — varsa öncelikli */
  extendedUntil?: string | null;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function computeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    expired: false,
  };
}

export function CountdownTimer({ endsAt, extendedUntil, className = "" }: Props) {
  const target = new Date(extendedUntil ?? endsAt);
  const [left, setLeft] = useState<TimeLeft>(() => computeLeft(target));

  useEffect(() => {
    const id = setInterval(() => setLeft(computeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (left.expired) {
    return (
      <span className={`eyebrow text-burgundy ${className}`}>Sona erdi</span>
    );
  }

  return (
    <div className={`flex items-baseline gap-3 tabular-nums ${className}`}>
      <Segment value={left.days} label="gün" />
      <Segment value={left.hours} label="saat" />
      <Segment value={left.minutes} label="dakika" />
      <Segment value={left.seconds} label="saniye" subtle />
    </div>
  );
}

function Segment({
  value,
  label,
  subtle,
}: {
  value: number;
  label: string;
  subtle?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`font-display ${
          subtle ? "text-xl text-charcoal-300" : "text-3xl text-charcoal"
        }`}
      >
        {value.toString().padStart(2, "0")}
      </div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}
