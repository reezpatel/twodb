import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { appShellStyles } from "./app-shell.style";
import { CommandPalette } from "./command-palette";
import { ShellStateProvider, useShellState } from "./state";
import { usePluginStore } from "react-pluggable";
import { useMemo } from "react";
import { InboxScene } from "../scenes/inbox/inbox-scene";
import { EmailScene } from "../scenes/email/email-scene";
import { AutomationsScene } from "../scenes/automations/automations-scene";
import { FilesScene } from "../scenes/files/files-scene";
import { SettingsScene } from "../scenes/settings/settings-scene";
import { AdminScene } from "../scenes/admin/admin-scene";
import { PasskeysSection } from "../scenes/admin/sections/passkeys/passkeys-section";
import { InstanceSection } from "../scenes/admin/sections/instance/instance-section";
import { PluginsSection } from "../scenes/admin/sections/plugins/plugins-section";

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
        path: "admin",
        element: <AdminScene />,
        children: [
          { index: true, element: <Navigate to="passkeys" replace /> },
          { path: "passkeys", element: <PasskeysSection /> },
          { path: "instance", element: <InstanceSection /> },
          { path: "plugins", element: <PluginsSection /> },
        ],
      },
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
            path: "inbox",
            element: <InboxScene />,
          },
          {
            path: "email",
            element: <EmailScene />,
          },
          {
            path: "automations",
            element: <AutomationsScene />,
          },
          {
            path: "files",
            element: <FilesScene />,
          },
          {
            path: "settings/:pluginId?",
            element: <SettingsScene />,
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
