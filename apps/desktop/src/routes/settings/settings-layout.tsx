import { Outlet } from "react-router";
import { SideNav, SideNavGroup, SideNavHeader, SideNavItem } from "@/components/side-nav";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "administrator", label: "Administrator" },
  { id: "llm", label: "LLM" },
  { id: "code", label: "Code" },
  { id: "runners", label: "Runners" },
  { id: "storage", label: "Storage" },
] as const;

export function SettingsLayout() {
  return (
    <div className="flex h-full">
      <SideNav>
        <SideNavHeader title="Settings" />
        <SideNavGroup>
          {SECTIONS.map((section) => (
            <SideNavItem key={section.id} to={`/apps/settings/${section.id}`} label={section.label} />
          ))}
        </SideNavGroup>
      </SideNav>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
