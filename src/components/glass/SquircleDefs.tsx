import { SQUIRCLE_SOFT_PATH, SQUIRCLE_UNIT_PATH } from "../../lib/squirclePaths";

/** Global SVG defs for superellipse clip paths (n=4). */
export function SquircleDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <defs>
        <clipPath id="squircle-clip" clipPathUnits="objectBoundingBox">
          <path d={SQUIRCLE_UNIT_PATH} />
        </clipPath>
        <clipPath id="squircle-soft" clipPathUnits="objectBoundingBox">
          <path d={SQUIRCLE_SOFT_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}
