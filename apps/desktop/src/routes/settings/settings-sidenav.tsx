import { SideNav, SideNavGroup, SideNavHeader, SideNavItem } from "@/components/side-nav";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "administrator", label: "Administrator" },
  { id: "llm", label: "LLM" },
  { id: "code", label: "Code" },
  { id: "runners", label: "Runners" },
  { id: "storage", label: "Storage" },
  { id: "accounts", label: "Accounts" },
  { id: "calendar", label: "Calendar" },
  { id: "shared-content", label: "Shared Content" },
  { id: "logs", label: "Logs" },
] as const;

/** The settings sidebar — rendered by the app shell (desktop column / mobile drawer). */
export function SettingsSidenav() {
  return (
    <SideNav>
      <SideNavHeader title="Settings" />
      <SideNavGroup>
        {SECTIONS.map((section) => (
          <SideNavItem key={section.id} to={`/apps/settings/${section.id}`} label={section.label} />
        ))}
      </SideNavGroup>
    </SideNav>
  );
}
