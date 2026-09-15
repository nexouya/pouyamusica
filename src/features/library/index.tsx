import { useMemo, useState } from "react";
import styles from "../../components/views/Home.module.css";
import { useLibraryStore } from "../../stores/libraryStore";
import { EmptyState, TrackRow } from "../../components/views/TrackRow";
import { formatTime } from "../../lib/format";
import { IconSearch } from "../../components/icons/Icons";

export function LibraryView() {
  const tracks = useLibraryStore((s) => s.tracks);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<"artist" | "title" | "album" | "duration">("artist");

  const filtered = useMemo(() => {
    let list = tracks;
    const q = filter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "album") return a.album.localeCompare(b.album);
      if (sortBy === "duration") return b.duration_secs - a.duration_secs;
      return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
    });
  }, [tracks, filter, sortBy]);

  const totalDuration = useMemo(
    () => tracks.reduce((acc, t) => acc + (t.duration_secs || 0), 0),
    [tracks],
  );

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <p className="navLabel">Library</p>
            <h1 className={styles.headerTitle}>All Tracks</h1>
            <p className={styles.sub}>
              {tracks.length} {tracks.length === 1 ? "track" : "tracks"} •{" "}
              {formatTime(totalDuration)} total
            </p>
          </div>

          <div className={styles.headerFilters}>
            <div className={styles.searchBar}>
              <IconSearch size={14} className={styles.searchIcon} />
              <input
                className={styles.filterInput}
                placeholder="Filter tracks…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as never)}
              aria-label="Sort by"
            >
              <option value="artist">Sort by Artist</option>
              <option value="title">Sort by Title</option>
              <option value="album">Sort by Album</option>
              <option value="duration">Sort by Duration</option>
            </select>
          </div>
        </div>
      </header>

      <div className={styles.pageContent}>
        {filtered.length === 0 ? (
          <EmptyState
            title={tracks.length === 0 ? "Library is empty" : "No matching tracks"}
            hint={
              tracks.length === 0
                ? "Scan a folder from Explore to add tracks to your library."
                : `No songs match "${filter}". Try a different keyword.`
            }
          />
        ) : (
          <div className={styles.list}>
            {filtered.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} queue={filtered} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LibraryView;
