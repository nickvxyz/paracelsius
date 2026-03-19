"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

export interface CRTPortraitHandle {
  disturb: () => void;
}

const SHELL_W = 520;
const SHELL_H = 540;
const CIRCLE_PAD = 20; // space around shell for the circle
const OUTER_W = SHELL_W + CIRCLE_PAD * 2;
const OUTER_H = SHELL_H + CIRCLE_PAD * 2;

// Alchemical symbols: Mercury ☿, Sulfur 🜍, Salt 🜔, Earth 🜃, Fire 🜂, Water 🜄, Air 🜁, Gold ☉, Silver ☽, Phosphorus 🜏
const ALCH_SYMBOLS = ["☿", "🜍", "🜔", "🜃", "🜂", "🜄", "🜁", "☉", "☽", "🜏", "⊕", "♄"];

const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Mouth region (mapped from cropped paracelsus.png 1024x1066 → 520x550)
const MOUTH = { x: 215, y: 205, w: 105, h: 30 };

// ── Cycle phases ─────────────────────────────────────────────────
type Phase = "PRESENT" | "DECAY" | "HEAVY" | "RECOVER";

interface CycleTiming {
  present: number;
  decay: number;
  heavy: number;
  recover: number;
}

// Shorter cycles — effects appear frequently
function randomCycle(): CycleTiming {
  const roll = Math.random();

  if (roll < 0.15) {
    // Deep signal loss
    return {
      present: rand(800, 2000),
      decay: rand(400, 1000),
      heavy: rand(800, 2000),
      recover: rand(600, 1500),
    };
  } else if (roll < 0.4) {
    // Quick flicker
    return {
      present: rand(1500, 4000),
      decay: rand(100, 400),
      heavy: rand(80, 300),
      recover: rand(150, 500),
    };
  } else if (roll < 0.7) {
    // Medium disruption
    return {
      present: rand(1000, 3000),
      decay: rand(300, 800),
      heavy: rand(200, 800),
      recover: rand(400, 1000),
    };
  } else {
    // Short stable, brief interference
    return {
      present: rand(2000, 5000),
      decay: rand(200, 600),
      heavy: rand(100, 600),
      recover: rand(300, 800),
    };
  }
}

function firstCycle(): CycleTiming {
  return { present: 0, decay: 0, heavy: 1800, recover: 3600 };
}

const CRTPortrait = forwardRef<CRTPortraitHandle>(function CRTPortrait(
  _props,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGSVGElement>(null);

  const stateRef = useRef({
    startTime: null as number | null,
    img: null as HTMLImageElement | null,
    imgLoaded: false,
    freezeUntil: 0,
    lastFlickerTime: 0,
    flickerOpacity: 0,
    jx: 0,
    jy: 0,
    animId: 0,
    cycle: firstCycle(),
    cycleStart: 0,
    isFirstCycle: true,
    disturbance: 0,
    // Speaking state: true while typing indicator is visible
    isSpeaking: false,
    speakStart: 0,
    // Micro-glitch state
    microGlitchUntil: 0,
    microGlitchIntensity: 0,
  });

  useImperativeHandle(ref, () => ({
    disturb() {
      const s = stateRef.current;
      s.disturbance = Math.min(1, s.disturbance + rand(0.5, 0.85));
      s.isSpeaking = true;
      s.speakStart = performance.now();
    },
  }));

  // ── Drawing helpers ────────────────────────────────────────────

  const drawPortrait = useCallback(
    (ctx: CanvasRenderingContext2D, pixelSize: number, alpha: number) => {
      const s = stateRef.current;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (!s.imgLoaded || !s.img) {
        ctx.clearRect(0, 0, SHELL_W, SHELL_H);
        ctx.fillStyle = "#444";
        ctx.font = "14px monospace";
        ctx.fillText("NO SIGNAL", SHELL_W / 2 - 38, SHELL_H / 2);
        ctx.restore();
        return;
      }
      // Contain-fit: preserve aspect ratio, center in shell
      const imgW = s.img.naturalWidth;
      const imgH = s.img.naturalHeight;
      const scale = Math.min(SHELL_W / imgW, SHELL_H / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = (SHELL_W - dw) / 2;
      const dy = (SHELL_H - dh) / 2;

      if (pixelSize <= 1) {
        ctx.drawImage(s.img, dx, dy, dw, dh);
      } else {
        const pw = Math.max(1, Math.floor(dw / pixelSize));
        const ph = Math.max(1, Math.floor(dh / pixelSize));
        const tmp = document.createElement("canvas");
        tmp.width = pw;
        tmp.height = ph;
        tmp.getContext("2d")!.drawImage(s.img, 0, 0, pw, ph);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, dx, dy, dw, dh);
      }
      ctx.restore();
    },
    []
  );

  // ── Lip movement: pixel displacement in mouth region ───────────
  const animateLips = useCallback(
    (ctx: CanvasRenderingContext2D, now: number, intensity: number) => {
      if (intensity < 0.05) return;

      // Grab mouth region pixels
      const mx = MOUTH.x;
      const my = MOUTH.y;
      const mw = MOUTH.w;
      const mh = MOUTH.h;

      const mouthData = ctx.getImageData(mx, my, mw, mh);
      const output = ctx.createImageData(mw, mh);

      // Multiple sine waves at different frequencies = organic movement
      const t = now * 0.001;
      const wave1 = Math.sin(t * 4.2) * intensity;
      const wave2 = Math.sin(t * 7.1 + 1.2) * intensity * 0.7;
      const wave3 = Math.sin(t * 2.5 + 2.8) * intensity * 0.5;

      for (let y = 0; y < mh; y++) {
        // Displacement is strongest at vertical center of mouth (lips)
        const centerDist = Math.abs(y - mh * 0.45) / (mh * 0.5);
        const falloff = Math.max(0, 1 - centerDist * centerDist);

        // Vertical displacement: lips open/close
        const dyRaw =
          (wave1 * 5 + wave2 * 3 + wave3 * 2) * falloff;
        // Upper lip moves up, lower lip moves down (split at center)
        const direction = y < mh * 0.45 ? -1 : 1;
        const dy = dyRaw * direction;

        // Slight horizontal wobble
        const dx = Math.sin(t * 6.5 + y * 0.15) * intensity * 2.0 * falloff;

        for (let x = 0; x < mw; x++) {
          // Horizontal falloff: less displacement at edges
          const hCenter = Math.abs(x - mw * 0.5) / (mw * 0.5);
          const hFalloff = Math.max(0, 1 - hCenter * hCenter);

          const srcX = Math.round(clamp(x - dx * hFalloff, 0, mw - 1));
          const srcY = Math.round(clamp(y - dy * hFalloff, 0, mh - 1));

          const si = (srcY * mw + srcX) * 4;
          const di = (y * mw + x) * 4;
          output.data[di] = mouthData.data[si];
          output.data[di + 1] = mouthData.data[si + 1];
          output.data[di + 2] = mouthData.data[si + 2];
          output.data[di + 3] = mouthData.data[si + 3];
        }
      }

      ctx.putImageData(output, mx, my);
    },
    []
  );

  const drawRGBSplit = useCallback(
    (ctx: CanvasRenderingContext2D, offset: number, alpha: number) => {
      const s = stateRef.current;
      if (!s.imgLoaded || !s.img || alpha < 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      // Contain-fit for RGB split
      const imgW = s.img.naturalWidth;
      const imgH = s.img.naturalHeight;
      const scale = Math.min(SHELL_W / imgW, SHELL_H / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = (SHELL_W - dw) / 2;
      const dy = (SHELL_H - dh) / 2;

      const tmpR = document.createElement("canvas");
      tmpR.width = SHELL_W;
      tmpR.height = SHELL_H;
      const rCtx = tmpR.getContext("2d")!;
      rCtx.drawImage(s.img, dx, dy, dw, dh);
      rCtx.globalCompositeOperation = "multiply";
      rCtx.fillStyle = "rgb(255,0,0)";
      rCtx.fillRect(0, 0, SHELL_W, SHELL_H);
      ctx.globalAlpha = alpha * 0.6;
      ctx.drawImage(tmpR, -offset, -offset * 0.4, SHELL_W, SHELL_H);

      const tmpB = document.createElement("canvas");
      tmpB.width = SHELL_W;
      tmpB.height = SHELL_H;
      const bCtx = tmpB.getContext("2d")!;
      bCtx.drawImage(s.img, dx, dy, dw, dh);
      bCtx.globalCompositeOperation = "multiply";
      bCtx.fillStyle = "rgb(0,0,255)";
      bCtx.fillRect(0, 0, SHELL_W, SHELL_H);
      ctx.globalAlpha = alpha * 0.6;
      ctx.drawImage(tmpB, offset, offset * 0.4, SHELL_W, SHELL_H);

      ctx.restore();
    },
    []
  );

  const applyGlitchSlices = useCallback(
    (ctx: CanvasRenderingContext2D, intensity: number) => {
      const s = stateRef.current;
      if (intensity < 0.05 || !s.imgLoaded) return;
      const snap = ctx.getImageData(0, 0, SHELL_W, SHELL_H);
      const tmp = document.createElement("canvas");
      tmp.width = SHELL_W;
      tmp.height = SHELL_H;
      tmp.getContext("2d")!.putImageData(snap, 0, 0);
      const count = Math.floor(intensity * 10);
      for (let i = 0; i < count; i++) {
        if (Math.random() > intensity) continue;
        const sy = Math.floor(rand(0, SHELL_H - 20));
        const sh = Math.floor(rand(2, 22));
        const dx = Math.floor(rand(-50, 50) * intensity);
        ctx.drawImage(tmp, 0, sy, SHELL_W, sh, dx, sy, SHELL_W, sh);
      }
    },
    []
  );

  const drawNoise = useCallback((ctx: CanvasRenderingContext2D, opacity: number) => {
    if (opacity < 0.01) return;
    const s = stateRef.current;
    if (!s.imgLoaded || !s.img) return;
    // Draw noise into a temp canvas, then mask it to portrait silhouette
    const tmp = document.createElement("canvas");
    tmp.width = SHELL_W;
    tmp.height = SHELL_H;
    const tCtx = tmp.getContext("2d")!;
    const id = tCtx.createImageData(SHELL_W, SHELL_H);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (rand(0, 255) | 0);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = (rand(0, 190) | 0);
    }
    tCtx.putImageData(id, 0, 0);
    // Mask to portrait alpha
    const imgW = s.img.naturalWidth;
    const imgH = s.img.naturalHeight;
    const scale = Math.min(SHELL_W / imgW, SHELL_H / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const dx = (SHELL_W - dw) / 2;
    const dy = (SHELL_H - dh) / 2;
    tCtx.globalCompositeOperation = "destination-in";
    tCtx.drawImage(s.img, dx, dy, dw, dh);
    // Blend onto main canvas
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }, []);

  const applyJitter = useCallback((intensity: number) => {
    const s = stateRef.current;
    const shell = shellRef.current;
    if (!shell) return;
    if (intensity > 0.1 && Math.random() < intensity * 0.35) {
      s.jx = rand(-3, 3) * intensity;
      s.jy = rand(-1.5, 1.5) * intensity;
    } else {
      s.jx *= 0.55;
      s.jy *= 0.55;
    }
    shell.style.transform = `translate(${s.jx.toFixed(1)}px,${s.jy.toFixed(1)}px)`;
  }, []);

  const updateCircle = useCallback((now: number, intensity: number) => {
    const svg = circleRef.current;
    if (!svg) return;
    // Slow base rotation + jitter during interference
    const baseAngle = now * 0.008; // ~0.5 RPM
    const jitter = intensity > 0.1 ? Math.sin(now * 0.05) * intensity * 15 : 0;
    const angle = baseAngle + jitter;
    svg.style.transform = `rotate(${angle}deg)`;
    // Glow intensity
    const baseGlow = 0.35 + Math.sin(now * 0.0015) * 0.1;
    const glowOpacity = clamp(baseGlow + intensity * 0.6, 0.25, 1);
    svg.style.opacity = String(glowOpacity);
    // Filter: stronger glow during interference
    const blur = 2 + intensity * 6;
    svg.style.filter = `drop-shadow(0 0 ${blur}px rgba(120,200,160,${glowOpacity * 0.8})) drop-shadow(0 0 ${blur * 2}px rgba(80,160,120,${glowOpacity * 0.4}))`;
  }, []);

  // ── Main loop ──────────────────────────────────────────────────

  useEffect(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    canvas.width = SHELL_W;
    canvas.height = SHELL_H;

    const img = new Image();
    s.img = img;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      s.imgLoaded = true;
      s.startTime = performance.now();
      s.cycleStart = s.startTime;
      s.animId = requestAnimationFrame(loop);
    };
    img.onerror = () => {
      s.startTime = performance.now();
      s.cycleStart = s.startTime;
      s.animId = requestAnimationFrame(loop);
    };
    img.src = "/nobg1.png";

    function getCycleState(now: number): { phase: Phase; t: number } {
      const c = s.cycle;
      const elapsed = now - s.cycleStart;
      const totalCycle = c.present + c.decay + c.heavy + c.recover;

      if (elapsed >= totalCycle) {
        s.cycle = randomCycle();
        s.cycleStart = now;
        s.isFirstCycle = false;
        return { phase: "PRESENT", t: 0 };
      }

      let cursor = 0;

      cursor += c.present;
      if (elapsed < cursor) {
        return {
          phase: "PRESENT",
          t: c.present > 0 ? (elapsed - (cursor - c.present)) / c.present : 0,
        };
      }

      cursor += c.decay;
      if (elapsed < cursor) {
        return {
          phase: "DECAY",
          t: (elapsed - (cursor - c.decay)) / c.decay,
        };
      }

      cursor += c.heavy;
      if (elapsed < cursor) {
        return {
          phase: "HEAVY",
          t: (elapsed - (cursor - c.heavy)) / c.heavy,
        };
      }

      return {
        phase: "RECOVER",
        t: (elapsed - cursor) / c.recover,
      };
    }

    function loop(now: number) {
      if (!s.startTime) s.startTime = now;

      const { phase, t } = getCycleState(now);

      // Decay disturbance
      s.disturbance *= 0.985;
      if (s.disturbance < 0.01) s.disturbance = 0;

      // Speaking fades after 3 seconds of no new disturb
      if (s.isSpeaking && now - s.speakStart > 3000) {
        s.isSpeaking = false;
      }

      const dist = s.disturbance;

      // Micro-glitches during PRESENT — random brief single-frame disruptions
      if (
        phase === "PRESENT" &&
        dist < 0.1 &&
        now > s.microGlitchUntil
      ) {
        if (Math.random() < 0.008) {
          s.microGlitchUntil = now + rand(30, 150);
          s.microGlitchIntensity = rand(0.15, 0.5);
        }
      }
      const inMicroGlitch = now < s.microGlitchUntil;
      const microGlitch = inMicroGlitch ? s.microGlitchIntensity : 0;

      // Interference level
      const interferenceLevel =
        phase === "HEAVY"
          ? 1
          : phase === "DECAY"
            ? easeIn(t)
            : phase === "RECOVER"
              ? 1 - easeOut(t)
              : 0;

      const totalInterference = clamp(
        interferenceLevel + dist + microGlitch,
        0,
        1
      );

      // Freeze frame
      if (
        totalInterference > 0.4 &&
        Math.random() < 0.007 * totalInterference
      ) {
        s.freezeUntil = now + rand(50, 200);
      }
      if (now < s.freezeUntil) {
        s.animId = requestAnimationFrame(loop);
        return;
      }

      // Clear (transparent, not black — lets page bg show through)
      ctx.clearRect(0, 0, SHELL_W, SHELL_H);

      let pixelSize: number,
        alpha: number,
        rgbOff: number,
        rgbA: number,
        glitch: number,
        noise: number,
        flicker: number;

      const breathe = Math.sin(now * 0.0007) * 0.012;

      if (phase === "PRESENT") {
        const mg = microGlitch;
        pixelSize =
          dist > 0.3
            ? clamp(Math.floor(dist * 12), 1, 8)
            : mg > 0.3
              ? clamp(Math.floor(mg * 6), 1, 4)
              : 1;
        alpha = clamp(1 - dist * 0.3 - mg * 0.2, 0.6, 1);
        rgbOff = 0.6 + dist * 8 + mg * 5;
        rgbA = 0.035 + breathe + dist * 0.5 + mg * 0.4;
        glitch = dist * 0.6 + mg * 0.5;
        noise = 0.025 + Math.abs(breathe) + dist * 0.3 + mg * 0.25;
        flicker = 0.015 + dist * 0.5 + mg * 0.3;
      } else if (phase === "DECAY") {
        const d = easeIn(t);
        pixelSize = clamp(Math.floor(lerp(1, 24, d + dist * 0.5)), 1, 32);
        alpha = clamp(lerp(1, 0.2, d), 0.15, 1);
        rgbOff = lerp(0.6, 12, d);
        rgbA = lerp(0.04, 0.75, d);
        glitch = lerp(0, 0.85, d);
        noise = lerp(0.03, 0.55, d);
        flicker = lerp(0.02, 0.8, d);
      } else if (phase === "HEAVY") {
        const wave = Math.sin(now * 0.003) * 0.5 + 0.5;
        pixelSize = clamp(Math.floor(rand(10, 30)), 8, 32);
        alpha = clamp(rand(0.1, 0.4), 0.1, 0.5);
        rgbOff = rand(6, 14);
        rgbA = clamp(0.6 + wave * 0.25, 0.4, 0.9);
        glitch = clamp(0.6 + wave * 0.35, 0.4, 1);
        noise = clamp(0.45 + wave * 0.2, 0.3, 0.7);
        flicker = 0.85;
      } else {
        // RECOVER
        const r = easeOut(t);
        pixelSize = clamp(Math.floor(lerp(18, 1, r)), 1, 24);
        alpha = clamp(lerp(0.25, 1, r), 0.2, 1);
        rgbOff = lerp(10, 0.6, r);
        rgbA = lerp(0.7, 0.04, r);
        glitch = lerp(0.7, 0, r);
        noise = lerp(0.5, 0.025, r);
        flicker = lerp(0.7, 0.02, r);
      }

      // Speech disturbance additive
      if (dist > 0.01 && phase !== "PRESENT") {
        glitch = clamp(glitch + dist * 0.3, 0, 1);
        noise = clamp(noise + dist * 0.15, 0, 0.8);
        rgbOff = clamp(rgbOff + dist * 4, 0, 16);
      }

      drawPortrait(ctx, pixelSize, alpha);
      drawRGBSplit(ctx, rgbOff, rgbA);
      applyGlitchSlices(ctx, glitch);

      // Mask everything drawn so far to the portrait's alpha silhouette
      if (s.imgLoaded && s.img) {
        const imgW = s.img.naturalWidth;
        const imgH = s.img.naturalHeight;
        const sc = Math.min(SHELL_W / imgW, SHELL_H / imgH);
        const ddw = imgW * sc;
        const ddh = imgH * sc;
        const ddx = (SHELL_W - ddw) / 2;
        const ddy = (SHELL_H - ddh) / 2;
        ctx.save();
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(s.img, ddx, ddy, ddw, ddh);
        ctx.restore();
      }

      // Noise (already silhouette-masked internally)
      drawNoise(ctx, noise);

      // Scanlines drawn on canvas (masked to silhouette)
      if (s.imgLoaded && s.img) {
        const scanOpacity = clamp(0.28 + totalInterference * 0.55, 0.28, 0.85);
        ctx.save();
        ctx.globalAlpha = scanOpacity * 0.18;
        ctx.globalCompositeOperation = "multiply";
        for (let sy = 0; sy < SHELL_H; sy += 4) {
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.fillRect(0, sy + 2, SHELL_W, 2);
        }
        // Re-mask to silhouette
        const imgW = s.img.naturalWidth;
        const imgH = s.img.naturalHeight;
        const sc = Math.min(SHELL_W / imgW, SHELL_H / imgH);
        ctx.globalCompositeOperation = "destination-in";
        ctx.globalAlpha = 1;
        ctx.drawImage(s.img, (SHELL_W - imgW * sc) / 2, (SHELL_H - imgH * sc) / 2, imgW * sc, imgH * sc);
        ctx.restore();
      }

      applyJitter(totalInterference);
      updateCircle(now, totalInterference);

      s.animId = requestAnimationFrame(loop);
    }

    const fallbackTimer = setTimeout(() => {
      if (!s.startTime) {
        s.startTime = performance.now();
        s.cycleStart = s.startTime;
        s.animId = requestAnimationFrame(loop);
      }
    }, 2500);

    return () => {
      clearTimeout(fallbackTimer);
      cancelAnimationFrame(s.animId);
    };
  }, [
    drawPortrait,
    animateLips,
    drawRGBSplit,
    applyGlitchSlices,
    drawNoise,
    applyJitter,
    updateCircle,
  ]);

  // Build the summoning circle SVG: elliptical ring with alchemical symbols
  const cx = OUTER_W / 2;
  const cy = OUTER_H / 2;
  // Tight to the actual rendered image (~360x540 inside 520x540 shell)
  const rx = 195; // snug horizontal
  const ry = SHELL_H / 2 + 10; // snug vertical

  return (
    <div
      className="relative"
      style={{ width: OUTER_W, height: OUTER_H }}
    >
      {/* Summoning circle — rotates behind the portrait */}
      <svg
        ref={circleRef}
        className="absolute inset-0 pointer-events-none"
        width={OUTER_W}
        height={OUTER_H}
        style={{ zIndex: 0, opacity: 0.35, transition: "opacity 0.3s" }}
      >
        {/* Outer ring */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke="rgba(140,230,180,0.7)"
          strokeWidth="2.5"
        />
        {/* Middle ring */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx - 8}
          ry={ry - 8}
          fill="none"
          stroke="rgba(140,230,180,0.35)"
          strokeWidth="1.2"
        />
        {/* Inner ring — dashed */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx - 16}
          ry={ry - 16}
          fill="none"
          stroke="rgba(140,230,180,0.45)"
          strokeWidth="1"
          strokeDasharray="8 5"
        />
        {/* Alchemical symbols placed around the ellipse */}
        {ALCH_SYMBOLS.map((sym, i) => {
          const angle = (i / ALCH_SYMBOLS.length) * Math.PI * 2 - Math.PI / 2;
          const sx = Math.round((cx + Math.cos(angle) * (rx - 6)) * 100) / 100;
          const sy = Math.round((cy + Math.sin(angle) * (ry - 6)) * 100) / 100;
          return (
            <text
              key={i}
              x={sx}
              y={sy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(160,240,190,0.85)"
              fontSize="16"
              fontFamily="serif"
              fontWeight="bold"
            >
              {sym}
            </text>
          );
        })}
        {/* Cross lines at cardinal points */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => {
          const ix = Math.round((cx + Math.cos(angle) * (rx - 18)) * 100) / 100;
          const iy = Math.round((cy + Math.sin(angle) * (ry - 18)) * 100) / 100;
          const ox = Math.round((cx + Math.cos(angle) * (rx + 4)) * 100) / 100;
          const oy = Math.round((cy + Math.sin(angle) * (ry + 4)) * 100) / 100;
          return (
            <line
              key={`tick-${i}`}
              x1={ix}
              y1={iy}
              x2={ox}
              y2={oy}
              stroke="rgba(140,230,180,0.6)"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      {/* CRT portrait shell */}
      <div
        ref={shellRef}
        className="absolute"
        style={{
          width: SHELL_W,
          height: SHELL_H,
          left: CIRCLE_PAD,
          top: CIRCLE_PAD,
          zIndex: 1,
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    </div>
  );
});

export default CRTPortrait;
