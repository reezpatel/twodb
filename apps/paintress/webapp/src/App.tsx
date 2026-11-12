import { BrowserRouter, Route, Routes } from "react-router";
import { RequireAuth } from "./auth/RequireAuth";
import { BoardsList } from "./boards-list/BoardsList";
import { BoardPage } from "./board/BoardPage";

/** Routes: `/` boards list · `/b/:id` a board (diagram canvas or markdown doc). */
export function App() {
  return (
    <RequireAuth>
      <BrowserRouter>
        <div className="h-screen bg-paper text-ink">
          <Routes>
            <Route path="/" element={<BoardsList />} />
            <Route path="/b/:id" element={<BoardPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </RequireAuth>
  );
}
