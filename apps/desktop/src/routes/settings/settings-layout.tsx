import { NavLink, Outlet } from "react-router";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "administrator", label: "Administrator" },
  { id: "llm", label: "LLM" },
  { id: "runners", label: "Runners" },
  { id: "storage", label: "Storage" },
] as const;

export function SettingsLayout() {
  return (
    <div className="flex h-full">
      <aside className="bg-card border-r w-60 shrink-0">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.id}
              to={`/apps/settings/${section.id}`}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`
              }
            >
              {section.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
