import { motion } from "framer-motion";
import styles from "./Sidebar.module.css";
import { GlassPanel } from "../glass/GlassPanel";
import { IconLogo, IconSearch } from "../icons/Icons";
import { listNavFeatures } from "../../core/features/registry";
import { useUiStore } from "../../stores/uiStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../stores/playerStore";
import { usePlaylistStore } from "../../stores/playlistStore";
import { IconHeart } from "../icons/Icons";
import { useEffect } from "react";

export function Sidebar() {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const query = useLibraryStore((s) => s.query);
  const setQuery = useLibraryStore((s) => s.setQuery);
  const tracks = useLibraryStore((s) => s.tracks);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentId = usePlayerStore((s) => s.current?.id);
  const nav = listNavFeatures();
  const playlists = usePlaylistStore((s) => s.playlists);
  const refreshPlaylists = usePlaylistStore((s) => s.refresh);
  const selectPlaylist = usePlaylistStore((s) => s.select);
  const selectedPlId = usePlaylistStore((s) => s.selectedId);

  useEffect(() => {
    void refreshPlaylists();
  }, [refreshPlaylists]);

  const albums = Array.from(new Map(tracks.map((t) => [t.album, t])).values()).slice(0, 12);

  return (
    <GlassPanel className={styles.sidebar} radius={16}>
      <motion.div
        className={styles.brand}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24, delay: 0.05 }}
      >
        <span className={styles.logoSpin}>
          <IconLogo size={28} />
        </span>
        <div className={styles.brandText}>
          <div className={styles.brandName}>pouya music</div>
          <div className={styles.brandSub}>liquid glass player</div>
        </div>
      </motion.div>

      <div className={styles.searchWrap}>
        <IconSearch size={16} className={styles.searchIcon} />
        <input
          className={styles.search}
          placeholder="Search library…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setView("search")}
        />
      </div>

      <nav className={styles.nav} aria-label="Primary">
        {nav.map(({ id, label, Icon }, i) => {
          const active = view === id || (id === "library" && view === "search");
          return (
            <motion.button
              key={id}
              type="button"
              className={styles.navItem}
              onClick={() => setView(id as never)}
              whileTap={{ scale: 0.96 }}
              whileHover={{ x: 2 }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 22,
                delay: 0.08 + i * 0.04,
              }}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.span
                  layoutId="nav-active-pill"
                  className={styles.navPill}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <span className={styles.navIcon}>
                {id === "liked" ? <IconHeart size={18} filled={active} /> : <Icon size={18} />}
              </span>
              <span className={`${styles.navLabel} ${active ? styles.navLabelOn : ""}`}>
                {label}
              </span>
            </motion.button>
          );
        })}
      </nav>

      <div className={styles.sectionLabel}>Playlists</div>
      <div className={styles.playlistScroll} style={{ maxHeight: 140, marginBottom: 12 }}>
        {playlists.length === 0 && (
          <button
            type="button"
            className={styles.playlistItem}
            onClick={() => setView("playlists")}
          >
            <span className={styles.thumb} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              +
            </span>
            <span className={styles.playlistText}>
              <span className={styles.playlistTitle}>New playlist</span>
              <span className={styles.playlistArtist}>Create one</span>
            </span>
          </button>
        )}
        {playlists.slice(0, 8).map((pl) => (
          <button
            key={pl.id}
            type="button"
            className={`${styles.playlistItem} ${view === "playlists" && selectedPlId === pl.id ? styles.playlistActive : ""}`}
            onClick={() => {
              selectPlaylist(pl.id);
              setView("playlists");
            }}
          >
            <span className={styles.thumb} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
              ♪
            </span>
            <span className={styles.playlistText}>
              <span className={styles.playlistTitle}>{pl.name}</span>
              <span className={styles.playlistArtist}>{pl.tracks.length} tracks</span>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.sectionLabel}>Albums</div>
      <div className={styles.playlistScroll}>
        {albums.map((t, i) => (
          <motion.button
            key={t.id}
            type="button"
            className={`${styles.playlistItem} ${currentId === t.id ? styles.playlistActive : ""}`}
            onClick={() => void playTrack(t)}
            whileHover={{ x: 3, backgroundColor: "rgba(255,255,255,0.06)" }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 24,
              delay: 0.2 + i * 0.03,
            }}
          >
            {t.cover_data_url ? (
              <img className={styles.thumb} src={t.cover_data_url} alt="" draggable={false} />
            ) : (
              <span className={styles.thumb} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>♪</span>
            )}
            <span className={styles.playlistText}>
              <span className={styles.playlistTitle}>{t.album}</span>
              <span className={styles.playlistArtist}>{t.artist}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </GlassPanel>
  );
}
