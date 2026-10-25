type Id = string | number;

const APPS_ROOT = "/apps";
const SETTINGS_ROOT = `${APPS_ROOT}/settings`;
const LLM_ROOT = `${SETTINGS_ROOT}/llm`;

const withId = (base: string, id?: Id | null) => (id === undefined || id === null || id === "" ? base : `${base}/${id}`);

export type CodePanel = "terminal" | "editor" | "checkpoints" | "changes" | "canvas";
export type SettingsLlmSection = "connections" | "skills" | "agents" | "memories" | "instructions" | "mcp";

export const urls = {
  home: () => "/",
  share: () => "/share",

  app: (appId: string) => `${APPS_ROOT}/${appId}`,

  settings: {
    root: () => SETTINGS_ROOT,
    section: (sectionId: string) => `${SETTINGS_ROOT}/${sectionId}`,
    accounts: () => `${SETTINGS_ROOT}/accounts`,
    storage: () => `${SETTINGS_ROOT}/storage`,
    calendar: () => `${SETTINGS_ROOT}/calendar`,
    notifications: () => `${SETTINGS_ROOT}/notifications`,
    sharedContent: () => `${SETTINGS_ROOT}/shared-content`,
    llm: {
      root: () => LLM_ROOT,
      section: (section: SettingsLlmSection, id?: Id | null) => withId(`${LLM_ROOT}/${section}`, id),
      connections: () => `${LLM_ROOT}/connections`,
      skills: (skillId?: Id | null) => withId(`${LLM_ROOT}/skills`, skillId),
      agents: (agentId?: Id | null) => withId(`${LLM_ROOT}/agents`, agentId),
      memories: (memoryId?: Id | null) => withId(`${LLM_ROOT}/memories`, memoryId),
      instructions: (instructionId?: Id | null) => withId(`${LLM_ROOT}/instructions`, instructionId),
      mcp: (mcpId?: Id | null) => withId(`${LLM_ROOT}/mcp`, mcpId),
    },
  },

  code: {
    root: () => `${APPS_ROOT}/code`,
    session: (sessionId: Id, panel?: CodePanel | null) => withId(`${APPS_ROOT}/code/${sessionId}`, panel),
  },

  notes: {
    root: () => `${APPS_ROOT}/notes`,
    databases: () => `${APPS_ROOT}/notes/databases`,
    node: (nodeId: Id) => `${APPS_ROOT}/notes/${nodeId}`,
    row: (nodeId: Id, rowId: Id) => `${APPS_ROOT}/notes/${nodeId}/${rowId}`,
  },

  projects: {
    root: () => `${APPS_ROOT}/projects`,
    project: (projectId: Id, tab?: string | null) => withId(`${APPS_ROOT}/projects/${projectId}`, tab),
    ticket: (projectId: Id, ticketId: Id) => `${APPS_ROOT}/projects/${projectId}/ticket/${ticketId}`,
  },

  meetings: {
    root: () => `${APPS_ROOT}/meetings`,
    recording: (recordingId: Id) => `${APPS_ROOT}/meetings/${recordingId}`,
  },
} as const;
