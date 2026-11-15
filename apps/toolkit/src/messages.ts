import { z } from "zod";
import { defineAppMessages } from "@twodb/core-async/registry";

export const toolkitMessages = defineAppMessages({
  name: "Toolkit",
  slug: "toolkit",
  jobs: [],
  events: [
    {
      // Connector broadcasts fan out on the workspace broadcast channel as
      // `toolkit.connector.event` envelopes; consumers can also pull them
      // durably per queue (GET /queues/:instanceId/:name/next).
      event: "toolkit.connector.event",
      description: "A connector instance emitted a broadcast event.",
      direction: "produces",
      payload: z.object({
        instanceId: z.string(),
        templateId: z.string(),
        event: z.string(),
        payload: z.unknown(),
      }),
    },
  ],
});

export default toolkitMessages;
