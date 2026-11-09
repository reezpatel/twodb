import { z } from "zod";
import { defineAppMessages, defineBroadcastEvent } from "@twodb/core-async/registry";

export const appRegisteredEvent = defineBroadcastEvent({
  event: "twodb.app.registered",
  description: "Published whenever an app (re-)registers itself with TwoDB — e.g. after a deploy/restart.",
  direction: "produces",
  relatedApps: [],
  payload: z.object({ slug: z.string(), name: z.string(), version: z.string() }),
});

export const twodbMessages = defineAppMessages({
  name: "TwoDB",
  slug: "twodb",
  jobs: [],
  events: [appRegisteredEvent],
});

export default twodbMessages;
