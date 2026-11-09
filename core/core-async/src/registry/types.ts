import type { ZodType } from "zod";

export type MessageDirection = "produces" | "consumes" | "produces+consumes";

export interface JobSpec {
  /** Job type string used in queue.enqueue(type, ...) / worker(types, ...). */
  type: string;
  description: string;
  direction: MessageDirection;
  payload: ZodType;
  /** Other apps known to enqueue/consume this job type (purely documentary). */
  relatedApps?: string[];
  retryNotes?: string;
}

export interface BroadcastEventSpec {
  event: string;
  description: string;
  direction: MessageDirection;
  payload: ZodType;
  relatedApps?: string[];
}

export interface AppMessagesSpec {
  name: string;
  slug: string;
  jobs: JobSpec[];
  events: BroadcastEventSpec[];
}

export function defineJob(spec: JobSpec): JobSpec {
  return spec;
}

export function defineBroadcastEvent(spec: BroadcastEventSpec): BroadcastEventSpec {
  return spec;
}

export function defineAppMessages(spec: AppMessagesSpec): AppMessagesSpec {
  return spec;
}
