import { useEffect, useRef } from "react";
import { usePlayerStore } from "../../stores/playerStore";
import { useUiStore } from "../../stores/uiStore";
import { getAudioVisualBands } from "../../core/events/audioVisualBus";

type Props = {
  mode?: "radial" | "linear";
  size?: number;
  className?: string;
  /** For radial mode: hole radius for album art */
  innerRadius?: number;
};

export function Visualizer({ mode = "radial", size = 280, className, innerRadius = 70 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playing = usePlayerStore((s) => s.playing);
  const accentRgb = useUiStore((s) => s.accentRgb);
  const liteMode = useUiStore((s) => s.liteMode);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, liteMode ? 1 : 2);
    canvas.width = size * dpr;
    canvas.height = (mode === "radial" ? size : 64) * dpr;
    ctx.scale(dpr, dpr);

    const display = new Float32Array(32);
    let raf = 0;
    let lastDraw = 0;

    const draw = (now: number) => {
      // In Lite Mode, throttle to ~30 fps to reduce CPU/GPU cycles
      if (liteMode && now - lastDraw < 33) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastDraw = now;

      const w = size;
      const h = mode === "radial" ? size : 64;
      ctx.clearRect(0, 0, w, h);

      const liveBands = getAudioVisualBands();
      // lerp 0.28 for silky motion
      for (let i = 0; i < 32; i++) {
        const target = playing ? (liveBands[i] ?? 0) : 0;
        display[i] += (target - display[i]) * 0.28;
      }

      const [r, g, b] = accentRgb.split(",").map((n) => parseInt(n.trim(), 10) || 124);

      if (mode === "radial") {
        const cx = w / 2;
        const cy = h / 2;
        const baseR = innerRadius;
        const maxLen = (size / 2 - baseR - 8) * 0.92;

        // In standard mode, render soft glow ring; in Lite Mode, skip expensive radial gradient
        if (!liteMode) {
          const grd = ctx.createRadialGradient(cx, cy, baseR * 0.7, cx, cy, baseR + maxLen);
          grd.addColorStop(0, `rgba(${r},${g},${b},0.08)`);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(cx, cy, baseR + maxLen, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let i = 0; i < 32; i++) {
          const v = Math.max(0.06, display[i]);
          const angle = (i / 32) * Math.PI * 2 - Math.PI / 2;
          const len = 10 + v * maxLen;
          const x1 = cx + Math.cos(angle) * baseR;
          const y1 = cy + Math.sin(angle) * baseR;
          const x2 = cx + Math.cos(angle) * (baseR + len);
          const y2 = cy + Math.sin(angle) * (baseR + len);
          const alpha = liteMode ? 0.8 : 0.25 + v * 0.75;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // thin base ring
        ctx.strokeStyle = `rgba(${r},${g},${b},0.22)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // linear mini bars
        const n = 32;
        const gap = 2;
        const bw = (w - gap * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const v = Math.max(0.08, display[i]);
          const bh = v * (h - 8) + 4;
          const x = i * (bw + gap);
          const y = (h - bh) / 2;
          ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + v * 0.65})`;
          roundRect(ctx, x, y, bw, bh, bw / 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [mode, size, innerRadius, accentRgb, playing, liteMode]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: size,
        height: mode === "radial" ? size : 64,
      }}
      aria-hidden
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
