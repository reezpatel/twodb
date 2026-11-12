import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queries";
import { RequireAuth } from "./auth/RequireAuth";
import { GardenShell } from "./shell/GardenShell";
import { RecordRoute } from "./doc/RecordRoute";
import { TrashPage } from "./trash/TrashPage";

/** Routes: /all (All docs) · /trash · /:id (page or database) · ?peek=<id> opens the peek view anywhere. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RequireAuth>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Routes>
            <Route element={<GardenShell />}>
              <Route index element={<Navigate to="/all" replace />} />
              <Route path="all" element={<RecordRoute all />} />
              <Route path="trash" element={<TrashPage />} />
              <Route path=":id" element={<RecordRoute />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </RequireAuth>
    </QueryClientProvider>
  );
}
