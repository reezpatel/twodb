import { useLocation, useNavigate } from "react-router";
import { CalendarDays, Files, Inbox, LogOut, Mail, Moon, MessageCircle, SlidersHorizontal, StickyNote, Sun, User, Video, Workflow } from "lucide-react";
import { Avatar, Menu, MenuDivider, MenuItem, NavRail, type NavRailItem } from "@twodb/ui";
import { sidebarStyles } from "./sidebar.style";
import { useShellState } from "./state";
import { usePluginStore } from "react-pluggable";
import { useHook } from "@twodb/shared-frontend";
import type { PluginNavItem } from "@twodb/shared-frontend";

const NAV_ITEMS: (NavRailItem & { route: string })[] = [
  { id: "inbox", label: "Inbox", icon: <Inbox size={15} />, route: "/inbox" },
  {
    id: "notes",
    label: "Notes",
    icon: <StickyNote size={15} />,
    route: "/notes",
  },
  { id: "email", label: "Email", icon: <Mail size={15} />, route: "/email" },
  {
    id: "calendar",
    label: "Calendar",
    icon: <CalendarDays size={15} />,
    route: "/calendar",
  },
  { id: "files", label: "Files", icon: <Files size={15} />, route: "/files" },
  {
    id: "automations",
    label: "Automations",
    icon: <Workflow size={15} />,
    route: "/automations",
  },
  {
    id: "chat",
    label: "Chat",
    icon: <MessageCircle size={15} />,
    route: "/chat",
  },
  {
    id: "meetings",
    label: "Meetings",
    icon: <Video size={15} />,
    route: "/meetings",
  },
];

export function Sidebar() {
  const { phase, togglePhase } = useShellState();
  const navigate = useNavigate();
  const location = useLocation();
  const pluginStore = usePluginStore();

  const pluginNavItems = ((pluginStore.executeFunction("core::get_nav_items") ?? []) as PluginNavItem[]).map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    route: item.path,
  }));

  const items = [...NAV_ITEMS, ...pluginNavItems];
  const activeId = items.find((item) => item.route === location.pathname || location.pathname.startsWith(`${item.route}/`))?.id ?? "";

  const useAuth = useHook<{ logout: () => void }>("useAuth");

  console.log("useAuth", useAuth);

  return (
    <>
      <style jsx>{sidebarStyles}</style>
      <div className="shell__sidebarSlot">
        <NavRail
          aria-label="Workspace navigation"
          items={items}
          value={activeId}
          onValueChange={(id) => {
            const item = items.find((x) => x.id === id);
            if (item) navigate(item.route);
          }}
          footer={
            <Menu
              placement="top-start"
              trigger={
                <button type="button" className="shell__rail-account" aria-label="Account menu">
                  <Avatar name="Asha Verma" size="sm" />
                </button>
              }
            >
              <MenuItem icon={<User />}>Profile</MenuItem>
              <MenuItem icon={<SlidersHorizontal />} onClick={() => navigate("/settings")}>
                Preferences
              </MenuItem>
              <MenuItem icon={phase === "day" ? <Moon /> : <Sun />} onClick={togglePhase}>
                {phase === "day" ? "Switch to dark theme" : "Switch to light theme"}
              </MenuItem>
              <MenuDivider />
              <MenuItem icon={<LogOut />} danger onClick={() => useAuth?.logout()}>
                Log out
              </MenuItem>
            </Menu>
          }
        />
      </div>
    </>
  );
}
