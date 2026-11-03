import { useLocation, useNavigate } from "react-router";
import { AppNav } from "@/components/blocks/app-nav/app-nav";
import { AppNavLink } from "@/components/blocks/app-nav/app-nav-link";
import { AppNavLinkFolder } from "@/components/blocks/app-nav/app-nav-link-folder";
import { AppNavLinks } from "@/components/blocks/app-nav/app-nav-links";
import { useAppShellContext } from "@/components/blocks/app-shell/app-shell-context";

const LLM_SECTIONS = [
  { id: "connections", label: "Connections" },
  { id: "skills", label: "Skills" },
  { id: "agents", label: "Agents" },
  { id: "memories", label: "Memories" },
  { id: "instructions", label: "Instructions" },
  { id: "mcp", label: "MCP" },
] as const;

/** Nav ids mirror the URL under /apps/settings — "general", "llm/skills", … */
function selectedIdFor(pathname: string): string {
  const [section, sub] = pathname.replace(/^\/apps\/settings\/?/, "").split("/");
  if (section === "llm") return `llm/${sub || "connections"}`;
  return section || "general";
}

/** The settings sidebar — rendered by the app shell (desktop column / mobile drawer). */
export function SettingsSidenav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { closeNavigation } = useAppShellContext();
  const selectedId = selectedIdFor(pathname);

  return (
    <aside data-slot="settings-sidenav" className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto px-3 py-4">
      <h2 className="text-md px-1 font-medium">Settings</h2>
      <AppNav
        selectedId={selectedId}
        onSelect={(id) => {
          navigate(`/apps/settings/${id}`);
          closeNavigation();
        }}
        className="px-0"
      >
        <AppNavLinks title="Account">
          <AppNavLink id="general" label="General" />
          <AppNavLink id="notifications" label="Notifications" />
          <AppNavLink id="accounts" label="Accounts" />
          <AppNavLink id="calendar" label="Calendar" />
        </AppNavLinks>

        <AppNavLinks title="Workspace">
          <AppNavLinkFolder id="llm" label="LLM" defaultExpanded={selectedId.startsWith("llm/")}>
            {LLM_SECTIONS.map((section) => (
              <AppNavLink key={section.id} id={`llm/${section.id}`} label={section.label} />
            ))}
          </AppNavLinkFolder>
          <AppNavLink id="code" label="Code" />
          <AppNavLink id="runners" label="Runners" />
          <AppNavLink id="teams" label="Teams" />
          <AppNavLink id="storage" label="Storage" />
          <AppNavLink id="shared-content" label="Shared Content" />
        </AppNavLinks>

        <AppNavLinks title="Administration">
          <AppNavLink id="administrator" label="Administrator" />
          <AppNavLink id="logs" label="Logs" />
        </AppNavLinks>
      </AppNav>
    </aside>
  );
}
