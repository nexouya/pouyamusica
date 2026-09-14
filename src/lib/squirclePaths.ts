/**
 * Unit-square superellipse (n=4) path in objectBoundingBox coordinates.
 * Used as clip-path: url(#squircle-clip)
 */
export const SQUIRCLE_UNIT_PATH = (() => {
  const steps = 64;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    // n=4 → exponent 2/n = 0.5
    const x = 0.5 + 0.5 * Math.sign(c) * Math.pow(Math.abs(c), 0.5);
    const y = 0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), 0.5);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(4)},${y.toFixed(4)}`);
  }
  pts.push("Z");
  return pts.join(" ");
})();

/** Slightly softer squircle for large panels (n≈3.2) */
export const SQUIRCLE_SOFT_PATH = (() => {
  const steps = 64;
  const pts: string[] = [];
  const exp = 2 / 3.4;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = 0.5 + 0.5 * Math.sign(c) * Math.pow(Math.abs(c), exp);
    const y = 0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), exp);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(4)},${y.toFixed(4)}`);
  }
  pts.push("Z");
  return pts.join(" ");
})();
