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
  /** Linear mode bar height (default 64) */
  height?: number;
};

export function Visualizer({
  mode = "radial",
  size = 280,
  className,
  innerRadius = 70,
  height = 64,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playing = usePlayerStore((s) => s.playing);
  const accentRgb = useUiStore((s) => s.accentRgb);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = size;
    const h = mode === "radial" ? size : height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const display = new Float32Array(32);
    const peak = new Float32Array(32);
    let raf = 0;
    let t0 = performance.now();

    const draw = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;

      ctx.clearRect(0, 0, w, h);

      const liveBands = getAudioVisualBands();
      for (let i = 0; i < 32; i++) {
        const target = playing ? (liveBands[i] ?? 0) : 0;
        display[i] += (target - display[i]) * 0.32;
        peak[i] = Math.max(peak[i] * (1 - dt * 1.8), display[i]);
      }

      const [r, g, b] = accentRgb.split(",").map((n) => parseInt(n.trim(), 10) || 124);

      if (mode === "radial") {
        const cx = w / 2;
        const cy = h / 2;
        const baseR = innerRadius;
        const maxLen = (size / 2 - baseR - 8) * 0.92;

        // soft glow disc
        const grd = ctx.createRadialGradient(cx, cy, baseR * 0.55, cx, cy, baseR + maxLen);
        grd.addColorStop(0, `rgba(${r},${g},${b},0.14)`);
        grd.addColorStop(0.55, `rgba(${r},${g},${b},0.05)`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR + maxLen, 0, Math.PI * 2);
        ctx.fill();

        // mirrored bars for a denser ring
        for (let i = 0; i < 32; i++) {
          const v = Math.max(0.05, display[i]);
          const angle = (i / 32) * Math.PI * 2 - Math.PI / 2;
          const len = 8 + v * maxLen;
          const x1 = cx + Math.cos(angle) * baseR;
          const y1 = cy + Math.sin(angle) * baseR;
          const x2 = cx + Math.cos(angle) * (baseR + len);
          const y2 = cy + Math.sin(angle) * (baseR + len);
          const alpha = 0.22 + v * 0.78;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 3.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // peak cap
          const pLen = 6 + peak[i] * maxLen;
          const px = cx + Math.cos(angle) * (baseR + pLen);
          const py = cy + Math.sin(angle) * (baseR + pLen);
          ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + peak[i] * 0.5})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // thin base ring
        ctx.strokeStyle = `rgba(${r},${g},${b},0.28)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const n = 32;
        const gap = 1.5;
        const bw = (w - gap * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const v = Math.max(0.06, display[i]);
          const bh = v * (h - 6) + 3;
          const x = i * (bw + gap);
          const y = (h - bh) / 2;
          const grad = ctx.createLinearGradient(x, y, x, y + bh);
          grad.addColorStop(0, `rgba(${r},${g},${b},${0.35 + v * 0.65})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},${0.15 + v * 0.35})`);
          ctx.fillStyle = grad;
          roundRect(ctx, x, y, bw, bh, Math.min(bw / 2, 2));
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [mode, size, innerRadius, accentRgb, playing, height]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
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
