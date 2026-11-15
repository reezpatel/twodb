import { defineAppMessages } from "@twodb/core-async/registry";

// Fincal has no background jobs or broadcast events in v1 (net-worth snapshots are written lazily on read).
export const messages = defineAppMessages({ name: "Fincal", slug: "fincal", jobs: [], events: [] });

export default messages;
