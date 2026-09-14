import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** Pointer-driven optical highlight: writes --mx/--my (max ±6px from center). */
export function useLiquidHighlight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const onPointerMove = useCallback((e: ReactPointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 100;
    const ny = ((e.clientY - rect.top) / rect.height) * 100;
    // map to ±8px translate around center
    const dx = ((nx - 50) / 50) * 8;
    const dy = ((ny - 50) / 50) * 8;
    el.style.setProperty("--mx", `${dx.toFixed(1)}px`);
    el.style.setProperty("--my", `${dy.toFixed(1)}px`);
  }, []);

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "0px");
    el.style.setProperty("--my", "0px");
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
