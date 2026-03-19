"use client";

import { useEffect, useState } from "react";

interface LifespanBarProps {
  years: number;
  maxYears?: number;
  animate?: boolean;
  showLabels?: boolean;
}

function getBarColor(years: number): string {
  if (years < 50) return "#ef4444"; // red
  if (years < 60) return "#f97316"; // orange
  if (years < 70) return "#eab308"; // yellow
  if (years < 80) return "#84cc16"; // lime
  if (years < 85) return "#22c55e"; // green
  return "#10b981"; // emerald
}

function getBarGradient(years: number): string {
  const color = getBarColor(years);
  return `linear-gradient(90deg, ${color}dd, ${color})`;
}

export default function LifespanBar({
  years,
  maxYears = 94,
  animate = true,
  showLabels = true,
}: LifespanBarProps) {
  const [displayYears, setDisplayYears] = useState(animate ? 0 : years);
  const [prevYears, setPrevYears] = useState(years);
  const percentage = Math.min((displayYears / maxYears) * 100, 100);

  useEffect(() => {
    if (!animate) {
      setDisplayYears(years);
      return;
    }

    const start = prevYears;
    const end = years;
    const duration = Math.abs(end - start) > 10 ? 2000 : 1000;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplayYears(current);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    setPrevYears(years);
  }, [years, animate]); // eslint-disable-line react-hooks/exhaustive-deps

  const decades = [0, 20, 40, 60, 80, maxYears];

  return (
    <div className="w-full space-y-2">
      {showLabels && (
        <div className="flex items-baseline justify-between">
          <span className="font-heading text-xs tracking-widest text-muted uppercase">
            Projected Lifespan
          </span>
          <span
            className="font-heading text-2xl font-bold tabular-nums"
            style={{ color: getBarColor(displayYears) }}
          >
            {displayYears.toFixed(1)}
            <span className="text-sm text-muted ml-1">/ {maxYears} yrs</span>
          </span>
        </div>
      )}

      <div className="relative h-10 rounded-full bg-surface-light border border-white/5 overflow-hidden">
        {/* Filled bar */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            background: getBarGradient(displayYears),
            boxShadow: `0 0 20px ${getBarColor(displayYears)}40`,
          }}
        />

        {/* Skull indicator at the edge */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 text-xl drop-shadow-lg transition-all"
          style={{ left: `${percentage}%` }}
        >
          &#x2620;
        </div>

        {/* Empty space pattern (lost years) */}
        <div
          className="absolute inset-y-0 right-0 opacity-20"
          style={{
            left: `${percentage}%`,
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)",
          }}
        />
      </div>

      {/* Decade markers */}
      {showLabels && (
        <div className="relative h-4">
          {decades.map((d) => (
            <span
              key={d}
              className="absolute text-[10px] text-muted -translate-x-1/2 font-body"
              style={{ left: `${(d / maxYears) * 100}%` }}
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
