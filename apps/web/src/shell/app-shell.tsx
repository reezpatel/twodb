import { Navigate, Route, Routes } from "react-router";
import { SectionScene } from "@twodb/content/view";
import { AutomationsScene } from "../scenes/automations/automations-scene";
import { CalendarScene } from "../scenes/calendar/calendar-scene";
import { ChatScene } from "../scenes/chat/chat-scene";
import { CodeScene } from "../scenes/code/code-scene";
import { EmailScene } from "../scenes/email/email-scene";
import { FilesScene } from "../scenes/files/files-scene";
import { InboxScene } from "../scenes/inbox/inbox-scene";
import { NotesScene } from "../scenes/notes/notes-scene";
import { RecordingScene } from "../scenes/recording/recording-scene";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { appShellStyles } from "./app-shell.style";
import { CommandPalette } from "./command-palette";
import { ShellStateProvider, useShellState } from "./state";
import { createBrowserRouter } from "react-router";
import { usePluginStore } from "react-pluggable";
import { RouterProvider } from "react-router";
import { useMemo, type ReactNode } from "react";
import { Outlet } from "react-router";

export const ShellFrame = () => {
  const { phase } = useShellState();

  return (
    <div className="shell" data-phase={phase}>
      <style jsx>{appShellStyles}</style>
      <Sidebar />

      <Outlet />
      <StatusBar />
      <CommandPalette />
    </div>
  );

  // <Routes>
  {
    /*<Route path="/notes/:identifier/:noteId" element={<NotesScene />} />

    <Route path="/" element={} />
    <Route path="/inbox" element={<InboxScene />} />
    <Route path="/email" element={<EmailScene />} />
    <Route path="/calendar" element={<CalendarScene />} />
    <Route path="/files" element={<FilesScene />} />
    <Route path="/automations" element={<AutomationsScene />} />
    <Route path="/chat" element={<ChatScene />} />
    <Route path="/code" element={<CodeScene />} />
    <Route path="/notes" element={<NotesScene />} />
    <Route path="/notes/:identifier" element={<NotesScene />} />
    <Route path="/recording" element={<RecordingScene />} />
    <Route path="*" element={} />
  </Routes>;*/
  }
};

export function AppShell() {
  const e = usePluginStore();

  const routes = useMemo(() => {
    console.log("routes", e.executeFunction("core::get_routes"));
    return createBrowserRouter([
      {
        path: "/",
        element: <Navigate to="/inbox" replace />,
      },
      {
        path: "",
        element: <ShellFrame />,
        children: [
          ...(e.executeFunction("core::get_routes") || []),

          {
            path: "*",
            element: <Navigate to="/inbox" replace />,
          },
        ],
      },
    ]);
  }, []);

  return (
    <ShellStateProvider>
      <RouterProvider router={routes} />
    </ShellStateProvider>
  );
}
