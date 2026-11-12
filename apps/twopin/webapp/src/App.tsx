import { AppShell, AppShellBody, AppShellMain } from "@twodb/blocks";
import { TwoPinPage } from "./pins/TwoPinPage.js";

/**
 * TwoPin webapp: Pinterest-style boards of links. Left rail lists boards;
 * the main pane is a masonry grid of pin cards whose metadata (title,
 * description, preview image, favicon) was fetched server-side.
 */
export function App() {
  return (
    <AppShell>
      <AppShellBody>
        <AppShellMain>
          <TwoPinPage />
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  );
}
