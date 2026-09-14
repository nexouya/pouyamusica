import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "../../components/views/Home.module.css";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../stores/playerStore";
import { EmptyState, TrackRow } from "../../components/views/TrackRow";
import { IconHeart, IconPause, IconPlay } from "../../components/icons/Icons";
import { formatTime } from "../../lib/format";
import { api } from "../../core/api";

export function HomeView() {
  const tracks = useLibraryStore((s) => s.tracks);
  const loading = useLibraryStore((s) => s.loading);
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const liked = usePlayerStore((s) => s.liked);
  const toggleLike = usePlayerStore((s) => s.toggleLikeCurrent);

  const hero = current || tracks[0] || null;
  const popular = useMemo(() => {
    if (!hero) return tracks.slice(0, 12);
    return tracks.filter((t) => t.id !== hero.id).slice(0, 12);
  }, [tracks, hero]);

  if (loading && !tracks.length) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingPulse} />
        <p>Scanning your library…</p>
      </div>
    );
  }

  if (!tracks.length) {
    return (
      <EmptyState
        title="Your library is empty"
        hint="Choose a folder with your music (MP3, FLAC, WAV, M4A…). Nothing is bundled — you point the app at your files."
        action={
          <button
            type="button"
            className={styles.playAllBtn}
            onClick={() => {
              void api.pickFolder().then((result) => {
                if (result) {
                  useLibraryStore.setState({ tracks: result, error: null });
                  void api.getMusicRoot().then((root) => {
                    if (root) useLibraryStore.setState({ root });
                  });
                }
              });
            }}
          >
            Choose music folder
          </button>
        }
      />
    );
  }

  const isLiked = hero ? liked.includes(hero.path) : false;
  const genre = hero?.album || "Indie";

  return (
    <div className={styles.view}>
      {hero && (
        <section
          className={styles.hero}
          style={
            hero.cover_data_url
              ? ({ "--hero-cover": `url(${hero.cover_data_url})` } as React.CSSProperties)
              : undefined
          }
        >
          <motion.div
            className={styles.heroGlow}
            aria-hidden
            key={`glow-${hero.id}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          />
          <motion.div
            className={styles.heroCard}
            key={`card-${hero.id}`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          >
            <div className={styles.heroArtWrap}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={hero.cover_data_url || hero.id}
                  className={styles.heroArt}
                  src={hero.cover_data_url || undefined}
                  alt=""
                  draggable={false}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.06 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  style={{ width: 112, height: 112 }}
                />
              </AnimatePresence>
              <span className={styles.heroShine} aria-hidden />
              <motion.button
                type="button"
                className={styles.heroPlay}
                onClick={() => {
                  if (current?.id === hero.id) void togglePlay();
                  else void playTrack(hero);
                }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 420, damping: 16 }}
                aria-label={playing && current?.id === hero.id ? "Pause" : "Play"}
              >
                {playing && current?.id === hero.id ? (
                  <IconPause size={22} />
                ) : (
                  <IconPlay size={22} />
                )}
              </motion.button>
            </div>

            <div className={styles.heroMeta}>
              <motion.p
                className={styles.heroEyebrow}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
              >
                {current?.id === hero.id && playing ? "Now Playing" : "Welcome back"}
              </motion.p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={hero.id}
                  className={styles.heroTitle}
                  initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                >
                  {hero.title}
                </motion.h1>
              </AnimatePresence>
              <motion.div
                className={styles.heroChips}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, type: "spring", stiffness: 300, damping: 24 }}
              >
                <span className={styles.chip}>
                  <img className={styles.chipAvatar} src={hero.cover_data_url || undefined} alt="" />
                  {hero.artist}
                </span>
                <span className={styles.chipDot} aria-hidden />
                <span className={styles.chip}>{genre}</span>
              </motion.div>
              <motion.button
                type="button"
                className={`${styles.heroLike} ${isLiked ? styles.heroLikeOn : ""}`}
                onClick={() => {
                  if (current?.id !== hero.id) void playTrack(hero).then(() => toggleLike());
                  else void toggleLike();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                aria-label={isLiked ? "Unlike" : "Like"}
              >
                <motion.span
                  animate={isLiked ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                  style={{ display: "inline-flex" }}
                >
                  <IconHeart size={18} filled={isLiked} />
                </motion.span>
              </motion.button>
            </div>
          </motion.div>
        </section>
      )}

      <section className={styles.popular}>
        <div className={styles.popularHead}>
          <h2 className={styles.popularTitle}>Popular Now</h2>
          <span className={styles.popularCount}>{popular.length + (hero ? 1 : 0)} tracks</span>
        </div>
        <div className={styles.list}>
          {hero && (
            <TrackRow
              key={hero.id}
              track={hero}
              index={0}
              highlight
              action={
                <button
                  type="button"
                  className={styles.rowAction}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleLike();
                  }}
                  aria-label="Like"
                >
                  <IconHeart size={16} filled={liked.includes(hero.path)} />
                </button>
              }
            />
          )}
          {popular.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              index={i + (hero ? 1 : 0)}
              meta={t.duration_secs ? formatTime(t.duration_secs) : undefined}
              action={
                <button
                  type="button"
                  className={styles.rowAction}
                  onClick={(e) => {
                    e.stopPropagation();
                    void playTrack(t);
                  }}
                  aria-label="Play"
                >
                  <IconPlay size={14} />
                </button>
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default HomeView;
