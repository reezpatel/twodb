import {
  Bot,
  Calendar,
  CodeXml,
  Folder,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  MessageSquare,
  Settings,
  StickyNote,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface AppEntry {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const APPS: AppEntry[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "email", label: "Email", icon: Mail },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "code", label: "Code", icon: CodeXml },
  { id: "assistant", label: "Assistant", icon: Bot },
  { id: "meetings", label: "Meetings", icon: Video },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "showcase", label: "Showcase", icon: LayoutGrid },
  { id: "files", label: "Files", icon: Folder },
];

export const SETTINGS_APP: AppEntry = {
  id: "settings",
  label: "Settings",
  icon: Settings,
};

export function getApp(id: string | undefined): AppEntry | undefined {
  if (id === SETTINGS_APP.id) return SETTINGS_APP;
  return APPS.find((app) => app.id === id);
}
