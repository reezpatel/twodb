import { Calendar, CodeXml, Folder, LayoutGrid, Mail, MessageSquare, NotebookPen, Settings, Sparkles, Sunrise, Video, Zap, type LucideIcon } from "lucide-react";

export interface AppEntry {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const APPS: AppEntry[] = [
  { id: "overview", label: "Overview", icon: Sunrise },
  { id: "email", label: "Email", icon: Mail },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "code", label: "Code", icon: CodeXml },
  { id: "assistant", label: "Assistant", icon: Sparkles },
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
