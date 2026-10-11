import { Fragment, type ComponentType, type ReactNode } from "react";
import {
  Calendar,
  Contact,
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
import { EmailProvider, EmailSidenav } from "../routes/email/email-provider";
import { ContactsProvider, ContactsSidenav } from "../routes/contacts/contacts-provider";
import { CalendarProvider, CalendarSidenav } from "../routes/calendar/calendar-provider";
import { NotesProvider, NotesSidenav } from "../routes/notes/notes-provider";
import { ChatProvider, ChatSidenav } from "../routes/chat/chat-provider";
import { CodeProvider, CodeSidenav } from "../routes/code/code-provider";
import { FilesProvider, FilesSidenav } from "../routes/files/files-provider";
import { SettingsSidenav } from "../routes/settings/settings-sidenav";

export interface AppEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Scene-level state owner — wraps both the sidenav and the content so they
   * share one state instance when the shell renders the sidenav itself. */
  Provider?: ComponentType<{ children: ReactNode }>;
  /** App sidebar. Rendered by the app shell: a column beside the content on
   * desktop, inside the floating nav drawer on mobile. */
  Sidenav?: ComponentType;
}

export const APPS: AppEntry[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "email", label: "Email", icon: Mail, Provider: EmailProvider, Sidenav: EmailSidenav },
  { id: "calendar", label: "Calendar", icon: Calendar, Provider: CalendarProvider, Sidenav: CalendarSidenav },
  { id: "contacts", label: "Contacts", icon: Contact, Provider: ContactsProvider, Sidenav: ContactsSidenav },
  { id: "notes", label: "Notes", icon: StickyNote, Provider: NotesProvider, Sidenav: NotesSidenav },
  { id: "chat", label: "Chat", icon: MessageSquare, Provider: ChatProvider, Sidenav: ChatSidenav },
  { id: "code", label: "Code", icon: CodeXml, Provider: CodeProvider, Sidenav: CodeSidenav },
  { id: "meetings", label: "Meetings", icon: Video },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "showcase", label: "Showcase", icon: LayoutGrid },
  { id: "files", label: "Files", icon: Folder, Provider: FilesProvider, Sidenav: FilesSidenav },
];

export const SETTINGS_APP: AppEntry = {
  id: "settings",
  label: "Settings",
  icon: Settings,
  Sidenav: SettingsSidenav,
};

export function getApp(id: string | undefined): AppEntry | undefined {
  if (id === SETTINGS_APP.id) return SETTINGS_APP;
  return APPS.find((app) => app.id === id);
}

/** The app shell wrapper for an app: its Provider (when the app owns scene
 * state) around the sidenav + content, or a Fragment when it has none. */
export function appShellFor(entry: AppEntry | undefined): ComponentType<{ children: ReactNode }> {
  return entry?.Provider ?? Fragment;
}
