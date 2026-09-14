import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import styles from "./TitleBar.module.css";
import {
  IconClose,
  IconMaximize,
  IconMinimize,
  IconRestore,
  IconLogo,
} from "../icons/Icons";
import { usePlayerStore } from "../../stores/playerStore";
import { useUiStore } from "../../stores/uiStore";

export function TitleBar() {
  const win = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const liteMode = useUiStore((s) => s.liteMode);
  const toggleLiteMode = useUiStore((s) => s.toggleLiteMode);

  useEffect(() => {
    const updateMaximized = async () => {
      try {
        const max = await win.isMaximized();
        setIsMaximized(max);
      } catch {
        /* ignore */
      }
    };
    void updateMaximized();

    const unlistenPromise = win.onResized(() => {
      void updateMaximized();
    });

    return () => {
      void unlistenPromise.then((unsub) => unsub());
    };
  }, [win]);

  const handleToggleMaximize = async () => {
    try {
      await win.toggleMaximize();
      const max = await win.isMaximized();
      setIsMaximized(max);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`${styles.bar} glass glassTitlebar`}>
      <div
        className={styles.dragArea}
        data-tauri-drag-region
        onDoubleClick={handleToggleMaximize}
      >
        <span className={styles.logoWrap}>
          <IconLogo size={18} />
        </span>
        <span className={styles.appName}>
          pouya music
        </span>
        {current && (
          <span className={styles.nowPlayingIndicator}>
            <span
              className={`${styles.playingDot} ${playing ? styles.playingDotActive : ""}`}
            />
            <span className={styles.trackSnippet}>
              {current.title} — {current.artist}
            </span>
          </span>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.liteBtn} ${liteMode ? styles.liteBtnActive : ""}`}
          aria-label={liteMode ? "Disable Lite Mode (Use Glass Effects)" : "Enable Lite Mode (Low Performance Mode)"}
          title={liteMode ? "⚡ Lite Mode: ACTIVE (Click for Glass Effects)" : "✨ Glass FX (Click for Lite / Low-Power Mode)"}
          onClick={toggleLiteMode}
        >
          <span className={styles.liteIcon}>{liteMode ? "⚡ Lite" : "✨ FX"}</span>
        </button>
        <button
          type="button"
          className={styles.captionBtn}
          aria-label="Minimize"
          title="Minimize"
          onClick={() => void win.minimize()}
        >
          <IconMinimize size={10} />
        </button>
        <button
          type="button"
          className={styles.captionBtn}
          aria-label={isMaximized ? "Restore" : "Maximize"}
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={() => void handleToggleMaximize()}
        >
          {isMaximized ? <IconRestore size={11} /> : <IconMaximize size={10} />}
        </button>
        <button
          type="button"
          className={`${styles.captionBtn} ${styles.closeBtn}`}
          aria-label="Close"
          title="Close"
          onClick={() => void win.close()}
        >
          <IconClose size={11} />
        </button>
      </div>
    </div>
  );
}
