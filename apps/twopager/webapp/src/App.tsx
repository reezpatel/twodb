import { BrowserRouter, Route, Routes } from "react-router";
import { Shell } from "./routes/shell/Shell";
import { HomePage } from "./routes/home/HomePage";
import { SitesPage } from "./routes/sites/SitesPage";
import { SitePage } from "./routes/site/SitePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="s/:spaceId" element={<SitesPage />} />
          <Route path="s/:spaceId/sites/:siteId" element={<SitePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
