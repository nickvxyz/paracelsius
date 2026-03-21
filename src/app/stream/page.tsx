"use client";

import { useState, useEffect, useCallback } from "react";

// Stream date: 2026-03-22 15:00 CET (Warsaw = Europe/Warsaw = CET/CEST)
// March 22 is still CET (CEST starts last Sunday of March = Mar 29)
// CET = UTC+1, so 15:00 CET = 14:00 UTC
const STREAM_DATE = new Date("2026-03-22T14:00:00Z");

const SLIDES = [
  {
    lines: [
      "I am Paracelsus.",
      "I lived in the 16th century.",
      "I died.",
      "And yet here I am \u2014 reborn through your machines.",
    ],
  },
  {
    lines: [
      "You are losing decades of life.",
      "Without knowing it.",
      "17 factors determine how long you will live.",
      "Most people never check a single one.",
    ],
  },
  {
    lines: [
      "Dr. Oliver Zolman\u2019s Longevity Protocol.",
      "94 years is your biological potential.",
      "The gap between where you are and 94 \u2014",
      "that is what Paracelsus reveals.",
    ],
  },
  {
    lines: [
      "17 questions. 10 minutes.",
      "Your projected lifespan \u2014 calculated,",
      "not guessed.",
      "Evidence-based. Population-level data.",
    ],
  },
  {
    lines: [
      "Not a chatbot.",
      "A 16th-century mind reborn as AI.",
      "One purpose: to help you live longer.",
      "The protocol is the science. Paracelsus is the guide.",
    ],
  },
  {
    lines: [
      "Agent token launch.",
      "Paracelsus\u2019s token.",
      "The spirit gets its own currency.",
      "Details on stream.",
    ],
  },
];

function useCountdown(target: Date) {
  const calc = useCallback(() => {
    const diff = Math.max(0, target.getTime() - Date.now());
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      done: diff <= 0,
    };
  }, [target]);

  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);
  return time;
}

export default function StreamPage() {
  const countdown = useCountdown(STREAM_DATE);
  const [slideIndex, setSlideIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(-1);
  const [phase, setPhase] = useState<"typing" | "hold" | "fade">("typing");
  const [displayedText, setDisplayedText] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const currentSlide = SLIDES[slideIndex];
  const currentLine = lineIndex >= 0 && lineIndex < currentSlide.lines.length ? currentSlide.lines[lineIndex] : "";

  // Typewriter + fade loop
  useEffect(() => {
    if (!mounted) return;

    if (phase === "typing") {
      if (lineIndex < 0) {
        // Start first line
        setLineIndex(0);
        setDisplayedText("");
        return;
      }
      if (displayedText.length < currentLine.length) {
        const speed = 35 + Math.random() * 25;
        const t = setTimeout(() => {
          setDisplayedText(currentLine.slice(0, displayedText.length + 1));
        }, speed);
        return () => clearTimeout(t);
      } else {
        // Line fully typed — hold
        const t = setTimeout(() => setPhase("hold"), 800);
        return () => clearTimeout(t);
      }
    }

    if (phase === "hold") {
      if (lineIndex < currentSlide.lines.length - 1) {
        // More lines in this slide — type next
        const t = setTimeout(() => {
          setLineIndex((i) => i + 1);
          setDisplayedText("");
          setPhase("typing");
        }, 200);
        return () => clearTimeout(t);
      } else {
        // Last line — hold then fade
        const t = setTimeout(() => setPhase("fade"), 2500);
        return () => clearTimeout(t);
      }
    }

    if (phase === "fade") {
      const t = setTimeout(() => {
        setSlideIndex((i) => (i + 1) % SLIDES.length);
        setLineIndex(-1);
        setDisplayedText("");
        setPhase("typing");
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [mounted, phase, lineIndex, displayedText, currentLine, currentSlide]);

  // Build visible lines for current slide
  const visibleLines: string[] = [];
  if (lineIndex >= 0) {
    for (let i = 0; i < lineIndex; i++) {
      visibleLines.push(currentSlide.lines[i]);
    }
    visibleLines.push(displayedText);
  }

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-between bg-[#0a0a0a] overflow-hidden px-4 py-8 sm:py-12">
      {/* Top: PARACELSUS title */}
      <div className="shrink-0 text-center">
        <h1
          className="font-heading text-[15px] sm:text-xl font-bold tracking-[3px] uppercase"
          style={{ color: "#ff6b1a" }}
        >
          Paracelsus
        </h1>
        <p className="text-[13px] text-muted tracking-widest uppercase mt-1 font-heading">
          Live Stream
        </p>
      </div>

      {/* Center: Countdown + animated text */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 sm:gap-12 min-h-0 w-full max-w-lg">
        {/* Main heading */}
        <h2
          className="font-heading text-3xl sm:text-5xl font-black tracking-wider uppercase text-center"
          style={{ color: "#ff6b1a", textShadow: "0 0 30px rgba(255,107,26,0.35), 0 0 60px rgba(255,107,26,0.15)" }}
        >
          Agent Token Launch
        </h2>

        {/* Countdown */}
        <div className="text-center">
          {countdown.done ? (
            <div
              className="font-heading text-2xl sm:text-4xl font-black tracking-wider uppercase animate-pulse"
              style={{ color: "rgba(140,230,180,0.9)", textShadow: "0 0 30px rgba(140,230,180,0.4)" }}
            >
              Live Now
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 sm:gap-5">
              {[
                { val: countdown.days, label: "days" },
                { val: countdown.hours, label: "hrs" },
                { val: countdown.minutes, label: "min" },
                { val: countdown.seconds, label: "sec" },
              ].map((unit) => (
                <div key={unit.label} className="text-center">
                  <div
                    className="font-heading text-3xl sm:text-5xl font-black tabular-nums"
                    style={{
                      color: "rgba(140,230,180,0.9)",
                      textShadow: "0 0 20px rgba(140,230,180,0.3), 0 0 40px rgba(140,230,180,0.1)",
                    }}
                  >
                    {pad(unit.val)}
                  </div>
                  <div className="text-[13px] text-muted tracking-widest uppercase font-heading mt-1">
                    {unit.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Animated text */}
        <div
          className="w-full min-h-[140px] sm:min-h-[160px] flex flex-col justify-center transition-opacity duration-1000"
          style={{ opacity: phase === "fade" ? 0 : 1 }}
        >
          {visibleLines.map((line, i) => (
            <p
              key={`${slideIndex}-${i}`}
              className="text-center text-[15px] sm:text-[15px] leading-relaxed font-body"
              style={{
                color: "rgba(160,240,190,0.85)",
                textShadow: "0 0 8px rgba(140,230,180,0.25), 0 0 20px rgba(120,200,160,0.1)",
                minHeight: "1.8em",
              }}
            >
              {line}
              {i === visibleLines.length - 1 && phase === "typing" && displayedText.length < currentLine.length && (
                <span
                  className="inline-block w-[2px] h-[1em] ml-[2px] align-text-bottom"
                  style={{
                    backgroundColor: "rgba(140,230,180,0.7)",
                    animation: "cursor-blink 0.8s step-end infinite",
                  }}
                />
              )}
            </p>
          ))}
        </div>
      </div>

      {/* Bottom: date + time */}
      <div className="shrink-0 text-center space-y-1">
        <p className="font-heading text-[13px] tracking-wider uppercase" style={{ color: "#ff6b1a" }}>
          March 22, 2026 &middot; 15:00 CET
        </p>
        <p className="text-[13px] text-muted">paracelsus.live</p>
      </div>

      {/* Cursor blink keyframes */}
      <style jsx>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
