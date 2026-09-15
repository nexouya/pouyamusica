import { AnimatePresence, motion } from "framer-motion";
import styles from "./ErrorBanner.module.css";
import { useLibraryStore } from "../../stores/libraryStore";

export function ErrorBanner() {
  const error = useLibraryStore((s) => s.error);
  const clearError = useLibraryStore((s) => s.clearError);

  return (
    <AnimatePresence>
      {error ? (
        <motion.div
          className={styles.banner}
          role="status"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.text}>{error}</span>
          <button
            type="button"
            className={styles.close}
            onClick={clearError}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
