import { useRoute } from "./lib/router.js";
import { TwoPinProvider } from "./state/TwoPinProvider.js";
import { Frame } from "./shell/Frame.js";
import { Routes } from "./shell/Routes.js";

/**
 * TwoPin webapp: Pinterest-style boards of links plus a bookmarks manager.
 * Chrome comes from Frame (NavSidebar + TopBar); the hash router picks the
 * page. Board selection lives in the URL so sidebar and grid stay in sync.
 */
export function App() {
  const route = useRoute();
  const [section, id] = route.segments;
  const boardId = section === "boards" || section === undefined ? id : undefined;

  return (
    <TwoPinProvider boardId={boardId}>
      <Frame>
        <Routes />
      </Frame>
    </TwoPinProvider>
  );
}

