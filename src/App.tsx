import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./App.module.css";
import { TitleBar } from "./components/layout/TitleBar";
import { Sidebar } from "./components/layout/Sidebar";
import { NowPlayingBar } from "./components/player/NowPlayingBar";
import { FocusMode } from "./components/player/FocusMode";
import { QueuePanel } from "./components/player/QueuePanel";
import { SquircleDefs } from "./components/glass/SquircleDefs";
import { AmbientAura } from "./components/fx/AmbientAura";
import { getFeature } from "./core/features/registry";
import { useAppEvents } from "./core/events/useAppEvents";
import { useAccentSync } from "./hooks/useTauriEvents";
import { useLibraryStore } from "./stores/libraryStore";
import { usePlayerStore } from "./stores/playerStore";
import { useUiStore } from "./stores/uiStore";
// Side-effect: registers all product features
import "./features";

const viewSpring = {
  initial: { opacity: 0, y: 16, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, filter: "blur(4px)" },
  transition: { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.7 },
};

export default function App() {
  const view = useUiStore((s) => s.view);
  const initLibrary = useLibraryStore((s) => s.init);
  const hydratePlayer = usePlayerStore((s) => s.hydrate);
  const Feature = getFeature(view)?.component;

  useAppEvents();
  useAccentSync();

  useEffect(() => {
    void initLibrary();
    void hydratePlayer();
  }, [initLibrary, hydratePlayer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const st = usePlayerStore.getState();

      if (e.code === "Space") {
        e.preventDefault();
        void st.togglePlay();
      } else if (e.code === "ArrowRight" && e.shiftKey) {
        e.preventDefault();
        void st.next();
      } else if (e.code === "ArrowLeft" && e.shiftKey) {
        e.preventDefault();
        void st.prev();
      } else if (e.code === "ArrowRight" && !e.shiftKey && st.current) {
        e.preventDefault();
        void st.seek(Math.min(st.duration, st.position + 5));
      } else if (e.code === "ArrowLeft" && !e.shiftKey && st.current) {
        e.preventDefault();
        void st.seek(Math.max(0, st.position - 5));
      } else if (e.code === "KeyM") {
        e.preventDefault();
        void st.applyVolume(st.volume > 0 ? 0 : 0.8);
      } else if (e.code === "KeyF") {
        e.preventDefault();
        st.toggleFocus();
      } else if (e.code === "KeyQ") {
        e.preventDefault();
        st.toggleQueue();
      } else if (e.code === "KeyS") {
        e.preventDefault();
        st.toggleShuffle();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        st.cycleRepeat();
      } else if (e.code === "KeyL") {
        e.preventDefault();
        void st.toggleLikeCurrent();
      } else if (e.code === "Escape" && st.focusMode) {
        st.toggleFocus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.app}>
      <SquircleDefs />
      <AmbientAura />
      <TitleBar />
      <div className={styles.body}>
        <div className={styles.contentRow}>
          <Sidebar />
          <main className={styles.main}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                className={styles.viewHost}
                initial={viewSpring.initial}
                animate={viewSpring.animate}
                exit={viewSpring.exit}
                transition={viewSpring.transition}
              >
                {Feature ? <Feature /> : null}
              </motion.div>
            </AnimatePresence>
          </main>
          <QueuePanel />
        </div>
        <NowPlayingBar />
        <FocusMode />
      </div>
    </div>
  );
}
