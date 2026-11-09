import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface ShowcaseItem {
  id: string;
  title: string;
  group: string;
  Component: LazyExoticComponent<ComponentType>;
}

const def = (load: () => Promise<{ default: ComponentType }>) => lazy(load);

export const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: "finance-dashboard",
    title: "Finance dashboard",
    group: "Dashboards",
    Component: def(() => import("./mocks/finance-dashboard/finance-dashboard").then((m) => ({ default: m.FinanceDashboardMock }))),
  },
  {
    id: "ai-saas-dashboard",
    title: "AI SaaS dashboard",
    group: "Dashboards",
    Component: def(() => import("./mocks/ai-saas-dashboard/ai-saas-dashboard").then((m) => ({ default: m.AiSaasDashboardMock }))),
  },
  {
    id: "prodex-dashboard",
    title: "Prodex dashboard",
    group: "Dashboards",
    Component: def(() => import("./mocks/prodex-dashboard/prodex-dashboard").then((m) => ({ default: m.ProdexDashboardMock }))),
  },
  {
    id: "sales-mate-pro",
    title: "SalesMate Pro",
    group: "Dashboards",
    Component: def(() => import("./mocks/sales-mate-pro/sales-mate-pro").then((m) => ({ default: m.SalesMateProMock }))),
  },
  {
    id: "detected-accounts",
    title: "Detected accounts",
    group: "Dashboards",
    Component: def(() => import("./mocks/detected-accounts/detected-accounts").then((m) => ({ default: m.DetectedAccountsMock }))),
  },
  {
    id: "integrations",
    title: "Integrations",
    group: "Dashboards",
    Component: def(() => import("./mocks/integrations/integrations").then((m) => ({ default: m.IntegrationsMock }))),
  },
  {
    id: "automation",
    title: "Automation",
    group: "Builders",
    Component: def(() => import("./mocks/automation/automation").then((m) => ({ default: m.AutomationMock }))),
  },
  {
    id: "automation-builder",
    title: "Automation builder",
    group: "Builders",
    Component: def(() => import("./mocks/automation-builder/automation-builder").then((m) => ({ default: m.AutomationBuilderMock }))),
  },
  {
    id: "flow-builder",
    title: "Flow builder",
    group: "Builders",
    Component: def(() => import("./mocks/flow-builder/flow-builder").then((m) => ({ default: m.FlowBuilderMock }))),
  },
  {
    id: "ai-editor",
    title: "AI editor",
    group: "Builders",
    Component: def(() => import("./mocks/ai-editor/ai-editor").then((m) => ({ default: m.AIEditorMock }))),
  },
  {
    id: "notes-overview",
    title: "Notes overview",
    group: "Notes & data",
    Component: def(() => import("./mocks/notes-overview/notes-overview").then((m) => ({ default: m.NotesOverviewMock }))),
  },
  {
    id: "tolaria-notes",
    title: "Tolaria notes",
    group: "Notes & data",
    Component: def(() => import("./mocks/tolaria-notes/tolaria-notes").then((m) => ({ default: m.TolariaNotesMock }))),
  },
  {
    id: "issue-kanban",
    title: "Issue kanban",
    group: "Notes & data",
    Component: def(() => import("./mocks/issue-kanban/issue-kanban").then((m) => ({ default: m.IssueKanbanMock }))),
  },
  {
    id: "table-plan",
    title: "Table plan",
    group: "Notes & data",
    Component: def(() => import("./mocks/table-plan/table-plan").then((m) => ({ default: m.TablePlanMock }))),
  },
  {
    id: "knowledge-graph",
    title: "Knowledge graph",
    group: "Notes & data",
    Component: def(() => import("./mocks/knowledge-graph/knowledge-graph").then((m) => ({ default: m.KnowledgeGraphMock }))),
  },
  {
    id: "ticket-creator",
    title: "Ticket creator",
    group: "Notes & data",
    Component: def(() => import("./mocks/ticket-creator/ticket-creator").then((m) => ({ default: m.TicketCreatorMock }))),
  },
  {
    id: "todo-flow",
    title: "Todo flow",
    group: "Productivity",
    Component: def(() => import("./mocks/todo-flow/todo-flow").then((m) => ({ default: m.TodoFlowMock }))),
  },
  {
    id: "clock-planner",
    title: "Clock planner",
    group: "Productivity",
    Component: def(() => import("./mocks/clock-planner/clock-planner").then((m) => ({ default: m.ClockPlannerMock }))),
  },
  {
    id: "habit-tracker",
    title: "Habit tracker",
    group: "Productivity",
    Component: def(() => import("./mocks/habit-tracker/habit-tracker").then((m) => ({ default: m.HabitTrackerMock }))),
  },
  {
    id: "morning-brief",
    title: "Morning brief",
    group: "Productivity",
    Component: def(() => import("./mocks/morning-brief/morning-brief").then((m) => ({ default: m.MorningBriefMock }))),
  },
  {
    id: "employee-panel",
    title: "Employee panel",
    group: "Productivity",
    Component: def(() => import("./mocks/employee-panel/employee-panel").then((m) => ({ default: m.EmployeePanelMock }))),
  },
  {
    id: "share-dialog",
    title: "Share dialog",
    group: "Dialogs",
    Component: def(() => import("./mocks/share-dialog/share-dialog").then((m) => ({ default: m.ShareDialogMock }))),
  },
  {
    id: "share-dialog2",
    title: "Share dialog II",
    group: "Dialogs",
    Component: def(() => import("./mocks/share-dialog2/share-dialog2").then((m) => ({ default: m.ShareDialog2Mock }))),
  },
  {
    id: "share-settings",
    title: "Share settings",
    group: "Dialogs",
    Component: def(() => import("./mocks/share-settings/share-settings").then((m) => ({ default: m.ShareSettingsMock }))),
  },
  {
    id: "invite-modal",
    title: "Invite modal",
    group: "Dialogs",
    Component: def(() => import("./mocks/invite-modal/invite-modal").then((m) => ({ default: m.InviteModalMock }))),
  },
  {
    id: "notification-dialog",
    title: "Notification dialog",
    group: "Dialogs",
    Component: def(() => import("./mocks/notification-dialog/notification-dialog").then((m) => ({ default: m.NotificationDialogMock }))),
  },
  {
    id: "publish-project",
    title: "Publish project",
    group: "Dialogs",
    Component: def(() => import("./mocks/publish-project/publish-project").then((m) => ({ default: m.PublishProjectMock }))),
  },
  {
    id: "command-search",
    title: "Command search",
    group: "Dialogs",
    Component: def(() => import("./mocks/command-search/command-search").then((m) => ({ default: m.CommandSearchMock }))),
  },
  {
    id: "search-menu",
    title: "Search menu",
    group: "Dialogs",
    Component: def(() => import("./mocks/search-menu/search-menu").then((m) => ({ default: m.SearchMenuMock }))),
  },
  {
    id: "settings",
    title: "Settings",
    group: "Account & settings",
    Component: def(() => import("./mocks/settings/settings").then((m) => ({ default: m.SettingsMock }))),
  },
  {
    id: "company-profile",
    title: "Company profile",
    group: "Account & settings",
    Component: def(() => import("./mocks/company-profile/company-profile").then((m) => ({ default: m.CompanyProfileMock }))),
  },
  {
    id: "plans-billing",
    title: "Plans & billing",
    group: "Account & settings",
    Component: def(() => import("./mocks/plans-billing/plans-billing").then((m) => ({ default: m.PlansBillingMock }))),
  },
  {
    id: "permission-model",
    title: "Permission model",
    group: "Account & settings",
    Component: def(() => import("./mocks/permission-model/permission-model").then((m) => ({ default: m.PermissionModelMock }))),
  },
  {
    id: "two-factor",
    title: "Two-factor",
    group: "Account & settings",
    Component: def(() => import("./mocks/two-factor/two-factor").then((m) => ({ default: m.TwoFactorMock }))),
  },
  {
    id: "virtual-card",
    title: "Virtual card",
    group: "Account & settings",
    Component: def(() => import("./mocks/virtual-card/virtual-card").then((m) => ({ default: m.VirtualCardMock }))),
  },
];

export const SHOWCASE_GROUPS = [...new Set(SHOWCASE_ITEMS.map((i) => i.group))];
