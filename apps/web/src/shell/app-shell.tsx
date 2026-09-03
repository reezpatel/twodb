import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { appShellStyles } from "./app-shell.style";
import { CommandPalette } from "./command-palette";
import { ShellStateProvider, useShellState } from "./state";
import { usePluginStore } from "react-pluggable";
import { useMemo } from "react";
import { EmailScene } from "../scenes/email/email-scene";
import { ChatScene } from "../scenes/chat/chat-scene";
import { FilesScene } from "../scenes/files/files-scene";

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
};

export function AppShell() {
  const e = usePluginStore();

  const routes = useMemo(() => {
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
            path: "email",
            element: <EmailScene />,
          },
          {
            path: "chat",
            element: <ChatScene />,
          },
          {
            path: "files",
            element: <FilesScene />,
          },
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
