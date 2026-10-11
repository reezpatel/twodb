import { Outlet } from "react-router";
import { Sidebar } from "./sidebar/sidebar";
import { useCode } from "./code-provider";

export function CodeScene() {
  useCode(); // CodeProvider (rendered by the app shell) owns the chat panel state.

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
      <Sidebar />
    </div>
  );
}
