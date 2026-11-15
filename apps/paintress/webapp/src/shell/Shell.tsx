import { Navigate, Route, Routes } from "react-router";
import { BoardPage } from "../board/BoardPage";
import { useShell } from "./hooks/useShell";
import { NewBoardDialog } from "./partials/NewBoardDialog";
import { Sidebar } from "./partials/Sidebar";
import { Welcome } from "./partials/Welcome";

/** App shell: sidebar (diagram / doc boards) on the left, the open board on the right. */
export function Shell() {
  const s = useShell();
  const sidebar = { open: s.sidebarOpen, onToggle: s.toggleSidebar };
  return (
    <div className="flex h-screen overflow-hidden bg-paper text-ink">
      {s.sidebarOpen && (
        <Sidebar
          tab={s.tab}
          onTabChange={s.setTab}
          boards={s.visible}
          groups={s.groups}
          spaces={s.spaces}
          counts={s.counts}
          activeBoardId={s.activeBoardId}
          onOpen={s.openBoard}
          onNew={() => s.setCreating(true)}
          onRename={s.rename}
          onDelete={s.remove}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Welcome sidebar={sidebar} onNew={() => s.setCreating(true)} />} />
          <Route path="/b/:id" element={<BoardPage sidebar={sidebar} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <NewBoardDialog open={s.creating} initialKind={s.tab} groups={s.groups} spaces={s.spaces} onClose={() => s.setCreating(false)} onCreate={s.create} />
    </div>
  );
}
