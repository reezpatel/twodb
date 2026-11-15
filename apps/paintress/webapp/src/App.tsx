import { BrowserRouter } from "react-router";
import { RequireAuth } from "./auth/RequireAuth";
import { Shell } from "./shell/Shell";

/** Sidebar shell (diagram / doc boards); `/` welcome · `/b/:id` a board. */
export function App() {
  return (
    <RequireAuth>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </RequireAuth>
  );
}
