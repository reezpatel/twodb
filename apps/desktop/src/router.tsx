import { createBrowserRouter, Navigate } from "react-router";
import { RequireAuth } from "./components/require-auth";
import { AppLayout } from "./components/app-layout";
import { LoginPage } from "./routes/auth/login/login";
import { RegisterPage } from "./routes/auth/register/register";
import { ForgotPasswordPage } from "./routes/auth/forgot-password/forgot-password";
import { ResetPasswordPage } from "./routes/auth/reset-password/reset-password";
import { OrgPickerPage } from "./routes/orgs/org-picker";
import { HomePage } from "./routes/home/home";
import { AppPage } from "./routes/apps/app-page";
import { CodeScene } from "./routes/code/code-scene";
import { ChatPanel } from "./routes/code/chat/chat-panel";
import { ChatConversation } from "./routes/code/chat/chat-conversation";
import { TerminalScreen } from "./routes/code/chat/screens/terminal-screen";
import { CheckpointsScreen } from "./routes/code/chat/screens/checkpoints-screen";
import { ChangesScreen } from "./routes/code/chat/screens/changes-screen";
import { SettingsLayout } from "./routes/settings/settings-layout";
import { GeneralSection } from "./routes/settings/general/general";
import { AdministratorSection } from "./routes/settings/administrator/administrator";
import { LlmLayout } from "./routes/settings/llm/llm";
import { ConnectionsSection } from "./routes/settings/llm/connections/connections";
import { SkillsSection } from "./routes/settings/llm/skills/skills";
import { AgentsSection } from "./routes/settings/llm/agents/agents";
import { MemoriesSection } from "./routes/settings/llm/memories/memories";
import { InstructionsSection } from "./routes/settings/llm/instructions/instructions";
import { RunnersSection } from "./routes/settings/runners/runners";
import { CodeSection } from "./routes/settings/code/code";
import { StorageSection } from "./routes/settings/storage/storage";
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
          {
            path: "llm",
            Component: LlmLayout,
            children: [
              { index: true, element: <Navigate to="connections" replace /> },
              { path: "connections", Component: ConnectionsSection },
              { path: "skills/:skillId?", Component: SkillsSection },
              { path: "agents/:agentId?", Component: AgentsSection },
              { path: "memories/:memoryId?", Component: MemoriesSection },
              { path: "instructions/:instructionId?", Component: InstructionsSection },
            ],
          },
          { path: "runners", Component: RunnersSection },
          { path: "code", Component: CodeSection },
          { path: "storage", Component: StorageSection },
        ],
      },
      {
        path: "/apps/code",
        Component: CodeScene,
        children: [
          {
            path: ":sessionId",
            Component: ChatPanel,
            children: [
              { index: true, Component: ChatConversation },
              { path: "terminal", Component: TerminalScreen },
              { path: "checkpoints", Component: CheckpointsScreen },
              { path: "changes", Component: ChangesScreen },
            ],
          },
        ],
      },
      { path: "/apps/assistant", Component: AssistantScene },
      { path: "/apps/assistant/:threadId", Component: AssistantScene },
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
