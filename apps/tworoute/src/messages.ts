import { defineAppMessages } from "@twodb/core-async/registry";

// No queue jobs or broadcast events yet — completions are synchronous
// streamed requests (see README), not decoupled async work. Add here the
// moment TwoRoute needs e.g. a "usage.recorded" event for billing/limits.
export const tworouteMessages = defineAppMessages({ name: "TwoRoute", slug: "tworoute", jobs: [], events: [] });

export default tworouteMessages;
