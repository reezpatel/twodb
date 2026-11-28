import type { ConnectorTemplate } from "./types.js";
import { planeTemplate } from "./plane.js";
import { aiRunnerTemplate } from "./ai-runner.js";

/** All code-owned connector templates. UI gallery + validation both read this. */
const TEMPLATES: ConnectorTemplate[] = [planeTemplate, aiRunnerTemplate];

export function listTemplates(): ConnectorTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): ConnectorTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
