import { create } from "zustand";
import type { ViewId } from "../types";

type UiState = {
  view: ViewId;
  accent: string;
  accentRgb: string;
  liteMode: boolean;
  setView: (v: ViewId) => void;
  setAccent: (hex: string, rgb?: string) => void;
  toggleLiteMode: () => void;
  setLiteMode: (enabled: boolean) => void;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [124, 156, 255];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function hexToRgbString(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

/** Lift toward white so accent remains readable as text on dark glass. */
function brighten(hex: string, t = 0.32): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * t));
  return (
    "#" +
    [f(r), f(g), f(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function getInitialLiteMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem("pm_lite_mode");
    if (saved !== null) return saved === "true";
  } catch {
    /* ignore */
  }
  return false;
}

function applyLiteModeDom(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-lite-mode", String(enabled));
  document.documentElement.classList.toggle("lite-mode", enabled);
}

const initialLite = getInitialLiteMode();
applyLiteModeDom(initialLite);

export const useUiStore = create<UiState>((set, get) => ({
  view: "home",
  accent: "#7C9CFF",
  accentRgb: "124, 156, 255",
  liteMode: initialLite,
  setView: (v) => set({ view: v }),
  setAccent: (hex, rgb) => {
    const safe = brighten(hex, 0.32);
    const accentRgb = rgb || hexToRgbString(safe);
    document.documentElement.style.setProperty("--accent-dynamic", safe);
    document.documentElement.style.setProperty("--accent-dynamic-rgb", accentRgb);
    set({ accent: safe, accentRgb });
  },
  toggleLiteMode: () => {
    const next = !get().liteMode;
    try {
      localStorage.setItem("pm_lite_mode", String(next));
    } catch {
      /* ignore */
    }
    applyLiteModeDom(next);
    set({ liteMode: next });
  },
  setLiteMode: (enabled) => {
    try {
      localStorage.setItem("pm_lite_mode", String(enabled));
    } catch {
      /* ignore */
    }
    applyLiteModeDom(enabled);
    set({ liteMode: enabled });
  },
}));
