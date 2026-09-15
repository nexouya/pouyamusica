/**
 * Superellipse (squircle) path generation with n=4.
 * Produces an SVG path string suitable for clip-path: path("...")
 */
export function superellipsePath(
  width: number,
  height: number,
  radius: number,
  n = 4,
  steps = 64,
): string {
  const a = Math.max(width / 2 - 0.5, 0.5);
  const b = Math.max(height / 2 - 0.5, 0.5);
  const cx = width / 2;
  const cy = height / 2;
  // Map radius (0..min(a,b)) to superellipse "sharpness" via scaled axes.
  // Use a rounded superellipse: |x/a|^n + |y/b|^n = 1 with a,b = half-size.
  // To control corner softness independently, scale the exponent slightly by radius.
  const rNorm = Math.min(radius / Math.min(a, b), 1);
  // n closer to 2 = ellipse (softer), n large = rectangle. Target n=4 with radius influence.
  const exp = 2 + (n - 2) * (0.55 + 0.45 * rNorm);

  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
    const y = cy + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / exp);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  pts.push("Z");
  return pts.join(" ");
}

/** CSS clip-path path() string */
export function squircleClipPath(
  width: number,
  height: number,
  radius: number,
  n = 4,
): string {
  return `path("${superellipsePath(width, height, radius, n)}")`;
}

/** Pure CSS pill / squircle via border-image alternative for fluid sizes */
export const squircleStyle = (radius: number): { borderRadius: number } => ({
  borderRadius: radius,
});
