"use client";

import { useState, useEffect, useRef } from "react";
import { usePortrait } from "@/lib/portrait-context";
import LifespanBar from "./LifespanBar";

interface ShockMomentProps {
  years: number;
  onComplete?: () => void;
}

/**
 * Cinematic lifespan reveal:
 * 1. Screen darkens, portrait glitches violently
 * 2. Number counts down from 94 to the actual value
 * 3. LifespanBar slams in
 * 4. Everything settles
 */
export default function ShockMoment({ years, onComplete }: ShockMomentProps) {
  const portraitRef = usePortrait();
  const [phase, setPhase] = useState<"glitch" | "counting" | "reveal" | "settle">("glitch");
  const [displayYears, setDisplayYears] = useState(94);
  const [opacity, setOpacity] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Phase 1: Violent glitch (0-2s)
  useEffect(() => {
    setOpacity(1);

    // Hammer the portrait with disturb calls
    const glitchInterval = setInterval(() => {
      portraitRef?.current?.disturb();
    }, 150);

    const timer1 = setTimeout(() => {
      clearInterval(glitchInterval);
      setPhase("counting");
    }, 2000);

    return () => {
      clearInterval(glitchInterval);
      clearTimeout(timer1);
    };
  }, [portraitRef]);

  // Phase 2: Number counts down from 94 to actual (2-4s)
  useEffect(() => {
    if (phase !== "counting") return;

    let current = 94;
    const step = (94 - years) / 40; // 40 steps over ~2 seconds
    intervalRef.current = setInterval(() => {
      current -= step;
      if (current <= years) {
        current = years;
        clearInterval(intervalRef.current);
        // One final hard disturb
        portraitRef?.current?.disturb();
        setPhase("reveal");
      }
      setDisplayYears(Math.round(current * 10) / 10);
    }, 50);

    return () => clearInterval(intervalRef.current);
  }, [phase, years, portraitRef]);

  // Phase 3: Reveal with LifespanBar (4-6s)
  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = setTimeout(() => {
      setPhase("settle");
      onComplete?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase, onComplete]);

  return (
    <div
      className="w-full max-w-xl space-y-6 transition-opacity duration-700"
      style={{ opacity }}
    >
      {/* The number */}
      <div className="text-center">
        <div
          className="font-heading font-black tracking-wider transition-all duration-300"
          style={{
            fontSize: phase === "glitch" ? "0px" : phase === "counting" ? "64px" : "72px",
            color: phase === "settle" ? "rgba(140,230,180,0.9)" : "#ff6b1a",
            textShadow:
              phase === "counting"
                ? "0 0 30px rgba(255,107,26,0.6), 0 0 60px rgba(255,107,26,0.3)"
                : phase === "reveal" || phase === "settle"
                  ? "0 0 20px rgba(140,230,180,0.5), 0 0 40px rgba(140,230,180,0.2)"
                  : "none",
            transform: phase === "counting" ? `translateX(${(Math.random() - 0.5) * 4}px)` : "none",
          }}
        >
          {phase !== "glitch" && `${displayYears}`}
        </div>
        {phase !== "glitch" && (
          <div
            className="font-heading text-[13px] uppercase tracking-[0.2em] mt-1 transition-opacity duration-500"
            style={{
              color: "var(--muted)",
              opacity: phase === "counting" ? 0.4 : 0.8,
            }}
          >
            projected years
          </div>
        )}
      </div>

      {/* Glitch overlay — screen noise during phase 1 */}
      {phase === "glitch" && (
        <div
          className="fixed inset-0 pointer-events-none z-50"
          style={{
            background: "rgba(0,0,0,0.3)",
            animation: "shock-flicker 100ms infinite",
          }}
        />
      )}

      {/* LifespanBar appears on reveal */}
      {(phase === "reveal" || phase === "settle") && (
        <div
          className="transition-opacity duration-1000"
          style={{ opacity: phase === "settle" ? 1 : 0.8 }}
        >
          <LifespanBar years={years} animate={true} />
        </div>
      )}

      <style jsx>{`
        @keyframes shock-flicker {
          0% { opacity: 0.3; }
          25% { opacity: 0.1; }
          50% { opacity: 0.4; }
          75% { opacity: 0.05; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
