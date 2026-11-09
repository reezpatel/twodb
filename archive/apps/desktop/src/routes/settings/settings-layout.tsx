import { Outlet, useMatches } from "react-router";

export function SettingsLayout() {
  // Pages flagged `handle: { fullBleed: true }` fill the whole content area — no padding or width cap.
  const fullBleed = useMatches().some((m) => (m.handle as { fullBleed?: boolean } | undefined)?.fullBleed);
  if (fullBleed) {
    return (
      <div className="h-full min-h-0">
        <Outlet />
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl p-6">
        <Outlet />
      </div>
    </div>
  );
}
