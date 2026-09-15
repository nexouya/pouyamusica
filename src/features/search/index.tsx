import { useMemo } from "react";
import styles from "../../components/views/Home.module.css";
import { useLibraryStore, filterTracks } from "../../stores/libraryStore";
import { EmptyState, TrackRow } from "../../components/views/TrackRow";
import { IconClose, IconSearch } from "../../components/icons/Icons";

export function SearchView() {
  const tracks = useLibraryStore((s) => s.tracks);
  const query = useLibraryStore((s) => s.query);
  const setQuery = useLibraryStore((s) => s.setQuery);
  const results = useMemo(() => filterTracks(tracks, query), [tracks, query]);

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <p className="navLabel">Search</p>
        <h1 className={styles.headerTitle}>Find Music</h1>
        <div className={styles.searchBarLarge}>
          <IconSearch size={18} className={styles.searchIcon} />
          <input
            className={styles.searchInputLarge}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, artist, or album…"
            autoFocus
          />
          {query && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <IconClose size={12} />
            </button>
          )}
        </div>
        <p className={styles.sub}>
          {query.trim()
            ? `Found ${results.length} ${results.length === 1 ? "track" : "tracks"} for "${query}"`
            : `${tracks.length} tracks indexed in library`}
        </p>
      </header>

      <div className={styles.pageContent}>
        {results.length === 0 ? (
          <EmptyState
            title="No matching tracks"
            hint={
              tracks.length === 0
                ? "Your library is empty. Add audio files or choose a music folder from Explore."
                : `We couldn't find anything matching "${query}". Try searching for an artist or album name.`
            }
          />
        ) : (
          <div className={styles.list}>
            {results.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchView;
