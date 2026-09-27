import { createBrowserRouter, Navigate } from "react-router";
import { RequireAuth } from "./components/require-auth";
import { AppLayout } from "./components/app-layout";
import { LoginPage } from "./routes/login/login";
import { RegisterPage } from "./routes/register/register";
import { ForgotPasswordPage } from "./routes/forgot-password/forgot-password";
import { ResetPasswordPage } from "./routes/reset-password/reset-password";
import { OrgPickerPage } from "./routes/orgs/org-picker";
import { HomePage } from "./routes/home/home";
import { AppPage } from "./routes/apps/app-page";
import { CodeScene } from "./routes/code/code-scene";
import { SettingsLayout } from "./routes/settings/settings-layout";
import { GeneralSection } from "./routes/settings/general";
import { AdministratorSection } from "./routes/settings/administrator";
import { LlmSection } from "./routes/settings/llm";
import { RunnersSection } from "./routes/settings/runners";
import { StorageSection } from "./routes/settings/storage";
import { FilesScene } from "./routes/files/files-scene";
import { AssistantScene } from "./routes/assistant/assistant-scene";
import { NotesScene } from "./routes/notes/notes-scene";
import { EmailScene } from "./routes/email/email-scene";
import { ChatScene } from "./routes/chat/chat-scene";
import { CalendarScene } from "./routes/calendar/calendar-scene";
import { MeetingsScene } from "./routes/meetings/meetings-scene";
import { AutomationsScene } from "./routes/automations/automations-scene";
import { OverviewScene } from "./routes/overview/overview-scene";
import { ShowcaseScene } from "./routes/showcase/showcase-scene";

export const router = createBrowserRouter([
  { path: "/login", Component: LoginPage },
  { path: "/register", Component: RegisterPage },
  { path: "/forgot-password", Component: ForgotPasswordPage },
  { path: "/reset-password", Component: ResetPasswordPage },
  {
    path: "/orgs",
    element: (
      <RequireAuth>
        <OrgPickerPage />
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth requireOrg>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: "/", Component: HomePage },
      {
        path: "/apps/settings",
        Component: SettingsLayout,
        children: [
          { index: true, element: <Navigate to="general" replace /> },
          { path: "general", Component: GeneralSection },
          { path: "administrator", Component: AdministratorSection },
          { path: "llm", Component: LlmSection },
          { path: "runners", Component: RunnersSection },
          { path: "storage", Component: StorageSection },
        ],
      },
      { path: "/apps/code", Component: CodeScene },
      { path: "/apps/assistant", Component: AssistantScene },
      { path: "/apps/overview", Component: OverviewScene },
      { path: "/apps/email", Component: EmailScene },
      { path: "/apps/calendar", Component: CalendarScene },
      { path: "/apps/chat", Component: ChatScene },
      { path: "/apps/meetings", Component: MeetingsScene },
      { path: "/apps/automations", Component: AutomationsScene },
      { path: "/apps/showcase", Component: ShowcaseScene },
      { path: "/apps/notes", Component: NotesScene },
      { path: "/apps/files", Component: FilesScene },
      { path: "/apps/:appId", Component: AppPage },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
