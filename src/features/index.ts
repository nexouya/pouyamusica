import { registerFeature } from "../core/features/registry";
import {
  IconCompass,
  IconHeart,
  IconHome,
  IconLibrary,
  IconSearch,
  IconSoundLab,
} from "../components/icons/Icons";
import HomeView from "./home";
import ExploreView from "./explore";
import LibraryView from "./library";
import LikedView from "./liked";
import SearchView from "./search";
import PlaylistsView from "./playlists";
import SoundLabView from "./soundlab";

/**
 * Feature bootstrap — import a feature package and registerFeature() it.
 * Sidebar + router consume listNavFeatures() / getFeature(view).
 */
registerFeature({
  id: "home",
  label: "Home",
  Icon: IconHome,
  component: HomeView,
  order: 1,
});

registerFeature({
  id: "explore",
  label: "Explore",
  Icon: IconCompass,
  component: ExploreView,
  order: 2,
});

registerFeature({
  id: "library",
  label: "Library",
  Icon: IconLibrary,
  component: LibraryView,
  order: 3,
});

registerFeature({
  id: "playlists",
  label: "Playlists",
  Icon: IconLibrary,
  component: PlaylistsView,
  order: 4,
});

registerFeature({
  id: "liked",
  label: "Liked",
  Icon: IconHeart,
  component: LikedView,
  order: 5,
});

registerFeature({
  id: "search",
  label: "Search",
  Icon: IconSearch,
  component: SearchView,
  order: 6,
  hidden: true,
});

registerFeature({
  id: "soundlab",
  label: "Sound Lab",
  Icon: IconSoundLab,
  component: SoundLabView,
  order: 7,
});

export {};
