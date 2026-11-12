import { defineAppMessages } from "@twodb/core-async/registry";

// TwoPlan has no background jobs or broadcast events in v1 (no automation,
// no realtime collaboration). Notifications are written synchronously.
export const messages = defineAppMessages({ name: "TwoPlan", slug: "twoplan", jobs: [], events: [] });

export default messages;
