import type { RouteDef } from "../lib/route.js";
import { configRoutes } from "./config.js";
import { projectRoutes } from "./projects.js";
import { ticketListRoutes, ticketCreateRoute } from "./tickets-list-create.js";
import { ticketDetailRoutes } from "./tickets-detail.js";
import { epicMilestoneRoutes } from "./epics-milestones.js";
import { ticketExtraRoutes } from "./ticket-extras.js";
import { projectContentRoutes } from "./project-content.js";
import { workspaceRoutes } from "./workspace.js";
import { importExportRoutes } from "./import-export.js";

export const allRoutes: RouteDef[] = [
  ...projectRoutes,
  ...configRoutes,
  ...ticketListRoutes,
  ticketCreateRoute,
  ...ticketDetailRoutes,
  ...ticketExtraRoutes,
  ...epicMilestoneRoutes,
  ...projectContentRoutes,
  ...workspaceRoutes,
  ...importExportRoutes,
];
