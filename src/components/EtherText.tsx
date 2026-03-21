"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Alchemical symbols used during scramble
const GLYPHS = "☿🜍🜔🜃🜂🜄🜁☉☽🜏⊕♄∴∵⊛⊜⊝△▽◇◆";

interface EtherTextProps {
  lines: string[];
  /** ms between each line appearing */
  lineDelay?: number;
  /** ms per character during scramble resolve */
  charSpeed?: number;
  /** how many scramble cycles before settling */
  scramblePasses?: number;
  /** called when each new line starts */
  onLineStart?: () => void;
}

interface LineState {
  text: string;
  resolved: number; // how many chars are resolved
  phase: "scrambling" | "visible" | "dissolving" | "gone";
  opacity: number;
}

export default function EtherText({
  lines,
  lineDelay = 4000,
  charSpeed = 45,
  scramblePasses = 3,
  onLineStart,
}: EtherTextProps) {
  const [lineStates, setLineStates] = useState<LineState[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Scramble a single character through random glyphs
  const randomGlyph = useCallback(() => {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }, []);

  // Start revealing the next line
  const startLine = useCallback(
    (idx: number) => {
      if (idx >= lines.length) {
        // Loop back after a pause
        timerRef.current = setTimeout(() => {
          setLineStates([]);
          setCurrentIdx(-1);
          timerRef.current = setTimeout(() => startLine(0), 2000);
        }, 3000);
        return;
      }

      onLineStart?.();
      setCurrentIdx(idx);

      const text = lines[idx];
      const totalChars = text.length;
      const totalTime = totalChars * charSpeed * scramblePasses;

      // Add new line in scrambling state
      setLineStates((prev) => {
        // Fade previous lines
        const updated = prev.map((ls) => ({
          ...ls,
          opacity: Math.max(0.15, ls.opacity - 0.25),
        }));
        return [
          ...updated,
          { text, resolved: 0, phase: "scrambling" as const, opacity: 1 },
        ];
      });

      let charIdx = 0;
      let pass = 0;
      const scrambleInterval = setInterval(() => {
        pass++;
        if (pass >= scramblePasses) {
          charIdx++;
          pass = 0;
          setLineStates((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.resolved = charIdx;
            next[next.length - 1] = last;
            return next;
          });
        }
        // Force re-render for scramble animation
        setLineStates((prev) => [...prev]);

        if (charIdx >= totalChars) {
          clearInterval(scrambleInterval);
          setLineStates((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.phase = "visible";
            last.resolved = totalChars;
            next[next.length - 1] = last;
            return next;
          });
          // Schedule next line
          timerRef.current = setTimeout(() => startLine(idx + 1), lineDelay);
        }
      }, charSpeed);

      return () => clearInterval(scrambleInterval);
    },
    [lines, lineDelay, charSpeed, scramblePasses, onLineStart]
  );

  useEffect(() => {
    // Initial delay before first line
    timerRef.current = setTimeout(() => startLine(0), 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startLine]);

  return (
    <div className="flex flex-col items-center gap-3 min-h-[120px] max-w-lg">
      {lineStates.map((ls, i) => (
        <div
          key={`${i}-${ls.text}`}
          className="font-body text-sm text-center leading-relaxed transition-opacity duration-700"
          style={{
            opacity: ls.opacity,
            textShadow:
              ls.phase === "scrambling"
                ? "0 0 12px rgba(140,230,180,0.6), 0 0 30px rgba(120,200,160,0.3)"
                : "0 0 8px rgba(140,230,180,0.3), 0 0 20px rgba(120,200,160,0.15)",
            color:
              ls.phase === "scrambling"
                ? "rgba(160,240,190,0.95)"
                : "rgba(200,220,210,0.85)",
          }}
        >
          {renderScrambledText(ls, randomGlyph)}
        </div>
      ))}
    </div>
  );
}

function renderScrambledText(
  ls: LineState,
  randomGlyph: () => string
): React.ReactNode {
  if (ls.phase === "visible" || ls.phase === "gone") {
    return ls.text;
  }

  // Scrambling: resolved chars are final, rest are random glyphs
  const chars = ls.text.split("");
  return chars.map((ch, i) => {
    if (i < ls.resolved) return ch;
    if (ch === " ") return " ";
    return (
      <span key={i} style={{ opacity: 0.7 }}>
        {randomGlyph()}
      </span>
    );
  });
}
