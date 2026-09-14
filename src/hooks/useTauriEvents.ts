import { useEffect, useRef } from "react";
import { usePlayerStore } from "../stores/playerStore";
import { useUiStore } from "../stores/uiStore";

/** Sync UI accent CSS vars from the currently loaded track. */
export function useAccentSync() {
  const current = usePlayerStore((s) => s.current);
  const setAccent = useUiStore((s) => s.setAccent);
  const last = useRef<string>("");

  useEffect(() => {
    if (current?.accent && current.accent !== last.current) {
      last.current = current.accent;
      setAccent(current.accent);
    }
  }, [current, setAccent]);
}
