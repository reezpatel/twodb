import { useEffect } from "react";
import { useRoute } from "../lib/router.js";
import { BoardsPage } from "../boards/BoardsPage.js";
import { BookmarksPage } from "../bookmarks/BookmarksPage.js";
import { SettingsPage } from "../settings/SettingsPage.js";
import { ShareTargetPage } from "../share/ShareTargetPage.js";
import type { BookmarkSelection } from "../bookmarks/hooks/useBookmarks.js";

/** Hash routes: /boards[/:boardId], /bookmarks[/sel], /settings, plus the /share path. */
export function Routes() {
  const r = useRoute();
  const [a, b] = r.segments;

  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [r.path]);

  // The share target lands on the real path /share (query string holds the URL),
  // outside the hash router — detect it before hash routing kicks in.
  if (window.location.pathname.endsWith("/share")) {
    return <ShareTargetPage />;
  }

  switch (a) {
    case undefined:
    case "boards":
      return <BoardsPage key={b ?? "all"} />;
    case "bookmarks": {
      const selection: BookmarkSelection = !b || b === "all" ? "all" : b === "unfiled" ? "unfiled" : b;
      return <BookmarksPage key={selection} selection={selection} />;
    }
    case "settings":
      return <SettingsPage />;
    default:
      return <div className="p-10 text-center text-ink-muted">Page not found.</div>;
  }
}

