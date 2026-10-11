import { Outlet } from "react-router";

export function SettingsLayout() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl p-6">
        <Outlet />
      </div>
    </div>
  );
}
