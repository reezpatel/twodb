import { createContext, useContext, type ReactNode } from "react";
import type { Project, ProjectConfig } from "./types";

export interface ProjectCtx {
  project: Project;
  config: ProjectConfig;
  status: (id: string | null | undefined) => ProjectConfig["statuses"][number] | undefined;
  type: (id: string | null | undefined) => ProjectConfig["ticketTypes"][number] | undefined;
  label: (id: string) => ProjectConfig["labels"][number] | undefined;
}
const Ctx = createContext<ProjectCtx | null>(null);

export function ProjectProvider({ project, config, children }: { project: Project; config: ProjectConfig; children: ReactNode }) {
  const value: ProjectCtx = {
    project, config,
    status: (id) => config.statuses.find((s) => s.id === id),
    type: (id) => config.ticketTypes.find((s) => s.id === id),
    label: (id) => config.labels.find((l) => l.id === id),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useProjectCtx(): ProjectCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProjectCtx outside ProjectProvider");
  return v;
}
