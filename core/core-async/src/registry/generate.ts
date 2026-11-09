import { z } from "zod";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { AppMessagesSpec, BroadcastEventSpec, JobSpec } from "./types.js";

function schemaToJsonSchema(schema: unknown): unknown {
  try {
    return z.toJSONSchema(schema as z.ZodType, { target: "draft-7" });
  } catch (err) {
    return { note: "could not convert schema to JSON Schema", error: String(err) };
  }
}

export function toMessagesJson(spec: AppMessagesSpec) {
  return {
    name: spec.name,
    slug: spec.slug,
    generatedAt: new Date().toISOString(),
    jobs: spec.jobs.map((j) => ({
      type: j.type,
      description: j.description,
      direction: j.direction,
      relatedApps: j.relatedApps ?? [],
      retryNotes: j.retryNotes,
      payload: schemaToJsonSchema(j.payload),
    })),
    events: spec.events.map((e) => ({
      event: e.event,
      description: e.description,
      direction: e.direction,
      relatedApps: e.relatedApps ?? [],
      payload: schemaToJsonSchema(e.payload),
    })),
  };
}

function section(title: string, body: string[]): string[] {
  return [`### ${title}`, "", ...body, ""];
}

function jobBody(j: JobSpec, payloadJson: unknown): string[] {
  const lines = [j.description, "", `- **Direction**: \`${j.direction}\``];
  if (j.relatedApps?.length) lines.push(`- **Related apps**: ${j.relatedApps.join(", ")}`);
  if (j.retryNotes) lines.push(`- **Retry notes**: ${j.retryNotes}`);
  lines.push("", "**Payload**", "```json", JSON.stringify(payloadJson, null, 2), "```");
  return lines;
}

function eventBody(e: BroadcastEventSpec, payloadJson: unknown): string[] {
  const lines = [e.description, "", `- **Direction**: \`${e.direction}\``];
  if (e.relatedApps?.length) lines.push(`- **Related apps**: ${e.relatedApps.join(", ")}`);
  lines.push("", "**Payload**", "```json", JSON.stringify(payloadJson, null, 2), "```");
  return lines;
}

export function toMessagesMarkdown(spec: AppMessagesSpec): string {
  const json = toMessagesJson(spec);
  const lines: string[] = [];
  lines.push(`# MESSAGES.md — ${spec.name}`);
  lines.push("");
  lines.push(
    "> **Generated file — do not hand-edit.** Source of truth is `src/messages.ts` " +
      "(Zod schemas via `@twodb/core-async/registry`). Regenerate with `pnpm gen:docs`.",
  );
  lines.push("");
  lines.push(`_Generated: ${json.generatedAt}_`);
  lines.push("");
  lines.push("## Queue jobs");
  lines.push("");
  if (spec.jobs.length === 0) {
    lines.push("_No queue jobs declared yet._", "");
  } else {
    for (const j of spec.jobs) {
      const jj = json.jobs.find((x) => x.type === j.type);
      lines.push(...section(`\`${j.type}\``, jobBody(j, jj?.payload)));
    }
  }
  lines.push("## Broadcast events");
  lines.push("");
  if (spec.events.length === 0) {
    lines.push("_No broadcast events declared yet._", "");
  } else {
    for (const e of spec.events) {
      const ej = json.events.find((x) => x.event === e.event);
      lines.push(...section(`\`${e.event}\``, eventBody(e, ej?.payload)));
    }
  }
  return lines.join("\n");
}

export async function writeMessagesArtifacts(
  spec: AppMessagesSpec,
  outDir: string,
): Promise<{ messagesJsonPath: string; messagesMdPath: string }> {
  await fs.mkdir(outDir, { recursive: true });
  const messagesJsonPath = path.join(outDir, "messages.json");
  const messagesMdPath = path.join(outDir, "MESSAGES.md");
  await fs.writeFile(messagesJsonPath, JSON.stringify(toMessagesJson(spec), null, 2) + "\n", "utf8");
  await fs.writeFile(messagesMdPath, toMessagesMarkdown(spec), "utf8");
  return { messagesJsonPath, messagesMdPath };
}
